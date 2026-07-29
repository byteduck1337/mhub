/**
 * MusicHub v2.2 - Расширенный музыкальный плеер
 * 
 * Основные функции:
 * - Поиск музыки через iTunes, Jamendo и Last.fm
 * - Прослушивание и скачивание треков
 * - Отображение информации об исполнителях
 * - Поиск текстов песен
 * - Создание и управление плейлистами
 * - Тёмная/светлая тема
 * - Кэширование результатов поиска
 * - Поддержка демо-режима
 * 
 * @author Ваш Имя
 * @version 2.2
 * @license MIT
 */

// ============================================================
// КОНСТАНТЫ И КОНФИГУРАЦИЯ
// ============================================================

/** Коды ошибок для логирования и отладки */
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

/** Настройки API */
const API_CONFIG = {
    JAMENDO_KEY: 'e0f5b4f3',
    LASTFM_KEY: 'b25b959554ed76058ac220b7b2e0a026',
    TIMEOUT: 10000,
    MAX_TRACKS: 30,
    CACHE_DURATION: 3600000 // 1 час
};

/** Состояние приложения */
const state = {
    tracks: [],           // Все треки
    currentIndex: 0,      // Индекс текущего трека
    isPlaying: false,     // Статус воспроизведения
    currentTrack: null,   // Текущий трек
    playlist: [],         // Плейлист
    modalOpen: false,     // Открыто ли модальное окно
    artistTracks: [],     // Треки исполнителя
    searchHistory: [],    // История поиска
    volume: 0.8          // Громкость (0-1)
};

// ============================================================
// DOM КОНТЕЙНЕРЫ
// ============================================================

/** Утилиты для работы с DOM */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/** Все элементы DOM сгруппированы по назначению */
const dom = {
    // Элементы поиска
    searchInput: $('#searchInput'),
    searchBtn: $('#searchBtn'),
    searchHistory: $('#searchHistory'),
    
    // Контейнеры результатов
    tracksContainer: $('#tracksContainer'),
    albumsContainer: $('#albumsContainer'),
    resultsTitle: $('#resultsTitle'),
    resultsCount: $('#resultsCount'),
    
    // Секция исполнителя
    artistSection: $('#artistSection'),
    artistName: $('#artistName'),
    artistInfo: $('#artistInfo'),
    artistTracks: $('#artistTracks'),
    backBtn: $('#backToSearch'),
    
    // Элементы плеера
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
    
    // Кнопки действий
    downloadTrack: $('#downloadTrackBtn'),
    downloadPlaylist: $('#downloadPlaylistBtn'),
    showLyrics: $('#showLyricsBtn'),
    addToFavorites: $('#addToFavoritesBtn'),
    shareTrack: $('#shareTrackBtn'),
    
    // Модальное окно
    modal: $('#modal'),
    modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'),
    modalClose: $('#modalClose'),
    
    // Уведомления и тема
    notification: $('#notification'),
    themeToggle: $('#themeToggle')
};

// ============================================================
// СИСТЕМА УВЕДОМЛЕНИЙ
// ============================================================

/**
 * Показывает уведомление пользователю
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Длительность показа в мс
 */
