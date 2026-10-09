import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findTracks } from '../song-search.js';
import { getPlaceholderSvg } from '../../utils.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import './FriendSync.css';

const STORAGE_KEY = 'melodixa-friend-sync-rooms';
const REACTIONS = [
  { id: 'love', label: 'Love it', emoji: '❤️' },
  { id: 'fire', label: 'Amazing', emoji: '🔥' },
  { id: 'emotional', label: 'Emotional', emoji: '🥹' },
  { id: 'funny', label: 'Funny', emoji: '😂' },
];
const STARTER_QUEUE = [
  { id: 'starter-perfect', name: 'Perfect', artist: 'Ed Sheeran', image: getPlaceholderSvg('Perfect'), addedBy: 'Shelphin' },
  { id: 'starter-until', name: 'Until I Found You', artist: 'Stephen Sanchez', image: getPlaceholderSvg('Until I Found You'), addedBy: 'Maya' },
  { id: 'starter-smile', name: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', image: getPlaceholderSvg('Die With A Smile'), addedBy: 'Jordan' },
];
const STARTER_VOTES = [
  { ...STARTER_QUEUE[1], id: 'vote-until', votes: 5, voters: [] },
  { ...STARTER_QUEUE[0], id: 'vote-perfect', votes: 3, voters: [] },
  { id: 'vote-photograph', name: 'Photograph', artist: 'Ed Sheeran', image: getPlaceholderSvg('Photograph'), addedBy: 'Maya', votes: 2, voters: [] },
];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createRoomCode(rooms) {
  let code;
  do {
    code = `MX${Math.floor(1000 + Math.random() * 9000)}`;
  } while (rooms.some((room) => room.code === code));
  return code;
}

function loadRooms() {
  try {
    const rooms = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(rooms)) throw new Error('Saved rooms are not in the expected format.');
    return { rooms, error: '' };
  } catch (error) {
    console.error('Could not load Friend Sync rooms:', error);
    return { rooms: [], error: 'Saved rooms could not be loaded. You can still create a room.' };
  }
}

function persistRooms(rooms) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    window.dispatchEvent(new CustomEvent('melodixa-friend-sync-updated'));
    return true;
  } catch (error) {
    console.error('Could not save Friend Sync room:', error);
    return false;
  }
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

function Icon({ name, size = 18 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'play') return <svg {...props}><path d="m8 5 12 7-12 7V5Z" /></svg>;
  if (name === 'pause') return <svg {...props}><path d="M8 5v14M16 5v14" /></svg>;
  if (name === 'next') return <svg {...props}><path d="m5 5 10 7-10 7V5ZM19 5v14" /></svg>;
  if (name === 'previous') return <svg {...props}><path d="m19 5-10 7 10 7V5ZM5 5v14" /></svg>;
  if (name === 'volume') return <svg {...props}><path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18 5a9 9 0 0 1 0 14" /></svg>;
  if (name === 'users') return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></svg>;
  if (name === 'copy') return <svg {...props}><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
  if (name === 'share') return <svg {...props}><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
  if (name === 'plus') return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'send') return <svg {...props}><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></svg>;
  if (name === 'headphones') return <svg {...props}><path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14v4a2 2 0 0 0 2 2h2v-8H5a2 2 0 0 0-2 2ZM21 14v4a2 2 0 0 1-2 2h-2v-8h2a2 2 0 0 1 2 2Z" /></svg>;
  if (name === 'signal') return <svg {...props}><path d="M3 20h2m3-4h2m3-4h2m3-4h2" /></svg>;
  if (name === 'spark') return <svg {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></svg>;
  if (name === 'lock') return <svg {...props}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg>;
  return <svg {...props}><path d="M4 12h16" /></svg>;
}

function CreateRoomDialog({ onClose, onCreate }) {
  const [name, setName] = useState('Besties Night');
  const [privacy, setPrivacy] = useState('friends');
  const [maxMembers, setMaxMembers] = useState('6');

  const submit = (event) => {
    event.preventDefault();
    onCreate({ name: name.trim(), privacy, maxMembers: Number(maxMembers) });
  };

  return (
    <div className="friend-sync__dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="friend-sync__dialog" role="dialog" aria-modal="true" aria-labelledby="friend-sync-create-title">
        <button type="button" className="friend-sync__dialog-close" onClick={onClose} aria-label="Close create room">×</button>
        <span className="friend-sync__eyebrow">MAKE A LITTLE SPACE FOR EVERYONE</span>
        <h2 id="friend-sync-create-title">Create your music room</h2>
        <p>Pick a name. Bring your people. Let the music do the rest.</p>
        <form onSubmit={submit}>
          <label className="friend-sync__dialog-field"><span>Room name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="Friday night together" required /></label>
          <fieldset className="friend-sync__privacy-field">
            <legend>Who can join?</legend>
            <button type="button" className={privacy === 'private' ? 'is-selected' : ''} aria-pressed={privacy === 'private'} onClick={() => setPrivacy('private')}><span>🔒</span><span><strong>Private</strong><small>Only people with your invite code</small></span></button>
            <button type="button" className={privacy === 'friends' ? 'is-selected' : ''} aria-pressed={privacy === 'friends'} onClick={() => setPrivacy('friends')}><span>♡</span><span><strong>Friends only</strong><small>Share your room code with friends</small></span></button>
          </fieldset>
          <label className="friend-sync__dialog-field"><span>Room size</span><select value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)}>{[3, 4, 5, 6, 8, 10].map((count) => <option value={count} key={count}>{count} friends</option>)}</select></label>
          <button className="friend-sync__primary-button" type="submit"><Icon name="headphones" size={17} /> Create Sync Room <span>↗</span></button>
        </form>
      </section>
    </div>
  );
}

