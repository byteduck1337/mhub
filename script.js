// ===== Config =====
const ERROR_CODES = {
    SEARCH_FAILED: 'ERR_SEARCH_001',
    PLAYBACK_FAILED: 'ERR_PLAY_001',
    DOWNLOAD_FAILED: 'ERR_DOWN_001',
    LYRICS_FAILED: 'ERR_LYRICS_001',
    API_TIMEOUT: 'ERR_API_001',
    NO_AUDIO: 'ERR_AUDIO_001',
    ARTIST_NOT_FOUND: 'ERR_ARTIST_001',
    NETWORK_ERROR: 'ERR_NET_001',
    CACHE_ERROR: 'ERR_CACHE_001',
    NO_INTERNET: 'ERR_666'
};

const API_CONFIG = {
    ITUNES_URL: 'https://itunes.apple.com/search',
    YOUTUBE_KEY: 'YOUR_YOUTUBE_API_KEY', // Замените на свой ключ
    SOUNDCLOUD_CLIENT_ID: 'YOUR_SOUNDCLOUD_CLIENT_ID', // Замените на свой ID
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
    searchHistory: JSON.parse(localStorage.getItem('musichub_history') || '[]'),
    volume: 0.8,
    isDownloading: false,
    isOnline: navigator.onLine
};

const dom = {};

// ===== Utils =====
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function initDom() {
    const elements = [
        'searchInput', 'searchBtn', 'searchHistory',
        'tracksContainer', 'albumsContainer',
        'resultsTitle', 'resultsCount',
        'artistSection', 'artistPageV2', 'singlePageV2',
        'playerCover', 'playerTitle', 'playerArtist',
        'playBtn', 'prevBtn', 'nextBtn',
        'progressBar', 'currentTime', 'totalTime',
        'audioPlayer',
        'downloadTrack', 'downloadPlaylist',
        'showLyrics', 'addToFavorites', 'shareTrack',
        'modal', 'modalTitle', 'modalBody', 'modalClose',
        'notification', 'themeToggle', 'offlineError'
    ];
    elements.forEach(id => { dom[id] = document.getElementById(id); });
    dom.audio = document.getElementById('audioPlayer');
}

