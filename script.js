/**
 * MusicHub v2.3 - Расширенный музыкальный плеер с SoundCloud
 * @version 2.3
 */

// ============================================================
// КОНСТАНТЫ И СОСТОЯНИЕ
// ============================================================

const ERROR_CODES = {
    SEARCH_FAILED: 'ERR_SEARCH_001',
    PLAYBACK_FAILED: 'ERR_PLAY_001',
    DOWNLOAD_FAILED: 'ERR_DOWN_001',
    LYRICS_FAILED: 'ERR_LYRICS_001',
    API_TIMEOUT: 'ERR_API_001',
    NO_AUDIO: 'ERR_AUDIO_001',
    ARTIST_NOT_FOUND: 'ERR_ARTIST_001',
    NETWORK_ERROR: 'ERR_NET_001',
    CACHE_ERROR: 'ERR_CACHE_001'
};

const API_CONFIG = {
    JAMENDO_KEY: 'e0f5b4f3',
    LASTFM_KEY: 'b25b959554ed76058ac220b7b2e0a026',
    SOUNDCLOUD_CLIENT_ID: 'YOUR_SOUNDCLOUD_CLIENT_ID',
    TIMEOUT: 15000,
    MAX_TRACKS: 30,
    CACHE_DURATION: 3600000
};

const state = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    modalOpen: false,
    artistTracks: [],
    searchHistory: [],
    volume: 0.8,
    isDownloading: false
};

// ============================================================
// DOM ЭЛЕМЕНТЫ (объявляем сразу после state)
// ============================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const dom = {
    searchInput: $('#searchInput'),
    searchBtn: $('#searchBtn'),
    searchHistory: $('#searchHistory'),
    tracksContainer: $('#tracksContainer'),
    albumsContainer: $('#albumsContainer'),
    resultsTitle: $('#resultsTitle'),
    resultsCount: $('#resultsCount'),
    artistSection: $('#artistSection'),
    artistName: $('#artistName'),
    artistInfo: $('#artistInfo'),
    artistTracks: $('#artistTracks'),
    backBtn: $('#backToSearch'),
    playerCover: $('#playerCover'),
    playerTitle: $('#playerTitle'),
    playerArtist: $('#playerArtist'),
    playBtn: $('#playBtn'),
    prevBtn: $('#prevBtn'),
    nextBtn: $('#nextBtn'),
    progressBar: $('#progressBar'),
    currentTime: $('#currentTime'),
    totalTime: $('#totalTime'),
    volumeControl: $('#volumeControl'),
    audio: $('#audioPlayer'),
    downloadTrack: $('#downloadTrackBtn'),
    downloadPlaylist: $('#downloadPlaylistBtn'),
    showLyrics: $('#showLyricsBtn'),
    addToFavorites: $('#addToFavoritesBtn'),
    shareTrack: $('#shareTrackBtn'),
    modal: $('#modal'),
    modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'),
    modalClose: $('#modalClose'),
    notification: $('#notification'),
    themeToggle: $('#themeToggle')
};

// ============================================================
// УТИЛИТЫ
// ============================================================

