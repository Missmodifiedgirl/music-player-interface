const STORAGE_KEY = 'melodixa-music-journal';
const JOURNAL_UPDATED_EVENT = 'music-journal-updated';
const CURRENT_MOOD_KEY = 'melodixa-current-mood';
let activeSessionEntryId = null;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getJournalEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.warn('Could not read Music Journal entries:', error);
    return [];
  }
}

export function getCurrentMood() {
  return localStorage.getItem(CURRENT_MOOD_KEY) || '';
}

export function getJournalTrack(track) {
  if (!track) return null;
  const album = typeof track.album === 'object' ? track.album : null;
  const artistNames = Array.isArray(track.artists)
    ? track.artists.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean).join(', ')
    : '';
  const artist = track.artist || artistNames;
  const genres = Array.isArray(track.genres) ? track.genres : track.genre ? [track.genre] : [];
  return {
    id: track.id || track.uri || track.name,
    name: track.name || 'Unknown track',
    artist: artist || 'Unknown artist',
    image: track.image || track.albumArt || album?.images?.[0]?.url || '',
    album: album?.name || (typeof track.album === 'string' ? track.album : ''),
    genres,
    language: track.language || track.language_name || '',
    uri: track.uri || '',
    preview_url: track.preview_url || '',
    duration_ms: track.duration_ms || 0,
  };
}

export function setCurrentMood(mood, track = null) {
  localStorage.setItem(CURRENT_MOOD_KEY, mood);
  if (activeSessionEntryId) {
    updateJournalEntry(activeSessionEntryId, { mood });
    return;
  }

  addJournalEntry({
    mood,
    track: getJournalTrack(track),
  });
}

function persistEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent(JOURNAL_UPDATED_EVENT));
}

export function addJournalEntry(entry) {
  const entries = getJournalEntries();
  entries.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    date: localDateKey(),
    playedAt: new Date().toISOString(),
    listeningSeconds: 0,
    track: null,
    mood: '',
    location: '',
    note: '',
    ...entry,
  });
  persistEntries(entries);
}

export function updateJournalEntry(entryId, changes) {
  const entries = getJournalEntries();
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) return;
  entries[index] = { ...entries[index], ...changes };
  persistEntries(entries);
}

export function startMusicJournalTracking(musicPlayer) {
  let currentTrack = musicPlayer.currentTrack;
  let activeEntryId = null;
  let playing = musicPlayer.isPlaying;
  let lastSavedAt = Date.now();

  const startSession = (track) => {
    if (!track || activeEntryId) return;
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const entries = getJournalEntries();
    entries.unshift({
      id,
      date: localDateKey(),
      playedAt: new Date().toISOString(),
      listeningSeconds: 0,
      mood: getCurrentMood(),
      track: getJournalTrack(track),
      location: '',
      note: '',
    });
    persistEntries(entries);
    activeEntryId = id;
    activeSessionEntryId = id;
    lastSavedAt = Date.now();
  };

  const saveElapsedTime = () => {
    if (!activeEntryId || !playing) return;
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
    if (elapsedSeconds < 1) return;
    const entries = getJournalEntries();
    const entry = entries.find((item) => item.id === activeEntryId);
    if (entry) {
      entry.listeningSeconds = (entry.listeningSeconds || 0) + elapsedSeconds;
      persistEntries(entries);
    }
    lastSavedAt = now;
  };

  const handleTrackChange = (event) => {
    currentTrack = event.detail?.track || musicPlayer.currentTrack;
    if (playing) {
      saveElapsedTime();
      activeEntryId = null;
      startSession(currentTrack);
    }
  };

  const handlePlaybackChange = (event) => {
    const nextPlaying = Boolean(event.detail?.isPlaying);
    if (nextPlaying) {
      playing = true;
      currentTrack = musicPlayer.currentTrack || currentTrack;
      startSession(currentTrack);
      lastSavedAt = Date.now();
    } else {
      saveElapsedTime();
      playing = false;
      if (activeSessionEntryId === activeEntryId) activeSessionEntryId = null;
      activeEntryId = null;
    }
  };

  const handlePageHide = () => saveElapsedTime();
  const interval = window.setInterval(saveElapsedTime, 10000);

  window.addEventListener('music-player-track-changed', handleTrackChange);
  window.addEventListener('music-player-playback-state-changed', handlePlaybackChange);
  window.addEventListener('pagehide', handlePageHide);
  if (playing) startSession(currentTrack);

  return () => {
    saveElapsedTime();
    if (activeSessionEntryId === activeEntryId) activeSessionEntryId = null;
    window.clearInterval(interval);
    window.removeEventListener('music-player-track-changed', handleTrackChange);
    window.removeEventListener('music-player-playback-state-changed', handlePlaybackChange);
    window.removeEventListener('pagehide', handlePageHide);
  };
}
