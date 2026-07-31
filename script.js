// ===== CONFIG & STATE =====
const JAMENDO_CLIENT_ID = 'e0f5b4f3'; // Публичный ключ для демо
const API_URL = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=20`;

const state = {
    tracks: [],
    artistTracks: [],
    currentIdx: 0,
    isPlaying: false,
    currentTrack: null,
    history: JSON.parse(localStorage.getItem('mh_hist') || '[]'),
    liked: JSON.parse(localStorage.getItem('mh_liked') || '[]'),
    followed: JSON.parse(localStorage.getItem('mh_followed') || '[]')
};

const dom = {};

// ===== UTILS =====
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

function initDom() {
    ['searchInput', 'searchBtn', 'tracksContainer', 'albumsContainer', 'resultsTitle', 'resultsCount',
     'homeView', 'artistView', 'artAvatar', 'artName', 'artStats', 'artPlayBtn', 'artLikeBtn', 'artTrackList', 'artRelease',
     'mpCover', 'mpTitle', 'mpArtist', 'playBtn', 'prevBtn', 'nextBtn', 'progBar', 'curTime', 'totTime',
     'likeBtn', 'expandBtn', 'audio', 'fsPlayer', 'fsBg', 'fsImg', 'fsTitle', 'fsArtist', 
     'fsPlay', 'fsPrev', 'fsNext', 'fsProg', 'fsCur', 'fsTot', 'fsDownloadBtn',
     'toast'].forEach(id => dom[id] = document.getElementById(id));
}

function toast(msg, type='info') {
    const t = dom.toast;
    t.textContent = msg;
    t.className = `toast ${type}`;
    t.classList.remove('hidden');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add('hidden'), 3000);
}

function fmt(s) {
    if(!s || isNaN(s)) return '0:00';
    const m = Math.floor(s/60), sec = Math.floor(s%60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
}

function esc(t) {
    if(!t) return '';
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
}

// ===== NAVIGATION =====
function showHome() {
    dom.homeView.classList.add('active');
    dom.artistView.classList.add('hidden');
}

function showArtist(name) {
    dom.homeView.classList.remove('active');
    dom.artistView.classList.remove('hidden');
    loadArtistData(name);
}

$$('.nav-item').forEach(n => n.addEventListener('click', e => {
    e.preventDefault();
    $$('.nav-item').forEach(i => i.classList.remove('active'));
    n.classList.add('active');
    if(n.dataset.page === 'home') showHome();
    else if(n.dataset.page === 'search') {
        showHome();
        dom.searchInput.focus();
    }
}));

dom.logoLink?.addEventListener('click', () => {
    dom.searchInput.value = '';
    showHome();
    searchMusic('popular');
});

// ===== SEARCH LOGIC (REAL MUSIC) =====
dom.searchBtn.addEventListener('click', () => searchMusic(dom.searchInput.value));
dom.searchInput.addEventListener('keydown', e => {
    if(e.key === 'Enter') searchMusic(dom.searchInput.value);
});

async function searchMusic(q) {
    if(!q.trim()) return;
    
    // Save history
    if(!state.history.includes(q)) {
        state.history.unshift(q);
        if(state.history.length > 10) state.history.pop();
        localStorage.setItem('mh_hist', JSON.stringify(state.history));
    }

    dom.resultsTitle.textContent = ` "${esc(q)}"`;
    dom.tracksContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.albumsContainer.innerHTML = '';

    try {
        // Используем Jamendo для ПОЛНЫХ треков
        const url = `${API_URL}&search=${encodeURIComponent(q)}&order=popularity_week`;
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.results && data.results.length > 0) {
            const tracks = data.results.map(i => ({
                id: i.id, 
                name: i.name, 
                artist: i.artist_name,
                album: i.album_name, 
                cover: i.image ? i.image.replace('/static/', '/static/300/') : 'https://via.placeholder.com/300',
                audio: i.audio, // Прямая ссылка на MP3!
                duration: i.duration, 
                source: 'Jamendo',
                downloadUrl: i.audiodownload // Ссылка на скачивание
            }));

            state.tracks = tracks;
            renderTracks(tracks);
            dom.resultsCount.textContent = `${tracks.length} треков`;
            
            // Группируем альбомы (упрощенно)
            const albumsMap = new Map();
            tracks.forEach(t => {
                if(!albumsMap.has(t.album)) {
                    albumsMap.set(t.album, { name: t.album, artist: t.artist, cover: t.cover, count: 1 });
                } else {
                    albumsMap.get(t.album).count++;
                }
            });
            renderAlbums(Array.from(albumsMap.values()));
        } else {
            dom.tracksContainer.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">Ничего не найдено 😢</p>';
        }

    } catch(err) {
        toast('Ошибка сети или API', 'error');
        console.error(err);
    }
}

function renderTracks(list) {
    dom.tracksContainer.innerHTML = list.map((t,i) => `
        <div class="track-card" onclick="play(${i})">
            <img src="${t.cover}" onerror="this.src='https://via.placeholder.com/300'">
            <h3>${esc(t.name)}</h3>
            <p onclick="event.stopPropagation(); showArtist('${esc(t.artist)}')">${esc(t.artist)}</p>
            <div class="card-actions">
                <button class="btn-sm btn-play-sm" onclick="event.stopPropagation(); play(${i})">▶ Слушать</button>
                <button class="btn-sm btn-dl-sm" onclick="event.stopPropagation(); downloadTrack(${i})">⬇ MP3</button>
            </div>
        </div>
    `).join('');
}

function renderAlbums(list) {
    dom.albumsContainer.innerHTML = list.slice(0, 6).map(a => `
        <div class="track-card">
            <img src="${a.cover}" onerror="this.src='https://via.placeholder.com/300'">
            <h3>${esc(a.name)}</h3>
            <p onclick="showArtist('${esc(a.artist)}')">${esc(a.artist)}</p>
            <span style="font-size:12px;color:#666">${a.count} треков</span>
        </div>
    `).join('');
}

// ===== ARTIST PAGE =====
async function loadArtistData(name) {
    dom.artName.textContent = name;
    dom.artAvatar.src = `https://api.jamendo.com/v3.0/artists/?client_id=${JAMENDO_CLIENT_ID}&search=${encodeURIComponent(name)}&imagesize=400&limit=1`.then(r=>r.json()).then(d => d.results[0]?.image || `https://picsum.photos/seed/${name}/400/400`).catch(() => `https://picsum.photos/seed/${name}/400/400`);
    
    dom.artTrackList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    dom.artLikeBtn.textContent = state.followed.includes(name) ? '❤️' : '♡';
    dom.artLikeBtn.onclick = () => toggleFollow(name);

    try {
        // Получаем треки артиста
        const url = `${API_URL}&artist_name=${encodeURIComponent(name)}&order=popularity_total&limit=20`;
        const res = await fetch(url);
        const data = await res.json();
        
        const tracks = (data.results || []).map(i => ({
            id: i.id, name: i.name, artist: i.artist_name,
            album: i.album_name, cover: i.image ? i.image.replace('/static/', '/static/300/') : 'https://via.placeholder.com/300',
            audio: i.audio, duration: i.duration, source: 'Jamendo', downloadUrl: i.audiodownload
        }));

        state.artistTracks = tracks;
        dom.artStats.textContent = `${tracks.length} треков доступно`;
        
        dom.artTrackList.innerHTML = tracks.map((t,i) => `
            <div class="tl-item" onclick="playArtist(${i})">
                <span class="tl-num">${String(i+1).padStart(2,'0')}</span>
                <img src="${t.cover}" class="tl-img">
                <div class="tl-info">
                    <div class="tl-name">${esc(t.name)}</div>
                    <div class="tl-sub">${esc(t.album)}</div>
                </div>
                <span class="tl-dur">${fmt(t.duration)}</span>
                <button class="tl-play" onclick="event.stopPropagation(); playArtist(${i})">▶</button>
            </div>
        `).join('');

        if(tracks.length > 0) {
            const latest = tracks[0];
            dom.artRelease.innerHTML = `
                <img src="${latest.cover}">
                <div class="rel-info">
                    <h4>${esc(latest.album)}</h4>
                    <p>Альбом · Jamendo</p>
                </div>
            `;
        }

        dom.artPlayBtn.onclick = () => {
            if(tracks.length) { state.tracks = tracks; state.artistTracks = tracks; play(0); }
        };

    } catch(err) {
        dom.artTrackList.innerHTML = '<p style="color:#666">Ошибка загрузки треков</p>';
    }
}

