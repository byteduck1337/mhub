// MusicHub 2027 — Configuration

export const state = {
    currentTrack: null,
    isPlaying: false,
    volume: 0.8,
    tracks: [],
    playlist: [],
    currentIndex: 0,
    searchHistory: [],
    favorites: [],
    modalOpen: false
};

export const dom = {
    searchInput: null,
    searchBtn: null,
    tracksContainer: null,
    albumsContainer: null,
    playerTitle: null,
    playerArtist: null,
    playerCover: null,
    playBtn: null,
    prevBtn: null,
    nextBtn: null,
    progressBar: null,
    audioPlayer: null,
    notification: null
};

export const API_CONFIG = {
    itunes: {
        baseUrl: 'https://itunes.apple.com/search',
        timeout: 10000
    },
    soundcloud: {
        baseUrl: 'https://api.soundcloud.com',
        timeout: 10000
    }
};

export const ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_ERROR: 'API_ERROR',
    NOT_FOUND: 'NOT_FOUND'
};

// Initialize DOM references
export function initDom() {
    dom.searchInput = document.getElementById('searchInput');
    dom.searchBtn = document.getElementById('searchBtn');
    dom.tracksContainer = document.getElementById('tracksContainer');
    dom.albumsContainer = document.getElementById('albumsContainer');
    dom.playerTitle = document.getElementById('playerTitle');
    dom.playerArtist = document.getElementById('playerArtist');
    dom.playerCover = document.getElementById('playerCover');
    dom.playBtn = document.getElementById('playBtn');
    dom.prevBtn = document.getElementById('prevBtn');
    dom.nextBtn = document.getElementById('nextBtn');
    dom.progressBar = document.getElementById('progressBar');
    dom.audioPlayer = document.getElementById('audioPlayer');
    dom.notification = document.getElementById('notification');
}

console.log('🎵 MusicHub config loaded');
