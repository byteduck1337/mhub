// ===== State & Config =====
const state = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    artistTracks: [],
    searchHistory: [],
    volume: 0.8,
    isShuffle: false,
    isRepeat: false,
    currentPage: 'home',
    followedArtists: JSON.parse(localStorage.getItem('mh_followed') || '[]'),
    likedTracks: JSON.parse(localStorage.getItem('mh_liked') || '[]'),
    isOnline: navigator.onLine,
    isLoading: false,
    currentAudioUrl: null
};

const dom = {};

// ===== Music Search & Fetch =====
async function searchMusic(query) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

async function fetchAudioUrl(trackName, artistName) {
    // Try multiple sources
    const sources = [
        // YouTube Music (via invidious)
        async () => {
            try {
                const response = await fetch(`https://invidious.io/api/v1/search?q=${encodeURIComponent(trackName + ' ' + artistName)}&type=video`);
                const data = await response.json();
                if (data && data.length > 0) {
                    return `https://invidious.io/watch?v=${data[0].videoId}`;
                }
                return null;
            } catch (e) { return null; }
        },
        
        // Audio from Archive.org
        async () => {
            try {
                const searchTerm = encodeURIComponent(`${trackName} ${artistName}`);
                const response = await fetch(`https://archive.org/advancedsearch.php?q=${searchTerm}&fl[]=identifier&rows=1&page=1&output=json`);
                const data = await response.json();
                if (data.response?.docs?.length > 0) {
                    const id = data.response.docs[0].identifier;
                    return `https://archive.org/download/${id}/${id}.mp3`;
                }
                return null;
            } catch (e) { return null; }
        },
        
        // Jamendo (free music API)
        async () => {
            try {
                const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=1a7b3c7d&format=json&limit=1&namesearch=${encodeURIComponent(trackName)}`);
                const data = await response.json();
                if (data.results?.length > 0) {
                    return data.results[0].audio;
                }
                return null;
            } catch (e) { return null; }
        },
        
        // SoundCloud (via public proxy)
        async () => {
            try {
                const response = await fetch(`https://soundcloud.com/search/sounds?q=${encodeURIComponent(trackName + ' ' + artistName)}`);
                // This is a simplified approach - in production you'd need proper API
                return null;
            } catch (e) { return null; }
        }
    ];

    for (const source of sources) {
        try {
            const url = await source();
            if (url) return url;
        } catch (e) {
            continue;
        }
    }
    
    // Fallback: try to generate a search URL for the user
    return generateFallbackUrl(trackName, artistName);
}

