import React, { useMemo, useRef, useState } from 'react';

const defaultSettings = {
  pitch: 0,
  timbre: 0,
  depth: 0,
  speed: 1,
  emotion: 50,
  morph: 0,
  noiseReduction: 40,
  clarity: 60
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatSeconds = (seconds) => {
  if (!Number.isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [settings, setSettings] = useState(defaultSettings);
  const [inputFile, setInputFile] = useState(null);
  const [inputUrl, setInputUrl] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('Ready.');
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [waveformMeta, setWaveformMeta] = useState({ duration: 0, samples: [] });
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const onFileSelected = async (file) => {
    if (!file) return;
    setInputFile(file);
    const url = URL.createObjectURL(file);
    setInputUrl(url);
    setOutputUrl('');
    setStatus(`Loaded ${file.name}`);
    await loadWaveform(file);
  };

  const loadWaveform = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleStep = Math.floor(channelData.length / 250);
      const samples = [];
      for (let i = 0; i < channelData.length; i += sampleStep) {
        samples.push(channelData[i]);
      }
      setWaveformMeta({ duration: audioBuffer.duration, samples });
      requestAnimationFrame(() => drawWaveform(samples));
    } catch (error) {
      console.error(error);
      setStatus('Waveform unavailable.');
    }
  };

  const drawWaveform = (samples) => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme === 'dark' ? '#0c0f1d' : '#eef1ff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = theme === 'dark' ? '#7aa2ff' : '#2b5cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const mid = height / 2;
    samples.forEach((sample, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = mid + sample * mid * 0.9;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileSelected(event.dataTransfer.files[0]);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    setRecordedChunks([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      setStatus('Recording...');
    } catch (error) {
      console.error(error);
      setStatus('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recording) {
      recorder.stop();
      setStatus('Recording stopped.');
    }
  };

  const saveRecording = async () => {
    if (recordedChunks.length === 0) {
      setStatus('No recording available.');
      return;
    }
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
    await onFileSelected(file);
    setStatus('Recording ready for conversion.');
  };

  const previewAudio = async () => {
    if (!inputFile) {
      setStatus('Upload or record audio first.');
      return;
    }
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();
      filterNode.type = 'lowshelf';
      filterNode.frequency.value = 200;
      filterNode.gain.value = clamp(settings.depth * 0.6, -12, 12);
      gainNode.gain.value = clamp(settings.clarity / 100, 0.6, 1.4);

      source.playbackRate.value = clamp(settings.speed, 0.5, 1.8);
      source.detune.value = settings.pitch * 25;

      source.connect(filterNode).connect(gainNode).connect(audioContext.destination);
      source.start();
      setStatus('Previewing with real-time processing...');
    } catch (error) {
      console.error(error);
      setStatus('Preview failed.');
    }
  };

  const submitConversion = async () => {
    if (!inputFile) {
      setStatus('Upload or record audio first.');
      return;
    }
    if (!consent) {
      setStatus('Please confirm consent before processing.');
      return;
    }
    setProcessing(true);
    setStatus('Processing with neural conversion...');
    const formData = new FormData();
    formData.append('audio', inputFile);
    Object.entries(settings).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const response = await fetch(`${apiBase}/api/convert`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error('Conversion failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setStatus('Conversion complete.');
    } catch (error) {
      console.error(error);
      setStatus('Conversion failed.');
    } finally {
      setProcessing(false);
    }
  };

  const themeClass = useMemo(() => (theme === 'dark' ? 'theme-dark' : 'theme-light'), [theme]);

  return (
    <div className={`app ${themeClass}`} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      <header className="hero">
        <div>
          <p className="tag">VoiceForge Studio</p>
          <h1>Real-time voice-to-voice transformation with authentic expression.</h1>
          <p className="subtitle">
            Neural conversion that preserves your identity while reshaping pitch, timbre, depth, and emotion — without
            celebrity cloning.
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="primary" onClick={submitConversion} disabled={processing}>
            {processing ? 'Processing…' : 'Render voice'}
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card upload-card">
          <h2>Input</h2>
          <div className="upload-area">
            <input
              type="file"
              id="file-upload"
              accept="audio/mpeg,audio/wav,audio/webm"
              onChange={(event) => onFileSelected(event.target.files[0])}
            />
            <label htmlFor="file-upload">
              <span>Drag & drop MP3/WAV or click to upload</span>
              <small>Studio-grade WAV recommended</small>
            </label>
          </div>
          <div className="record-controls">
            <button className="ghost" onClick={startRecording} disabled={recording}>
              Start recording
            </button>
            <button className="ghost" onClick={stopRecording} disabled={!recording}>
              Stop
            </button>
            <button className="ghost" onClick={saveRecording}>
              Save take
            </button>
          </div>
          <div className="audio-preview">
            <audio controls src={inputUrl || undefined} />
            <div className="waveform">
              <canvas ref={canvasRef} width="540" height="120" />
              <div className="wave-meta">
                <span>Duration: {formatSeconds(waveformMeta.duration)}</span>
                <span>Waveform capture</span>
              </div>
            </div>
            <button className="secondary" onClick={previewAudio}>
              Real-time preview
            </button>
          </div>
        </section>

        <section className="card controls-card">
          <h2>Voice controls</h2>
          <div className="slider-group">
            <label>
              Pitch ({settings.pitch} st)
              <input
                type="range"
                min="-12"
                max="12"
                value={settings.pitch}
                onChange={(event) => updateSetting('pitch', Number(event.target.value))}
              />
            </label>
            <label>
              Timbre ({settings.timbre})
              <input
                type="range"
                min="-50"
                max="50"
                value={settings.timbre}
                onChange={(event) => updateSetting('timbre', Number(event.target.value))}
              />
            </label>
            <label>
              Depth ({settings.depth})
              <input
                type="range"
                min="-30"
                max="30"
                value={settings.depth}
                onChange={(event) => updateSetting('depth', Number(event.target.value))}
              />
            </label>
            <label>
              Speed ({settings.speed}x)
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={settings.speed}
                onChange={(event) => updateSetting('speed', Number(event.target.value))}
              />
            </label>
            <label>
              Emotion intensity ({settings.emotion}%)
              <input
                type="range"
                min="0"
                max="100"
                value={settings.emotion}
                onChange={(event) => updateSetting('emotion', Number(event.target.value))}
              />
            </label>
            <label>
              Male ↔ Female ↔ Neutral ({settings.morph})
              <input
                type="range"
                min="-50"
                max="50"
                value={settings.morph}
                onChange={(event) => updateSetting('morph', Number(event.target.value))}
              />
            </label>
          </div>
          <div className="slider-group">
            <label>
              Noise reduction ({settings.noiseReduction}%)
              <input
                type="range"
                min="0"
                max="100"
                value={settings.noiseReduction}
                onChange={(event) => updateSetting('noiseReduction', Number(event.target.value))}
              />
            </label>
            <label>
              Clarity enhancement ({settings.clarity}%)
              <input
                type="range"
                min="0"
                max="100"
                value={settings.clarity}
                onChange={(event) => updateSetting('clarity', Number(event.target.value))}
              />
            </label>
          </div>
          <div className="consent">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <label htmlFor="consent">I confirm I own or have permission to process this voice. No celebrity cloning.</label>
          </div>
        </section>

        <section className="card output-card">
          <h2>Output</h2>
          <div className="status">
            <span className={processing ? 'pulse' : ''}>{status}</span>
            <div className="progress">
              <div className={`progress-bar ${processing ? 'active' : ''}`} />
            </div>
          </div>
          <div className="audio-preview">
            <audio controls src={outputUrl || undefined} />
          </div>
          <div className="output-actions">
            <button className="primary" onClick={submitConversion} disabled={processing}>
              {processing ? 'Rendering…' : 'Render final'}
            </button>
            {outputUrl && (
              <a className="ghost" href={outputUrl} download="voiceforge-output.wav">
                Download
              </a>
            )}
          </div>
          <div className="note">
            <p>Ethics & safety: VoiceForge blocks celebrity or identity cloning and logs consent for every render.</p>
            <p>Optional watermarking is enabled for free-tier outputs.</p>
          </div>
        </section>

        <section className="card extras-card">
          <h2>Upgrade & API</h2>
          <div className="extras">
            <div>
              <h3>Free</h3>
              <ul>
                <li>Realtime preview (local)</li>
                <li>Limited render queue</li>
                <li>Watermarked export</li>
              </ul>
            </div>
            <div>
              <h3>Pro</h3>
              <ul>
                <li>Studio-grade conversion</li>
                <li>Saved history + profiles</li>
                <li>Developer API access</li>
              </ul>
            </div>
          </div>
          <button className="secondary">Request API access</button>
        </section>
      </main>
    </div>
  );
}
