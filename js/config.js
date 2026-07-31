export const ERROR_CODES = {
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

export const API_CONFIG = {
    JAMENDO_KEY: 'e0f5b4f3',
    LASTFM_KEY: 'b25b959554ed76058ac220b7b2e0a026',
    SOUNDCLOUD_CLIENT_ID: 'YOUR_SOUNDCLOUD_CLIENT_ID',
    TIMEOUT: 15000,
    MAX_TRACKS: 30,
    CACHE_DURATION: 3600000
};

export const state = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    modalOpen: false,
    artistTracks: [],
    searchHistory: [],
    volume: 0.8,
    isDownloading: false
};

export const dom = {};