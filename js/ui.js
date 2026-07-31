import { state, dom, API_CONFIG } from './config.js';
import { showNotification, loadFromCache, saveToCache, escapeHtml } from './utils.js';
import { searchMusic, updateSearchHistory, renderTracks } from './search.js';
import { playTrack, togglePlay, prevTrack, nextTrack, setupAudioEvents, updatePlayerInfo } from './player.js';
import { downloadTrack, downloadPlaylist } from './download.js';
import { showArtistV2, closeArtistPageV2, playArtistTopTrack, playArtistTrack, toggleArtistFollow, isArtistFollowed, showArtistTrailer } from './artist.js';
import { showSinglePage, closeSinglePageV2, playSingleTrack, downloadSingleTrack, shareSingleTrack } from './single.js';
import { openFullscreenPlayer, closeFullscreenPlayer, toggleFullscreenPlay, fullscreenPrev, fullscreenNext, toggleFullscreenShuffle, toggleFullscreenRepeat, toggleFullscreenLike, fullscreenDownload, fullscreenShare, fullscreenLyrics, fullscreenAddToPlaylist, updateFullscreenPlayerInfo, isTrackLiked } from './fullscreen.js';

export function setupUI() {
    // Search
    dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchMusic(dom.searchInput.value);
    });

    // Search filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    let currentFilter = 'all';
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            
            // Re-render with filter
            if (state.tracks && state.tracks.length > 0) {
                const filteredTracks = currentFilter === 'all' 
                    ? state.tracks 
                    : state.tracks.filter(t => t.source.toLowerCase().includes(currentFilter.slice(0, -1)) || currentFilter === 'tracks');
                renderTracks(filteredTracks);
            }
        });
    });

    // Back button
    dom.backBtn.addEventListener('click', () => {
        dom.artistSection.classList.add('hidden');
        dom.artistSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Player controls
    dom.playBtn.addEventListener('click', togglePlay);
    dom.prevBtn.addEventListener('click', prevTrack);
    dom.nextBtn.addEventListener('click', nextTrack);

    // Volume
    if (dom.volumeControl) {
        dom.volumeControl.addEventListener('input', () => {
            dom.audio.volume = parseFloat(dom.volumeControl.value);
            state.volume = dom.audio.volume;
        });
    }

    // Player buttons
    dom.showLyrics.addEventListener('click', showLyrics);
    dom.downloadTrack.addEventListener('click', () => {
        if (state.currentTrack) {
            const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
            if (idx !== -1) downloadTrack(idx);
            else downloadTrack(state.currentIndex);
        } else {
            showNotification('Сначала выберите трек', 'info');
        }
    });
    dom.downloadPlaylist.addEventListener('click', downloadPlaylist);
    if (dom.addToFavorites) dom.addToFavorites.addEventListener('click', addToFavorites);
    if (dom.shareTrack) dom.shareTrack.addEventListener('click', shareTrack);

    // Modal
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

    // Theme toggle
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

    // Player cover double click -> fullscreen
    dom.playerCover.addEventListener('dblclick', () => {
        if (state.currentTrack) openFullscreenPlayer();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.modalOpen) {
            dom.modal.classList.add('hidden');
            state.modalOpen = false;
        }
        if (e.target.tagName !== 'INPUT') {
            if (e.key === ' ') { e.preventDefault(); togglePlay(); }
            if (e.key === 'ArrowLeft') prevTrack();
            if (e.key === 'ArrowRight') nextTrack();
        }
    });

    // Fullscreen player keyboard shortcuts
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

    // Network events
    window.addEventListener('online', () => showNotification('🌐 Сеть восстановлена', 'info', 3000));
    window.addEventListener('offline', () => showNotification('📡 Нет соединения, работаю офлайн', 'warning', 3000));

    // Setup audio events
    setupAudioEvents();

    // Expose functions to window for onclick
    window.searchMusic = searchMusic;
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
    window.playTrack = playTrack;
    window.downloadTrack = downloadTrack;
}

export async function showLyrics() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }
    dom.modalTitle.textContent = `📝 ${track.name} - ${track.artist}`;
    dom.modalBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.modal.classList.remove('hidden');
    state.modalOpen = true;

    try {
        let lyrics = 'Текст не найден 😔';
        const sources = [
            async () => {
                try {
                    const searchUrl = `https://corsproxy.io/?https://api.genius.com/search?q=${encodeURIComponent(track.name + ' ' + track.artist)}`;
                    const response = await fetch(searchUrl);
                    const data = await response.json();
                    if (data.response?.hits?.length > 0) {
                        const url = data.response.hits[0].result.url;
                        const htmlRes = await fetch(`https://corsproxy.io/?${url}`);
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
                    const response = await fetch(url);
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
        console.error('Lyrics error:', error);
        dom.modalBody.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">❌ Не удалось загрузить текст</div>`;
    }
}

export function addToFavorites() {
    const track = state.currentTrack;
    if (!track) { showNotification('Сначала выберите трек', 'info'); return; }
    const favorites = JSON.parse(localStorage.getItem('musichub_favorites') || '[]');
    if (!favorites.some(f => f.id === track.id)) {
        favorites.push(track);
        localStorage.setItem('musichub_favorites', JSON.stringify(favorites));
        showNotification('❤️ Добавлено в избранное', 'success', 2000);
    } else {
        showNotification('Уже в избранном', 'info', 2000);
    }
}

export async function shareTrack() {
    const track = state.currentTrack;
    if (!track) { showNotification('Сначала выберите трек', 'info'); return; }
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${track.name} - ${track.artist}`,
                text: `Слушаю "${track.name}" от ${track.artist} на MusicHub`,
                url: track.permalink || track.audio || window.location.href
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                showNotification('Ошибка при открытии шеринга', 'error', 3000);
            }
        }
    } else {
        const text = `${track.name} - ${track.artist}\n${track.permalink || track.audio || window.location.href}`;
        navigator.clipboard.writeText(text)
            .then(() => showNotification('📋 Скопировано в буфер обмена', 'success', 2000))
            .catch(() => showNotification('Не удалось скопировать', 'error', 3000));
    }
}