function showNotification(message, type = 'info', duration = 4000) {
    const el = dom.notification;
    el.textContent = message;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

// ============================================================
// РАБОТА С КЭШЕМ
// ============================================================

/**
 * Сохраняет данные в localStorage с временной меткой
 * @param {string} key - Ключ кэша
 * @param {*} data - Данные для сохранения
 * @param {number} duration - Время жизни кэша в мс
 */
function saveToCache(key, data, duration = API_CONFIG.CACHE_DURATION) {
    try {
        const cacheEntry = {
            data: data,
            timestamp: Date.now(),
            duration: duration
        };
        localStorage.setItem(`musichub_${key}`, JSON.stringify(cacheEntry));
    } catch (error) {
        console.error(`[${ERROR_CODES.CACHE_ERROR}] Ошибка сохранения кэша:`, error);
    }
}

/**
 * Загружает данные из кэша
 * @param {string} key - Ключ кэша
 * @returns {*} Данные или null, если кэш устарел
 */
function loadFromCache(key) {
    try {
        const raw = localStorage.getItem(`musichub_${key}`);
        if (!raw) return null;
        
        const cacheEntry = JSON.parse(raw);
        const age = Date.now() - cacheEntry.timestamp;
        
        if (age > cacheEntry.duration) {
            localStorage.removeItem(`musichub_${key}`);
            return null;
        }
        
        return cacheEntry.data;
    } catch (error) {
        console.error(`[${ERROR_CODES.CACHE_ERROR}] Ошибка загрузки кэша:`, error);
        return null;
    }
}

// ============================================================
// API ИНТЕГРАЦИЯ - МНОГО ИСТОЧНИКОВ
// ============================================================

/**
 * Обёртка для fetch с таймаутом
 * @param {string} url - URL для запроса
 * @param {object} options - Опции fetch
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

/** API-клиенты для разных сервисов */
const API = {
    /**
     * iTunes API - самый надёжный источник
     */
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
    
    /**
     * Jamendo API - с поддержкой нескольких прокси
     */
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
                } catch (e) {
                    console.debug(`Jamendo proxy ${url} failed:`, e);
                }
            }
            throw new Error('All Jamendo proxies failed');
        }
    },

    /**
     * Last.fm API для биографий и статистики
     */
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
    }
};

// ============================================================
// ДЕМО-ДАННЫЕ
// ============================================================

/**
 * Генерирует демо-треки для офлайн-режима
 * @param {string} query - Поисковый запрос
 * @returns {Array} Массив демо-треков
 */
