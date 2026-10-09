import React, { useEffect, useMemo, useState } from 'react';
import { getPlaceholderSvg } from '../../utils.js';
import { findTracks } from '../song-search.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import './FutureMessage.css';

const STORAGE_KEY = 'melodixa-future-messages';
const MOODS = [
  { name: 'Happy', emoji: '☀️' },
  { name: 'Emotional', emoji: '🌧️' },
  { name: 'Loved', emoji: '♡' },
  { name: 'Sad', emoji: '🌙' },
  { name: 'Hopeful', emoji: '✳' },
  { name: 'Motivated', emoji: '↗' },
];

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDate(date);
}

function shiftDate(months) {
  const date = new Date();
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return localDate(date);
}

function formatDate(value, options = { month: 'long', day: 'numeric', year: 'numeric' }) {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options);
}

function daysUntil(value) {
  const [year, month, day] = value.split('-').map(Number);
  const unlock = Date.UTC(year, month - 1, day);
  const [todayYear, todayMonth, todayDay] = localDate().split('-').map(Number);
  return Math.max(0, Math.ceil((unlock - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000));
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
    image: track.image || track.albumImage || getPlaceholderSvg(track.name),
    uri: track.uri || '',
    preview_url: track.preview_url || '',
    spotifyUrl: track.spotifyUrl || '',
    duration_ms: track.duration_ms || 0,
  };
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], error: '' };
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Saved messages are not in the expected format.');
    return {
      messages: saved.filter((item) => item && typeof item === 'object' && typeof item.message === 'string' && typeof item.unlockDate === 'string'),
      error: '',
    };
  } catch (error) {
    console.error('Could not load Future Messages:', error);
    return { messages: [], error: 'Your saved messages could not be loaded. You can still create a new time capsule.' };
  }
}

function Icon({ name, size = 18 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'lock') return <svg {...props}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /><path d="M12 14v3" /></svg>;
  if (name === 'play') return <svg {...props}><path d="m8 5 12 7-12 7V5Z" /></svg>;
  if (name === 'calendar') return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === 'music') return <svg {...props}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === 'spark') return <svg {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></svg>;
  if (name === 'photo') return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>;
  if (name === 'plus') return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...props}><path d="M4 12h16" /></svg>;
}

