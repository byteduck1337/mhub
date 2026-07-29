// ============================================================
// 🎵 MusicHub — Полная версия
// Версия: 2.0.0
// ============================================================

// ===== УНИКАЛЬНЫЙ ID ДЛЯ ОШИБОК =====
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

// ===== СОСТОЯНИЕ =====
let state = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    artistData: null,
    modalOpen: false
};

// ===== DOM =====
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

    player: $('#player'),
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
// 🔔 УВЕДОМЛЕНИЯ (без alert!)
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
// 🌐 API — РЕАЛЬНЫЙ ПАРСИНГ
// ============================================================

const API = {
    // Deezer — основной источник
    deezer: {
        search: async (query) => {
            const response = await fetch(
                `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=30`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getArtist: async (id) => {
            const response = await fetch(`https://api.deezer.com/artist/${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getArtistTracks: async (id) => {
            const response = await fetch(`https://api.deezer.com/artist/${id}/top?limit=20`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getAlbum: async (id) => {
            const response = await fetch(`https://api.deezer.com/album/${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getLyrics: async (trackId) => {
            // Deezer не даёт тексты, используем альтернативный источник
            return null;
        }
    },

    // Genius — для текстов песен и биографий
    genius: {
        search: async (query) => {
            // Используем CORS-прокси для Genius
            const url = `https://corsproxy.io/?https://api.genius.com/search?q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': 'Bearer ' + GENIUS_TOKEN
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        getLyrics: async (url) => {
            const response = await fetch(`https://corsproxy.io/?${url}`);
            const html = await response.text();
            // Парсим текст из HTML
            const match = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (match) {
                return match[1]
                    .replace(/<[^>]+>/g, '\n')
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .trim();
            }
            return null;
        }
    },

    // Last.fm — для биографий
    lastfm: {
        getArtistInfo: async (name) => {
            const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${LASTFM_KEY}&format=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    }
};

// ===== КЛЮЧИ API (зарегистрируй свои) =====
const GENIUS_TOKEN = 'YOUR_GENIUS_TOKEN'; // https://genius.com/api-clients
const LASTFM_KEY = 'YOUR_LASTFM_KEY';     // https://www.last.fm/api

// ============================================================
// 📦 ПАРСИНГ И ПОИСК
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
        // Пробуем Deezer
        const data = await API.deezer.search(query);
        
        if (!data.data || data.data.length === 0) {
            showNotification('Ничего не найдено. Попробуйте другой запрос', 'info');
            dom.tracksContainer.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
                    <div style="font-size:48px; margin-bottom:16px;">🎵</div>
                    <p style="font-size:18px; font-weight:600; color:var(--text-secondary);">Ничего не найдено</p>
                    <p>Попробуйте изменить запрос</p>
                </div>
            `;
            return;
        }

        // Парсим треки
        const tracks = data.data.map(item => ({
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

        // Парсим альбомы (уникальные)
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

        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;

        renderTracks(tracks);
        renderAlbums(Array.from(albumsMap.values()));

        dom.resultsCount.textContent = `${tracks.length} треков`;

        console.log(`[${errorId}] Успешно найдено ${tracks.length} треков`);

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        showNotification(`Ошибка поиска: ${error.message}`, 'error');
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px; font-weight:600; color:#ef4444;">Ошибка загрузки</p>
                <p>Код ошибки: ${errorId}</p>
                <p style="font-size:14px; margin-top:8px;">${error.message}</p>
            </div>
        `;
    }
}

// ============================================================
// 🎨 ОТОБРАЖЕНИЕ
// ============================================================

function renderTracks(tracks) {
    dom.tracksContainer.innerHTML = tracks.map((track, index) => `
        <div class="track-card" data-index="${index}">
            <img src="${track.cover}" alt="${track.name}" 
                 onerror="this.src='https://via.placeholder.com/300'" />
            <h3>${escapeHtml(track.name)}</h3>
            <p>${escapeHtml(track.artist)}</p>
            <span class="source-tag">${track.source}</span>
            <div class="actions">
                <button class="btn-play" data-index="${index}">▶ Слушать</button>
                <button class="btn-download" data-index="${index}">⬇ Скачать</button>
                <button class="btn-artist" data-artist="${escapeHtml(track.artist)}" data-artistid="${track.artistId}">👤</button>
            </div>
        </div>
    `).join('');

    // События
    dom.tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            playTrack(idx);
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            downloadTrack(idx);
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-artist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.artist;
            const id = btn.dataset.artistid;
            showArtist(name, id);
        });
    });

    // Клик по карточке
    dom.tracksContainer.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.index);
            playTrack(idx);
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
            const name = btn.dataset.artist;
            const id = btn.dataset.artistid;
            showArtist(name, id);
        });
    });
}

// ============================================================
// 👤 СТРАНИЦА ИСПОЛНИТЕЛЯ
// ============================================================

