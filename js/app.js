/**
 * MusicHub 2027 - Main Application Logic
 * Handles navigation, filters, and UI interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    initPlayer();
    initSearch();
});

// Navigation between views (Home, Artist Page, etc.)
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Get target section ID
            const targetId = item.getAttribute('data-target');
            
            // Hide all sections
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // Show target section if it exists
            const targetSection = document.getElementById(`view-${targetId}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Scroll to top
            document.querySelector('.main-content').scrollTop = 0;
        });
    });
}

// Filter chips interaction
function initFilters() {
    // Main page filter chips
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    // Artist page filter chips
    const artistFilterChips = document.querySelectorAll('.artist-filter-chip');
    artistFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            artistFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
}

// Player controls simulation
function initPlayer() {
    const playPauseBtn = document.querySelector('.play-pause-btn');
    const playerLikeBtn = document.querySelector('.player-like');
    const actionBtns = document.querySelectorAll('.action-btn');
    
    let isPlaying = false;
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            const icon = playPauseBtn.querySelector('i');
            
            if (isPlaying) {
                icon.classList.remove('fa-circle-play');
                icon.classList.add('fa-circle-pause');
            } else {
                icon.classList.remove('fa-circle-pause');
                icon.classList.add('fa-circle-play');
            }
        });
    }
    
    if (playerLikeBtn) {
        playerLikeBtn.addEventListener('click', () => {
            const icon = playerLikeBtn.querySelector('i');
            icon.classList.toggle('fa-regular');
            icon.classList.toggle('fa-solid');
            icon.style.color = icon.classList.contains('fa-solid') ? '#ff5500' : '';
        });
    }
    
    // Track list like buttons
    actionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const icon = btn.querySelector('i');
            if (icon.classList.contains('fa-heart')) {
                icon.classList.toggle('fa-regular');
                icon.classList.toggle('fa-solid');
                icon.style.color = icon.classList.contains('fa-solid') ? '#ff5500' : '';
            }
        });
    });
    
    // Volume slider interaction
    const volumeSlider = document.querySelector('.volume-slider');
    if (volumeSlider) {
        volumeSlider.addEventListener('click', (e) => {
            const rect = volumeSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const volumeLevel = volumeSlider.querySelector('.volume-level');
            if (volumeLevel) {
                volumeLevel.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            }
        });
    }
    
    // Progress bar interaction
    const progressBar = document.querySelector('.progress-bar-wrapper');
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const progressFill = progressBar.querySelector('.progress-bar-fill');
            if (progressFill) {
                progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            }
        });
    }
}

// Search functionality placeholder
function initSearch() {
    const searchInput = document.querySelector('.search-input');
    
    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            searchInput.parentElement.style.transform = 'scale(1.02)';
        });
        
        searchInput.addEventListener('blur', () => {
            searchInput.parentElement.style.transform = 'scale(1)';
        });
        
        // Cmd+K shortcut to focus search
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }
}

// Helper: Format play counts
function formatPlayCount(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

// Console welcome message
console.log('%c MusicHub 2027 ', 'background: linear-gradient(135deg, #ff5500, #7c3aed); color: white; padding: 10px 20px; font-size: 16px; font-weight: bold; border-radius: 5px;');
console.log('Hybrid Design: Apple Music x SoundCloud');
