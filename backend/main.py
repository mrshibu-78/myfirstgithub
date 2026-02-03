from __future__ import annotations

import os
from typing import Annotated

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from audio_processing import VoiceSettings, process_audio
from models import Base, RenderJob

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./voiceforge.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok"}


@app.post("/api/convert")
async def convert_audio(
    audio: UploadFile = File(...),
    pitch: Annotated[float, Form()] = 0,
    timbre: Annotated[float, Form()] = 0,
    depth: Annotated[float, Form()] = 0,
    speed: Annotated[float, Form()] = 1,
    emotion: Annotated[float, Form()] = 50,
    morph: Annotated[float, Form()] = 0,
    noiseReduction: Annotated[float, Form()] = 40,
    clarity: Annotated[float, Form()] = 60,
):
    file_bytes = await audio.read()
    settings = VoiceSettings(
        pitch=pitch,
        timbre=timbre,
        depth=depth,
        speed=speed,
        emotion=emotion,
        morph=morph,
        noise_reduction=noiseReduction,
        clarity=clarity
    )

    processed_bytes = process_audio(file_bytes, settings)

    with SessionLocal() as session:
        session.add(
            RenderJob(
                filename=audio.filename or "upload",
                status="completed",
                consent_confirmed=True
            )
        )
        session.commit()

    headers = {"Content-Disposition": "attachment; filename=voiceforge-output.wav"}
    return StreamingResponse(
        iter([processed_bytes]),
        media_type="audio/wav",
        headers=headers
    )
