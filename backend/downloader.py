import os
import shutil
import threading
import time
from typing import Dict, Any, List, Optional
import yt_dlp

DOWNLOAD_DIR = os.path.expanduser("~/Downloads/MediaDownloader")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def find_ffmpeg() -> Optional[str]:
    """Busca ffmpeg en el sistema o en homebrew."""
    brew_ffmpeg = "/opt/homebrew/bin/ffmpeg"
    if os.path.isfile(brew_ffmpeg) and os.access(brew_ffmpeg, os.X_OK):
        return brew_ffmpeg
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    local_ffmpeg = os.path.join(os.path.dirname(__file__), "bin", "ffmpeg")
    if os.path.isfile(local_ffmpeg) and os.access(local_ffmpeg, os.X_OK):
        return local_ffmpeg
    return None

def format_bytes(bytes_num: Optional[float]) -> str:
    """Convierte bytes a formato legible (KB, MB, GB)."""
    if bytes_num is None or bytes_num <= 0:
        return "Desconocido"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:.1f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f} PB"

def format_duration(seconds: Optional[int]) -> str:
    """Convierte segundos a formato MM:SS o HH:MM:SS."""
    if not seconds:
        return "00:00"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

import warnings
warnings.filterwarnings("ignore")

DEFAULT_YDL_OPTS = {
    'quiet': True,
    'no_warnings': True,
    'extractor_args': {
        'youtube': {
            'player_client': ['ios', 'android', 'web']
        }
    },
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    }
}

