import os
import subprocess
import uuid
import asyncio
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .downloader import (
    MediaInspector,
    download_manager,
    DOWNLOAD_DIR,
    find_ffmpeg,
    format_bytes
)

app = FastAPI(title="Media Downloader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InspectRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    type: str = "video"  # "video" o "audio"
    format_id: Optional[str] = None
    audio_format: Optional[str] = "mp3"
    audio_quality: Optional[str] = "320"
    title: Optional[str] = "Descarga"

class PlaylistDownloadRequest(BaseModel):
    items: List[DownloadRequest]

@app.get("/api/status")
def get_status():
    ffmpeg_path = find_ffmpeg()
    return {
        "ffmpeg_installed": ffmpeg_path is not None,
        "ffmpeg_path": ffmpeg_path,
        "download_dir": DOWNLOAD_DIR
    }

@app.post("/api/inspect")
def inspect_media(req: InspectRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Por favor ingresa una URL válida")
    try:
        data = MediaInspector.inspect(url)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el enlace: {str(e)}")

@app.post("/api/download")
def start_download(req: DownloadRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="URL requerida")
    
    task_id = str(uuid.uuid4())
    download_manager.start_download(task_id, {
        'url': req.url,
        'type': req.type,
        'format_id': req.format_id,
        'audio_format': req.audio_format,
        'audio_quality': req.audio_quality,
        'title': req.title or 'Descarga'
    })
    return {"task_id": task_id}

@app.get("/api/progress/{task_id}")
def get_progress(task_id: str):
    task = download_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task

@app.get("/api/stream-progress/{task_id}")
async def stream_progress(task_id: str):
    task = download_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    async def event_generator():
        import json
        while True:
            current = download_manager.get_task(task_id)
            if not current:
                break
            payload = json.dumps(current)
            yield f"data: {payload}\n\n"
            if current.get('completed'):
                break
            await asyncio.sleep(0.4)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/file/{task_id}")
def download_completed_file(task_id: str):
    task = download_manager.get_task(task_id)
    if not task or not task.get('filepath'):
        raise HTTPException(status_code=404, detail="Archivo no encontrado o descarga incompleta")
    filepath = task['filepath']
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="El archivo no existe en el servidor")
    
    return FileResponse(
        filepath,
        media_type="application/octet-stream",
        filename=task.get('filename') or os.path.basename(filepath)
    )

@app.post("/api/open-folder")
def open_folder():
    try:
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        subprocess.run(["open", DOWNLOAD_DIR], check=True)
        return {"status": "ok", "path": DOWNLOAD_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/downloads")
def list_downloads():
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    files = []
    try:
        entries = sorted(
            [os.path.join(DOWNLOAD_DIR, f) for f in os.listdir(DOWNLOAD_DIR)],
            key=os.path.getmtime,
            reverse=True
        )
        for filepath in entries:
            if os.path.isfile(filepath) and not os.path.basename(filepath).startswith('.'):
                st = os.stat(filepath)
                files.append({
                    'name': os.path.basename(filepath),
                    'size_bytes': st.st_size,
                    'size_formatted': format_bytes(st.st_size),
                    'modified': st.st_mtime,
                    'path': filepath
                })
    except Exception:
        pass
    return {"downloads": files, "download_dir": DOWNLOAD_DIR}

# Servir archivos estáticos del frontend
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