function getDemoTracks(query) {
    const DEMO_DB = [
        { name: 'Тёмный принц', artist: 'Алексей Воробьёв', album: 'Лучшее' },
        { name: 'Принц и нищий', artist: 'Владимир Высоцкий', album: 'Концерт' },
        { name: 'Тёмная ночь', artist: 'Марк Бернес', album: 'Великие песни' },
        { name: 'Purple Rain', artist: 'Prince', album: 'Purple Rain' },
        { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
        { name: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV' },
        { name: 'Imagine', artist: 'John Lennon', album: 'Imagine' },
        { name: 'Hotel California', artist: 'Eagles', album: 'Hotel California' },
        { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind' },
        { name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller' },
        { name: 'Like a Rolling Stone', artist: 'Bob Dylan', album: 'Highway 61 Revisited' },
        { name: 'Yesterday', artist: 'The Beatles', album: 'Help!' },
        { name: 'Wonderwall', artist: 'Oasis', album: '(What\'s the Story) Morning Glory?' },
        { name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile' },
        { name: 'Shape of You', artist: 'Ed Sheeran', album: '÷' },
        { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours' },
        { name: 'Dance Monkey', artist: 'Tones and I', album: 'The Kids Are Coming' },
        { name: 'Believer', artist: 'Imagine Dragons', album: 'Evolve' },
        { name: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions' },
        { name: 'Demons', artist: 'Imagine Dragons', album: 'Night Visions' }
    ];

    const filtered = DEMO_DB.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase())
    );

    const tracks = (filtered.length > 0 ? filtered : DEMO_DB.slice(0, 10));
    
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
        isDemo: true
    }));
}

/**
 * Генерирует демо-альбомы
 * @param {string} query - Поисковый запрос
 * @returns {Array} Массив демо-альбомов
 */
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
// ОСНОВНАЯ ЛОГИКА ПОИСКА
// ============================================================

/**
 * Главная функция поиска музыки
 * @param {string} query - Поисковый запрос
 */
async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.SEARCH_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Поиск: "${query}"`);

    // Сохраняем в историю
    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
        updateSearchHistory();
    }

    // Показываем индикатор загрузки
    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: var(--text-muted);">Ищем треки...</p>
        </div>
    `;
    dom.albumsContainer.innerHTML = '';
    dom.artistSection.classList.add('hidden');
    dom.resultsTitle.textContent = `🔍 "${query}"`;

    try {
        let tracks = [];
        let albums = [];

        // Сначала проверяем кэш
        const cacheKey = `search_${query.toLowerCase().trim()}`;
        const cached = loadFromCache(cacheKey);
        if (cached) {
            tracks = cached.tracks || [];
            albums = cached.albums || [];
            showNotification('📦 Загружено из кэша', 'info', 2000);
        }

        // Если кэш пуст, пробуем API
        if (tracks.length === 0) {
            // 1. Пробуем iTunes (самый надёжный)
            try {
                const data = await API.itunes.search(query);
                if (data.results && data.results.length > 0) {
                    tracks = data.results
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
                            type: 'track'
                        }));

                    // Собираем альбомы
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
            } catch (e) {
                console.debug('iTunes не сработал:', e);
            }

            // 2. Если iTunes ничего не дал - пробуем Jamendo
            if (tracks.length === 0) {
                try {
                    const data = await API.jamendo.search(query);
                    if (data.results && data.results.length > 0) {
                        tracks = data.results.map(item => ({
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
                            type: 'track'
                        }));
                    }
                } catch (e) {
                    console.debug('Jamendo не сработал:', e);
                }
            }

            // Сохраняем в кэш
            if (tracks.length > 0) {
                saveToCache(cacheKey, { tracks, albums });
            }
        }

        // 3. Последняя надежда - демо-режим
        if (tracks.length === 0) {
            tracks = getDemoTracks(query);
            albums = getDemoAlbums(query);
            showNotification('🎵 Демо-режим (офлайн)', 'info', 3000);
        }

        // Обновляем состояние
        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;

        // Рендерим результаты
        renderTracks(tracks);
        renderAlbums(albums);

        dom.resultsCount.textContent = `${tracks.length} треков`;
        console.log(`[${errorId}] Найдено ${tracks.length} треков`);

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        
        // Пробуем восстановиться из кэша при ошибке
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

        // Показываем ошибку
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px; font-weight:600; color:#ef4444;">Ошибка загрузки</p>
                <p style="font-size:12px; color:var(--text-muted);">Код: ${errorId}</p>
                <p style="font-size:14px; margin-top:8px;">${error.message}</p>
                <button onclick="searchMusic('популярное')" 
                        style="margin-top:20px; padding:10px 30px; background:var(--accent); border:none; border-radius:10px; color:#fff; cursor:pointer; transition: opacity 0.2s;">
                    ↻ Попробовать снова
                </button>
            </div>
        `;
    }
}

// ============================================================
// РЕНДЕРИНГ РЕЗУЛЬТАТОВ
// ============================================================

/**
 * Рендерит список треков
 * @param {Array} tracks - Массив треков
 */
function renderTracks(tracks) {
    if (!tracks || tracks.length === 0) {
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:32px; margin-bottom:10px;">🎵</div>
                <p>Ничего не найдено</p>
            </div>
        `;
        return;
    }

    dom.tracksContainer.innerHTML = tracks.map((track, index) => `
        <div class="track-card" data-index="${index}" role="button" tabindex="0">
            <img src="${track.cover}" alt="${track.name}" 
                 onerror="this.src='https://via.placeholder.com/300'" 
                 loading="lazy" />
            <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
            <p title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
            ${track.isDemo ? '<span class="source-tag" style="background:#ff6b6b;color:#fff;">DEMO</span>' : 
                            `<span class="source-tag">${track.source || 'Unknown'}</span>`}
            <div class="actions">
                <button class="btn-play" data-index="${index}" aria-label="Play ${track.name}">
                    ${track.audio ? '▶' : '🎵'} ${track.audio ? 'Слушать' : 'Демо'}
                </button>
                <button class="btn-download" data-index="${index}" aria-label="Download ${track.name}">⬇</button>
                <button class="btn-artist" data-artist="${escapeHtml(track.artist)}" 
                        data-artistid="${track.artistId}" aria-label="View artist">👤</button>
            </div>
        </div>
    `).join('');

    // Делегирование событий для лучшей производительности
    dom.tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playTrack(parseInt(btn.dataset.index));
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadTrack(parseInt(btn.dataset.index));
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-artist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtist(btn.dataset.artist, btn.dataset.artistid);
        });
    });

    dom.tracksContainer.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => {
            playTrack(parseInt(card.dataset.index));
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                playTrack(parseInt(card.dataset.index));
            }
        });
    });
}