function toggleFollow(name) {
    if(state.followed.includes(name)) {
        state.followed = state.followed.filter(f => f !== name);
        dom.artLikeBtn.textContent = '♡';
        toast('Отписка');
    } else {
        state.followed.push(name);
        dom.artLikeBtn.textContent = '❤️';
        toast(`Вы подписались на ${name}`, 'success');
    }
    localStorage.setItem('mh_followed', JSON.stringify(state.followed));
}

function playArtist(idx) {
    state.tracks = state.artistTracks;
    play(idx);
}

// ===== PLAYER & DOWNLOAD =====
function play(idx) {
    const t = state.tracks[idx];
    if(!t) return;
    
    state.currentIdx = idx;
    state.currentTrack = t;
    
    // Update UI
    dom.mpCover.src = t.cover;
    dom.mpTitle.textContent = t.name;
    dom.mpArtist.textContent = t.artist;
    updateLikeBtn();

    // Audio Logic
    const a = dom.audio;
    a.src = t.audio; // Jamendo дает прямую ссылку
    a.load();
    a.play().then(() => {
        state.isPlaying = true;
        updatePlayIcons();
    }).catch(e => {
        console.error(e);
        toast('Не удалось воспроизвести', 'error');
    });
}

function togglePlay() {
    const a = dom.audio;
    if(a.paused) { a.play(); state.isPlaying = true; }
    else { a.pause(); state.isPlaying = false; }
    updatePlayIcons();
}