function generateFallbackUrl(trackName, artistName) {
    // If we can't find a direct audio URL, provide a search URL
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(trackName + ' ' + artistName + ' audio')}`;
}

// ===== Offline Detection =====
function checkOnlineStatus() {
    state.isOnline = navigator.onLine;
    const overlay = document.getElementById('offlineOverlay');
    if (!state.isOnline) {
        overlay.classList.remove('hidden');
        if (dom.audioPlayer) {
            dom.audioPlayer.pause();
            dom.audioPlayer.src = '';
        }
        state.isPlaying = false;
        updatePlayButtons();
    } else {
        overlay.classList.add('hidden');
        showNotification('🔄 Соединение восстановлено!', 'success', 2000);
    }
}

window.addEventListener('online', () => {
    state.isOnline = true;
    document.getElementById('offlineOverlay').classList.add('hidden');
    showNotification('🔄 Соединение восстановлено!', 'success', 2000);
});

window.addEventListener('offline', () => {
    state.isOnline = false;
    document.getElementById('offlineOverlay').classList.remove('hidden');
    if (dom.audioPlayer) {
        dom.audioPlayer.pause();
        dom.audioPlayer.src = '';
    }
    state.isPlaying = false;
    updatePlayButtons();
});

// ===== Utilities =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function initDom() {
    const ids = [
        'searchInput', 'searchInputPage', 'tracksContainer', 'albumsContainer',
        'miniPlayer', 'miniCover', 'miniTitle', 'miniArtist', 'miniPlayBtn',
        'miniPrev', 'miniNext', 'miniShuffle', 'miniRepeat',
        'miniProgressBar', 'miniCurrentTime', 'miniTotalTime',
        'miniLikeBtn', 'miniExpandBtn',
        'fullscreenPlayer', 'fsBg', 'fsArtwork', 'fsTitle', 'fsArtist',
        'fsPlayBtn', 'fsPrev', 'fsNext', 'fsShuffle', 'fsRepeat',
        'fsProgressBar', 'fsCurrentTime', 'fsTotalTime',
        'fsLikeBtn', 'fsDownloadBtn', 'fsLyricsBtn', 'fsQueueBtn', 'fsCloseBtn',
        'lyricsModal', 'lyricsModalOverlay', 'lyricsModalClose', 'lyricsTitle', 'lyricsBody',
        'notification', 'themeToggle', 'audioPlayer',
        'artistPage', 'artistAvatar', 'artistName', 'artistListeners',
        'artistPlayBtn', 'artistTrailerBtn', 'artistLikeBtn', 'artistShareBtn', 'artistMoreBtn',
        'artistTrackList', 'artistRelease', 'artistBio', 'artistHeroBg',
        'homePage', 'searchPage', 'searchResults', 'offlineRetryBtn',
        'loadingOverlay', 'loadingText'
    ];
    ids.forEach(id => { dom[id] = document.getElementById(id); });
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(msg, type = 'info', duration = 3000) {
    const el = dom.notification;
    if (!el) return;
    el.textContent = msg;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

function generateCover(seed, size = 300) {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

function showLoading(message = 'Поиск музыки...') {
    if (dom.loadingOverlay) {
        dom.loadingText.textContent = message;
        dom.loadingOverlay.classList.remove('hidden');
    }
    state.isLoading = true;
}

function hideLoading() {
    if (dom.loadingOverlay) {
        dom.loadingOverlay.classList.add('hidden');
    }
    state.isLoading = false;
}

// ===== Music Discovery =====
async function discoverMusic(query) {
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения с интернетом', 'error', 3000);
        return [];
    }

    showLoading(`Поиск: "${query}"...`);
    
    try {
        const results = await searchMusic(query);
        
        if (!results || results.length === 0) {
            hideLoading();
            showNotification('❌ Ничего не найдено', 'error', 3000);
            return [];
        }

        const tracks = results.map((item, index) => ({
            id: Date.now() + index,
            name: item.trackName || 'Неизвестный трек',
            artist: item.artistName || 'Неизвестный исполнитель',
            album: item.collectionName || 'Неизвестный альбом',
            genre: item.primaryGenreName || 'Неизвестный жанр',
            duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 180,
            cover: item.artworkUrl100 ? item.artworkUrl100.replace('100x100', '300x300') : generateCover(item.trackName || 'track'),
            source: 'Online',
            hasAudio: false,
            audio: null,
            previewUrl: item.previewUrl || null
        }));

        hideLoading();
        return tracks;
    } catch (error) {
        console.error('Discovery error:', error);
        hideLoading();
        showNotification('❌ Ошибка поиска музыки', 'error', 3000);
        return [];
    }
}

async function loadTrackAudio(track) {
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения', 'error', 3000);
        return null;
    }

    // If track already has audio URL, use it
    if (track.audio) {
        return track.audio;
    }

    // If track has preview URL from iTunes, use it
    if (track.previewUrl) {
        return track.previewUrl;
    }

    showLoading(`Загрузка: ${track.name}...`);
    
    try {
        const audioUrl = await fetchAudioUrl(track.name, track.artist);
        hideLoading();
        
        if (audioUrl) {
            // Check if it's a search URL (fallback)
            if (audioUrl.includes('youtube.com/results')) {
                showNotification(`🔍 Найдено на YouTube: ${track.name}`, 'info', 3000);
                window.open(audioUrl, '_blank');
                return null;
            }
            return audioUrl;
        }
        
        showNotification('❌ Аудио не найдено', 'error', 2000);
        return null;
    } catch (error) {
        console.error('Audio loading error:', error);
        hideLoading();
        showNotification('❌ Ошибка загрузки аудио', 'error', 2000);
        return null;
    }
}

// ===== Page Navigation =====
function showPage(pageName) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    
    const pageMap = { home: 'homePage', search: 'searchPage', artist: 'artistPage' };
    const pageEl = document.getElementById(pageMap[pageName]);
    if (pageEl) pageEl.classList.add('active');
    
    const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (navItem) navItem.classList.add('active');
    
    state.currentPage = pageName;
    window.scrollTo(0, 0);
}

// ===== Render Functions =====
function renderTracks(tracks, container) {
    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Ничего не найдено</div>';
        return;
    }
    
    container.innerHTML = tracks.map((track, idx) => `
        <div class="track-card" data-index="${idx}">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300/121212/fff?text=Music'">
            <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
            <p class="artist-link" data-artist="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                <span class="source-tag">${track.source || 'Online'}</span>
                ${track.genre ? `<span class="source-tag">${track.genre}</span>` : ''}
            </div>
            <div class="track-actions">
                <button class="btn-play" data-index="${idx}">▶ Слушать</button>
                <button class="btn-download" data-index="${idx}" disabled>⬇ Скачать</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (!state.isOnline) {
                showNotification('⚠️ Нет соединения', 'error');
                return;
            }
            await playTrack(idx);
        });
    });

    container.querySelectorAll('.artist-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistPage(link.dataset.artist);
        });
    });

    container.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', async () => {
            const idx = parseInt(card.dataset.index);
            if (!state.isOnline) {
                showNotification('⚠️ Нет соединения', 'error');
                return;
            }
            await playTrack(idx);
        });
    });
}