function TrackSearchDialog({ onClose, onAdd }) {
  const [query, setQuery] = useState('');
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
    } catch (searchError) {
      console.error('Could not search tracks for Friend Sync:', searchError);
      setError('Could not search for songs right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="friend-sync__dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="friend-sync__dialog friend-sync__dialog--search" role="dialog" aria-modal="true" aria-labelledby="friend-sync-search-title">
        <button type="button" className="friend-sync__dialog-close" onClick={onClose} aria-label="Close song search">×</button>
        <span className="friend-sync__eyebrow">ADD TO THE ROOM</span>
        <h2 id="friend-sync-search-title">Find the next song</h2>
        <form className="friend-sync__search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" aria-label="Search songs or artists" required /><button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button></form>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        {error && <p className="friend-sync__inline-error" role="alert">{error}</p>}
        <div className="friend-sync__search-results">{tracks.map((track) => <button type="button" className="friend-sync__search-result" key={track.id || track.name} onClick={() => onAdd(normalizeTrack(track))}><img src={track.image || getPlaceholderSvg(track.name)} alt="" /><span><strong>{track.name}</strong><small>{track.artist}</small></span><Icon name="plus" size={16} /></button>)}</div>
      </section>
    </div>
  );
}

function FriendSync({ musicPlayer, ui, playlistStore }) {
  const initialRooms = useMemo(loadRooms, []);
  const [rooms, setRooms] = useState(initialRooms.rooms);
  const [storageError, setStorageError] = useState(initialRooms.error);
  const [room, setRoom] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [tab, setTab] = useState('queue');
  const [toast, setToast] = useState('');
  const [currentTrack, setCurrentTrack] = useState(() => normalizeTrack(musicPlayer?.currentTrack));
  const [isPlaying, setIsPlaying] = useState(Boolean(musicPlayer?.isPlaying));
  const [progress, setProgress] = useState(musicPlayer?.currentTime || 0);
  const [duration, setDuration] = useState(musicPlayer?.duration || 0);
  const [volume, setVolume] = useState(musicPlayer?.volume ?? 0.75);
  const [reactions, setReactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [sessionStats, setSessionStats] = useState({ songsPlayed: 0, reactionCount: 0, artistCounts: {} });
  const channelRef = useRef(null);
  const remotePlaybackRef = useRef(false);
  const lastProgressBroadcastRef = useRef(0);
  const toastTimeoutRef = useRef(null);
  const selfId = useRef(createId());

  useEffect(() => {
    if (!room?.code) return undefined;
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(`melodixa-sync-${room.code}`);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === 'room-updated' && event.data.room) {
        const incoming = event.data.room;
        setRoom(incoming);
        setRooms((current) => current.map((item) => item.code === incoming.code ? incoming : item));
        const incomingTrack = normalizeTrack(incoming.track);
        const currentId = musicPlayer?.currentTrack?.id || musicPlayer?.currentTrack?.uri;
        const incomingId = incomingTrack?.id || incomingTrack?.uri;
        const changedTrack = incomingTrack && incomingId !== currentId;
        const changedPlaying = Boolean(incoming.isPlaying) !== Boolean(musicPlayer?.isPlaying);
        const drift = Math.abs((incoming.progress || 0) - (musicPlayer?.currentTime || 0));
        if (changedTrack || changedPlaying || drift > 4) {
          remotePlaybackRef.current = true;
          const applyPlayback = async () => {
            try {
              if (changedTrack) await musicPlayer?.playTrack(incomingTrack, incoming.queue);
              else if (changedPlaying) await musicPlayer?.togglePlay();
              if (drift > 4) await musicPlayer?.seek(incoming.progress || 0);
              if (!incoming.isPlaying && musicPlayer?.isPlaying) await musicPlayer?.togglePlay();
            } catch (error) {
              console.error('Could not apply shared Friend Sync playback:', error);
            } finally {
              window.setTimeout(() => { remotePlaybackRef.current = false; }, 250);
            }
          };
          void applyPlayback();
        }
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [room?.code]);

  useEffect(() => {
    const refreshRooms = () => setRooms(loadRooms().rooms);
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const nextRooms = loadRooms().rooms;
      setRooms(nextRooms);
      if (room) setRoom(nextRooms.find((item) => item.code === room.code) || room);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('melodixa-friend-sync-updated', refreshRooms);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('melodixa-friend-sync-updated', refreshRooms);
    };
  }, [room]);

  useEffect(() => {
    const trackChanged = (event) => {
      const nextTrack = normalizeTrack(event.detail?.track || musicPlayer?.currentTrack);
      if (nextTrack) setCurrentTrack(nextTrack);
    };
    const playbackChanged = (event) => setIsPlaying(Boolean(event.detail?.isPlaying));
    const timeUpdated = (event) => {
      if (typeof event.detail?.currentTime === 'number') setProgress(event.detail.currentTime);
      if (typeof event.detail?.duration === 'number') setDuration(event.detail.duration);
    };
    window.addEventListener('music-player-track-changed', trackChanged);
    window.addEventListener('music-player-playback-state-changed', playbackChanged);
    window.addEventListener('music-player-time-updated', timeUpdated);
    return () => {
      window.removeEventListener('music-player-track-changed', trackChanged);
      window.removeEventListener('music-player-playback-state-changed', playbackChanged);
      window.removeEventListener('music-player-time-updated', timeUpdated);
    };
  }, [musicPlayer]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const showToast = (message) => {
    setToast(message);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(''), 2800);
  };

  const broadcastRoom = (updatedRoom) => {
    const nextRooms = rooms.map((item) => item.code === updatedRoom.code ? updatedRoom : item);
    if (!rooms.some((item) => item.code === updatedRoom.code)) nextRooms.unshift(updatedRoom);
    if (!persistRooms(nextRooms)) {
      setStorageError('This room update could not be saved. Check your browser storage and try again.');
      return false;
    }
    setStorageError('');
    setRooms(nextRooms);
    setRoom(updatedRoom);
    channelRef.current?.postMessage({ type: 'room-updated', room: updatedRoom });
    return true;
  };

  const createRoom = ({ name, privacy, maxMembers }) => {
    const currentRooms = loadRooms().rooms;
    const now = new Date().toISOString();
    const initialTrack = normalizeTrack(musicPlayer?.currentTrack);
    const newRoom = {
      code: createRoomCode(currentRooms),
      name,
      privacy,
      maxMembers,
      hostId: selfId.current,
      createdAt: now,
      members: [{ id: selfId.current, name: 'Shelphin', role: 'host', status: musicPlayer?.isPlaying ? 'Listening' : 'In the room', avatar: 'S', joinedAt: now }],
      track: initialTrack,
      isPlaying: Boolean(musicPlayer?.isPlaying),
      progress: musicPlayer?.currentTime || 0,
      duration: musicPlayer?.duration || 0,
      queue: STARTER_QUEUE.map((item) => ({ ...item })),
      votes: STARTER_VOTES.map((item) => ({ ...item, voters: [] })),
      messages: [],
      reactions: [],
      sessionStartedAt: now,
      songsPlayed: 0,
      reactionCount: 0,
    };
    if (!persistRooms([newRoom, ...currentRooms])) {
      setStorageError('The room could not be saved. Check your browser storage and try again.');
      return;
    }
    setRooms([newRoom, ...currentRooms]);
    setRoom(newRoom);
    setSessionStartedAt(now);
    setSessionStats({ songsPlayed: 0, reactionCount: 0, artistCounts: {} });
    setCreateOpen(false);
  };

  const joinRoom = (event) => {
    event.preventDefault();
    const roomCode = roomCodeInput.trim().toUpperCase();
    const savedRoom = rooms.find((item) => item.code === roomCode);
    if (!savedRoom) {
      showToast('Room not found on this device. Room codes currently work in this browser demo.');
      return;
    }
    if (savedRoom.members.length >= savedRoom.maxMembers && !savedRoom.members.some((member) => member.id === selfId.current)) {
      showToast('This listening room is full.');
      return;
    }
    const joinedRoom = savedRoom.members.some((member) => member.id === selfId.current)
      ? savedRoom
      : {
        ...savedRoom,
        members: [...savedRoom.members, { id: selfId.current, name: 'Shelphin', role: 'guest', status: savedRoom.isPlaying ? 'Listening' : 'In the room', avatar: 'S', joinedAt: new Date().toISOString() }],
      };
    if (broadcastRoom(joinedRoom)) {
      setSessionStartedAt(joinedRoom.sessionStartedAt);
      setRoomCodeInput('');
    }
  };

  const shareRoom = async () => {
    if (!room) return;
    const shareData = { title: `${room.name} · Melodixa`, text: `Come listen with me in ${room.name}. Room code: ${room.code}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${shareData.text}`);
        showToast('Room invite copied to clipboard.');
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Could not share Friend Sync room:', error);
      showToast('Could not share the room. Use Copy Room Code instead.');
    }
  };

  const copyRoomCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      showToast('Room code copied.');
    } catch (error) {
      console.error('Could not copy Friend Sync room code:', error);
      showToast(`Your room code is ${room.code}.`);
    }
  };

  const updatePlayback = async (action) => {
    if (action === 'playPause') {
      if (!currentTrack && room?.queue?.length) {
        const first = room.queue[0];
        setCurrentTrack(first);
        try { await musicPlayer?.playTrack(first, room.queue); } catch (error) { console.error('Could not start Friend Sync playback:', error); }
      } else {
        try { await musicPlayer?.togglePlay(); } catch (error) { console.error('Could not toggle Friend Sync playback:', error); }
      }
    } else if (action === 'next') {
      try { musicPlayer?.next(); } catch (error) { console.error('Could not skip to the next track:', error); }
    } else {
      try { musicPlayer?.previous(); } catch (error) { console.error('Could not return to the previous track:', error); }
    }
  };

  const addSong = (song) => {
    if (!room || !song) return;
    const updated = { ...room, queue: [...room.queue, { ...song, id: createId(), addedBy: 'Shelphin' }] };
    if (broadcastRoom(updated)) {
      setSearchOpen(false);
      showToast(`${song.name} added to the shared queue.`);
    }
  };

  const removeSong = (songId) => {
    if (!room || room.hostId !== selfId.current) return;
    broadcastRoom({ ...room, queue: room.queue.filter((song) => song.id !== songId) });
  };

  const addReaction = (reaction) => {
    if (!room) return;
    const moment = { id: createId(), emoji: reaction.emoji, name: reaction.label, by: 'Shelphin', createdAt: Date.now() };
    const updated = { ...room, reactions: [...(room.reactions || []), moment].slice(-24), reactionCount: (room.reactionCount || 0) + 1 };
    if (broadcastRoom(updated)) {
      setReactions((current) => [...current, moment]);
      setSessionStats((current) => ({ ...current, reactionCount: current.reactionCount + 1 }));
      window.setTimeout(() => setReactions((current) => current.filter((item) => item.id !== moment.id)), 3000);
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!chatMessage.trim() || !room) return;
    const nextMessage = { id: createId(), name: 'Shelphin', avatar: 'S', text: chatMessage.trim(), sentAt: new Date().toISOString() };
    if (broadcastRoom({ ...room, messages: [...room.messages, nextMessage].slice(-60) })) setChatMessage('');
  };

  const voteForSong = (songId) => {
    if (!room) return;
    const updatedVotes = room.votes.map((suggestion) => {
      if (suggestion.id !== songId) return suggestion;
      const voters = suggestion.voters || [];
      const hasVoted = voters.includes(selfId.current);
      return { ...suggestion, voters: hasVoted ? voters.filter((id) => id !== selfId.current) : [...voters, selfId.current], votes: Math.max(0, suggestion.votes + (hasVoted ? -1 : 1)) };
    });
    const sortedVotes = [...updatedVotes].sort((a, b) => b.votes - a.votes);
    const queueWithoutSuggestions = room.queue.filter((item) => !item.voteSuggestion);
    const rankedQueue = sortedVotes.map((suggestion) => ({ ...suggestion, voteSuggestion: true, addedBy: suggestion.addedBy || 'Room vote' }));
    broadcastRoom({ ...room, votes: updatedVotes, queue: [...rankedQueue, ...queueWithoutSuggestions] });
  };

  const suggestSong = (song) => {
    if (!room || room.votes.some((suggestion) => suggestion.name === song.name && suggestion.artist === song.artist)) {
      showToast('That song is already in the vote.');
      return;
    }
    const suggestion = { ...song, id: createId(), votes: 1, voters: [selfId.current], addedBy: 'Shelphin' };
    const votes = [...room.votes, suggestion].sort((a, b) => b.votes - a.votes);
    const queue = [...votes.map((item) => ({ ...item, voteSuggestion: true })), ...room.queue.filter((item) => !item.voteSuggestion)];
    if (broadcastRoom({ ...room, votes, queue })) {
      setSearchOpen(false);
      setTab('votes');
      showToast(`${song.name} added to the vote.`);
    }
  };

  const endSession = () => {
    if (!room) return;
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - new Date(sessionStartedAt || room.sessionStartedAt).getTime()) / 60000));
    const artistCounts = sessionStats.artistCounts;
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || room.track?.artist || 'Your favourites';
    setSummary({
      songsPlayed: Math.max(sessionStats.songsPlayed, room.songsPlayed || 0),
      minutesTogether: elapsedMinutes,
      friends: room.members.length,
      reactions: Math.max(sessionStats.reactionCount, room.reactionCount || 0),
      artist: topArtist,
    });
    const nextRooms = rooms.filter((item) => item.code !== room.code);
    if (!persistRooms(nextRooms)) {
      setStorageError('The session could not be ended because the room could not be updated in storage.');
      showToast('Could not end the session. Please check your browser storage and try again.');
      return;
    }
    setStorageError('');
    setRooms(nextRooms);
    setRoom(null);
    setRoomName('');
  };

  const playSongFromList = async (song) => {
    setCurrentTrack(song);
    try {
      await musicPlayer?.playTrack(song, room?.queue);
    } catch (error) {
      console.error('Could not play song in Friend Sync room:', error);
      ui?.showToast?.('This song could not be played right now.', 'error');
    }
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!room) return;
    const trackListener = (event) => {
        if (remotePlaybackRef.current) return;
        const song = normalizeTrack(event.detail?.track || musicPlayer?.currentTrack);
      if (!song) return;
      setCurrentTrack(song);
      setProgress(0);
      setDuration(musicPlayer?.duration || song.duration_ms / 1000 || 180);
      setSessionStats((current) => ({
        ...current,
        songsPlayed: current.songsPlayed + 1,
        artistCounts: { ...current.artistCounts, [song.artist]: (current.artistCounts[song.artist] || 0) + 1 },
      }));
      const updated = { ...room, track: song, progress: 0, duration: song.duration_ms / 1000 || 180, isPlaying: Boolean(musicPlayer?.isPlaying), songsPlayed: (room.songsPlayed || 0) + 1 };
      broadcastRoom(updated);
    };
    const playbackListener = (event) => {
      if (remotePlaybackRef.current) return;
      broadcastRoom({ ...room, isPlaying: Boolean(event.detail?.isPlaying) });
    };
    const timeListener = (event) => {
      const currentTime = event.detail?.currentTime || 0;
      const currentDuration = event.detail?.duration || 0;
      setProgress(currentTime);
      setDuration(currentDuration);
      if (remotePlaybackRef.current || Date.now() - lastProgressBroadcastRef.current < 5000) return;
      lastProgressBroadcastRef.current = Date.now();
      broadcastRoom({ ...room, progress: currentTime, duration: currentDuration });
    };
    window.addEventListener('music-player-track-changed', trackListener);
    window.addEventListener('music-player-playback-state-changed', playbackListener);
    window.addEventListener('music-player-time-updated', timeListener);
    return () => {
      window.removeEventListener('music-player-track-changed', trackListener);
      window.removeEventListener('music-player-playback-state-changed', playbackListener);
      window.removeEventListener('music-player-time-updated', timeListener);
    };
  }, [room, musicPlayer]);

  useEffect(() => {
    if (!room) return;
    setCurrentTrack(normalizeTrack(room.track));
    setIsPlaying(Boolean(room.isPlaying));
    setProgress(room.progress || 0);
    setDuration(room.duration || room.track?.duration_ms / 1000 || 0);
  }, [room?.code]);

  const sortedQueue = useMemo(() => [...(room?.queue || [])].sort((a, b) => {
    if (a.voteSuggestion && b.voteSuggestion) return (b.votes || 0) - (a.votes || 0);
    if (a.voteSuggestion) return -1;
    if (b.voteSuggestion) return 1;
    return 0;
  }), [room?.queue]);

  return (
    <main className="friend-sync">
      <header className="friend-sync__header">
        <a className="friend-sync__brand" href="#friend-sync" aria-label="Melodixa Friend Sync"><span className="friend-sync__brand-icon"><Icon name="headphones" size={17} /></span><span>MELODIXA <i>/</i> FRIEND SYNC</span></a>
        <div className="friend-sync__header-tag"><span /> DIFFERENT PLACES. ONE MOMENT.</div>
      </header>

      {!room ? (
        <section className="friend-sync__lobby">
          <div className="friend-sync__lobby-hero">
            <div className="friend-sync__lobby-copy">
              <span className="friend-sync__eyebrow">SOME THINGS SOUND BETTER TOGETHER</span>
              <h1>Different places.<br /><em>One song. One moment.</em></h1>
              <p>Press play at the same time, from wherever you are. Make a room for your people, your music, and the little moments in between.</p>
              <div className="friend-sync__lobby-actions"><button className="friend-sync__primary-button" type="button" onClick={() => setCreateOpen(true)}><Icon name="headphones" size={17} /> Create Sync Room <span>↗</span></button><a href="#join-room" className="friend-sync__secondary-link">Have a room code? Join in <span>↓</span></a></div>
              <div className="friend-sync__lobby-social"><div className="friend-sync__avatars"><span>S</span><span>M</span><span>J</span><span>＋</span></div><span>Your people, just a beat away</span></div>
            </div>
            <div className="friend-sync__lobby-art" aria-hidden="true">
              <div className="friend-sync__lobby-halo friend-sync__lobby-halo--outer" /><div className="friend-sync__lobby-halo friend-sync__lobby-halo--inner" />
              <div className="friend-sync__lobby-disc"><div className="friend-sync__lobby-disc-center"><Icon name="headphones" size={29} /></div></div>
              <span className="friend-sync__floating-person friend-sync__floating-person--one"><i>S</i><span>Shelphin<small>listening now</small></span><b>♪</b></span>
              <span className="friend-sync__floating-person friend-sync__floating-person--two"><i>M</i><span>Maya<small>across the city</small></span><b>♪</b></span>
              <span className="friend-sync__floating-person friend-sync__floating-person--three"><i>J</i><span>Jordan<small>same song, same time</small></span><b>♪</b></span>
              <span className="friend-sync__sound-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
              <span className="friend-sync__lobby-quote">“Wish you were here.<br />So I pressed play.”</span>
            </div>
          </div>

          <div className="friend-sync__join-panel" id="join-room">
            <div className="friend-sync__join-copy"><span className="friend-sync__mini-icon"><Icon name="users" size={17} /></span><span><strong>Your friends saved you a seat.</strong><small>Enter their room code to tune in.</small></span></div>
            <form className="friend-sync__join-form" onSubmit={joinRoom}>
              <label htmlFor="friend-sync-code">ROOM CODE</label><input id="friend-sync-code" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase().slice(0, 6))} placeholder="MX4821" maxLength={6} pattern="MX[0-9]{4}" required aria-label="Enter room code" /><button className="friend-sync__join-button" type="submit">Join a room <span>→</span></button>
            </form>
          </div>
          <div className="friend-sync__lobby-footer"><span><Icon name="signal" size={15} /> Room controls follow your Melodixa player on this device.</span><span>YOUR LISTENING ROOM IS JUST BETWEEN YOU.</span></div>
        </section>
      ) : (
        <section className="friend-sync__room">
          <div className="friend-sync__room-topbar">
            <button type="button" className="friend-sync__back-button" onClick={endSession}>← <span>Leave room</span></button>
            <div className="friend-sync__room-title"><span className="friend-sync__eyebrow">YOUR LISTENING ROOM</span><h1>{room.name}</h1></div>
            <div className="friend-sync__room-code"><span>ROOM CODE</span><strong>{room.code}</strong><button type="button" onClick={copyRoomCode} aria-label="Copy room code"><Icon name="copy" size={15} /></button><button type="button" onClick={shareRoom} aria-label="Share room"><Icon name="share" size={15} /></button></div>
          </div>

          <div className="friend-sync__sync-banner"><span className="friend-sync__sync-pulse" /><strong>Synced with room</strong><span className="friend-sync__sync-separator">·</span><span>Everyone is listening together</span><span className="friend-sync__local-badge">LOCAL DEMO</span></div>

          <div className="friend-sync__room-grid">
            <aside className="friend-sync__now-panel">
              <div className="friend-sync__panel-label"><span>NOW PLAYING</span><span className="friend-sync__live-equalizer"><i /><i /><i /><i /></span></div>
              <div className="friend-sync__track-heading">
                {currentTrack ? <><h2>{currentTrack.name}</h2><p>{currentTrack.artist}</p></> : <><h2>Choose a song<br />for the room.</h2><p>The queue is waiting.</p></>}
              </div>
              <div className="friend-sync__player-progress"><input type="range" min="0" max={duration || 100} value={Math.min(progress, duration || 100)} style={{ background: `linear-gradient(90deg, #c9a9df 0%, #c9a9df ${duration ? (progress / duration) * 100 : 0}%, rgba(255, 255, 255, 0.15) ${duration ? (progress / duration) * 100 : 0}%, rgba(255, 255, 255, 0.15) 100%)` }} onChange={(event) => { const value = Number(event.target.value); setProgress(value); musicPlayer?.seek(value); }} aria-label="Song progress" /><div><span>{formatTime(progress)}</span><span>-{formatTime(Math.max(0, duration - progress))}</span></div></div>
              <div className="friend-sync__playback-controls">
                <button type="button" onClick={() => updatePlayback('previous')} aria-label="Previous song"><Icon name="previous" size={17} /></button>
                <button type="button" className="friend-sync__main-play" onClick={() => updatePlayback('playPause')} aria-label={isPlaying ? 'Pause music' : 'Play music'}><Icon name={isPlaying ? 'pause' : 'play'} size={19} /></button>
                <button type="button" onClick={() => updatePlayback('next')} aria-label="Next song"><Icon name="next" size={17} /></button>
              </div>
              <label className="friend-sync__volume"><Icon name="volume" size={15} /><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); musicPlayer?.setVolume(value); }} aria-label="Volume" /><span>{Math.round(volume * 100)}%</span></label>
              <div className="friend-sync__track-reaction-strip"><span>A LITTLE LOVE FOR THIS SONG</span><div>{REACTIONS.map((reaction) => <button type="button" key={reaction.id} aria-label={reaction.label} title={reaction.label} onClick={() => addReaction(reaction)}>{reaction.emoji}</button>)}</div></div>
            </aside>

            <section className="friend-sync__stage" aria-label="Shared listening room player">
              <div className="friend-sync__stage-orbit friend-sync__stage-orbit--outer" /><div className="friend-sync__stage-orbit friend-sync__stage-orbit--inner" />
              <div className={`friend-sync__artwork-wrap${isPlaying ? ' is-playing' : ''}`}>
                <img className="friend-sync__artwork" src={currentTrack?.image || getPlaceholderSvg(room.name || 'Melodixa')} alt={currentTrack ? `${currentTrack.name} album artwork` : 'Listening room artwork'} />
                <div className="friend-sync__artwork-glow" />
                <span className="friend-sync__vinyl-ring" />
              </div>
              <div className="friend-sync__stage-meta">{currentTrack ? `${currentTrack.name} · ${currentTrack.artist}` : 'A soundtrack for right now'}</div>
              <div className="friend-sync__stage-caption"><span className="friend-sync__stage-live" /> ON THE SAME WAVELENGTH</div>
              <div className="friend-sync__floating-reactions" aria-live="polite">{reactions.map((item, index) => <span className="friend-sync__floating-reaction" key={item.id} style={{ '--reaction-index': index }}>{item.emoji}</span>)}</div>
              <div className="friend-sync__stage-people">{room.members.map((member, index) => <span className="friend-sync__stage-avatar" key={member.id} style={{ '--member-index': index }}>{member.avatar}</span>)}</div>
            </section>

            <aside className="friend-sync__social-panel">
              <section className="friend-sync__friends-section">
                <div className="friend-sync__social-heading"><span><strong>In the room</strong><small>{room.members.length} of {room.maxMembers} here</small></span><button type="button" onClick={shareRoom} aria-label="Invite friends"><Icon name="plus" size={16} /></button></div>
                <div className="friend-sync__member-list">{room.members.map((member) => <div className="friend-sync__member" key={member.id}><span className={`friend-sync__member-avatar${member.role === 'host' ? ' is-host' : ''}`}>{member.avatar}</span><span><strong>{member.name}{member.id === selfId.current ? ' (you)' : ''}</strong><small>{member.id === selfId.current && isPlaying ? 'Listening with the room' : member.status}</small></span><i className={isPlaying ? 'is-listening' : ''} /></div>)}{room.members.length === 1 && <button className="friend-sync__invite-friends" type="button" onClick={shareRoom}><Icon name="users" size={15} /> Invite friends to listen together</button>}</div>
                <div className="friend-sync__invite-code"><span>ROOM CODE</span><strong>{room.code}</strong><button type="button" onClick={copyRoomCode}><Icon name="copy" size={13} /> Copy Room Code</button><button type="button" onClick={shareRoom}><Icon name="share" size={13} /> Share with Friends</button></div>
              </section>
              <section className="friend-sync__chat-section">
                <div className="friend-sync__social-heading"><span><strong>Room chatter</strong><small>little things between songs</small></span><span className="friend-sync__chat-live"><i /> LIVE</span></div>
                <div className="friend-sync__chat-messages">{room.messages.length ? room.messages.map((item) => <article className={`friend-sync__chat-message${item.name === 'Shelphin' ? ' is-mine' : ''}`} key={item.id}><span className="friend-sync__chat-avatar">{item.avatar}</span><div><span><strong>{item.name}</strong><time>{new Date(item.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></span><p>{item.text}</p></div></article>) : <p className="friend-sync__chat-empty">The room is yours. Send the first little hello.</p>}</div>
                <form className="friend-sync__chat-form" onSubmit={sendMessage}><input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Say something about the song…" aria-label="Write a room message" maxLength={240} /><button type="submit" aria-label="Send message" disabled={!chatMessage.trim()}><Icon name="send" size={15} /></button></form>
              </section>
            </aside>
          </div>

          <section className="friend-sync__collaboration">
            <div className="friend-sync__collab-tabs" role="tablist" aria-label="Room collaboration">
              <button type="button" role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>Shared queue <span>{room.queue.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'votes'} className={tab === 'votes' ? 'is-active' : ''} onClick={() => setTab('votes')}>Vote for next <span>{room.votes.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'reactions'} className={tab === 'reactions' ? 'is-active' : ''} onClick={() => setTab('reactions')}>Song reactions <span>{room.reactionCount || 0}</span></button>
              {tab !== 'reactions' && <button type="button" className="friend-sync__add-song" onClick={() => setSearchOpen(true)}><Icon name="plus" size={15} /> {tab === 'votes' ? 'Suggest Song' : 'Add Song'}</button>}
            </div>

            {tab === 'queue' && <div className="friend-sync__queue">
              {sortedQueue.length ? sortedQueue.map((song, index) => <article className="friend-sync__queue-item" key={song.id}><span className="friend-sync__queue-number">{String(index + 1).padStart(2, '0')}</span><img src={song.image || getPlaceholderSvg(song.name)} alt="" /><button className="friend-sync__queue-name" type="button" onClick={() => playSongFromList(song)}><strong>{song.name}</strong><small>{song.artist}</small></button><span className="friend-sync__added-by">Added by <strong>{song.addedBy}</strong></span>{song.voteSuggestion && <span className="friend-sync__queue-votes">♥ {song.votes}</span>}<button type="button" className="friend-sync__queue-play" onClick={() => playSongFromList(song)} aria-label={`Play ${song.name}`}><Icon name="play" size={14} /></button>{room.hostId === selfId.current && <button type="button" className="friend-sync__queue-remove" onClick={() => removeSong(song.id)} aria-label={`Remove ${song.name}`}>×</button>}</article>) : <p className="friend-sync__empty-note">No songs yet. Add one to start the room soundtrack.</p>}
            </div>}

            {tab === 'votes' && <div className="friend-sync__votes">{[...room.votes].sort((a, b) => b.votes - a.votes).map((suggestion, index) => { const hasVoted = suggestion.voters?.includes(selfId.current); return <article className="friend-sync__vote-item" key={suggestion.id}><span className="friend-sync__vote-rank">{String(index + 1).padStart(2, '0')}</span><img src={suggestion.image || getPlaceholderSvg(suggestion.name)} alt="" /><span className="friend-sync__vote-song"><strong>{suggestion.name}</strong><small>{suggestion.artist} · suggested by {suggestion.addedBy}</small></span><div className="friend-sync__vote-meter"><span style={{ width: `${Math.max(8, (suggestion.votes / Math.max(1, ...room.votes.map((item) => item.votes))) * 100)}%` }} /></div><button type="button" className={`friend-sync__vote-button${hasVoted ? ' is-voted' : ''}`} aria-pressed={Boolean(hasVoted)} onClick={() => voteForSong(suggestion.id)}>♥ <span>{suggestion.votes}</span></button></article>; })}{room.votes.length === 0 && <p className="friend-sync__empty-note">No suggestions yet. Add a song and suggest it to start a vote.</p>}<p className="friend-sync__vote-note"><Icon name="spark" size={14} /> The most-loved suggestion rises to the top of the shared queue.</p></div>}

            {tab === 'reactions' && <div className="friend-sync__reactions-tab"><div className="friend-sync__reaction-prompt"><span className="friend-sync__mini-icon"><Icon name="spark" size={16} /></span><span><strong>What does this song feel like?</strong><small>Send a little feeling into the room.</small></span></div><div className="friend-sync__reaction-options">{REACTIONS.map((reaction) => <button type="button" key={reaction.id} onClick={() => addReaction(reaction)}><span>{reaction.emoji}</span>{reaction.label}</button>)}<button type="button" onClick={() => { if (!currentTrack) { showToast('Play a song before saving it.'); return; }             try { if (playlistStore?.isTrackLiked?.(currentTrack)) { showToast('This song is already in your Liked Songs.'); return; } playlistStore?.toggleLikedTrack?.(currentTrack); showToast('Song saved to your Liked Songs.'); } catch (error) { console.error('Could not save song to playlist:', error); showToast('Could not save this song to your playlist.'); } }}><span>🎵</span>Add to Liked Songs</button></div><div className="friend-sync__recent-reactions">{(room.reactions || []).slice(-8).reverse().map((reaction) => <span key={reaction.id}>{reaction.emoji} <small>{reaction.by}</small></span>)}{!room.reactions?.length && <small>No reactions just yet. Be the first.</small>}</div></div>}
          </section>
          <footer className="friend-sync__room-footer"><span><Icon name="signal" size={15} /> This room stays in sync with your Melodixa player.</span><button type="button" onClick={endSession}>End listening session <span>↗</span></button></footer>
        </section>
      )}

      {summary && !room && <div className="friend-sync__summary-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSummary(null); }}><article className="friend-sync__summary-card" role="dialog" aria-modal="true" aria-labelledby="friend-sync-summary-title"><button className="friend-sync__dialog-close" type="button" onClick={() => setSummary(null)} aria-label="Close session summary">×</button><span className="friend-sync__summary-icon"><Icon name="headphones" size={23} /></span><span className="friend-sync__eyebrow">UNTIL THE NEXT LISTEN</span><h2 id="friend-sync-summary-title">Your Friend Sync Session</h2><p>For a little while, you were all right here.</p><div className="friend-sync__summary-stats"><span><strong>🎧 {summary.songsPlayed}</strong><small>Songs played</small></span><span><strong>⏱️ {summary.minutesTogether}</strong><small>Minutes together</small></span><span><strong>👯 {summary.friends}</strong><small>Friends</small></span><span><strong>❤️ {summary.reactions}</strong><small>Reactions shared</small></span></div><div className="friend-sync__summary-artist"><span>THE ARTIST OF THE MOMENT</span><strong>🎵 {summary.artist}</strong></div><blockquote>“You created {summary.minutesTogether} {summary.minutesTogether === 1 ? 'minute' : 'minutes'} of music memories together.”</blockquote><button className="friend-sync__primary-button" type="button" onClick={() => setSummary(null)}>Back to your music <span>↗</span></button></article></div>}
      {createOpen && <CreateRoomDialog onClose={() => setCreateOpen(false)} onCreate={createRoom} />}
      {searchOpen && <TrackSearchDialog onClose={() => setSearchOpen(false)} onAdd={tab === 'votes' ? suggestSong : addSong} />}
      {storageError && !room && <p className="friend-sync__lobby-error" role="alert">{storageError}</p>}
      {toast && <div className="friend-sync__toast" role="status"><Icon name="spark" size={15} /> {toast}</div>}
    </main>
  );
}

export default FriendSync;
