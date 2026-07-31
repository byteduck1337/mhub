// MusicHub 2027 - Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const pages = document.querySelectorAll('.page');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.dataset.page;
            
            // Update nav active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `page-${pageId}`) {
                    page.classList.add('active');
                }
            });
        });
    });
    
    // Filter chips on home page
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
    
    // Artist page content filters
    const contentChips = document.querySelectorAll('.chip[data-type]');
    contentChips.forEach(chip => {
        chip.addEventListener('click', () => {
            contentChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
    
    // Play buttons interaction
    const playButtons = document.querySelectorAll('.play-overlay, .play-pause');
    playButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const icon = btn.querySelector('i');
            if (icon.classList.contains('ri-play-fill')) {
                icon.classList.replace('ri-play-fill', 'ri-pause-fill');
            } else if (icon.classList.contains('ri-pause-circle-fill')) {
                icon.classList.replace('ri-pause-circle-fill', 'ri-play-circle-fill');
            } else if (icon.classList.contains('ri-play-circle-fill')) {
                icon.classList.replace('ri-play-circle-fill', 'ri-pause-circle-fill');
            }
        });
    });
    
    // Like buttons
    const likeBtns = document.querySelectorAll('.like-btn, .track-actions i.ri-heart-line');
    likeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('ri-heart-fill');
            btn.classList.toggle('ri-heart-line');
            if (btn.classList.contains('ri-heart-fill')) {
                btn.style.color = '#ef4444';
            } else {
                btn.style.color = '';
            }
        });
    });
    
    // Progress bar interaction
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const fill = progressBar.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = `${percent}%`;
            }
        });
    }
    
    // Volume control
    const volBar = document.querySelector('.vol-bar');
    if (volBar) {
        volBar.addEventListener('click', (e) => {
            const rect = volBar.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const fill = volBar.querySelector('.vol-fill');
            if (fill) {
                fill.style.width = `${percent}%`;
            }
        });
    }
    
    // Search focus effect
    const searchInput = document.querySelector('.search-container input');
    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            document.querySelector('.search-container').style.borderColor = 'var(--accent-orange)';
        });
        searchInput.addEventListener('blur', () => {
            document.querySelector('.search-container').style.borderColor = 'var(--border-subtle)';
        });
    }
    
    console.log('🎵 MusicHub 2027 loaded successfully!');
});
