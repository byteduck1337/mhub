import { state, dom } from './config.js';
import { showNotification, formatTime, escapeHtml, loadFromCache, saveToCache } from './utils.js';
import { playTrack, prevTrack, nextTrack } from './player.js';
import { downloadTrack } from './download.js';
import { shareTrack } from './ui.js';
import { showLyrics } from './ui.js';

export function openFullscreenPlayer() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    let fullscreenPlayer = document.getElementById('fullscreenPlayer');
    if (!fullscreenPlayer) {
        fullscreenPlayer = document.createElement('div');
        fullscreenPlayer.id = 'fullscreenPlayer';
        fullscreenPlayer.className = 'fullscreen-player';
        document.body.appendChild(fullscreenPlayer);
    }

    fullscreenPlayer.classList.remove('hidden');

    let lyricsHtml = '<p style="color:var(--text-muted);text-align:center;">Загрузка текста...</p>';
    const lyricsCache = loadFromCache(`lyrics_${track.id}`);
    if (lyricsCache) {
        lyricsHtml = lyricsCache.split('\n').map(line => 
            `<div class="fullscreen-player__lyrics-line">${escapeHtml(line) || ' '}</div>`
        ).join('');
    }

    const currentTimeFormatted = formatTime(dom.audio.currentTime || 0);
    const totalTimeFormatted = formatTime(track.duration || 0);
    const isLiked = window.isTrackLiked(track.id);

    fullscreenPlayer.innerHTML = `
        <div class="fullscreen-player__overlay" onclick="window.closeFullscreenPlayer()"></div>
        <div class="fullscreen-player__content">
            <button class="fullscreen-player__close" onclick="window.closeFullscreenPlayer()">✕</button>
            <div class="fullscreen-player__artwork">
                <img src="${track.cover}" alt="${escapeHtml(track.name)}" />
            </div>
            <div class="fullscreen-player__info">
                <h2 class="fullscreen-player__title">${escapeHtml(track.name)}</h2>
                <p class="fullscreen-player__artist">${escapeHtml(track.artist)}</p>
            </div>
            <div class="fullscreen-player__controls">
                <button class="fullscreen-player__control" onclick="window.toggleFullscreenShuffle()" id="fsShuffle">🔀</button>
                <button class="fullscreen-player__control" onclick="window.fullscreenPrev()">⏮</button>
                <button class="fullscreen-player__play" onclick="window.toggleFullscreenPlay()" id="fsPlayBtn">${state.isPlaying ? '⏸' : '▶'}</button>
                <button class="fullscreen-player__control" onclick="window.fullscreenNext()">⏭</button>
                <button class="fullscreen-player__control" onclick="window.toggleFullscreenRepeat()" id="fsRepeat">🔁</button>
            </div>
            <div class="fullscreen-player__progress">
                <span class="fullscreen-player__time" id="fsCurrentTime">${currentTimeFormatted}</span>
                <input type="range" class="fullscreen-player__progress-bar" id="fsProgressBar" min="0" max="100" value="${dom.progressBar.value || 0}" />
                <span class="fullscreen-player__time" id="fsTotalTime">${totalTimeFormatted}</span>
            </div>
            <div class="fullscreen-player__actions">
                <button class="fullscreen-player__action" onclick="window.toggleFullscreenLike(${track.id})" id="fsLikeBtn">${isLiked ? '❤️' : '🤍'}</button>
                <button class="fullscreen-player__action" onclick="window.fullscreenDownload()">⬇</button>
                <button class="fullscreen-player__action" onclick="window.fullscreenShare()">📤</button>
                <button class="fullscreen-player__action" onclick="window.fullscreenLyrics()">📝</button>
                <button class="fullscreen-player__action" onclick="window.fullscreenAddToPlaylist()">➕</button>
            </div>
            <div class="fullscreen-player__lyrics" id="fsLyrics">${lyricsHtml}</div>
        </div>
    `;

    const fsProgressBar = document.getElementById('fsProgressBar');
    const fsCurrentTime = document.getElementById('fsCurrentTime');
    const fsTotalTime = document.getElementById('fsTotalTime');

    if (fsProgressBar) {
        fsProgressBar.addEventListener('input', () => {
            const audio = dom.audio;
            if (audio.duration && !isNaN(audio.duration)) {
                audio.currentTime = (fsProgressBar.value / 100) * audio.duration;
            }
        });
    }

    const updateFullscreenTime = () => {
        const audio = dom.audio;
        if (audio.duration && !isNaN(audio.duration)) {
            if (fsProgressBar) fsProgressBar.value = (audio.currentTime / audio.duration) * 100;
            if (fsCurrentTime) fsCurrentTime.textContent = formatTime(audio.currentTime);
            if (fsTotalTime) fsTotalTime.textContent = formatTime(audio.duration);
        }
    };

    const fsInterval = setInterval(updateFullscreenTime, 500);
    fullscreenPlayer._interval = fsInterval;
}

