// Playlist destekli gerçek ses oynatma ve kapak easing davranışı + localStorage
const playBtn = document.getElementById("play");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const cover = document.getElementById("cover");
const fillBar = document.querySelector(".fill-bar");
const audioInput = document.getElementById("audio-file");
const player = document.getElementById("player");
const btnShuffle = document.getElementById("btn-shuffle");
const btnRepeat = document.getElementById("btn-repeat");
const currentArtistEl = document.getElementById("current-artist");
const currentSongEl = document.getElementById("current-song");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");

// Ensure play button toggles playback
if (playBtn) {
  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // If no source yet, try to play currentIndex or open file picker
    if (!player.src) {
      if (playlist.length) {
        const idx = currentIndex >= 0 ? currentIndex : 0;
        playTrack(idx);
      } else if (audioInput) {
        audioInput.click();
      }
      return;
    }
    if (player.paused) player.play().catch(() => {});
    else player.pause();
  });
}

// Playlist veri yapısı
let playlist = [];
let currentIndex = -1;
let shuffleMode = false;
let repeatMode = 0; // 0: no, 1: all, 2: one

// localStorage key
const STORAGE_KEY = "myBlog_playlist";

// localStorage helpers
function savePlaylist() {
  const data = playlist.map((p) => ({ id: p.id, name: p.name }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* IndexedDB: küçük wrapper to persist file blobs across sessions */
const DB_NAME = "miniMusicPlayerDB";
const DB_STORE = "tracks";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE))
        db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function saveBlob(id, blob) {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        const r = store.put(blob, id);
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      })
  );
}
function getBlob(id) {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const store = tx.objectStore(DB_STORE);
        const r = store.get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      })
  );
}
function deleteBlob(id) {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        const r = store.delete(id);
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      })
  );
}

// Load saved playlist metadata and blobs from IndexedDB
async function loadSavedPlaylist() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    for (const it of items) {
      try {
        const blob = await getBlob(it.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          playlist.push({ id: it.id, name: it.name, url, file: blob });
        } else {
          // blob missing; keep name-only entry
          playlist.push({ id: it.id, name: it.name });
        }
      } catch (err) {
        console.warn("Failed to load blob for", it, err);
        playlist.push({ id: it.id, name: it.name });
      }
    }
    if (playlist.length) renderPlaylist();
  } catch (e) {
    console.warn("Failed to parse saved playlist", e);
  }
}

// Format time
function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Update metadata display
function updateMetadata(trackIndex) {
  const item = trackIndex >= 0 ? playlist[trackIndex] : null;
  if (!item) {
    if (currentArtistEl) currentArtistEl.textContent = "name";
    if (currentSongEl) currentSongEl.textContent = "song name";
    return;
  }
  let artist = "Unknown";
  let song = item.name;
  if (item.name.includes(" - ")) {
    const parts = item.name.split(" - ");
    artist = parts[0].trim();
    song = parts[1].trim().replace(/\.[^/.]+$/, "");
  } else {
    song = item.name.replace(/\.[^/.]+$/, "");
  }
  if (currentArtistEl) currentArtistEl.textContent = artist;
  if (currentSongEl) currentSongEl.textContent = song;
}

// Helper: matrix -> degrees
function getRotationDegrees(el) {
  const st = window.getComputedStyle(el, null);
  const tr = st.getPropertyValue("transform");
  if (!tr || tr === "none") return 0;
  const values = tr.split("(")[1].split(")")[0].split(",");
  const a = parseFloat(values[0]);
  const b = parseFloat(values[1]);
  const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
  return angle;
}

// Uygulama: dosyaları ekle (birden fazla)
function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const id = Date.now() + Math.random();
    playlist.push({ id, name: file.name, url, file });
    // persist blob asynchronously
    try {
      saveBlob(id, file).catch((e) => console.warn("saveBlob failed", e));
    } catch (e) {
      console.warn("IndexedDB save error", e);
    }
  }
  renderPlaylist();
  if (currentIndex === -1 && playlist.length) playTrack(0);
}

