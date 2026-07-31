import { API_CONFIG, ERROR_CODES } from './config.js';
import { fetchWithTimeout } from './utils.js';

export const API = {
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
            const proxies = [
                `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${key}&format=json`,
                `https://corsproxy.io/?https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${key}&format=json`
            ];
            for (const url of proxies) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) return response.json();
                } catch (e) { console.debug('Last.fm proxy failed:', e); }
            }
            throw new Error('Last.fm API недоступен');
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
                `https://api-v2.soundcloud.com/search/tracks?q=${encodedQuery}&client_id=${clientId}&limit=${API_CONFIG.MAX_TRACKS}`,
                `https://corsproxy.io/?https://api.soundcloud.com/tracks?client_id=${clientId}&q=${encodedQuery}&limit=${API_CONFIG.MAX_TRACKS}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.soundcloud.com/tracks?client_id=${clientId}&q=${encodedQuery}&limit=${API_CONFIG.MAX_TRACKS}`)}`
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
                        else if (data.tracks) tracks = data.tracks;
                        return { tracks, raw: data };
                    }
                } catch (e) { console.debug('SoundCloud proxy failed:', e); }
            }
            return { tracks: [] };
        },
        searchArtists: async (query) => {
            const clientId = API_CONFIG.SOUNDCLOUD_CLIENT_ID;
            const url = `https://corsproxy.io/?https://api.soundcloud.com/users?client_id=${clientId}&q=${encodeURIComponent(query)}&limit=20`;
            try {
                const response = await fetchWithTimeout(url);
                if (response.ok) return response.json();
            } catch (e) { console.debug('SoundCloud artists search failed:', e); }
            return [];
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