// ===== CONFIG & STATE =====
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
    YOUTUBE_API_KEY: 'YOUR_YOUTUBE_API_KEY',
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
    searchHistory: JSON.parse(localStorage.getItem('mh_history') || '[]'),
    volume: 0.8,
    isDownloading: false,
    user: null,
    likedTracks: JSON.parse(localStorage.getItem('mh_liked') || '[]'),
    history: JSON.parse(localStorage.getItem('mh_history') || '[]'),
    playlists: JSON.parse(localStorage.getItem('mh_playlists') || '[]')
};

const dom = {};

// ===== UTILS =====
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

function initDom() {
    const elements = [
        'searchInput', 'searchBtn', 'searchHistory',
        'tracksContainer', 'albumsContainer',
        'resultsTitle', 'resultsCount',
        'homeView', 'artistView', 'profileView',
        'artAvatar', 'artName', 'artStats', 'artPlayBtn', 'artLikeBtn', 'artTrackList', 'artRelease',
        'mpCover', 'mpTitle', 'mpArtist', 'playBtn', 'prevBtn', 'nextBtn', 'progBar', 'curTime', 'totTime',
        'likeBtn', 'expandBtn', 'audio', 'fsPlayer', 'fsBg', 'fsImg', 'fsTitle', 'fsArtist',
        'fsPlay', 'fsPrev', 'fsNext', 'fsProg', 'fsCur', 'fsTot', 'fsDownloadBtn',
        'profileModal', 'modalTitle', 'modalClose', 'profileForm', 'username', 'email',
        'profileName', 'profileLikes', 'profileHistory', 'profileAvatar', 'profileAvatar',
        'likedTracksList', 'historyList', 'userAvatar', 'userMenu', 'logoutBtn', 'profileLink'
    ];
    elements.forEach(id => {
        dom[id] = document.getElementById(id);
        if (!dom[id]) console.warn(`Element #${id} not found in DOM`);
    });
    return dom;
}

function showNotification(message, type = 'info', duration = 4000) {
    const t = dom.toast;
    t.textContent = message;
    t.className = `toast ${type}`;
    t.classList.remove('hidden');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add('hidden'), duration);
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

function isUserLoggedIn() {
    return state.user !== null;
}

function initUser() {
    const user = localStorage.getItem('mh_user');
    if (user) {
        state.user = JSON.parse(user);
        updateProfileUI();
    }
}

function saveUser(user) {
    localStorage.setItem('mh_user', JSON.stringify(user));
    state.user = user;
    updateProfileUI();
}

function updateProfileUI() {
    if (!isUserLoggedIn()) {
        dom.userAvatar.textContent = '👤';
        dom.profileName.textContent = 'Гость';
        dom.profileLikes.textContent = '0';
        dom.profileHistory.textContent = '0';
        return;
    }
    
    dom.userAvatar.textContent = state.user.name.charAt(0);
    dom.profileName.textContent = state.user.name;
    dom.profileLikes.textContent = state.likedTracks.length;
    dom.profileHistory.textContent = state.history.length;
}

function logout() {
    state.user = null;
    localStorage.removeItem('mh_user');
    updateProfileUI();
    showNotification('Вы вышли из аккаунта', 'info', 2000);
}

// ===== NAVIGATION =====
function showHome() {
    dom.homeView.classList.add('active');
    dom.artistView.classList.add('hidden');
    dom.profileView.classList.add('hidden');
}

function showArtist(name) {
    dom.homeView.classList.remove('active');
    dom.artistView.classList.remove('hidden');
    dom.profileView.classList.add('hidden');
    loadArtistData(name);
}

function showProfile() {
    if (!isUserLoggedIn()) {
        dom.profileModal.classList.remove('hidden');
        return;
    }
    dom.homeView.classList.add('hidden');
    dom.artistView.classList.add('hidden');
    dom.profileView.classList.remove('hidden');
    loadProfileData();
}

