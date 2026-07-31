// MusicHub 2027 — Main Application Logic
import { state, dom } from './config.js';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initFilters();
    initPlayer();
    loadDemoContent();
});

// Navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            
            // Update active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Navigate
            navigateTo(page);
        });
    });
    
    // Logo click
    document.getElementById('logoLink')?.addEventListener('click', () => {
        navigateTo('home');
    });
}

function navigateTo(page) {
    const heroSection = document.getElementById('heroSection');
    const resultsSection = document.getElementById('resultsSection');
    const browseSection = document.getElementById('browseSection');
    const albumsSection = document.getElementById('albumsSection');
    const artistPage = document.getElementById('artistPageV2');
    const filtersSection = document.getElementById('filtersSection');
    const backBtn = document.getElementById('backBtn');
    const pageTitle = document.getElementById('pageTitle');
    
    // Hide all sections first
    heroSection?.classList.add('hidden');
    resultsSection?.classList.add('hidden');
    browseSection?.classList.add('hidden');
    albumsSection?.classList.add('hidden');
    artistPage?.classList.add('hidden');
    filtersSection.style.display = 'none';
    backBtn.style.display = 'none';
    
    switch(page) {
        case 'home':
            pageTitle.textContent = 'Главная';
            heroSection?.classList.remove('hidden');
            browseSection?.classList.remove('hidden');
            albumsSection?.classList.remove('hidden');
            loadDemoContent();
            break;
        case 'browse':
            pageTitle.textContent = 'Обзор';
            browseSection?.classList.remove('hidden');
            break;
        case 'artists':
            pageTitle.textContent = 'Артисты';
            filtersSection.style.display = 'flex';
            resultsSection?.classList.remove('hidden');
            break;
        case 'albums':
            pageTitle.textContent = 'Альбомы';
            albumsSection?.classList.remove('hidden');
            break;
        case 'favorites':
            pageTitle.textContent = 'Избранное';
            filtersSection.style.display = 'flex';
            resultsSection?.classList.remove('hidden');
            break;
    }
}

// Search
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchBtn?.addEventListener('click', () => {
        performSearch(searchInput.value);
    });
    
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });
}

function performSearch(query) {
    if (!query.trim()) return;
    
    const filtersSection = document.getElementById('filtersSection');
    const resultsSection = document.getElementById('resultsSection');
    const pageTitle = document.getElementById('pageTitle');
    
    filtersSection.style.display = 'flex';
    resultsSection?.classList.remove('hidden');
    pageTitle.textContent = `Поиск: ${query}`;
    
    // Render demo tracks
    renderDemoTracks(query);
}

// Filters
function initFilters() {
    const filterChips = document.querySelectorAll('.filter-chip');
    
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            const filter = chip.dataset.filter;
            filterTracks(filter);
        });
    });
    
    const sortSelect = document.getElementById('sortSelect');
    sortSelect?.addEventListener('change', () => {
        sortTracks(sortSelect.value);
    });
}

function filterTracks(filter) {
    console.log('Filter:', filter);
    // Implement filtering logic
}

function sortTracks(sortBy) {
    console.log('Sort:', sortBy);
    // Implement sorting logic
}

// Player
function initPlayer() {
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');
    const volumeSlider = document.getElementById('volumeSlider');
    const audioPlayer = document.getElementById('audioPlayer');
    
    let isPlaying = false;
    
    playBtn?.addEventListener('click', () => {
        isPlaying = !isPlaying;
        updatePlayButton(isPlaying);
        
        if (isPlaying && audioPlayer) {
            audioPlayer.play().catch(e => console.log('Playback error:', e));
        } else if (audioPlayer) {
            audioPlayer.pause();
        }
    });
    
    prevBtn?.addEventListener('click', () => {
        console.log('Previous track');
    });
    
    nextBtn?.addEventListener('click', () => {
        console.log('Next track');
    });
    
    progressBar?.addEventListener('input', (e) => {
        const value = e.target.value;
        if (audioPlayer) {
            audioPlayer.currentTime = (value / 100) * audioPlayer.duration;
        }
    });
    
    volumeSlider?.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        if (audioPlayer) {
            audioPlayer.volume = value;
        }
    });
    
    // Update progress
    audioPlayer?.addEventListener('timeupdate', () => {
        if (audioPlayer && progressBar) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.value = progress || 0;
            
            // Update time display
            const currentTimeEl = document.getElementById('currentTime');
            const totalTimeEl = document.getElementById('totalTime');
            
            if (currentTimeEl) {
                currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
            }
            if (totalTimeEl && audioPlayer.duration) {
                totalTimeEl.textContent = formatTime(audioPlayer.duration);
            }
        }
    });
}

