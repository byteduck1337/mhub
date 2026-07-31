import { state, dom, API_CONFIG } from './config.js';
import { initDom, showNotification, loadFromCache } from './utils.js';
import { searchMusic, updateSearchHistory } from './search.js';
import { setupUI } from './ui.js';
import { setupAudioEvents } from './player.js';

// Initialize DOM
initDom();

// Initialize UI
setupUI();

// Set initial volume
dom.audio.volume = state.volume;

// Load last search or default
const savedQuery = loadFromCache('last_search');
if (savedQuery) {
    dom.searchInput.value = savedQuery;
    searchMusic(savedQuery);
} else {
    searchMusic('популярное');
}

console.log('🎵 MusicHub v2.3 загружен');
console.log(`📊 Режим: ${navigator.onLine ? 'Online' : 'Offline'}`);

// Export for console debugging
window.musicHub = { 
    search: searchMusic, 
    play: window.playTrack, 
    state: state, 
    API: window.API, 
    download: window.downloadTrack 
};