function loadProfileData() {
    // Update liked tracks
    dom.likedTracksList.innerHTML = state.likedTracks.map((track, index) => `
        <div class="tl-item" onclick="playTrack(${index})">
            <span class="tl-num">${String(index + 1).padStart(2, '0')}</span>
            <img src="${track.cover}" class="tl-img">
            <div class="tl-info">
                <div class="tl-name">${track.name}</div>
                <div class="tl-sub">${track.artist}</div>
            </div>
            <span class="tl-dur">${formatTime(track.duration)}</span>
            <button class="tl-play" onclick="event.stopPropagation(); playTrack(${index})">▶</button>
        </div>
    `).join('');

    // Update history
    dom.historyList.innerHTML = state.history.slice(-10).reverse().map((track, index) => `
        <div class="tl-item" onclick="playTrack(${index})">
            <span class="tl-num">${String(index + 1).padStart(2, '0')}</span>
            <img src="${track.cover}" class="tl-img">
            <div class="tl-info">
                <div class="tl-name">${track.name}</div>
                <div class="tl-sub">${track.artist}</div>
            </div>
            <span class="tl-dur">${formatTime(track.duration)}</span>
            <button class="tl-play" onclick="event.stopPropagation(); playTrack(${index})">▶</button>
        </div>
    `).join('');
}

// ===== SEARCH LOGIC =====
dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
dom.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchMusic(dom.searchInput.value);
});