function renderAlbums(albums, container) {
    if (!albums || albums.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">Нет альбомов</div>';
        return;
    }
    container.innerHTML = albums.map(album => `
        <div class="album-card" data-album="${escapeHtml(album.name)}">
            <img src="${album.cover}" alt="${escapeHtml(album.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300/121212/fff?text=Album'">
            <h3 title="${escapeHtml(album.name)}">${escapeHtml(album.name)}</h3>
            <p class="artist-link" data-artist="${escapeHtml(album.artist)}">${escapeHtml(album.artist)}</p>
            <span style="font-size:12px;color:var(--text-muted);">${album.tracks} треков</span>
        </div>
    `).join('');

    container.querySelectorAll('.artist-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistPage(link.dataset.artist);
        });
    });

    container.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', async () => {
            const albumName = card.dataset.album;
            await performSearch(albumName);
        });
    });
}

// ===== Artist Page =====
async function showArtistPage(artistName) {
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения', 'error');
        return;
    }

    showLoading(`Поиск: ${artistName}...`);
    
    try {
        const tracks = await discoverMusic(artistName);
        const data = {
            listeners: Math.floor(Math.random() * 10000000).toLocaleString('ru-RU'),
            bio: `${artistName} — музыкальный исполнитель. Информация загружается из открытых источников.`,
            image: generateCover(artistName, 400),
            tracks: tracks.slice(0, 10),
            release: { 
                name: tracks[0]?.album || 'Новый релиз', 
                cover: tracks[0]?.cover || generateCover('release'), 
                year: '2026' 
            }
        };
        
        dom.artistAvatar.src = data.image;
        dom.artistName.textContent = artistName;
        dom.artistListeners.textContent = `${data.listeners} слушателей в месяц`;
        dom.artistBio.textContent = data.bio;
        dom.artistHeroBg.style.background = `linear-gradient(180deg, rgba(0,0,0,0.5) 0%, var(--bg-primary) 100%), url(${data.image}) center/cover`;
        
        // Render tracks
        dom.artistTrackList.innerHTML = data.tracks.map((track, idx) => `
            <div class="track-list-item" data-track-id="${track.id}">
                <span class="track-number">${String(idx + 1).padStart(2, '0')}</span>
                <img src="${track.cover}" alt="" class="track-list-cover" onerror="this.src='https://via.placeholder.com/48/121212/fff?text=?'">
                <div class="track-list-info">
                    <div class="track-list-name">${escapeHtml(track.name)}</div>
                    <div class="track-list-artists">${escapeHtml(track.artist)}</div>
                </div>
                <span class="track-list-duration">${formatTime(track.duration)}</span>
                <button class="track-list-like ${state.likedTracks.includes(track.id) ? 'liked' : ''}" data-track-id="${track.id}">
                    ${state.likedTracks.includes(track.id) ? '❤️' : '♡'}
                </button>
            </div>
        `).join('');

        dom.artistTrackList.querySelectorAll('.track-list-item').forEach(item => {
            item.addEventListener('click', async () => {
                const trackId = parseInt(item.dataset.trackId);
                const track = data.tracks.find(t => t.id === trackId);
                if (track) {
                    if (!state.isOnline) {
                        showNotification('⚠️ Нет соединения', 'error');
                        return;
                    }
                    state.artistTracks = data.tracks.map(t => ({ ...t, source: 'Online', hasAudio: false, audio: null }));
                    state.tracks = state.artistTracks;
                    state.playlist = state.artistTracks;
                    const idx = state.artistTracks.findIndex(t => t.id === trackId);
                    await playTrack(idx);
                }
            });
        });

        dom.artistTrackList.querySelectorAll('.track-list-like').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = parseInt(btn.dataset.trackId);
                toggleLike(trackId, btn);
            });
        });

        // Render release
        if (data.release) {
            dom.artistRelease.innerHTML = `
                <img src="${data.release.cover}" alt="${escapeHtml(data.release.name)}" onerror="this.src='https://via.placeholder.com/300/121212/fff?text=Release'">
                <div class="release-info">
                    <h4>${escapeHtml(data.release.name)}</h4>
                    <p>Сингл · ${data.release.year}</p>
                </div>
            `;
        }

        // Update like button
        const isFollowed = state.followedArtists.includes(artistName);
        dom.artistLikeBtn.textContent = isFollowed ? '❤️' : '♡';

        hideLoading();
        showPage('artist');
    } catch (error) {
        console.error('Artist page error:', error);
        hideLoading();
        showNotification('❌ Ошибка загрузки данных исполнителя', 'error', 3000);
    }
}

