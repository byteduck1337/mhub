import { state, dom, ERROR_CODES } from './config.js';
import { showNotification, saveToCache, loadFromCache, escapeHtml } from './utils.js';
import { API } from './api.js';
import { getDemoTracks, getDemoAlbums } from './demo.js';
import { playTrack } from './player.js';
import { downloadTrack } from './download.js';
import { showArtistV2 } from './artist.js';
import { showSinglePage } from './single.js';

export async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }

    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
        updateSearchHistory();
    }

    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p style="margin-top:10px;color:var(--text-muted);">Ищем треки...</p>
        </div>
    `;
    dom.albumsContainer.innerHTML = '';
    dom.artistSection.classList.add('hidden');
    dom.resultsTitle.textContent = `🔍 "${query}"`;

    try {
        let tracks = [];
        let albums = [];
        const cacheKey = `search_${query.toLowerCase().trim()}`;
        const cached = loadFromCache(cacheKey);
        if (cached) {
            tracks = cached.tracks || [];
            albums = cached.albums || [];
            showNotification('📦 Загружено из кэша', 'info', 2000);
        }

        if (tracks.length === 0) {
            // iTunes
            try {
                const data = await API.itunes.search(query);
                if (data.results && data.results.length > 0) {
                    const itunesTracks = data.results
                        .filter(item => item.kind === 'song')
                        .map(item => ({
                            id: item.trackId,
                            name: item.trackName || 'Без названия',
                            artist: item.artistName || 'Неизвестный',
                            artistId: item.artistId,
                            album: item.collectionName || 'Альбом',
                            albumId: item.collectionId,
                            cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                            audio: item.previewUrl,
                            duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 0,
                            source: 'iTunes',
                            type: 'track',
                            downloadUrl: null
                        }));
                    tracks = tracks.concat(itunesTracks);
                    const albumsMap = new Map();
                    data.results.forEach(item => {
                        if (item.collectionId && !albumsMap.has(item.collectionId)) {
                            albumsMap.set(item.collectionId, {
                                id: item.collectionId,
                                name: item.collectionName || 'Альбом',
                                artist: item.artistName || 'Неизвестный',
                                artistId: item.artistId,
                                cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                                tracks: item.trackCount || 0,
                                type: 'album'
                            });
                        }
                    });
                    albums = Array.from(albumsMap.values());
                }
            } catch (e) { console.debug('iTunes не сработал:', e); }

            // SoundCloud
            try {
                const data = await API.soundcloud.search(query);
                if (data.tracks && data.tracks.length > 0) {
                    const scTracks = data.tracks.map(item => ({
                        id: item.id || item.track_id || Math.random() * 10000,
                        name: item.title || item.name || 'Без названия',
                        artist: item.user?.username || item.artist || 'Неизвестный',
                        artistId: item.user?.id || item.artist_id || 0,
                        album: item.album?.title || item.album || 'Сингл',
                        albumId: item.album?.id || 0,
                        cover: item.artwork_url || item.artwork_url?.replace('large', 't500x500') || 'https://via.placeholder.com/300',
                        audio: item.stream_url || item.audio_url || item.media?.transcodings?.[0]?.url,
                        duration: Math.floor((item.duration || 0) / 1000),
                        source: 'SoundCloud',
                        type: 'track',
                        genre: item.genre || 'Unknown',
                        downloadUrl: item.download_url || null,
                        permalink: item.permalink_url
                    }));
                    tracks = tracks.concat(scTracks);
                }
            } catch (e) { console.debug('SoundCloud не сработал:', e); }

            if (tracks.length > 0) {
                saveToCache(cacheKey, { tracks, albums });
            }
        }

        if (tracks.length === 0) {
            tracks = getDemoTracks(query);
            albums = getDemoAlbums(query);
            showNotification('🎵 Демо-режим (офлайн)', 'info', 3000);
        }

        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;

        renderTracks(tracks);
        renderAlbums(albums);
        dom.resultsCount.textContent = `${tracks.length} треков`;

    } catch (error) {
        console.error('Search error:', error);
        const cacheKey = `search_${query.toLowerCase().trim()}`;
        const cached = loadFromCache(cacheKey);
        if (cached && cached.tracks && cached.tracks.length > 0) {
            state.tracks = cached.tracks;
            state.playlist = cached.tracks;
            renderTracks(cached.tracks);
            renderAlbums(cached.albums || []);
            dom.resultsCount.textContent = `${cached.tracks.length} треков (кэш)`;
            showNotification('📦 Восстановлено из кэша', 'info', 3000);
            return;
        }
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px;font-weight:600;color:#ef4444;">Ошибка загрузки</p>
                <p style="font-size:14px;margin-top:8px;">${error.message}</p>
                <button onclick="window.searchMusic('популярное')" 
                        style="margin-top:20px;padding:10px 30px;background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;">
                    ↻ Попробовать снова
                </button>
            </div>
        `;
    }
}

