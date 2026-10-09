import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'melodixa-music-memories';
const CATEGORIES = ['Travel', 'College', 'Friendship', 'Family', 'Celebration', 'Relationship', 'Special Moments'];
const MOODS = ['Happy', 'Nostalgic', 'Peaceful', 'Romantic', 'Hopeful', 'Energetic', 'Bittersweet'];

const starterMemory = {
  id: 'music-memory-starter',
  date: '2026-09-20',
  location: 'Ooty',
  category: 'Travel',
  mood: 'Happy',
  note: 'This song reminds me of my first trip with my friends.',
  isStarter: true,
  track: {
    id: '3hRV0jL3vUpRrcy398teAU',
    name: 'Photograph',
    artist: 'Ed Sheeran',
    album: 'x (Deluxe Edition)',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=85',
    spotifyUrl: 'https://open.spotify.com/search/Photograph%20Ed%20Sheeran',
  },
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeTrack(track) {
  if (!track || typeof track !== 'object' || !track.name) return null;
  return {
    id: track.id || track.uri || track.name,
    name: track.name,
    artist: track.artist || 'Unknown artist',
    album: track.album || '',
    image: track.image || track.albumImage || '',
    uri: track.uri || '',
    preview_url: track.preview_url || '',
    spotifyUrl: track.spotifyUrl || '',
    duration_ms: track.duration_ms || 0,
  };
}

function readMemories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { memories: [starterMemory], error: '' };

    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Saved memories are not in the expected format.');
    const memories = saved
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: item.id || createId(),
        date: item.date || localDate(),
        location: item.location || '',
        category: CATEGORIES.includes(item.category) ? item.category : 'Special Moments',
        mood: item.mood || '',
        note: item.note || item.text || '',
        track: normalizeTrack(item.track),
        createdAt: item.createdAt || '',
      }))
      .filter((item) => item.track);
    return { memories, error: '' };
  } catch (error) {
    console.warn('Could not read Music Memory entries:', error);
    return { memories: [], error: 'Your saved memories could not be loaded. You can still create a new one.' };
  }
}

function formatDate(date, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!date) return '';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
}

function MemoryIcon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'play') return <svg {...common}><path d="m8 5 12 7-12 7V5Z" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === 'pin') return <svg {...common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></svg>;
  if (name === 'edit') return <svg {...common}><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>;
  if (name === 'trash') return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>;
  return <svg {...common}><path d="M4 12h16M12 4v16" /></svg>;
}

function getNowPlayingTrack(musicPlayer) {
  return normalizeTrack(musicPlayer?.currentTrack);
}