/**
 * Рендерит список альбомов
 * @param {Array} albums - Массив альбомов
 */
function renderAlbums(albums) {
    if (!albums || albums.length === 0) {
        dom.albumsContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">
                Нет альбомов
            </div>
        `;
        return;
    }

    dom.albumsContainer.innerHTML = albums.map(album => `
        <div class="album-card" data-albumid="${album.id}">
            <img src="${album.cover}" alt="${album.name}" 
                 onerror="this.src='https://via.placeholder.com/300'" 
                 loading="lazy" />
            <h3 title="${escapeHtml(album.name)}">${escapeHtml(album.name)}</h3>
            <p title="${escapeHtml(album.artist)}">${escapeHtml(album.artist)}</p>
            <span style="font-size:12px; color:var(--text-muted);">${album.tracks} треков</span>
            <div class="actions" style="margin-top:10px;">
                <button class="btn-artist-album" data-artist="${escapeHtml(album.artist)}" 
                        data-artistid="${album.artistId}">👤 ${escapeHtml(album.artist)}</button>
            </div>
        </div>
    `).join('');

    dom.albumsContainer.querySelectorAll('.btn-artist-album').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtist(btn.dataset.artist, btn.dataset.artistid);
        });
    });
}

/**
 * Обновляет историю поиска в UI
 */
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
// СТРАНИЦА ИСПОЛНИТЕЛЯ
// ============================================================

/**
 * Показывает страницу исполнителя
 * @param {string} name - Имя исполнителя
 * @param {string|number} id - ID исполнителя
 */
async function showArtist(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Запрос исполнителя: ${name}`);

    dom.artistSection.classList.remove('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dom.artistName.textContent = name;
    dom.artistInfo.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.artistTracks.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        // Получаем информацию об исполнителе
        let bio = 'Информация об исполнителе не найдена';
        let stats = { listeners: '?', plays: '?', similar: [] };

        try {
            const data = await API.lastfm.getArtistInfo(name);
            if (data && data.artist) {
                bio = data.artist.bio?.content || bio;
                stats.listeners = data.artist.stats?.listeners || '?';
                stats.plays = data.artist.stats?.playcount || '?';
                stats.similar = data.artist.similar?.artist?.map(a => a.name) || [];
                bio = bio.replace(/<[^>]+>/g, '').trim();
                if (bio.length > 500) bio = bio.slice(0, 500) + '...';
            }
        } catch (e) {
            console.debug('Last.fm не сработал:', e);
        }

        // Получаем треки исполнителя
        let tracks = [];
        try {
            // Пробуем через iTunes
            const data = await API.itunes.search(name);
            if (data.results && data.results.length > 0) {
                tracks = data.results
                    .filter(item => item.kind === 'song')
                    .slice(0, 20)
                    .map(item => ({
                        id: item.trackId,
                        name: item.trackName || 'Без названия',
                        artist: item.artistName || name,
                        artistId: item.artistId,
                        album: item.collectionName || 'Альбом',
                        cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                        audio: item.previewUrl,
                        duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 0,
                        source: 'iTunes'
                    }));
            }
        } catch (e) {
            console.debug('Не удалось получить треки:', e);
        }

        // Отображаем информацию
        dom.artistInfo.innerHTML = `
            <div class="bio">${escapeHtml(bio)}</div>
            <div class="stats">
                <span>👂 Слушают: <strong>${stats.listeners}</strong></span>
                <span>▶ Прослушиваний: <strong>${stats.plays}</strong></span>
                <span>🎵 Треков: <strong>${tracks.length}</strong></span>
                ${stats.similar.length > 0 ? `<span>🔗 Похожие: ${stats.similar.map(s => `<a href="#" onclick="showArtist('${escapeHtml(s)}', 0);return false;">${escapeHtml(s)}</a>`).join(', ')}</span>` : ''}
            </div>
        `;

        // Отображаем треки
        if (tracks.length > 0) {
            state.artistTracks = tracks;
            dom.artistTracks.innerHTML = tracks.map((track, idx) => `
                <div class="track-card" style="grid-column:span 1;">
                    <img src="${track.cover}" alt="${track.name}" 
                         onerror="this.src='https://via.placeholder.com/300'" 
                         loading="lazy" />
                    <h3>${escapeHtml(track.name)}</h3>
                    <p>${escapeHtml(track.artist)}</p>
                    <span class="source-tag">${track.source}</span>
                    <div class="actions">
                        <button class="btn-play-artist" data-index="${idx}">${track.audio ? '▶' : '🎵'} ${track.audio ? 'Слушать' : 'Демо'}</button>
                        <button class="btn-download-artist" data-index="${idx}">⬇</button>
                    </div>
                </div>
            `).join('');

            dom.artistTracks.querySelectorAll('.btn-play-artist').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index);
                    state.tracks = state.artistTracks;
                    state.playlist = state.artistTracks;
                    playTrack(idx);
                });
            });

            dom.artistTracks.querySelectorAll('.btn-download-artist').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index);
                    state.tracks = state.artistTracks;
                    downloadTrack(idx);
                });
            });
        } else {
            dom.artistTracks.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Нет треков</p>';
        }

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        dom.artistInfo.innerHTML = `
            <div class="bio" style="color:#ef4444;">
                ❌ Не удалось загрузить информацию
                <br><small>Код: ${errorId}</small>
            </div>
        `;
    }
}