function showNotification(message, type = 'info', duration = 4000) {
    const el = dom.notification;
    if (!el) return;
    el.textContent = message;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

function saveToCache(key, data, duration = API_CONFIG.CACHE_DURATION) {
    try {
        localStorage.setItem(`musichub_${key}`, JSON.stringify({ data, timestamp: Date.now(), duration }));
    } catch (error) {
        console.error(`[${ERROR_CODES.CACHE_ERROR}]`, error);
    }
}

function loadFromCache(key) {
    try {
        const raw = localStorage.getItem(`musichub_${key}`);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() - entry.timestamp > entry.duration) {
            localStorage.removeItem(`musichub_${key}`);
            return null;
        }
        return entry.data;
    } catch (error) {
        console.error(`[${ERROR_CODES.CACHE_ERROR}]`, error);
        return null;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return num.toLocaleString('ru-RU');
}

function debounce(fn, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

// ============================================================
// API КЛИЕНТЫ
// ============================================================

const API = {
    itunes: {
        search: async (query) => {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=${API_CONFIG.MAX_TRACKS}&entity=musicTrack`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        lookup: async (id) => {
            const url = `https://itunes.apple.com/lookup?id=${id}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    },
    jamendo: {
        search: async (query) => {
            const key = API_CONFIG.JAMENDO_KEY;
            const proxies = [
                `https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&limit=${API_CONFIG.MAX_TRACKS}&search=${encodeURIComponent(query)}`,
                `https://corsproxy.io/?https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&limit=${API_CONFIG.MAX_TRACKS}&search=${encodeURIComponent(query)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&limit=${API_CONFIG.MAX_TRACKS}&search=${encodeURIComponent(query)}`)}`
            ];
            for (const url of proxies) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) return response.json();
                } catch (e) { console.debug('Jamendo proxy failed:', e); }
            }
            throw new Error('All Jamendo proxies failed');
        },
        getTrack: async (trackId) => {
            const key = API_CONFIG.JAMENDO_KEY;
            const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&id=${trackId}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    },
    lastfm: {
        getArtistInfo: async (name) => {
            const key = API_CONFIG.LASTFM_KEY;
            const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${key}&format=json`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getTopTracks: async (name) => {
            const key = API_CONFIG.LASTFM_KEY;
            const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(name)}&api_key=${key}&format=json&limit=10`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    },
    soundcloud: {
        search: async (query) => {
            const clientId = API_CONFIG.SOUNDCLOUD_CLIENT_ID;
            const encodedQuery = encodeURIComponent(query);
            const proxies = [
                `https://corsproxy.io/?https://api.soundcloud.com/tracks?client_id=${clientId}&q=${encodedQuery}&limit=${API_CONFIG.MAX_TRACKS}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.soundcloud.com/tracks?client_id=${clientId}&q=${encodedQuery}&limit=${API_CONFIG.MAX_TRACKS}`)}`,
                `https://corsproxy.io/?https://api-v2.soundcloud.com/search/tracks?q=${encodedQuery}&client_id=${clientId}&limit=${API_CONFIG.MAX_TRACKS}`
            ];
            for (const url of proxies) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data = await response.json();
                        let tracks = [];
                        if (data.collection) tracks = data.collection;
                        else if (Array.isArray(data)) tracks = data;
                        else if (data.results) tracks = data.results;
                        return { tracks, raw: data };
                    }
                } catch (e) { console.debug('SoundCloud proxy failed:', e); }
            }
            throw new Error('SoundCloud API недоступен');
        },
        searchArtists: async (query) => {
            const clientId = API_CONFIG.SOUNDCLOUD_CLIENT_ID;
            const url = `https://corsproxy.io/?https://api.soundcloud.com/users?client_id=${clientId}&q=${encodeURIComponent(query)}&limit=20`;
            try {
                const response = await fetchWithTimeout(url);
                if (response.ok) return response.json();
            } catch (e) { console.debug('SoundCloud artists search failed:', e); }
            return [];
        },
        getTrack: async (trackId) => {
            const clientId = API_CONFIG.SOUNDCLOUD_CLIENT_ID;
            const url = `https://corsproxy.io/?https://api.soundcloud.com/tracks/${trackId}?client_id=${clientId}`;
            try {
                const response = await fetchWithTimeout(url);
                if (response.ok) return response.json();
            } catch (e) { console.debug('SoundCloud get track failed:', e); }
            return null;
        },
        getDownloadUrl: async (trackId) => {
            const clientId = API_CONFIG.SOUNDCLOUD_CLIENT_ID;
            const url = `https://corsproxy.io/?https://api.soundcloud.com/tracks/${trackId}/download?client_id=${clientId}`;
            try {
                const response = await fetchWithTimeout(url);
                if (response.ok) {
                    const data = await response.json();
                    return data.url || null;
                }
            } catch (e) { console.debug('SoundCloud download url failed:', e); }
            return null;
        }
    }
};

// ============================================================
// ДЕМО-ДАННЫЕ
// ============================================================

