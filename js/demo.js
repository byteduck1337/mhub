export function getDemoTracks(query) {
    const DEMO_DB = [
        { name: 'Тёмный принц', artist: 'Алексей Воробьёв', album: 'Лучшее', genre: 'Pop' },
        { name: 'Принц и нищий', artist: 'Владимир Высоцкий', album: 'Концерт', genre: 'Folk' },
        { name: 'Тёмная ночь', artist: 'Марк Бернес', album: 'Великие песни', genre: 'Classic' },
        { name: 'Purple Rain', artist: 'Prince', album: 'Purple Rain', genre: 'Rock' },
        { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', genre: 'Rock' },
        { name: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', genre: 'Rock' },
        { name: 'Imagine', artist: 'John Lennon', album: 'Imagine', genre: 'Pop' },
        { name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', genre: 'Rock' },
        { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', genre: 'Rock' },
        { name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', genre: 'Pop' },
        { name: 'Like a Rolling Stone', artist: 'Bob Dylan', album: 'Highway 61 Revisited', genre: 'Folk' },
        { name: 'Yesterday', artist: 'The Beatles', album: 'Help!', genre: 'Rock' },
        { name: 'Wonderwall', artist: 'Oasis', album: "(What's the Story) Morning Glory?", genre: 'Rock' },
        { name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', genre: 'Hip-Hop' },
        { name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', genre: 'Pop' },
        { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop' },
        { name: 'Dance Monkey', artist: 'Tones and I', album: 'The Kids Are Coming', genre: 'Pop' },
        { name: 'Believer', artist: 'Imagine Dragons', album: 'Evolve', genre: 'Rock' },
        { name: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', genre: 'Rock' },
        { name: 'Demons', artist: 'Imagine Dragons', album: 'Night Visions', genre: 'Rock' },
        { name: 'Closer', artist: 'The Chainsmokers', album: 'Collage', genre: 'EDM' },
        { name: 'Faded', artist: 'Alan Walker', album: 'Faded', genre: 'EDM' },
        { name: 'Alone', artist: 'Marshmello', album: 'Alone', genre: 'EDM' }
    ];
    const filtered = DEMO_DB.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase()) ||
        d.genre.toLowerCase().includes(query.toLowerCase())
    );
    const tracks = filtered.length > 0 ? filtered : DEMO_DB.slice(0, 15);
    return tracks.map((d, i) => ({
        id: i + 1,
        name: d.name,
        artist: d.artist,
        artistId: i + 1,
        album: d.album || 'Сборник',
        albumId: i + 1,
        cover: `https://picsum.photos/seed/${i+1}/300/300`,
        audio: null,
        duration: 180 + i * 30,
        source: 'Demo',
        type: 'track',
        isDemo: true,
        genre: d.genre || 'Unknown',
        downloadUrl: null
    }));
}

export function getDemoAlbums(query) {
    const DEMO_ALBUMS = [
        { name: 'Лучшие хиты', artist: 'Макс Корж' },
        { name: 'Тёмная сторона', artist: 'Руки Вверх' },
        { name: 'Greatest Hits', artist: 'Queen' },
        { name: 'Thriller', artist: 'Michael Jackson' },
        { name: 'Back in Black', artist: 'AC/DC' },
        { name: 'The Dark Side of the Moon', artist: 'Pink Floyd' },
        { name: 'Nevermind', artist: 'Nirvana' },
        { name: 'Abbey Road', artist: 'The Beatles' }
    ];
    const filtered = DEMO_ALBUMS.filter(d => 
        d.name.toLowerCase().includes(query.toLowerCase()) || 
        d.artist.toLowerCase().includes(query.toLowerCase())
    );
    const albums = filtered.length > 0 ? filtered : DEMO_ALBUMS.slice(0, 4);
    return albums.map((d, i) => ({
        id: i + 100,
        name: d.name,
        artist: d.artist,
        artistId: i + 100,
        cover: `https://picsum.photos/seed/album${i+1}/300/300`,
        tracks: 10 + i * 2,
        type: 'album'
    }));
}