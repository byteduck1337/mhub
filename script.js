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
    likedTracks: JSON.parse(localStorage.getItem('mh_liked') || '[]')
};

const dom = {};

const API_CONFIG = {
    ITUNES_URL: 'https://itunes.apple.com/search',
    TIMEOUT: 10000,
    MAX_TRACKS: 20
};

// ===== Demo Data =====
const DEMO_TRACKS = [
    { id: 1, name: 'Тёмный принц', artist: 'Алексей Воробьёв', album: 'Лучшее', cover: 'https://picsum.photos/seed/track1/300/300', duration: 210, source: 'Demo', genre: 'Pop', audio: null },
    { id: 2, name: 'Malo 2.0', artist: 'ЕГОР КРИД, OG Buda, Toxi$', album: 'Malo 2.0', cover: 'https://picsum.photos/seed/track2/300/300', duration: 326, source: 'Demo', genre: 'Hip-Hop', audio: null },
    { id: 3, name: 'Jealous', artist: '9mice, ЕГОР КРИД, тёмный принц', album: 'Jealous', cover: 'https://picsum.photos/seed/track3/300/300', duration: 186, source: 'Demo', genre: 'Hip-Hop', audio: null },
    { id: 4, name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', cover: 'https://picsum.photos/seed/track4/300/300', duration: 200, source: 'Demo', genre: 'Pop', audio: null },
    { id: 5, name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', cover: 'https://picsum.photos/seed/track5/300/300', duration: 234, source: 'Demo', genre: 'Pop', audio: null },
    { id: 6, name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', cover: 'https://picsum.photos/seed/track6/300/300', duration: 354, source: 'Demo', genre: 'Rock', audio: null },
    { id: 7, name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', cover: 'https://picsum.photos/seed/track7/300/300', duration: 391, source: 'Demo', genre: 'Rock', audio: null },
    { id: 8, name: 'Imagine', artist: 'John Lennon', album: 'Imagine', cover: 'https://picsum.photos/seed/track8/300/300', duration: 183, source: 'Demo', genre: 'Pop', audio: null },
    { id: 9, name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', cover: 'https://picsum.photos/seed/track9/300/300', duration: 301, source: 'Demo', genre: 'Rock', audio: null },
    { id: 10, name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', cover: 'https://picsum.photos/seed/track10/300/300', duration: 294, source: 'Demo', genre: 'Pop', audio: null },
    { id: 11, name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', cover: 'https://picsum.photos/seed/track11/300/300', duration: 326, source: 'Demo', genre: 'Hip-Hop', audio: null },
    { id: 12, name: 'Wonderwall', artist: 'Oasis', album: "What's the Story Morning Glory?", cover: 'https://picsum.photos/seed/track12/300/300', duration: 258, source: 'Demo', genre: 'Rock', audio: null },
];

const DEMO_ALBUMS = [
    { id: 101, name: 'Лучшие хиты', artist: 'Макс Корж', cover: 'https://picsum.photos/seed/album1/300/300', tracks: 12 },
    { id: 102, name: 'Thriller', artist: 'Michael Jackson', cover: 'https://picsum.photos/seed/album2/300/300', tracks: 9 },
    { id: 103, name: 'Back in Black', artist: 'AC/DC', cover: 'https://picsum.photos/seed/album3/300/300', tracks: 10 },
    { id: 104, name: 'Nevermind', artist: 'Nirvana', cover: 'https://picsum.photos/seed/album4/300/300', tracks: 12 },
    { id: 105, name: 'Abbey Road', artist: 'The Beatles', cover: 'https://picsum.photos/seed/album5/300/300', tracks: 17 },
    { id: 106, name: 'The Dark Side of the Moon', artist: 'Pink Floyd', cover: 'https://picsum.photos/seed/album6/300/300', tracks: 10 },
];

const ARTIST_DB = {
    'тёмный принц': {
        listeners: '5 445 077',
        bio: 'Тёмный принц — российский музыкальный исполнитель, известный своими collaborations с ведущими артистами хип-хоп сцены. Начал карьеру в конце 2010-х годов и быстро набрал популярность благодаря уникальному стилю и энергичным performances.',
        image: 'https://picsum.photos/seed/artist-dark-prince/400/400',
        tracks: [
            { id: 2, name: 'Malo 2.0', artists: 'ЕГОР КРИД, OG Buda, Toxi$, Мэйби Бэйби, Baby Cute, Дора, madk1d, тёмный принц', duration: 326, cover: 'https://picsum.photos/seed/track2/300/300' },
            { id: 3, name: 'Jealous', artists: '9mice, ЕГОР КРИД, тёмный принц, madk1d', duration: 186, cover: 'https://picsum.photos/seed/track3/300/300' },
            { id: 20, name: 'Утекай', artists: 'тёмный принц', duration: 201, cover: 'https://picsum.photos/seed/track20/300/300' },
            { id: 21, name: 'Ночь', artists: 'тёмный принц, OG Buda', duration: 195, cover: 'https://picsum.photos/seed/track21/300/300' },
            { id: 22, name: 'Город', artists: 'тёмный принц', duration: 218, cover: 'https://picsum.photos/seed/track22/300/300' },
        ],
        release: { name: 'Malo 2.0', cover: 'https://picsum.photos/seed/release1/300/300', year: '2026' }
    }
};

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
        'homePage', 'searchPage', 'searchResults'
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
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300'">
            <h3 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
            <p class="artist-link" data-artist="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
            <span class="source-tag">${track.source || 'Demo'}</span>
            ${track.genre ? `<span class="source-tag">${track.genre}</span>` : ''}
            <div class="track-actions">
                <button class="btn-play" data-index="${idx}">▶ Слушать</button>
                <button class="btn-download" data-index="${idx}" ${!track.audio ? 'disabled' : ''}>⬇ Скачать</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playTrack(parseInt(btn.dataset.index));
        });
    });

    container.querySelectorAll('.btn-download:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showNotification('⬇ Загрузка начата', 'success');
        });
    });

    container.querySelectorAll('.artist-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistPage(link.dataset.artist);
        });
    });

    container.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => {
            playTrack(parseInt(card.dataset.index));
        });
    });
}