// ============================================================
// ПЛЕЕР
// ============================================================

/**
 * Воспроизводит трек по индексу
 * @param {number} index - Индекс трека в state.tracks
 */
function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;

    const audioUrl = track.audio;

    if (!audioUrl) {
        showNotification('🔇 Нет ссылки для прослушивания', 'info', 3000);
        updatePlayerInfo(track);
        return;
    }

    const audio = dom.audio;
    audio.src = audioUrl;
    audio.load();

    audio.play()
        .then(() => {
            state.isPlaying = true;
            dom.playBtn.textContent = '⏸';
            showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
        })
        .catch((err) => {
            const errorId = `${ERROR_CODES.PLAYBACK_FAILED}_${Date.now()}`;
            console.error(`[${errorId}] Ошибка:`, err);
            showNotification(`⚠️ Ошибка воспроизведения (${errorId})`, 'error', 4000);
            dom.playBtn.textContent = '▶';
            state.isPlaying = false;
        });

    updatePlayerInfo(track);
}

/**
 * Обновляет информацию в плеере
 * @param {object} track - Трек
 */
function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Без названия';
    dom.playerArtist.textContent = track.artist || 'Неизвестный';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
    dom.playerCover.alt = track.name || 'Обложка';
}

// ============================================================
// ТЕКСТЫ ПЕСЕН
// ============================================================

/**
 * Показывает текст песни в модальном окне
 */
async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.LYRICS_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Запрос текста: ${track.name}`);

    dom.modalTitle.textContent = `📝 ${track.name} - ${track.artist}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        let lyrics = 'Текст не найден 😔';
        
        // Пробуем разные источники
        const sources = [
            // Genius
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
                            return match[1]
                                .replace(/<[^>]+>/g, '\n')
                                .replace(/&quot;/g, '"')
                                .replace(/&amp;/g, '&')
                                .trim()
                                .split('\n')
                                .filter(line => line.trim())
                                .join('\n');
                        }
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            },
            
            // AZLyrics (прокси)
            async () => {
                try {
                    const url = `https://corsproxy.io/?https://www.azlyrics.com/lyrics/${track.artist.toLowerCase().replace(/\s+/g, '')}/${track.name.toLowerCase().replace(/\s+/g, '')}.html`;
                    const response = await fetchWithTimeout(url);
                    const html = await response.text();
                    
                    const match = html.match(/<div[^>]*class="[^"]*lyricsh[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                    if (match) {
                        return match[1]
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<[^>]+>/g, '')
                            .trim();
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            }
        ];

        for (const source of sources) {
            const result = await source();
            if (result) {
                lyrics = result;
                break;
            }
        }

        dom.modalBody.innerHTML = lyrics.split('\n').map(line => 
            `<div class="lyrics-line">${escapeHtml(line) || ' '}</div>`
        ).join('');

        console.log(`[${errorId}] Текст загружен`);

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        dom.modalBody.innerHTML = `
            <div style="color:#ef4444; text-align:center; padding:20px;">
                ❌ Не удалось загрузить текст
                <br><small>Код: ${errorId}</small>
            </div>
        `;
    }
}