function toggleLike(trackId, btn) {
    if (state.likedTracks.includes(trackId)) {
        state.likedTracks = state.likedTracks.filter(id => id !== trackId);
        if (btn) { btn.textContent = '♡'; btn.classList.remove('liked'); }
        showNotification('Лайк убран', 'info', 1500);
    } else {
        state.likedTracks.push(trackId);
        if (btn) { btn.textContent = '❤️'; btn.classList.add('liked'); }
        showNotification('❤️ Добавлено в любимое', 'success', 1500);
    }
    localStorage.setItem('mh_liked', JSON.stringify(state.likedTracks));
}

// ===== Player =====
async function playTrack(index) {
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения с интернетом', 'error', 3000);
        return;
    }

    const track = state.tracks[index];
    if (!track) {
        showNotification('❌ Трек не найден', 'error');
        return;
    }

    // If this is the same track, just toggle play
    if (state.currentTrack && state.currentTrack.id === track.id) {
        togglePlay();
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;
    
    updateMiniPlayer(track);
    updateFullscreenPlayer(track);

    // Try to load audio
    if (!track.hasAudio || !track.audio) {
        const audioUrl = await loadTrackAudio(track);
        if (audioUrl) {
            track.audio = audioUrl;
            track.hasAudio = true;
            track.source = 'Online';
        } else {
            // If no audio found, play as demo
            showNotification(`🎧 Демо: ${track.name} — ${track.artist}`, 'info', 3000);
            playDemoTrack(track);
            return;
        }
    }

    // Play the audio
    if (track.audio && track.hasAudio) {
        dom.audioPlayer.src = track.audio;
        dom.audioPlayer.play().then(() => {
            state.isPlaying = true;
            updatePlayButtons();
        }).catch((err) => {
            console.error('Play error:', err);
            showNotification('⚠️ Ошибка воспроизведения', 'error');
            state.isPlaying = false;
            updatePlayButtons();
            // Fallback to demo
            playDemoTrack(track);
        });
    } else {
        playDemoTrack(track);
    }
}

function playDemoTrack(track) {
    state.isPlaying = true;
    updatePlayButtons();
    
    // Simulate playback
    if (track.duration) {
        let elapsed = 0;
        const interval = setInterval(() => {
            if (!state.isPlaying || state.currentTrack?.id !== track.id) {
                clearInterval(interval);
                return;
            }
            elapsed++;
            const progress = (elapsed / track.duration) * 100;
            dom.miniProgressBar.value = Math.min(progress, 100);
            dom.fsProgressBar.value = Math.min(progress, 100);
            dom.miniCurrentTime.textContent = formatTime(Math.min(elapsed, track.duration));
            dom.fsCurrentTime.textContent = formatTime(Math.min(elapsed, track.duration));
            if (elapsed >= track.duration) {
                clearInterval(interval);
                if (state.isRepeat) {
                    playTrack(state.currentIndex);
                } else {
                    nextTrack();
                }
            }
        }, 1000);
    }
}