function renderAlbums(albums, container) {
    if (!albums || albums.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">Нет альбомов</div>';
        return;
    }
    container.innerHTML = albums.map(album => `
        <div class="album-card">
            <img src="${album.cover}" alt="${escapeHtml(album.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300'">
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
}

// ===== Artist Page =====
function showArtistPage(artistName) {
    const key = artistName.toLowerCase().trim();
    const data = ARTIST_DB[key] || generateArtistData(artistName);
    
    dom.artistAvatar.src = data.image;
    dom.artistName.textContent = artistName;
    dom.artistListeners.textContent = `${data.listeners} слушателей в месяц`;
    dom.artistBio.textContent = data.bio;
    dom.artistHeroBg.style.background = `linear-gradient(180deg, rgba(0,0,0,0.5) 0%, var(--bg-primary) 100%), url(${data.image}) center/cover`;
    
    // Render tracks
    dom.artistTrackList.innerHTML = data.tracks.map((track, idx) => `
        <div class="track-list-item" data-track-id="${track.id}">
            <span class="track-number">${String(idx + 1).padStart(2, '0')}</span>
            <img src="${track.cover}" alt="" class="track-list-cover">
            <div class="track-list-info">
                <div class="track-list-name">${escapeHtml(track.name)}</div>
                <div class="track-list-artists">${escapeHtml(track.artists)}</div>
            </div>
            <span class="track-list-duration">${formatTime(track.duration)}</span>
            <button class="track-list-like ${state.likedTracks.includes(track.id) ? 'liked' : ''}" data-track-id="${track.id}">
                ${state.likedTracks.includes(track.id) ? '❤️' : '♡'}
            </button>
        </div>
    `).join('');

    dom.artistTrackList.querySelectorAll('.track-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const trackId = parseInt(item.dataset.trackId);
            const track = data.tracks.find(t => t.id === trackId);
            if (track) {
                state.artistTracks = data.tracks.map(t => ({
                    ...t,
                    artist: t.artists,
                    source: 'Demo',
                    audio: null
                }));
                state.tracks = state.artistTracks;
                state.playlist = state.artistTracks;
                const idx = state.artistTracks.findIndex(t => t.id === trackId);
                playTrack(idx);
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
            <img src="${data.release.cover}" alt="${escapeHtml(data.release.name)}">
            <div class="release-info">
                <h4>${escapeHtml(data.release.name)}</h4>
                <p>Сингл · ${data.release.year}</p>
            </div>
        `;
    }

    // Update like button
    const isFollowed = state.followedArtists.includes(artistName);
    dom.artistLikeBtn.textContent = isFollowed ? '❤️' : '♡';

    showPage('artist');
}