function MemoryForm({ initialMemory, musicPlayer, onCancel, onSave }) {
  const [track, setTrack] = useState(() => normalizeTrack(initialMemory?.track) || getNowPlayingTrack(musicPlayer));
  const [date, setDate] = useState(initialMemory?.date || localDate());
  const [location, setLocation] = useState(initialMemory?.location || '');
  const [category, setCategory] = useState(initialMemory?.category || CATEGORIES[0]);
  const [mood, setMood] = useState(initialMemory?.mood || MOODS[0]);
  const [note, setNote] = useState(initialMemory?.note || '');
  const candidates = [initialMemory?.track, musicPlayer?.currentTrack, ...(musicPlayer?.queue || [])].map(normalizeTrack).filter(Boolean);
  const availableTracks = [...new Map(candidates.map((item) => [item.id, item])).values()];
  const nowPlaying = getNowPlayingTrack(musicPlayer);

  const submit = (event) => {
    event.preventDefault();
    if (!track) return;
    onSave({
      ...(initialMemory || {}),
      id: initialMemory?.id || createId(),
      date,
      location: location.trim(),
      category,
      mood,
      note: note.trim(),
      track,
      createdAt: initialMemory?.createdAt || new Date().toISOString(),
      isStarter: false,
    });
  };

  return (
    <div className="music-memory__form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="music-memory__form-panel" role="dialog" aria-modal="true" aria-labelledby="music-memory-form-title">
        <button className="music-memory__form-close" type="button" aria-label="Close form" onClick={onCancel}>×</button>
        <span className="music-memory__eyebrow">{initialMemory ? 'YOUR STORY, REVISITED' : 'SAVE THIS MOMENT'}</span>
        <h2 id="music-memory-form-title">{initialMemory ? 'Edit your memory' : 'Make it a memory'}</h2>
        <p className="music-memory__form-intro">A song is only the beginning. Add the details that make it yours.</p>
        <form className="music-memory__form" onSubmit={submit}>
          <label className="music-memory__field music-memory__song-field">
            <span>Song</span>
            {availableTracks.length > 0 ? (
              <select className="input-field" value={track?.id || ''} onChange={(event) => setTrack(availableTracks.find((item) => item.id === event.target.value) || null)} required>
                <option value="" disabled>Choose a song from your player</option>
                {availableTracks.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.artist}</option>)}
              </select>
            ) : (
              <div className="music-memory__no-track"><span>Start a song in your player, then come back to save its story.</span></div>
            )}
            {track && <span className="music-memory__selected-track">{track.name} <span>by {track.artist}</span></span>}
            {nowPlaying && track?.id !== nowPlaying.id && <button className="music-memory__use-playing" type="button" onClick={() => setTrack(nowPlaying)}>Use now playing · {nowPlaying.name}</button>}
          </label>
          <div className="music-memory__form-grid">
            <label className="music-memory__field"><span>When was it?</span><input className="input-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="music-memory__field"><span>Where were you?</span><span className="music-memory__input-icon"><MemoryIcon name="pin" size={16} /><input className="input-field" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="A place you remember" maxLength={100} /></span></label>
            <label className="music-memory__field"><span>What kind of moment?</span><select className="input-field" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="music-memory__field"><span>How did it feel?</span><select className="input-field" value={mood} onChange={(event) => setMood(event.target.value)}>{MOODS.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="music-memory__field"><span>Why does this song stay with you?</span><textarea className="input-field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tell the story behind the song..." maxLength={800} rows={4} required /></label>
          <div className="music-memory__form-actions">
            <button className="music-memory__cancel" type="button" onClick={onCancel}>Cancel</button>
            <button className="music-memory__save" type="submit" disabled={!track}>{initialMemory ? 'Save changes' : 'Save this memory'} <MemoryIcon name="spark" size={16} /></button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MemoryCard({ memory, onEdit, onDelete, onPlay }) {
  return (
    <article className="music-memory__card">
      <div className="music-memory__card-art">
        <img src={memory.track.image || `https://placehold.co/420x420/21212b/dedee7?text=${encodeURIComponent(memory.track.name)}`} alt={`${memory.track.name} album artwork`} />
        <button className="music-memory__play" type="button" aria-label={`Play ${memory.track.name}`} onClick={() => onPlay(memory.track)}><MemoryIcon name="play" size={19} /></button>
        <span className="music-memory__date-badge">{formatDate(memory.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="music-memory__card-content">
        <div className="music-memory__card-topline"><span className="music-memory__category">{memory.category}</span>{memory.mood && <span className="music-memory__mood">{memory.mood}</span>}</div>
        <h3>{memory.track.name}</h3>
        <p className="music-memory__artist">{memory.track.artist}{memory.track.album && <span> · {memory.track.album}</span>}</p>
        <blockquote>{memory.note || 'A song you wanted to remember.'}</blockquote>
        {memory.location && <p className="music-memory__location"><MemoryIcon name="pin" size={15} />{memory.location}</p>}
        {memory.isStarter && <span className="music-memory__starter-label">A story to get you started</span>}
        <div className="music-memory__card-actions">
          <button type="button" onClick={() => onPlay(memory.track)}><MemoryIcon name="play" size={14} /> Play song</button>
          <button type="button" aria-label={`Edit memory for ${memory.track.name}`} onClick={() => onEdit(memory)}><MemoryIcon name="edit" size={14} /></button>
          <button type="button" aria-label={`Delete memory for ${memory.track.name}`} onClick={() => onDelete(memory)}><MemoryIcon name="trash" size={14} /></button>
        </div>
      </div>
    </article>
  );
}

export default function MusicMemory({ musicPlayer, ui }) {
  const [loaded] = useState(readMemories);
  const [memories, setMemories] = useState(loaded.memories);
  const [nowPlayingState, setNowPlayingState] = useState(() => ({
    track: getNowPlayingTrack(musicPlayer),
    isPlaying: Boolean(musicPlayer?.isPlaying),
  }));
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [editingMemory, setEditingMemory] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const today = localDate();
  const nowPlaying = nowPlayingState.track;

  useEffect(() => {
    const handleTrackChange = (event) => setNowPlayingState((current) => ({
      ...current,
      track: normalizeTrack(event.detail?.track || musicPlayer?.currentTrack),
    }));
    const handlePlaybackChange = (event) => setNowPlayingState((current) => ({
      ...current,
      isPlaying: Boolean(event.detail?.isPlaying),
    }));
    window.addEventListener('music-player-track-changed', handleTrackChange);
    window.addEventListener('music-player-playback-state-changed', handlePlaybackChange);
    return () => {
      window.removeEventListener('music-player-track-changed', handleTrackChange);
      window.removeEventListener('music-player-playback-state-changed', handlePlaybackChange);
    };
  }, [musicPlayer]);

  const onThisDay = useMemo(() => memories.filter((memory) => {
    if (!memory.date) return false;
    const [, month, day] = memory.date.split('-');
    const [, todayMonth, todayDay] = today.split('-');
    return month === todayMonth && day === todayDay && memory.date !== today;
  }).sort((a, b) => b.date.localeCompare(a.date)), [memories, today]);

  const visibleMemories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...memories]
      .filter((memory) => activeView !== 'on-this-day' || onThisDay.some((item) => item.id === memory.id))
      .filter((memory) => !categoryFilter || memory.category === categoryFilter)
      .filter((memory) => !moodFilter || memory.mood === moodFilter)
      .filter((memory) => !dateFilter || memory.date === dateFilter)
      .filter((memory) => {
        if (!normalizedQuery) return true;
        const searchable = [memory.track.name, memory.track.artist, memory.date, formatDate(memory.date), memory.category, memory.mood, memory.location, memory.note].join(' ').toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [memories, activeView, onThisDay, categoryFilter, moodFilter, dateFilter, query]);

  const persist = (nextMemories) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMemories));
      setMemories(nextMemories);
      return true;
    } catch (error) {
      console.error('Could not save Music Memory entries:', error);
      ui?.showToast?.('Your memory could not be saved. Check your browser storage and try again.', 'error');
      return false;
    }
  };

  const saveMemory = (memory) => {
    const exists = memories.some((item) => item.id === memory.id);
    const nextMemories = exists
      ? memories.map((item) => item.id === memory.id ? memory : item)
      : [memory, ...memories.filter((item) => !item.isStarter)];
    if (persist(nextMemories)) {
      setFormOpen(false);
      setEditingMemory(null);
      ui?.showToast?.(exists ? 'Memory updated.' : 'Your music memory is saved.', 'success');
    }
  };

  const deleteMemory = (memory) => {
    if (!window.confirm(`Delete your memory for “${memory.track.name}”? This cannot be undone.`)) return;
    if (persist(memories.filter((item) => item.id !== memory.id))) ui?.showToast?.('Memory deleted.', 'success');
  };

  const playTrack = async (track) => {
    try {
      await musicPlayer?.playTrack(track);
    } catch (error) {
      console.error('Could not play saved memory track:', error);
      ui?.showToast?.('This song could not be played right now.', 'error');
    }
  };

  const openNewMemory = () => {
    setEditingMemory(null);
    setFormOpen(true);
  };

  return (
    <main className="music-memory">
      <header className="music-memory__header">
        <div className="music-memory__brand"><span className="music-memory__brand-mark"><MemoryIcon name="spark" size={17} /></span><span>MELODIXA <i>/</i> YOUR MUSIC MEMORY</span></div>
        <button className="music-memory__new-button" type="button" onClick={openNewMemory}><MemoryIcon name="plus" size={17} /> Save a memory</button>
      </header>

      <section className="music-memory__hero">
        <div className="music-memory__hero-copy">
          <span className="music-memory__eyebrow">YOUR LIFE, IN SONGS</span>
          <h1>Some songs stay<br />with you <em>forever.</em></h1>
          <p>Keep the moments behind the music. Not just what you played — but why it mattered.</p>
          <button className="music-memory__hero-cta" type="button" onClick={openNewMemory}><MemoryIcon name="plus" size={17} /> Capture a moment</button>
          <div className="music-memory__equation"><span>Song</span><b>+</b><span>Moment</span><b>+</b><span>Memory</span><b>=</b><strong>Your story</strong></div>
        </div>
        <div className="music-memory__hero-art" aria-hidden="true">
          <div className="music-memory__hero-image"><img src={memories[0]?.track.image || starterMemory.track.image} alt="" /></div>
          <div className="music-memory__vinyl"><span /></div>
          <div className="music-memory__floating-note">“The soundtrack to<br />a life well lived.”</div>
          <span className="music-memory__hero-sparkle">✳</span>
        </div>
      </section>

      <div className="music-memory__content">
        <aside className="music-memory__sidebar">
          <section className="music-memory__on-this-day">
            <div className="music-memory__section-icon"><MemoryIcon name="calendar" size={17} /></div>
            <span className="music-memory__eyebrow">A LITTLE TIME TRAVEL</span>
            <h2>On this day</h2>
            <p>{formatDate(today, { day: 'numeric', month: 'long' })}</p>
            {onThisDay.length ? (
              onThisDay.map((memory) => <button className="music-memory__anniversary" type="button" key={memory.id} onClick={() => setActiveView('on-this-day')}>
                <img src={memory.track.image || starterMemory.track.image} alt="" />
                <span><strong>{memory.track.name}</strong><small>{new Date(`${memory.date}T12:00:00`).getFullYear()} · {memory.location || memory.category}</small></span>
              </button>)
            ) : <div className="music-memory__anniversary-empty"><span>✧</span><p>Your past, same day, different year. Those memories will find their way here.</p></div>}
          </section>
          <section className="music-memory__now-playing">
            <span className="music-memory__eyebrow">IN THE MOMENT</span>
            {nowPlaying ? <><div className="music-memory__now-track"><img src={nowPlaying.image || starterMemory.track.image} alt="" /><span><strong>{nowPlaying.name}</strong><small>{nowPlaying.artist}</small></span><span className={`music-memory__playing-indicator ${nowPlayingState.isPlaying ? 'is-playing' : ''}`} aria-label={nowPlayingState.isPlaying ? 'Playing' : 'Paused'} /></div><button type="button" onClick={openNewMemory}>Save this song <span>↗</span></button></> : <p>Play a song in Melodixa, then save the moment it brings back.</p>}
          </section>
          <p className="music-memory__privacy">Your music memories are personal and saved on this device.</p>
        </aside>

        <section className="music-memory__main">
          <div className="music-memory__section-heading">
            <div><span className="music-memory__eyebrow">THE SOUNDTRACK OF YOU</span><h2>Your memories <span>{memories.filter((item) => !item.isStarter).length || memories.length}</span></h2></div>
            <button className="music-memory__timeline-button" type="button" aria-pressed={activeView === 'all'} onClick={() => setActiveView(activeView === 'all' ? 'on-this-day' : 'all')}><MemoryIcon name="calendar" size={15} /> {activeView === 'all' ? 'On this day' : 'All memories'}</button>
          </div>

          <div className="music-memory__filters">
            <label className="music-memory__search"><MemoryIcon name="search" size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, places, or stories..." aria-label="Search music memories" /></label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category"><option value="">All moments</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={moodFilter} onChange={(event) => setMoodFilter(event.target.value)} aria-label="Filter by mood"><option value="">All moods</option>{MOODS.map((item) => <option key={item}>{item}</option>)}</select>
            <label className="music-memory__date-filter"><MemoryIcon name="calendar" size={15} /><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by date" /></label>
          </div>

          {loaded.error && <p className="music-memory__load-error" role="status">{loaded.error}</p>}

          {visibleMemories.length ? (
            <div className="music-memory__timeline">
              <div className="music-memory__timeline-label"><span>{activeView === 'on-this-day' ? 'FROM ANOTHER YEAR' : 'YOUR TIMELINE'}</span><i /></div>
              <div className="music-memory__cards">{visibleMemories.map((memory) => <MemoryCard key={memory.id} memory={memory} onEdit={(item) => { setEditingMemory(item); setFormOpen(true); }} onDelete={deleteMemory} onPlay={playTrack} />)}</div>
            </div>
          ) : (
            <div className="music-memory__empty"><div><MemoryIcon name={activeView === 'on-this-day' ? 'calendar' : 'search'} size={22} /></div><h3>{activeView === 'on-this-day' ? 'No memories from this day yet' : 'No memories found'}</h3><p>{activeView === 'on-this-day' ? 'Save a song today, and this little time capsule will be waiting for you next year.' : 'Try another search or filter, or save a song that means something to you.'}</p>{activeView === 'all' && <button type="button" onClick={openNewMemory}>Create your first memory <span>↗</span></button>}</div>
          )}
          <footer className="music-memory__footer">Because your listening history remembers the song. <strong>You remember the story.</strong></footer>
        </section>
      </div>

      {formOpen && <MemoryForm initialMemory={editingMemory} musicPlayer={musicPlayer} onCancel={() => { setFormOpen(false); setEditingMemory(null); }} onSave={saveMemory} />}
    </main>
  );
}