async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Введите запрос для поиска', 'info');
        return;
    }
    
    if (!isUserLoggedIn()) {
        showNotification('Пожалуйста, авторизуйтесь для поиска', 'warning', 3000);
        dom.profileModal.classList.remove('hidden');
        return;
    }

    // Save history
    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
        localStorage.setItem('mh_history', JSON.stringify(state.searchHistory));
        updateSearchHistory();
    }

    dom.resultsTitle.textContent = `🔍 "${escapeHtml(query)}"`;
    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p style="margin-top:10px;color:var(--text-muted);">Ищем треки...</p>
        </div>
    `;
    dom.albumsContainer.innerHTML = '';

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
            // Jamendo API
            try {
                const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${API_CONFIG.JAMENDO_KEY}&format=json&limit=${API_CONFIG.MAX_TRACKS}&search=${encodeURIComponent(query)}`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const jamendoTracks = data.results.map(track => ({
                        id: track.id,
                        name: track.name,
                        artist: track.artist_name,
                        artistId: track.artist_id,
                        album: track.album_name,
                        albumId: track.album_id,
                        cover: track.image ? track.image.replace('/static/', '/static/300/') : 'https://via.placeholder.com/300',
                        audio: track.audio,
                        duration: track.duration,
                        source: 'Jamendo',
                        downloadUrl: track.audiodownload
                    }));
                    tracks = tracks.concat(jamendoTracks);
                    
                    // Process albums
                    const albumsMap = new Map();
                    data.results.forEach(track => {
                        if (track.album_id && !albumsMap.has(track.album_id)) {
                            albumsMap.set(track.album_id, {
                                id: track.album_id,
                                name: track.album_name,
                                artist: track.artist_name,
                                artistId: track.artist_id,
                                cover: track.image ? track.image.replace('/static/', '/static/300/') : 'https://via.placeholder.com/300',
                                tracks: 1
                            });
                        } else if (track.album_id) {
                            albumsMap.get(track.album_id).tracks++;
                        }
                    });
                    albums = Array.from(albumsMap.values());
                }
            } catch (e) { console.debug('Jamendo не сработал:', e); }

            // Fallback to demo if no results
            if (tracks.length === 0) {
                showNotification('Ничего не найдено', 'warning');
                dom.tracksContainer.innerHTML = `<p style="text-align:center;padding:40px;">Ничего не найдено</p>`;
                return;
            }
        }

        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;
        
        renderTracks(tracks);
        renderAlbums(albums);
        dom.resultsCount.textContent = `${tracks.length} треков`;
        
    } catch (error) {
        console.error('Search error:', error);
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
        dom.tracksContainer.innerHTML = `
            <div style="text-align:center;padding:40px;">
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

function renderTracks(list) {
    dom.tracksContainer.innerHTML = list.map((track, index) => `
        <div class="track-card" data-index="${index}" role="button" tabindex="0">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" onerror="this.src='https://via.placeholder.com/300'">
            <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
            <p class="artist-link" title="${escapeHtml(track.artist)}" onclick="event.stopPropagation(); showArtist('${escapeHtml(track.artist)}')">
                ${escapeHtml(track.artist)}
            </p>
            <div class="actions">
                <button class="btn-sm btn-play-sm" data-index="${index}">
                    ▶ Слушать
                </button>
                <button class="btn-sm btn-dl-sm" data-index="${index}" ${!track.downloadUrl ? 'disabled' : ''}>
                    ⬇ Скачать
                </button>
            </div>
        </div>
    `).join('');

    dom.tracksContainer.querySelectorAll('.btn-play-sm').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playTrack(parseInt(btn.dataset.index));
        });
    });

    dom.tracksContainer.querySelectorAll('.btn-dl-sm:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadTrack(parseInt(btn.dataset.index));
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

function renderAlbums(list) {
    dom.albumsContainer.innerHTML = list.map(album => `
        <div class="track-card">
            <img src="${album.cover}" alt="${escapeHtml(album.name)}" onerror="this.src='https://via.placeholder.com/300'">
            <h3 title="${escapeHtml(album.name)}">${escapeHtml(album.name)}</h3>
            <p class="artist-link" title="${escapeHtml(album.artist)}" onclick="event.stopPropagation(); showArtist('${escapeHtml(album.artist)}')">
                ${escapeHtml(album.artist)}
            </p>
            <span style="font-size:12px;color:var(--text-sub);">${album.tracks} треков</span>
        </div>
    `).join('');
}

// ===== ARTIST PAGE =====
async function loadArtistData(name) {
    dom.artName.textContent = name;
    dom.artAvatar.src = `https://picsum.photos/seed/${name}/400/400`;
    dom.artTrackList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
        // Get artist info from Last.fm
        let bio = '';
        let stats = { listeners: '?', plays: '?' };
        try {
            const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${API_CONFIG.LASTFM_KEY}&format=json`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                bio = data.artist?.bio?.content || '';
                stats.listeners = data.artist?.stats?.listeners || '?';
                stats.plays = data.artist?.stats?.playcount || '?';
                bio = bio.replace(/<[^>]+>/g, '').trim();
                if (bio.length > 500) bio = bio.slice(0, 500) + '...';
            }
        } catch (e) { console.debug('Last.fm не сработал:', e); }
        
        // Get tracks from Jamendo
        const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${API_CONFIG.JAMENDO_KEY}&format=json&limit=${API_CONFIG.MAX_TRACKS}&artist_name=${encodeURIComponent(name)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const tracks = data.results.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artist_name,
            artistId: track.artist_id,
            album: track.album_name,
            albumId: track.album_id,
            cover: track.image ? track.image.replace('/static/', '/static/300/') : 'https://via.placeholder.com/300',
            audio: track.audio,
            duration: track.duration,
            source: 'Jamendo',
            downloadUrl: track.audiodownload
        }));

        state.artistTracks = tracks;
        state.tracks = tracks;
        state.playlist = tracks;
        state.currentIndex = 0;
        
        // Render tracks
        dom.artTrackList.innerHTML = tracks.map((track, idx) => `
            <div class="tl-item" onclick="playArtistTrack(${idx})">
                <span class="tl-num">${String(idx + 1).padStart(2, '0')}</span>
                <img src="${track.cover}" class="tl-img">
                <div class="tl-info">
                    <div class="tl-name">${track.name}</div>
                    <div class="tl-sub">${track.album}</div>
                </div>
                <span class="tl-dur">${formatTime(track.duration)}</span>
                <button class="tl-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
            </div>
        `).join('');

        // Update stats
        const listenersFormatted = formatNumber(parseInt(stats.listeners) || 0);
        dom.artStats.textContent = `${listenersFormatted} слушателей в месяц`;
        dom.artPlayBtn.onclick = () => playArtistTrack(0);
        dom.artLikeBtn.onclick = () => toggleArtistFollow(name);
        
        // Set follow status
        dom.artLikeBtn.textContent = isArtistFollowed(name) ? '❤️' : '♡';
        
        // Update release card
        if (tracks.length > 0) {
            const latest = tracks[0];
            dom.artRelease.innerHTML = `
                <img src="${latest.cover}">
                <div class="rel-info">
                    <h4>${latest.album}</h4>
                    <p>Сингл · 2024</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Artist error:', error);
        dom.artTrackList.innerHTML = '<p style="text-align:center;padding:20px;">Ошибка загрузки треков</p>';
    }
}