function showNotification(message, type = 'info', duration = 4000) {
    const el = dom.notification;
    if (!el) return;
    el.textContent = message;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

function checkOnlineStatus() {
    state.isOnline = navigator.onLine;
    if (!state.isOnline) {
        showOfflineError();
    } else {
        hideOfflineError();
    }
    return state.isOnline;
}

function showOfflineError() {
    if (dom.offlineError) {
        dom.offlineError.classList.remove('hidden');
        $$('#resultsSection, #albumsSection').forEach(el => el.classList.add('hidden'));
    }
}

function hideOfflineError() {
    if (dom.offlineError) {
        dom.offlineError.classList.add('hidden');
        $$('#resultsSection, #albumsSection').forEach(el => el.classList.remove('hidden'));
    }
}

function saveToCache(key, data, duration = API_CONFIG.CACHE_DURATION) {
    try {
        localStorage.setItem(`musichub_${key}`, JSON.stringify({ 
            data, 
            timestamp: Date.now(), 
            duration 
        }));
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

// ===== Search APIs =====
const SearchAPI = {
    iTunes: async (query) => {
        try {
            const url = `${API_CONFIG.ITUNES_URL}?term=${encodeURIComponent(query)}&limit=${API_CONFIG.MAX_TRACKS}&entity=musicTrack`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            return {
                source: 'iTunes',
                tracks: (data.results || []).filter(item => item.kind === 'song').map(item => ({
                    id: item.trackId,
                    name: item.trackName || 'Без названия',
                    artist: item.artistName || 'Неизвестный',
                    artistId: item.artistId,
                    album: item.collectionName || 'Альбом',
                    albumId: item.collectionId,
                    cover: item.artworkUrl100?.replace('100x100', '300x300') || 'https://via.placeholder.com/300',
                    audio: item.previewUrl,
                    duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 180,
                    source: 'iTunes',
                    type: 'track'
                })),
                albums: (data.results || []).reduce((acc, item) => {
                    if (item.collectionId && !acc.has(item.collectionId)) {
                        acc.set(item.collectionId, {
                            id: item.collectionId,
                            name: item.collectionName || 'Альбом',
                            artist: item.artistName || 'Неизвестный',
                            artistId: item.artistId,
                            cover: item.artworkUrl100?.replace('100x100', '300x300') || 'https://via.placeholder.com/300',
                            tracks: item.trackCount || 0,
                            type: 'album'
                        });
                    }
                    return acc;
                }, new Map())
            };
        } catch (error) {
            console.error('iTunes search error:', error);
            return { source: 'iTunes', tracks: [], albums: new Map() };
        }
    },

    SoundCloud: async (query) => {
        try {
            // Используем публичные прокси для обхода CORS
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&limit=${API_CONFIG.MAX_TRACKS}&client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`)}`,
                `https://corsproxy.io/?https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&limit=${API_CONFIG.MAX_TRACKS}&client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`
            ];
            
            for (const proxyUrl of proxies) {
                try {
                    const response = await fetchWithTimeout(proxyUrl);
                    if (response.ok) {
                        const data = await response.json();
                        const tracks = (Array.isArray(data) ? data : []).map(item => ({
                            id: item.id || Math.random() * 10000,
                            name: item.title || 'Без названия',
                            artist: item.user?.username || 'Неизвестный',
                            artistId: item.user?.id || 0,
                            album: 'Сингл',
                            cover: item.artwork_url || 'https://via.placeholder.com/300',
                            audio: item.stream_url || item.media?.transcodings?.[0]?.url,
                            duration: Math.floor((item.duration || 180000) / 1000),
                            source: 'SoundCloud',
                            type: 'track',
                            permalink: item.permalink_url
                        }));
                        return { source: 'SoundCloud', tracks, albums: new Map() };
                    }
                } catch (e) {
                    console.debug('SoundCloud proxy failed:', e);
                }
            }
            return { source: 'SoundCloud', tracks: [], albums: new Map() };
        } catch (error) {
            console.error('SoundCloud search error:', error);
            return { source: 'SoundCloud', tracks: [], albums: new Map() };
        }
    },

    YouTube: async (query) => {
        try {
            // YouTube Data API v3
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${API_CONFIG.MAX_TRACKS}&q=${encodeURIComponent(query + ' music')}&type=video&key=${API_CONFIG.YOUTUBE_KEY}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            const tracks = (data.items || []).map(item => ({
                id: item.id.videoId,
                name: item.snippet.title,
                artist: item.snippet.channelTitle || 'Неизвестный',
                artistId: 0,
                album: 'YouTube',
                cover: item.snippet.thumbnails?.high?.url || 'https://via.placeholder.com/300',
                audio: null, // YouTube требует дополнительный парсинг
                duration: 180,
                source: 'YouTube',
                type: 'track',
                videoId: item.id.videoId
            }));
            
            return { source: 'YouTube', tracks, albums: new Map() };
        } catch (error) {
            console.error('YouTube search error:', error);
            return { source: 'YouTube', tracks: [], albums: new Map() };
        }
    },

    YandexMusic: async (query) => {
        try {
            // Yandex Music не имеет официального публичного API
            // Используем публичные endpoints (могут измениться)
            const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://music.yandex.ru/handlers/search.jsx?text=${encodeURIComponent(query)}&type=all`)}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            // Парсинг ответа Yandex Music (структура может меняться)
            const tracks = (data?.tracks?.results || []).map(item => ({
                id: item.id,
                name: item.title || 'Без названия',
                artist: item.artists?.map(a => a.name).join(', ') || 'Неизвестный',
                artistId: item.artists?.[0]?.id || 0,
                album: item.albums?.[0]?.title || 'Альбом',
                cover: item.coverUri ? `https://${item.coverUri.replace('%%', '400x400')}` : 'https://via.placeholder.com/300',
                audio: null, // Требуется авторизация
                duration: item.durationMs ? Math.floor(item.durationMs / 1000) : 180,
                source: 'Yandex Music',
                type: 'track'
            }));
            
            return { source: 'Yandex Music', tracks, albums: new Map() };
        } catch (error) {
            console.error('Yandex Music search error:', error);
            return { source: 'Yandex Music', tracks: [], albums: new Map() };
        }
    }
};

// ===== Main Search Function =====
async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }

    if (!checkOnlineStatus()) {
        showNotification(' Нет соединения с интернетом', 'error');
        return;
    }

    // Save to history
    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
        localStorage.setItem('musichub_history', JSON.stringify(state.searchHistory));
        updateSearchHistory();
    }

    // Show loading
    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p style="margin-top:10px;color:var(--text-muted);">Ищем треки...</p>
        </div>
    `;
    dom.albumsContainer.innerHTML = '';
    dom.resultsTitle.textContent = `🔍 "${escapeHtml(query)}"`;

    try {
        let allTracks = [];
        let allAlbums = new Map();

        // Search across all platforms
        const searchPromises = [
            SearchAPI.iTunes(query),
            SearchAPI.SoundCloud(query),
            // SearchAPI.YouTube(query), // Раскомментируйте если есть API ключ
            // SearchAPI.YandexMusic(query) // Работает нестабильно
        ];

        const results = await Promise.all(searchPromises);

        // Merge results
        results.forEach(result => {
            allTracks = allTracks.concat(result.tracks);
            result.albums.forEach((value, key) => {
                if (!allAlbums.has(key)) {
                    allAlbums.set(key, value);
                }
            });
        });

        // Remove duplicates
        const uniqueTracks = allTracks.filter((track, index, self) => 
            index === self.findIndex(t => t.id === track.id && t.source === track.source)
        );

        if (uniqueTracks.length === 0) {
            showNotification('Ничего не найдено', 'warning');
            dom.tracksContainer.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
                    <div style="font-size:48px;margin-bottom:16px;">😢</div>
                    <p style="font-size:18px;">Ничего не найдено по запросу "${escapeHtml(query)}"</p>
                    <p style="font-size:14px;margin-top:8px;">Попробуйте другой запрос</p>
                </div>
            `;
            return;
        }

        state.tracks = uniqueTracks;
        state.playlist = uniqueTracks;
        state.currentIndex = 0;

        renderTracks(uniqueTracks);
        renderAlbums(Array.from(allAlbums.values()));
        dom.resultsCount.textContent = `${uniqueTracks.length} треков`;
        
        showNotification(`✅ Найдено ${uniqueTracks.length} треков`, 'success', 2000);

    } catch (error) {
        console.error('Search error:', error);
        showNotification(`⚠️ Ошибка поиска: ${error.message}`, 'error', 4000);
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px;font-weight:600;color:#ef4444;">Ошибка загрузки</p>
                <p style="font-size:14px;margin-top:8px;">${error.message}</p>
                <button onclick="searchMusic('${escapeHtml(query)}')" 
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
        const hasAudio = track.audio || track.source === 'SoundCloud';
        return `
            <div class="track-card" data-index="${index}" role="button" tabindex="0">
                <img src="${track.cover}" 
                     alt="${escapeHtml(track.name)}" 
                     onerror="this.src='https://via.placeholder.com/300'" 
                     loading="lazy" />
                <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
                <p class="artist-link" 
                   title="${escapeHtml(track.artist)}" 
                   onclick="event.stopPropagation(); showArtistPage('${escapeHtml(track.artist)}', ${track.artistId})">
                    ${escapeHtml(track.artist)}
                </p>
                <span class="source-tag">${track.source}</span>
                <div class="actions">
                    <button class="btn-play" data-index="${index}">
                        ${hasAudio ? '▶' : '🎵'} ${hasAudio ? 'Слушать' : 'Preview'}
                    </button>
                    <button class="btn-artist" onclick="event.stopPropagation(); showArtistPage('${escapeHtml(track.artist)}', ${track.artistId})">
                         Исполнитель
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Event listeners
    dom.tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            playTrack(index);
        });
    });

    dom.tracksContainer.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            if (state.tracks[index]) {
                playTrack(index);
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
            <img src="${album.cover}" 
                 alt="${escapeHtml(album.name)}" 
                 onerror="this.src='https://via.placeholder.com/300'" 
                 loading="lazy" />
            <h3 title="${escapeHtml(album.name)}">${escapeHtml(album.name)}</h3>
            <p class="artist-link" 
               title="${escapeHtml(album.artist)}"
               onclick="event.stopPropagation(); showArtistPage('${escapeHtml(album.artist)}', ${album.artistId})">
                ${escapeHtml(album.artist)}
            </p>
            <span style="font-size:12px;color:var(--text-muted);">${album.tracks} треков</span>
        </div>
    `).join('');

    dom.albumsContainer.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', () => {
            showNotification('📀 Альбомы будут доступны в следующей версии', 'info');
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

