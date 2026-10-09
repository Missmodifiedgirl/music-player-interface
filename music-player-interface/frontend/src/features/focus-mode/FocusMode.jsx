import React, { useEffect, useMemo, useState } from 'react';
import { findTracks } from '../song-search.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import MusicPicker, { normalizeSleepTrack } from '../session-music/MusicPicker.jsx';
import {
  clearFocusSession,
  connectSessionPlayer,
  finishFocusSession,
  getSession,
  getSessionHistory,
  pauseFocusSession,
  SESSION_COMPLETE_EVENT,
  SESSION_UPDATE_EVENT,
  skipFocusBreak,
  startFocusBreak,
  startFocusSession,
  startNextFocusSession,
} from '../session-music/session-runtime.js';
import { getPlaceholderSvg } from '../../utils.js';
import './FocusMode.css';

const GOALS = [
  ['📖', 'Studying'],
  ['💻', 'Coding'],
  ['✍️', 'Writing'],
  ['🧠', 'Reading'],
  ['📝', 'Exam Preparation'],
  ['🎨', 'Creative Work'],
];
const MUSIC_MODES = ['Focus Playlist', 'Instrumental', 'Classical', 'Ambient', 'Nature Sounds', 'Lo-fi'];
const DURATION_OPTIONS = [25, 45, 60, 90];
const FOCUS_HISTORY_KEY = 'melodixa-focus-history';

function formatClock(seconds) {
  const remaining = Math.max(0, seconds || 0);
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function readHistory() {
  try {
    const entries = JSON.parse(localStorage.getItem(FOCUS_HISTORY_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.warn('Could not read Focus Mode history:', error);
    return [];
  }
}

function getProgress(history) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const recent = history.filter((entry) => entry.completed);
  const daily = recent.filter((entry) => entry.date === todayKey);
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekly = recent.filter((entry) => new Date(entry.endedAt) >= weekStart);
  const activeDates = new Set(recent.map((entry) => entry.date));
  let streak = 0;
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!activeDates.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const goalCounts = new Map();
  let minuteTotal = 0;
  let hourCounts = [0, 0, 0, 0];
  recent.forEach((entry) => {
    goalCounts.set(entry.goal, (goalCounts.get(entry.goal) || 0) + 1);
    minuteTotal += entry.durationMinutes || 0;
    const hour = new Date(entry.endedAt).getHours();
    hourCounts[hour < 12 ? 0 : hour < 17 ? 1 : hour < 21 ? 2 : 3] += 1;
  });
  const peakIndex = hourCounts.indexOf(Math.max(...hourCounts));
  return {
    dailySessions: daily.length,
    dailyMinutes: daily.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
    weeklySessions: weekly.length,
    weeklyMinutes: weekly.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
    streak,
    averageMinutes: recent.length ? Math.round(minuteTotal / recent.length) : 0,
    favoriteGoal: [...goalCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    productiveTime: recent.length ? ['Morning', 'Afternoon', 'Evening', 'Night'][peakIndex] : '',
    days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (date.getDay() + 6) % 7 + index);
      const key = date.toISOString().slice(0, 10);
      return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), completed: activeDates.has(key), today: key === todayKey };
    }),
  };
}

function PlayerControls({ musicPlayer }) {
  return <div className="focus-mode__player-controls"><button type="button" aria-label="Previous song" onClick={() => musicPlayer?.previous?.()}>|◀</button><button type="button" aria-label={musicPlayer?.isPlaying ? 'Pause music' : 'Play music'} onClick={() => musicPlayer?.togglePlay?.()}>{musicPlayer?.isPlaying ? 'Ⅱ' : '▶'}</button><button type="button" aria-label="Next song" onClick={() => musicPlayer?.next?.()}>▶|</button></div>;
}

