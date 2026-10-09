import React, { useCallback, useEffect, useRef, useState } from 'react';
import { findTracks } from '../song-search.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import './VoicePlaylist.css';

const HISTORY_KEY = 'melodixa-voice-command-history';
const QUICK_COMMANDS = [
  ['♫', 'Play my favorites'],
  ['♡', 'Play something romantic'],
  ['☾', 'Play late-night songs'],
  ['▤', 'Play music for studying'],
  ['ϟ', 'Play energetic songs'],
  ['＋', 'Create a workout playlist'],
];

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(saved) ? saved.slice(0, 8) : [];
  } catch (error) {
    console.warn('Could not read voice command history:', error);
    return [];
  }
}

function getPlaylistName(command) {
  const namedMatch = command.match(/\bcreate\s+(?:a\s+)?playlist(?:\s+(?:called|named))?\s+(.+)$/i);
  const leadingMatch = command.match(/\bcreate\s+(?:a\s+)?(.+?)\s+playlist$/i);
  const match = namedMatch || leadingMatch;
  return match?.[1]?.replace(/^["']|["']$/g, '').trim() || '';
}

function getRequestQuery(command) {
  return command
    .replace(/^(please\s+)?(play|find|search for|put on)\s+/i, '')
    .replace(/\b(songs?|music)\s+by\s+/i, '')
    .replace(/\bfor me\b/gi, '')
    .trim();
}

function VoicePlaylist({ ui, musicPlayer, playlistStore }) {
  const [stage, setStage] = useState('idle');
  const [commandText, setCommandText] = useState('');
  const [typedCommand, setTypedCommand] = useState('');
  const [language, setLanguage] = useState('Any language');
  const [response, setResponse] = useState('Your next listening moment is one sentence away.');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [history, setHistory] = useState(readHistory);
  const [playlists, setPlaylists] = useState(() => playlistStore.getAllPlaylists());
  const [activePlaylistId, setActivePlaylistId] = useState(() => (
    playlistStore.getAllPlaylists().find((playlist) => !playlist.isLiked)?.id || ''
  ));
  const [currentTrack, setCurrentTrack] = useState(musicPlayer.currentTrack);
  const [isPlaying, setIsPlaying] = useState(musicPlayer.isPlaying);
  const [progress, setProgress] = useState(0);
  const recognitionRef = useRef(null);
  const meterRef = useRef({ stream: null, context: null, frame: 0 });
  const processingRef = useRef(false);

  const activePlaylist = playlists.find((playlist) => String(playlist.id) === String(activePlaylistId));
  const playlistTracks = activePlaylist?.tracks || [];

  const stopMeter = useCallback(() => {
    const meter = meterRef.current;
    if (meter.frame) window.cancelAnimationFrame(meter.frame);
    meter.stream?.getTracks().forEach((track) => track.stop());
    meter.context?.close().catch((closeError) => {
      console.warn('Could not close the voice visualizer audio context:', closeError);
    });
    meterRef.current = { stream: null, context: null, frame: 0 };
    setMicLevel(0);
  }, []);

  useEffect(() => {
    const updateTrack = (event) => {
      setCurrentTrack(event.detail?.track || musicPlayer.currentTrack);
      setProgress(0);
    };
    const updatePlayback = (event) => setIsPlaying(Boolean(event.detail?.isPlaying));
    const updateProgress = (event) => setProgress(event.detail?.progressPercent || 0);
    const updatePlaylists = (event) => {
      const nextPlaylists = event.detail?.playlists || playlistStore.getAllPlaylists();
      setPlaylists(nextPlaylists);
      setActivePlaylistId((selectedId) => (
        nextPlaylists.some((playlist) => String(playlist.id) === String(selectedId))
          ? selectedId
          : nextPlaylists.find((playlist) => !playlist.isLiked)?.id || ''
      ));
    };
    window.addEventListener('music-player-track-changed', updateTrack);
    window.addEventListener('music-player-playback-state-changed', updatePlayback);
    window.addEventListener('music-player-time-updated', updateProgress);
    window.addEventListener('playlists-updated', updatePlaylists);
    return () => {
      window.removeEventListener('music-player-track-changed', updateTrack);
      window.removeEventListener('music-player-playback-state-changed', updatePlayback);
      window.removeEventListener('music-player-time-updated', updateProgress);
      window.removeEventListener('playlists-updated', updatePlaylists);
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      stopMeter();
    };
  }, [musicPlayer, playlistStore, stopMeter]);

  const saveCommand = (text) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, text, createdAt: new Date().toISOString() };
    const nextHistory = [entry, ...history].slice(0, 8);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      setHistory(nextHistory);
    } catch (storageError) {
      console.warn('Could not save voice command history:', storageError);
      setError('This command worked, but browser storage prevented saving it to your recent history.');
      setHistory(nextHistory);
    }
  };

  const runCommand = async (rawCommand) => {
    if (processingRef.current) return;
    const text = rawCommand.trim();
    if (!text) {
      setError('Say or type a music request first.');
      return;
    }

    processingRef.current = true;
    setCommandText(text);
    setTypedCommand('');
    setError('');
    setStage('understanding');
    setResponse('Finding the right way to make that happen…');
    saveCommand(text);

    const normalized = text.toLowerCase().replace(/[.!?]+$/g, '').trim();
    try {
      if (/^(pause|pause the song|stop)(\s+music)?$/.test(normalized)) {
        if (musicPlayer.isPlaying) await musicPlayer.togglePlay();
        setResponse(musicPlayer.currentTrack ? `Paused ${musicPlayer.currentTrack.name}.` : 'There is no song playing right now.');
        setStage('playing');
        return;
      }
      if (/^(resume|continue|play|unpause)(\s+(the\s+)?(song|music))?$/.test(normalized)) {
        if (musicPlayer.currentTrack && !musicPlayer.isPlaying) await musicPlayer.togglePlay();
        setResponse(musicPlayer.currentTrack ? `Picking up ${musicPlayer.currentTrack.name} where you left off.` : 'Choose a song or tell me what you want to hear.');
        setStage('playing');
        return;
      }
      if (/^(next|skip|play the next song)(\s+song)?$/.test(normalized)) {
        musicPlayer.next();
        setResponse('Moving to the next song in your queue.');
        setStage('playing');
        return;
      }
      if (/^(previous|go back|play the previous song)(\s+song)?$/.test(normalized)) {
        musicPlayer.previous();
        setResponse('Going back to the previous song.');
        setStage('playing');
        return;
      }
      if (/^(play that song again|play it again|replay)(\s+song)?$/.test(normalized)) {
        if (!musicPlayer.currentTrack) throw new Error('There is no current song to replay yet.');
        await musicPlayer.playTrack(musicPlayer.currentTrack);
        setResponse(`Playing ${musicPlayer.currentTrack.name} again.`);
        setStage('playing');
        return;
      }

      const playlistName = getPlaylistName(text);
      if (playlistName) {
        const playlist = playlistStore.createPlaylist({ name: playlistName, description: 'Created with Ask Melodixa' });
        setActivePlaylistId(playlist.id);
        setResponse(`Playlist Created ✓ ${playlist.name} is ready. Try “Add a song” or “Play my ${playlist.name} playlist.”`);
        setStage('playing');
        return;
      }

      if (/^play\s+my\s+(favorites?|favourites?|liked songs)$/i.test(normalized)) {
        const liked = playlistStore.getPlaylistById('liked-songs');
        if (!liked?.tracks?.length) throw new Error('Your Liked Songs list is empty so far.');
        setActivePlaylistId(liked.id);
        await musicPlayer.playTrack(liked.tracks[0], liked.tracks);
        setResponse(musicPlayer.isPlaying ? 'Playing your favorite songs.' : 'I opened your Liked Songs. Spotify playback or a playable preview is needed to hear them here.');
        setStage('playing');
        return;
      }

      if (/^(remove|delete)\s+(this|the current|current)\s+song\b/i.test(text)) {
        if (!activePlaylist || !musicPlayer.currentTrack) throw new Error('Choose a playlist and play a song before removing it.');
        const currentTrackIsSaved = activePlaylist.tracks.some((track) => (
          (musicPlayer.currentTrack.id && track.id === musicPlayer.currentTrack.id)
          || (musicPlayer.currentTrack.uri && track.uri === musicPlayer.currentTrack.uri)
          || (track.name?.toLowerCase() === musicPlayer.currentTrack.name?.toLowerCase()
            && track.artist?.toLowerCase() === musicPlayer.currentTrack.artist?.toLowerCase())
        ));
        if (!currentTrackIsSaved) throw new Error(`${musicPlayer.currentTrack.name} is not in ${activePlaylist.name}.`);
        playlistStore.removeTrackFromPlaylist(activePlaylist.id, musicPlayer.currentTrack.id || musicPlayer.currentTrack.uri);
        setResponse(`Removed ${musicPlayer.currentTrack.name} from ${activePlaylist.name}.`);
        setStage('playing');
        return;
      }

      if (/^play\s+my\s+(.+?)\s+playlist$/i.test(text)) {
        const name = text.match(/^play\s+my\s+(.+?)\s+playlist$/i)?.[1]?.toLowerCase();
        const target = playlists.find((playlist) => playlist.name.toLowerCase() === name);
        if (!target?.tracks?.length) throw new Error(target ? `${target.name} does not have any songs yet.` : `I couldn't find a playlist named ${name}.`);
        setActivePlaylistId(target.id);
        await musicPlayer.playTrack(target.tracks[0], target.tracks);
        setResponse(musicPlayer.isPlaying ? `Now playing your ${target.name} playlist.` : `I opened ${target.name}. Spotify playback or a playable preview is needed to hear it here.`);
        setStage('playing');
        return;
      }

      if (/^add\s+my\s+(favorite|favourite)s?\s*(songs?)?$/i.test(text)) {
        if (!activePlaylist) throw new Error('Create a playlist or select a destination playlist first.');
        const liked = playlistStore.getPlaylistById('liked-songs')?.tracks || [];
        if (!liked.length) throw new Error('Your Liked Songs list is empty so far.');
        const added = liked.reduce((count, track) => count + Number(playlistStore.addTrackToPlaylist(activePlaylist.id, track)), 0);
        setResponse(added ? `Added ${added} favorite ${added === 1 ? 'song' : 'songs'} to ${activePlaylist.name}.` : `Your favorites are already in ${activePlaylist.name}.`);
        setStage('playing');
        return;
      }

      if (/^(add|save)\s+(this|the current)\s+song\b/i.test(text)) {
        if (!activePlaylist || !musicPlayer.currentTrack) throw new Error('Choose a destination playlist and start a song first.');
        const added = playlistStore.addTrackToPlaylist(activePlaylist.id, musicPlayer.currentTrack);
        setResponse(added ? `Added ${musicPlayer.currentTrack.name} to ${activePlaylist.name}.` : `${musicPlayer.currentTrack.name} is already in ${activePlaylist.name}.`);
        setStage('playing');
        return;
      }

      const addMatch = text.match(/^(?:add|save)\s+(.+)$/i);
      if (addMatch) {
        if (!activePlaylist) throw new Error('Create a playlist or select a destination playlist first.');
        const query = addMatch[1].replace(/\s+to\s+(?:my\s+)?playlist$/i, '').trim();
        const found = await findTracks(query, language);
        if (!found.length) throw new Error(`I couldn't find a song matching “${query}”.`);
        const added = playlistStore.addTrackToPlaylist(activePlaylist.id, found[0]);
        setResponse(added ? `Added ${found[0].name} to ${activePlaylist.name}.` : `${found[0].name} is already in ${activePlaylist.name}.`);
        setStage('playing');
        return;
      }

      const query = getRequestQuery(text);
      if (!query) throw new Error('Tell me a song, artist, mood, or moment to search for.');
      const found = await findTracks(query, language);
      if (!found.length) throw new Error(`I couldn't find music for “${query}”. Try another song, artist, or mood.`);
      await musicPlayer.playTrack(found[0], found);
      const isMoodRequest = /relax|calm|sad|emotional|romantic|study|focus|energetic|workout|late.?night|happy|peaceful/i.test(text);
      const mixName = /study|focus/i.test(text) ? 'Study & Chill'
        : /relax|calm|peaceful/i.test(text) ? 'Relaxing'
          : /sad|emotional/i.test(text) ? 'Emotional'
            : /romantic|love/i.test(text) ? 'Romantic'
              : /workout|energetic/i.test(text) ? 'Energy'
                : 'your music';
      setResponse(musicPlayer.isPlaying
        ? (isMoodRequest ? `Playing a ${mixName} mix picked for your moment.` : `Now playing ${found[0].name} by ${found[0].artist}.`)
        : `I found ${found[0].name} by ${found[0].artist} and sent it to your player. Spotify playback or a playable preview is needed to hear it here.`);
      setStage('playing');
    } catch (commandError) {
      setError(commandError.message || 'That request could not be completed.');
      setResponse('Let’s try another way.');
      setStage('playing');
      ui?.showToast?.(commandError.message || 'That request could not be completed.', 'warning');
    } finally {
      processingRef.current = false;
    }
  };

  const startMeter = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      setError('Live waveform levels are unavailable here, but speech recognition can still listen.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      let lastUpdate = 0;
      meterRef.current.stream = stream;
      meterRef.current.context = context;
      const sample = (time) => {
        analyser.getByteTimeDomainData(samples);
        const amplitude = samples.reduce((sum, value) => sum + Math.abs(value - 128), 0) / samples.length;
        if (time - lastUpdate >= 70) {
          setMicLevel(Math.min(1, amplitude / 28));
          lastUpdate = time;
        }
        meterRef.current.frame = window.requestAnimationFrame(sample);
      };
      sample();
    } catch (meterError) {
      console.warn('Could not start the live voice waveform:', meterError);
      setError('Microphone levels could not be shown. Speech recognition may still work if microphone access is allowed.');
    }
  };

  const cancelListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopMeter();
    setIsListening(false);
    setStage('idle');
    setError('');
  };

  const startListening = async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Speech recognition is not supported in this browser. Type a request below to use Ask Melodixa.');
      return;
    }
    setError('');
    setCommandText('');
    setStage('listening');
    setIsListening(true);
    setResponse('I’m listening…');

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript || '';
      setCommandText(transcript);
      if (result?.isFinal) {
        setIsListening(false);
        setStage('understanding');
        recognitionRef.current = null;
        stopMeter();
        void runCommand(transcript);
      }
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone access was blocked. Allow microphone access in your browser settings and try again.',
        'no-speech': 'I didn’t hear anything. Tap the microphone and try again.',
        'audio-capture': 'No microphone was available. Connect a microphone or type a request instead.',
        network: 'Speech recognition needs a network connection in this browser.',
      };
      setError(messages[event.error] || `Speech recognition stopped (${event.error}). You can try again or type a command.`);
      setIsListening(false);
      setStage('idle');
      recognitionRef.current = null;
      stopMeter();
    };
    recognition.onend = () => {
      setIsListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      stopMeter();
    };
    try {
      recognition.start();
      void startMeter();
    } catch (startError) {
      recognitionRef.current = null;
      setIsListening(false);
      setStage('idle');
      setError(startError.message || 'The microphone could not be started.');
    }
  };

  const runSuggestion = (suggestion) => {
    void runCommand(suggestion);
  };

  return (
    <main className={`voice-playlist ${isListening ? 'is-listening' : ''}`}>
      <header className="voice-playlist__topbar">
        <a className="voice-playlist__brand" href="#" onClick={(event) => event.preventDefault()} aria-label="Melodixa home">
          <span className="voice-playlist__brand-mark">m</span>
          <span>melodixa<span className="voice-playlist__brand-dot">.</span></span>
        </a>
        <span className="voice-playlist__tagline">YOU SPEAK. WE LISTEN.</span>
        <span className="voice-playlist__privacy"><span /> Your voice stays yours</span>
      </header>

      <section className="voice-playlist__hero">
        <div className="voice-playlist__hero-copy">
          <span className="voice-playlist__eyebrow">YOUR PERSONAL MUSIC ASSISTANT</span>
          <h1>Ask Melodixa <span>✳</span></h1>
          <p>Tell me what you want to listen to.</p>
          <div className="voice-playlist__promise">
            <span>01 <b>Speak</b></span><i />
            <span>02 <b>Understand</b></span><i />
            <span>03 <b>Play</b></span>
          </div>
        </div>

        <div className="voice-playlist__mic-area">
          <div className="voice-playlist__orb" style={{ '--mic-level': micLevel }}>
            <span className="voice-playlist__orbit voice-playlist__orbit--one" />
            <span className="voice-playlist__orbit voice-playlist__orbit--two" />
            <span className="voice-playlist__orbit voice-playlist__orbit--three" />
            <button className="voice-playlist__mic-button" type="button" onClick={isListening ? cancelListening : startListening} aria-label={isListening ? 'Cancel listening' : 'Tap to speak'}>
              {isListening ? <span className="voice-playlist__stop" /> : <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="11" y="4" width="10" height="17" rx="5" /><path d="M7.5 15.5v1a8.5 8.5 0 0 0 17 0v-1M16 25v4m-5 0h10" /></svg>}
            </button>
            {isListening && <div className="voice-playlist__wave" aria-hidden="true">{Array.from({ length: 15 }, (_, index) => <i key={index} style={{ '--bar': index, '--mic-level': micLevel }} />)}</div>}
          </div>
          <strong className="voice-playlist__mic-status">{isListening ? 'Listening…' : stage === 'understanding' ? 'Understanding…' : 'Tap to speak'}</strong>
          <span className="voice-playlist__mic-prompt">{isListening ? 'I’m listening for your next music moment' : 'Say a song, mood, artist, or playlist'}</span>
          {isListening && <button className="voice-playlist__cancel" type="button" onClick={cancelListening}>Cancel</button>}
          <form className="voice-playlist__typed" onSubmit={(event) => { event.preventDefault(); void runCommand(typedCommand); }}>
            <input aria-label="Type a voice command" value={typedCommand} onChange={(event) => setTypedCommand(event.target.value)} placeholder="Or type what you’d say…" maxLength={160} />
            <button type="submit" disabled={!typedCommand.trim()}>Go <span aria-hidden="true">↗</span></button>
          </form>
          <MusicLanguageSelect value={language} onChange={setLanguage} />
          {error && <p className="voice-playlist__error" role="alert">{error}</p>}
        </div>

        <aside className="voice-playlist__stage-card">
          <div className={`voice-playlist__stage-row ${stage === 'listening' ? 'is-active' : ''}`}><span>🎙</span><div><b>Speak</b><small>{stage === 'listening' ? 'Listening to you…' : 'Say what’s on your mind'}</small></div><i>{stage !== 'idle' ? '✓' : '01'}</i></div>
          <div className="voice-playlist__stage-row voice-playlist__stage-row--understand"><span>✳</span><div><b>Understand</b><small>{stage === 'understanding' ? 'Finding your music…' : 'A song, feeling, or moment'}</small></div><i>{stage === 'playing' ? '✓' : '02'}</i></div>
          <div className={`voice-playlist__stage-row ${stage === 'playing' ? 'is-active' : ''}`}><span>♫</span><div><b>Play</b><small>{stage === 'playing' ? 'Ready for your moment' : 'Your music, right on cue'}</small></div><i>{stage === 'playing' ? '✓' : '03'}</i></div>
          <div className="voice-playlist__stage-note">“You speak. Melodixa listens. Your music plays.”</div>
        </aside>
      </section>

      <section className="voice-playlist__main-grid">
        <section className="voice-playlist__panel voice-playlist__session">
          <div className="voice-playlist__section-head"><div><span className="voice-playlist__eyebrow">RIGHT HERE, RIGHT NOW</span><h2>Your voice session</h2></div><span className="voice-playlist__live"><i /> LIVE</span></div>
          <div className="voice-playlist__transcript"><span className="voice-playlist__transcript-icon">◉</span><div><small>YOU SAID</small><p>{commandText || 'Your next request will appear here…'}</p></div></div>
          <div className="voice-playlist__response"><span className="voice-playlist__response-icon">♫</span><div><small>MELODIXA SAYS</small><p>{response}</p></div></div>
          <div className="voice-playlist__now-playing">
            {currentTrack ? <img src={currentTrack.image || currentTrack.albumArt || ''} alt="" /> : <div className="voice-playlist__art-placeholder">♫</div>}
            <div className="voice-playlist__track-info"><small>{isPlaying ? 'NOW PLAYING' : 'READY WHEN YOU ARE'}</small><b>{currentTrack?.name || 'A song for your moment'}</b><span>{currentTrack?.artist || 'Ask for a song, artist, or mood'}</span><div className="voice-playlist__progress"><i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div></div>
            <div className="voice-playlist__player-controls">
              <button type="button" aria-label="Previous song" onClick={() => musicPlayer.previous()}>|‹</button>
              <button type="button" className="voice-playlist__play-button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => void musicPlayer.togglePlay()}>{isPlaying ? 'Ⅱ' : '▶'}</button>
              <button type="button" aria-label="Next song" onClick={() => musicPlayer.next()}>›|</button>
            </div>
          </div>
        </section>

        <section className="voice-playlist__panel voice-playlist__playlist">
          <div className="voice-playlist__section-head"><div><span className="voice-playlist__eyebrow">MADE BY YOU, OUT LOUD</span><h2>Create with voice</h2></div><span className="voice-playlist__head-icon">♫</span></div>
          <label className="voice-playlist__select-label" htmlFor="voice-playlist-target">Add songs to</label>
          <select id="voice-playlist-target" value={activePlaylistId} onChange={(event) => setActivePlaylistId(event.target.value)}>
            <option value="">Choose a playlist…</option>
            {playlists.filter((playlist) => !playlist.isLiked).map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
          </select>
          {activePlaylist ? <>
            <div className="voice-playlist__playlist-name"><span className="voice-playlist__playlist-cover">{playlistTracks[0]?.image ? <img src={playlistTracks[0].image} alt="" /> : '♫'}</span><div><b>{activePlaylist.name}</b><small>{playlistTracks.length} {playlistTracks.length === 1 ? 'song' : 'songs'} · Voice playlist</small></div><span className="voice-playlist__created-badge">YOUR MIX</span></div>
            <div className="voice-playlist__playlist-tracks">
              {playlistTracks.slice(0, 3).map((track, index) => <div className="voice-playlist__mini-track" key={track.id || `${track.name}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{track.name}</b><small>{track.artist}</small><button type="button" aria-label={`Remove ${track.name} from ${activePlaylist.name}`} onClick={() => playlistStore.removeTrackFromPlaylist(activePlaylist.id, track.id || track.uri)}>×</button></div>)}
              {!playlistTracks.length && <p className="voice-playlist__empty-list">Say “Add a song” to start filling this playlist.</p>}
              {playlistTracks.length > 3 && <small className="voice-playlist__more-tracks">+ {playlistTracks.length - 3} more in your playlist</small>}
            </div>
          </> : <div className="voice-playlist__choose-playlist"><span>＋</span><p>Create a playlist by saying<br /><b>“Create a playlist called…”</b></p></div>}
          <div className="voice-playlist__voice-examples"><span>TRY SAYING</span><p>“Create a playlist called College Memories”</p><p>“Add this song to my playlist”</p></div>
        </section>
      </section>

      <section className="voice-playlist__bottom-grid">
        <section className="voice-playlist__suggestions">
          <div className="voice-playlist__section-head"><div><span className="voice-playlist__eyebrow">NEED A LITTLE INSPIRATION?</span><h2>Try saying…</h2></div></div>
          <div className="voice-playlist__suggestion-grid">
            {QUICK_COMMANDS.map(([icon, label]) => <button className="voice-playlist__suggestion" type="button" key={label} onClick={() => runSuggestion(label)}><span>{icon}</span><b>{label}</b><i>↗</i></button>)}
          </div>
        </section>
        <section className="voice-playlist__history">
          <div className="voice-playlist__section-head"><div><span className="voice-playlist__eyebrow">LITTLE MOMENTS, REMEMBERED</span><h2>Recent commands</h2></div><span className="voice-playlist__history-count">{history.length} / 8</span></div>
          {history.length ? <div className="voice-playlist__history-list">{history.slice(0, 4).map((entry) => <div className="voice-playlist__history-item" key={entry.id}><span>🎙</span><b>{entry.text}</b><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}</div> : <p className="voice-playlist__history-empty">Your requests will find a home here.</p>}
        </section>
      </section>
      <footer className="voice-playlist__footer"><span>ASK MELODIXA <i>✳</i></span><span>VOICE-LED. ALWAYS YOURS.</span><span>Made for the way you feel.</span></footer>
    </main>
  );
}

export default VoicePlaylist;
