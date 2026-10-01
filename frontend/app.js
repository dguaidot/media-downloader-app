// State
let currentMediaData = null;
let activeDownloads = {};
let playlistEntries = [];

// DOM Elements
const urlInput = document.getElementById('url-input');
const btnPaste = document.getElementById('btn-paste');
const btnInspect = document.getElementById('btn-inspect');
const loadingSpinner = document.getElementById('loading-spinner');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const resultsContainer = document.getElementById('results-container');
const btnOpenFolder = document.getElementById('btn-open-folder');
const ffmpegBadge = document.getElementById('ffmpeg-badge');

// Tabs
const tabVideo = document.getElementById('tab-video');
const tabAudio = document.getElementById('tab-audio');
const tabPlaylist = document.getElementById('tab-playlist');
const contentVideo = document.getElementById('content-video');
const contentAudio = document.getElementById('content-audio');
const contentPlaylist = document.getElementById('content-playlist');

// Media display elements
const mediaThumb = document.getElementById('media-thumb');
const mediaDurationBadge = document.getElementById('media-duration-badge');
const mediaTitle = document.getElementById('media-title');
const mediaAuthorName = document.getElementById('media-author-name');
const mediaBadgeSource = document.getElementById('media-badge-source');
const mediaTypeBadge = document.getElementById('media-type-badge');

const videoOptionsList = document.getElementById('video-options-list');
const audioOptionsList = document.getElementById('audio-options-list');
const playlistItemsList = document.getElementById('playlist-items-list');
const playlistSelectAll = document.getElementById('playlist-select-all');
const playlistSelectedCount = document.getElementById('playlist-selected-count');
const playlistCountTab = document.getElementById('playlist-count-tab');
const btnDownloadPlaylist = document.getElementById('btn-download-playlist');
const playlistBatchFormat = document.getElementById('playlist-batch-format');

const downloadsList = document.getElementById('downloads-list');
const noDownloadsPlaceholder = document.getElementById('no-downloads-placeholder');
const btnClearCompleted = document.getElementById('btn-clear-completed');

// Initialize Lucide icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Check system status
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.ffmpeg_installed) {
      ffmpegBadge.classList.remove('hidden');
      ffmpegBadge.classList.add('flex');
    } else {
      ffmpegBadge.classList.remove('hidden', 'border-emerald-500/30', 'bg-emerald-500/10', 'text-emerald-400');
      ffmpegBadge.classList.add('flex', 'border-amber-500/30', 'bg-amber-500/10', 'text-amber-400');
      ffmpegBadge.innerHTML = `<i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i><span>Instalando FFmpeg</span>`;
      refreshIcons();
    }
  } catch (err) {
    console.error('Error fetching system status', err);
  }
}

// Paste button
btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      inspectUrl();
    }
  } catch (err) {
    urlInput.focus();
  }
});

// Enter key in input
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    inspectUrl();
  }
});

// Inspect button
btnInspect.addEventListener('click', inspectUrl);

// Open downloads folder
btnOpenFolder.addEventListener('click', async () => {
  try {
    await fetch('/api/open-folder', { method: 'POST' });
  } catch (err) {
    showError('No se pudo abrir la carpeta en Finder');
  }
});

function showError(msg) {
  errorMessage.textContent = msg;
  errorBox.classList.remove('hidden');
  loadingSpinner.classList.add('hidden');
  refreshIcons();
}

function hideError() {
  errorBox.classList.add('hidden');
}

// Tab Switching
function switchTab(activeTab, activeContent) {
  [tabVideo, tabAudio, tabPlaylist].forEach(t => {
    t.classList.remove('active', 'border-purple-500', 'text-purple-400');
    t.classList.add('border-transparent', 'text-slate-400');
  });
  [contentVideo, contentAudio, contentPlaylist].forEach(c => c.classList.add('hidden'));

  activeTab.classList.add('active', 'border-purple-500', 'text-purple-400');
  activeTab.classList.remove('border-transparent', 'text-slate-400');
  activeContent.classList.remove('hidden');
}

tabVideo.addEventListener('click', () => switchTab(tabVideo, contentVideo));
tabAudio.addEventListener('click', () => switchTab(tabAudio, contentAudio));
tabPlaylist.addEventListener('click', () => switchTab(tabPlaylist, contentPlaylist));

