import { state, dom } from './config.js';
import { showNotification, formatTime } from './utils.js';
import { API } from './api.js';

export async function downloadTrack(index) {
    const track = state.tracks[index];
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    if (state.isDownloading) {
        showNotification('⏳ Уже идёт загрузка', 'info', 2000);
        return;
    }

    if (track.isDemo) {
        showNotification('🎵 Демо-трек недоступен для скачивания', 'info', 3000);
        downloadTrackInfo(track);
        return;
    }

    let downloadUrl = track.downloadUrl;

    if (track.source === 'SoundCloud' && track.id && !downloadUrl) {
        try {
            showNotification('⏳ Получение ссылки...', 'info', 2000);
            const data = await API.soundcloud.getTrack(track.id);
            if (data && data.downloadable && data.download_url) {
                downloadUrl = data.download_url;
            } else if (data && data.stream_url) {
                downloadUrl = `${data.stream_url}?client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
                showNotification('⚠️ Доступен только стриминг', 'warning', 3000);
            }
        } catch (e) { console.debug('Could not get download URL:', e); }
    }

    if (track.source === 'Jamendo' && track.audio && !downloadUrl) {
        downloadUrl = track.audio;
    }

    if (downloadUrl) {
        state.isDownloading = true;
        try {
            if (track.source === 'SoundCloud' && !downloadUrl.includes('client_id')) {
                downloadUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}client_id=${API_CONFIG.SOUNDCLOUD_CLIENT_ID}`;
            }
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${track.artist} - ${track.name}.mp3`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification(`✅ ${track.name} скачивается`, 'success', 3000);
            setTimeout(() => { state.isDownloading = false; }, 5000);
        } catch (error) {
            console.error('Download error:', error);
            state.isDownloading = false;
            showNotification(`⚠️ Ошибка: ${error.message}`, 'error', 4000);
            downloadTrackInfo(track);
        }
    } else {
        showNotification('🔇 Ссылка недоступна, сохраняем информацию', 'info', 3000);
        downloadTrackInfo(track);
    }
}

export function downloadTrackInfo(track) {
    const text = `🎵 ${track.name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nИсполнитель: ${track.artist}\nАльбом: ${track.album || 'Неизвестен'}\nИсточник: ${track.source || 'Неизвестен'}\nДлительность: ${track.duration ? formatTime(track.duration) : 'Неизвестно'}\n${track.genre ? `Жанр: ${track.genre}` : ''}\n\n🔗 Ссылка: ${track.audio || track.permalink || 'Недоступна'}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${track.artist} - ${track.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification('📄 Информация сохранена', 'info', 3000);
}

export function downloadPlaylist() {
    if (!state.playlist || state.playlist.length === 0) {
        showNotification('Плейлист пуст', 'info');
        return;
    }
    let text = `🎵 Плейлист MusicHub\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nДата: ${new Date().toLocaleString()}\nТреков: ${state.playlist.length}\n\n`;
    state.playlist.forEach((track, i) => {
        text += `${String(i+1).padStart(2, '0')}. ${track.artist || 'Неизвестный'} — ${track.name || 'Без названия'}\n`;
        text += `   🔗 ${track.audio || track.permalink || 'Ссылка недоступна'}\n`;
        text += `   📁 ${track.source || 'Неизвестен'}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `плейлист_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showNotification(`✅ Плейлист (${state.playlist.length} треков)`, 'success', 3000);
}