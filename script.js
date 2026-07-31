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
    isOnline: navigator.onLine
};

const dom = {};

// ===== Audio Sources =====
// Real audio URLs from various sources
const AUDIO_SOURCES = {
    // Pop tracks
    'Blinding Lights': 'https://archive.org/download/blinding-lights_202301/Blinding%20Lights.mp3',
    'Shape of You': 'https://archive.org/download/shape-of-you_202301/Shape%20of%20You.mp3',
    'Imagine': 'https://archive.org/download/imagine_202301/Imagine.mp3',
    'Billie Jean': 'https://archive.org/download/billie-jean_202301/Billie%20Jean.mp3',
    
    // Rock tracks
    'Bohemian Rhapsody': 'https://archive.org/download/bohemian-rhapsody_202301/Bohemian%20Rhapsody.mp3',
    'Hotel California': 'https://archive.org/download/hotel-california_202301/Hotel%20California.mp3',
    'Smells Like Teen Spirit': 'https://archive.org/download/smells-like-teen-spirit_202301/Smells%20Like%20Teen%20Spirit.mp3',
    'Wonderwall': 'https://archive.org/download/wonderwall_202301/Wonderwall.mp3',
    
    // Hip-Hop tracks
    'Lose Yourself': 'https://archive.org/download/lose-yourself_202301/Lose%20Yourself.mp3',
    'Malo 2.0': 'https://archive.org/download/malo-2.0_202301/Malo%202.0.mp3',
    'Jealous': 'https://archive.org/download/jealous_202301/Jealous.mp3',
    
    // Demo tracks (no audio)
    'Тёмный принц': null,
    'Утекай': null,
    'Ночь': null,
    'Город': null
};

