// MusicHub v2.3

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
    isDownloading: false,
    albums: []
};

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
            throw new Error('SoundCloud API unavailable');
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

function getDemoTracks(query) {
    const DEMO_DB = [
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
        album: d.album || 'Compilation',
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

async function searchMusic(query) {
    if (!query.trim()) {
        showNotification('Enter a search query', 'info');
        return;
    }
    const errorId = `${ERROR_CODES.SEARCH_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Search: "${query}"`);

    if (!state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query);
        if (state.searchHistory.length > 10) state.searchHistory.pop();
        updateSearchHistory();
    }

    dom.tracksContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p style="margin-top:10px;color:var(--text-muted);">Searching tracks...</p>
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
            showNotification('📦 Loaded from cache', 'info', 2000);
        }

        if (tracks.length === 0) {
            try {
                const data = await API.itunes.search(query);
                if (data.results && data.results.length > 0) {
                    const itunesTracks = data.results
                        .filter(item => item.kind === 'song')
                        .map(item => ({
                            id: item.trackId,
                            name: item.trackName || 'Untitled',
                            artist: item.artistName || 'Unknown',
                            artistId: item.artistId,
                            album: item.collectionName || 'Album',
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
                                name: item.collectionName || 'Album',
                                artist: item.artistName || 'Unknown',
                                artistId: item.artistId,
                                cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                                tracks: item.trackCount || 0,
                                type: 'album'
                            });
                        }
                    });
                    albums = Array.from(albumsMap.values());
                }
            } catch (e) { console.debug('iTunes failed:', e); }

            if (tracks.length < API_CONFIG.MAX_TRACKS) {
                try {
                    const data = await API.soundcloud.search(query);
                    if (data.tracks && data.tracks.length > 0) {
                        const scTracks = data.tracks.map(item => ({
                            id: item.id || item.track_id,
                            name: item.title || item.name || 'Untitled',
                            artist: item.user?.username || item.artist || 'Unknown',
                            artistId: item.user?.id || item.artist_id || 0,
                            album: item.album?.title || item.album || 'Single',
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
                } catch (e) { console.debug('SoundCloud failed:', e); }
            }

            if (tracks.length < 10) {
                try {
                    const data = await API.jamendo.search(query);
                    if (data.results && data.results.length > 0) {
                        const jamendoTracks = data.results.map(item => ({
                            id: item.id,
                            name: item.name || 'Untitled',
                            artist: item.artist_name || 'Unknown',
                            artistId: item.artist_id,
                            album: item.album_name || 'Album',
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
                } catch (e) { console.debug('Jamendo failed:', e); }
            }

            if (tracks.length > 0) {
                saveToCache(cacheKey, { tracks, albums });
            }
        }

        if (tracks.length === 0) {
            tracks = getDemoTracks(query);
            albums = getDemoAlbums(query);
            showNotification('🎵 Demo mode (offline)', 'info', 3000);
        }

        state.tracks = tracks;
        state.playlist = tracks;
        state.albums = albums;
        state.currentIndex = 0;

        renderTracks(tracks);
        renderAlbums(albums);
        dom.resultsCount.textContent = `${tracks.length} tracks`;
        console.log(`[${errorId}] Found ${tracks.length} tracks`);

    } catch (error) {
        console.error(`[${errorId}] Error:`, error);
        const cacheKey = `search_${query.toLowerCase().trim()}`;
        const cached = loadFromCache(cacheKey);
        if (cached && cached.tracks && cached.tracks.length > 0) {
            state.tracks = cached.tracks;
            state.playlist = cached.tracks;
            renderTracks(cached.tracks);
            renderAlbums(cached.albums || []);
            dom.resultsCount.textContent = `${cached.tracks.length} tracks (cache)`;
            showNotification('📦 Restored from cache', 'info', 3000);
            return;
        }
        showNotification(`⚠️ Error: ${error.message}`, 'error', 4000);
        dom.tracksContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p style="font-size:18px;font-weight:600;color:#ef4444;">Loading error</p>
                <p style="font-size:12px;color:var(--text-muted);">Code: ${errorId}</p>
                <p style="font-size:14px;margin-top:8px;">${error.message}</p>
                <button onclick="searchMusic('popular')" 
                        style="margin-top:20px;padding:10px 30px;background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;">
                    ↻ Try again
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
                <p>Nothing found</p>
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
                    <button class="btn-play" data-index="${index}">▶</button>
                    <button class="btn-download" data-index="${index}" 
                            ${!hasDownload ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                        ⬇
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

function renderAlbums(albums) {
    if (!albums || albums.length === 0) {
        dom.albumsContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">
                No albums
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
            <span style="font-size:12px;color:var(--text-muted);">${album.tracks} tracks</span>
            <div class="actions" style="margin-top:10px;">
                <button class="btn-artist-album" data-artist="${escapeHtml(album.artist)}" data-artistid="${album.artistId}">👤 ${escapeHtml(album.artist)}</button>
                <button class="btn-album" data-albumid="${album.id}" style="flex:1;padding:8px 12px;border:none;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;transition:var(--transition);font-family:inherit;background:var(--accent);color:#fff;">💿</button>
            </div>
        </div>
    `).join('');

    dom.albumsContainer.querySelectorAll('.btn-artist-album').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showArtistV2(btn.dataset.artist, btn.dataset.artistid);
        });
    });

    dom.albumsContainer.querySelectorAll('.btn-album').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAlbumPage(parseInt(btn.dataset.albumid));
        });
    });

    dom.albumsContainer.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('dblclick', () => {
            showAlbumPage(parseInt(card.dataset.albumid));
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
// ARTIST PAGE
// ============================================================

async function showArtistV2(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Artist request: ${name}`);

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
            <p>Loading artist...</p>
        </div>
    `;

    try {
        let bio = 'No information available';
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
        } catch (e) { console.debug('Last.fm failed:', e); }

        try {
            const data = await API.itunes.search(name);
            if (data.results && data.results.length > 0) {
                artistTracks = data.results
                    .filter(item => item.kind === 'song')
                    .slice(0, 30)
                    .map(item => ({
                        id: item.trackId,
                        name: item.trackName || 'Untitled',
                        artist: item.artistName || name,
                        artistId: item.artistId,
                        album: item.collectionName || 'Album',
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
                        name: item.title || item.name || 'Untitled',
                        artist: item.user?.username || item.artist || name,
                        artistId: item.user?.id || item.artist_id || 0,
                        album: item.album?.title || item.album || 'Single',
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
            <div style="margin-bottom:20px;">
                <button onclick="closeArtistPageV2()" style="background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-secondary);padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;transition:var(--transition);">
                    ← Back
                </button>
            </div>
            <div class="artist-info-modern">
                <div class="artist-header">
                    <img src="${artistImage}" alt="${escapeHtml(name)}" class="artist-avatar" />
                    <div>
                        <div style="font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">Artist</div>
                        <h1 class="artist-name">${escapeHtml(name)}</h1>
                        <div class="artist-stats">
                            <span>📞 <strong>${listenersFormatted}</strong> listeners per month</span>
                            <span>🎵 <strong>${artistTracks.length}</strong> tracks</span>
                        </div>
                        <div class="artist-actions">
                            <button onclick="playArtistTopTrack()" style="padding:10px 28px;border:none;border-radius:50px;background:linear-gradient(135deg,var(--accent),#a855f7);color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:var(--transition);font-family:inherit;">
                                ▶
                            </button>
                            <button onclick="showArtistTrailer('${escapeHtml(name)}')" style="padding:10px 28px;border:1px solid var(--border-color);border-radius:50px;background:var(--bg-primary);color:var(--text-secondary);font-weight:600;font-size:14px;cursor:pointer;transition:var(--transition);font-family:inherit;">
                                ▶ Trailer
                            </button>
                            <button onclick="toggleArtistFollow('${escapeHtml(name)}')" style="width:42px;height:42px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-secondary);font-size:20px;cursor:pointer;transition:var(--transition);display:flex;align-items:center;justify-content:center;">
                                ${isArtistFollowed(name) ? '❤️' : '♡'}
                            </button>
                        </div>
                    </div>
                </div>
                ${bio ? `<div class="artist-bio">${escapeHtml(bio)}</div>` : ''}
                ${stats.similar.length > 0 ? `
                    <div class="artist-similar">
                        ${stats.similar.slice(0, 8).map(s => `
                            <span class="similar-tag" onclick="showArtistV2('${escapeHtml(s)}', 0)">${escapeHtml(s)}</span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div style="background:var(--bg-card);border-radius:var(--radius);padding:24px;border:1px solid var(--border-color);margin-bottom:20px;">
                <h2 style="font-size:20px;font-weight:700;margin:0 0 16px 0;">🎵 Popular Tracks</h2>
                <div style="display:flex;flex-direction:column;gap:4px;">
                    ${topTracks.map((track, idx) => `
                        <div onclick="playArtistTrack(${idx})" style="display:flex;align-items:center;gap:16px;padding:10px 14px;border-radius:10px;cursor:pointer;transition:var(--transition);">
                            <span style="font-size:14px;color:var(--text-muted);min-width:32px;font-weight:600;">${String(idx + 1).padStart(2, '0')}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                <div style="font-size:13px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                                <span style="font-size:13px;color:var(--text-muted);">${formatTime(track.duration)}</span>
                                <button onclick="event.stopPropagation(); playArtistTrack(${idx})" style="width:32px;height:32px;border-radius:50%;border:none;background:var(--accent);color:#fff;cursor:pointer;transition:var(--transition);font-size:14px;">▶</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="background:var(--bg-card);border-radius:var(--radius);padding:24px;border:1px solid var(--border-color);margin-bottom:20px;">
                <h2 style="font-size:20px;font-weight:700;margin:0 0 16px 0;">🎶 All Tracks</h2>
                <div style="display:flex;flex-direction:column;gap:4px;">
                    ${artistTracks.map((track, idx) => `
                        <div onclick="playArtistTrack(${idx})" style="display:flex;align-items:center;gap:16px;padding:8px 14px;border-radius:10px;cursor:pointer;transition:var(--transition);">
                            <span style="font-size:14px;color:var(--text-muted);min-width:32px;font-weight:600;">${String(idx + 1).padStart(2, '0')}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                <div style="font-size:13px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                                <span style="font-size:13px;color:var(--text-muted);">${formatTime(track.duration)}</span>
                                <span style="font-size:10px;padding:2px 8px;border-radius:50px;background:var(--bg-primary);color:var(--text-muted);">${track.source || 'Unknown'}</span>
                                <button onclick="event.stopPropagation(); playArtistTrack(${idx})" style="width:32px;height:32px;border-radius:50%;border:none;background:var(--accent);color:#fff;cursor:pointer;transition:var(--transition);font-size:14px;">▶</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="background:var(--bg-card);border-radius:var(--radius);padding:24px;border:1px solid var(--border-color);">
                <h2 style="font-size:20px;font-weight:700;margin:0 0 16px 0;">📀 Latest Release</h2>
                ${artistTracks.length > 0 ? `
                    <div style="display:flex;align-items:center;gap:16px;padding:12px 16px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border-color);">
                        <img src="${artistTracks[0].cover}" alt="${escapeHtml(artistTracks[0].name)}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;" />
                        <div style="flex:1;">
                            <div style="font-weight:700;font-size:16px;">${escapeHtml(artistTracks[0].name)}</div>
                            <div style="font-size:14px;color:var(--text-secondary);">${escapeHtml(artistTracks[0].artist)}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${formatTime(artistTracks[0].duration)} · ${artistTracks[0].source || 'Unknown'}</div>
                        </div>
                        <button onclick="playArtistTrack(0)" style="width:40px;height:40px;border-radius:50%;border:none;background:var(--accent);color:#fff;cursor:pointer;transition:var(--transition);font-size:18px;">▶</button>
                    </div>
                ` : '<p style="color:var(--text-muted);">No releases yet</p>'}
            </div>
        `;

        state.artistTracks = artistTracks;
        state.tracks = artistTracks;
        state.playlist = artistTracks;
        state.currentIndex = 0;

    } catch (error) {
        console.error(`[${errorId}] Error:`, error);
        artistPage.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:20px;text-align:center;">
                <div style="font-size:48px;">⚠️</div>
                <p style="color:var(--text-secondary);">Could not load artist information</p>
                <button onclick="closeArtistPageV2()" style="padding:10px 30px;border:none;border-radius:50px;background:linear-gradient(135deg,var(--accent),#a855f7);color:#fff;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;">← Back</button>
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
        showNotification('Unfollowed artist', 'info', 2000);
    } else {
        followed.push(name);
        showNotification(`❤️ Followed ${name}`, 'success', 2000);
    }
    localStorage.setItem('musichub_followed', JSON.stringify(followed));
}

function showArtistTrailer(name) {
    showNotification(`🎬 Trailer for ${name} (demo mode)`, 'info', 3000);
}

// ============================================================
// ALBUM PAGE
// ============================================================

function showAlbumPage(albumId) {
    let album = null;
    let tracks = [];

    if (state.albums) {
        album = state.albums.find(a => a.id === albumId);
    }

    if (!album) {
        tracks = state.tracks.filter(t => t.albumId === albumId);
        if (tracks.length > 0) {
            album = {
                id: albumId,
                name: tracks[0].album || 'Album',
                artist: tracks[0].artist || 'Unknown Artist',
                cover: tracks[0].cover || 'https://via.placeholder.com/300',
                tracks: tracks.length
            };
        }
    }

    if (!album) {
        showNotification('Album not found', 'error');
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

    const artistName = album.artist || 'Unknown Artist';
    const trackList = state.tracks.filter(t => t.albumId === albumId).slice(0, 20);

    singlePage.innerHTML = `
        <div style="margin-bottom:20px;">
            <button onclick="closeSinglePageV2()" style="background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-secondary);padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;transition:var(--transition);">
                ← Back
            </button>
        </div>
        <div class="single-page-v2__hero">
            <img src="${album.cover}" alt="${escapeHtml(album.name)}" class="single-page-v2__cover" />
            <div class="single-page-v2__info">
                <div class="single-page-v2__badge">Album</div>
                <h1 class="single-page-v2__title">${escapeHtml(album.name)}</h1>
                <p class="single-page-v2__artists">${escapeHtml(artistName)}</p>
                <p class="single-page-v2__year">${album.releaseYear || '2026'} · ${trackList.length} tracks</p>
                <div class="single-page-v2__actions">
                    <button class="single-page-v2__btn-primary" onclick="playAlbumTracks()">▶</button>
                    <button class="single-page-v2__btn-icon" onclick="shareAlbum()">📤</button>
                </div>
                <div class="single-page-v2__tracklist">
                    ${trackList.map((t, i) => `
                        <div class="single-page-v2__tracklist-item" onclick="playTrackFromAlbum(${i})">
                            <span class="single-page-v2__tracklist-number">${String(i + 1).padStart(2, '0')}</span>
                            <span class="single-page-v2__tracklist-name">${escapeHtml(t.name)}</span>
                            <span class="single-page-v2__tracklist-duration">${formatTime(t.duration)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="single-page-v2__label">Label: ${album.label || 'Independent'}</div>
            </div>
        </div>
    `;

    state._albumTracks = trackList;
}

function closeSinglePageV2() {
    const singlePage = document.getElementById('singlePageV2');
    if (singlePage) singlePage.classList.add('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

function playAlbumTracks() {
    if (state._albumTracks && state._albumTracks.length > 0) {
        state.tracks = state._albumTracks;
        state.playlist = state._albumTracks;
        playTrack(0);
    }
}

function playTrackFromAlbum(index) {
    if (state._albumTracks && state._albumTracks[index]) {
        state.tracks = state._albumTracks;
        state.playlist = state._albumTracks;
        playTrack(index);
    }
}

function shareAlbum() {
    showNotification('📤 Share feature coming soon', 'info', 2000);
}

// ============================================================
// SINGLE PAGE (track detail)
// ============================================================

function showSinglePage(trackId) {
    let track = state.tracks.find(t => t.id === trackId);
    if (!track && state.artistTracks) track = state.artistTracks.find(t => t.id === trackId);
    if (!track) {
        showNotification('Track not found', 'error');
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
    const artistsDisplay = artists.length > 1 ? artists.slice(0, 3).join(', ') + (artists.length > 3 ? ` and ${artists.length - 3} more` : '') : track.artist;

    singlePage.innerHTML = `
        <div style="margin-bottom:20px;">
            <button onclick="closeSinglePageV2()" style="background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-secondary);padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;transition:var(--transition);">
                ← Back
            </button>
        </div>
        <div class="single-page-v2__hero">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" class="single-page-v2__cover" />
            <div class="single-page-v2__info">
                <div class="single-page-v2__badge">Single</div>
                <h1 class="single-page-v2__title">${escapeHtml(track.name)}</h1>
                <p class="single-page-v2__artists">${escapeHtml(artistsDisplay)}</p>
                <p class="single-page-v2__year">${year}</p>
                <div class="single-page-v2__actions">
                    <button class="single-page-v2__btn-primary" onclick="playSingleTrack(${track.id})">▶</button>
                    <button class="single-page-v2__btn-secondary" onclick="downloadSingleTrack(${track.id})">⬇</button>
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
                <div class="single-page-v2__label">Label: ${track.label || 'Independent'}</div>
                <div class="single-page-v2__meta">${track.source || 'Unknown'} · ${track.genre || 'Various'}</div>
            </div>
        </div>
    `;

    state.currentTrack = track;
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
// FULLSCREEN PLAYER
// ============================================================

function openFullscreenPlayer() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Select a track first', 'info');
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

    let lyricsHtml = '<p style="color:var(--text-muted);text-align:center;">Loading lyrics...</p>';
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
    showNotification('🔀 Shuffle ' + (btn?.style.color === 'var(--accent)' ? 'on' : 'off'), 'info', 2000);
}

function toggleFullscreenRepeat() {
    const btn = document.getElementById('fsRepeat');
    if (btn) btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    showNotification('🔁 Repeat ' + (btn?.style.color === 'var(--accent)' ? 'on' : 'off'), 'info', 2000);
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
        showNotification('Like removed', 'info', 1500);
    } else {
        liked.push(trackId);
        if (btn) btn.textContent = '❤️';
        showNotification('❤️ Added to favorites', 'success', 1500);
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
            if (lyricsContainer.innerHTML.includes('Loading lyrics')) {
                showLyrics();
                setTimeout(() => {
                    const newLyrics = document.getElementById('modalBody');
                    if (newLyrics && !newLyrics.innerHTML.includes('Loading')) {
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
            showNotification('➕ Added to playlist', 'success', 2000);
        } else {
            showNotification('Already in playlist', 'info', 2000);
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
    if (title) title.textContent = track.name || 'Untitled';
    if (artist) artist.textContent = track.artist || 'Unknown';
    if (artwork) artwork.src = track.cover || 'https://via.placeholder.com/300';
    if (playBtn) playBtn.textContent = state.isPlaying ? '⏸' : '▶';
}

// ============================================================
// PLAYER
// ============================================================

async function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Track not found', 'error');
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;

    if (!track.audio && !track.isDemo) {
        showNotification('🔇 No audio available', 'info', 3000);
        updatePlayerInfo(track);
        if (track.source === 'SoundCloud' && track.id) {
            try {
                const data = await API.soundcloud.getTrack(track.id);
                if (data && data.stream_url) {
                    track.audio = data.stream_url;
                }
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
        console.error(`[${errorId}] Error:`, err);
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
        showNotification(`⚠️ Playback error (${errorId})`, 'error', 4000);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
    updatePlayerInfo(track);
}

function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Untitled';
    dom.playerArtist.textContent = track.artist || 'Unknown';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
    dom.playerCover.alt = track.name || 'Cover';
}

// ============================================================
// DOWNLOAD
// ============================================================

async function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Track not found', 'error');
        return;
    }

    if (state.isDownloading) {
        showNotification('⏳ Download in progress', 'info', 2000);
        return;
    }

    const errorId = `${ERROR_CODES.DOWNLOAD_FAILED}_${Date.now()}`;
    console.log(`[${errorId}] Download: ${track.name}`);

    if (track.isDemo) {
        showNotification('🎵 Demo track unavailable', 'info', 3000);
        downloadTrackInfo(track);
        return;
    }

    let downloadUrl = track.downloadUrl;

    if (track.source === 'SoundCloud' && track.id && !downloadUrl) {
        try {
            showNotification('⏳ Getting link...', 'info', 2000);
            const data = await API.soundcloud.getTrack(track.id);
            if (data && data.downloadable && data.download_url) {
                downloadUrl = data.download_url;
            } else if (data && data.stream_url) {
                downloadUrl = `${data.stream_url}?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
                showNotification('⚠️ Streaming only available', 'warning', 3000);
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
            showNotification(`✅ ${track.name} downloading`, 'success', 3000);
            console.log(`[${errorId}] Download started`);
            setTimeout(() => { state.isDownloading = false; }, 5000);
        } catch (error) {
            console.error(`[${errorId}] Error:`, error);
            state.isDownloading = false;
            if (track.source === 'SoundCloud') {
                showNotification('⚠️ Download unavailable. Saving info.', 'warning', 4000);
                downloadTrackInfo(track);
            } else {
                showNotification(`⚠️ Error: ${error.message}`, 'error', 4000);
                downloadTrackInfo(track);
            }
        }
    } else {
        showNotification('🔇 Link unavailable, saving info', 'info', 3000);
        downloadTrackInfo(track);
    }
}

function downloadTrackInfo(track) {
    const text = `🎵 ${track.name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nArtist: ${track.artist}\nAlbum: ${track.album || 'Unknown'}\nSource: ${track.source || 'Unknown'}\nDuration: ${track.duration ? formatTime(track.duration) : 'Unknown'}\n${track.genre ? `Genre: ${track.genre}` : ''}\n\n🔗 Link: ${track.audio || track.permalink || 'Unavailable'}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${track.artist} - ${track.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification('📄 Info saved', 'info', 3000);
}

function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Playlist is empty', 'info');
        return;
    }
    let text = `🎵 MusicHub Playlist\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nDate: ${new Date().toLocaleString()}\nTracks: ${state.playlist.length}\n\n`;
    state.playlist.forEach((track, i) => {
        text += `${String(i+1).padStart(2, '0')}. ${track.artist || 'Unknown'} — ${track.name || 'Untitled'}\n`;
        text += `   🔗 ${track.audio || track.permalink || 'Link unavailable'}\n`;
        text += `   📁 ${track.source || 'Unknown'}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `playlist_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification(`✅ Playlist (${state.playlist.length} tracks)`, 'success', 3000);
}

// ============================================================
// LYRICS
// ============================================================

async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Select a track first', 'info');
        return;
    }
    dom.modalTitle.textContent = `📝 ${track.name} - ${track.artist}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        let lyrics = 'Lyrics not found 😔';
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
        dom.modalBody.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">❌ Could not load lyrics</div>`;
    }
}

function addToFavorites() {
    const track = state.currentTrack;
    if (!track) { showNotification('Select a track first', 'info'); return; }
    const favorites = JSON.parse(localStorage.getItem('musichub_favorites') || '[]');
    if (!favorites.some(f => f.id === track.id)) {
        favorites.push(track);
        localStorage.setItem('musichub_favorites', JSON.stringify(favorites));
        showNotification('❤️ Added to favorites', 'success', 2000);
    } else {
        showNotification('Already in favorites', 'info', 2000);
    }
}

async function shareTrack() {
    const track = state.currentTrack;
    if (!track) { showNotification('Select a track first', 'info'); return; }
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${track.name} - ${track.artist}`,
                text: `Listening to "${track.name}" by ${track.artist} on MusicHub`,
                url: track.permalink || track.audio || window.location.href
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                showNotification('Error sharing', 'error', 3000);
            }
        }
    } else {
        const text = `${track.name} - ${track.artist}\n${track.permalink || track.audio || window.location.href}`;
        navigator.clipboard.writeText(text)
            .then(() => showNotification('📋 Copied to clipboard', 'success', 2000))
            .catch(() => showNotification('Could not copy', 'error', 3000));
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

dom.playBtn.addEventListener('click', () => {
    const audio = dom.audio;
    if (!audio.src) {
        if (state.currentTrack) playTrack(state.currentIndex);
        else showNotification('Select a track first', 'info');
        return;
    }
    if (audio.paused) {
        audio.play().catch(() => showNotification('Playback error', 'error'));
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
    showNotification('⚠️ Playback error', 'error', 4000);
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
        showNotification('Select a track first', 'info');
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
    console.log('🎵 MusicHub v2.3 loaded');
    console.log(`📊 Mode: ${navigator.onLine ? 'Online' : 'Offline'}`);
    dom.audio.volume = state.volume;
    if (dom.volumeControl) dom.volumeControl.value = state.volume;
    const savedQuery = loadFromCache('last_search');
    if (savedQuery) {
        dom.searchInput.value = savedQuery;
        searchMusic(savedQuery);
    } else {
        searchMusic('popular');
    }
});

window.addEventListener('online', () => showNotification('🌐 Network restored', 'info', 3000));
window.addEventListener('offline', () => showNotification('📡 Offline mode', 'warning', 3000));

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
window.showAlbumPage = showAlbumPage;
window.playAlbumTracks = playAlbumTracks;
window.playTrackFromAlbum = playTrackFromAlbum;
window.shareAlbum = shareAlbum;
