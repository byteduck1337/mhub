// ============================================================
// 🎵 MusicHub v2.1 - FIX CORS
// ============================================================

// FIX: Уникальный ID для ошибок
const ERROR_CODES = {
    SEARCH_FAILED: 'ERR_SEARCH_001',
    PLAYBACK_FAILED: 'ERR_PLAY_001',
    DOWNLOAD_FAILED: 'ERR_DOWN_001',
    LYRICS_FAILED: 'ERR_LYRICS_001',
    API_TIMEOUT: 'ERR_API_001',
    NO_AUDIO: 'ERR_AUDIO_001',
    ARTIST_NOT_FOUND: 'ERR_ARTIST_001',
    NETWORK_ERROR: 'ERR_NET_001'
};

// STATE
let state = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    artistData: null,
    modalOpen: false
};

// DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    searchInput: $('#searchInput'),
    searchBtn: $('#searchBtn'),
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
    audio: $('#audioPlayer'),
    downloadTrack: $('#downloadTrackBtn'),
    downloadPlaylist: $('#downloadPlaylistBtn'),
    showLyrics: $('#showLyricsBtn'),
    modal: $('#modal'),
    modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'),
    modalClose: $('#modalClose'),
    notification: $('#notification'),
    themeToggle: $('#themeToggle')
};

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