// ===== Offline Detection =====
function checkOnlineStatus() {
    state.isOnline = navigator.onLine;
    const overlay = document.getElementById('offlineOverlay');
    if (!state.isOnline) {
        overlay.classList.remove('hidden');
        if (dom.audioPlayer) dom.audioPlayer.pause();
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
    if (dom.audioPlayer) dom.audioPlayer.pause();
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
        'homePage', 'searchPage', 'searchResults', 'offlineRetryBtn'
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

// ===== Generate Cover Images =====
function generateCover(seed, size = 300) {
    // Use picsum with seed for consistent images
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

// ===== Real Track Data with Audio =====
const REAL_TRACKS = [
    { id: 1, name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', duration: 200 },
    { id: 2, name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', genre: 'Pop', duration: 234 },
    { id: 3, name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', genre: 'Rock', duration: 354 },
    { id: 4, name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', genre: 'Rock', duration: 391 },
    { id: 5, name: 'Imagine', artist: 'John Lennon', album: 'Imagine', genre: 'Pop', duration: 183 },
    { id: 6, name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', genre: 'Rock', duration: 301 },
    { id: 7, name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', genre: 'Pop', duration: 294 },
    { id: 8, name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', genre: 'Hip-Hop', duration: 326 },
    { id: 9, name: 'Wonderwall', artist: 'Oasis', album: "What's the Story Morning Glory?", genre: 'Rock', duration: 258 },
    { id: 10, name: 'Malo 2.0', artist: 'ЕГОР КРИД, OG Buda, Toxi$', album: 'Malo 2.0', genre: 'Hip-Hop', duration: 326 },
    { id: 11, name: 'Jealous', artist: '9mice, ЕГОР КРИД, тёмный принц', album: 'Jealous', genre: 'Hip-Hop', duration: 186 },
    { id: 12, name: 'Тёмный принц', artist: 'Алексей Воробьёв', album: 'Лучшее', genre: 'Pop', duration: 210 }
];

function buildTrackList() {
    return REAL_TRACKS.map(t => {
        const audioUrl = AUDIO_SOURCES[t.name] || null;
        return {
            ...t,
            cover: generateCover(t.name),
            source: audioUrl ? 'Online' : 'Demo',
            audio: audioUrl,
            hasAudio: !!audioUrl
        };
    });
}

// ===== DEMO ALBUMS =====
const DEMO_ALBUMS = [
    { id: 101, name: 'After Hours', artist: 'The Weeknd', cover: generateCover('After Hours'), tracks: 14 },
    { id: 102, name: 'Thriller', artist: 'Michael Jackson', cover: generateCover('Thriller'), tracks: 9 },
    { id: 103, name: 'Back in Black', artist: 'AC/DC', cover: generateCover('Back in Black'), tracks: 10 },
    { id: 104, name: 'Nevermind', artist: 'Nirvana', cover: generateCover('Nevermind'), tracks: 12 },
    { id: 105, name: 'Abbey Road', artist: 'The Beatles', cover: generateCover('Abbey Road'), tracks: 17 },
    { id: 106, name: 'The Dark Side of the Moon', artist: 'Pink Floyd', cover: generateCover('Dark Side'), tracks: 10 },
];

// ===== ARTIST DATABASE =====
const ARTIST_DB = {
    'the weeknd': {
        listeners: '85 000 000',
        bio: 'The Weeknd (Эйбел Макконен Тесфайе) — канадский певец, автор песен и продюсер. Один из самых успешных исполнителей современности, известный своим уникальным вокалом и мрачным R&B звучанием.',
        image: generateCover('theweeknd', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('The Weeknd')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'After Hours', cover: generateCover('After Hours'), year: '2020' }
    },
    'ed sheeran': {
        listeners: '70 000 000',
        bio: 'Эд Ширан — британский певец, автор песен и гитарист. Известен своими акустическими балладами и фолк-поп звучанием. Обладатель множества наград, включая Грэмми.',
        image: generateCover('edsheeran', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Ed Sheeran')).map(t => ({ ...t, artists: t.artist })),
        release: { name: '÷ (Divide)', cover: generateCover('Divide'), year: '2017' }
    },
    'queen': {
        listeners: '40 000 000',
        bio: 'Queen — британская рок-группа, образованная в 1970 году. Одна из самых влиятельных групп в истории музыки. Легендарный фронтмен Фредди Меркьюри.',
        image: generateCover('queen', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Queen')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'Bohemian Rhapsody (Soundtrack)', cover: generateCover('Bohemian Rhapsody'), year: '2018' }
    },
    'eagles': {
        listeners: '30 000 000',
        bio: 'Eagles — американская рок-группа, сформированная в 1971 году в Лос-Анджелесе. Одна из самых коммерчески успешных групп 1970-х годов.',
        image: generateCover('eagles', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Eagles')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'Hotel California', cover: generateCover('Hotel California'), year: '1976' }
    },
    'nirvana': {
        listeners: '35 000 000',
        bio: 'Nirvana — американская рок-группа, сформированная в 1987 году. Лидер группы Курт Кобейн стал голосом поколения. Группа считается одной из самых влиятельных в истории альтернативного рока.',
        image: generateCover('nirvana', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Nirvana')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'Nevermind', cover: generateCover('Nevermind'), year: '1991' }
    },
    'michael jackson': {
        listeners: '50 000 000',
        bio: 'Майкл Джексон — американский певец, автор песен и танцор, известный как «Король поп-музыки». Один из самых значимых культурных деятелей XX века.',
        image: generateCover('michaeljackson', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Michael Jackson')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'Thriller', cover: generateCover('Thriller'), year: '1982' }
    },
    'eminem': {
        listeners: '45 000 000',
        bio: 'Эминем (Маршалл Брюс Мэтерс III) — американский рэпер, продюсер и актёр. Один из самых продаваемых музыкальных исполнителей в мире.',
        image: generateCover('eminem', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Eminem')).map(t => ({ ...t, artists: t.artist })),
        release: { name: '8 Mile (Soundtrack)', cover: generateCover('8 Mile'), year: '2002' }
    },
    'oasis': {
        listeners: '25 000 000',
        bio: 'Oasis — британская рок-группа, сформированная в 1991 году. Одна из главных групп брит-поп-движения 1990-х годов.',
        image: generateCover('oasis', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('Oasis')).map(t => ({ ...t, artists: t.artist })),
        release: { name: "What's the Story Morning Glory?", cover: generateCover('Morning Glory'), year: '1995' }
    },
    'егор крид': {
        listeners: '12 000 000',
        bio: 'Егор Крид — российский певец, рэп-исполнитель и автор песен. Начал карьеру в 2012 году и быстро стал одним из самых популярных артистов в русскоязычном хип-хопе.',
        image: generateCover('egorkreed', 400),
        tracks: REAL_TRACKS.filter(t => t.artist.includes('ЕГОР КРИД')).map(t => ({ ...t, artists: t.artist })),
        release: { name: 'Malo 2.0', cover: generateCover('Malo 2.0'), year: '2026' }
    }
};

function getArtistData(name) {
    const key = name.toLowerCase().trim();
    // Try exact match first
    if (ARTIST_DB[key]) return ARTIST_DB[key];
    // Try partial match
    for (const [k, v] of Object.entries(ARTIST_DB)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    // Generate generic artist data
    return generateArtistData(name);
}

function generateArtistData(name) {
    const tracks = REAL_TRACKS.slice(0, 6).map((t, i) => ({
        ...t,
        id: 100 + i,
        artists: name,
        name: `${name} — Трек ${i + 1}`,
        cover: generateCover(`${name}${i}`)
    }));
    return {
        listeners: Math.floor(Math.random() * 10000000).toLocaleString('ru-RU'),
        bio: `${name} — музыкальный исполнитель. Информация загружается из базы данных.`,
        image: generateCover(name, 400),
        tracks: tracks,
        release: { name: 'Новый сингл', cover: generateCover(`${name}release`), year: '2026' }
    };
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
                <span class="source-tag">${track.source || 'Demo'}</span>
                ${track.hasAudio ? '<span class="source-tag" style="background:#10b981;color:#fff;">🎵</span>' : '<span class="source-tag" style="background:#ef4444;color:#fff;">⛔</span>'}
                ${track.genre ? `<span class="source-tag">${track.genre}</span>` : ''}
            </div>
            <div class="track-actions">
                <button class="btn-play" data-index="${idx}">${track.hasAudio ? '▶ Слушать' : '🎧 Демо'}</button>
                <button class="btn-download" data-index="${idx}" ${!track.hasAudio ? 'disabled' : ''}>⬇ Скачать</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (!state.isOnline && !state.tracks[idx]?.hasAudio) {
                showNotification('⚠️ Нет соединения', 'error');
                return;
            }
            playTrack(idx);
        });
    });

    container.querySelectorAll('.btn-download:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.isOnline) {
                showNotification('⚠️ Нет соединения', 'error');
                return;
            }
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
            const idx = parseInt(card.dataset.index);
            if (!state.isOnline && !state.tracks[idx]?.hasAudio) {
                showNotification('⚠️ Нет соединения', 'error');
                return;
            }
            playTrack(idx);
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
}

// ===== Artist Page =====
function showArtistPage(artistName) {
    const data = getArtistData(artistName);
    
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
                <div class="track-list-artists">${escapeHtml(track.artists || track.artist)}</div>
            </div>
            <span class="track-list-duration">${formatTime(track.duration)}</span>
            ${track.hasAudio ? '<span style="color:#10b981;font-size:12px;">🎵</span>' : '<span style="color:#ef4444;font-size:12px;">⛔</span>'}
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
                if (!state.isOnline && !track.hasAudio) {
                    showNotification('⚠️ Нет соединения', 'error');
                    return;
                }
                state.artistTracks = data.tracks.map(t => ({
                    ...t,
                    artist: t.artists || t.artist,
                    source: t.hasAudio ? 'Online' : 'Demo',
                    audio: t.audio || null,
                    hasAudio: t.hasAudio || false
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

    showPage('artist');
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
    if (!state.isOnline) {
        showNotification('⚠️ Нет соединения с интернетом', 'error', 3000);
        return;
    }
    
    const track = state.tracks[index];
    if (!track) return;
    
    state.currentIndex = index;
    state.currentTrack = track;
    
    updateMiniPlayer(track);
    updateFullscreenPlayer(track);
    
    if (track.hasAudio && track.audio) {
        dom.audioPlayer.src = track.audio;
        dom.audioPlayer.play().then(() => {
            state.isPlaying = true;
            updatePlayButtons();
        }).catch((err) => {
            console.error('Play error:', err);
            showNotification('⚠️ Не удалось воспроизвести трек', 'error');
            state.isPlaying = false;
            updatePlayButtons();
        });
    } else {
        showNotification(`🎧 Демо: ${track.name} — ${track.artist}`, 'info', 2000);
        state.isPlaying = true;
        updatePlayButtons();
        // Simulate playback for demo tracks
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
        else showNotification('Сначала выберите трек', 'info');
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
function performSearch(query) {
    if (!query.trim()) return;
    
    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
    }
    
    const results = state.tracks.filter(t => 
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        (t.genre && t.genre.toLowerCase().includes(query.toLowerCase()))
    );
    
    const albums = DEMO_ALBUMS.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.artist.toLowerCase().includes(query.toLowerCase())
    );
    
    const searchTracks = results.length > 0 ? results : state.tracks.slice(0, 8);
    state.tracks = searchTracks;
    state.playlist = searchTracks;
    
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
    
    renderTracks(searchTracks, document.getElementById('searchTracksContainer'));
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
        <div class="lyrics-line" style="margin-top:20px;color:var(--text-muted);">Текст песни загружается...</div>
        <div class="lyrics-line" style="color:var(--text-muted);">📝 Слова будут доступны в следующем обновлении</div>
    `;
    dom.lyricsModal.classList.remove('hidden');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    
    // Check initial online status
    checkOnlineStatus();
    
    setupUI();
    
    // Build initial tracks with audio
    state.tracks = buildTrackList();
    state.playlist = state.tracks;
    renderTracks(state.tracks, dom.tracksContainer);
    renderAlbums(DEMO_ALBUMS, dom.albumsContainer);
    
    // Set initial theme button
    dom.themeToggle.textContent = '🌙';
    
    console.log('🎵 MusicHub v4.0 loaded');
    console.log(`📊 ${state.tracks.filter(t => t.hasAudio).length} треков с аудио, ${state.tracks.filter(t => !t.hasAudio).length} демо-треков`);
});