function playArtistTrack(index) {
    if (state.artistTracks && state.artistTracks[index]) {
        state.tracks = state.artistTracks;
        state.playlist = state.artistTracks;
        playTrack(index);
    }
}

function isArtistFollowed(name) {
    return state.playlists.some(p => p.name === name && p.type === 'artist');
}

function toggleArtistFollow(name) {
    if (isArtistFollowed(name)) {
        state.playlists = state.playlists.filter(p => !(p.name === name && p.type === 'artist'));
        dom.artLikeBtn.textContent = '♡';
        showNotification('Отписка от исполнителя', 'info', 2000);
    } else {
        state.playlists.push({ name, type: 'artist' });
        dom.artLikeBtn.textContent = '❤️';
        showNotification(`❤️ Вы подписались на ${name}`, 'success', 2000);
    }
    localStorage.setItem('mh_playlists', JSON.stringify(state.playlists));
}

// ===== PLAYER =====
function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }
    state.currentIndex = index;
    state.currentTrack = track;
    
    // Update history
    if (!state.history.some(t => t.id === track.id)) {
        state.history.push(track);
        localStorage.setItem('mh_history', JSON.stringify(state.history));
    }
    
    // Update UI
    dom.mpCover.src = track.cover;
    dom.mpTitle.textContent = track.name;
    dom.mpArtist.textContent = track.artist;
    updateLikeBtn();
    
    // Audio logic
    const audio = dom.audio;
    audio.src = track.audio;
    audio.load();
    
    try {
        audio.play().then(() => {
            state.isPlaying = true;
            dom.playBtn.textContent = '⏸';
            showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
        }).catch(() => {
            showNotification('⚠️ Ошибка воспроизведения', 'error', 4000);
        });
    } catch (error) {
        console.error('Playback error:', error);
        showNotification('⚠️ Ошибка воспроизведения', 'error', 4000);
    }
}