export function renderTracks(tracks) {
    if (!tracks || tracks.length === 0) {
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
                <div style="font-size:32px;margin-bottom:10px;">🎵</div>
                <p>Ничего не найдено</p>
            </div>
        `;
        return;
    }

    dom.tracksContainer.innerHTML = tracks.map((track, index) => {
        const hasDownload = track.downloadUrl || (track.source === 'Jamendo' && track.audio);
        const hasAudio = track.audio || track.source === 'Demo' || track.source === 'SoundCloud';
        return `
            <div class="track-card" data-index="${index}" role="button" tabindex="0">
                <img src="${track.cover}" alt="${track.name}" 
                     onerror="this.src='https://via.placeholder.com/300'" loading="lazy" />
                <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
                <p title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
                ${track.isDemo ? '<span class="source-tag" style="background:#ff6b6b;color:#fff;">DEMO</span>' : 
                                `<span class="source-tag">${track.source || 'Unknown'}</span>`}
                ${track.genre ? `<span class="source-tag" style="background:var(--accent);color:#fff;">${track.genre}</span>` : ''}
                <div class="actions">
                    <button class="btn-play" data-index="${index}">${hasAudio ? '▶' : '🎵'} ${hasAudio ? 'Слушать' : 'Демо'}</button>
                    <button class="btn-download" data-index="${index}" 
                            ${!hasDownload ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                        ⬇ ${hasDownload ? 'Скачать' : 'Недоступно'}
                    </button>
                    <button class="btn-artist" data-artist="${escapeHtml(track.artist)}" data-artistid="${track.artistId}">👤</button>
                </div>
            </div>
        `;
    }).join('');

    dom.tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            const track = state.tracks[index];
            if (track) playTrack(index);
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-download:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            downloadTrack(index);
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-artist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistV2(btn.dataset.artist, btn.dataset.artistid);
        });
    });

    dom.tracksContainer.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            const track = state.tracks[index];
            if (track && (track.audio || track.isDemo)) playTrack(index);
        });
        card.addEventListener('dblclick', () => {
            const index = parseInt(card.dataset.index);
            if (state.tracks[index]) {
                showSinglePage(state.tracks[index].id);
            }
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                playTrack(parseInt(card.dataset.index));
            }
        });
    });
}

export function renderAlbums(albums) {
    if (!albums || albums.length === 0) {
        dom.albumsContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">
                Нет альбомов
            </div>
        `;
        return;
    }

    dom.albumsContainer.innerHTML = albums.map(album => `
        <div class="album-card" data-albumid="${album.id}">
            <img src="${album.cover}" alt="${album.name}" 
                 onerror="this.src='https://via.placeholder.com/300'" loading="lazy" />
            <h3 title="${escapeHtml(album.name)}">${escapeHtml(album.name)}</h3>
            <p title="${escapeHtml(album.artist)}">${escapeHtml(album.artist)}</p>
            <span style="font-size:12px;color:var(--text-muted);">${album.tracks} треков</span>
            <div class="actions" style="margin-top:10px;">
                <button class="btn-artist-album" data-artist="${escapeHtml(album.artist)}" data-artistid="${album.artistId}">👤 ${escapeHtml(album.artist)}</button>
            </div>
        </div>
    `).join('');

    dom.albumsContainer.querySelectorAll('.btn-artist-album').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistV2(btn.dataset.artist, btn.dataset.artistid);
        });
    });
}

export function updateSearchHistory() {
    if (!dom.searchHistory) return;
    dom.searchHistory.innerHTML = state.searchHistory.map(query => 
        `<span class="history-tag" data-query="${escapeHtml(query)}">${escapeHtml(query)}</span>`
    ).join('');
    dom.searchHistory.querySelectorAll('.history-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            dom.searchInput.value = tag.dataset.query;
            searchMusic(tag.dataset.query);
        });
    });
}