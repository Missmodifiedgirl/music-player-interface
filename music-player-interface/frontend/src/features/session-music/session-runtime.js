const SLEEP_KEY = 'melodixa-sleep-session';
const SLEEP_HISTORY_KEY = 'melodixa-sleep-history';
const FOCUS_KEY = 'melodixa-focus-session';
const FOCUS_HISTORY_KEY = 'melodixa-focus-history';
const UPDATE_EVENT = 'melodixa-session-updated';
const COMPLETE_EVENT = 'melodixa-session-completed';

let playerRef = null;
let originalSleepVolume = null;
let lastTrackIdentity = '';
let lastTickAt = Date.now();

function read(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`Could not read Melodixa session state (${key}):`, error);
    return fallback;
  }
}

function restoreSleepSettings(session, player = playerRef) {
  restoreSleepVolume(player);
  if (typeof session?.originalRepeatMode === 'string' && player) {
    player.repeatMode = session.originalRepeatMode;
    player.emitEvent?.('repeat-changed', { repeatMode: session.originalRepeatMode });
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save Melodixa session state (${key}):`, error);
  }
}

function update(type, session) {
  write(type === 'sleep' ? SLEEP_KEY : FOCUS_KEY, session);
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { type, session } }));
}

function identity(track) {
  return track ? `${track.id || track.uri || track.name}::${track.artist || ''}`.toLowerCase() : '';
}

function addSleepHistory(session, completed) {
  const history = read(SLEEP_HISTORY_KEY, []);
  const entry = {
    id: session.id,
    endedAt: new Date().toISOString(),
    durationSeconds: session.elapsedSeconds || Math.max(0, session.durationSeconds - session.remainingSeconds),
    selectedDurationSeconds: session.durationSeconds,
    songsPlayed: session.songsPlayed,
    elapsedSeconds: session.elapsedSeconds || Math.max(0, session.durationSeconds - session.remainingSeconds),
    completed,
  };
  write(SLEEP_HISTORY_KEY, [entry, ...history].slice(0, 20));
}

function addFocusHistory(session, completedMinutes) {
  const history = read(FOCUS_HISTORY_KEY, []);
  const entry = {
    id: `${session.id}-${session.completedSessions}`,
    endedAt: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    goal: session.goal,
    musicName: session.music?.name || session.playlist?.name || '',
    durationMinutes: completedMinutes,
    mode: session.mode,
    completed: true,
    phase: session.phase,
  };
  write(FOCUS_HISTORY_KEY, [entry, ...history].slice(0, 100));
}

function completeSleep(reason = 'timer') {
  const session = read(SLEEP_KEY, null);
  if (!session || !['active', 'paused'].includes(session.status)) return;
  if (playerRef?.isPlaying) playerRef.togglePlay();
  restoreSleepSettings(session);
  const completed = { ...session, status: 'completed', reason, completedAt: new Date().toISOString() };
  update('sleep', completed);
  addSleepHistory(completed, true);
  window.dispatchEvent(new CustomEvent(COMPLETE_EVENT, { detail: { type: 'sleep', session: completed } }));
}

function restoreSleepVolume(player = playerRef) {
  if (originalSleepVolume === null) return;
  player?.setVolume?.(originalSleepVolume);
  originalSleepVolume = null;
}

function finishFocusPhase(session) {
  if (session.phase === 'break') {
    const nextSession = session.completedSessions >= session.totalSessions
      ? { ...session, status: 'completed', phase: 'completed', remainingSeconds: 0, completedAt: new Date().toISOString() }
      : { ...session, status: 'ready', phase: 'ready', remainingSeconds: 0, breakStarted: false };
    update('focus', nextSession);
    if (nextSession.phase === 'completed') {
      addFocusHistory(nextSession, nextSession.focusMinutes);
      window.dispatchEvent(new CustomEvent(COMPLETE_EVENT, { detail: { type: 'focus', session: nextSession } }));
    }
    return;
  }

  const completedSessions = session.completedSessions + 1;
  addFocusHistory({ ...session, completedSessions, phase: 'focus' }, session.focusMinutes);
  if (session.mode === 'deep' || session.mode === 'quick' || completedSessions >= session.totalSessions) {
    const nextSession = { ...session, status: 'completed', phase: 'completed', remainingSeconds: 0, completedSessions, completedAt: new Date().toISOString() };
    update('focus', nextSession);
    window.dispatchEvent(new CustomEvent(COMPLETE_EVENT, { detail: { type: 'focus', session: nextSession } }));
    return;
  }

  const nextSession = {
    ...session,
    status: 'break',
    phase: 'break',
    remainingSeconds: (completedSessions % session.longBreakEvery === 0 ? session.longBreakMinutes : session.shortBreakMinutes) * 60,
    completedSessions,
    breakStarted: false,
  };
  update('focus', nextSession);
  window.dispatchEvent(new CustomEvent('melodixa-focus-break-started', { detail: nextSession }));
}

function onTrackChange(event) {
  const nextTrack = event.detail?.track || playerRef?.currentTrack;
  const nextIdentity = identity(nextTrack);
  const sleep = read(SLEEP_KEY, null);
  if (sleep?.status === 'active' && sleep.awaitingEnd && sleep.ending === 'song'
      && nextIdentity && nextIdentity !== sleep.endingTrackIdentity) {
    completeSleep('song-ended');
    lastTrackIdentity = nextIdentity;
    return;
  }
  if (sleep?.status === 'active' && nextIdentity && nextIdentity !== lastTrackIdentity) {
    const seen = new Set(sleep.playedTrackIdentities || []);
    if (!seen.has(nextIdentity)) {
      seen.add(nextIdentity);
      update('sleep', { ...sleep, songsPlayed: sleep.songsPlayed + 1, playedTrackIdentities: [...seen] });
    }
  }
  lastTrackIdentity = nextIdentity;
}

function onQueueFinished() {
  const sleep = read(SLEEP_KEY, null);
  if (!sleep || sleep.status !== 'active') return;
  if (sleep.ending === 'playlist') {
    completeSleep('playlist-ended');
  } else if (sleep.ending === 'song' && sleep.awaitingEnd) {
    completeSleep('song-ended');
  } else if (sleep.ending === 'song') {
    update('sleep', { ...sleep, queueFinished: true, pausedWithPlayback: false });
  }
}

function onPlaybackChange(event) {
  const sleep = read(SLEEP_KEY, null);
  if (sleep?.status === 'active' && sleep.pauseWithPlayback) {
    const shouldPauseTimer = !event.detail?.isPlaying;
    if (sleep.pausedWithPlayback !== shouldPauseTimer) {
      update('sleep', { ...sleep, pausedWithPlayback: shouldPauseTimer });
    }
  }
}

window.addEventListener('music-player-track-changed', onTrackChange);
window.addEventListener('music-player-queue-finished', onQueueFinished);
window.addEventListener('music-player-playback-state-changed', onPlaybackChange);

window.setInterval(() => {
  const now = Date.now();
  const elapsedTicks = Math.max(1, Math.floor((now - lastTickAt) / 1000));
  lastTickAt = now;
  let sleep = read(SLEEP_KEY, null);
  if (sleep?.status === 'active' && !sleep.pausedByUser && !sleep.pausedWithPlayback && !sleep.awaitingEnd) {
    const nextRemaining = Math.max(0, sleep.remainingSeconds - elapsedTicks);
    if (sleep.fade && playerRef?.setVolume && nextRemaining <= 600) {
      const factor = nextRemaining <= 60
        ? sleep.ending === 'duration'
          ? nextRemaining / 60 * 0.25
          : 0.12 + (nextRemaining / 60 * 0.13)
        : nextRemaining <= 300
          ? 0.25 + ((nextRemaining - 60) / 240) * 0.4
          : 0.65 + ((nextRemaining - 300) / 300) * 0.35;
      playerRef.setVolume((originalSleepVolume ?? playerRef.volume) * factor);
    }
    const elapsedSeconds = (sleep.elapsedSeconds || 0) + elapsedTicks;
    if (nextRemaining <= 0 && sleep.ending === 'duration') completeSleep();
    else if (nextRemaining <= 0 && sleep.ending === 'song') {
      const currentIdentity = identity(playerRef?.currentTrack);
      if (!currentIdentity || sleep.queueFinished) completeSleep('song-ended');
      else update('sleep', { ...sleep, remainingSeconds: 0, elapsedSeconds, awaitingEnd: true, endingTrackIdentity: currentIdentity });
    } else if (nextRemaining <= 0 && sleep.ending === 'playlist') {
      update('sleep', { ...sleep, remainingSeconds: 0, elapsedSeconds, awaitingEnd: true });
    } else update('sleep', { ...sleep, remainingSeconds: nextRemaining, elapsedSeconds });
  }

  const focus = read(FOCUS_KEY, null);
  if (focus?.status === 'active' || focus?.status === 'break') {
    if (focus.status === 'active' && focus.phase === 'focus' && focus.remainingSeconds > 0) {
      const nextRemaining = Math.max(0, focus.remainingSeconds - elapsedTicks);
      if (nextRemaining <= 0) finishFocusPhase(focus);
      else update('focus', { ...focus, remainingSeconds: nextRemaining });
    } else if (focus.status === 'break' && focus.phase === 'break' && focus.breakStarted && focus.remainingSeconds > 0) {
      const nextRemaining = Math.max(0, focus.remainingSeconds - elapsedTicks);
      if (nextRemaining <= 0) finishFocusPhase({ ...focus, remainingSeconds: 0 });
      else update('focus', { ...focus, remainingSeconds: nextRemaining });
    }
  }
}, 1000);

export function connectSessionPlayer(player) {
  playerRef = player;
  const sleep = read(SLEEP_KEY, null);
  if (sleep?.status === 'active' && sleep.fade && originalSleepVolume === null) originalSleepVolume = sleep.originalVolume;
}

export function getSession(type) {
  return read(type === 'sleep' ? SLEEP_KEY : FOCUS_KEY, null);
}

export function getSessionHistory(type) {
  return read(type === 'sleep' ? SLEEP_HISTORY_KEY : FOCUS_HISTORY_KEY, []);
}

export function startSleepSession(options, player) {
  connectSessionPlayer(player);
  const previousSession = getSession('sleep');
  restoreSleepSettings(previousSession, player);
  const track = options.musicType === 'playlist' ? options.playlist.tracks[0] : options.track;
  if (!track) throw new Error('Choose a song or playlist before starting a sleep session.');
  const queue = options.musicType === 'playlist' ? options.playlist.tracks : [track];
  const originalRepeatMode = player.repeatMode;
  if (options.ending === 'song' || options.ending === 'playlist') {
    player.repeatMode = 'none';
    player.emitEvent?.('repeat-changed', { repeatMode: 'none' });
  }
  if (options.musicType === 'playlist' && options.ending === 'playlist') {
    player.setQueue(queue);
    player.playTrack(track, queue);
  } else {
    player.playTrack(track, queue);
  }
  originalSleepVolume = player.volume;
  const session = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
    status: 'active',
    startedAt: new Date().toISOString(),
    musicType: options.musicType,
    track,
    playlist: options.musicType === 'playlist' ? options.playlist : null,
    ending: options.ending,
    fade: options.fade,
    durationSeconds: options.durationSeconds,
    remainingSeconds: options.durationSeconds,
    elapsedSeconds: 0,
    songsPlayed: 1,
    initialTrackIdentity: identity(track),
    playedTrackIdentities: [identity(track)],
    originalVolume: player.volume,
    originalRepeatMode,
    pauseWithPlayback: true,
    pausedWithPlayback: !player.isPlaying,
    pausedByUser: false,
    awaitingEnd: false,
    queueFinished: false,
    endingTrackIdentity: '',
  };
  update('sleep', session);
  return session;
}

export function pauseSleepTimer(paused) {
  const session = getSession('sleep');
  if (!session || session.status !== 'active') return;
  update('sleep', { ...session, pausedByUser: paused });
}

export function cancelSleepSession(player = playerRef) {
  const session = getSession('sleep');
  if (!session || !['active', 'paused'].includes(session.status)) return;
  restoreSleepSettings(session, player);
  update('sleep', { ...session, status: 'cancelled', endedAt: new Date().toISOString() });
  addSleepHistory(session, false);
}

export function clearSleepSession() {
  write(SLEEP_KEY, null);
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { type: 'sleep', session: null } }));
}

export function startFocusSession(options, player) {
  connectSessionPlayer(player);
  const track = options.musicType === 'playlist' ? options.playlist?.tracks?.[0] : options.track;
  if (track) {
    const queue = options.musicType === 'playlist' ? options.playlist.tracks : [track];
    player.playTrack(track, queue);
  }
  const session = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
    status: 'active',
    phase: 'focus',
    startedAt: new Date().toISOString(),
    goal: options.goal,
    musicType: options.musicType,
    music: track || null,
    playlist: options.musicType === 'playlist' ? options.playlist : null,
    mode: options.mode,
    focusMinutes: options.focusMinutes,
    shortBreakMinutes: options.shortBreakMinutes,
    longBreakMinutes: options.longBreakMinutes,
    longBreakEvery: options.longBreakEvery,
    totalSessions: options.totalSessions,
    remainingSeconds: options.focusMinutes * 60,
    completedSessions: 0,
    breakStarted: false,
    pauseWithPlayback: false,
  };
  update('focus', session);
  return session;
}

export function pauseFocusSession(paused) {
  const session = getSession('focus');
  if (!session || !['active', 'break', 'paused'].includes(session.status)) return;
  update('focus', { ...session, status: paused ? 'paused' : session.phase === 'break' ? 'break' : 'active' });
}

export function startFocusBreak() {
  const session = getSession('focus');
  if (!session || session.phase !== 'break' || session.status === 'completed') return;
  update('focus', { ...session, status: 'break', breakStarted: true });
}

export function skipFocusBreak() {
  const session = getSession('focus');
  if (!session || session.phase !== 'break') return;
  update('focus', { ...session, status: 'ready', phase: 'ready', remainingSeconds: 0, breakStarted: false });
}

export function startNextFocusSession() {
  const session = getSession('focus');
  if (!session || session.phase !== 'ready') return;
  update('focus', { ...session, status: 'active', phase: 'focus', remainingSeconds: session.focusMinutes * 60, startedAt: new Date().toISOString(), breakStarted: false });
}

export function finishFocusSession() {
  const session = getSession('focus');
  if (!session || session.phase === 'completed') return;
  update('focus', { ...session, status: 'completed', phase: 'completed', completedAt: new Date().toISOString() });
}

export function clearFocusSession() {
  write(FOCUS_KEY, null);
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { type: 'focus', session: null } }));
}

export function recordFocusCompletion(session, minutes) {
  addFocusHistory({ ...session, completedSessions: session.completedSessions + 1 }, minutes);
}

export const SESSION_UPDATE_EVENT = UPDATE_EVENT;
export const SESSION_COMPLETE_EVENT = COMPLETE_EVENT;