function getDemoTracks(query) {
    const DEMO_DB = [
        { name: 'Тёмный принц', artist: 'Алексей Воробьёв', album: 'Лучшее', genre: 'Pop' },
        { name: 'Принц и нищий', artist: 'Владимир Высоцкий', album: 'Концерт', genre: 'Folk' },
        { name: 'Тёмная ночь', artist: 'Марк Бернес', album: 'Великие песни', genre: 'Classic' },
        { name: 'Purple Rain', artist: 'Prince', album: 'Purple Rain', genre: 'Rock' },
        { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', genre: 'Rock' },
        { name: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', genre: 'Rock' },
        { name: 'Imagine', artist: 'John Lennon', album: 'Imagine', genre: 'Pop' },
        { name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', genre: 'Rock' },
        { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', genre: 'Rock' },
        { name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', genre: 'Pop' },
        { name: 'Like a Rolling Stone', artist: 'Bob Dylan', album: 'Highway 61 Revisited', genre: 'Folk' },
        { name: 'Yesterday', artist: 'The Beatles', album: 'Help!', genre: 'Rock' },
        { name: 'Wonderwall', artist: 'Oasis', album: "(What's the Story) Morning Glory?", genre: 'Rock' },
        { name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', genre: 'Hip-Hop' },
        { name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', genre: 'Pop' },
        { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop' },
        { name: 'Dance Monkey', artist: 'Tones and I', album: 'The Kids Are Coming', genre: 'Pop' },
        { name: 'Believer', artist: 'Imagine Dragons', album: 'Evolve', genre: 'Rock' },
        { name: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', genre: 'Rock' },
        { name: 'Demons', artist: 'Imagine Dragons', album: 'Night Visions', genre: 'Rock' },
        { name: 'Closer', artist: 'The Chainsmokers', album: 'Collage', genre: 'EDM' },
        { name: 'Faded', artist: 'Alan Walker', album: 'Faded', genre: 'EDM' },
        { name: 'Alone', artist: 'Marshmello', album: 'Alone', genre: 'EDM' }
    ];
    const filtered = DEMO_DB.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase()) ||
        d.genre.toLowerCase().includes(query.toLowerCase())
    );
    const tracks = filtered.length > 0 ? filtered : DEMO_DB.slice(0, 15);
    return tracks.map((d, i) => ({
        id: i + 1,
        name: d.name,
        artist: d.artist,
        artistId: i + 1,
        album: d.album || 'Сборник',
        albumId: i + 1,
        cover: `https://picsum.photos/seed/${i+1}/300/300`,
        audio: null,
        duration: 180 + i * 30,
        source: 'Demo',
        type: 'track',
        isDemo: true,
        genre: d.genre || 'Unknown',
        downloadUrl: null
    }));
}

function getDemoAlbums(query) {
    const DEMO_ALBUMS = [
        { name: 'Лучшие хиты', artist: 'Макс Корж' },
        { name: 'Тёмная сторона', artist: 'Руки Вверх' },
        { name: 'Greatest Hits', artist: 'Queen' },
        { name: 'Thriller', artist: 'Michael Jackson' },
        { name: 'Back in Black', artist: 'AC/DC' },
        { name: 'The Dark Side of the Moon', artist: 'Pink Floyd' },
        { name: 'Nevermind', artist: 'Nirvana' },
        { name: 'Abbey Road', artist: 'The Beatles' }
    ];
    const filtered = DEMO_ALBUMS.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase())
    );
    const albums = filtered.length > 0 ? filtered : DEMO_ALBUMS.slice(0, 4);
    return albums.map((d, i) => ({
        id: i + 100,
        name: d.name,
        artist: d.artist,
        artistId: i + 100,
        cover: `https://picsum.photos/seed/album${i+1}/300/300`,
        tracks: 10 + i * 2,
        type: 'album'
    }));
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================

async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }
    const errorId = `${ERROR_CODES.SEARCH_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Поиск: "${query}"`);

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
            if (tracks.length < API_CONFIG.MAX_TRACKS) {
                try {
                    const data = await API.soundcloud.search(query);
                    if (data.tracks && data.tracks.length > 0) {
                        const scTracks = data.tracks.map(item => ({
                            id: item.id || item.track_id,
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
                            downloadUrl: item.download_url || item.downloadable ? `https://api.soundcloud.com/tracks/${item.id}/download` : null,
                            permalink: item.permalink_url
                        }));
                        tracks = tracks.concat(scTracks);
                    }
                } catch (e) { console.debug('SoundCloud не сработал:', e); }
            }

            // Jamendo
            if (tracks.length < 10) {
                try {
                    const data = await API.jamendo.search(query);
                    if (data.results && data.results.length > 0) {
                        const jamendoTracks = data.results.map(item => ({
                            id: item.id,
                            name: item.name || 'Без названия',
                            artist: item.artist_name || 'Неизвестный',
                            artistId: item.artist_id,
                            album: item.album_name || 'Альбом',
                            albumId: item.album_id || 0,
                            cover: item.image || `https://picsum.photos/seed/${item.id}/300/300`,
                            audio: item.audio || item.url,
                            duration: item.duration || 0,
                            source: 'Jamendo',
                            type: 'track',
                            downloadUrl: item.audio || null
                        }));
                        tracks = tracks.concat(jamendoTracks);
                    }
                } catch (e) { console.debug('Jamendo не сработал:', e); }
            }

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
        console.log(`[${errorId}] Найдено ${tracks.length} треков`);

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
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
                <p style="font-size:12px;color:var(--text-muted);">Код: ${errorId}</p>
                <p style="font-size:14px;margin-top:8px;">${error.message}</p>
                <button onclick="searchMusic('популярное')" 
                        style="margin-top:20px;padding:10px 30px;background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;">
                    ↻ Попробовать снова
                </button>
            </div>
        `;
    }
}

function renderTracks(tracks) {
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
            downloadTrack(parseInt(btn.dataset.index));
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
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                playTrack(parseInt(card.dataset.index));
            }
        });
    });
}

function renderAlbums(albums) {
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

function updateSearchHistory() {
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

// ============================================================
// СТРАНИЦА ИСПОЛНИТЕЛЯ V2
// ============================================================

async function showArtistV2(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Запрос исполнителя: ${name}`);

    let artistPage = document.getElementById('artistPageV2');
    if (!artistPage) {
        artistPage = document.createElement('div');
        artistPage.id = 'artistPageV2';
        artistPage.className = 'artist-page-v2';
        document.querySelector('main').appendChild(artistPage);
    }

    artistPage.classList.remove('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection, #artistSection').forEach(el => {
        if (el) el.classList.add('hidden');
    });

    artistPage.innerHTML = `
        <div class="artist-page-v2__loading">
            <div class="spinner"></div>
            <p>Загрузка исполнителя...</p>
        </div>
    `;

    try {
        let bio = 'Информация об исполнителе не найдена';
        let stats = { listeners: '?', plays: '?', similar: [] };
        let artistTracks = [];
        let topTracks = [];
        let artistImage = 'https://via.placeholder.com/400';

        try {
            const data = await API.lastfm.getArtistInfo(name);
            if (data && data.artist) {
                bio = data.artist.bio?.content || bio;
                stats.listeners = data.artist.stats?.listeners || '?';
                stats.plays = data.artist.stats?.playcount || '?';
                stats.similar = data.artist.similar?.artist?.map(a => a.name) || [];
                bio = bio.replace(/<[^>]+>/g, '').trim();
                if (bio.length > 500) bio = bio.slice(0, 500) + '...';
                if (data.artist.image) artistImage = data.artist.image[3]?.['#text'] || artistImage;
            }
        } catch (e) { console.debug('Last.fm не сработал:', e); }

        try {
            const data = await API.itunes.search(name);
            if (data.results && data.results.length > 0) {
                artistTracks = data.results
                    .filter(item => item.kind === 'song')
                    .slice(0, 30)
                    .map(item => ({
                        id: item.trackId,
                        name: item.trackName || 'Без названия',
                        artist: item.artistName || name,
                        artistId: item.artistId,
                        album: item.collectionName || 'Альбом',
                        cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                        audio: item.previewUrl,
                        duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 0,
                        source: 'iTunes',
                        downloadUrl: null,
                        isExplicit: item.trackExplicitness === 'explicit'
                    }));
                topTracks = artistTracks.slice(0, 5);
            }
        } catch (e) { console.debug('iTunes artist tracks failed:', e); }

        if (artistTracks.length < 10) {
            try {
                const data = await API.soundcloud.search(name);
                if (data.tracks && data.tracks.length > 0) {
                    const scTracks = data.tracks.slice(0, 15).map(item => ({
                        id: item.id || item.track_id,
                        name: item.title || item.name || 'Без названия',
                        artist: item.user?.username || item.artist || name,
                        artistId: item.user?.id || item.artist_id || 0,
                        album: item.album?.title || item.album || 'Сингл',
                        cover: item.artwork_url || item.artwork_url?.replace('large', 't500x500') || 'https://via.placeholder.com/300',
                        audio: item.stream_url || item.audio_url,
                        duration: Math.floor((item.duration || 0) / 1000),
                        source: 'SoundCloud',
                        downloadUrl: item.download_url || null,
                        isExplicit: false
                    }));
                    artistTracks = artistTracks.concat(scTracks);
                    if (topTracks.length < 5) topTracks = scTracks.slice(0, 5);
                }
            } catch (e) { console.debug('SoundCloud artist tracks failed:', e); }
        }

        if (artistTracks.length === 0) {
            const demos = getDemoTracks(name);
            artistTracks = demos;
            topTracks = demos.slice(0, 5);
        }

        const listenersFormatted = formatNumber(parseInt(stats.listeners) || 0);

        artistPage.innerHTML = `
            <div class="artist-page-v2__header">
                <button class="artist-page-v2__back" onclick="closeArtistPageV2()">← Назад</button>
                <div class="artist-page-v2__hero">
                    <img src="${artistImage}" alt="${escapeHtml(name)}" class="artist-page-v2__avatar" />
                    <div class="artist-page-v2__info">
                        <div class="artist-page-v2__badge">Исполнитель</div>
                        <h1 class="artist-page-v2__name">${escapeHtml(name)}</h1>
                        <div class="artist-page-v2__stats">
                            <span>⏱ ${listenersFormatted} слушателей в месяц</span>
                            <span>🎵 ${artistTracks.length} треков</span>
                        </div>
                        <div class="artist-page-v2__actions">
                            <button class="artist-page-v2__btn-primary" onclick="playArtistTopTrack()">▶ Слушать</button>
                            <button class="artist-page-v2__btn-secondary" onclick="showArtistTrailer('${escapeHtml(name)}')">▶ Трейлер</button>
                            <button class="artist-page-v2__btn-icon" onclick="toggleArtistFollow('${escapeHtml(name)}')">
                                ${isArtistFollowed(name) ? '❤️' : '♡'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="artist-page-v2__content">
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Популярные треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${topTracks.map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Все треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${artistTracks.map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <span class="artist-page-v2__track-source">${track.source || 'Unknown'}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${stats.similar.length > 0 ? `
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Похожие исполнители</h2>
                    <div class="artist-page-v2__similar">
                        ${stats.similar.slice(0, 8).map(s => `
                            <div class="artist-page-v2__similar-item" onclick="showArtistV2('${escapeHtml(s)}', 0)">
                                <div class="artist-page-v2__similar-avatar">${s.charAt(0)}</div>
                                <span class="artist-page-v2__similar-name">${escapeHtml(s)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">О исполнителе</h2>
                    <div class="artist-page-v2__bio">${escapeHtml(bio)}</div>
                </div>
            </div>
        `;

        state.artistTracks = artistTracks;
        state.tracks = artistTracks;
        state.playlist = artistTracks;
        state.currentIndex = 0;

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        artistPage.innerHTML = `
            <div class="artist-page-v2__error">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p>Не удалось загрузить информацию об исполнителе</p>
                <button onclick="closeArtistPageV2()" class="artist-page-v2__btn-primary">← Назад</button>
            </div>
        `;
    }
}

function closeArtistPageV2() {
    const artistPage = document.getElementById('artistPageV2');
    if (artistPage) artistPage.classList.add('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

function playArtistTopTrack() {
    if (state.artistTracks && state.artistTracks.length > 0) playTrack(0);
}

function playArtistTrack(index) {
    if (state.artistTracks && state.artistTracks[index]) {
        state.tracks = state.artistTracks;
        state.playlist = state.artistTracks;
        playTrack(index);
    }
}

function isArtistFollowed(name) {
    const followed = JSON.parse(localStorage.getItem('musichub_followed') || '[]');
    return followed.includes(name);
}

function toggleArtistFollow(name) {
    let followed = JSON.parse(localStorage.getItem('musichub_followed') || '[]');
    if (followed.includes(name)) {
        followed = followed.filter(f => f !== name);
        showNotification('Отписка от исполнителя', 'info', 2000);
    } else {
        followed.push(name);
        showNotification(`❤️ Вы подписались на ${name}`, 'success', 2000);
    }
    localStorage.setItem('musichub_followed', JSON.stringify(followed));
}

function showArtistTrailer(name) {
    showNotification(`🎬 Трейлер исполнителя ${name} (демо-режим)`, 'info', 3000);
}

// ============================================================
// СТРАНИЦА СИНГЛА V2
// ============================================================

function showSinglePage(trackId) {
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
            <button class="single-page-v2__back" onclick="closeSinglePageV2()">← Назад</button>
        </div>
        <div class="single-page-v2__hero">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" class="single-page-v2__cover" />
            <div class="single-page-v2__info">
                <div class="single-page-v2__badge">Сингл</div>
                <h1 class="single-page-v2__title">${escapeHtml(track.name)}</h1>
                <p class="single-page-v2__artists">${escapeHtml(artistsDisplay)}</p>
                <p class="single-page-v2__year">${year}</p>
                <div class="single-page-v2__actions">
                    <button class="single-page-v2__btn-primary" onclick="playSingleTrack(${track.id})">▶ Слушать</button>
                    <button class="single-page-v2__btn-secondary" onclick="downloadSingleTrack(${track.id})">⬇ Скачать</button>
                    <button class="single-page-v2__btn-icon" onclick="shareSingleTrack(${track.id})">📤</button>
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

function closeSinglePageV2() {
    const singlePage = document.getElementById('singlePageV2');
    if (singlePage) singlePage.classList.add('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

function playSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) playTrack(idx);
    }
}

function downloadSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) downloadTrack(idx);
    }
}

function shareSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        state.currentTrack = track;
        shareTrack();
    }
}

// ============================================================
// ПОЛНОЭКРАННЫЙ ПЛЕЕР
// ============================================================

function openFullscreenPlayer() {
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
    const isLiked = isTrackLiked(track.id);

    fullscreenPlayer.innerHTML = `
        <div class="fullscreen-player__overlay" onclick="closeFullscreenPlayer()"></div>
        <div class="fullscreen-player__content">
            <button class="fullscreen-player__close" onclick="closeFullscreenPlayer()">✕</button>
            <div class="fullscreen-player__artwork">
                <img src="${track.cover}" alt="${escapeHtml(track.name)}" />
            </div>
            <div class="fullscreen-player__info">
                <h2 class="fullscreen-player__title">${escapeHtml(track.name)}</h2>
                <p class="fullscreen-player__artist">${escapeHtml(track.artist)}</p>
            </div>
            <div class="fullscreen-player__controls">
                <button class="fullscreen-player__control" onclick="toggleFullscreenShuffle()" id="fsShuffle">🔀</button>
                <button class="fullscreen-player__control" onclick="fullscreenPrev()">⏮</button>
                <button class="fullscreen-player__play" onclick="toggleFullscreenPlay()" id="fsPlayBtn">${state.isPlaying ? '⏸' : '▶'}</button>
                <button class="fullscreen-player__control" onclick="fullscreenNext()">⏭</button>
                <button class="fullscreen-player__control" onclick="toggleFullscreenRepeat()" id="fsRepeat">🔁</button>
            </div>
            <div class="fullscreen-player__progress">
                <span class="fullscreen-player__time" id="fsCurrentTime">${currentTimeFormatted}</span>
                <input type="range" class="fullscreen-player__progress-bar" id="fsProgressBar" min="0" max="100" value="${dom.progressBar.value || 0}" />
                <span class="fullscreen-player__time" id="fsTotalTime">${totalTimeFormatted}</span>
            </div>
            <div class="fullscreen-player__actions">
                <button class="fullscreen-player__action" onclick="toggleFullscreenLike(${track.id})" id="fsLikeBtn">${isLiked ? '❤️' : '🤍'}</button>
                <button class="fullscreen-player__action" onclick="fullscreenDownload()">⬇</button>
                <button class="fullscreen-player__action" onclick="fullscreenShare()">📤</button>
                <button class="fullscreen-player__action" onclick="fullscreenLyrics()">📝</button>
                <button class="fullscreen-player__action" onclick="fullscreenAddToPlaylist()">➕</button>
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
    fullscreenPlayer._closeHandler = () => clearInterval(fsInterval);
}

function closeFullscreenPlayer() {
    const player = document.getElementById('fullscreenPlayer');
    if (player) {
        if (player._interval) clearInterval(player._interval);
        if (player._closeHandler) player._closeHandler();
        player.classList.add('hidden');
        player.innerHTML = '';
    }
}

function toggleFullscreenPlay() {
    dom.playBtn.click();
    const btn = document.getElementById('fsPlayBtn');
    if (btn) btn.textContent = state.isPlaying ? '⏸' : '▶';
}

function fullscreenPrev() {
    dom.prevBtn.click();
    updateFullscreenPlayerInfo();
}

function fullscreenNext() {
    dom.nextBtn.click();
    updateFullscreenPlayerInfo();
}

function toggleFullscreenShuffle() {
    const btn = document.getElementById('fsShuffle');
    if (btn) btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    showNotification('🔀 Перемешивание ' + (btn?.style.color === 'var(--accent)' ? 'включено' : 'выключено'), 'info', 2000);
}

function toggleFullscreenRepeat() {
    const btn = document.getElementById('fsRepeat');
    if (btn) btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    showNotification('🔁 Повтор ' + (btn?.style.color === 'var(--accent)' ? 'включён' : 'выключен'), 'info', 2000);
}

function isTrackLiked(trackId) {
    const liked = JSON.parse(localStorage.getItem('musichub_liked') || '[]');
    return liked.includes(trackId);
}

function toggleFullscreenLike(trackId) {
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

function fullscreenDownload() {
    if (state.currentTrack) {
        const idx = state.tracks.indexOf(state.currentTrack);
        if (idx !== -1) downloadTrack(idx);
    }
}

function fullscreenShare() {
    shareTrack();
}

function fullscreenLyrics() {
    const lyricsContainer = document.getElementById('fsLyrics');
    if (lyricsContainer) {
        if (lyricsContainer.style.maxHeight) {
            lyricsContainer.style.maxHeight = '0';
            lyricsContainer.style.opacity = '0';
        } else {
            lyricsContainer.style.maxHeight = '300px';
            lyricsContainer.style.opacity = '1';
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

function fullscreenAddToPlaylist() {
    if (state.currentTrack) {
        if (!state.playlist.includes(state.currentTrack)) {
            state.playlist.push(state.currentTrack);
            showNotification('➕ Добавлено в плейлист', 'success', 2000);
        } else {
            showNotification('Уже в плейлисте', 'info', 2000);
        }
    }
}

function updateFullscreenPlayerInfo() {
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

// ============================================================
// ПЛЕЕР
// ============================================================

async function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;

    if (!track.audio && !track.isDemo) {
        showNotification('🔇 Нет ссылки для прослушивания', 'info', 3000);
        updatePlayerInfo(track);
        if (track.source === 'SoundCloud' && track.id) {
            try {
                const data = await API.soundcloud.getTrack(track.id);
                if (data && data.stream_url) track.audio = data.stream_url;
            } catch (e) { console.debug('Could not get SoundCloud stream:', e); }
        }
        if (!track.audio) return;
    }

    let audioUrl = track.audio;
    if (track.source === 'SoundCloud' && audioUrl && !audioUrl.startsWith('http')) {
        audioUrl = `${audioUrl}?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
    }

    const audio = dom.audio;
    audio.src = audioUrl || '';
    audio.load();

    try {
        await audio.play();
        state.isPlaying = true;
        dom.playBtn.textContent = '⏸';
        showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
    } catch (err) {
        const errorId = `${ERROR_CODES.PLAYBACK_FAILED}_${Date.now()}`;
        console.error(`[${errorId}] Ошибка:`, err);
        if (track.source === 'SoundCloud' && track.id) {
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://api.soundcloud.com/tracks/${track.id}/stream?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`)}`;
                audio.src = proxyUrl;
                audio.load();
                await audio.play();
                state.isPlaying = true;
                dom.playBtn.textContent = '⏸';
                showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
                return;
            } catch (e) { console.debug('SoundCloud proxy playback failed:', e); }
        }
        showNotification(`⚠️ Ошибка воспроизведения (${errorId})`, 'error', 4000);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
    updatePlayerInfo(track);
}

