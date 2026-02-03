# VoiceForge Studio

VoiceForge Studio is a modern, responsive web application for **real-time, original voice-to-voice transformation**. It lets users record or upload audio, adjust expressive controls, preview changes instantly in the browser, and render a studio-grade output with a backend neural conversion pipeline.

> **Ethics & Safety**: VoiceForge explicitly blocks celebrity or identity cloning. Users must confirm consent before processing.

## Features

- Browser microphone recording (MediaRecorder)
- Drag-and-drop upload for MP3/WAV/WebM
- Real-time preview using Web Audio API
- Sliders for pitch, timbre, depth, speed, emotion intensity, morphing, noise reduction, and clarity
- Male ↔ Female ↔ Neutral morphing controls
- Waveform visualization
- Final render with downloadable WAV output
- Light + dark mode

## Tech Stack

**Frontend**: React + Vite (modern UI, responsive, dark/light)

**Backend**: FastAPI + Python

**Audio Processing**: Librosa + SciPy (placeholder neural conversion hooks)

**Database**: SQLite + SQLAlchemy (history/profiles scaffold)

## Project Structure

```
/frontend  # React client
/backend   # FastAPI service
```

## Local Development

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

By default, the UI expects the API at `http://localhost:8000`. You can override with:

```bash
VITE_API_BASE=http://localhost:8000 npm run dev
```

## Deployment (Overview)

### Frontend

- Build: `npm run build`
- Deploy static assets from `frontend/dist` to Vercel, Netlify, or S3 + CloudFront.

### Backend

- Deploy FastAPI using a container (Docker, Fly.io, Render) with the command:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 8000
  ```
- Use GPU-enabled instances if running a true neural conversion model.

## Database Schema (SQLAlchemy)

**users**
- `id`: integer primary key
- `email`: unique identifier
- `plan`: `free | pro`
- `created_at`: timestamp

**render_jobs**
- `id`: integer primary key
- `user_id`: foreign key (optional)
- `filename`: source audio filename
- `status`: `completed | failed | queued`
- `consent_confirmed`: boolean
- `created_at`: timestamp

## AI / Audio Processing Notes

The current backend includes signal-processing placeholders (pitch shifting, time stretching, filtering). The architecture is ready for real neural voice conversion:

- Plug in PyTorch/TensorFlow models for neural VC.
- Add ONNX runtime for faster inference.
- Replace `process_audio` with your model pipeline while keeping API contracts intact.

## Ethics & Safety Requirements

- **No celebrity or identity cloning**.
- User consent is required before conversion.
- Optional watermarking can be enabled for free-tier output.

---

**VoiceForge Studio** is designed to preserve speaker identity while enabling expressive transformations in a safe, ethical manner.
