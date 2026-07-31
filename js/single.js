import { state, dom } from './config.js';
import { showNotification, escapeHtml, formatTime } from './utils.js';
import { playTrack } from './player.js';
import { downloadTrack } from './download.js';
import { shareTrack } from './ui.js';

export function showSinglePage(trackId) {
    let track = state.tracks.find(t => t.id === trackId);
    if (!track && state.artistTracks) track = state.artistTracks.find(t => t.id === trackId);
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    let singlePage = document.getElementById('singlePageV2');
    if (!singlePage) {
        singlePage = document.createElement('div');
        singlePage.id = 'singlePageV2';
        singlePage.className = 'single-page-v2';
        document.querySelector('main').appendChild(singlePage);
    }

    singlePage.classList.remove('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection, #artistSection, #artistPageV2').forEach(el => {
        if (el) el.classList.add('hidden');
    });

    const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '2026';
    const artists = track.artist.split(',').map(a => a.trim());
    const artistsDisplay = artists.length > 1 ? artists.slice(0, 3).join(', ') + (artists.length > 3 ? ` и ещё ${artists.length - 3} исполнителя` : '') : track.artist;

    singlePage.innerHTML = `
        <div class="single-page-v2__header">
            <button class="single-page-v2__back" onclick="window.closeSinglePageV2()">← Назад</button>
        </div>
        <div class="single-page-v2__hero">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" class="single-page-v2__cover" />
            <div class="single-page-v2__info">
                <div class="single-page-v2__badge">Сингл</div>
                <h1 class="single-page-v2__title">${escapeHtml(track.name)}</h1>
                <p class="single-page-v2__artists">${escapeHtml(artistsDisplay)}</p>
                <p class="single-page-v2__year">${year}</p>
                <div class="single-page-v2__actions">
                    <button class="single-page-v2__btn-primary" onclick="window.playSingleTrack(${track.id})">▶ Слушать</button>
                    <button class="single-page-v2__btn-secondary" onclick="window.downloadSingleTrack(${track.id})">⬇ Скачать</button>
                    <button class="single-page-v2__btn-icon" onclick="window.shareSingleTrack(${track.id})">📤</button>
                    <span class="single-page-v2__plays">${Math.floor(Math.random() * 50000 + 1000).toLocaleString()}</span>
                </div>
                <div class="single-page-v2__tracklist">
                    <div class="single-page-v2__tracklist-item">
                        <span class="single-page-v2__tracklist-number">1</span>
                        <span class="single-page-v2__tracklist-name">${escapeHtml(track.name)}</span>
                        <span class="single-page-v2__tracklist-duration">${formatTime(track.duration)}</span>
                    </div>
                </div>
                <div class="single-page-v2__label">Лейбл: ${track.label || '@58 Records'}</div>
                <div class="single-page-v2__meta">Новые способы в этом выпуске</div>
            </div>
        </div>
    `;

    state.currentTrack = track;
}

export function closeSinglePageV2() {
    const singlePage = document.getElementById('singlePageV2');
    if (singlePage) singlePage.classList.add('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

export function playSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) playTrack(idx);
    }
}

export function downloadSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) downloadTrack(idx);
    }
}

export function shareSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        state.currentTrack = track;
        shareTrack();
    }
}