class MediaInspector:
    @staticmethod
    def inspect(url: str) -> Dict[str, Any]:
        """Extrae metadatos, formatos disponibles y calcula pesos estimados."""
        ffmpeg_location = find_ffmpeg()
        ydl_opts = {
            **DEFAULT_YDL_OPTS,
            'skip_download': True,
            'extract_flat': 'in_playlist',
        }
        if ffmpeg_location:
            ydl_opts['ffmpeg_location'] = ffmpeg_location

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        # Detectar si es una playlist
        is_playlist = (
            info.get('_type') == 'playlist' or
            'entries' in info and isinstance(info.get('entries'), list) and len(info['entries']) > 1
        )

        if is_playlist:
            entries = []
            for item in info.get('entries', []):
                if not item:
                    continue
                entries.append({
                    'id': item.get('id', ''),
                    'title': item.get('title', 'Sin título'),
                    'duration': item.get('duration'),
                    'duration_formatted': format_duration(item.get('duration')),
                    'thumbnail': item.get('thumbnail') or (item.get('thumbnails', [{}])[-1].get('url') if item.get('thumbnails') else None),
                    'url': item.get('url') or item.get('webpage_url') or f"https://www.youtube.com/watch?v={item.get('id')}",
                    'uploader': item.get('uploader') or item.get('channel') or 'Desconocido'
                })

            return {
                'is_playlist': True,
                'title': info.get('title', 'Lista de Reproducción'),
                'item_count': len(entries),
                'uploader': info.get('uploader') or info.get('channel') or '',
                'thumbnail': entries[0]['thumbnail'] if entries else None,
                'entries': entries
            }

        # Es un video / audio individual
        duration = info.get('duration', 0) or 0
        formats = info.get('formats', [])

        # Calcular tamaño del mejor stream de audio para sumarlo a los videos adaptive
        best_audio_size = 0
        audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
        if audio_formats:
            best_audio = max(audio_formats, key=lambda f: (f.get('abr') or 0, f.get('filesize') or 0))
            best_audio_size = best_audio.get('filesize') or best_audio.get('filesize_approx') or 0
            if not best_audio_size and duration and best_audio.get('abr'):
                best_audio_size = (best_audio['abr'] * 1024 / 8) * duration

        # Si aún no tenemos best_audio_size y hay duración, estimar a 128kbps
        if not best_audio_size and duration:
            best_audio_size = (128 * 1000 / 8) * duration

        # Organizar calidades de video
        video_options = []
        seen_res = set()

        # Ordenar formatos por resolución y bitrate descendente
        sorted_formats = sorted(
            formats,
            key=lambda f: (f.get('height') or 0, f.get('fps') or 0, f.get('tbr') or 0),
            reverse=True
        )

        for f in sorted_formats:
            height = f.get('height')
            if not height or height < 144:
                continue

            # Agrupamos por resolución principal (ej. 2160, 1440, 1080, 720, 480, 360)
            res_key = f"{height}p"
            if res_key in seen_res:
                continue

            vcodec = f.get('vcodec', '')
            ext = f.get('ext', 'mp4')
            fps = f.get('fps')
            is_combined = f.get('acodec') != 'none' and f.get('vcodec') != 'none'

            # Calcular tamaño de archivo
            raw_size = f.get('filesize') or f.get('filesize_approx')
            if not raw_size and duration and (f.get('tbr') or f.get('vbr')):
                bitrate = f.get('tbr') or f.get('vbr')
                raw_size = (bitrate * 1024 / 8) * duration

            # Si es solo video (común en YouTube 1080p, 4K), sumamos el audio
            total_size = (raw_size or 0) + (0 if is_combined else best_audio_size)

            label = f"{height}p"
            if height >= 2160:
                label += " (4K Ultra HD)"
            elif height >= 1440:
                label += " (2K QHD)"
            elif height >= 1080:
                label += " (Full HD)"
            elif height >= 720:
                label += " (HD)"

            if fps and fps > 30:
                label += f" {fps}fps"

            format_selector = f"{f['format_id']}+ba/b" if not is_combined else f['format_id']

            video_options.append({
                'format_id': format_selector,
                'direct_format_id': f['format_id'],
                'height': height,
                'label': label,
                'container': 'mp4',
                'filesize': int(total_size) if total_size > 0 else None,
                'filesize_formatted': format_bytes(total_size if total_size > 0 else None),
                'fps': fps,
                'vcodec': vcodec
            })
            seen_res.add(res_key)

        # Opciones de audio personalizadas (MP3 en varias tasas de bits, M4A, etc.)
        audio_options = []
        bitrates = [
            (320, "MP3 - 320 kbps (Máxima Fidelidad)"),
            (256, "MP3 - 256 kbps (Muy Alta Calidad)"),
            (192, "MP3 - 192 kbps (Calidad Estándar)"),
            (128, "MP3 - 128 kbps (Archivo Ligero)"),
        ]

        for kbps, desc in bitrates:
            est_size = (kbps * 1000 / 8) * duration if duration else None
            audio_options.append({
                'format': 'mp3',
                'quality': str(kbps),
                'label': desc,
                'container': 'mp3',
                'filesize': int(est_size) if est_size else None,
                'filesize_formatted': format_bytes(est_size) if est_size else "Estimado al descargar"
            })

        # M4A directo / FLAC / WAV
        if duration:
            m4a_size = best_audio_size if best_audio_size > 0 else (128 * 1000 / 8) * duration
            audio_options.append({
                'format': 'm4a',
                'quality': 'best',
                'label': 'M4A / AAC (Audio original nativo)',
                'container': 'm4a',
                'filesize': int(m4a_size),
                'filesize_formatted': format_bytes(m4a_size)
            })
            # Estimación FLAC (aprox ~800 kbps)
            flac_size = (800 * 1000 / 8) * duration
            audio_options.append({
                'format': 'flac',
                'quality': 'lossless',
                'label': 'FLAC (Sin pérdida de calidad)',
                'container': 'flac',
                'filesize': int(flac_size),
                'filesize_formatted': format_bytes(flac_size)
            })
            # Estimación WAV (PCM 16-bit 44.1kHz estéreo = 1411 kbps)
            wav_size = (1411 * 1000 / 8) * duration
            audio_options.append({
                'format': 'wav',
                'quality': 'lossless',
                'label': 'WAV (Audio sin comprimir de estudio)',
                'container': 'wav',
                'filesize': int(wav_size),
                'filesize_formatted': format_bytes(wav_size)
            })

        # Thumbnail prioritario
        thumbnail = info.get('thumbnail')
        if not thumbnail and info.get('thumbnails'):
            thumbnail = info['thumbnails'][-1].get('url')

        return {
            'is_playlist': False,
            'id': info.get('id', ''),
            'title': info.get('title', 'Video sin título'),
            'duration': duration,
            'duration_formatted': format_duration(duration),
            'uploader': info.get('uploader') or info.get('channel') or 'Desconocido',
            'thumbnail': thumbnail,
            'extractor': info.get('extractor_key') or info.get('extractor') or 'Web',
            'video_options': video_options,
            'audio_options': audio_options
        }