function showNotification(message, type = 'info', duration = 4000) {
    const el = dom.notification;
    el.textContent = message;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

// ============================================================
// API CONFIG - FIX: Используем Jamendo (бесплатно, нет CORS)
// ============================================================

const JAMENDO_KEY = 'e0f5b4f3'; // Публичный ключ

const API = {
    // FIX: Jamendo - работает без CORS
    jamendo: {
        searchTracks: async (query) => {
            const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_KEY}&format=json&limit=30&search=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        searchAlbums: async (query) => {
            const url = `https://api.jamendo.com/v3.0/albums/?client_id=${JAMENDO_KEY}&format=json&limit=12&search=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getArtistTracks: async (artistId) => {
            const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_KEY}&format=json&limit=20&artist_id=${artistId}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    },
    // FIX: Deezer через прокси (запасной вариант)
    deezer: {
        search: async (query) => {
            const url = `https://corsproxy.io/?https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=30`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    }
};

// ============================================================
// SEARCH ENGINE - FIX: Используем Jamendo
// ============================================================

async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.SEARCH_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Поиск: "${query}"`);

    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
        </div>
    `;
    dom.albumsContainer.innerHTML = '';
    dom.artistSection.classList.add('hidden');
    dom.resultsTitle.textContent = `🔍 "${query}"`;

    try {
        // FIX: Пробуем Jamendo (работает без CORS)
        let tracks = [];
        let albums = [];

        try {
            const trackData = await API.jamendo.searchTracks(query);
            const albumData = await API.jamendo.searchAlbums(query);

            tracks = (trackData.results || []).map(item => ({
                id: item.id,
                name: item.name,
                artist: item.artist_name,
                artistId: item.artist_id,
                album: item.album_name || 'Альбом',
                albumId: item.album_id || 0,
                cover: item.image || 'https://via.placeholder.com/300',
                audio: item.audio || item.url,
                duration: item.duration || 0,
                source: 'Jamendo',
                type: 'track'
            }));

            albums = (albumData.results || []).map(item => ({
                id: item.id,
                name: item.name,
                artist: item.artist_name,
                artistId: item.artist_id,
                cover: item.image || 'https://via.placeholder.com/300',
                tracks: item.tracks_count || 0,
                type: 'album'
            }));

        } catch (e) {
            console.log('Jamendo error, trying Deezer...');
            // FIX: Пробуем Deezer через прокси
            try {
                const data = await API.deezer.search(query);
                if (data.data && data.data.length > 0) {
                    tracks = data.data.map(item => ({
                        id: item.id,
                        name: item.title,
                        artist: item.artist.name,
                        artistId: item.artist.id,
                        album: item.album.title,
                        albumId: item.album.id,
                        cover: item.album.cover_medium || 'https://via.placeholder.com/300',
                        audio: item.preview,
                        duration: item.duration,
                        source: 'Deezer',
                        type: 'track'
                    }));

                    const albumsMap = new Map();
                    data.data.forEach(item => {
                        if (!albumsMap.has(item.album.id)) {
                            albumsMap.set(item.album.id, {
                                id: item.album.id,
                                name: item.album.title,
                                artist: item.artist.name,
                                artistId: item.artist.id,
                                cover: item.album.cover_medium || 'https://via.placeholder.com/300',
                                tracks: item.album.nb_tracks || 0,
                                type: 'album'
                            });
                        }
                    });
                    albums = Array.from(albumsMap.values());
                }
            } catch (e2) {
                console.log('All APIs failed');
            }
        }

        // FIX: Если ничего не нашлось - демо-данные
        if (tracks.length === 0) {
            tracks = getDemoTracks(query);
            albums = getDemoAlbums(query);
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
        showNotification(`Ошибка поиска: ${error.message}`, 'error');
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px; font-weight:600; color:#ef4444;">Ошибка загрузки</p>
                <p>Код ошибки: ${errorId}</p>
                <p style="font-size:14px; margin-top:8px;">${error.message}</p>
                <button onclick="searchMusic('популярное')" style="margin-top:20px; padding:10px 30px; background:var(--accent); border:none; border-radius:10px; color:#fff; cursor:pointer;">Попробовать снова</button>
            </div>
        `;
    }
}

// ============================================================
// DEMO DATA (fix: если API не работают)
// ============================================================

function getDemoTracks(query) {
    const demos = [
        { name: 'Тёмный принц', artist: 'Алексей Воробьёв' },
        { name: 'Принц и нищий', artist: 'Владимир Высоцкий' },
        { name: 'Тёмная ночь', artist: 'Марк Бернес' },
        { name: 'Prince', artist: 'The Weeknd' },
        { name: 'Dark Prince', artist: 'Eminem' },
        { name: 'Purple Rain', artist: 'Prince' },
        { name: 'Bohemian Rhapsody', artist: 'Queen' },
        { name: 'Stairway to Heaven', artist: 'Led Zeppelin' }
    ];

    const filtered = demos.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map((d, i) => ({
        id: i + 1,
        name: d.name,
        artist: d.artist,
        artistId: i + 1,
        album: 'Сборник',
        albumId: i + 1,
        cover: `https://picsum.photos/seed/${i+1}/300/300`,
        audio: null,
        duration: 180 + i * 30,
        source: 'Demo',
        type: 'track',
        isDemo: true
    }));
}

function getDemoAlbums(query) {
    const demos = [
        { name: 'Лучшие хиты', artist: 'Макс Корж' },
        { name: 'Тёмная сторона', artist: 'Руки Вверх' },
        { name: 'Prince of Darkness', artist: 'Ozzy Osbourne' },
        { name: 'Greatest Hits', artist: 'Queen' }
    ];

    const filtered = demos.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map((d, i) => ({
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
// RENDER FUNCTIONS
// ============================================================

function renderTracks(tracks) {
    dom.tracksContainer.innerHTML = tracks.map((track, index) => `
        <div class="track-card" data-index="${index}">
            <img src="${track.cover}" alt="${track.name}" 
                 onerror="this.src='https://via.placeholder.com/300'" />
            <h3>${escapeHtml(track.name)}</h3>
            <p>${escapeHtml(track.artist)}</p>
            ${track.isDemo ? '<span class="source-tag" style="background:#ff6b6b;color:#fff;">DEMO</span>' : `<span class="source-tag">${track.source}</span>`}
            <div class="actions">
                <button class="btn-play" data-index="${index}">${track.audio ? '▶' : '🎵'} ${track.audio ? 'Слушать' : 'Демо'}</button>
                <button class="btn-download" data-index="${index}">⬇ Скачать</button>
                <button class="btn-artist" data-artist="${escapeHtml(track.artist)}" data-artistid="${track.artistId}">👤</button>
            </div>
        </div>
    `).join('');

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
    });
}

function renderAlbums(albums) {
    if (!albums.length) {
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
                 onerror="this.src='https://via.placeholder.com/300'" />
            <h3>${escapeHtml(album.name)}</h3>
            <p>${escapeHtml(album.artist)}</p>
            <span style="font-size:12px; color:var(--text-muted);">${album.tracks} треков</span>
            <div class="actions" style="margin-top:10px;">
                <button class="btn-artist" data-artist="${escapeHtml(album.artist)}" data-artistid="${album.artistId}">👤 ${escapeHtml(album.artist)}</button>
            </div>
        </div>
    `).join('');

    dom.albumsContainer.querySelectorAll('.btn-artist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtist(btn.dataset.artist, btn.dataset.artistid);
        });
    });
}

// ============================================================
// ARTIST PAGE
// ============================================================

async function showArtist(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Запрос исполнителя: ${name}`);

    dom.artistSection.classList.remove('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dom.artistName.textContent = name;
    dom.artistInfo.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        let bio = 'Информация об исполнителе не найдена';

        // FIX: Пробуем получить треки через Jamendo
        let tracks = [];
        try {
            const data = await API.jamendo.getArtistTracks(id);
            if (data.results) {
                tracks = data.results.map(item => ({
                    id: item.id,
                    name: item.name,
                    artist: item.artist_name,
                    artistId: item.artist_id,
                    album: item.album_name || 'Альбом',
                    cover: item.image || 'https://via.placeholder.com/300',
                    audio: item.audio || item.url,
                    duration: item.duration || 0,
                    source: 'Jamendo'
                }));
            }
        } catch (e) {
            console.log('Не удалось получить треки');
        }

        dom.artistInfo.innerHTML = `
            <div class="bio">${escapeHtml(bio)}</div>
            <div class="stats">
                <span>🎵 Треков: <strong>${tracks.length}</strong></span>
            </div>
        `;

        if (tracks.length) {
            dom.artistTracks.innerHTML = tracks.map((track, idx) => `
                <div class="track-card" style="grid-column:span 1;">
                    <img src="${track.cover}" alt="${track.name}" 
                         onerror="this.src='https://via.placeholder.com/300'" />
                    <h3>${escapeHtml(track.name)}</h3>
                    <p>${escapeHtml(track.artist)}</p>
                    <span class="source-tag">${track.source}</span>
                    <div class="actions">
                        <button class="btn-play-artist" data-index="${idx}">${track.audio ? '▶' : '🎵'} ${track.audio ? 'Слушать' : 'Демо'}</button>
                        <button class="btn-download-artist" data-index="${idx}">⬇ Скачать</button>
                    </div>
                </div>
            `).join('');

            state.artistTracks = tracks;

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
            dom.artistTracks.innerHTML = '<p style="color:var(--text-muted);">Нет треков</p>';
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
// PLAYER
// ============================================================

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
            showNotification(`▶ ${track.name} — ${track.artist}`, 'info', 2000);
        })
        .catch((err) => {
            const errorId = `${ERROR_CODES.PLAYBACK_FAILED}_${Date.now()}`;
            console.error(`[${errorId}] Ошибка:`, err);
            showNotification(`⚠️ Не удалось воспроизвести (${errorId})`, 'error', 4000);
            dom.playBtn.textContent = '▶';
            state.isPlaying = false;
        });

    updatePlayerInfo(track);
}

function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Без названия';
    dom.playerArtist.textContent = track.artist || 'Неизвестный';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
}

// ============================================================
// LYRICS
// ============================================================

async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.LYRICS_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Запрос текста: ${track.name}`);

    dom.modalTitle.textContent = `📝 ${track.name}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        // FIX: Пробуем Genius через прокси
        const searchUrl = `https://corsproxy.io/?https://api.genius.com/search?q=${encodeURIComponent(track.name + ' ' + track.artist)}`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        let lyrics = 'Текст не найден 😔';

        if (data.response && data.response.hits && data.response.hits.length > 0) {
            const url = data.response.hits[0].result.url;
            const htmlRes = await fetch(`https://corsproxy.io/?${url}`);
            const html = await htmlRes.text();
            
            const match = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/i);
            if (match) {
                lyrics = match[1]
                    .replace(/<[^>]+>/g, '\n')
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .trim();
                lyrics = lyrics.split('\n').filter(line => line.trim()).join('\n');
            }
        }

        dom.modalBody.innerHTML = lyrics.split('\n').map(line => 
            `<div class="lyrics-line">${escapeHtml(line) || ' '}</div>`
        ).join('');

        console.log(`[${errorId}] Текст загружен`);

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        dom.modalBody.innerHTML = `
            <div style="color:#ef4444;">
                ❌ Не удалось загрузить текст
                <br><small>Код: ${errorId}</small>
                <br><br>Попробуйте найти текст на <a href="https://genius.com" target="_blank" style="color:var(--accent);">Genius.com</a>
            </div>
        `;
    }
}