// Inspect URL
async function inspectUrl() {
  const url = urlInput.value.trim();
  if (!url) {
    showError('Por favor introduce un enlace antes de analizar.');
    return;
  }

  hideError();
  resultsContainer.classList.add('hidden');
  loadingSpinner.classList.remove('hidden');
  btnInspect.disabled = true;

  try {
    const res = await fetch('/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al analizar el enlace');
    }

    const data = await res.json();
    currentMediaData = data;
    renderResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    loadingSpinner.classList.add('hidden');
    btnInspect.disabled = false;
  }
}

// Render Results
function renderResults(data) {
  resultsContainer.classList.remove('hidden');

  // Thumbnail & Duration
  if (data.thumbnail) {
    mediaThumb.src = data.thumbnail;
    mediaThumb.classList.remove('hidden');
  } else {
    mediaThumb.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60';
  }

  mediaDurationBadge.textContent = data.duration_formatted || (data.is_playlist ? `${data.item_count} videos` : '');
  mediaTitle.textContent = data.title;
  mediaAuthorName.textContent = data.uploader || 'Canal desconocido';
  mediaBadgeSource.textContent = data.extractor || 'Web';

  if (data.is_playlist) {
    mediaTypeBadge.textContent = 'Playlist';
    tabPlaylist.classList.remove('hidden');
    playlistCountTab.textContent = data.item_count;
    renderPlaylist(data.entries);
    switchTab(tabPlaylist, contentPlaylist);
  } else {
    mediaTypeBadge.textContent = 'Video';
    tabPlaylist.classList.add('hidden');
    renderVideoOptions(data.video_options || []);
    renderAudioOptions(data.audio_options || []);
    switchTab(tabVideo, contentVideo);
  }

  refreshIcons();
}

// Render Video Options with File Size and Resolution
function renderVideoOptions(options) {
  videoOptionsList.innerHTML = '';
  if (!options || options.length === 0) {
    videoOptionsList.innerHTML = `
      <div class="col-span-2 text-center py-6 text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
        No se encontraron formatos de video estándar directos. Puedes intentar descargarlo como audio o enlace genérico.
      </div>`;
    return;
  }

  options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 p-3.5 rounded-xl flex items-center justify-between transition group shadow-sm';
    
    // Badge color according to resolution
    let badgeColor = 'bg-slate-800 text-slate-300';
    if (opt.height >= 2160) badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    else if (opt.height >= 1440) badgeColor = 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30';
    else if (opt.height >= 1080) badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    else if (opt.height >= 720) badgeColor = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';

    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded text-xs font-bold ${badgeColor}">
            ${opt.label}
          </span>
          <span class="text-xs uppercase text-slate-400 font-mono">
            ${opt.container}
          </span>
        </div>
        <div class="text-xs text-slate-400 flex items-center space-x-2">
          <span>Peso aprox:</span>
          <span class="text-emerald-400 font-semibold font-mono text-sm">${opt.filesize_formatted}</span>
        </div>
      </div>
      <button 
        data-format="${opt.format_id}" 
        data-title="${encodeURIComponent(currentMediaData.title)}"
        class="btn-dl-video px-4 py-2 bg-slate-800 hover:bg-purple-600 text-slate-100 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow group-hover:bg-purple-600">
        <i data-lucide="download" class="w-4 h-4"></i>
        <span>Descargar</span>
      </button>
    `;

    card.querySelector('.btn-dl-video').addEventListener('click', () => {
      triggerDownload({
        url: urlInput.value.trim(),
        type: 'video',
        format_id: opt.format_id,
        title: currentMediaData.title
      });
    });

    videoOptionsList.appendChild(card);
  });
}

// Render Audio Options with File Size and Presets
function renderAudioOptions(options) {
  audioOptionsList.innerHTML = '';
  if (!options || options.length === 0) {
    audioOptionsList.innerHTML = `
      <div class="col-span-2 text-center py-6 text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
        No se pudieron generar presets de audio.
      </div>`;
    return;
  }

  options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-3.5 rounded-xl flex items-center justify-between transition group shadow-sm';

    let badgeColor = 'bg-slate-800 text-slate-300';
    if (opt.format === 'mp3' && opt.quality === '320') badgeColor = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
    else if (opt.format === 'flac' || opt.format === 'wav') badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    else if (opt.format === 'm4a') badgeColor = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';

    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded text-xs font-bold ${badgeColor}">
            ${opt.label}
          </span>
        </div>
        <div class="text-xs text-slate-400 flex items-center space-x-2">
          <span>Peso aprox:</span>
          <span class="text-emerald-400 font-semibold font-mono text-sm">${opt.filesize_formatted}</span>
        </div>
      </div>
      <button 
        data-audio-format="${opt.format}" 
        data-quality="${opt.quality}"
        class="btn-dl-audio px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-100 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow group-hover:bg-indigo-600">
        <i data-lucide="music" class="w-4 h-4"></i>
        <span>Descargar MP3</span>
      </button>
    `;

    card.querySelector('.btn-dl-audio').addEventListener('click', () => {
      triggerDownload({
        url: urlInput.value.trim(),
        type: 'audio',
        audio_format: opt.format,
        audio_quality: opt.quality,
        title: currentMediaData.title
      });
    });

    audioOptionsList.appendChild(card);
  });
}

