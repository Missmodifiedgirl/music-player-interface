import React, { useEffect, useMemo, useState } from 'react';
import MusicPicker, { normalizeSleepTrack } from '../session-music/MusicPicker.jsx';
import {
  cancelSleepSession,
  clearSleepSession,
  connectSessionPlayer,
  getSession,
  getSessionHistory,
  pauseSleepTimer,
  SESSION_COMPLETE_EVENT,
  SESSION_UPDATE_EVENT,
  startSleepSession,
} from '../session-music/session-runtime.js';
import './SleepTimer.css';

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const ENDINGS = [
  ['duration', 'After Selected Duration', 'Stop playback when your timer reaches zero.'],
  ['song', 'End of Current Song', 'Let the current song finish before stopping.'],
  ['playlist', 'End of Playlist', 'Play through your selected playlist, then stop.'],
];
const HISTORY_KEY = 'melodixa-sleep-history';

function formatClock(seconds) {
  const safe = Math.max(0, seconds || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function loadHistory() {
  try {
    const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.warn('Could not read recent sleep sessions:', error);
    return [];
  }
}

function SummaryMusic({ musicType, track, playlist, onChange }) {
  const item = musicType === 'playlist' ? playlist : track;
  if (!item) return <div className="sleep-mode__empty-music"><span>♫</span><div><strong>Choose Music to Start</strong><p>Select a song or playlist for your sleep session.</p></div><button type="button" onClick={onChange}>Choose Music</button></div>;
  const image = musicType === 'playlist' ? playlist.coverArt || playlist.tracks?.[0]?.image : track.image;
  return <div className="sleep-mode__selected-music">
    <img src={image} alt="" />
    <div><span>{musicType === 'playlist' ? 'SELECTED PLAYLIST' : 'SELECTED SONG'}</span><strong>{musicType === 'playlist' ? playlist.name : track.name}</strong><small>{musicType === 'playlist' ? `${playlist.tracks.length} songs` : track.artist}</small></div>
    <button type="button" onClick={onChange}>Change {musicType === 'playlist' ? 'Playlist' : 'Song'}</button>
  </div>;
}

function SessionControls({ musicPlayer }) {
  return <div className="sleep-mode__player-controls">
    <button type="button" aria-label="Previous song" onClick={() => musicPlayer?.previous?.()}>|◀</button>
    <button type="button" aria-label={musicPlayer?.isPlaying ? 'Pause music' : 'Play music'} onClick={() => musicPlayer?.togglePlay?.()}>{musicPlayer?.isPlaying ? 'Ⅱ' : '▶'}</button>
    <button type="button" aria-label="Next song" onClick={() => musicPlayer?.next?.()}>▶|</button>
  </div>;
}

function SleepTimer({ musicPlayer, playlistStore, ui }) {
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [musicType, setMusicType] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(() => normalizeSleepTrack(musicPlayer?.currentTrack));
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [ending, setEnding] = useState('duration');
  const [fade, setFade] = useState(true);
  const [session, setSession] = useState(() => getSession('sleep'));
  const [history, setHistory] = useState(loadHistory);
  const [playing, setPlaying] = useState(Boolean(musicPlayer?.isPlaying));

  useEffect(() => {
    connectSessionPlayer(musicPlayer);
    const updateSession = (event) => {
      if (!event.detail || event.detail.type === 'sleep') {
        setSession(event.detail?.session ?? getSession('sleep'));
        if (event.detail?.session?.status !== 'active') setHistory(loadHistory());
      }
    };
    const onComplete = (event) => {
      if (event.detail?.type === 'sleep') setSession(event.detail.session);
    };
    const onPlayback = (event) => setPlaying(Boolean(event.detail?.isPlaying));
    const onTrack = (event) => {
      const current = normalizeSleepTrack(event.detail?.track || musicPlayer?.currentTrack);
      if (current && !musicType) setSelectedTrack(current);
    };
    window.addEventListener(SESSION_UPDATE_EVENT, updateSession);
    window.addEventListener(SESSION_COMPLETE_EVENT, onComplete);
    window.addEventListener('music-player-playback-state-changed', onPlayback);
    window.addEventListener('music-player-track-changed', onTrack);
    const onStorage = () => {
      setSession(getSession('sleep'));
      setHistory(loadHistory());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_UPDATE_EVENT, updateSession);
      window.removeEventListener(SESSION_COMPLETE_EVENT, onComplete);
      window.removeEventListener('music-player-playback-state-changed', onPlayback);
      window.removeEventListener('music-player-track-changed', onTrack);
      window.removeEventListener('storage', onStorage);
    };
  }, [musicPlayer, musicType]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMusicPickerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const chosenDuration = Number(customDuration) > 0 ? Number(customDuration) : duration;
  const chosenMusic = musicType === 'playlist' ? selectedPlaylist : selectedTrack;
  const sessionActive = session && ['active', 'paused'].includes(session.status);
  const isPaused = session?.pausedByUser || session?.pausedWithPlayback;
  const historySummary = useMemo(() => history.slice(0, 3), [history]);
  const updateDuration = (value) => {
    setDuration(value);
    setCustomDuration('');
  };

  const selectTrack = (track) => {
    setSelectedTrack(normalizeSleepTrack(track));
    setSelectedPlaylist(null);
    setMusicType(track ? 'song' : '');
    setMusicPickerOpen(false);
  };

  const selectPlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
    setSelectedTrack(normalizeSleepTrack(playlist.tracks?.[0]));
    setMusicType('playlist');
    setMusicPickerOpen(false);
  };

  const startSession = () => {
    if (!chosenMusic || (musicType === 'playlist' && !selectedPlaylist?.tracks?.length)) {
      ui?.showToast?.('Choose a song or playlist before starting your sleep session.', 'warning');
      return;
    }
    try {
      const next = startSleepSession({
        musicType,
        track: selectedTrack,
        playlist: selectedPlaylist,
        durationSeconds: chosenDuration * 60,
        ending,
        fade,
      }, musicPlayer);
      setSession(next);
      setMusicPickerOpen(false);
    } catch (error) {
      console.error('Could not start sleep session:', error);
      ui?.showToast?.(error.message || 'Could not start the sleep session.', 'error');
    }
  };

  const cancelSession = () => {
    cancelSleepSession(musicPlayer);
    setSession((value) => value ? { ...value, status: 'cancelled' } : null);
    ui?.showToast?.('Sleep timer cancelled. Your music will keep playing.', 'info');
  };

  const closeCompletion = () => {
    clearSleepSession();
    setSession(null);
  };

  const playAgain = () => {
    closeCompletion();
    startSession();
  };

  if (musicPickerOpen) return <main className="sleep-mode"><header className="sleep-mode__header"><span>MELODIXA · SLEEP MODE</span><h1>Choose your soundtrack</h1><p>Pick music that feels right for the night.</p></header><MusicPicker playlistStore={playlistStore} musicPlayer={musicPlayer} onSelectSong={selectTrack} onSelectPlaylist={selectPlaylist} onClose={() => setMusicPickerOpen(false)} /></main>;

  if (session?.status === 'completed') return <main className="sleep-mode sleep-mode--completed">
    <div className="sleep-mode__completion-orb">☾</div><span className="sleep-mode__eyebrow">MELODIXA · SLEEP MODE</span><h1>Good Night</h1><p>Your music has been gently paused.</p>
    <section className="sleep-mode__completion-card"><strong>Sleep Duration</strong><span>{Math.floor((session.elapsedSeconds || session.durationSeconds) / 60)} minutes</span><strong>Songs Played</strong><span>{session.songsPlayed}</span></section>
    <div className="sleep-mode__completion-actions"><button type="button" onClick={closeCompletion}>Close</button><button type="button" onClick={playAgain}>Play Again</button></div>
    <footer className="sleep-mode__recent"><h2>🌙 Recent Sleep Sessions</h2>{historySummary.map((item, index) => <p key={item.id}>{index ? 'Previous Session' : 'Last Session'} · {Math.round((item.durationSeconds || item.selectedDurationSeconds || 0) / 60)} minutes • {item.songsPlayed || 0} songs</p>)}</footer>
  </main>;

  if (sessionActive) return <main className="sleep-mode sleep-mode--active">
    <header className="sleep-mode__header"><span>MELODIXA · SLEEP MODE</span><h1>🌙 Sleep Session Active</h1><p>{isPaused ? 'Timer paused while playback is paused.' : session.awaitingEnd ? `Timer complete. Letting the ${session.ending === 'playlist' ? 'playlist' : 'current song'} finish.` : 'Settle in. Your music is in good hands.'}</p></header>
    <section className="sleep-mode__active-card">
      <div className="sleep-mode__art-wrap"><img src={(session.musicType === 'playlist' ? session.playlist?.coverArt : session.track?.image) || session.track?.image} alt="" /><span className="sleep-mode__moon">☾</span></div>
      <div className="sleep-mode__active-track"><span>{session.musicType === 'playlist' ? session.playlist?.name : 'NOW PLAYING'}</span><strong>{musicPlayer?.currentTrack?.name || session.track?.name}</strong><small>{musicPlayer?.currentTrack?.artist || session.track?.artist}</small></div>
      <div className="sleep-mode__countdown" aria-live="off">{formatClock(session.remainingSeconds)}</div>
      <p>{session.awaitingEnd ? 'Your music will stop when playback reaches its selected ending.' : session.fade ? 'Music will gently fade and stop when your sleep session ends.' : 'Music will stop when your sleep session ends.'}</p>
      <SessionControls musicPlayer={musicPlayer} />
      <div className="sleep-mode__active-actions"><button type="button" onClick={() => pauseSleepTimer(!session.pausedByUser)}>{session.pausedByUser ? '▶ Resume Timer' : '⏸ Pause Timer'}</button><button type="button" onClick={cancelSession}>✕ Cancel Timer</button></div>
    </section>
  </main>;

  return <main className="sleep-mode">
    <header className="sleep-mode__header"><span>MELODIXA · A GENTLER GOODNIGHT</span><h1>🌙 Sleep Timer</h1><p>Choose your music, set your time, and relax.</p></header>
    <div className="sleep-mode__layout">
      <section className="sleep-mode__main">
        <article className="sleep-mode__panel"><header><div><span>01 · YOUR SOUNDTRACK</span><h2>Choose Music</h2></div><span className="sleep-mode__icon">♫</span></header>
          <div className="sleep-mode__source-chips">
            <button type="button" className={musicType === 'current' ? 'is-selected' : ''} disabled={!musicPlayer?.currentTrack} onClick={() => { setSelectedTrack(normalizeSleepTrack(musicPlayer.currentTrack)); setSelectedPlaylist(null); setMusicType('current'); }}>🎵 Currently Playing</button>
            <button type="button" onClick={() => setMusicPickerOpen(true)}>🔎 Select a Song</button>
            <button type="button" onClick={() => setMusicPickerOpen(true)}>📋 Select a Playlist</button>
            <button type="button" onClick={() => setMusicPickerOpen(true)}>❤️ Favorites</button>
          </div>
          <SummaryMusic musicType={musicType} track={selectedTrack} playlist={selectedPlaylist} onChange={() => setMusicPickerOpen(true)} />
        </article>

        <article className="sleep-mode__panel"><header><div><span>02 · YOUR TIME</span><h2>⏱ How long would you like to listen?</h2></div></header>
          <div className="sleep-mode__duration-options">{DURATION_OPTIONS.map((minutes) => <button type="button" className={duration === minutes && !customDuration ? 'is-selected' : ''} key={minutes} onClick={() => updateDuration(minutes)}>{minutes} min</button>)}</div>
          <label className="sleep-mode__custom-duration"><span>Custom Timer</span><div><input type="number" min="1" max="720" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} placeholder="35" /><span>minutes</span></div></label>
        </article>

        <article className="sleep-mode__panel"><header><div><span>03 · WHEN TO STOP</span><h2>End Playback</h2></div></header>
          <div className="sleep-mode__ending-list">{ENDINGS.map(([value, label, description]) => <label className={ending === value ? 'is-selected' : ''} key={value}><input type="radio" name="sleep-ending" value={value} checked={ending === value} onChange={() => setEnding(value)} /><span className="sleep-mode__radio" /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
          {ending === 'playlist' && musicType !== 'playlist' && <p className="sleep-mode__inline-note">Choose a playlist above to use this ending option.</p>}
        </article>

        <button className={`sleep-mode__fade-toggle ${fade ? 'is-on' : ''}`} type="button" aria-pressed={fade} onClick={() => setFade((value) => !value)}><span className="sleep-mode__fade-icon">☾</span><span><strong>Gentle Fade-Out</strong><small>Ease the volume down near the end of your session.</small></span><i>{fade ? 'ON' : 'OFF'}</i></button>
      </section>

      <aside className="sleep-mode__aside"><article className="sleep-mode__preview"><span>YOUR EVENING, MADE EASY</span><div className="sleep-mode__preview-moon">☾</div><h2>Sleep Session</h2>
        <div><small>🎵 MUSIC</small><strong>{chosenMusic ? (musicType === 'playlist' ? selectedPlaylist?.name : selectedTrack?.name) : 'Choose your soundtrack'}</strong>{chosenMusic && <span>{musicType === 'playlist' ? `${selectedPlaylist?.tracks?.length || 0} songs` : selectedTrack?.artist}</span>}</div>
        <div><small>⏱ DURATION</small><strong>{chosenDuration} minutes</strong></div>
        <div><small>🌙 GENTLE FADE</small><strong>{fade ? 'ON' : 'OFF'}</strong></div>
        <div><small>🛑 ENDING</small><strong>{ENDINGS.find(([value]) => value === ending)?.[1]}</strong></div>
        <button type="button" disabled={!chosenMusic || (ending === 'playlist' && musicType !== 'playlist')} onClick={startSession}>Start Sleep Session <span>→</span></button>
        {!chosenMusic && <p className="sleep-mode__preview-note">Choose music above to continue.</p>}
      </article>
        {!!historySummary.length && <article className="sleep-mode__history"><h2>🌙 Recent Sleep Sessions</h2>{historySummary.map((item, index) => <div key={item.id}><span>{index ? 'Earlier' : 'Last session'}</span><strong>{Math.round((item.durationSeconds || item.selectedDurationSeconds || 0) / 60)} min • {item.songsPlayed} songs</strong></div>)}</article>}
      </aside>
    </div>
  </main>;
}

export default SleepTimer;
