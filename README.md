# 🚀 MediaDownloader Pro

Aplicación moderna, rápida y sencilla para descargar **videos**, **música (MP3/FLAC/M4A)** y **playlists completas** desde **YouTube, Facebook, Instagram, TikTok, Twitter/X** y más de 1000 sitios web.

---

## ✨ Características Principales

- 📹 **Selector de Resolución y Formato de Video**: Elige entre 4K Ultra HD, 2K, 1080p Full HD, 720p HD, 480p, etc., en formato universal MP4.
- ⚖️ **Cálculo y Visualización de Peso en MB/GB**: Antes de presionar descargar, la app calcula y te muestra el tamaño estimado o exacto del archivo.
- 🎵 **Descargador de Música / Audio**:
  - MP3 a **320 kbps** (Calidad Estudio)
  - MP3 a **256 kbps**, **192 kbps** o **128 kbps**
  - M4A / AAC (audio original nativo sin recodificar)
  - FLAC y WAV sin pérdida
- 📑 **Soporte Completo para Playlists de YouTube**:
  - Detección automática al pegar un enlace de lista de reproducción.
  - Vista previa de todos los videos y duraciones.
  - Selección individual o "Seleccionar todos".
  - Descarga en lote con el formato que elijas (Video o MP3).
- ⚡ **Progreso en Vivo**: Barra de porcentaje interactiva, velocidad de descarga en tiempo real (MB/s) y tiempo estimado restante.
- 📁 **Carpeta de Guardado Directa**: Todos los archivos se guardan en tu carpeta `~/Downloads/MediaDownloader/` con un botón de acceso directo para abrirla en el Finder de macOS.
- 🎬 **FFmpeg 9.0 Integrado**: Instalado y configurado automáticamente para fusionar flujos en máxima calidad y convertir audios con alta fidelidad.

---

## 🚀 Cómo Iniciar la Aplicación

Puedes iniciar la aplicación de dos maneras muy sencillas:

### Opción 1: Con el comando de inicio rápido
Abre tu terminal en la carpeta del proyecto y ejecuta:
```bash
./start.sh
```

### Opción 2: Con Python
```bash
python3 run.py
```

La aplicación se iniciará e **irá directamente a abrir tu navegador web en `http://localhost:8000`**.

---

## 📂 Estructura del Proyecto

```
media-downloader/
├── backend/
│   ├── downloader.py      # Motor yt-dlp con cálculo de pesos y soporte para playlists
│   └── server.py          # API FastAPI y servidor de archivos estáticos
├── frontend/
│   ├── index.html         # Interfaz web responsiva con Tailwind CSS y Lucide Icons
│   ├── app.js             # Lógica cliente, SSE para progreso en tiempo real y tabs
│   └── styles.css         # Estilos visuales complementarios
├── run.py                 # Lanzador automático
├── start.sh               # Acceso directo para terminal
├── requirements.txt       # Dependencias Python
└── test_downloader.py     # Suite de pruebas unitarias
```