// ============================================================
// DOWNLOAD
// ============================================================

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
        showNotification('🔇 Ссылка недоступна', 'info', 3000);
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
        showNotification(`✅ ${track.name} — скачивается`, 'success', 3000);
        console.log(`[${errorId}] Скачивание начато`);
    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
        downloadTrackInfo(track);
    }
}

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

    showNotification(`✅ Плейлист (${state.playlist.length} треков) сохранён`, 'success', 3000);
    console.log(`[${errorId}] Плейлист скачан`);
}

// ============================================================
// UTILITIES
// ============================================================

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

// ============================================================
// PLAYER EVENTS
// ============================================================

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
    console.error(`[${errorId}] Ошибка аудио:`, e);
    dom.playBtn.textContent = '▶';
    state.isPlaying = false;
    showNotification(`⚠️ Ошибка (${errorId})`, 'error', 4000);
});

// ============================================================
// SEARCH EVENTS
// ============================================================

dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchMusic(dom.searchInput.value);
});

// ============================================================
// BACK TO SEARCH
// ============================================================

dom.backBtn.addEventListener('click', () => {
    dom.artistSection.classList.add('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth' });
});

// ============================================================
// LYRICS BUTTON
// ============================================================

dom.showLyrics.addEventListener('click', showLyrics);

// ============================================================
// DOWNLOAD BUTTONS
// ============================================================

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

// ============================================================
// MODAL
// ============================================================

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
});

// ============================================================
// THEME TOGGLE
// ============================================================

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

// ============================================================
// INIT
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 MusicHub v2.1 - CORS FIX');
    searchMusic('популярное');
});
