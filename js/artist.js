import { state, dom, API_CONFIG } from './config.js';
import { showNotification, escapeHtml, formatTime, formatNumber, loadFromCache, saveToCache } from './utils.js';
import { API } from './api.js';
import { playTrack } from './player.js';
import { getDemoTracks } from './demo.js';

export async function showArtistV2(name, id) {
    let artistPage = document.getElementById('artistPageV2');
    if (!artistPage) {
        artistPage = document.createElement('div');
        artistPage.id = 'artistPageV2';
        artistPage.className = 'artist-page-v2';
        document.querySelector('main').appendChild(artistPage);
    }

    artistPage.classList.remove('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection, #artistSection').forEach(el => {
        if (el) el.classList.add('hidden');
    });

    artistPage.innerHTML = `
        <div class="artist-page-v2__loading">
            <div class="spinner"></div>
            <p>Загрузка исполнителя...</p>
        </div>
    `;

    try {
        let bio = 'Информация об исполнителе не найдена';
        let stats = { listeners: '?', plays: '?', similar: [] };
        let artistTracks = [];
        let topTracks = [];
        let artistImage = 'https://via.placeholder.com/400';

        try {
            const data = await API.lastfm.getArtistInfo(name);
            if (data && data.artist) {
                bio = data.artist.bio?.content || bio;
                stats.listeners = data.artist.stats?.listeners || '?';
                stats.plays = data.artist.stats?.playcount || '?';
                stats.similar = data.artist.similar?.artist?.map(a => a.name) || [];
                bio = bio.replace(/<[^>]+>/g, '').trim();
                if (bio.length > 500) bio = bio.slice(0, 500) + '...';
                if (data.artist.image) artistImage = data.artist.image[3]?.['#text'] || artistImage;
            }
        } catch (e) { console.debug('Last.fm не сработал:', e); }

        try {
            const data = await API.itunes.search(name);
            if (data.results && data.results.length > 0) {
                artistTracks = data.results
                    .filter(item => item.kind === 'song')
                    .slice(0, 30)
                    .map(item => ({
                        id: item.trackId,
                        name: item.trackName || 'Без названия',
                        artist: item.artistName || name,
                        artistId: item.artistId,
                        album: item.collectionName || 'Альбом',
                        cover: item.artworkUrl100 || 'https://via.placeholder.com/300',
                        audio: item.previewUrl,
                        duration: item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 0,
                        source: 'iTunes',
                        downloadUrl: null,
                        isExplicit: item.trackExplicitness === 'explicit'
                    }));
                topTracks = artistTracks.slice(0, 5);
            }
        } catch (e) { console.debug('iTunes artist tracks failed:', e); }

        if (artistTracks.length < 10) {
            try {
                const data = await API.soundcloud.search(name);
                if (data.tracks && data.tracks.length > 0) {
                    const scTracks = data.tracks.slice(0, 15).map(item => ({
                        id: item.id || item.track_id || Math.random() * 10000,
                        name: item.title || item.name || 'Без названия',
                        artist: item.user?.username || item.artist || name,
                        artistId: item.user?.id || item.artist_id || 0,
                        album: item.album?.title || item.album || 'Сингл',
                        cover: item.artwork_url || item.artwork_url?.replace('large', 't500x500') || 'https://via.placeholder.com/300',
                        audio: item.stream_url || item.audio_url,
                        duration: Math.floor((item.duration || 0) / 1000),
                        source: 'SoundCloud',
                        downloadUrl: item.download_url || null,
                        isExplicit: false
                    }));
                    artistTracks = artistTracks.concat(scTracks);
                    if (topTracks.length < 5) topTracks = scTracks.slice(0, 5);
                }
            } catch (e) { console.debug('SoundCloud artist tracks failed:', e); }
        }

        if (artistTracks.length === 0) {
            const demos = getDemoTracks(name);
            artistTracks = demos;
            topTracks = demos.slice(0, 5);
        }

        const listenersFormatted = formatNumber(parseInt(stats.listeners) || 0);

        artistPage.innerHTML = `
            <div class="artist-page-v2__header">
                <button class="artist-page-v2__back" onclick="window.closeArtistPageV2()">← Назад</button>
                <div class="artist-page-v2__hero">
                    <img src="${artistImage}" alt="${escapeHtml(name)}" class="artist-page-v2__avatar" />
                    <div class="artist-page-v2__info">
                        <div class="artist-page-v2__badge">Исполнитель</div>
                        <h1 class="artist-page-v2__name">${escapeHtml(name)}</h1>
                        <div class="artist-page-v2__stats">
                            <span>⏱ ${listenersFormatted} слушателей в месяц</span>
                            <span>🎵 ${artistTracks.length} треков</span>
                        </div>
                        <div class="artist-page-v2__actions">
                            <button class="artist-page-v2__btn-primary" onclick="window.playArtistTopTrack()">▶ Слушать</button>
                            <button class="artist-page-v2__btn-secondary" onclick="window.showArtistTrailer('${escapeHtml(name)}')">▶ Трейлер</button>
                            <button class="artist-page-v2__btn-icon" onclick="window.toggleArtistFollow('${escapeHtml(name)}')">
                                ${window.isArtistFollowed(name) ? '❤️' : '♡'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="artist-page-v2__content">
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Популярные треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${topTracks.map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="window.playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); window.playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Все треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${artistTracks.map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="window.playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}</div>
                                    <div class="artist-page-v2__track-artist">${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}</div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <span class="artist-page-v2__track-source">${track.source || 'Unknown'}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); window.playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${stats.similar.length > 0 ? `
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Похожие исполнители</h2>
                    <div class="artist-page-v2__similar">
                        ${stats.similar.slice(0, 8).map(s => `
                            <div class="artist-page-v2__similar-item" onclick="window.showArtistV2('${escapeHtml(s)}', 0)">
                                <div class="artist-page-v2__similar-avatar">${s.charAt(0)}</div>
                                <span class="artist-page-v2__similar-name">${escapeHtml(s)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">О исполнителе</h2>
                    <div class="artist-page-v2__bio">${escapeHtml(bio)}</div>
                </div>
            </div>
        `;

        state.artistTracks = artistTracks;
        state.tracks = artistTracks;
        state.playlist = artistTracks;
        state.currentIndex = 0;

    } catch (error) {
        console.error('Artist error:', error);
        artistPage.innerHTML = `
            <div class="artist-page-v2__error">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p>Не удалось загрузить информацию об исполнителе</p>
                <button onclick="window.closeArtistPageV2()" class="artist-page-v2__btn-primary">← Назад</button>
            </div>
        `;
    }
}

export function closeArtistPageV2() {
    const artistPage = document.getElementById('artistPageV2');
    if (artistPage) artistPage.classList.add('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

export function playArtistTopTrack() {
    if (state.artistTracks && state.artistTracks.length > 0) playTrack(0);
}

export function playArtistTrack(index) {
    if (state.artistTracks && state.artistTracks[index]) {
        state.tracks = state.artistTracks;
        state.playlist = state.artistTracks;
        playTrack(index);
    }
}

export function isArtistFollowed(name) {
    const followed = JSON.parse(localStorage.getItem('musichub_followed') || '[]');
    return followed.includes(name);
}

export function toggleArtistFollow(name) {
    let followed = JSON.parse(localStorage.getItem('musichub_followed') || '[]');
    if (followed.includes(name)) {
        followed = followed.filter(f => f !== name);
        showNotification('Отписка от исполнителя', 'info', 2000);
    } else {
        followed.push(name);
        showNotification(`❤️ Вы подписались на ${name}`, 'success', 2000);
    }
    localStorage.setItem('musichub_followed', JSON.stringify(followed));
}

export function showArtistTrailer(name) {
    showNotification(`🎬 Трейлер исполнителя ${name} (демо-режим)`, 'info', 3000);
}