async function showArtist(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Запрос исполнителя: ${name} (ID: ${id})`);

    dom.artistSection.classList.remove('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dom.artistName.textContent = name;
    dom.artistInfo.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        // Получаем информацию об исполнителе
        let bio = 'Информация об исполнителе не найдена';
        let stats = { listeners: '?', plays: '?' };

        try {
            // Пробуем Last.fm
            const lastfmData = await API.lastfm.getArtistInfo(name);
            if (lastfmData && lastfmData.artist) {
                bio = lastfmData.artist.bio?.content || bio;
                stats.listeners = lastfmData.artist.stats?.listeners || '?';
                stats.plays = lastfmData.artist.stats?.playcount || '?';
                // Очищаем HTML
                bio = bio.replace(/<[^>]+>/g, '').trim();
                if (bio.length > 500) bio = bio.slice(0, 500) + '...';
            }
        } catch (e) {
            console.log('Last.fm не сработал, пробуем другой источник');
        }

        // Получаем треки исполнителя через Deezer
        let tracks = [];
        try {
            const data = await API.deezer.getArtistTracks(id);
            tracks = data.data.map(item => ({
                id: item.id,
                name: item.title,
                artist: item.artist.name,
                artistId: item.artist.id,
                album: item.album.title,
                cover: item.album.cover_medium || 'https://via.placeholder.com/300',
                audio: item.preview,
                duration: item.duration,
                source: 'Deezer'
            }));
        } catch (e) {
            console.log('Не удалось получить треки исполнителя');
        }

        dom.artistInfo.innerHTML = `
            <div class="bio">${escapeHtml(bio)}</div>
            <div class="stats">
                <span>👂 Слушают: <strong>${stats.listeners}</strong></span>
                <span>▶ Прослушиваний: <strong>${stats.plays}</strong></span>
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
                        <button class="btn-play-artist" data-index="${idx}">▶ Слушать</button>
                        <button class="btn-download-artist" data-index="${idx}">⬇ Скачать</button>
                    </div>
                </div>
            `).join('');

            // Сохраняем треки исполнителя в состояние
            state.artistTracks = tracks;

            dom.artistTracks.querySelectorAll('.btn-play-artist').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index);
                    // Добавляем треки исполнителя в плейлист
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
            dom.artistTracks.innerHTML = '<p style="color:var(--text-muted);">Нет треков для отображения</p>';
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
// ▶️ ПЛЕЕР
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
            console.error(`[${errorId}] Ошибка воспроизведения:`, err);
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
// 📝 ТЕКСТ ПЕСНИ
// ============================================================

async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    const errorId = `${ERROR_CODES.LYRICS_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Запрос текста: ${track.name} - ${track.artist}`);

    dom.modalTitle.textContent = `📝 ${track.name}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        // Ищем через Genius
        const searchUrl = `https://corsproxy.io/?https://api.genius.com/search?q=${encodeURIComponent(track.name + ' ' + track.artist)}`;
        const response = await fetch(searchUrl, {
            headers: { 'Authorization': 'Bearer ' + GENIUS_TOKEN }
        });
        const data = await response.json();

        let lyrics = 'Текст не найден 😔\n\nПопробуйте найти вручную на сайте Genius.';

        if (data.response && data.response.hits && data.response.hits.length > 0) {
            const url = data.response.hits[0].result.url;
            // Парсим страницу Genius
            const htmlRes = await fetch(`https://corsproxy.io/?${url}`);
            const html = await htmlRes.text();
            
            // Ищем текст
            const match = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/i);
            if (match) {
                lyrics = match[1]
                    .replace(/<[^>]+>/g, '\n')
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/<br\s*\/?>/gi, '\n')
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
                <br><small>Код ошибки: ${errorId}</small>
                <br><br>Попробуйте найти текст на <a href="https://genius.com" target="_blank" style="color:var(--accent);">Genius.com</a>
            </div>
        `;
    }
}

// ============================================================
// ⬇️ СКАЧИВАНИЕ
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
        showNotification('🔇 Ссылка для скачивания недоступна', 'info', 3000);
        // Скачиваем информацию о треке
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
        showNotification(`⚠️ Ошибка скачивания: ${error.message}`, 'error', 4000);
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

━━━━━━━━━━━━━━━━━━━━━━━━━━
Скачано с MusicHub
`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${track.artist} - ${track.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification('📄 Информация о треке сохранена', 'info', 3000);
}

function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Плейлист пуст. Сначала найдите музыку.', 'info');
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
// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
// 🎛️ СОБЫТИЯ ПЛЕЕРА
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
    // Автоматически следующий
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
    showNotification(`⚠️ Ошибка воспроизведения (${errorId})`, 'error', 4000);
});

// ============================================================
// 🔍 ПОИСК
// ============================================================

dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchMusic(dom.searchInput.value);
});

// ============================================================
// 🔙 НАЗАД К ПОИСКУ
// ============================================================

dom.backBtn.addEventListener('click', () => {
    dom.artistSection.classList.add('hidden');
    dom.artistSection.scrollIntoView({ behavior: 'smooth' });
});

// ============================================================
// 📝 ТЕКСТ ПЕСНИ
// ============================================================

dom.showLyrics.addEventListener('click', showLyrics);

// ============================================================
// ⬇️ СКАЧИВАНИЕ
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
// 🎨 МОДАЛЬНОЕ ОКНО
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
// 🌙 ТЕМА (светлая/тёмная)
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
// 🚀 ЗАПУСК
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 MusicHub v2.0 загружен');
    console.log('🔧 Для отладки используй console.log с кодами ошибок');
    searchMusic('популярное');
});