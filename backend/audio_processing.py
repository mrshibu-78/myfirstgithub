from __future__ import annotations

import io
from dataclasses import dataclass

import librosa
import numpy as np
import soundfile as sf
from scipy import signal


@dataclass
class VoiceSettings:
    pitch: float
    timbre: float
    depth: float
    speed: float
    emotion: float
    morph: float
    noise_reduction: float
    clarity: float


def _safe_normalize(audio: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(audio)) if audio.size else 0
    if peak == 0:
        return audio
    return audio / peak


def _apply_noise_gate(audio: np.ndarray, strength: float) -> np.ndarray:
    threshold = np.percentile(np.abs(audio), 20) * (1 + strength)
    gated = np.where(np.abs(audio) < threshold, audio * 0.1, audio)
    return gated


def _apply_filter(audio: np.ndarray, sr: int, cutoff: float, btype: str, gain: float) -> np.ndarray:
    b, a = signal.butter(2, cutoff / (sr / 2), btype=btype)
    filtered = signal.lfilter(b, a, audio)
    return audio + filtered * gain


def process_audio(file_bytes: bytes, settings: VoiceSettings) -> bytes:
    audio, sr = librosa.load(io.BytesIO(file_bytes), sr=44100, mono=True)

    if settings.speed != 1:
        audio = librosa.effects.time_stretch(audio, rate=max(0.5, settings.speed))

    morph_shift = settings.morph / 25
    pitch_shift = settings.pitch + morph_shift
    if pitch_shift != 0:
        audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=pitch_shift)

    if settings.timbre != 0:
        audio = _apply_filter(audio, sr, cutoff=2800, btype="highpass", gain=settings.timbre / 80)

    if settings.depth != 0:
        audio = _apply_filter(audio, sr, cutoff=180, btype="lowpass", gain=settings.depth / 60)

    if settings.emotion > 0:
        intensity = settings.emotion / 120
        audio = np.tanh(audio * (1 + intensity))

    if settings.noise_reduction > 0:
        audio = _apply_noise_gate(audio, settings.noise_reduction / 100)

    if settings.clarity > 0:
        audio = _apply_filter(audio, sr, cutoff=3200, btype="highpass", gain=settings.clarity / 120)

    audio = _safe_normalize(audio)

    buffer = io.BytesIO()
    sf.write(buffer, audio, sr, format="WAV")
    return buffer.getvalue()