// Render Playlist entries
function renderPlaylist(entries) {
  playlistEntries = entries || [];
  playlistItemsList.innerHTML = '';
  playlistSelectedCount.textContent = playlistEntries.length;

  playlistEntries.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition';
    
    row.innerHTML = `
      <input type="checkbox" data-index="${index}" class="playlist-item-check w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-800 border-slate-700" checked>
      <span class="text-xs text-slate-500 font-mono w-6 text-right">${index + 1}</span>
      <div class="w-14 h-9 bg-slate-900 rounded overflow-hidden flex-shrink-0">
        <img src="${item.thumbnail || ''}" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-slate-200 truncate" title="${item.title}">${item.title}</div>
        <div class="text-[11px] text-slate-500">${item.uploader} • ${item.duration_formatted}</div>
      </div>
    `;

    row.querySelector('.playlist-item-check').addEventListener('change', updatePlaylistSelectedCount);
    playlistItemsList.appendChild(row);
  });
}

function updatePlaylistSelectedCount() {
  const checked = document.querySelectorAll('.playlist-item-check:checked');
  playlistSelectedCount.textContent = checked.length;
}

playlistSelectAll.addEventListener('change', (e) => {
  const checks = document.querySelectorAll('.playlist-item-check');
  checks.forEach(c => c.checked = e.target.checked);
  updatePlaylistSelectedCount();
});

// Download batch playlist
btnDownloadPlaylist.addEventListener('click', async () => {
  const checked = Array.from(document.querySelectorAll('.playlist-item-check:checked'));
  if (checked.length === 0) {
    showError('Debes seleccionar al menos un video de la lista de reproducción.');
    return;
  }

  const batchOption = playlistBatchFormat.value;
  let dlType = 'video';
  let formatId = null;
  let audioFormat = 'mp3';
  let audioQuality = '320';

  if (batchOption === 'video-best') {
    dlType = 'video';
    formatId = 'bestvideo+bestaudio/best';
  } else if (batchOption === 'video-720') {
    dlType = 'video';
    formatId = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
  } else if (batchOption === 'audio-320') {
    dlType = 'audio';
    audioFormat = 'mp3';
    audioQuality = '320';
  } else if (batchOption === 'audio-192') {
    dlType = 'audio';
    audioFormat = 'mp3';
    audioQuality = '192';
  } else if (batchOption === 'audio-m4a') {
    dlType = 'audio';
    audioFormat = 'm4a';
  }

  // Queue each selected video
  for (const cb of checked) {
    const idx = parseInt(cb.dataset.index, 10);
    const item = playlistEntries[idx];
    if (item) {
      await triggerDownload({
        url: item.url,
        type: dlType,
        format_id: formatId,
        audio_format: audioFormat,
        audio_quality: audioQuality,
        title: item.title
      });
      // slight delay to stagger calls
      await new Promise(r => setTimeout(r, 200));
    }
  }
});

// Trigger Single Download
async function triggerDownload(params) {
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al iniciar la descarga');
    }

    const { task_id } = await res.json();
    createDownloadCard(task_id, params.title);
    trackDownloadProgress(task_id);
  } catch (err) {
    showError(`Error al descargar: ${err.message}`);
  }
}