// ============================================================
// СКАЧИВАНИЕ
// ============================================================

/**
 * Скачивает трек или его информацию
 * @param {number} index - Индекс трека
 */
function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    const errorId = `${ERROR_CODES.DOWNLOAD_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Скачивание: ${track.name}`);

    const audioUrl = track.audio;

    if (!audioUrl) {
        showNotification('🔇 Ссылка недоступна, сохраняем информацию', 'info', 3000);
        downloadTrackInfo(track);
        return;
    }

    try {
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `${track.artist} - ${track.name}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`✅ ${track.name} скачан`, 'success', 3000);
        console.log(`[${errorId}] Скачивание начато`);
    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
        downloadTrackInfo(track);
    }
}

/**
 * Скачивает информацию о треке в текстовом формате
 * @param {object} track - Трек
 */
function downloadTrackInfo(track) {
    const text = `🎵 ${track.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Исполнитель: ${track.artist}
Альбом: ${track.album || 'Неизвестен'}
Источник: ${track.source || 'Неизвестен'}
Длительность: ${track.duration ? formatTime(track.duration) : 'Неизвестно'}

🔗 Ссылка: ${track.audio || 'Недоступна'}
`;

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

/**
 * Скачивает весь плейлист в текстовом формате
 */
function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Плейлист пуст', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.DOWNLOAD_FAILED}_PLAYLIST_${Date.now()}`;
    console.log(`[${errorId}] Скачивание плейлиста (${state.playlist.length} треков)`);

    let text = `🎵 Плейлист MusicHub\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Дата: ${new Date().toLocaleString()}\n`;
    text += `Треков: ${state.playlist.length}\n\n`;

    state.playlist.forEach((track, i) => {
        const title = track.name || 'Без названия';
        const artist = track.artist || 'Неизвестный';
        const url = track.audio || 'Ссылка недоступна';
        text += `${String(i+1).padStart(2, '0')}. ${artist} — ${title}\n`;
        text += `   🔗 ${url}\n\n`;
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
    console.log(`[${errorId}] Плейлист скачан`);
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Добавляет текущий трек в избранное (localStorage)
 */
function addToFavorites() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    const favorites = JSON.parse(localStorage.getItem('musichub_favorites') || '[]');
    if (!favorites.some(f => f.id === track.id)) {
        favorites.push(track);
        localStorage.setItem('musichub_favorites', JSON.stringify(favorites));
        showNotification('❤️ Добавлено в избранное', 'success', 2000);
    } else {
        showNotification('Уже в избранном', 'info', 2000);
    }
}

/**
 * Делится треком (Web Share API)
 */
async function shareTrack() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: `${track.name} - ${track.artist}`,
                text: `Слушаю "${track.name}" от ${track.artist} на MusicHub`,
                url: track.audio || window.location.href
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Ошибка шеринга:', error);
                showNotification('Ошибка при открытии шеринга', 'error', 3000);
            }
        }
    } else {
        // Fallback: копируем в буфер обмена
        const text = `${track.name} - ${track.artist}\n${track.audio || window.location.href}`;
        navigator.clipboard.writeText(text)
            .then(() => showNotification('📋 Скопировано в буфер обмена', 'success', 2000))
            .catch(() => showNotification('Не удалось скопировать', 'error', 3000));
    }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * Экранирует HTML-сущности
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирует время в минуты:секунды
 * @param {number} seconds - Количество секунд
 * @returns {string} Отформатированное время
 */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Дебаунс для оптимизации частых вызовов
 * @param {Function} fn - Функция
 * @param {number} delay - Задержка в мс
 * @returns {Function} Обёрнутая функция
 */
