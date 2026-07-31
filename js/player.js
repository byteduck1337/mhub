import { state, dom } from './config.js';
import { showNotification, formatTime } from './utils.js';
import { API } from './api.js';

export async function playTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    state.currentIndex = index;
    state.currentTrack = track;

    if (!track.audio && !track.isDemo) {
        showNotification('🔇 Нет ссылки для прослушивания', 'info', 3000);
        updatePlayerInfo(track);
        if (track.source === 'SoundCloud' && track.id) {
            try {
                const data = await API.soundcloud.getTrack(track.id);
                if (data && data.stream_url) track.audio = data.stream_url;
            } catch (e) { console.debug('Could not get SoundCloud stream:', e); }
        }
        if (!track.audio) return;
    }

    let audioUrl = track.audio;
    if (track.source === 'SoundCloud' && audioUrl && !audioUrl.startsWith('http')) {
        audioUrl = `${audioUrl}?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
    }

    const audio = dom.audio;
    audio.src = audioUrl || '';
    audio.load();

    try {
        await audio.play();
        state.isPlaying = true;
        dom.playBtn.textContent = '⏸';
        showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
    } catch (err) {
        console.error('Playback error:', err);
        if (track.source === 'SoundCloud' && track.id) {
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://api.soundcloud.com/tracks/${track.id}/stream?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`)}`;
                audio.src = proxyUrl;
                audio.load();
                await audio.play();
                state.isPlaying = true;
                dom.playBtn.textContent = '⏸';
                showNotification(`▶ ${track.name} - ${track.artist}`, 'info', 2000);
                return;
            } catch (e) { console.debug('SoundCloud proxy playback failed:', e); }
        }
        showNotification(`⚠️ Ошибка воспроизведения`, 'error', 4000);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
    updatePlayerInfo(track);
}

export function updatePlayerInfo(track) {
    dom.playerTitle.textContent = track.name || 'Без названия';
    dom.playerArtist.textContent = track.artist || 'Неизвестный';
    dom.playerCover.src = track.cover || 'https://via.placeholder.com/60';
    dom.playerCover.alt = track.name || 'Обложка';
}

export function togglePlay() {
    const audio = dom.audio;
    if (!audio.src) {
        if (state.currentTrack) playTrack(state.currentIndex);
        else showNotification('Сначала выберите трек', 'info');
        return;
    }
    if (audio.paused) {
        audio.play().catch(() => showNotification('Ошибка воспроизведения', 'error'));
        dom.playBtn.textContent = '⏸';
        state.isPlaying = true;
    } else {
        audio.pause();
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
    }
}

export function prevTrack() {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
    playTrack(state.currentIndex);
}

export function nextTrack() {
    if (state.tracks.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
    playTrack(state.currentIndex);
}

export function setupAudioEvents() {
    const audio = dom.audio;
    
    audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration)) {
            dom.progressBar.value = (audio.currentTime / audio.duration) * 100;
            dom.currentTime.textContent = formatTime(audio.currentTime);
            dom.totalTime.textContent = formatTime(audio.duration);
        }
    });

    dom.progressBar.addEventListener('input', () => {
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (dom.progressBar.value / 100) * audio.duration;
        }
    });

    audio.addEventListener('ended', () => {
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
        if (state.tracks.length > 1) {
            state.currentIndex = (state.currentIndex + 1) % state.tracks.length;
            playTrack(state.currentIndex);
        }
    });

    audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        dom.playBtn.textContent = '▶';
        state.isPlaying = false;
        showNotification('⚠️ Ошибка воспроизведения', 'error', 4000);
    });
}