export function closeFullscreenPlayer() {
    const player = document.getElementById('fullscreenPlayer');
    if (player) {
        if (player._interval) clearInterval(player._interval);
        player.classList.add('hidden');
        player.innerHTML = '';
    }
}

export function toggleFullscreenPlay() {
    const audio = dom.audio;
    if (audio.paused) {
        audio.play().catch(() => showNotification('Ошибка воспроизведения', 'error'));
        dom.playBtn.textContent = '⏸';
        state.isPlaying = true;
    } else {
        audio.pause();
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
    const btn = document.getElementById('fsPlayBtn');
    if (btn) btn.textContent = state.isPlaying ? '⏸' : '▶';
}

export function fullscreenPrev() {
    prevTrack();
    updateFullscreenPlayerInfo();
}

export function fullscreenNext() {
    nextTrack();
    updateFullscreenPlayerInfo();
}

export function toggleFullscreenShuffle() {
    const btn = document.getElementById('fsShuffle');
    if (btn) btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    showNotification('🔀 Перемешивание ' + (btn?.style.color === 'var(--accent)' ? 'включено' : 'выключено'), 'info', 2000);
}

export function toggleFullscreenRepeat() {
    const btn = document.getElementById('fsRepeat');
    if (btn) btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    showNotification('🔁 Повтор ' + (btn?.style.color === 'var(--accent)' ? 'включён' : 'выключен'), 'info', 2000);
}

export function isTrackLiked(trackId) {
    const liked = JSON.parse(localStorage.getItem('musichub_liked') || '[]');
    return liked.includes(trackId);
}

export function toggleFullscreenLike(trackId) {
    let liked = JSON.parse(localStorage.getItem('musichub_liked') || '[]');
    const btn = document.getElementById('fsLikeBtn');
    if (liked.includes(trackId)) {
        liked = liked.filter(id => id !== trackId);
        if (btn) btn.textContent = '🤍';
        showNotification('Лайк убран', 'info', 1500);
    } else {
        liked.push(trackId);
        if (btn) btn.textContent = '❤️';
        showNotification('❤️ Добавлено в любимое', 'success', 1500);
    }
    localStorage.setItem('musichub_liked', JSON.stringify(liked));
}

export function fullscreenDownload() {
    if (state.currentTrack) {
        const idx = state.tracks.indexOf(state.currentTrack);
        if (idx !== -1) downloadTrack(idx);
    }
}

export function fullscreenShare() {
    shareTrack();
}

export function fullscreenLyrics() {
    const lyricsContainer = document.getElementById('fsLyrics');
    if (lyricsContainer) {
        if (lyricsContainer.classList.contains('active')) {
            lyricsContainer.classList.remove('active');
        } else {
            lyricsContainer.classList.add('active');
            if (lyricsContainer.innerHTML.includes('Загрузка текста')) {
                showLyrics();
                setTimeout(() => {
                    const newLyrics = document.getElementById('modalBody');
                    if (newLyrics && !newLyrics.innerHTML.includes('Загрузка')) {
                        lyricsContainer.innerHTML = newLyrics.innerHTML;
                    }
                }, 2000);
            }
        }
    }
}

export function fullscreenAddToPlaylist() {
    if (state.currentTrack) {
        if (!state.playlist.includes(state.currentTrack)) {
            state.playlist.push(state.currentTrack);
            showNotification('➕ Добавлено в плейлист', 'success', 2000);
        } else {
            showNotification('Уже в плейлисте', 'info', 2000);
        }
    }
}

export function updateFullscreenPlayerInfo() {
    const track = state.currentTrack;
    if (!track) return;
    const title = document.querySelector('.fullscreen-player__title');
    const artist = document.querySelector('.fullscreen-player__artist');
    const artwork = document.querySelector('.fullscreen-player__artwork img');
    const playBtn = document.getElementById('fsPlayBtn');
    if (title) title.textContent = track.name || 'Без названия';
    if (artist) artist.textContent = track.artist || 'Неизвестный';
    if (artwork) artwork.src = track.cover || 'https://via.placeholder.com/300';
    if (playBtn) playBtn.textContent = state.isPlaying ? '⏸' : '▶';
}