function generateArtistData(name) {
    const tracks = DEMO_TRACKS.slice(0, 5).map((t, i) => ({
        ...t,
        id: 100 + i,
        artists: name,
        name: `${name} — Трек ${i + 1}`,
        cover: `https://picsum.photos/seed/${name}${i}/300/300`
    }));
    return {
        listeners: Math.floor(Math.random() * 10000000).toLocaleString('ru-RU'),
        bio: `${name} — музыкальный исполнитель. Информация загружается из базы данных.`,
        image: `https://picsum.photos/seed/${name}/400/400`,
        tracks: tracks,
        release: { name: 'Новый сингл', cover: `https://picsum.photos/seed/${name}release/300/300`, year: '2026' }
    };
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
function playTrack(index) {
    const track = state.tracks[index];
    if (!track) return;
    
    state.currentIndex = index;
    state.currentTrack = track;
    
    updateMiniPlayer(track);
    updateFullscreenPlayer(track);
    
    if (track.audio) {
        dom.audioPlayer.src = track.audio;
        dom.audioPlayer.play().then(() => {
            state.isPlaying = true;
            updatePlayButtons();
        }).catch(() => {
            showNotification('⚠️ Ошибка воспроизведения', 'error');
        });
    } else {
        state.isPlaying = true;
        updatePlayButtons();
        showNotification(`▶ ${track.name} — ${track.artist}`, 'info', 2000);
    }
}

function updateMiniPlayer(track) {
    dom.miniCover.src = track.cover || 'https://via.placeholder.com/60';
    dom.miniTitle.textContent = track.name || 'Без названия';
    dom.miniArtist.textContent = track.artist || 'Неизвестный';
    
    const isLiked = state.likedTracks.includes(track.id);
    dom.miniLikeBtn.textContent = isLiked ? '❤️' : '🤍';
}

function updateFullscreenPlayer(track) {
    dom.fsArtwork.src = track.cover || 'https://via.placeholder.com/400';
    dom.fsTitle.textContent = track.name || 'Без названия';
    dom.fsArtist.textContent = track.artist || 'Неизвестный';
    dom.fsBg.style.backgroundImage = `url(${track.cover || 'https://via.placeholder.com/400'})`;
    
    const isLiked = state.likedTracks.includes(track.id);
    dom.fsLikeBtn.textContent = isLiked ? '❤️' : '🤍';
}

function updatePlayButtons() {
    const icon = state.isPlaying ? '⏸' : '▶';
    dom.miniPlayBtn.textContent = icon;
    dom.fsPlayBtn.textContent = icon;
}

function togglePlay() {
    if (!state.currentTrack) {
        if (state.tracks.length > 0) playTrack(0);
        else showNotification('Сначала выберите трек', 'info');
        return;
    }
    
    if (state.currentTrack.audio) {
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
function performSearch(query) {
    if (!query.trim()) return;
    
    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
    }
    
    const results = DEMO_TRACKS.filter(t => 
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        t.genre.toLowerCase().includes(query.toLowerCase())
    );
    
    const albums = DEMO_ALBUMS.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.artist.toLowerCase().includes(query.toLowerCase())
    );
    
    state.tracks = results.length > 0 ? results : DEMO_TRACKS.slice(0, 8);
    state.playlist = state.tracks;
    
    dom.searchResults.innerHTML = `
        <section>
            <h2 class="section-title">🔍 Результаты: "${escapeHtml(query)}"</h2>
            <div class="tracks-grid" id="searchTracksContainer"></div>
        </section>
        ${albums.length > 0 ? `
        <section>
            <h2 class="section-title">Альбомы</h2>
            <div class="albums-grid" id="searchAlbumsContainer"></div>
        </section>` : ''}
    `;
    
    renderTracks(state.tracks, document.getElementById('searchTracksContainer'));
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
        showNotification(`🔀 Перемешивание ${state.isShuffle ? 'включено' : 'выключено'}`, 'info', 1500);
    });
    
    dom.miniRepeat.addEventListener('click', () => {
        state.isRepeat = !state.isRepeat;
        dom.miniRepeat.classList.toggle('active', state.isRepeat);
        showNotification(`🔁 Повтор ${state.isRepeat ? 'включён' : 'выключен'}`, 'info', 1500);
    });

    dom.miniLikeBtn.addEventListener('click', () => {
        if (state.currentTrack) {
            toggleLike(state.currentTrack.id, dom.miniLikeBtn);
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
        showNotification('⬇ Загрузка начата', 'success');
    });

    dom.fsLyricsBtn.addEventListener('click', () => {
        if (state.currentTrack) showLyricsModal(state.currentTrack);
    });

    dom.fsQueueBtn.addEventListener('click', () => {
        showNotification(' Очередь воспроизведения', 'info');
    });

    // Lyrics modal
    dom.lyricsModalClose.addEventListener('click', () => dom.lyricsModal.classList.add('hidden'));
    dom.lyricsModalOverlay.addEventListener('click', () => dom.lyricsModal.classList.add('hidden'));

    // Artist page buttons
    dom.artistPlayBtn.addEventListener('click', () => {
        if (state.artistTracks.length > 0) playTrack(0);
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
        card.addEventListener('click', () => {
            const genre = card.dataset.genre;
            performSearch(genre);
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

    // Theme toggle (placeholder)
    dom.themeToggle.addEventListener('click', () => {
        showNotification(' Тёмная тема активна', 'info', 1500);
    });
}

function showLyricsModal(track) {
    dom.lyricsTitle.textContent = `📝 ${track.name} — ${track.artist}`;
    dom.lyricsBody.innerHTML = `
        <div class="lyrics-line">Куплет 1</div>
        <div class="lyrics-line">Текст песни загружается...</div>
        <div class="lyrics-line"> </div>
        <div class="lyrics-line">Припев</div>
        <div class="lyrics-line">Музыкальная композиция</div>
        <div class="lyrics-line"> </div>
        <div class="lyrics-line">Куплет 2</div>
        <div class="lyrics-line">Продолжение текста...</div>
    `;
    dom.lyricsModal.classList.remove('hidden');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    setupUI();
    
    // Initial render
    state.tracks = DEMO_TRACKS;
    state.playlist = DEMO_TRACKS;
    renderTracks(DEMO_TRACKS, dom.tracksContainer);
    renderAlbums(DEMO_ALBUMS, dom.albumsContainer);
    
    console.log(' MusicHub v3.0 loaded');
});