function updatePlayButton(isPlaying) {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    
    if (playIcon && pauseIcon) {
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Demo Content
function loadDemoContent() {
    renderDemoTracks('популярное');
    renderDemoAlbums();
}

function renderDemoTracks(query) {
    const container = document.getElementById('tracksContainer');
    if (!container) return;
    
    const demoTracks = [
        { id: 1, name: 'Midnight Dreams', artist: 'Luna Wave', duration: 245, cover: 'https://picsum.photos/seed/1/300/300' },
        { id: 2, name: 'Electric Soul', artist: 'Neon Pulse', duration: 198, cover: 'https://picsum.photos/seed/2/300/300' },
        { id: 3, name: 'Ocean Breeze', artist: 'Coastal Vibes', duration: 267, cover: 'https://picsum.photos/seed/3/300/300' },
        { id: 4, name: 'Urban Nights', artist: 'City Lights', duration: 223, cover: 'https://picsum.photos/seed/4/300/300' },
        { id: 5, name: 'Starlight', artist: 'Cosmic Journey', duration: 312, cover: 'https://picsum.photos/seed/5/300/300' },
    ];
    
    const countEl = document.getElementById('resultsCount');
    if (countEl) {
        countEl.textContent = `${demoTracks.length} треков`;
    }
    
    container.innerHTML = demoTracks.map((track, index) => `
        <div class="track-row" data-index="${index}">
            <button class="track-play-btn" onclick="window.playTrack(${index})">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;">
                    <polygon points="5,3 19,12 5,21"/>
                </svg>
            </button>
            <div class="track-info">
                <h3>${track.name}</h3>
                <p>${track.artist}</p>
            </div>
            <div class="track-waveform">
                ${Array.from({length: 20}, (_, i) => 
                    `<div class="waveform-mini" style="height:${Math.random() * 100}%"></div>`
                ).join('')}
            </div>
            <div class="track-duration">${formatTime(track.duration)}</div>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.track-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (!e.target.closest('.track-play-btn')) {
                const index = parseInt(row.dataset.index);
                window.playTrack(index);
            }
        });
    });
}

function renderDemoAlbums() {
    const container = document.getElementById('albumsContainer');
    if (!container) return;
    
    const demoAlbums = [
        { id: 1, name: 'After Hours', artist: 'The Weeknd', tracks: 14, cover: 'https://picsum.photos/seed/a1/300/300' },
        { id: 2, name: 'Future Nostalgia', artist: 'Dua Lipa', tracks: 11, cover: 'https://picsum.photos/seed/a2/300/300' },
        { id: 3, name: 'Fine Line', artist: 'Harry Styles', tracks: 12, cover: 'https://picsum.photos/seed/a3/300/300' },
        { id: 4, name: 'Hollywood\'s Bleeding', artist: 'Post Malone', tracks: 17, cover: 'https://picsum.photos/seed/a4/300/300' },
    ];
    
    container.innerHTML = demoAlbums.map(album => `
        <div class="album-card" data-album-id="${album.id}">
            <img src="${album.cover}" alt="${album.name}" loading="lazy" />
            <h3>${album.name}</h3>
            <p>${album.artist}</p>
            <span style="font-size:12px;color:var(--text-muted);">${album.tracks} треков</span>
        </div>
    `).join('');
}

// Global functions for onclick handlers
window.playTrack = function(index) {
    console.log('Playing track:', index);
    const track = {
        id: index,
        name: 'Demo Track',
        artist: 'Demo Artist',
        cover: 'https://picsum.photos/seed/' + index + '/300/300'
    };
    
    // Update player UI
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerCover = document.getElementById('playerCover');
    
    if (playerTitle) playerTitle.textContent = track.name;
    if (playerArtist) playerArtist.textContent = track.artist;
    if (playerCover) playerCover.src = track.cover;
    
    // Show notification
    showNotification(`▶️ Воспроизводится: ${track.name}`, 'success');
};

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

console.log('🎵 MusicHub 2027 loaded');