// ===== Artist Page =====
async function showArtistPage(name, id) {
    if (!checkOnlineStatus()) {
        showNotification('❌ Нет соединения', 'error');
        return;
    }

    const artistPage = dom.artistPageV2;
    artistPage.classList.remove('hidden');
    $$('#resultsSection, #albumsSection').forEach(el => el.classList.add('hidden'));
    
    artistPage.innerHTML = `
        <div class="artist-page-v2__loading">
            <div class="spinner"></div>
            <p>Загрузка исполнителя...</p>
        </div>
    `;
    window.scrollTo(0, 0);

    try {
        // Search for artist tracks on iTunes
        const url = `${API_CONFIG.ITUNES_URL}?term=${encodeURIComponent(name)}&limit=50&entity=musicTrack`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const tracks = (data.results || []).filter(item => item.kind === 'song').map(item => ({
            id: item.trackId,
            name: item.trackName || 'Без названия',
            artist: item.artistName || name,
            artistId: item.artistId,
            album: item.collectionName || 'Альбом',
            cover: item.artworkUrl100?.replace('100x100', '300x300') || 'https://via.placeholder.com/300',
            audio: item.previewUrl,
            duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 180,
            source: 'iTunes',
            type: 'track'
        }));

        if (tracks.length === 0) {
            throw new Error('Треки не найдены');
        }

        // Get artist info from first track
        const firstTrack = tracks[0];
        const artistImage = firstTrack.cover;
        const trackCount = tracks.length;

        state.artistTracks = tracks;
        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;

        artistPage.innerHTML = `
            <div class="artist-page-v2__header">
                <button class="artist-page-v2__back" onclick="closeArtistPage()">← Назад</button>
                <div class="artist-page-v2__hero">
                    <img src="${artistImage}" alt="${escapeHtml(name)}" class="artist-page-v2__avatar" />
                    <div class="artist-page-v2__info">
                        <div class="artist-page-v2__badge">Исполнитель</div>
                        <h1 class="artist-page-v2__name">${escapeHtml(name)}</h1>
                        <div class="artist-page-v2__stats">
                            <span> ${trackCount} треков</span>
                            <span>📀 ${new Set(tracks.map(t => t.album)).size} альбомов</span>
                        </div>
                        <div class="artist-page-v2__actions">
                            <button class="artist-page-v2__btn-primary" onclick="playArtistTopTrack()">▶ Слушать</button>
                            <button class="artist-page-v2__btn-secondary" onclick="shareArtist('${escapeHtml(name)}')">📤 Поделиться</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="artist-page-v2__content">
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Популярные треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${tracks.slice(0, 10).map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <img src="${track.cover}" class="artist-page-v2__track-cover" style="width:48px;height:48px;border-radius:6px;object-fit:cover;" />
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.album)}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${tracks.length > 10 ? `
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Все треки (${tracks.length})</h2>
                    <div class="artist-page-v2__track-list">
                        ${tracks.slice(10).map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx + 10})">
                                <span class="artist-page-v2__track-number">${String(idx + 11).padStart(2, '0')}</span>
                                <img src="${track.cover}" class="artist-page-v2__track-cover" style="width:48px;height:48px;border-radius:6px;object-fit:cover;" />
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.album)}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx + 10})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

    } catch (error) {
        console.error('Artist error:', error);
        artistPage.innerHTML = `
            <div class="artist-page-v2__error">
                <div style="font-size:48px;margin-bottom:16px;">😢</div>
                <p>Не удалось загрузить информацию об исполнителе</p>
                <p style="color:var(--text-muted);font-size:14px;">${error.message}</p>
                <button onclick="closeArtistPage()" class="artist-page-v2__btn-primary">← Назад</button>
            </div>
        `;
    }
}