function updatePlayIcons() {
    const icon = state.isPlaying ? '⏸' : '▶';
    dom.playBtn.textContent = icon;
    dom.fsPlay.textContent = icon;
}

function updateLikeBtn() {
    const isLiked = state.liked.includes(state.currentTrack?.id);
    dom.likeBtn.textContent = isLiked ? '❤️' : '🤍';
}

// Controls
dom.playBtn.onclick = togglePlay;
dom.prevBtn.onclick = () => { state.currentIdx = (state.currentIdx - 1 + state.tracks.length) % state.tracks.length; play(state.currentIdx); };
dom.nextBtn.onclick = () => { state.currentIdx = (state.currentIdx + 1) % state.tracks.length; play(state.currentIdx); };
dom.likeBtn.onclick = () => {
    if(!state.currentTrack) return;
    const id = state.currentTrack.id;
    if(state.liked.includes(id)) state.liked = state.liked.filter(i=>i!==id);
    else state.liked.push(id);
    localStorage.setItem('mh_liked', JSON.stringify(state.liked));
    updateLikeBtn();
};

// Progress Bar
dom.audio.addEventListener('timeupdate', () => {
    const a = dom.audio;
    if(a.duration) {
        const pct = (a.currentTime / a.duration) * 100;
        dom.progBar.value = pct;
        dom.curTime.textContent = fmt(a.currentTime);
        dom.totTime.textContent = fmt(a.duration);
        
        dom.fsProg.value = pct;
        dom.fsCur.textContent = fmt(a.currentTime);
        dom.fsTot.textContent = fmt(a.duration);
    }
});

dom.progBar.oninput = () => { dom.audio.currentTime = (dom.progBar.value / 100) * dom.audio.duration; };
dom.fsProg.oninput = () => { dom.audio.currentTime = (dom.fsProg.value / 100) * dom.audio.duration; };

// Fullscreen Player
function openFullscreen() {
    if(!state.currentTrack) return;
    dom.fsPlayer.classList.remove('hidden');
    dom.fsImg.src = state.currentTrack.cover;
    dom.fsTitle.textContent = state.currentTrack.name;
    dom.fsArtist.textContent = state.currentTrack.artist;
    dom.fsBg.style.backgroundImage = `url(${state.currentTrack.cover})`;
}

function closeFullscreen() { dom.fsPlayer.classList.add('hidden'); }

dom.expandBtn.onclick = openFullscreen;
dom.fsPrev.onclick = dom.prevBtn.onclick;
dom.fsNext.onclick = dom.nextBtn.onclick;
dom.fsPlay.onclick = togglePlay;

// REAL DOWNLOAD FUNCTION
window.downloadTrack = function(idx) {
    const t = state.tracks[idx];
    if(!t || !t.downloadUrl) {
        toast('Ссылка на скачивание недоступна', 'error');
        return;
    }
    
    // Создаем временную ссылку для скачивания
    const link = document.createElement('a');
    link.href = t.downloadUrl;
    link.download = `${t.artist} - ${t.name}.mp3`;
    link.target = '_blank'; // Иногда нужно для обхода блокировок браузера
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast(` Скачивание: ${t.name}`, 'success');
};

// Кнопка скачивания в фуллскрине
dom.fsDownloadBtn.onclick = () => {
    if(state.currentTrack) {
        const idx = state.tracks.findIndex(t => t.id === state.currentTrack.id);
        if(idx !== -1) downloadTrack(idx);
    }
};

// Keyboard Shortcuts
document.addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT') return;
    if(e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if(e.code === 'ArrowRight') dom.nextBtn.click();
    if(e.code === 'ArrowLeft') dom.prevBtn.click();
    if(e.code === 'Escape') { closeFullscreen(); }
});

// Init
initDom();
if(navigator.onLine) searchMusic('popular');
else toast('Нет соединения', 'error');