// Render playlist
function renderPlaylist() {
  const ul = document.querySelector(".playlist");
  if (!ul) return;
  ul.innerHTML = "";
  playlist.forEach((item, idx) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = idx;
    li.innerHTML = `
      <span class="track-number">${idx + 1}.</span>
      <span class="handle" title="Sürükle">☰</span>
      <span class="track-name">${escapeHtml(item.name)}</span>
      <div class="track-actions">
        <button class="btn-play" title="Oynat"><i class="fa-solid fa-play"></i></button>
        <button class="btn-delete" title="Sil"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    if (idx === currentIndex) li.classList.add("playing");

    li.addEventListener("click", (e) => {
      if (e.target.closest(".btn-delete")) return;
      playTrack(idx);
    });

    li.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      removeTrack(idx);
    });

    // drag events with insertion indicator
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", idx);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      ul.querySelectorAll("li").forEach((l) =>
        l.classList.remove("insert-before", "insert-after")
      );
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const dragging = document.querySelector(".dragging");
      if (!dragging || dragging === li) return;

      const rect = li.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      ul.querySelectorAll("li").forEach((l) =>
        l.classList.remove("insert-before", "insert-after")
      );
      if (e.clientY < mid) li.classList.add("insert-before");
      else li.classList.add("insert-after");
    });
    li.addEventListener("dragleave", () => {
      li.classList.remove("insert-before", "insert-after");
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = Number(li.dataset.index);
      ul.querySelectorAll("li").forEach((l) =>
        l.classList.remove("insert-before", "insert-after")
      );
      reorder(from, to);
    });

    ul.appendChild(li);
  });
}

function reorder(from, to) {
  if (from === to) return;
  const item = playlist.splice(from, 1)[0];
  playlist.splice(to, 0, item);
  if (currentIndex === from) currentIndex = to;
  else if (from < currentIndex && to >= currentIndex) currentIndex -= 1;
  else if (from > currentIndex && to <= currentIndex) currentIndex += 1;
  savePlaylist();
  renderPlaylist();
}

function removeTrack(idx) {
  const item = playlist[idx];
  if (!item) return;
  if (item.url) URL.revokeObjectURL(item.url);
  playlist.splice(idx, 1);
  // remove blob from IndexedDB as well (best-effort)
  if (item.id) deleteBlob(item.id).catch(() => {});
  if (idx === currentIndex) {
    player.pause();
    player.removeAttribute("src");
    currentIndex = -1;
    if (fillBar) fillBar.style.width = "0%";
    updateMetadata(-1);
  } else if (idx < currentIndex) {
    currentIndex -= 1;
  }
  savePlaylist();
  renderPlaylist();
}

function playTrack(idx) {
  const item = playlist[idx];
  if (!item) return;
  if (!item.url) {
    console.warn("No URL for track", item.name);
    return;
  }
  currentIndex = idx;
  player.src = item.url;
  player.play().catch(() => {});
  updateMetadata(idx);
  savePlaylist();
  renderPlaylist();
}

// Shuffle toggle
if (btnShuffle) {
  btnShuffle.addEventListener("click", () => {
    shuffleMode = !shuffleMode;
    btnShuffle.classList.toggle("active", shuffleMode);
  });
}

// Repeat toggle
if (btnRepeat) {
  btnRepeat.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    btnRepeat.classList.toggle("active", repeatMode > 0);
    if (repeatMode === 2) btnRepeat.classList.add("one");
    else btnRepeat.classList.remove("one");
  });
}

// input multiple handle
if (audioInput) {
  audioInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    addFiles(files);
    const nameEl = document.querySelector(".file-name");
    if (nameEl) nameEl.textContent = `${files.length} dosya eklendi`;
    audioInput.value = "";
  });
}

// Zaman güncelleme: gerçek zamanlı progress
if (player) {
  player.addEventListener("timeupdate", () => {
    if (!player.duration || !fillBar) return;
    const pct = (player.currentTime / player.duration) * 100;
    fillBar.style.width = pct + "%";
    if (currentTimeEl)
      currentTimeEl.textContent = formatTime(player.currentTime);
    if (totalTimeEl) totalTimeEl.textContent = formatTime(player.duration);
  });

  player.addEventListener("loadedmetadata", () => {
    if (totalTimeEl) totalTimeEl.textContent = formatTime(player.duration);
  });

  player.addEventListener("play", () => {
    if (playBtn) {
      playBtn.classList.remove("fa-play");
      playBtn.classList.add("fa-pause");
    }
    cover.style.transition = "";
    cover.style.transform = "";
    cover.classList.add("active");
    renderPlaylist();
  });

  player.addEventListener("pause", () => {
    if (playBtn) {
      playBtn.classList.remove("fa-pause");
      playBtn.classList.add("fa-play");
    }
    const angle = getRotationDegrees(cover);
    cover.classList.remove("active");
    cover.style.transform = `rotate(${angle}deg)`;
    void cover.offsetWidth;
    cover.style.transition = "transform 800ms cubic-bezier(0.2,0.9,0.3,1)";
    cover.style.transform = `rotate(${angle + 30}deg)`;
    const onEnd = () => {
      cover.style.transition = "";
      cover.style.transform = `rotate(${angle + 30}deg)`;
      cover.removeEventListener("transitionend", onEnd);
    };
    cover.addEventListener("transitionend", onEnd);
    renderPlaylist();
  });

  player.addEventListener("ended", () => {
    if (playBtn) {
      playBtn.classList.remove("fa-pause");
      playBtn.classList.add("fa-play");
    }
    cover.classList.remove("active");
    if (repeatMode === 2) {
      playTrack(currentIndex);
    } else if (currentIndex < playlist.length - 1) {
      playTrack(currentIndex + 1);
    } else if (repeatMode === 1) {
      playTrack(0);
    } else {
      currentIndex = -1;
      updateMetadata(-1);
      renderPlaylist();
    }
  });
}

// Prev / Next
if (prevBtn)
  prevBtn.addEventListener("click", () => {
    if (!playlist.length) return;
    const target = currentIndex > 0 ? currentIndex - 1 : 0;
    playTrack(target);
  });
if (nextBtn)
  nextBtn.addEventListener("click", () => {
    if (!playlist.length) return;
    const target =
      currentIndex < playlist.length - 1 ? currentIndex + 1 : currentIndex;
    playTrack(target);
  });

// Progress bar click ile seek
const progressBar = document.querySelector(".progress-bar");
if (progressBar && player) {
  progressBar.addEventListener("click", (e) => {
    if (!player.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    player.currentTime = pct * player.duration;
    if (player.paused) {
      const pct100 = pct * 100;
      if (fillBar) fillBar.style.width = pct100 + "%";
    }
  });
}

// Util
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        s
      ])
  );
}

// Başlangıç temizliği
if (cover) cover.classList.remove("active");

// Export / Import helpers
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
function base64ToBlob(base64, type) {
  const bytes = atob(base64);
  const len = bytes.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: type || "audio/mpeg" });
}

async function exportPlaylist() {
  const out = { createdAt: Date.now(), tracks: [] };
  for (const item of playlist) {
    try {
      let blob = item.file;
      if (!blob && item.id) blob = await getBlob(item.id);
      if (!blob) continue;
      const data = await blobToBase64(blob);
      out.tracks.push({ name: item.name, data });
    } catch (e) {
      console.warn("Failed to export track", item.name, e);
    }
  }
  const json = JSON.stringify(out);
  const a = document.createElement("a");
  const file = new Blob([json], { type: "application/json" });
  a.href = URL.createObjectURL(file);
  a.download = "playlist.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Create a self-contained HTML file (share) embedding base64 audio data
async function createShareHTMLAndDownload() {
  const tracks = [];
  for (const item of playlist) {
    try {
      let blob = item.file;
      if (!blob && item.id) blob = await getBlob(item.id);
      if (!blob) continue;
      const b64 = await blobToBase64(blob);
      tracks.push({ name: item.name, data: b64 });
    } catch (e) {
      console.warn("share: failed", item.name, e);
    }
  }
  const payload = { tracks, createdAt: Date.now() };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Shared Playlist</title></head><body><h2>Paylaşılan Oynatma Listesi</h2><div id="list"></div><script>
  const payload = ${JSON.stringify(payload)};
  function b64ToBlob(b64, type){ const bytes=atob(b64); let len=bytes.length; let u=new Uint8Array(len); for(let i=0;i<len;i++) u[i]=bytes.charCodeAt(i); return new Blob([u],{type:type||'audio/mpeg'}); }
  (function(){ const list = document.getElementById('list'); payload.tracks.forEach((t, i)=>{ const div=document.createElement('div'); const btn=document.createElement('button'); btn.textContent='Oynat'; const span=document.createElement('span'); span.textContent=' '+t.name; const audio=document.createElement('audio'); audio.controls=true; const blob=b64ToBlob(t.data); audio.src=URL.createObjectURL(blob); btn.addEventListener('click',()=>audio.play()); div.appendChild(btn); div.appendChild(span); div.appendChild(document.createElement('br')); div.appendChild(audio); list.appendChild(div); }); })();
  </script></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "shared_playlist.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Create a shareable URL containing the playlist payload in the fragment
async function createShareLink() {
  const tracks = [];
  for (const item of playlist) {
    try {
      let blob = item.file;
      if (!blob && item.id) blob = await getBlob(item.id);
      if (!blob) continue;
      const b64 = await blobToBase64(blob);
      tracks.push({ name: item.name, data: b64 });
    } catch (e) {
      console.warn("share-link: failed", item.name, e);
    }
  }
  const payload = { tracks, createdAt: Date.now() };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const base = window.location.origin + window.location.pathname;
  const shareUrl = `${base}#shared=${b64}`;
  if (shareUrl.length > 8000) {
    // too long for reliable URL sharing — fall back to HTML download
    alert(
      "Oluşturulan paylaşım bağlantısı çok uzun. HTML dosyası indirilecek, bunu paylaşıp açtırabilirsiniz."
    );
    return createShareHTMLAndDownload();
  }
  // copy to clipboard if possible
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Paylaşım linki panoya kopyalandı — yapıştırıp paylaşabilirsiniz.");
      return;
    } catch (e) {
      console.warn("clipboard write failed", e);
    }
  }
  // fallback: show prompt
  window.prompt("Kopyalayın ve paylaşın:", shareUrl);
}

