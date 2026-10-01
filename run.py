#!/usr/bin/env python3
import os
import sys
import subprocess
import webbrowser
import time

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(PROJECT_DIR, ".venv", "bin", "python")
VENV_PIP = os.path.join(PROJECT_DIR, ".venv", "bin", "pip")

def ensure_env():
    """Asegura que el entorno virtual y las dependencias estén listos."""
    if not os.path.exists(VENV_PYTHON):
        print("📦 Creando entorno virtual...")
        subprocess.run([sys.executable, "-m", "venv", os.path.join(PROJECT_DIR, ".venv")], check=True)

    # Verificar si uvicorn y yt-dlp están instalados
    check = subprocess.run([VENV_PYTHON, "-c", "import fastapi, yt_dlp, uvicorn"], capture_output=True)
    if check.returncode != 0:
        print("📥 Instalando dependencias necesarias (yt-dlp, fastapi, uvicorn)...")
        subprocess.run([VENV_PIP, "install", "-r", os.path.join(PROJECT_DIR, "requirements.txt")], check=True)

def main():
    os.chdir(PROJECT_DIR)
    ensure_env()

    # Si no se está ejecutando dentro del venv, reejecutar con el python del venv
    if sys.prefix == sys.base_prefix and os.path.exists(VENV_PYTHON):
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)

    import socket
    def get_local_ip():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    local_ip = get_local_ip()

    print("\n" + "="*60)
    print("🚀 Iniciando MediaDownloader Pro...")
    print(f"💻 En este equipo:  http://localhost:8000")
    print(f"📱 En tu teléfono:   http://{local_ip}:8000")
    print("📁 Carpeta de descargas: ~/Downloads/MediaDownloader")
    print("="*60 + "\n")

    # Abrir navegador tras 1.2 segundos
    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    main()