class DownloadManager:
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.tasks.get(task_id)

    def start_download(self, task_id: str, download_params: Dict[str, Any]):
        """Inicia la descarga en un hilo en segundo plano."""
        self.tasks[task_id] = {
            'status': 'starting',
            'percent': 0.0,
            'speed': '0 B/s',
            'eta': '0s',
            'downloaded_bytes': 0,
            'total_bytes': 0,
            'filename': '',
            'filepath': '',
            'title': download_params.get('title', 'Descargando...'),
            'error': None,
            'completed': False
        }

        thread = threading.Thread(
            target=self._run_download,
            args=(task_id, download_params),
            daemon=True
        )
        thread.start()

    def _progress_hook(self, task_id: str, d: Dict[str, Any]):
        task = self.tasks.get(task_id)
        if not task:
            return

        status = d.get('status')
        if status == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes') or 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0

            percent = 0.0
            if total > 0:
                percent = round((downloaded / total) * 100, 1)

            task['status'] = 'downloading'
            task['percent'] = percent
            task['downloaded_bytes'] = downloaded
            task['total_bytes'] = total
            task['speed'] = f"{format_bytes(speed)}/s" if speed else "Calculando..."
            task['eta'] = f"{eta}s" if eta else "Listo pronto"

            filename = d.get('filename')
            if filename:
                task['filename'] = os.path.basename(filename)

        elif status == 'finished':
            task['status'] = 'processing'
            task['percent'] = 99.0
            filename = d.get('filename')
            if filename:
                task['filename'] = os.path.basename(filename)
                task['filepath'] = filename

    def _run_download(self, task_id: str, params: Dict[str, Any]):
        task = self.tasks[task_id]
        url = params['url']
        download_type = params.get('type', 'video')  # 'video' o 'audio'
        ffmpeg_location = find_ffmpeg()

        output_template = os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s')

        ydl_opts: Dict[str, Any] = {
            **DEFAULT_YDL_OPTS,
            'outtmpl': output_template,
            'progress_hooks': [lambda d: self._progress_hook(task_id, d)],
        }

        if ffmpeg_location:
            ydl_opts['ffmpeg_location'] = ffmpeg_location

        if download_type == 'audio':
            audio_format = params.get('audio_format', 'mp3')
            quality = params.get('audio_quality', '320')
            ydl_opts['format'] = 'bestaudio/best'
            postprocessors = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': audio_format,
            }]
            if audio_format == 'mp3' and quality.isdigit():
                postprocessors[0]['preferredquality'] = quality
            ydl_opts['postprocessors'] = postprocessors
        else:
            # Video
            format_id = params.get('format_id')
            if format_id:
                ydl_opts['format'] = format_id
            else:
                ydl_opts['format'] = 'bestvideo+bestaudio/best'
            
            # Asegurar salida en mp4 si ffmpeg está disponible
            if ffmpeg_location:
                ydl_opts['merge_output_format'] = 'mp4'

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                task['title'] = info.get('title', task['title'])
                
                # Obtener la ruta final
                if 'requested_downloads' in info and info['requested_downloads']:
                    filepath = info['requested_downloads'][0].get('filepath')
                else:
                    filepath = ydl.prepare_filename(info)
                
                if filepath:
                    task['filepath'] = filepath
                    task['filename'] = os.path.basename(filepath)

            task['status'] = 'completed'
            task['percent'] = 100.0
            task['completed'] = True

        except Exception as e:
            task['status'] = 'error'
            task['error'] = str(e)
            task['completed'] = True

download_manager = DownloadManager()
