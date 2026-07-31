// ============================================================
// НОВЫЕ ИНТЕРФЕЙСЫ: СТРАНИЦА ИСПОЛНИТЕЛЯ, СИНГЛА И ПОЛНОЭКРАННЫЙ ПЛЕЕР
// ============================================================

/**
 * Показывает страницу исполнителя в стиле музыкального сервиса
 */
async function showArtistV2(name, id) {
    const errorId = `${ERROR_CODES.ARTIST_NOT_FOUND}_${Date.now()}`;
    console.log(`[${errorId}] Запрос исполнителя: ${name}`);

    // Создаём или получаем контейнер для страницы исполнителя
    let artistPage = document.getElementById('artistPageV2');
    if (!artistPage) {
        artistPage = document.createElement('div');
        artistPage.id = 'artistPageV2';
        artistPage.className = 'artist-page-v2';
        document.querySelector('main').appendChild(artistPage);
    }

    // Показываем страницу и скрываем остальные секции
    artistPage.classList.remove('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection, #artistSection').forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Показываем загрузку
    artistPage.innerHTML = `
        <div class="artist-page-v2__loading">
            <div class="spinner"></div>
            <p>Загрузка исполнителя...</p>
        </div>
    `;

    try {
        // Получаем данные об исполнителе
        let bio = 'Информация об исполнителе не найдена';
        let stats = { listeners: '?', plays: '?', similar: [] };
        let artistTracks = [];
        let topTracks = [];
        let albums = [];
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
                if (data.artist.image) {
                    artistImage = data.artist.image[3]?.['#text'] || artistImage;
                }
            }
        } catch (e) {
            console.debug('Last.fm не сработал:', e);
        }

        // Получаем треки исполнителя
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
                
                // Топ треки (первые 5)
                topTracks = artistTracks.slice(0, 5);
            }
        } catch (e) {
            console.debug('iTunes artist tracks failed:', e);
        }

        // Пробуем SoundCloud для дополнительных треков
        if (artistTracks.length < 10) {
            try {
                const data = await API.soundcloud.search(name);
                if (data.tracks && data.tracks.length > 0) {
                    const scTracks = data.tracks
                        .slice(0, 15)
                        .map(item => ({
                            id: item.id || item.track_id,
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
                    if (topTracks.length < 5) {
                        topTracks = scTracks.slice(0, 5);
                    }
                }
            } catch (e) {
                console.debug('SoundCloud artist tracks failed:', e);
            }
        }

        // Если нет треков - демо
        if (artistTracks.length === 0) {
            const demos = getDemoTracks(name);
            artistTracks = demos;
            topTracks = demos.slice(0, 5);
        }

        // Форматируем слушателей
        const listenersFormatted = formatNumber(parseInt(stats.listeners) || 0);

        // Рендерим страницу исполнителя
        artistPage.innerHTML = `
            <div class="artist-page-v2__header">
                <button class="artist-page-v2__back" onclick="closeArtistPageV2()">
                    ← Назад
                </button>
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
                            <button class="artist-page-v2__btn-primary" onclick="playArtistTopTrack()">
                                ▶ Слушать
                            </button>
                            <button class="artist-page-v2__btn-secondary" onclick="showArtistTrailer('${escapeHtml(name)}')">
                                ▶ Трейлер
                            </button>
                            <button class="artist-page-v2__btn-icon" onclick="toggleArtistFollow('${escapeHtml(name)}')">
                                ${isArtistFollowed(name) ? '❤️' : '♡'}
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
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">
                                        ${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}
                                    </div>
                                    <div class="artist-page-v2__track-artist">
                                        ${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}
                                    </div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">Все треки</h2>
                    <div class="artist-page-v2__track-list">
                        ${artistTracks.map((track, idx) => `
                            <div class="artist-page-v2__track-item" onclick="playArtistTrack(${idx})">
                                <span class="artist-page-v2__track-number">${String(idx + 1).padStart(2, '0')}</span>
                                <div class="artist-page-v2__track-info">
                                    <div class="artist-page-v2__track-name">
                                        ${track.isExplicit ? '🔞 ' : ''}${escapeHtml(track.name)}
                                    </div>
                                    <div class="artist-page-v2__track-artist">
                                        ${escapeHtml(track.artist)} ${track.album ? `· ${escapeHtml(track.album)}` : ''}
                                    </div>
                                </div>
                                <div class="artist-page-v2__track-meta">
                                    <span class="artist-page-v2__track-duration">${formatTime(track.duration)}</span>
                                    <span class="artist-page-v2__track-source">${track.source || 'Unknown'}</span>
                                    <button class="artist-page-v2__track-play" onclick="event.stopPropagation(); playArtistTrack(${idx})">▶</button>
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
                            <div class="artist-page-v2__similar-item" onclick="showArtistV2('${escapeHtml(s)}', 0)">
                                <div class="artist-page-v2__similar-avatar">${s.charAt(0)}</div>
                                <span class="artist-page-v2__similar-name">${escapeHtml(s)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="artist-page-v2__section">
                    <h2 class="artist-page-v2__section-title">О исполнителе</h2>
                    <div class="artist-page-v2__bio">
                        ${escapeHtml(bio)}
                    </div>
                </div>
            </div>
        `;

        // Сохраняем треки в состояние
        state.artistTracks = artistTracks;
        state.tracks = artistTracks;
        state.playlist = artistTracks;
        state.currentIndex = 0;

    } catch (error) {
        console.error(`[${errorId}] Ошибка:`, error);
        artistPage.innerHTML = `
            <div class="artist-page-v2__error">
                <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
                <p>Не удалось загрузить информацию об исполнителе</p>
                <button onclick="closeArtistPageV2()" class="artist-page-v2__btn-primary">
                    ← Назад
                </button>
            </div>
        `;
    }
}

/**
 * Закрывает страницу исполнителя V2
 */
function closeArtistPageV2() {
    const artistPage = document.getElementById('artistPageV2');
    if (artistPage) {
        artistPage.classList.add('hidden');
    }
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

/**
 * Воспроизводит топ-трек исполнителя
 */
function playArtistTopTrack() {
    if (state.artistTracks && state.artistTracks.length > 0) {
        playTrack(0);
    }
}

/**
 * Воспроизводит трек на странице исполнителя
 */
function playArtistTrack(index) {
    if (state.artistTracks && state.artistTracks[index]) {
        state.tracks = state.artistTracks;
        state.playlist = state.artistTracks;
        playTrack(index);
    }
}

/**
 * Проверяет, подписан ли пользователь на исполнителя
 */
function isArtistFollowed(name) {
    const followed = JSON.parse(localStorage.getItem('musichub_followed') || '[]');
    return followed.includes(name);
}

/**
 * Переключает подписку на исполнителя
 */
function toggleArtistFollow(name) {
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

/**
 * Показывает трейлер исполнителя (демо-версия)
 */
function showArtistTrailer(name) {
    showNotification(`🎬 Трейлер исполнителя ${name} (демо-режим)`, 'info', 3000);
}

// ============================================================
// СТРАНИЦА СИНГЛА / АЛЬБОМА
// ============================================================

/**
 * Показывает страницу сингла в стиле музыкального сервиса
 */
function showSinglePage(trackId) {
    // Находим трек по ID
    let track = state.tracks.find(t => t.id === trackId);
    if (!track && state.artistTracks) {
        track = state.artistTracks.find(t => t.id === trackId);
    }
    if (!track) {
        showNotification('Трек не найден', 'error');
        return;
    }

    // Создаём или получаем контейнер
    let singlePage = document.getElementById('singlePageV2');
    if (!singlePage) {
        singlePage = document.createElement('div');
        singlePage.id = 'singlePageV2';
        singlePage.className = 'single-page-v2';
        document.querySelector('main').appendChild(singlePage);
    }

    // Показываем страницу
    singlePage.classList.remove('hidden');
    document.querySelectorAll('#resultsSection, #albumsSection, #artistSection, #artistPageV2').forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Форматируем дату (если есть)
    const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '2026';

    // Формируем список исполнителей
    const artists = track.artist.split(',').map(a => a.trim());
    const artistsDisplay = artists.length > 1 ? artists.slice(0, 3).join(', ') + (artists.length > 3 ? ` и ещё ${artists.length - 3} исполнителя` : '') : track.artist;

    singlePage.innerHTML = `
        <div class="single-page-v2__header">
            <button class="single-page-v2__back" onclick="closeSinglePageV2()">
                ← Назад
            </button>
        </div>
        <div class="single-page-v2__hero">
            <img src="${track.cover}" alt="${escapeHtml(track.name)}" class="single-page-v2__cover" />
            <div class="single-page-v2__info">
                <div class="single-page-v2__badge">Сингл</div>
                <h1 class="single-page-v2__title">${escapeHtml(track.name)}</h1>
                <p class="single-page-v2__artists">${escapeHtml(artistsDisplay)}</p>
                <p class="single-page-v2__year">${year}</p>
                <div class="single-page-v2__actions">
                    <button class="single-page-v2__btn-primary" onclick="playSingleTrack(${track.id})">
                        ▶ Слушать
                    </button>
                    <button class="single-page-v2__btn-secondary" onclick="downloadSingleTrack(${track.id})">
                        ⬇ Скачать
                    </button>
                    <button class="single-page-v2__btn-icon" onclick="shareSingleTrack(${track.id})">
                        📤
                    </button>
                    <span class="single-page-v2__plays">${Math.floor(Math.random() * 50000 + 1000).toLocaleString()}</span>
                </div>
                <div class="single-page-v2__tracklist">
                    <div class="single-page-v2__tracklist-item">
                        <span class="single-page-v2__tracklist-number">1</span>
                        <span class="single-page-v2__tracklist-name">${escapeHtml(track.name)}</span>
                        <span class="single-page-v2__tracklist-duration">${formatTime(track.duration)}</span>
                    </div>
                </div>
                <div class="single-page-v2__label">
                    Лейбл: ${track.label || '@58 Records'}
                </div>
                <div class="single-page-v2__meta">
                    Новые способы в этом выпуске
                </div>
            </div>
        </div>
    `;

    state.currentTrack = track;
}

/**
 * Закрывает страницу сингла V2
 */
function closeSinglePageV2() {
    const singlePage = document.getElementById('singlePageV2');
    if (singlePage) {
        singlePage.classList.add('hidden');
    }
    document.querySelectorAll('#resultsSection, #albumsSection').forEach(el => {
        if (el) el.classList.remove('hidden');
    });
}

/**
 * Воспроизводит трек со страницы сингла
 */
function playSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) {
            playTrack(idx);
        }
    }
}

/**
 * Скачивает трек со страницы сингла
 */
function downloadSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        const idx = state.tracks.indexOf(track);
        if (idx !== -1) {
            downloadTrack(idx);
        }
    }
}

/**
 * Шаринг трека со страницы сингла
 */
function shareSingleTrack(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        state.currentTrack = track;
        shareTrack();
    }
}

// ============================================================
// ПОЛНОЭКРАННЫЙ ПЛЕЕР
// ============================================================

/**
 * Открывает полноэкранный плеер
 */
function openFullscreenPlayer() {
    const track = state.currentTrack;
    if (!track) {
        showNotification('Сначала выберите трек', 'info');
        return;
    }

    let fullscreenPlayer = document.getElementById('fullscreenPlayer');
    if (!fullscreenPlayer) {
        fullscreenPlayer = document.createElement('div');
        fullscreenPlayer.id = 'fullscreenPlayer';
        fullscreenPlayer.className = 'fullscreen-player';
        document.body.appendChild(fullscreenPlayer);
    }

    fullscreenPlayer.classList.remove('hidden');

    // Получаем текст песни (если есть)
    let lyricsHtml = '<p style="color: var(--text-muted); text-align: center;">Загрузка текста...</p>';
    
    // Пробуем найти текст в кэше
    const lyricsCache = loadFromCache(`lyrics_${track.id}`);
    if (lyricsCache) {
        lyricsHtml = lyricsCache.split('\n').map(line => 
            `<div class="fullscreen-player__lyrics-line">${escapeHtml(line) || ' '}</div>`
        ).join('');
    }

    // Форматируем время
    const currentTimeFormatted = formatTime(dom.audio.currentTime || 0);
    const totalTimeFormatted = formatTime(track.duration || 0);

    // Определяем статус лайка
    const isLiked = isTrackLiked(track.id);

    fullscreenPlayer.innerHTML = `
        <div class="fullscreen-player__overlay" onclick="closeFullscreenPlayer()"></div>
        <div class="fullscreen-player__content">
            <button class="fullscreen-player__close" onclick="closeFullscreenPlayer()">✕</button>
            
            <div class="fullscreen-player__artwork">
                <img src="${track.cover}" alt="${escapeHtml(track.name)}" />
            </div>
            
            <div class="fullscreen-player__info">
                <h2 class="fullscreen-player__title">${escapeHtml(track.name)}</h2>
                <p class="fullscreen-player__artist">${escapeHtml(track.artist)}</p>
            </div>
            
            <div class="fullscreen-player__controls">
                <button class="fullscreen-player__control" onclick="toggleFullscreenShuffle()" id="fsShuffle">🔀</button>
                <button class="fullscreen-player__control" onclick="fullscreenPrev()">⏮</button>
                <button class="fullscreen-player__play" onclick="toggleFullscreenPlay()" id="fsPlayBtn">
                    ${state.isPlaying ? '⏸' : '▶'}
                </button>
                <button class="fullscreen-player__control" onclick="fullscreenNext()">⏭</button>
                <button class="fullscreen-player__control" onclick="toggleFullscreenRepeat()" id="fsRepeat">🔁</button>
            </div>
            
            <div class="fullscreen-player__progress">
                <span class="fullscreen-player__time" id="fsCurrentTime">${currentTimeFormatted}</span>
                <input type="range" class="fullscreen-player__progress-bar" id="fsProgressBar" 
                       min="0" max="100" value="${dom.progressBar.value || 0}" />
                <span class="fullscreen-player__time" id="fsTotalTime">${totalTimeFormatted}</span>
            </div>
            
            <div class="fullscreen-player__actions">
                <button class="fullscreen-player__action" onclick="toggleFullscreenLike(${track.id})" id="fsLikeBtn">
                    ${isLiked ? '❤️' : '🤍'}
                </button>
                <button class="fullscreen-player__action" onclick="fullscreenDownload()">⬇</button>
                <button class="fullscreen-player__action" onclick="fullscreenShare()">📤</button>
                <button class="fullscreen-player__action" onclick="fullscreenLyrics()">📝</button>
                <button class="fullscreen-player__action" onclick="fullscreenAddToPlaylist()">➕</button>
            </div>
            
            <div class="fullscreen-player__lyrics" id="fsLyrics">
                ${lyricsHtml}
            </div>
        </div>
    `;

    // Синхронизация прогресса
    const fsProgressBar = document.getElementById('fsProgressBar');
    const fsCurrentTime = document.getElementById('fsCurrentTime');
    const fsTotalTime = document.getElementById('fsTotalTime');

    if (fsProgressBar) {
        fsProgressBar.addEventListener('input', () => {
            const audio = dom.audio;
            if (audio.duration && !isNaN(audio.duration)) {
                audio.currentTime = (fsProgressBar.value / 100) * audio.duration;
            }
        });
    }

    // Обновляем время в полноэкранном режиме
    const updateFullscreenTime = () => {
        const audio = dom.audio;
        if (audio.duration && !isNaN(audio.duration)) {
            if (fsProgressBar) {
                fsProgressBar.value = (audio.currentTime / audio.duration) * 100;
            }
            if (fsCurrentTime) {
                fsCurrentTime.textContent = formatTime(audio.currentTime);
            }
            if (fsTotalTime) {
                fsTotalTime.textContent = formatTime(audio.duration);
            }
        }
    };

    // Обновляем каждые 500ms
    const fsInterval = setInterval(updateFullscreenTime, 500);
    
    // Сохраняем интервал для очистки
    fullscreenPlayer._interval = fsInterval;

    // Обработчик закрытия
    fullscreenPlayer._closeHandler = () => {
        clearInterval(fsInterval);
    };

    // Синхронизируем кнопку воспроизведения
    document.getElementById('fsPlayBtn').textContent = state.isPlaying ? '⏸' : '▶';
}

/**
 * Закрывает полноэкранный плеер
 */
function closeFullscreenPlayer() {
    const player = document.getElementById('fullscreenPlayer');
    if (player) {
        if (player._interval) {
            clearInterval(player._interval);
        }
        if (player._closeHandler) {
            player._closeHandler();
        }
        player.classList.add('hidden');
        player.innerHTML = '';
    }
}

/**
 * Переключает воспроизведение в полноэкранном режиме
 */
function toggleFullscreenPlay() {
    dom.playBtn.click();
    const btn = document.getElementById('fsPlayBtn');
    if (btn) {
        btn.textContent = state.isPlaying ? '⏸' : '▶';
    }
}

/**
 * Предыдущий трек в полноэкранном режиме
 */
function fullscreenPrev() {
    dom.prevBtn.click();
    updateFullscreenPlayerInfo();
}

/**
 * Следующий трек в полноэкранном режиме
 */
function fullscreenNext() {
    dom.nextBtn.click();
    updateFullscreenPlayerInfo();
}

/**
 * Переключает перемешивание
 */
function toggleFullscreenShuffle() {
    const btn = document.getElementById('fsShuffle');
    if (btn) {
        btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    }
    showNotification('🔀 Перемешивание ' + (btn?.style.color === 'var(--accent)' ? 'включено' : 'выключено'), 'info', 2000);
}

/**
 * Переключает повтор
 */
function toggleFullscreenRepeat() {
    const btn = document.getElementById('fsRepeat');
    if (btn) {
        btn.style.color = btn.style.color === 'var(--accent)' ? 'var(--text-secondary)' : 'var(--accent)';
    }
    showNotification('🔁 Повтор ' + (btn?.style.color === 'var(--accent)' ? 'включён' : 'выключен'), 'info', 2000);
}

/**
 * Проверяет, лайкнут ли трек
 */
function isTrackLiked(trackId) {
    const liked = JSON.parse(localStorage.getItem('musichub_liked') || '[]');
    return liked.includes(trackId);
}

/**
 * Переключает лайк в полноэкранном режиме
 */
function toggleFullscreenLike(trackId) {
    let liked = JSON.parse(localStorage.getItem('musichub_liked') || '[]');
    const btn = document.getElementById('fsLikeBtn');
    
    if (liked.includes(trackId)) {
        liked = liked.filter(id => id !== trackId);
        if (btn) btn.textContent = '🤍';
        showNotification('Лайк убран', 'info', 1500);
    } else {
        liked.push(trackId);
        if (btn) btn.textContent = '❤️';
        showNotification('❤️ Добавлено в любимое', 'success', 1500);
    }
    localStorage.setItem('musichub_liked', JSON.stringify(liked));
}

/**
 * Скачивание в полноэкранном режиме
 */
function fullscreenDownload() {
    if (state.currentTrack) {
        const idx = state.tracks.indexOf(state.currentTrack);
        if (idx !== -1) {
            downloadTrack(idx);
        }
    }
}

/**
 * Шаринг в полноэкранном режиме
 */
function fullscreenShare() {
    shareTrack();
}

/**
 * Показывает текст песни в полноэкранном режиме
 */
function fullscreenLyrics() {
    const lyricsContainer = document.getElementById('fsLyrics');
    if (lyricsContainer) {
        if (lyricsContainer.style.maxHeight) {
            lyricsContainer.style.maxHeight = '0';
            lyricsContainer.style.opacity = '0';
        } else {
            lyricsContainer.style.maxHeight = '300px';
            lyricsContainer.style.opacity = '1';
            // Загружаем текст, если его нет
            if (lyricsContainer.innerHTML.includes('Загрузка текста')) {
                showLyrics();
                // Обновляем через некоторое время
                setTimeout(() => {
                    const newLyrics = document.getElementById('modalBody');
                    if (newLyrics && !newLyrics.innerHTML.includes('Загрузка')) {
                        lyricsContainer.innerHTML = newLyrics.innerHTML;
                    }
                }, 2000);
            }
        }
    }
}

/**
 * Добавляет в плейлист из полноэкранного режима
 */
function fullscreenAddToPlaylist() {
    if (state.currentTrack) {
        if (!state.playlist.includes(state.currentTrack)) {
            state.playlist.push(state.currentTrack);
            showNotification('➕ Добавлено в плейлист', 'success', 2000);
        } else {
            showNotification('Уже в плейлисте', 'info', 2000);
        }
    }
}

/**
 * Обновляет информацию в полноэкранном плеере
 */
function updateFullscreenPlayerInfo() {
    const track = state.currentTrack;
    if (!track) return;

    const title = document.querySelector('.fullscreen-player__title');
    const artist = document.querySelector('.fullscreen-player__artist');
    const artwork = document.querySelector('.fullscreen-player__artwork img');
    const playBtn = document.getElementById('fsPlayBtn');

    if (title) title.textContent = track.name || 'Без названия';
    if (artist) artist.textContent = track.artist || 'Неизвестный';
    if (artwork) artwork.src = track.cover || 'https://via.placeholder.com/300';
    if (playBtn) playBtn.textContent = state.isPlaying ? '⏸' : '▶';
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * Форматирует число с разделителями
 */
function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return num.toLocaleString('ru-RU');
}

// ============================================================
// ПЕРЕХВАТ КЛИКОВ ДЛЯ НОВЫХ ИНТЕРФЕЙСОВ
// ============================================================

// Добавляем обработчик для открытия исполнителя через новую страницу
document.addEventListener('click', (e) => {
    const artistBtn = e.target.closest('.btn-artist, .btn-artist-album');
    if (artistBtn) {
        const name = artistBtn.dataset.artist;
        const id = artistBtn.dataset.artistid;
        if (name) {
            e.preventDefault();
            showArtistV2(name, id);
        }
    }
});

// Добавляем обработчик для открытия сингла (по двойному клику на трек)
document.addEventListener('dblclick', (e) => {
    const trackCard = e.target.closest('.track-card');
    if (trackCard) {
        const index = parseInt(trackCard.dataset.index);
        if (!isNaN(index) && state.tracks[index]) {
            showSinglePage(state.tracks[index].id);
        }
    }
});

// Добавляем обработчик для полноэкранного режима (по клику на обложку плеера)
dom.playerCover?.addEventListener('dblclick', () => {
    if (state.currentTrack) {
        openFullscreenPlayer();
    }
});

// Добавляем обработчик клавиш для полноэкранного режима
document.addEventListener('keydown', (e) => {
    const fsPlayer = document.getElementById('fullscreenPlayer');
    if (!fsPlayer || fsPlayer.classList.contains('hidden')) return;
    
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        closeFullscreenPlayer();
    }
    if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        toggleFullscreenPlay();
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        fullscreenNext();
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        fullscreenPrev();
    }
    if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (state.currentTrack) {
            toggleFullscreenLike(state.currentTrack.id);
        }
    }
    if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        fullscreenDownload();
    }
});

// Экспортируем новые функции
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
window.formatNumber = formatNumber;