function debounce(fn, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

// Плеер
dom.playBtn.addEventListener('click', () => {
    const audio = dom.audio;
    if (!audio.src) {
        showNotification('Сначала выберите трек', 'info');
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

// Прогресс-бар
dom.audio.addEventListener('timeupdate', () => {
    const audio = dom.audio;
    if (audio.duration && !isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        dom.progressBar.value = percent;
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

// Громкость
dom.volumeControl?.addEventListener('input', () => {
    const audio = dom.audio;
    const volume = parseFloat(dom.volumeControl.value);
    audio.volume = volume;
    state.volume = volume;
});

// События аудио
dom.audio.addEventListener('ended', () => {
    dom.playBtn.textContent = '▶';
    state.isPlaying = false;
    if (state.tracks.length > 1) {
        state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
        playTrack(state.currentIndex);
    }
});

dom.audio.addEventListener('error', (e) => {
    const errorId = `${ERROR_CODES.PLAYBACK_FAILED}_${Date.now()}`;
    console.error(`[${errorId}] Ошибка:`, e);
    dom.playBtn.textContent = '▶';
    state.isPlaying = false;
    showNotification(`⚠️ Ошибка воспроизведения (${errorId})`, 'error', 4000);
});

// Поиск
dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));

dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchMusic(dom.searchInput.value);
});

dom.searchInput.addEventListener('input', debounce(() => {
    if (dom.searchInput.value.length > 2) {
        // Автодополнение или предпросмотр
    }
}, 500));

// Назад к поиску
dom.backBtn.addEventListener('click', () => {
    dom.artistSection.classList.add('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth' });
});

// Кнопки действий
dom.showLyrics.addEventListener('click', showLyrics);
dom.downloadTrack.addEventListener('click', () => {
    if (state.currentTrack) {
        const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
        if (idx !== -1) downloadTrack(idx);
        else downloadTrack(state.currentIndex);
    } else {
        showNotification('Сначала выберите трек', 'info');
    }
});
dom.downloadPlaylist.addEventListener('click', downloadPlaylist);
dom.addToFavorites?.addEventListener('click', addToFavorites);
dom.shareTrack?.addEventListener('click', shareTrack);

// Модальное окно
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
    // Горячие клавиши для плеера
    if (e.target.tagName !== 'INPUT') {
        if (e.key === ' ') {
            e.preventDefault();
            dom.playBtn.click();
        }
        if (e.key === 'ArrowLeft') dom.prevBtn.click();
        if (e.key === 'ArrowRight') dom.nextBtn.click();
    }
});

// Тема
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
        dom.themeToggle.title = 'Переключить на светлую тему';
    } else {
        root.style.setProperty('--bg-primary', '#f0f0f5');
        root.style.setProperty('--bg-secondary', '#ffffff');
        root.style.setProperty('--bg-card', '#ffffff');
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#4a4a5e');
        dom.themeToggle.textContent = '☀️';
        dom.themeToggle.title = 'Переключить на тёмную тему';
    }
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 MusicHub v2.2 загружен');
    console.log(`📊 Режим: ${navigator.onLine ? 'Online' : 'Offline'}`);
    
    // Восстанавливаем громкость
    dom.audio.volume = state.volume;
    if (dom.volumeControl) {
        dom.volumeControl.value = state.volume;
    }
    
    // Загружаем стартовый поиск
    const savedQuery = loadFromCache('last_search');
    if (savedQuery) {
        dom.searchInput.value = savedQuery;
        searchMusic(savedQuery);
    } else {
        searchMusic('популярное');
    }
});

// Обработчик изменения сети
window.addEventListener('online', () => {
    showNotification('🌐 Сеть восстановлена', 'info', 3000);
});

window.addEventListener('offline', () => {
    showNotification('📡 Нет соединения, работаю офлайн', 'warning', 3000);
});

// Экспорт для консоли
window.musicHub = {
    search: searchMusic,
    play: playTrack,
    state: state,
    API: API
};