function togglePlay() {
    const audio = dom.audio;
    if (audio.paused) {
        audio.play().then(() => {
            state.isPlaying = true;
            dom.playBtn.textContent = '⏸';
        }).catch(() => {
            showNotification('⚠️ Ошибка воспроизведения', 'error', 4000);
        });
    } else {
        audio.pause();
        state.isPlaying = false;
        dom.playBtn.textContent = '▶';
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

function updateLikeBtn() {
    const isLiked = state.likedTracks.some(t => t.id === state.currentTrack?.id);
    dom.likeBtn.textContent = isLiked ? '❤️' : '🤍';
}

function toggleLike() {
    if (!state.currentTrack) return;
    const isLiked = state.likedTracks.some(t => t.id === state.currentTrack.id);
    
    if (isLiked) {
        state.likedTracks = state.likedTracks.filter(t => t.id !== state.currentTrack.id);
        dom.likeBtn.textContent = '🤍';
        showNotification('Лайк убран', 'info', 2000);
    } else {
        state.likedTracks.push(state.currentTrack);
        dom.likeBtn.textContent = '❤️';
        showNotification('❤️ Добавлено в любимое', 'success', 2000);
    }
    localStorage.setItem('mh_liked', JSON.stringify(state.likedTracks));
}

function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track || !track.downloadUrl) {
        showNotification('Скачивание недоступно', 'info', 2000);
        return;
    }
    
    try {
        // Create download link
        const link = document.createElement('a');
        link.href = track.downloadUrl;
        link.download = `${track.artist} - ${track.name}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`✅ Скачано: ${track.name}`, 'success', 2000);
    } catch (error) {
        console.error('Download error:', error);
        showNotification('⚠️ Ошибка скачивания', 'error', 4000);
    }
}

// ===== FULLSCREEN PLAYER =====
function openFullscreen() {
    if (!state.currentTrack) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }
    dom.fsPlayer.classList.remove('hidden');
    dom.fsImg.src = state.currentTrack.cover;
    dom.fsTitle.textContent = state.currentTrack.name;
    dom.fsArtist.textContent = state.currentTrack.artist;
    dom.fsBg.style.backgroundImage = `url(${state.currentTrack.cover})`;
}

function closeFullscreen() {
    dom.fsPlayer.classList.add('hidden');
}

// ===== USER AUTHENTICATION =====
dom.profileForm?.addEventListener('submit', e => {
    e.preventDefault();
    const username = dom.username.value;
    const email = dom.email.value;
    
    if (!username || !email) {
        showNotification('Пожалуйста, заполните все поля', 'error', 3000);
        return;
    }
    
    const user = { name: username, email, createdAt: new Date().toISOString() };
    saveUser(user);
    dom.profileModal.classList.add('hidden');
    showNotification(`Добро пожаловать, ${username}!`, 'success', 3000);
});

dom.logoutBtn?.addEventListener('click', () => {
    logout();
    showHome();
});

dom.profileLink?.addEventListener('click', () => {
    if (isUserLoggedIn()) {
        showProfile();
    } else {
        dom.profileModal.classList.remove('hidden');
    }
});

// ===== SETUP UI =====
function setupUI() {
    // Event listeners
    dom.playBtn?.addEventListener('click', togglePlay);
    dom.prevBtn?.addEventListener('click', prevTrack);
    dom.nextBtn?.addEventListener('click', nextTrack);
    dom.likeBtn?.addEventListener('click', toggleLike);
    dom.expandBtn?.addEventListener('click', openFullscreen);
    dom.fsDownloadBtn?.addEventListener('click', () => {
        if (state.currentTrack) {
            const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
            if (idx !== -1) downloadTrack(idx);
        }
    });
    
    // Audio events
    dom.audio?.addEventListener('timeupdate', () => {
        const audio = dom.audio;
        if (audio.duration && !isNaN(audio.duration)) {
            dom.progBar.value = (audio.currentTime / audio.duration) * 100;
            dom.curTime.textContent = formatTime(audio.currentTime);
            dom.totTime.textContent = formatTime(audio.duration);
        }
    });
    
    dom.progBar?.addEventListener('input', () => {
        const audio = dom.audio;
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (dom.progBar.value / 100) * audio.duration;
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
        if (e.key === 'ArrowLeft') prevTrack();
        if (e.key === 'ArrowRight') nextTrack();
        if (e.key === 'Escape') closeFullscreen();
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    setupUI();
    initUser();
    
    // Initial search
    if (isUserLoggedIn()) {
        searchMusic('популярное');
    } else {
        dom.profileModal.classList.remove('hidden');
    }
    
    console.log('🎵 MusicHub v3.0 загружен');
    console.log(`📊 Режим: ${isUserLoggedIn() ? 'Logged In' : 'Guest'}`);
});
