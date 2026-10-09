import React, { useEffect, useState } from 'react';
import { getArtistInfo } from '../lastfm-api.js';
import { findTracks } from './song-search.js';
import { formatTime, getPlaceholderSvg } from '../utils.js';
import MusicLanguageSelect from '../MusicLanguageSelect.jsx';

const definitions = {
  'music-memory': ['Music Memory', 'Save a memory attached to a song.', 'memory', 'melodixa-music-memories'],
  'life-event': ['Life Event Planner', 'Plan a complete music flow for an upcoming occasion.', 'playlist', 'celebration life event songs'],
  'future-message': ['Future Message', 'Write a message to revisit with a song later.', 'future', 'melodixa-future-messages'],
  'emotion-journey': ['Emotional Journey', 'See how your moods and music shift together over time.', 'journey'],
  'friend-sync': ['Friend Sync', 'Share the track you are listening to.', 'share'],
  'why-song': ['Why This Song?', 'Explore the artist context for the current track.', 'why'],
  'music-dna': ['Music DNA', 'Explore patterns across your saved playlists.', 'profile'],
  'voice-playlist': ['Voice Playlist', 'Say what you want to hear and create a playlist.', 'playlist', 'upbeat music'],
  'local-culture': ['Local Culture', 'Discover music connected to a place or community.', 'playlist', 'local music culture'],
  'music-journal': ['Music Journal', 'Keep a dated note about what you are listening to.', 'memory', 'melodixa-music-journal'],
  'sleep-time': ['Sleep Timer', 'Stop playback after a set amount of time.', 'timer'],
  'mood-music': ['Mood Music', 'Find tracks to match the feeling you choose.', 'playlist', 'mood music'],
  'music-profile': ['Music Taste Profile', 'Review the artists represented in your playlists.', 'profile'],
  'focus-mode': ['Focus / Study Mode', 'Set a timer and choose a mix for focused work.', 'timer'],
  'mood-ui': ['Mood Music', 'Find tracks to match the feeling you choose.', 'playlist', 'mood music'],
  'focus-ui': ['Focus Mode', 'Set a focus timer and play a study mix.', 'timer'],
};

function Heading({ definition }) {
  return <header className="feature-react-dialog__heading"><span className="account-eyebrow">MELODIXA / FEATURE</span><h2>{definition[0]}</h2><p>{definition[1]}</p></header>;
}

function SavedNotes({ featureId, definition, musicPlayer, ui }) {
  const [, refresh] = useState(0);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const storageKey = definition[3];
  let notes = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    notes = Array.isArray(saved) ? saved : [];
  } catch {
    notes = [];
  }

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    const note = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      text: text.trim(),
      date,
      createdAt: new Date().toISOString(),
      track: musicPlayer.currentTrack ? { name: musicPlayer.currentTrack.name, artist: musicPlayer.currentTrack.artist } : null,
    };
    localStorage.setItem(storageKey, JSON.stringify([note, ...notes].slice(0, 50)));
    setText('');
    setDate('');
    refresh((value) => value + 1);
    ui.showToast('Saved.', 'success');
  };

  return (
    <div className="feature-react-dialog__content">
      <Heading definition={definition} />
      {musicPlayer.currentTrack && <p className="feature-current-track">Current track: <strong>{musicPlayer.currentTrack.name}</strong> · {musicPlayer.currentTrack.artist}</p>}
      <form className="feature-entry-form" onSubmit={submit}>
        <label className="account-field"><span>{featureId === 'future-message' ? 'Message for later' : 'Your note'}</span><textarea className="input-field" value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={2000} required /></label>
        {featureId === 'future-message' && <label className="account-field"><span>Revisit on</span><input className="input-field" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} required /></label>}
        <button className="btn btn-primary" type="submit">Save note</button>
      </form>
      <div className="feature-record-list">{notes.slice(0, 5).map((note) => <article className="feature-record" key={note.id}><p>{note.text}</p>{note.track && <small>{note.track.name} · {note.track.artist}</small>}{note.date && <small>Revisit on {note.date}</small>}<time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleDateString()}</time></article>)}</div>
    </div>
  );
}