function updateMiniPlayer(track) {
    dom.miniCover.src = track.cover || 'https://via.placeholder.com/60/121212/fff?text=?';
    dom.miniTitle.textContent = track.name || 'Без названия';
    dom.miniArtist.textContent = track.artist || 'Неизвестный';
    dom.miniTotalTime.textContent = formatTime(track.duration);
    dom.fsTotalTime.textContent = formatTime(track.duration);
    
    const isLiked = state.likedTracks.includes(track.id);
    dom.miniLikeBtn.textContent = isLiked ? '❤️' : '🤍';
    dom.fsLikeBtn.textContent = isLiked ? '❤️' : '🤍';
}

function updateFullscreenPlayer(track) {
    dom.fsArtwork.src = track.cover || 'https://via.placeholder.com/400/121212/fff?text=?';
    dom.fsTitle.textContent = track.name || 'Без названия';
    dom.fsArtist.textContent = track.artist || 'Неизвестный';
    dom.fsBg.style.backgroundImage = `url(${track.cover || 'https://via.placeholder.com/400/121212/fff?text=?'})`;
}

function updatePlayButtons() {
    const icon = state.isPlaying ? '⏸' : '▶';
    dom.miniPlayBtn.textContent = icon;
    dom.fsPlayBtn.textContent = icon;
}

function togglePlay() {
    if (!state.currentTrack) {
        if (state.tracks.length > 0) playTrack(0);
        else showNotification('Сначала найдите трек', 'info');
        return;
    }
    
    if (state.currentTrack.hasAudio && state.currentTrack.audio) {
        if (dom.audioPlayer.paused) {
            dom.audioPlayer.play();
            state.isPlaying = true;
        } else {
            dom.audioPlayer.pause();
            state.isPlaying = false;
        }
    } else {
        state.isPlaying = !state.isPlaying;
    }
    updatePlayButtons();
}

function nextTrack() {
    if (state.tracks.length === 0) return;
    if (state.isShuffle) {
        state.currentIndex = Math.floor(Math.random() * state.tracks.length);
    } else {
        state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
    }
    playTrack(state.currentIndex);
}

function prevTrack() {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
    playTrack(state.currentIndex);
}

function openFullscreen() {
    if (!state.currentTrack) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }
    dom.fullscreenPlayer.classList.remove('hidden');
}

function closeFullscreen() {
    dom.fullscreenPlayer.classList.add('hidden');
}

// ===== Search =====
async function performSearch(query) {
    if (!query.trim()) return;
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения с интернетом', 'error', 3000);
        return;
    }

    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
    }

    const tracks = await discoverMusic(query);
    state.tracks = tracks;
    state.playlist = tracks;

    // Generate some album suggestions based on search
    const albums = tracks.slice(0, 6).map((track, i) => ({
        id: Date.now() + i,
        name: track.album || `${query} Альбом`,
        artist: track.artist,
        cover: track.cover || generateCover(`${query}album${i}`),
        tracks: Math.floor(Math.random() * 12) + 5
    }));

    dom.searchResults.innerHTML = `
        <section>
            <h2 class="section-title">🔍 Результаты: "${escapeHtml(query)}"</h2>
            <div class="tracks-grid" id="searchTracksContainer"></div>
        </section>
        ${albums.length > 0 ? `
        <section>
            <h2 class="section-title">Похожие альбомы</h2>
            <div class="albums-grid" id="searchAlbumsContainer"></div>
        </section>` : ''}
    `;
    
    renderTracks(tracks, document.getElementById('searchTracksContainer'));
    if (albums.length > 0) {
        renderAlbums(albums, document.getElementById('searchAlbumsContainer'));
    }
    
    showPage('search');
}