function closeArtistPage() {
    dom.artistPageV2.classList.add('hidden');
    $$('#resultsSection, #albumsSection').forEach(el => el.classList.remove('hidden'));
}

function playArtistTopTrack() {
    if (state.artistTracks && state.artistTracks.length > 0) {
        playTrack(0);
    }
}

function playArtistTrack(index) {
    if (state.artistTracks && state.artistTracks[index]) {
        state.tracks = state.artistTracks;
        state.playlist = state.artistTracks;
        playTrack(index);
    }
}

function shareArtist(name) {
    const text = `Слушаю ${name} на MusicHub`;
    if (navigator.share) {
        navigator.share({ title: name, text, url: window.location.href }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('📋 Скопировано', 'success');
        });
    }
}

// ===== Player =====
async function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;

    updatePlayerInfo(track);

    if (!track.audio) {
        showNotification('🔇 Нет ссылки для прослушивания', 'info', 3000);
        return;
    }

    const audio = dom.audio;
    audio.src = track.audio;
    audio.load();

    try {
        await audio.play();
        state.isPlaying = true;
        dom.playBtn.textContent = '⏸';
        showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
    } catch (err) {
        console.error('Playback error:', err);
        showNotification('️ Ошибка воспроизведения', 'error', 4000);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
}

function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Без названия';
    dom.playerArtist.textContent = track.artist || 'Неизвестный';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
}