function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Без названия';
    dom.playerArtist.textContent = track.artist || 'Неизвестный';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
    dom.playerCover.alt = track.name || 'Обложка';
}

// ============================================================
// СКАЧИВАНИЕ
// ============================================================

async function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    if (state.isDownloading) {
        showNotification('⏳ Уже идёт загрузка', 'info', 2000);
        return;
    }

    const errorId = `${ERROR_CODES.DOWNLOAD_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Скачивание: ${track.name}`);

    if (track.isDemo) {
        showNotification('🎵 Демо-трек недоступен для скачивания', 'info', 3000);
        downloadTrackInfo(track);
        return;
    }

    let downloadUrl = track.downloadUrl;

    if (track.source === 'SoundCloud' && track.id && !downloadUrl) {
        try {
            showNotification('⏳ Получение ссылки...', 'info', 2000);
            const data = await API.soundcloud.getTrack(track.id);
            if (data && data.downloadable && data.download_url) {
                downloadUrl = data.download_url;
            } else if (data && data.stream_url) {
                downloadUrl = `${data.stream_url}?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
                showNotification('⚠️ Доступен только стриминг', 'warning', 3000);
            }
        } catch (e) { console.debug('Could not get download URL:', e); }
    }

    if (track.source === 'Jamendo' && track.audio && !downloadUrl) {
        downloadUrl = track.audio;
    }

    if (downloadUrl) {
        state.isDownloading = true;
        try {
            if (track.source === 'SoundCloud' && !downloadUrl.includes('client_id')) {
                downloadUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
            }
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${track.artist} - ${track.name}.mp3`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification(`✅ ${track.name} скачивается`, 'success', 3000);
            console.log(`[${errorId}] Скачивание начато`);
            setTimeout(() => { state.isDownloading = false; }, 5000);
        } catch (error) {
            console.error(`[${errorId}] Ошибка:`, error);
            state.isDownloading = false;
            if (track.source === 'SoundCloud') {
                showNotification('⚠️ Скачивание недоступно. Сохраняем информацию.', 'warning', 4000);
                downloadTrackInfo(track);
            } else {
                showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
                downloadTrackInfo(track);
            }
        }
    } else {
        showNotification('🔇 Ссылка недоступна, сохраняем информацию', 'info', 3000);
        downloadTrackInfo(track);
    }
}