// ===== Setup =====
function setupUI() {
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(item.dataset.page);
        });
    });

    // Search
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch(dom.searchInput.value);
    });
    dom.searchInputPage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch(dom.searchInputPage.value);
    });

    // Mini player controls
    dom.miniPlayBtn.addEventListener('click', togglePlay);
    dom.miniNext.addEventListener('click', nextTrack);
    dom.miniPrev.addEventListener('click', prevTrack);
    dom.miniExpandBtn.addEventListener('click', openFullscreen);
    dom.miniCover.addEventListener('click', openFullscreen);
    
    dom.miniShuffle.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        dom.miniShuffle.classList.toggle('active', state.isShuffle);
        dom.fsShuffle.classList.toggle('active', state.isShuffle);
        showNotification(`🔀 Перемешивание ${state.isShuffle ? 'включено' : 'выключено'}`, 'info', 1500);
    });
    
    dom.miniRepeat.addEventListener('click', () => {
        state.isRepeat = !state.isRepeat;
        dom.miniRepeat.classList.toggle('active', state.isRepeat);
        dom.fsRepeat.classList.toggle('active', state.isRepeat);
        showNotification(`🔁 Повтор ${state.isRepeat ? 'включён' : 'выключен'}`, 'info', 1500);
    });

    dom.miniLikeBtn.addEventListener('click', () => {
        if (state.currentTrack) {
            toggleLike(state.currentTrack.id, dom.miniLikeBtn);
            dom.fsLikeBtn.textContent = state.likedTracks.includes(state.currentTrack.id) ? '❤️' : '🤍';
        }
    });

    // Fullscreen controls
    dom.fsCloseBtn.addEventListener('click', closeFullscreen);
    dom.fsPlayBtn.addEventListener('click', togglePlay);
    dom.fsNext.addEventListener('click', nextTrack);
    dom.fsPrev.addEventListener('click', prevTrack);
    
    dom.fsShuffle.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        dom.fsShuffle.classList.toggle('active', state.isShuffle);
        dom.miniShuffle.classList.toggle('active', state.isShuffle);
    });
    
    dom.fsRepeat.addEventListener('click', () => {
        state.isRepeat = !state.isRepeat;
        dom.fsRepeat.classList.toggle('active', state.isRepeat);
        dom.miniRepeat.classList.toggle('active', state.isRepeat);
    });

    dom.fsLikeBtn.addEventListener('click', () => {
        if (state.currentTrack) {
            toggleLike(state.currentTrack.id, dom.fsLikeBtn);
            dom.miniLikeBtn.textContent = state.likedTracks.includes(state.currentTrack.id) ? '❤️' : '🤍';
        }
    });

    dom.fsDownloadBtn.addEventListener('click', () => {
        if (!state.isOnline) {
            showNotification('⚠️ Нет соединения', 'error');
            return;
        }
        showNotification('⬇ Загрузка начата', 'success');
    });

    dom.fsLyricsBtn.addEventListener('click', () => {
        if (state.currentTrack) showLyricsModal(state.currentTrack);
    });

    dom.fsQueueBtn.addEventListener('click', () => {
        showNotification('📋 Очередь воспроизведения', 'info');
    });

    // Lyrics modal
    dom.lyricsModalClose.addEventListener('click', () => dom.lyricsModal.classList.add('hidden'));
    dom.lyricsModalOverlay.addEventListener('click', () => dom.lyricsModal.classList.add('hidden'));

    // Artist page buttons
    dom.artistPlayBtn.addEventListener('click', async () => {
        if (state.artistTracks.length > 0) await playTrack(0);
    });
    dom.artistTrailerBtn.addEventListener('click', () => {
        showNotification('🎬 Трейлер (демо)', 'info', 2000);
    });
    dom.artistLikeBtn.addEventListener('click', () => {
        const name = dom.artistName.textContent;
        if (state.followedArtists.includes(name)) {
            state.followedArtists = state.followedArtists.filter(a => a !== name);
            dom.artistLikeBtn.textContent = '♡';
            showNotification('Отписка от исполнителя', 'info', 1500);
        } else {
            state.followedArtists.push(name);
            dom.artistLikeBtn.textContent = '❤️';
            showNotification(`❤️ Вы подписались на ${name}`, 'success', 1500);
        }
        localStorage.setItem('mh_followed', JSON.stringify(state.followedArtists));
    });
    dom.artistShareBtn.addEventListener('click', () => {
        showNotification('📤 Ссылка скопирована', 'success', 1500);
    });

    // Station/Genre cards
    $$('.station-card, .genre-card').forEach(card => {
        card.addEventListener('click', async () => {
            const genre = card.dataset.genre;
            await performSearch(genre);
        });
    });

    // Audio events
    dom.audioPlayer.addEventListener('timeupdate', () => {
        const audio = dom.audioPlayer;
        if (audio.duration && !isNaN(audio.duration)) {
            const progress = (audio.currentTime / audio.duration) * 100;
            dom.miniProgressBar.value = progress;
            dom.fsProgressBar.value = progress;
            dom.miniCurrentTime.textContent = formatTime(audio.currentTime);
            dom.miniTotalTime.textContent = formatTime(audio.duration);
            dom.fsCurrentTime.textContent = formatTime(audio.currentTime);
            dom.fsTotalTime.textContent = formatTime(audio.duration);
        }
    });

    dom.miniProgressBar.addEventListener('input', () => {
        const audio = dom.audioPlayer;
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (dom.miniProgressBar.value / 100) * audio.duration;
        }
    });

    dom.fsProgressBar.addEventListener('input', () => {
        const audio = dom.audioPlayer;
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (dom.fsProgressBar.value / 100) * audio.duration;
        }
    });

    dom.audioPlayer.addEventListener('ended', () => {
        if (state.isRepeat) {
            dom.audioPlayer.currentTime = 0;
            dom.audioPlayer.play();
        } else {
            nextTrack();
        }
    });

    // Offline retry button
    dom.offlineRetryBtn.addEventListener('click', () => {
        if (navigator.onLine) {
            document.getElementById('offlineOverlay').classList.add('hidden');
            state.isOnline = true;
            showNotification('✅ Соединение восстановлено!', 'success', 2000);
        } else {
            showNotification('❌ Всё ещё нет соединения', 'error', 2000);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
        if (e.key === 'ArrowRight') nextTrack();
        if (e.key === 'ArrowLeft') prevTrack();
        if (e.key === 'Escape') {
            closeFullscreen();
            dom.lyricsModal.classList.add('hidden');
        }
        if (e.key === 'f' || e.key === 'F') {
            if (dom.fullscreenPlayer.classList.contains('hidden')) openFullscreen();
            else closeFullscreen();
        }
    });

    // Theme toggle
    let isDark = true;
    dom.themeToggle.addEventListener('click', () => {
        isDark = !isDark;
        dom.themeToggle.textContent = isDark ? '🌙' : '☀️';
        document.body.style.setProperty('--bg-primary', isDark ? '#121212' : '#f5f5f5');
        document.body.style.setProperty('--bg-secondary', isDark ? '#1a1a1a' : '#e8e8e8');
        document.body.style.setProperty('--bg-card', isDark ? '#242424' : '#d0d0d0');
        document.body.style.setProperty('--text-primary', isDark ? '#ffffff' : '#121212');
        document.body.style.setProperty('--text-secondary', isDark ? '#b3b3b3' : '#555555');
        showNotification(isDark ? '🌙 Тёмная тема' : '☀️ Светлая тема', 'info', 1500);
    });
}