// If URL fragment contains shared payload, import it on load
async function loadFromHash() {
  try {
    const h = window.location.hash || "";
    if (!h.includes("shared=")) return false;
    const match = h.match(/shared=([^&]+)/);
    if (!match) return false;
    const b64 = match[1];
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (!data.tracks || !Array.isArray(data.tracks)) return false;
    for (const t of data.tracks) {
      try {
        const blob = base64ToBlob(t.data);
        const id = Date.now() + Math.random();
        const url = URL.createObjectURL(blob);
        playlist.push({ id, name: t.name, url, file: blob });
        await saveBlob(id, blob).catch(() => {});
      } catch (e) {
        console.warn("Failed to import shared track", t.name, e);
      }
    }
    savePlaylist();
    renderPlaylist();
    // remove fragment to avoid re-import
    history.replaceState(null, "", window.location.pathname);
    return true;
  } catch (e) {
    console.warn("loadFromHash failed", e);
    return false;
  }
}

// Export as ZIP (tracks + playlist.json + simple player)
async function exportAsZip() {
  if (!window.JSZip) {
    alert("JSZip yüklü değil; ZIP oluşturulamıyor.");
    return;
  }
  const zip = new JSZip();
  for (const item of playlist) {
    try {
      let blob = item.file;
      if (!blob && item.id) blob = await getBlob(item.id);
      if (!blob) continue;
      // sanitize filename
      const filename = item.name.replace(/[^a-z0-9.\-_() ]/gi, "_");
      zip.file(filename, blob);
    } catch (e) {
      console.warn("zip add failed", item.name, e);
    }
  }
  // Per user request: ZIP should contain only the music files (no player.html or playlist.json)
  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = "playlist.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function importPlaylistFile(file) {
  if (!file) return;
  const fname = file.name || "";
  const isZip =
    fname.toLowerCase().endsWith(".zip") || file.type === "application/zip";
  if (isZip) {
    if (!window.JSZip) {
      alert("ZIP içeriğini okumak için JSZip gerekli.");
      return;
    }
    try {
      const js = await JSZip.loadAsync(file);
      const audioExt = /\.(mp3|ogg|wav|m4a|flac)$/i;
      const names = Object.keys(js.files).filter((n) => audioExt.test(n));
      for (const name of names) {
        const entry = js.files[name];
        const blob = await entry.async("blob");
        const id = Date.now() + Math.random();
        const url = URL.createObjectURL(blob);
        playlist.push({ id, name: name.split("/").pop(), url, file: blob });
        await saveBlob(id, blob).catch(() => {});
      }
      savePlaylist();
      renderPlaylist();
    } catch (e) {
      console.warn("ZIP import failed", e);
      alert("ZIP içeriği okunamadı.");
    }
    return;
  }
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    alert("Geçersiz playlist dosyası");
    return;
  }
  if (!data.tracks || !Array.isArray(data.tracks)) return;
  for (const t of data.tracks) {
    try {
      const blob = base64ToBlob(t.data);
      const id = Date.now() + Math.random();
      const url = URL.createObjectURL(blob);
      playlist.push({ id, name: t.name, url, file: blob });
      await saveBlob(id, blob).catch(() => {});
    } catch (e) {
      console.warn("Failed to import track", t.name, e);
    }
  }
  savePlaylist();
  renderPlaylist();
}

// Wire export/import UI
const shareBtn = document.getElementById("share-playlist");
const zipBtn = document.getElementById("export-zip");
const importInputEl = document.getElementById("import-playlist-file");
if (shareBtn) shareBtn.addEventListener("click", createShareLink);
if (zipBtn) zipBtn.addEventListener("click", exportAsZip);
if (importInputEl)
  importInputEl.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importPlaylistFile(f);
    importInputEl.value = "";
  });

// İlk yükleme: önce URL fragment'i (shared) kontrol et, değilse IndexedDB/localStorage'dan yükle
(async () => {
  const loadedFromHash = await loadFromHash();
  if (!loadedFromHash) await loadSavedPlaylist();
})();