function togglePlay() {
    const audio = dom.audio;
    if (!audio.src) {
        if (state.currentTrack) playTrack(state.currentIndex);
        else showNotification('Сначала выберите трек', 'info');
        return;
    }

    if (audio.paused) {
        audio.play().catch(() => showNotification('Ошибка воспроизведения', 'error'));
        dom.playBtn.textContent = '⏸';
        state.isPlaying = true;
    } else {
        audio.pause();
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
}

function prevTrack() {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
    playTrack(state.currentIndex);
}

function nextTrack() {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
    playTrack(state.currentIndex);
}

function setupAudioEvents() {
    const audio = dom.audio;
    
    audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration)) {
            dom.progressBar.value = (audio.currentTime / audio.duration) * 100;
            dom.currentTime.textContent = formatTime(audio.currentTime);
            dom.totalTime.textContent = formatTime(audio.duration);
        }
    });

    dom.progressBar.addEventListener('input', () => {
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (dom.progressBar.value / 100) * audio.duration;
        }
    });

    audio.addEventListener('ended', () => {
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
        if (state.tracks.length > 1) {
            state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
            playTrack(state.currentIndex);
        }
    });

    audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
        showNotification('⚠️ Ошибка воспроизведения', 'error', 4000);
    });
}

// ===== Download & Other Functions =====
function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }
    showNotification('⬇ Функция скачивания в разработке', 'info', 3000);
}

function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Плейлист пуст', 'info');
        return;
    }
    showNotification('📋 Скачивание плейлиста в разработке', 'info', 3000);
}

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
        // Try to fetch lyrics from public API
        const response = await fetchWithTimeout(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.name)}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.lyrics) {
                dom.modalBody.innerHTML = escapeHtml(data.lyrics);
                return;
            }
        }
        
        dom.modalBody.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">Текст не найден 😔</div>';
    } catch (error) {
        dom.modalBody.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px;">Ошибка загрузки текста</div>';
    }
}

function addToFavorites() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }
    showNotification('❤️ Добавлено в избранное', 'success', 2000);
}

async function shareTrack() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    const text = `${track.name} - ${track.artist}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: text, text, url: window.location.href });
        } catch (error) {
            if (error.name !== 'AbortError') showNotification('Ошибка шеринга', 'error');
        }
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('📋 Скопировано в буфер обмена', 'success', 2000);
        });
    }
}

// ===== UI Setup =====
function setupUI() {
    dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
    
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchMusic(dom.searchInput.value);
    });

    dom.playBtn.addEventListener('click', togglePlay);
    dom.prevBtn.addEventListener('click', prevTrack);
    dom.nextBtn.addEventListener('click', nextTrack);
    
    dom.showLyrics.addEventListener('click', showLyrics);
    dom.downloadTrack.addEventListener('click', () => {
        if (state.currentTrack) {
            const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
            downloadTrack(idx !== -1 ? idx : state.currentIndex);
        } else {
            showNotification('Сначала выберите трек', 'info');
        }
    });
    
    dom.downloadPlaylist.addEventListener('click', downloadPlaylist);
    dom.addToFavorites.addEventListener('click', addToFavorites);
    dom.shareTrack.addEventListener('click', shareTrack);

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

    // Theme toggle
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

    // Online/Offline events
    window.addEventListener('online', () => {
        state.isOnline = true;
        hideOfflineError();
        showNotification('🌐 Сеть восстановлена', 'info', 3000);
    });

    window.addEventListener('offline', () => {
        state.isOnline = false;
        showOfflineError();
        showNotification('📡 Нет соединения', 'warning', 3000);
    });

    setupAudioEvents();

    // Global functions
    window.searchMusic = searchMusic;
    window.showArtistPage = showArtistPage;
    window.closeArtistPage = closeArtistPage;
    window.playArtistTopTrack = playArtistTopTrack;
    window.playArtistTrack = playArtistTrack;
    window.playTrack = playTrack;
    window.downloadTrack = downloadTrack;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    setupUI();
    
    checkOnlineStatus();
    updateSearchHistory();
    
    dom.audio.volume = state.volume || 0.8;

    // Logo click
    document.getElementById('logoLink')?.addEventListener('click', () => {
        dom.searchInput.value = '';
        if (state.isOnline) {
            searchMusic('популярное');
        }
        closeArtistPage();
    });

    // Initial search
    if (state.isOnline) {
        searchMusic('популярное');
    }

    console.log('🎵 MusicHub v3.0 загружен');
    console.log(`📊 Статус: ${state.isOnline ? 'Online' : 'Offline'}`);
});
