# Mini Music Player

Interactive web-based music player with playlist management, sharing, and persistence.

## Features

- 🎵 **Play/Pause** music files with cover art animation
- 📋 **Playlist Management** — add, remove, reorder tracks (drag & drop)
- 🔀 **Shuffle & Repeat** controls
- 💾 **Persistent Storage** — playlists saved in browser (IndexedDB)
- 🔗 **Share Playlist** — generate shareable URL or download as ZIP
- 📥 **Import Playlist** — load from JSON or ZIP files
- 📱 **Responsive Design** — works on desktop and mobile

## How to Use

1. Open the app: [https://selcukky.github.io/miniMusicPlayer/](https://selcukky.github.io/miniMusicPlayer/)
2. Click **"Dosya Seç"** to add music files
3. Click play button or track to start playback
4. Use **Paylaş** to create a shareable link
5. Use **İndir .zip** to download tracks as ZIP
6. Use **İçe Aktar** to load saved playlists

## Keyboard Controls

- **Play Button** — toggle play/pause
- **← / →** — previous/next track
- **Progress Bar** — click to seek

## Technologies

- HTML5 Audio API
- IndexedDB for persistence
- JSZip for ZIP export/import
- Vanilla JavaScript (no dependencies)
- Responsive CSS Grid

## Files

- `index.html` — main page
- `style.css` — styling
- `script.js` — logic & storage
- `img/` — cover artwork

## License

Open source. Use freely.