function FocusMode({ musicPlayer, playlistStore, ui }) {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState('pomodoro');
  const [musicType, setMusicType] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [language, setLanguage] = useState('Any language');
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState('');
  const [shortBreak, setShortBreak] = useState(5);
  const [longBreak, setLongBreak] = useState(15);
  const [sessionCount, setSessionCount] = useState(4);
  const [breaksEnabled, setBreaksEnabled] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(() => getSession('focus'));
  const [history, setHistory] = useState(readHistory);
  const [musicPlaying, setMusicPlaying] = useState(Boolean(musicPlayer?.isPlaying));

  useEffect(() => {
    connectSessionPlayer(musicPlayer);
    const updateSession = (event) => {
      if (event.detail?.type === 'focus') {
        setSession(event.detail.session ?? getSession('focus'));
        if (event.detail.session?.phase === 'completed' || event.detail.session?.status === 'ready') setHistory(readHistory());
      }
    };
    const complete = (event) => {
      if (event.detail?.type === 'focus') setHistory(readHistory());
    };
    const playback = (event) => setMusicPlaying(Boolean(event.detail?.isPlaying));
    const storage = () => {
      setSession(getSession('focus'));
      setHistory(readHistory());
    };
    window.addEventListener(SESSION_UPDATE_EVENT, updateSession);
    window.addEventListener(SESSION_COMPLETE_EVENT, complete);
    window.addEventListener('music-player-playback-state-changed', playback);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(SESSION_UPDATE_EVENT, updateSession);
      window.removeEventListener(SESSION_COMPLETE_EVENT, complete);
      window.removeEventListener('music-player-playback-state-changed', playback);
      window.removeEventListener('storage', storage);
    };
  }, [musicPlayer]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const active = session && ['active', 'paused', 'break', 'ready'].includes(session.status);
  const focusMinutes = Number(customDuration) > 0 ? Number(customDuration) : duration;
  const hasMusic = Boolean(selectedTrack || selectedPlaylist?.tracks?.length);
  const progress = useMemo(() => getProgress(history), [history]);
  const play = async (track, queue = null) => {
    try {
      await musicPlayer?.playTrack?.(track, queue);
    } catch (playError) {
      console.error('Could not play focus music:', playError);
      setError('This track could not be played right now.');
    }
  };

  const chooseSong = (track, type = 'song') => {
    const normalized = normalizeSleepTrack(track);
    setSelectedTrack(normalized);
    setSelectedPlaylist(null);
    setMusicType(type);
    setMusicTitle(type === 'preset' ? musicTitle : '');
    setPickerOpen(false);
    setError('');
  };

  const choosePlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
    setSelectedTrack(normalizeSleepTrack(playlist.tracks?.[0]));
    setMusicType('playlist');
    setMusicTitle('');
    setPickerOpen(false);
    setError('');
  };

  const loadMusicPreset = async (preset) => {
    if (preset === 'Current Playlist' || preset === 'Favorites' || preset === 'Select a Song' || preset === 'Select a Playlist') {
      setMusicTitle(preset);
      setPickerOpen(true);
      return;
    }
    if (preset === 'Currently Playing' && musicPlayer?.currentTrack) {
      chooseSong(musicPlayer.currentTrack, 'current');
      return;
    }
    setSearchLoading(true);
    setError('');
    setMusicTitle(preset);
    try {
      const found = await findTracks(preset.toLowerCase(), language);
      setSearchResults(found.map(normalizeSleepTrack).filter(Boolean));
      if (!found.length) setError(`No ${preset.toLowerCase()} music was found.`);
    } catch (searchError) {
      console.error('Could not find focus music:', searchError);
      setError('Focus music could not be loaded right now.');
    } finally {
      setSearchLoading(false);
    }
  };

  const searchMusic = async (event) => {
    event.preventDefault();
    const query = event.currentTarget.elements.focusSearch.value.trim();
    if (!query) return;
    setSearchLoading(true);
    setError('');
    try {
      setSearchResults((await findTracks(query, language)).map(normalizeSleepTrack).filter(Boolean));
      setMusicTitle('');
    } catch (searchError) {
      console.error('Could not search for focus music:', searchError);
      setError('Search is unavailable right now. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const start = () => {
    if (!goal || !hasMusic) {
      setError(!goal ? 'Choose a focus goal first.' : 'Choose music for your focus session first.');
      return;
    }
    const totalSessions = mode === 'deep' || mode === 'quick' ? 1 : mode === 'study' && !breaksEnabled ? 1 : Math.max(1, Number(sessionCount) || 1);
    const focusMode = mode === 'quick' ? 'quick' : mode === 'deep' ? 'deep' : 'pomodoro';
    try {
      const next = startFocusSession({
        goal,
        mode: focusMode,
        musicType: selectedPlaylist ? 'playlist' : 'song',
        track: selectedTrack,
        playlist: selectedPlaylist,
        focusMinutes,
        shortBreakMinutes: Number(shortBreak) || 5,
        longBreakMinutes: Number(longBreak) || 15,
        longBreakEvery: 4,
        totalSessions,
      }, musicPlayer);
      setSession(next);
      setError('');
    } catch (startError) {
      console.error('Could not start focus session:', startError);
      setError(startError.message || 'Could not start your focus session.');
    }
  };

  const endSession = () => {
    finishFocusSession();
    setSession(null);
  };

  const clearCompleted = () => {
    clearFocusSession();
    setSession(null);
  };

  if (pickerOpen) {
    return <main className="focus-mode">
      <header className="focus-mode__header"><span>MELODIXA · FOCUS MUSIC</span><h1>Choose Your Focus Music</h1><p>Build a soundtrack that helps you settle into the work.</p></header>
      <div className="focus-mode__picker-actions"><button type="button" onClick={() => { setPickerOpen(false); setMusicTitle(''); }}>← Back to session</button>
        {['Currently Playing', 'Current Playlist', 'Favorites', 'Select a Song', 'Select a Playlist'].map((item) => <button key={item} type="button" onClick={() => loadMusicPreset(item)}>{item}</button>)}
      </div>
      <MusicLanguageSelect value={language} onChange={setLanguage} />
      {!!searchResults.length && <section className="focus-mode__results"><h2>{musicTitle || 'Choose a track'}</h2>{searchResults.map((track, index) => <article key={`${track.name}-${index}`}><img src={track.image} alt="" /><div><strong>{track.name}</strong><span>{track.artist}</span><small>{track.albumName || 'Album unavailable'}</small></div><button type="button" aria-label={`Play ${track.name}`} onClick={() => play(track, searchResults)}>▶</button><button type="button" onClick={() => chooseSong(track, 'preset')}>Select</button></article>)}</section>}
      <MusicPicker playlistStore={playlistStore} musicPlayer={musicPlayer} onSelectSong={(track) => chooseSong(track)} onSelectPlaylist={choosePlaylist} onClose={() => setPickerOpen(false)} />
    </main>;
  }

  if (active && session.phase === 'focus') return <main className="focus-mode focus-mode--active">
    <header className="focus-mode__active-header"><span>MELODIXA · FOCUS MODE</span><span className="focus-mode__distraction-badge">◉ DISTRACTION-FREE</span></header>
    <section className="focus-mode__active-session">
      <div className="focus-mode__active-goal"><span>{GOALS.find((item) => item[1] === session.goal)?.[0] || '🎯'}</span><small>YOUR FOCUS</small><strong>{session.goal}</strong></div>
      {session.mode === 'pomodoro' && <div className="focus-mode__pomodoro-progress"><span>TODAY’S FOCUS</span><div>{Array.from({ length: session.totalSessions }, (_, index) => <i className={index < session.completedSessions ? 'is-done' : ''} key={index} />)}</div><small>Session {session.completedSessions + 1} / {session.totalSessions}</small></div>}
      <div className="focus-mode__timer-ring"><div><strong>{formatClock(session.remainingSeconds)}</strong><span>FOCUS TIME</span></div></div>
      <div className="focus-mode__active-track"><img src={session.playlist?.coverArt || session.music?.image || getPlaceholderSvg(session.music?.name || 'Focus')} alt="" /><div><span>NOW PLAYING</span><strong>{musicPlayer?.currentTrack?.name || session.music?.name}</strong><small>{musicPlayer?.currentTrack?.artist || session.music?.artist || session.playlist?.name}</small></div></div>
      <PlayerControls musicPlayer={musicPlayer} />
      <div className="focus-mode__active-actions"><button type="button" onClick={() => pauseFocusSession(session.status !== 'paused')}>{session.status === 'paused' ? '▶ Resume Focus' : '⏸ Pause Focus'}</button><button type="button" onClick={endSession}>End Session</button></div>
      <p className="focus-mode__active-motto">One thing at a time. Let the music hold the space.</p>
    </section>
  </main>;

  if (active && session.phase === 'break') return <main className="focus-mode focus-mode--break">
    <header className="focus-mode__header"><span>MELODIXA · A MOMENT TO RESET</span><h1>☕ Break Time</h1><p>Focus session complete. Take a breath away from the work.</p></header>
    <section className="focus-mode__break-card"><div className="focus-mode__timer-ring focus-mode__timer-ring--break"><div><strong>{formatClock(session.remainingSeconds || session.shortBreakMinutes * 60)}</strong><span>BREAK</span></div></div>
      <p>You focused for {session.focusMinutes} minutes. Your next session is ready when you are.</p>
      <div className="focus-mode__break-actions"><button type="button" onClick={() => { if (!session.breakStarted) startFocusBreak(); else pauseFocusSession(session.status !== 'paused'); setSession(getSession('focus')); }}>{!session.breakStarted ? 'Start Break' : session.status === 'paused' ? 'Resume Break' : 'Pause Break'}</button><button type="button" onClick={() => { skipFocusBreak(); setSession(getSession('focus')); }}>Skip Break</button></div>
    </section>
  </main>;

  if (active && session.phase === 'ready') return <main className="focus-mode focus-mode--break">
    <header className="focus-mode__header"><span>MELODIXA · NICE WORK</span><h1>🎯 Ready for Another Session?</h1><p>You’ve completed {session.completedSessions} of {session.totalSessions} focus sessions.</p></header>
    <section className="focus-mode__break-card"><p>Take a moment, then return to {session.goal.toLowerCase()} when you’re ready.</p><div className="focus-mode__break-actions"><button type="button" onClick={() => { startNextFocusSession(); setSession(getSession('focus')); }}>Start Next Focus Session</button><button type="button" onClick={endSession}>Finish Session</button></div></section>
  </main>;

  if (session?.phase === 'completed') return <main className="focus-mode focus-mode--complete">
    <span className="focus-mode__complete-icon">✦</span><span className="focus-mode__eyebrow">MELODIXA · FOCUS SESSION</span><h1>Focus Session Complete!</h1><p>{session.focusMinutes} minutes focused</p>
    <section className="focus-mode__completion-card"><span>GOAL<strong>{session.goal}</strong></span><span>MUSIC<strong>{session.playlist?.name || session.music?.name || 'Your focus music'}</strong></span><span>SESSIONS<strong>{session.completedSessions} completed</strong></span></section>
    <p className="focus-mode__completion-question">{session.mode === 'pomodoro' ? `Take a ${session.shortBreakMinutes}-minute break?` : 'Your focus time is complete.'}</p>
    <div className="focus-mode__completion-actions"><button type="button" onClick={() => { clearCompleted(); start(); }}>Play Again</button><button type="button" onClick={clearCompleted}>Close</button></div>
  </main>;

  return <main className="focus-mode">
    <header className="focus-mode__header"><span>MELODIXA · MUSIC FOR YOUR FLOW</span><h1>🎯 Focus / Study Mode</h1><p>Choose a goal, set your soundtrack, and make space for deep work.</p></header>
    <div className="focus-mode__setup-grid">
      <div className="focus-mode__setup-main">
        <section className="focus-mode__card"><span className="focus-mode__step">01 · YOUR INTENTION</span><h2>What are you focusing on?</h2><div className="focus-mode__goal-grid">{GOALS.map(([icon, label]) => <button type="button" className={goal === label ? 'is-selected' : ''} key={label} onClick={() => setGoal(label)}><span>{icon}</span>{label}</button>)}</div></section>

        <section className="focus-mode__card"><span className="focus-mode__step">02 · YOUR SOUNDTRACK</span><h2>🎧 Choose Your Focus Music</h2><div className="focus-mode__music-options">{MUSIC_MODES.map((item) => <button type="button" key={item} className={musicTitle === item ? 'is-selected' : ''} onClick={() => loadMusicPreset(item)}>{item}</button>)}</div>
          <div className="focus-mode__music-options focus-mode__music-options--secondary"><button type="button" onClick={() => loadMusicPreset('Current Playlist')}>Current Playlist</button><button type="button" onClick={() => loadMusicPreset('Favorites')}>Favorites</button><button type="button" onClick={() => loadMusicPreset('Select a Song')}>Select a Song</button><button type="button" onClick={() => loadMusicPreset('Select a Playlist')}>Select a Playlist</button></div>
          {selectedTrack && <div className="focus-mode__selected"><img src={selectedPlaylist?.coverArt || selectedTrack.image} alt="" /><div><span>SELECTED {selectedPlaylist ? 'PLAYLIST' : 'MUSIC'}</span><strong>{selectedPlaylist?.name || selectedTrack.name}</strong><small>{selectedPlaylist ? `${selectedPlaylist.tracks.length} songs` : selectedTrack.artist}</small></div><button type="button" onClick={() => { setMusicTitle(''); setPickerOpen(true); }}>Change</button></div>}
          {searchLoading && <p className="focus-mode__hint">Finding {musicTitle.toLowerCase()} music…</p>}
          {searchResults.length > 0 && !selectedTrack && <div className="focus-mode__inline-results">{searchResults.slice(0, 4).map((track, index) => <article key={`${track.name}-${index}`}><img src={track.image} alt="" /><span>{track.name} · {track.artist}</span><button type="button" onClick={() => chooseSong(track, 'preset')}>Select</button></article>)}</div>}
        </section>

        <section className="focus-mode__card"><span className="focus-mode__step">03 · YOUR SESSION</span><h2>Focus Duration</h2><div className="focus-mode__duration-options">{DURATION_OPTIONS.map((minutes) => <button type="button" className={duration === minutes && !customDuration ? 'is-selected' : ''} key={minutes} onClick={() => { setDuration(minutes); setCustomDuration(''); }}>{minutes} min</button>)}</div>
          <label className="focus-mode__custom"><span>Custom Duration</span><div><input type="number" min="1" max="240" placeholder="30" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} /><span>minutes</span></div></label>
          <h3>Focus Mode</h3><div className="focus-mode__modes">{[['pomodoro', '🍅 Pomodoro', 'Focus sessions with short breaks'], ['deep', '🔥 Deep Focus', 'Long uninterrupted concentration'], ['study', '📚 Study Session', 'Focus cycles and scheduled breaks'], ['quick', '⚡ Quick Focus', 'A short 15–20 minute sprint']].map(([value, label, detail]) => <button type="button" className={mode === value ? 'is-selected' : ''} key={value} onClick={() => { setMode(value); if (value === 'quick') { setDuration(20); setCustomDuration(''); } else if (value === 'pomodoro') { setDuration(25); setCustomDuration(''); } }}><strong>{label}</strong><small>{detail}</small></button>)}</div>
          {(mode === 'pomodoro' || mode === 'study') && <div className="focus-mode__pomodoro-settings"><label>Short Break<input type="number" min="1" max="60" value={shortBreak} onChange={(event) => setShortBreak(event.target.value)} /> min</label><label>Long Break<input type="number" min="1" max="90" value={longBreak} onChange={(event) => setLongBreak(event.target.value)} /> min</label><label>Sessions<input type="number" min="1" max="12" value={sessionCount} onChange={(event) => setSessionCount(event.target.value)} /></label>{mode === 'study' && <label className="focus-mode__break-toggle"><input type="checkbox" checked={breaksEnabled} onChange={(event) => setBreaksEnabled(event.target.checked)} /> Schedule breaks</label>}</div>}
        </section>
      </div>

      <aside className="focus-mode__setup-aside"><section className="focus-mode__preview"><span>MAKE A LITTLE ROOM TO FOCUS</span><div className="focus-mode__preview-glyph">◎</div><h2>{goal ? `${GOALS.find((item) => item[1] === goal)?.[0]} ${goal} Focus Session` : 'Focus Session'}</h2>
        <div><small>🎯 GOAL</small><strong>{goal || 'Choose what you’re working on'}</strong></div>
        <div><small>🎵 MUSIC</small><strong>{selectedPlaylist?.name || selectedTrack?.name || 'Choose your soundtrack'}</strong>{selectedTrack && <span>{selectedPlaylist ? `${selectedPlaylist.tracks.length} songs` : selectedTrack.artist}</span>}</div>
        <div><small>⏱ DURATION</small><strong>{formatMinutes(focusMinutes)}</strong></div>
        <div><small>🍅 MODE</small><strong>{mode === 'pomodoro' ? 'Pomodoro' : mode === 'deep' ? 'Deep Focus' : mode === 'study' ? 'Study Session' : 'Quick Focus'}</strong></div>
        <div><small>🔕 DISTRACTION-FREE</small><strong>ON</strong></div>
        <button type="button" disabled={!goal || !hasMusic || searchLoading} onClick={start}>Start Focus Session <span>→</span></button>
        {error && <p className="focus-mode__error" role="alert">{error}</p>}
        {!hasMusic && <p className="focus-mode__hint">Choose music for your focus session to begin.</p>}
      </section>
        <section className="focus-mode__progress"><span>📊 TODAY’S PROGRESS</span><div><strong>{progress.dailySessions}</strong><small>Focus sessions</small></div><div><strong>{formatMinutes(progress.dailyMinutes)}</strong><small>Focused today</small></div><div><strong>🔥 {progress.streak} day{progress.streak === 1 ? '' : 's'}</strong><small>Focus streak</small></div></section>
      </aside>
    </div>

    <section className="focus-mode__analytics"><header><div><span className="focus-mode__step">GROW A STEADY PRACTICE</span><h2>Focus History & Patterns</h2></div><span>{progress.weeklySessions} sessions · {formatMinutes(progress.weeklyMinutes)} this week</span></header>
      {history.filter((entry) => entry.completed).length ? <div className="focus-mode__analytics-grid">
        <article className="focus-mode__week"><span>THIS WEEK</span><div>{progress.days.map((day) => <div className={`${day.completed ? 'is-complete' : ''} ${day.today ? 'is-today' : ''}`} key={day.label}><i>{day.completed ? '✓' : '·'}</i><small>{day.label}</small></div>)}</div><strong>{progress.weeklySessions} completed sessions</strong></article>
        <article className="focus-mode__insight"><span>🧠 YOUR FOCUS PATTERN</span><strong>Most productive time · {progress.productiveTime}</strong><small>Average session · {progress.averageMinutes} min</small><small>Favorite activity · {progress.favoriteGoal}</small></article>
        <article className="focus-mode__history"><span>RECENT SESSIONS</span>{history.filter((entry) => entry.completed).slice(0, 5).map((entry) => <div key={entry.id}><span>{entry.goal} · {entry.durationMinutes} min</span><small>{new Date(entry.endedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</small></div>)}</article>
      </div> : <p className="focus-mode__no-data">Complete a few focus sessions to discover your productivity pattern.</p>}
    </section>
  </main>;
}

export default FocusMode;