// Create Download Progress Card
function createDownloadCard(taskId, title) {
  noDownloadsPlaceholder.classList.add('hidden');
  btnClearCompleted.classList.remove('hidden');

  const card = document.createElement('div');
  card.id = `dl-task-${taskId}`;
  card.className = 'bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 transition shadow-md';

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2.5 min-w-0 pr-4">
        <i data-lucide="loader" class="w-4 h-4 text-purple-400 animate-spin flex-shrink-0 task-icon"></i>
        <span class="text-sm font-semibold text-slate-200 truncate task-title">${title}</span>
      </div>
      <span class="task-status-badge text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
        Iniciando...
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
      <div class="task-progress-bar bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
    </div>

    <!-- Meta Details (Speed, ETA, Size) -->
    <div class="flex items-center justify-between text-xs text-slate-400 font-mono">
      <span class="task-stats">0% • 0 B/s</span>
      <span class="task-eta">Estimando tiempo...</span>
    </div>

    <!-- Actions (hidden until completed) -->
    <div class="task-actions hidden pt-2 flex flex-wrap items-center justify-end gap-2">
      <a href="/api/file/${taskId}" download class="btn-save-device px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow shadow-emerald-600/20 no-underline">
        <i data-lucide="arrow-down-circle" class="w-4 h-4"></i>
        <span>Guardar en mi teléfono/PC</span>
      </a>
      <button class="btn-task-open px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center space-x-1.5 transition border border-slate-700">
        <i data-lucide="folder-open" class="w-3.5 h-3.5 text-purple-400"></i>
        <span>Ver en carpeta</span>
      </button>
    </div>
  `;

  card.querySelector('.btn-task-open').addEventListener('click', () => {
    fetch('/api/open-folder', { method: 'POST' });
  });

  downloadsList.prepend(card);
  refreshIcons();
}

// Track Download Progress using SSE or Polling
function trackDownloadProgress(taskId) {
  const card = document.getElementById(`dl-task-${taskId}`);
  if (!card) return;

  const progressBar = card.querySelector('.task-progress-bar');
  const statusBadge = card.querySelector('.task-status-badge');
  const statsText = card.querySelector('.task-stats');
  const etaText = card.querySelector('.task-eta');
  const taskIcon = card.querySelector('.task-icon');
  const actionsDiv = card.querySelector('.task-actions');
  const titleText = card.querySelector('.task-title');

  let eventSource = null;

  try {
    eventSource = new EventSource(`/api/stream-progress/${taskId}`);
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      updateTaskUI(data);
      if (data.completed) {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      if (eventSource) eventSource.close();
      // Fallback a polling
      pollProgress(taskId);
    };
  } catch (err) {
    pollProgress(taskId);
  }

  function updateTaskUI(data) {
    if (data.title) titleText.textContent = data.title;
    const percent = Math.min(100, Math.max(0, data.percent || 0));
    progressBar.style.width = `${percent}%`;

    if (data.status === 'downloading') {
      statusBadge.textContent = `${percent}%`;
      statusBadge.className = 'task-status-badge text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300';
      statsText.textContent = `${percent}% • ${data.speed}`;
      etaText.textContent = `Restante: ${data.eta}`;
    } else if (data.status === 'processing') {
      statusBadge.textContent = 'Procesando...';
      statusBadge.className = 'task-status-badge text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300';
      statsText.textContent = 'Uniendo audio/video y convirtiendo formato...';
      etaText.textContent = '';
    } else if (data.status === 'completed') {
      progressBar.style.width = '100%';
      progressBar.className = 'task-progress-bar bg-emerald-500 h-2.5 rounded-full transition-all';
      statusBadge.textContent = 'Completado';
      statusBadge.className = 'task-status-badge text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300';
      statsText.textContent = data.filename || 'Archivo guardado';
      etaText.textContent = 'Listo en ~/Downloads';
      
      taskIcon.outerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400 flex-shrink-0"></i>';
      actionsDiv.classList.remove('hidden');
      refreshIcons();
    } else if (data.status === 'error') {
      progressBar.className = 'task-progress-bar bg-red-500 h-2.5 rounded-full';
      statusBadge.textContent = 'Error';
      statusBadge.className = 'task-status-badge text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300';
      statsText.textContent = data.error || 'Ocurrió un error al descargar';
      etaText.textContent = '';
      taskIcon.outerHTML = '<i data-lucide="alert-octagon" class="w-4 h-4 text-red-400 flex-shrink-0"></i>';
      refreshIcons();
    }
  }

  function pollProgress(tId) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${tId}`);
        if (!res.ok) {
          clearInterval(interval);
          return;
        }
        const data = await res.json();
        updateTaskUI(data);
        if (data.completed) {
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 800);
  }
}

// Clear completed downloads
btnClearCompleted.addEventListener('click', () => {
  const cards = document.querySelectorAll('#downloads-list > div:not(#no-downloads-placeholder)');
  cards.forEach(card => {
    const badge = card.querySelector('.task-status-badge');
    if (badge && (badge.textContent.includes('Completado') || badge.textContent.includes('Error'))) {
      card.remove();
    }
  });

  const remaining = document.querySelectorAll('#downloads-list > div:not(#no-downloads-placeholder)');
  if (remaining.length === 0) {
    noDownloadsPlaceholder.classList.remove('hidden');
    btnClearCompleted.classList.add('hidden');
  }
});

// Initial boot
checkSystemStatus();
refreshIcons();