function PlaylistBuilder({ definition, ui, musicPlayer, playlistStore }) {
  const [query, setQuery] = useState(definition[3]);
  const [language, setLanguage] = useState('Any language');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setTracks(await findTracks(query.trim(), language));
    } catch (requestError) {
      setError(requestError.message || 'Could not find tracks.');
    } finally {
      setLoading(false);
    }
  };

  const voiceInput = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return ui.showToast('Voice input is not supported in this browser.', 'warning');
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event) => setQuery(event.results[0][0].transcript);
    recognition.onerror = () => ui.showToast('Voice input could not be captured.', 'error');
    recognition.start();
  };

  const save = () => {
    if (!tracks.length) return;
    const playlist = playlistStore.createPlaylist({ name: definition[0], description: query.trim(), coverArt: tracks[0].image });
    tracks.forEach((track) => playlistStore.addTrackToPlaylist(playlist.id, track));
    ui.showToast('Playlist saved to Your Library.', 'success');
    ui.switchView('playlists');
  };

  return (
    <div className="feature-react-dialog__content">
      <Heading definition={definition} />
      <form className="feature-search-form" onSubmit={generate}>
        <label className="account-field"><span>Describe the sound or moment</span><input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={160} required /></label>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        {definition[0] === 'Voice Playlist' && <button className="btn btn-secondary" type="button" onClick={voiceInput}>Use voice input</button>}
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Finding tracks…' : 'Find tracks'}</button>
      </form>
      {error && <p className="account-form-message is-error" role="alert">{error}</p>}
      {tracks.length > 0 && <>
        <div className="feature-track-list">{tracks.map((track, index) => <div className="feature-track-row" key={track.id || `${track.name}-${index}`}><img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" /><div><strong>{track.name}</strong><span>{track.artist}</span></div><button className="icon-btn" type="button" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, tracks)}>▶</button></div>)}</div>
        <button className="btn btn-secondary" type="button" onClick={save}>Save as playlist</button>
      </>}
    </div>
  );
}

function Profile({ definition, playlistStore }) {
  const playlists = playlistStore.getAllPlaylists();
  const tracks = playlists.flatMap((playlist) => playlist.tracks || []);
  const artists = tracks.reduce((counts, track) => {
    const artist = track.artist || 'Unknown Artist';
    counts[artist] = (counts[artist] || 0) + 1;
    return counts;
  }, {});
  const topArtists = Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return <div className="feature-react-dialog__content"><Heading definition={definition} /><div className="feature-profile-stats"><div><strong>{tracks.length}</strong><span>Saved tracks</span></div><div><strong>{Object.keys(artists).length}</strong><span>Artists</span></div><div><strong>{playlists.length}</strong><span>Playlists</span></div></div><section className="feature-record-list"><h3>Most represented artists</h3>{topArtists.length ? topArtists.map(([artist, count]) => <p className="feature-profile-row" key={artist}><span>{artist}</span><strong>{count}</strong></p>) : <p className="empty-text">Add tracks to playlists to build your profile.</p>}</section></div>;
}

function Timer({ definition, ui, musicPlayer }) {
  const [minutes, setMinutes] = useState(definition[0] === 'Sleep Timer' ? 30 : 25);
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining <= 0) return undefined;
    const interval = window.setInterval(() => setRemaining((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [remaining, running]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    if (musicPlayer.isPlaying) musicPlayer.togglePlay();
    ui.showToast(`${definition[0]} finished.`, 'success');
  }, [definition, musicPlayer, remaining, running, ui]);

  const reset = (duration) => {
    setMinutes(duration);
    setRemaining(duration * 60);
    setRunning(false);
  };

  return <div className="feature-react-dialog__content"><Heading definition={definition} /><fieldset className="feature-choice-group"><legend>Duration</legend>{[15, 25, 30, 45, 60].map((duration) => <button className={duration === minutes ? 'active' : ''} key={duration} type="button" aria-pressed={duration === minutes} onClick={() => reset(duration)}>{duration} min</button>)}</fieldset><div className="feature-focus-clock" role="timer" aria-live="polite">{formatTime(remaining)}</div><div className="feature-dialog__actions"><button className="btn btn-primary" type="button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause timer' : 'Start timer'}</button><button className="btn btn-secondary" type="button" onClick={() => reset(minutes)}>Reset</button></div></div>;
}

function WhySong({ definition, musicPlayer }) {
  const track = musicPlayer.currentTrack;
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let active = true;
    setInfo(null);
    if (track?.artist) getArtistInfo(track.artist).then((result) => { if (active) setInfo(result); });
    return () => { active = false; };
  }, [track?.artist]);
  return <div className="feature-react-dialog__content"><Heading definition={definition} />{!track ? <p className="empty-text">Play a track to explore its context.</p> : <><p className="feature-current-track"><strong>{track.name}</strong> · {track.artist}</p>{!info ? <p className="loading-state">Loading artist context…</p> : <><p>{info.bio?.summary || 'No artist biography is available.'}</p><div className="artist-tags-row">{(info.tags || []).slice(0, 8).map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div><p className="section-desc">{Number(info.listeners || 0).toLocaleString()} Last.fm listeners</p></>}</>}</div>;
}

function Share({ definition, musicPlayer, ui }) {
  const track = musicPlayer.currentTrack;
  const copyLink = async () => {
    if (!track) return;
    const url = track.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`;
    try {
      await navigator.clipboard.writeText(`${track.name} — ${track.artist}: ${url}`);
      ui.showToast('Track link copied.', 'success');
    } catch {
      ui.showToast(url, 'info');
    }
  };
  return <div className="feature-react-dialog__content"><Heading definition={definition} />{track ? <p className="feature-current-track"><strong>{track.name}</strong> · {track.artist}</p> : <p className="empty-text">Start a track to create a share link.</p>}<button className="btn btn-primary" type="button" disabled={!track} onClick={copyLink}>Copy track link</button></div>;
}

export const featureInfo = Object.fromEntries(Object.entries(definitions).map(([id, [title, description]]) => [id, { title, description }]));

export default function FeatureExperience({ featureId, ui, musicPlayer, playlistStore }) {
  const definition = definitions[featureId];
  if (!definition) return <p className="empty-text">Feature not found.</p>;
  if (definition[2] === 'memory' || definition[2] === 'future') return <SavedNotes featureId={featureId} definition={definition} musicPlayer={musicPlayer} ui={ui} />;
  if (definition[2] === 'playlist') return <PlaylistBuilder definition={definition} ui={ui} musicPlayer={musicPlayer} playlistStore={playlistStore} />;
  if (definition[2] === 'profile') return <Profile definition={definition} playlistStore={playlistStore} />;
  if (definition[2] === 'timer') return <Timer definition={definition} ui={ui} musicPlayer={musicPlayer} />;
  if (definition[2] === 'why') return <WhySong definition={definition} musicPlayer={musicPlayer} />;
  if (definition[2] === 'share') return <Share definition={definition} musicPlayer={musicPlayer} ui={ui} />;
  return <p className="empty-text">Feature not available.</p>;
}