import { dom, state, ERROR_CODES, API_CONFIG } from './config.js';

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export function initDom() {
    const elements = [
        'searchInput', 'searchBtn', 'searchHistory',
        'tracksContainer', 'albumsContainer',
        'resultsTitle', 'resultsCount',
        'artistSection', 'artistName', 'artistInfo', 'artistTracks',
        'backBtn',
        'playerCover', 'playerTitle', 'playerArtist',
        'playBtn', 'prevBtn', 'nextBtn',
        'progressBar', 'currentTime', 'totalTime',
        'volumeControl', 'audio',
        'downloadTrack', 'downloadPlaylist',
        'showLyrics', 'addToFavorites', 'shareTrack',
        'modal', 'modalTitle', 'modalBody', 'modalClose',
        'notification', 'themeToggle'
    ];
    elements.forEach(id => {
        dom[id] = document.getElementById(id);
    });
    dom.audio = document.getElementById('audioPlayer');
    return dom;
}

export function showNotification(message, type = 'info', duration = 4000) {
    const el = dom.notification;
    if (!el) return;
    el.textContent = message;
    el.className = `notification ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

export function saveToCache(key, data, duration = API_CONFIG.CACHE_DURATION) {
    try {
        localStorage.setItem(`musichub_${key}`, JSON.stringify({ data, timestamp: Date.now(), duration }));
    } catch (error) {
        console.error(`[${ERROR_CODES.CACHE_ERROR}]`, error);
    }
}
export function getImageUrl(url, fallback = 'https://picsum.photos/seed/' + Math.random() + '/300/300') {
    if (!url || url.includes('via.placeholder.com')) return fallback;
    return url;
}
export function loadFromCache(key) {
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

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return num.toLocaleString('ru-RU');
}

export function debounce(fn, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

export async function fetchWithTimeout(url, options = {}) {
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