function downloadTrackInfo(track) {
    const text = `🎵 ${track.name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nИсполнитель: ${track.artist}\nАльбом: ${track.album || 'Неизвестен'}\nИсточник: ${track.source || 'Неизвестен'}\nДлительность: ${track.duration ? formatTime(track.duration) : 'Неизвестно'}\n${track.genre ? `Жанр: ${track.genre}` : ''}\n\n🔗 Ссылка: ${track.audio || track.permalink || 'Недоступна'}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${track.artist} - ${track.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification('📄 Информация сохранена', 'info', 3000);
}

function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Плейлист пуст', 'info');
        return;
    }
    let text = `🎵 Плейлист MusicHub\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nДата: ${new Date().toLocaleString()}\nТреков: ${state.playlist.length}\n\n`;
    state.playlist.forEach((track, i) => {
        text += `${String(i+1).padStart(2, '0')}. ${track.artist || 'Неизвестный'} — ${track.name || 'Без названия'}\n`;
        text += `   🔗 ${track.audio || track.permalink || 'Ссылка недоступна'}\n`;
        text += `   📁 ${track.source || 'Неизвестен'}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `плейлист_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification(`✅ Плейлист (${state.playlist.length} треков)`, 'success', 3000);
}

// ============================================================
// ТЕКСТЫ ПЕСЕН
// ============================================================

async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }
    dom.modalTitle.textContent = `📝 ${track.name} - ${track.artist}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        let lyrics = 'Текст не найден 😔';
        const sources = [
            async () => {
                try {
                    const searchUrl = `https://corsproxy.io/?https://api.genius.com/search?q=${encodeURIComponent(track.name + ' ' + track.artist)}`;
                    const response = await fetchWithTimeout(searchUrl);
                    const data = await response.json();
                    if (data.response?.hits?.length > 0) {
                        const url = data.response.hits[0].result.url;
                        const htmlRes = await fetchWithTimeout(`https://corsproxy.io/?${url}`);
                        const html = await htmlRes.text();
                        const match = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/i);
                        if (match) {
                            return match[1].replace(/<[^>]+>/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim().split('\n').filter(line => line.trim()).join('\n');
                        }
                    }
                    return null;
                } catch (e) { return null; }
            },
            async () => {
                try {
                    const url = `https://corsproxy.io/?https://www.azlyrics.com/lyrics/${track.artist.toLowerCase().replace(/\s+/g, '')}/${track.name.toLowerCase().replace(/\s+/g, '')}.html`;
                    const response = await fetchWithTimeout(url);
                    const html = await response.text();
                    const match = html.match(/<div[^>]*class="[^"]*lyricsh[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                    if (match) {
                        return match[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
                    }
                    return null;
                } catch (e) { return null; }
            }
        ];
        for (const source of sources) {
            const result = await source();
            if (result) { lyrics = result; break; }
        }
        dom.modalBody.innerHTML = lyrics.split('\n').map(line => `<div class="lyrics-line">${escapeHtml(line) || ' '}</div>`).join('');
        saveToCache(`lyrics_${track.id}`, lyrics);
    } catch (error) {
        console.error(`[${ERROR_CODES.LYRICS_FAILED}]`, error);
        dom.modalBody.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">❌ Не удалось загрузить текст</div>`;
    }
}

function addToFavorites() {
    const track = state.currentTrack;
    if (!track) { showNotification('Сначала выберите трек', 'info'); return; }
    const favorites = JSON.parse(localStorage.getItem('musichub_favorites') || '[]');
    if (!favorites.some(f => f.id === track.id)) {
        favorites.push(track);
        localStorage.setItem('musichub_favorites', JSON.stringify(favorites));
        showNotification('❤️ Добавлено в избранное', 'success', 2000);
    } else {
        showNotification('Уже в избранном', 'info', 2000);
    }
}

async function shareTrack() {
    const track = state.currentTrack;
    if (!track) { showNotification('Сначала выберите трек', 'info'); return; }
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${track.name} - ${track.artist}`,
                text: `Слушаю "${track.name}" от ${track.artist} на MusicHub`,
                url: track.permalink || track.audio || window.location.href
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Ошибка шеринга:', error);
                showNotification('Ошибка при открытии шеринга', 'error', 3000);
            }
        }
    } else {
        const text = `${track.name} - ${track.artist}\n${track.permalink || track.audio || window.location.href}`;
        navigator.clipboard.writeText(text)
            .then(() => showNotification('📋 Скопировано в буфер обмена', 'success', 2000))
            .catch(() => showNotification('Не удалось скопировать', 'error', 3000));
    }
}


dom.playBtn.addEventListener('click', () => {
    const audio = dom.audio;
    if (!audio.src) {
        if (state.currentTrack) playTrack(state.currentIndex);
        else showNotification('Snachala vibrite trek', 'info');
        return;
    }
    if (audio.paused) {
        audio.play().catch(() => showNotification('Oshibka vosproizvedeniya', 'error'));
        dom.playBtn.textContent = '⏸';
        state.isPlaying = true;
    } else {
        audio.pause();
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
});

dom.prevBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
    playTrack(state.currentIndex);
});

dom.nextBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
    playTrack(state.currentIndex);
});

dom.audio.addEventListener('timeupdate', () => {
    const audio = dom.audio;
    if (audio.duration && !isNaN(audio.duration)) {
        dom.progressBar.value = (audio.currentTime / audio.duration) * 100;
        dom.currentTime.textContent = formatTime(audio.currentTime);
        dom.totalTime.textContent = formatTime(audio.duration);
    }
});

dom.progressBar.addEventListener('input', () => {
    const audio = dom.audio;
    if (audio.duration && !isNaN(audio.duration)) {
        audio.currentTime = (dom.progressBar.value / 100) * audio.duration;
    }
});

dom.volumeControl?.addEventListener('input', () => {
    const audio = dom.audio;
    audio.volume = parseFloat(dom.volumeControl.value);
    state.volume = audio.volume;
});

dom.audio.addEventListener('ended', () => {
    dom.playBtn.textContent = '▶';
    state.isPlaying = false;
    if (state.tracks.length > 1) {
        state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
        playTrack(state.currentIndex);
    }
});

dom.audio.addEventListener('error', (e) => {
    console.error(`[${ERROR_CODES.PLAYBACK_FAILED}]`, e);
    dom.playBtn.textContent = '▶';
    state.isPlaying = false;
    showNotification('⚠️ Oshibka vosproizvedeniya', 'error', 4000);
});

dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchMusic(dom.searchInput.value);
});

dom.backBtn.addEventListener('click', () => {
    dom.artistSection.classList.add('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth' });
});

dom.showLyrics.addEventListener('click', showLyrics);
dom.downloadTrack.addEventListener('click', () => {
    if (state.currentTrack) {
        const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
        if (idx !== -1) downloadTrack(idx);
        else downloadTrack(state.currentIndex);
    } else {
        showNotification('Snachala vibrite trek', 'info');
    }
});
dom.downloadPlaylist.addEventListener('click', downloadPlaylist);
dom.addToFavorites?.addEventListener('click', addToFavorites);
dom.shareTrack?.addEventListener('click', shareTrack);

dom.modalClose.addEventListener('click', () => {
    dom.modal.classList.add('hidden');
    state.modalOpen = false;
});

dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) {
        dom.modal.classList.add('hidden');
        state.modalOpen = false;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.modalOpen) {
        dom.modal.classList.add('hidden');
        state.modalOpen = false;
    }
    if (e.target.tagName !== 'INPUT') {
        if (e.key === ' ') { e.preventDefault(); dom.playBtn.click(); }
        if (e.key === 'ArrowLeft') dom.prevBtn.click();
        if (e.key === 'ArrowRight') dom.nextBtn.click();
    }
});

let darkTheme = true;
dom.themeToggle.addEventListener('click', () => {
    darkTheme = !darkTheme;
    const root = document.documentElement;
    if (darkTheme) {
        root.style.setProperty('--bg-primary', '#0a0a0f');
        root.style.setProperty('--bg-secondary', '#12121a');
        root.style.setProperty('--bg-card', '#1a1a2e');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a0a0b8');
        dom.themeToggle.textContent = '🌙';
    } else {
        root.style.setProperty('--bg-primary', '#f0f0f5');
        root.style.setProperty('--bg-secondary', '#ffffff');
        root.style.setProperty('--bg-card', '#ffffff');
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#4a4a5e');
        dom.themeToggle.textContent = '☀️';
    }
});

document.addEventListener('dblclick', (e) => {
    const trackCard = e.target.closest('.track-card');
    if (trackCard) {
        const index = parseInt(trackCard.dataset.index);
        if (!isNaN(index) && state.tracks[index]) {
            showSinglePage(state.tracks[index].id);
        }
    }
});

dom.playerCover?.addEventListener('dblclick', () => {
    if (state.currentTrack) openFullscreenPlayer();
});

document.addEventListener('keydown', (e) => {
    const fsPlayer = document.getElementById('fullscreenPlayer');
    if (!fsPlayer || fsPlayer.classList.contains('hidden')) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); closeFullscreenPlayer(); }
    if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); toggleFullscreenPlay(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); fullscreenNext(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); fullscreenPrev(); }
    if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (state.currentTrack) toggleFullscreenLike(state.currentTrack.id);
    }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); fullscreenDownload(); }
});

// ============================================================
// INIT
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 MusicHub v2.3 zagruzhen');
    console.log(`📊 Rezhim: ${navigator.onLine ? 'Online' : 'Offline'}`);
    dom.audio.volume = state.volume;
    if (dom.volumeControl) dom.volumeControl.value = state.volume;
    const savedQuery = loadFromCache('last_search');
    if (savedQuery) {
        dom.searchInput.value = savedQuery;
        searchMusic(savedQuery);
    } else {
        searchMusic('populyarnoe');
    }
});

window.addEventListener('online', () => showNotification('🌐 Set vosstanovlena', 'info', 3000));
window.addEventListener('offline', () => showNotification('📡 Net soedineniya, rabotayu oflayn', 'warning', 3000));

window.musicHub = { search: searchMusic, play: playTrack, state: state, API: API, download: downloadTrack };

// Export functions for onclick
window.showArtistV2 = showArtistV2;
window.closeArtistPageV2 = closeArtistPageV2;
window.playArtistTopTrack = playArtistTopTrack;
window.playArtistTrack = playArtistTrack;
window.toggleArtistFollow = toggleArtistFollow;
window.isArtistFollowed = isArtistFollowed;
window.showArtistTrailer = showArtistTrailer;
window.showSinglePage = showSinglePage;
window.closeSinglePageV2 = closeSinglePageV2;
window.playSingleTrack = playSingleTrack;
window.downloadSingleTrack = downloadSingleTrack;
window.shareSingleTrack = shareSingleTrack;
window.openFullscreenPlayer = openFullscreenPlayer;
window.closeFullscreenPlayer = closeFullscreenPlayer;
window.toggleFullscreenPlay = toggleFullscreenPlay;
window.fullscreenPrev = fullscreenPrev;
window.fullscreenNext = fullscreenNext;
window.toggleFullscreenShuffle = toggleFullscreenShuffle;
window.toggleFullscreenRepeat = toggleFullscreenRepeat;
window.toggleFullscreenLike = toggleFullscreenLike;
window.fullscreenDownload = fullscreenDownload;
window.fullscreenShare = fullscreenShare;
window.fullscreenLyrics = fullscreenLyrics;
window.fullscreenAddToPlaylist = fullscreenAddToPlaylist;
window.updateFullscreenPlayerInfo = updateFullscreenPlayerInfo;
window.isTrackLiked = isTrackLiked;
window.formatNumber = formatNumber;
window.searchMusic = searchMusic;