function TrackPicker({ initialQuery, musicPlayer, onSelect, onClose }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [language, setLanguage] = useState('Any language');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      setTracks(await findTracks(query.trim(), language));
    } catch (requestError) {
      console.error('Could not search for a Future Message song:', requestError);
      setError('We could not search for songs right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentTrack = normalizeTrack(musicPlayer?.currentTrack);

  return (
    <div className="future-message__picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="future-message__picker" role="dialog" aria-modal="true" aria-labelledby="future-message-picker-title">
        <button className="future-message__picker-close" type="button" onClick={onClose} aria-label="Close song picker">×</button>
        <span className="future-message__eyebrow">FIND THE SOUNDTRACK</span>
        <h2 id="future-message-picker-title">Choose your song</h2>
        <p>A familiar song can take you right back to this moment.</p>
        {currentTrack && (
          <button className="future-message__current-song" type="button" onClick={() => onSelect(currentTrack)}>
            <img src={currentTrack.image} alt="" /><span><small>PLAYING IN MELODIXA</small><strong>{currentTrack.name}</strong><span>{currentTrack.artist}</span></span><span aria-hidden="true">＋</span>
          </button>
        )}
        <form className="future-message__search" onSubmit={search}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" aria-label="Search songs or artists" required />
          <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        {error && <p className="future-message__error" role="alert">{error}</p>}
        <div className="future-message__track-results">
          {tracks.map((track) => {
            const song = normalizeTrack(track);
            return <button className="future-message__track-result" key={song.id} type="button" onClick={() => onSelect(song)}>
              <img src={song.image} alt="" /><span><strong>{song.name}</strong><small>{song.artist}</small></span><span aria-hidden="true">＋</span>
            </button>;
          })}
          {!tracks.length && !loading && <div className="future-message__search-hint"><Icon name="music" size={20} /><span>Search for the song you want your future self to hear.</span></div>}
        </div>
      </section>
    </div>
  );
}

function FutureMessage({ musicPlayer, playlistStore, ui }) {
  const loaded = useMemo(loadMessages, []);
  const [messages, setMessages] = useState(loaded.messages);
  const [error, setError] = useState(loaded.error);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [unlockDate, setUnlockDate] = useState(() => shiftDate(12));
  const [mood, setMood] = useState('Hopeful');
  const [track, setTrack] = useState(() => normalizeTrack(musicPlayer?.currentTrack));
  const [memoryNote, setMemoryNote] = useState('');
  const [memoryPhoto, setMemoryPhoto] = useState('');
  const [memoryPhotoName, setMemoryPhotoName] = useState('');
  const [memoryPlaylist, setMemoryPlaylist] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openedMessage, setOpenedMessage] = useState(null);
  const [today, setToday] = useState(localDate());
  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const readyMessages = messages.filter((item) => item.unlockDate <= today);

  useEffect(() => {
    const midnightRefresh = window.setInterval(() => setToday(localDate()), 60_000);
    return () => window.clearInterval(midnightRefresh);
  }, []);

  const persistMessages = (nextMessages) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMessages));
      setMessages(nextMessages);
      setError('');
      return true;
    } catch (storageError) {
      console.error('Could not save Future Messages:', storageError);
      setError('This time capsule could not be saved. Your browser storage may be full; try removing the photo or choosing a smaller one.');
      return false;
    }
  };

  const chooseQuickDate = (months) => setUnlockDate(shiftDate(months));

  const attachPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file to add a photo memory.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose a photo smaller than 2 MB so it can be kept with your time capsule.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('This photo could not be added. Please try another image.');
        return;
      }
      setMemoryPhoto(reader.result);
      setMemoryPhotoName(file.name);
      setError('');
    };
    reader.onerror = () => {
      console.error('Could not read Future Message photo:', reader.error);
      setError('This photo could not be read. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const clearForm = () => {
    setTitle('');
    setMessage('');
    setUnlockDate(shiftDate(12));
    setMood('Hopeful');
    setTrack(normalizeTrack(musicPlayer?.currentTrack));
    setMemoryNote('');
    setMemoryPhoto('');
    setMemoryPhotoName('');
    setMemoryPlaylist('');
  };

  const saveMessage = (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('Write a message to your future self before saving.');
      return;
    }
    if (!unlockDate || unlockDate <= today) {
      setError('Choose a date in the future for this message to unlock.');
      return;
    }
    const item = {
      id: createId(),
      title: title.trim() || 'A note to my future self',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      unlockDate,
      mood,
      track,
      memory: { note: memoryNote.trim(), photo: memoryPhoto, photoName: memoryPhotoName, playlist: memoryPlaylist },
    };
    if (persistMessages([item, ...messages])) {
      clearForm();
      ui?.showToast?.('Your message is sealed away for the future.', 'success');
    }
  };

  const playTrack = async (song) => {
    if (!song) return;
    try {
      await musicPlayer?.playTrack(song);
    } catch (playError) {
      console.error('Could not play Future Message song:', playError);
      ui?.showToast?.('This song could not be played right now.', 'error');
    }
  };

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [messages],
  );

  const deleteMessage = (item) => {
    if (!window.confirm(`Delete “${item.title}”? This time capsule cannot be recovered.`)) return;
    if (persistMessages(messages.filter((entry) => entry.id !== item.id))) {
      if (openedMessage?.id === item.id) setOpenedMessage(null);
      ui?.showToast?.('Time capsule deleted.', 'success');
    }
  };

  const formatCountdown = (date) => {
    const days = daysUntil(date);
    if (days === 0) return 'Ready to open';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  return (
    <main className="future-message">
      <header className="future-message__header">
        <a className="future-message__brand" href="#future-message" aria-label="Melodixa Future Message">
          <span className="future-message__brand-mark"><Icon name="spark" size={17} /></span>
          <span>MELODIXA <i>/</i> TIME CAPSULE</span>
        </a>
        <div className="future-message__header-note"><span className="future-message__live-dot" /> A little note across time</div>
      </header>

      <section className="future-message__hero">
        <div className="future-message__hero-copy">
          <span className="future-message__eyebrow">A MOMENT, KEPT FOR LATER</span>
          <h1>A message from<br />your past <em>self.</em></h1>
          <p>Leave a little piece of today for the person you’re becoming. When the time is right, your words — and the song that holds this moment — will find you.</p>
          <a className="future-message__hero-link" href="#write-message"><span>Write to your future self</span><span aria-hidden="true">↓</span></a>
          <div className="future-message__hero-caption"><span>✳</span> Some things are meant to be found later.</div>
        </div>
        <div className="future-message__art" aria-hidden="true">
          <div className="future-message__art-orbit future-message__art-orbit--one" />
          <div className="future-message__art-orbit future-message__art-orbit--two" />
          <div className="future-message__art-glow" />
          <div className="future-message__envelope"><span>✳</span><i /></div>
          <div className="future-message__art-note future-message__art-note--top">A note, from then</div>
          <div className="future-message__art-note future-message__art-note--bottom"><span>01:26</span><i>the moment, on repeat</i></div>
          <span className="future-message__art-star future-message__art-star--one">✧</span>
          <span className="future-message__art-star future-message__art-star--two">✳</span>
        </div>
      </section>

      {readyMessages.length > 0 && (
        <aside className="future-message__ready-banner" aria-live="polite">
          <span className="future-message__ready-icon"><Icon name="spark" size={19} /></span>
          <span><strong>Your Future Message is Ready 💌</strong><small>{readyMessages.length === 1 ? 'A little something from your past self is ready to meet you.' : `${readyMessages.length} notes from your past self are ready to meet you.`}</small></span>
          <button type="button" onClick={() => setOpenedMessage(readyMessages[0])}>Open message <span aria-hidden="true">↗</span></button>
        </aside>
      )}

      <section className="future-message__create" id="write-message">
        <div className="future-message__section-title">
          <span className="future-message__eyebrow">PRESERVE THIS MOMENT</span>
          <h2>Write a little note to later.</h2>
          <p>Today-you has something future-you should know.</p>
        </div>
        <form className="future-message__form" onSubmit={saveMessage}>
          <div className="future-message__form-main">
            <label className="future-message__field future-message__title-field">
              <span>Give this moment a name <small>OPTIONAL</small></span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="To my future self…" maxLength={80} />
            </label>
            <label className="future-message__field future-message__letter-field">
              <span>Your letter <i>Only future-you gets to read this.</i></span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write something for the future you..." rows={7} maxLength={5000} required />
              <span className="future-message__character-count">{message.length} / 5,000</span>
            </label>

            <div className="future-message__form-divider" />

            <fieldset className="future-message__field future-message__mood-field">
              <legend>How are you feeling in this moment?</legend>
              <div className="future-message__moods">
                {MOODS.map((item) => <button
                  className={`future-message__mood${mood === item.name ? ' is-selected' : ''}`}
                  type="button"
                  key={item.name}
                  aria-pressed={mood === item.name}
                  onClick={() => setMood(item.name)}
                ><span>{item.emoji}</span>{item.name}</button>)}
              </div>
            </fieldset>
          </div>

          <aside className="future-message__form-side">
            <section className="future-message__side-section">
              <div className="future-message__side-heading"><span className="future-message__side-icon"><Icon name="calendar" size={16} /></span><span><strong>Choose an unlock date</strong><small>When should this find you?</small></span></div>
              <div className="future-message__quick-dates">
                {[['1 month', 1], ['6 months', 6], ['1 year', 12]].map(([label, months]) => <button
                  className={`future-message__quick-date${unlockDate === shiftDate(months) ? ' is-selected' : ''}`}
                  type="button"
                  key={label}
                  aria-pressed={unlockDate === shiftDate(months)}
                  onClick={() => chooseQuickDate(months)}
                >{label}</button>)}
              </div>
              <label className="future-message__date-picker"><span>Custom date</span><input type="date" value={unlockDate} min={tomorrowDate()} onChange={(event) => setUnlockDate(event.target.value)} aria-label="Choose unlock date" required /></label>
              {unlockDate && <p className="future-message__unlock-preview"><Icon name="lock" size={14} /> Unlocks on <strong>{formatDate(unlockDate)}</strong></p>}
            </section>

            <div className="future-message__side-divider" />

            <section className="future-message__side-section">
              <div className="future-message__side-heading"><span className="future-message__side-icon"><Icon name="music" size={16} /></span><span><strong>Your memory song</strong><small>A sound that brings you back.</small></span></div>
              {track ? (
                <div className="future-message__selected-song">
                  <img src={track.image} alt="" />
                  <span><strong>{track.name}</strong><small>{track.artist}</small></span>
                  <button type="button" className="future-message__song-play" onClick={() => playTrack(track)} aria-label={`Play ${track.name}`}><Icon name="play" size={15} /></button>
                  <button type="button" className="future-message__song-remove" onClick={() => setTrack(null)} aria-label="Remove attached song">×</button>
                </div>
              ) : <div className="future-message__song-empty"><Icon name="music" size={17} /><span>No song attached yet</span></div>}
              <button className="future-message__attach-song" type="button" onClick={() => setPickerOpen(true)}><Icon name="plus" size={15} /> {track ? 'Choose a different song' : 'Attach a song'}</button>
            </section>

            <div className="future-message__side-divider" />

            <section className="future-message__side-section">
              <div className="future-message__side-heading"><span className="future-message__side-icon"><Icon name="photo" size={16} /></span><span><strong>Keep a little more</strong><small>Optional pieces of today.</small></span></div>
              <label className="future-message__memory-note"><span>Short note</span><textarea value={memoryNote} onChange={(event) => setMemoryNote(event.target.value)} placeholder="Where you are, who you’re with, what you hope to remember…" rows={2} maxLength={300} /></label>
              {playlists.length > 0 && <label className="future-message__playlist-select"><span>Current playlist</span><select value={memoryPlaylist} onChange={(event) => setMemoryPlaylist(event.target.value)}><option value="">No playlist attached</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>}
              <label className={`future-message__photo-upload${memoryPhoto ? ' has-photo' : ''}`}>
                <input type="file" accept="image/*" onChange={attachPhoto} aria-label="Add a memory photo" />
                {memoryPhoto ? <><img src={memoryPhoto} alt="Selected memory" /><span>{memoryPhotoName || 'Memory photo'} <button type="button" aria-label="Remove photo" onClick={(event) => { event.preventDefault(); setMemoryPhoto(''); setMemoryPhotoName(''); }}>×</button></span></> : <><Icon name="photo" size={15} /><span>Add a photo <small>UP TO 2 MB</small></span><i>＋</i></>}
              </label>
            </section>

            <div className="future-message__seal-note"><span>✧</span> Sealed until your chosen day.</div>
          </aside>
          <div className="future-message__form-footer">
            {error && <p className="future-message__error" role="alert">{error}</p>}
            <button className="future-message__save" type="submit"><Icon name="lock" size={16} /> Save for the future <span aria-hidden="true">↗</span></button>
            <small>Just for you. Saved privately on this device.</small>
          </div>
        </form>
      </section>

      <section className="future-message__timeline">
        <div className="future-message__timeline-heading">
          <div><span className="future-message__eyebrow">LETTERS ACROSS TIME</span><h2>My future messages <span>{messages.length}</span></h2><p>Each one is a little time capsule, waiting for its moment.</p></div>
          <div className="future-message__timeline-mark" aria-hidden="true"><span /><i /><span /></div>
        </div>
        {error && !messages.length && <p className="future-message__error future-message__load-error" role="alert">{error}</p>}
        {sortedMessages.length ? (
          <div className="future-message__timeline-list">
            {sortedMessages.map((item) => {
              const isUnlocked = item.unlockDate <= today;
              const moodItem = MOODS.find((entry) => entry.name === item.mood);
              return <article className={`future-message__card${isUnlocked ? ' is-unlocked' : ''}`} key={item.id}>
                <div className="future-message__card-rail"><span>{isUnlocked ? <Icon name="spark" size={14} /> : <Icon name="lock" size={13} />}</span><i /></div>
                <div className="future-message__card-content">
                  <div className="future-message__card-topline"><span className={`future-message__status${isUnlocked ? ' is-unlocked' : ''}`}><Icon name={isUnlocked ? 'spark' : 'lock'} size={12} />{isUnlocked ? 'Ready to open' : 'Sealed for later'}</span><button className="future-message__delete" type="button" onClick={() => deleteMessage(item)} aria-label={`Delete ${item.title}`}>×</button></div>
                  <h3>{item.title}</h3>
                  <div className="future-message__card-dates"><span>Written <time dateTime={item.createdAt}>{formatDate(item.createdAt.slice(0, 10))}</time></span><span className="future-message__date-arrow">→</span><span>Opens <time dateTime={item.unlockDate}>{formatDate(item.unlockDate)}</time></span></div>
                  <div className="future-message__sealed-preview" aria-label={isUnlocked ? 'Message ready to open' : 'Message content hidden until unlock date'}>
                    <span aria-hidden="true">{isUnlocked ? 'Your words are ready when you are.' : 'A little something from your past self…'}</span>
                    {!isUnlocked && <span className="future-message__preview-lock" aria-hidden="true"><Icon name="lock" size={17} /></span>}
                  </div>
                  <div className="future-message__card-details">
                    {moodItem && <span className="future-message__mood-badge"><span>{moodItem.emoji}</span>{item.mood}</span>}
                    {item.track && <span className="future-message__card-song"><img src={item.track.image || getPlaceholderSvg(item.track.name)} alt="" /><span><strong>{item.track.name}</strong><small>{item.track.artist}</small></span><button type="button" onClick={() => playTrack(item.track)} aria-label={`Play ${item.track.name}`}><Icon name="play" size={13} /></button></span>}
                    {!item.track && <span className="future-message__no-song">A song to be chosen another time</span>}
                  </div>
                  <div className="future-message__card-bottom">
                    <span className="future-message__countdown"><span aria-hidden="true">◷</span> {formatCountdown(item.unlockDate)}</span>
                    {isUnlocked && <button className="future-message__open-button" type="button" onClick={() => setOpenedMessage(item)}>Open message <span aria-hidden="true">↗</span></button>}
                  </div>
                </div>
                <div className="future-message__card-date-stamp"><span>FROM</span><strong>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</strong><span>{new Date(item.createdAt).getFullYear()}</span></div>
              </article>;
            })}
          </div>
        ) : (
          <div className="future-message__empty">
            <span className="future-message__empty-mark"><Icon name="lock" size={19} /></span>
            <span className="future-message__eyebrow">NOTHING SEALED, YET</span>
            <h3>Your first letter is waiting to be written.</h3>
            <p>Start with a hope, a reminder, or simply something you don’t want to forget about this version of you.</p>
            <a href="#write-message">Write your first message <span aria-hidden="true">↑</span></a>
          </div>
        )}
      </section>

      <footer className="future-message__footer">A small reminder from another you. <span>✳</span> Keep it close, keep it yours.</footer>

      {pickerOpen && <TrackPicker initialQuery={track?.name || ''} musicPlayer={musicPlayer} onSelect={(song) => { setTrack(song); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
      {openedMessage && (
        <div className="future-message__reveal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenedMessage(null); }}>
          <article className="future-message__reveal" role="dialog" aria-modal="true" aria-labelledby="future-message-reveal-title">
            <button className="future-message__picker-close" type="button" onClick={() => setOpenedMessage(null)} aria-label="Close message">×</button>
            <span className="future-message__reveal-mark"><Icon name="spark" size={22} /></span>
            <span className="future-message__eyebrow">A LETTER ACROSS TIME</span>
            <h2 id="future-message-reveal-title">{openedMessage.title}</h2>
            <p className="future-message__reveal-intro">You wrote this message on <strong>{formatDate(openedMessage.createdAt.slice(0, 10))}</strong>.</p>
            <div className="future-message__letter">
              <span>DEAR FUTURE ME,</span>
              <p>{openedMessage.message}</p>
            </div>
            <div className="future-message__reveal-details">
              {openedMessage.mood && <div><span>Your mood then</span><strong>{MOODS.find((entry) => entry.name === openedMessage.mood)?.emoji} {openedMessage.mood}</strong></div>}
              <div><span>Written on</span><strong>{formatDate(openedMessage.createdAt.slice(0, 10))}</strong></div>
              <div><span>Unlocked on</span><strong>{formatDate(openedMessage.unlockDate)}</strong></div>
            </div>
            {(openedMessage.memory?.note || openedMessage.memory?.photo || openedMessage.memory?.playlist) && (
              <section className="future-message__reveal-memory">
                <span className="future-message__eyebrow">A LITTLE MORE FROM THAT DAY</span>
                {openedMessage.memory.photo && <img src={openedMessage.memory.photo} alt={openedMessage.memory.photoName || 'A photo from the day this message was written'} />}
                {openedMessage.memory.note && <p>{openedMessage.memory.note}</p>}
                {openedMessage.memory.playlist && <small>Listening to {playlists.find((entry) => String(entry.id) === String(openedMessage.memory.playlist))?.name || 'a playlist from that moment'}</small>}
              </section>
            )}
            {openedMessage.track && (
              <section className="future-message__reveal-song">
                <img src={openedMessage.track.image || getPlaceholderSvg(openedMessage.track.name)} alt="" />
                <span><small>THE SOUNDTRACK TO THIS MEMORY</small><strong>{openedMessage.track.name}</strong><span>{openedMessage.track.artist}</span></span>
                <button type="button" onClick={() => playTrack(openedMessage.track)}><Icon name="play" size={16} /> Play memory song</button>
              </section>
            )}
            <p className="future-message__signoff">With love, past you <span>♡</span></p>
          </article>
        </div>
      )}
    </main>
  );
}

export default FutureMessage;