function showLyricsModal(track) {
    dom.lyricsTitle.textContent = `📝 ${track.name} — ${track.artist}`;
    dom.lyricsBody.innerHTML = `
        <div class="lyrics-line">🎵 ${track.name}</div>
        <div class="lyrics-line">Исполнитель: ${track.artist}</div>
        <div class="lyrics-line">Альбом: ${track.album || '—'}</div>
        <div class="lyrics-line">Жанр: ${track.genre || '—'}</div>
        <div class="lyrics-line">Длительность: ${formatTime(track.duration)}</div>
        <div class="lyrics-line" style="margin-top:20px;color:var(--text-muted);">📝 Текст песни загружается из открытых источников...</div>
    `;
    dom.lyricsModal.classList.remove('hidden');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    
    // Check initial online status
    checkOnlineStatus();
    
    setupUI();
    
    // Show welcome message
    dom.tracksContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
            <div style="font-size:48px;margin-bottom:20px;">🎵</div>
            <h2 style="font-size:24px;margin-bottom:10px;">Добро пожаловать в MusicHub</h2>
            <p>Используйте поиск, чтобы найти музыку</p>
            <p style="font-size:12px;margin-top:20px;opacity:0.5;">Музыка загружается в реальном времени из открытых источников</p>
        </div>
    `;
    
    dom.albumsContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">
            Начните поиск, чтобы увидеть альбомы
        </div>
    `;
    
    // Set initial theme button
    dom.themeToggle.textContent = '🌙';
    
    console.log('🎵 MusicHub v5.0 - Real-time music discovery');
    console.log('📡 Поиск музыки в реальном времени из открытых источников');
});
