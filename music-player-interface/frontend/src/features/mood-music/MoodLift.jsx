import React, { useEffect, useRef, useState } from 'react';
import { findTracks } from '../song-search.js';
import { getJournalEntries } from '../music-journal/journal-store.js';
import { getPlaceholderSvg } from '../../utils.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import './MoodLift.css';

const MOODS = [
  { id: 'sad', label: 'Sad', icon: '😔', tint: '#9aa9df', words: 'sad, blue, down, lonely, low' },
  { id: 'stressed', label: 'Stressed', icon: '😰', tint: '#80c8c0', words: 'stressed, tense, anxious, pressure, overwhelmed' },
  { id: 'tired', label: 'Tired', icon: '😴', tint: '#a8a1d0', words: 'tired, drained, exhausted, sleepy' },
  { id: 'bored', label: 'Bored', icon: '😐', tint: '#d9bd83', words: 'bored, restless, stuck, flat' },
  { id: 'angry', label: 'Angry', icon: '😡', tint: '#e59382', words: 'angry, frustrated, irritated, mad' },
  { id: 'heartbroken', label: 'Heartbroken', icon: '💔', tint: '#dc91b7', words: 'heartbroken, breakup, loss, missing someone' },
  { id: 'happy', label: 'Happy', icon: '😊', tint: '#e8c879', words: 'happy, good, excited, cheerful' },
  { id: 'romantic', label: 'Romantic', icon: '❤️', tint: '#e893b2', words: 'romantic, love, loved, close' },
  { id: 'peaceful', label: 'Peaceful', icon: '🌿', tint: '#9eca9f', words: 'peaceful, calm, relaxed, settled' },
];

const PROGRESSIONS = {
  sad: [
    ['Comforting songs', '🤍', 'Comforting and familiar, with room for the feeling you brought.'],
    ['A little hope', '🌤️', 'A softer, warmer sound to gently open the next chapter.'],
    ['Brighter moments', '😊', 'A little more lift, while keeping the melodies close.'],
    ['Uplifting songs', '☀️', 'An inviting finish with a brighter, more buoyant feel.'],
  ],
  heartbroken: [
    ['Here with you', '🤍', 'Tender songs that make space for a complicated moment.'],
    ['Gentle hope', '🌤️', 'Warm melodies that lean softly toward tomorrow.'],
    ['Finding your feet', '😊', 'Steadier rhythms for taking the next small step.'],
    ['A brighter horizon', '☀️', 'A hopeful close chosen to meet you where you are.'],
  ],
  stressed: [
    ['Ease into the moment', '🌿', 'A quieter beginning with a little breathing room.'],
    ['Find a steadier rhythm', '🤍', 'Gentle grooves to make the sound feel less crowded.'],
    ['Lighten the edges', '🌤️', 'Warm and reassuring songs, one at a time.'],
    ['A little lift', '☀️', 'A brighter finish without rushing the moment.'],
  ],
  tired: [
    ['Soft landing', '🌙', 'Gentle, unhurried songs to meet a low-energy moment.'],
    ['Warmth & ease', '🤍', 'Familiar sounds with a little more color.'],
    ['Slowly waking up', '🌤️', 'A touch more movement, at an easy pace.'],
    ['A brighter note', '☀️', 'A hopeful close that stays easy on the ears.'],
  ],
  angry: [
    ['Let it breathe', '🌊', 'Grounded songs with space for all that energy.'],
    ['Steady the pulse', '🤍', 'A more even rhythm to help the moment feel less sharp.'],
    ['Shift the color', '🌤️', 'Warmer sounds, moving gently toward something lighter.'],
    ['Turn toward light', '☀️', 'An uplifting finish, without asking you to rush.'],
  ],
  bored: [
    ['A fresh start', '✨', 'An interesting sound to break the usual pattern.'],
    ['Curious corners', '🌤️', 'New textures and melodies to follow for a while.'],
    ['More color', '😊', 'A livelier turn to bring some movement into the mix.'],
    ['Bright discoveries', '☀️', 'A cheerful finish with a little more sparkle.'],
  ],
  happy: [
    ['Keep the glow', '😊', 'Warm favorites to meet the good feeling you already have.'],
    ['Open it up', '🌤️', 'A brighter sound to give the moment a little more room.'],
    ['Good energy', '✨', 'A buoyant rhythm to keep your day moving.'],
    ['All sunshine', '☀️', 'A joyful finish that stays with the feeling you chose.'],
  ],
  romantic: [
    ['Close & gentle', '❤️', 'Soft, intimate melodies to stay with the mood you chose.'],
    ['Warm the room', '🌹', 'A little more glow, while keeping things tender.'],
    ['A lovely lift', '🌤️', 'Bright harmonies that let the feeling open out.'],
    ['Golden hour', '☀️', 'A warm, uplifting finish with a little extra sparkle.'],
  ],
  peaceful: [
    ['Quiet beginnings', '🌿', 'Unhurried sounds that settle naturally into your moment.'],
    ['Gentle warmth', '🤍', 'Soft melodies with a little more light around the edges.'],
    ['Easy brightness', '🌤️', 'A hopeful lift that keeps the calm intact.'],
    ['A peaceful glow', '☀️', 'A bright, easy finish—still at your own pace.'],
  ],
};

function getTrackKey(track) {
  return track.uri || track.id || `${track.name || ''}-${track.artist || ''}`.toLowerCase();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function explainTrack(track, stage, mood, artistHistory, favoriteKeys) {
  const artist = (track.artist || '').toLowerCase();
  const familiar = favoriteKeys.has(getTrackKey(track))
    || Object.keys(artistHistory).some((name) => artist.includes(name) && artistHistory[name] > 1);
  return familiar && stage < 2
    ? 'A familiar voice, chosen from artists and songs you already enjoy.'
    : PROGRESSIONS[mood][stage][2];
}

export default function MoodLift({ musicPlayer, playlistStore, ui }) {
  const [step, setStep] = useState('checkin');
  const [selectedMood, setSelectedMood] = useState('');
  const [language, setLanguage] = useState('Any language');
  const [description, setDescription] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [songs, setSongs] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(musicPlayer.currentTrack);
  const [isPlaying, setIsPlaying] = useState(musicPlayer.isPlaying);
  const [playbackMode, setPlaybackMode] = useState(musicPlayer.playbackMode);
  const [progress, setProgress] = useState(0);
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [adaptation, setAdaptation] = useState('');
  const [adaptationUsed, setAdaptationUsed] = useState(false);
  const [moodResult, setMoodResult] = useState('A little brighter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedPlaylist, setSavedPlaylist] = useState(false);
  const [savedToPlaylist, setSavedToPlaylist] = useState('');
  const [destinationId, setDestinationId] = useState(() => (
    playlistStore.getAllPlaylists().find((playlist) => !playlist.isLiked)?.id || ''
  ));
  const [showPlaylistPicker, setShowPlaylistPicker] = useState('');
  const startedAtRef = useRef(null);
  const elapsedRef = useRef(0);
  const checkInShownRef = useRef(false);
  const stepTimerRef = useRef(null);

  const mood = MOODS.find((item) => item.id === selectedMood);
  const progression = PROGRESSIONS[selectedMood] || PROGRESSIONS.sad;
  const uniqueArtists = {};
  getJournalEntries().forEach((entry) => {
    const name = entry.track?.artist?.toLowerCase();
    if (name) uniqueArtists[name] = (uniqueArtists[name] || 0) + 1;
  });
  const likedTracks = playlistStore.getPlaylistById('liked-songs')?.tracks || [];
  const likedTrackKeys = new Set(likedTracks.map(getTrackKey));
  const playlists = playlistStore.getAllPlaylists().filter((playlist) => !playlist.isLiked);

  const finishSession = () => {
    if (startedAtRef.current) {
      elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
      startedAtRef.current = null;
      setElapsed(elapsedRef.current);
    }
    setStep('complete');
    if (musicPlayer.isPlaying) {
      musicPlayer.togglePlay().catch((pauseError) => {
        console.warn('Could not pause playback after MoodLift ended:', pauseError);
        setError('MoodLift finished, but playback could not be paused automatically.');
      });
    }
  };

  useEffect(() => {
    const onTrack = (event) => {
      const nextTrack = event.detail?.track || musicPlayer.currentTrack;
      const nextMode = event.detail?.playbackMode || musicPlayer.playbackMode;
      setCurrentTrack(nextTrack);
      setPlaybackMode(nextMode);
      setProgress(0);
      if (step === 'playing' && nextTrack && ['preview', 'sdk'].includes(nextMode)) {
        setSongsPlayed((count) => count + 1);
        if (!checkInShownRef.current && songsPlayed + 1 >= 4) {
          checkInShownRef.current = true;
          setAdaptation('checkin');
        }
      }
    };
    const onPlayback = (event) => {
      const nextPlaying = Boolean(event.detail?.isPlaying);
      const mode = event.detail?.playbackMode || musicPlayer.playbackMode;
      setIsPlaying(nextPlaying);
      setPlaybackMode(mode);
      if (step !== 'playing') return;
      if (nextPlaying && !startedAtRef.current) startedAtRef.current = Date.now();
      if (!nextPlaying && startedAtRef.current) {
        elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
        startedAtRef.current = null;
        setElapsed(elapsedRef.current);
      }
    };
    const onTime = (event) => setProgress(event.detail?.progressPercent || 0);
    const onQueueFinished = () => {
      if (step === 'playing') finishSession();
    };
    window.addEventListener('music-player-track-changed', onTrack);
    window.addEventListener('music-player-playback-state-changed', onPlayback);
    window.addEventListener('music-player-time-updated', onTime);
    window.addEventListener('music-player-queue-finished', onQueueFinished);
    return () => {
      window.removeEventListener('music-player-track-changed', onTrack);
      window.removeEventListener('music-player-playback-state-changed', onPlayback);
      window.removeEventListener('music-player-time-updated', onTime);
      window.removeEventListener('music-player-queue-finished', onQueueFinished);
    };
  }, [musicPlayer, step, songsPlayed]);

  useEffect(() => () => window.clearTimeout(stepTimerRef.current), []);

  const continueToUnderstanding = () => {
    if (!selectedMood) {
      setError('Choose the mood that feels closest to right now.');
      return;
    }
    setError('');
    setStep('understanding');
    stepTimerRef.current = window.setTimeout(() => setUnderstood(true), 1000);
  };

  const createMoodLift = async (adaptationChoice = '') => {
    const adaptingSession = Boolean(adaptationChoice);
    if (!mood) return;
    setLoading(true);
    setError('');
    if (!adaptingSession) {
      setNotice('');
      setAdaptation('');
    }
    try {
      const terms = {
        sad: ['comforting emotional familiar songs', 'hopeful warm acoustic songs', 'positive gentle pop songs', 'uplifting feel good pop songs'],
        heartbroken: ['comforting emotional songs', 'hopeful healing acoustic songs', 'positive warm pop songs', 'uplifting joyful songs'],
        stressed: ['calm soothing instrumental songs', 'gentle steady mellow songs', 'warm positive acoustic pop songs', 'uplifting feel good songs'],
        tired: ['soft mellow relaxed songs', 'warm gentle acoustic songs', 'hopeful easy pop songs', 'bright uplifting songs'],
        angry: ['grounding steady mellow songs', 'calm reflective acoustic songs', 'warm hopeful songs', 'uplifting positive songs'],
        bored: ['fresh interesting mellow songs', 'curious new indie songs', 'bright energetic pop songs', 'upbeat joyful songs'],
        happy: ['warm joyful favorite songs', 'hopeful bright acoustic songs', 'happy upbeat pop songs', 'uplifting feel good songs'],
        romantic: ['romantic gentle acoustic songs', 'warm love songs', 'hopeful bright romantic pop songs', 'uplifting joyful love songs'],
        peaceful: ['peaceful soft instrumental songs', 'gentle warm acoustic songs', 'hopeful mellow pop songs', 'bright uplifting relaxed songs'],
      }[selectedMood];
      const searchTerms = terms.map((term, index) => (
        [
          adaptationChoice === 'same'
            ? `${term} calm hopeful`
            : adaptationChoice === 'better'
              ? `${term} positive bright`
              : adaptationChoice === 'much-better'
                ? `${term} joyful upbeat energetic`
                : term,
          description.trim(),
        ].filter(Boolean).join(' ')
      ));
      const results = await Promise.all(searchTerms.map((term) => findTracks(term, language)));
      const library = playlistStore.getAllPlaylists().flatMap((playlist) => playlist.tracks || []);
      const libraryByKey = new Map(library.map((track) => [getTrackKey(track), track]));
      const used = new Set();
      let rankedStages = results.map((stageResults, index) => {
        const stagePool = [...stageResults];
        if (index < 2) {
          for (const liked of likedTracks) {
            if (!stagePool.some((candidate) => getTrackKey(candidate) === getTrackKey(liked))) stagePool.unshift(liked);
          }
        }
        return stagePool
          .map((candidate) => libraryByKey.get(getTrackKey(candidate)) || candidate)
          .sort((first, second) => {
            const favoriteDifference = Number(likedTrackKeys.has(getTrackKey(second))) - Number(likedTrackKeys.has(getTrackKey(first)));
            if (favoriteDifference) return favoriteDifference;
            const artistScore = (item) => Object.entries(uniqueArtists).reduce((score, [artist, count]) => (
              (item.artist || '').toLowerCase().includes(artist) ? score + count : score
            ), 0);
            return artistScore(second) - artistScore(first);
          })
          .filter((candidate) => {
            const key = getTrackKey(candidate);
            if (!key || used.has(key)) return false;
            used.add(key);
            return true;
          })
          .slice(0, 5)
          .map((candidate) => ({
            ...candidate,
            moodLiftStage: index,
            moodLiftReason: explainTrack(candidate, index, selectedMood, uniqueArtists, likedTrackKeys),
            moodLiftDuration: candidate.duration_ms || 0,
          }));
      });
      let recommendations = rankedStages.flat();
      if (recommendations.length < 4) {
        for (let stageIndex = 0; stageIndex < rankedStages.length && recommendations.length < 4; stageIndex += 1) {
          const extras = (results[stageIndex] || []).filter((candidate) => !used.has(getTrackKey(candidate)));
          for (const candidate of extras) {
            if (recommendations.length >= 4) break;
            used.add(getTrackKey(candidate));
            recommendations.push({
              ...candidate,
              moodLiftStage: stageIndex,
              moodLiftReason: explainTrack(candidate, stageIndex, selectedMood, uniqueArtists, likedTrackKeys),
              moodLiftDuration: candidate.duration_ms || 0,
            });
          }
        }
      }
      if (recommendations.length < 2) {
        const fallback = library.filter((candidate) => !used.has(getTrackKey(candidate)));
        recommendations = [...recommendations, ...fallback.slice(0, 4 - recommendations.length).map((candidate) => ({
          ...candidate,
          moodLiftStage: Math.min(3, recommendations.length),
          moodLiftReason: 'A familiar pick from your library, included to keep the music close to your taste.',
          moodLiftDuration: candidate.duration_ms || 0,
        }))];
      }
      if (!recommendations.length) throw new Error('We could not find songs for MoodLift just now. Check your connection and try again.');
      const representedStages = new Set(recommendations.map((song) => song.moodLiftStage));
      if (recommendations.length >= 4 && representedStages.size < 4) {
        recommendations = recommendations.map((song, index) => {
          const stageIndex = Math.min(3, Math.floor(index * 4 / recommendations.length));
          return {
            ...song,
            moodLiftStage: stageIndex,
            moodLiftReason: explainTrack(song, stageIndex, selectedMood, uniqueArtists, likedTrackKeys),
          };
        });
      }
      if (adaptingSession) {
        const upcoming = recommendations.filter((song) => !currentTrack || getTrackKey(song) !== getTrackKey(currentTrack));
        const nextSongs = currentTrack ? [currentTrack, ...upcoming] : recommendations;
        setSongs(nextSongs);
        musicPlayer.setQueue(nextSongs);
        setAdaptationUsed(true);
        setNotice('Your upcoming songs have been adjusted. The current song can finish first.');
      } else {
        setSongs(recommendations);
        setSongsPlayed(0);
        elapsedRef.current = 0;
        setElapsed(0);
        setSavedPlaylist(false);
        setSavedToPlaylist('');
        setAdaptationUsed(false);
        setMoodResult('A little brighter');
        setStep('playing');
        await musicPlayer.playTrack(recommendations[0], recommendations);
        if (['preview', 'sdk'].includes(musicPlayer.playbackMode) && musicPlayer.isPlaying) {
          startedAtRef.current = Date.now();
          setSongsPlayed(1);
          setNotice('MoodLift is playing. Let the music do the rest.');
        } else {
          startedAtRef.current = null;
          setNotice('Your MoodLift is ready. Full playback needs a playable preview or Spotify Premium.');
        }
      }
    } catch (generationError) {
      setError(generationError.message || 'MoodLift could not prepare recommendations.');
      if (!adaptingSession) setStep('understood');
    } finally {
      setLoading(false);
    }
  };

  const adaptMoodLift = async (choice) => {
    if (choice === 'still-same') {
      setNotice('Let’s try a softer, more reassuring direction.');
    } else if (choice === 'little-better' || choice === 'better') {
      setNotice('We’ll keep the lift gentle and carry the brighter feeling forward.');
    } else {
      setNotice('A brighter, more energetic set is on its way.');
    }
    const resultLabels = {
      'still-same': 'Still the same',
      'little-better': 'A little better',
      better: 'Feeling better',
      'much-better': 'Much better',
    };
    setMoodResult(resultLabels[choice]);
    setAdaptationUsed(true);
    setAdaptation('');
    const choiceForQueries = choice === 'still-same' ? 'same' : choice === 'little-better' ? 'better' : 'much-better';
    await createMoodLift(choiceForQueries);
  };

  const toggleLike = (song) => {
    const liked = playlistStore.toggleLikedTrack(song);
    setNotice(liked ? `Added ${song.name} to Liked Songs.` : `Removed ${song.name} from Liked Songs.`);
  };

  const addSongToPlaylist = (song, playlistId) => {
    if (!playlistId) return;
    const playlist = playlistStore.getPlaylistById(playlistId);
    if (!playlist) {
      setError('That playlist could not be found.');
      return;
    }
    const added = playlistStore.addTrackToPlaylist(playlistId, song);
    setSavedToPlaylist(added ? `${song.name} added to ${playlist.name}.` : `${song.name} is already in ${playlist.name}.`);
    setShowPlaylistPicker('');
  };

  const saveFullPlaylist = () => {
    if (!songs.length || savedPlaylist) return;
    try {
      const playlist = playlistStore.createPlaylist({
        name: `${mood?.label || 'Mood'} MoodLift`,
        description: `A personalized MoodLift mix for a ${mood?.label?.toLowerCase() || 'current'} moment.`,
        coverArt: songs[0].image,
      });
      songs.forEach((song) => playlistStore.addTrackToPlaylist(playlist.id, song));
      setSavedPlaylist(true);
      setSavedToPlaylist(`Saved ${songs.length} songs to ${playlist.name}.`);
    } catch (saveError) {
      setError(saveError.message || 'The playlist could not be saved.');
    }
  };

  const replayMoodLift = () => {
    setStep('playing');
    setSongsPlayed(0);
    setAdaptation('');
    setAdaptationUsed(false);
    setMoodResult('A little brighter');
    elapsedRef.current = 0;
    setElapsed(0);
    checkInShownRef.current = false;
    musicPlayer.playTrack(songs[0], songs).then(() => {
      if (['preview', 'sdk'].includes(musicPlayer.playbackMode) && musicPlayer.isPlaying) {
        startedAtRef.current = Date.now();
        setSongsPlayed(1);
      }
    }).catch((playError) => {
      setError(playError.message || 'MoodLift could not be replayed.');
    });
  };

  const done = () => {
    if (musicPlayer.isPlaying) {
      musicPlayer.togglePlay().catch((pauseError) => {
        console.warn('Could not pause after leaving MoodLift:', pauseError);
      });
    }
    startedAtRef.current = null;
    window.dispatchEvent(new CustomEvent('melodixa-close-feature'));
    ui?.switchView?.('home');
  };

  return (
    <main className={`moodlift moodlift--${step}`} style={{ '--lift-accent': mood?.tint || '#e7c87e' }}>
      <header className="moodlift__topbar">
        <div className="moodlift__brand"><span>m</span> melodixa<span>.</span></div>
        <div className="moodlift__brand-note">MUSIC FOR THE MOMENT YOU’RE IN</div>
        <div className="moodlift__privacy"><i /> MADE AROUND YOUR MOOD</div>
      </header>

      {step === 'checkin' && <section className="moodlift__checkin">
        <div className="moodlift__hero">
          <div className="moodlift__hero-copy">
            <span className="moodlift__eyebrow">A MOMENT WITH MELODIXA</span>
            <h1>How are you feeling<br />right now<span>?</span></h1>
            <p>Tell Melodixa your mood. We’ll find the music for you.</p>
            <div className="moodlift__hero-foot"><span>✦</span> No perfect words needed. Choose what feels closest.</div>
          </div>
          <div className="moodlift__hero-art" aria-hidden="true"><div className="moodlift__sun"><i /><b>♫</b></div><span>♪</span><em>✦</em></div>
        </div>

        <div className="moodlift__checkin-content">
          <div className="moodlift__section-heading"><span>YOUR CHECK-IN</span><small>Pick one that feels nearest</small></div>
          <div className="moodlift__mood-grid">
            {MOODS.map((item) => <button key={item.id} type="button" className={`moodlift__mood-card ${selectedMood === item.id ? 'is-selected' : ''}`} style={{ '--mood-tint': item.tint }} aria-pressed={selectedMood === item.id} onClick={() => { setSelectedMood(item.id); setError(''); }}>
              <span className="moodlift__mood-emoji">{item.icon}</span><b>{item.label}</b><i>{selectedMood === item.id ? '✓' : '＋'}</i>
            </button>)}
          </div>
          <label className="moodlift__description">
            <span>Describe your mood <small>OPTIONAL</small></span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={240} placeholder="Tell us a little more about how you're feeling..." />
          </label>
          <MusicLanguageSelect value={language} onChange={setLanguage} />
          {error && <p className="moodlift__error" role="alert">{error}</p>}
          <div className="moodlift__checkin-actions">
            <span>Your mood check-in stays yours.</span>
            <button type="button" className="moodlift__primary" onClick={continueToUnderstanding}>Continue <i>→</i></button>
          </div>
        </div>
      </section>}

      {step === 'understanding' && <section className="moodlift__understanding">
        {!understood ? <div className="moodlift__thinking"><div className="moodlift__thinking-orb"><span>{mood?.icon}</span><i /><b /></div><span className="moodlift__eyebrow">ONE MOMENT</span><h1>Understanding your mood<span>…</span></h1><p>Taking in the feeling you shared.</p></div>
          : <div className="moodlift__understood-card">
            <span className="moodlift__eyebrow">WE’RE WITH YOU</span>
            <h1>Current mood</h1>
            <div className="moodlift__selected-mood" style={{ '--mood-tint': mood?.tint }}><span>{mood?.icon}</span><b>{mood?.label}</b></div>
            <div className="moodlift__intensity"><span>Mood intensity</span><b>72%</b><i><em /></i><small>A gentle reflection of your check-in—not a clinical measure.</small></div>
            <p>We understand how you’re feeling. Let Melodixa choose some music to gently lift your mood.</p>
            {description && <blockquote>“{description}”</blockquote>}
            {error && <p className="moodlift__error" role="alert">{error}</p>}
            <button type="button" className="moodlift__primary" disabled={loading} onClick={() => void createMoodLift()}>{loading ? 'Creating your MoodLift…' : 'Create My MoodLift'} <i>{loading ? '· · ·' : '→'}</i></button>
          </div>}
      </section>}

      {step === 'playing' && <section className="moodlift__experience">
        <div className="moodlift__experience-heading">
          <span className="moodlift__eyebrow">A SOUNDTRACK, CHOSEN FOR THIS MOMENT</span>
          <h1>Your MoodLift Playlist <span>☀</span></h1>
          <p>These songs are arranged to move gently toward a brighter listening mood.</p>
          <div className="moodlift__mood-path"><span>{mood?.icon} {mood?.label}</span><i>→</i><b>☀ More lift, at your pace</b></div>
        </div>
        <div className="moodlift__playing-banner"><div className="moodlift__playing-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div><b>{isPlaying ? '☀ MoodLift is playing' : '☀ Your MoodLift is ready'}</b><span>{isPlaying ? 'Let the music do the rest.' : playbackMode === 'unavailable' ? 'Full playback needs Spotify Premium or an available song preview.' : 'Press play whenever you’re ready.'}</span></div><span className="moodlift__elapsed">{formatTime(elapsed)} listened</span></div>
        {notice && <p className="moodlift__notice" role="status">{notice}</p>}
        {error && <p className="moodlift__error" role="alert">{error}</p>}
        <div className="moodlift__player-layout">
          <div className="moodlift__tracks">
            {progression.map(([stageName, icon, fallbackReason], stageIndex) => {
              const stageSongs = songs.filter((song) => song.moodLiftStage === stageIndex);
              if (!stageSongs.length) return null;
              return <section className="moodlift__stage" key={stageName}>
                <div className="moodlift__stage-heading"><span>{icon}</span><div><h2>{stageName}</h2><small>{stageSongs.length} {stageSongs.length === 1 ? 'song' : 'songs'}</small></div><i /></div>
                <div className="moodlift__song-list">{stageSongs.map((song) => {
                  const current = currentTrack && getTrackKey(currentTrack) === getTrackKey(song);
                  const liked = playlistStore.isTrackLiked(song);
                  const playlist = playlistStore.getPlaylistById(destinationId);
                  return <article className={`moodlift__song ${current ? 'is-current' : ''}`} key={getTrackKey(song)}>
                    <button className="moodlift__song-cover" type="button" aria-label={`Play ${song.name}`} onClick={() => musicPlayer.playTrack(song, songs)}>
                      <img src={song.image || song.albumArt || getPlaceholderSvg(song.name)} alt="" /><span>{current && isPlaying ? 'Ⅱ' : '▶'}</span>
                    </button>
                    <div className="moodlift__song-info"><b>{song.name}</b><small>{song.artist || 'Unknown artist'}{song.duration_ms ? ` · ${formatTime(Math.floor(song.duration_ms / 1000))}` : ''}</small><p>{song.moodLiftReason || fallbackReason}</p></div>
                    {current && isPlaying && <span className="moodlift__now-playing-tag">NOW</span>}
                    <button type="button" className={`moodlift__song-action ${liked ? 'is-liked' : ''}`} aria-label={liked ? `Unlike ${song.name}` : `Like ${song.name}`} onClick={() => toggleLike(song)}>{liked ? '♥' : '♡'}</button>
                    <div className="moodlift__add-wrap"><button type="button" className="moodlift__song-action" aria-label={`Add ${song.name} to playlist`} onClick={() => setShowPlaylistPicker(showPlaylistPicker === getTrackKey(song) ? '' : getTrackKey(song))}>＋</button>
                      {showPlaylistPicker === getTrackKey(song) && <div className="moodlift__playlist-popover"><label htmlFor={`moodlift-playlist-${song.id || stageIndex}`}>Add to a playlist</label><select id={`moodlift-playlist-${song.id || stageIndex}`} value={destinationId} onChange={(event) => { setDestinationId(event.target.value); addSongToPlaylist(song, event.target.value); }}><option value="">Choose playlist…</option>{playlists.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{!playlists.length && <small>Create a playlist in Your Library first.</small>}</div>}
                    </div>
                    {current && <div className="moodlift__song-progress"><i style={{ width: `${progress}%` }} /></div>}
                  </article>;
                })}</div>
              </section>;
            })}
          </div>
          <aside className="moodlift__now-card">
            <span className="moodlift__eyebrow">LET THE MUSIC DO THE REST</span>
            <div className="moodlift__album-art">{currentTrack?.image ? <img src={currentTrack.image} alt="" /> : <span>♫</span>}<i /></div>
            <small className="moodlift__now-label">{isPlaying ? '☀ MOODLIFT IS PLAYING' : 'YOUR MOODLIFT'}</small>
            <h2>{currentTrack?.name || 'Your music is ready'}</h2><p>{currentTrack?.artist || 'A mix chosen for this moment'}</p>
            <div className="moodlift__progress"><i style={{ width: `${progress}%` }} /></div>
            <div className="moodlift__play-controls">
              <button type="button" aria-label="Previous song" onClick={() => musicPlayer.previous()}>|‹</button>
              <button type="button" className="moodlift__play-button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => void musicPlayer.togglePlay()}>{isPlaying ? 'Ⅱ' : '▶'}</button>
              <button type="button" aria-label="Next song" onClick={() => musicPlayer.next()}>›|</button>
            </div>
            <div className="moodlift__play-options"><button type="button" aria-pressed={musicPlayer.isShuffle} onClick={() => musicPlayer.toggleShuffle()}>⤨ Shuffle</button><button type="button" onClick={() => musicPlayer.cycleRepeatMode()}>⟳ Repeat</button><button type="button" aria-label={currentTrack && playlistStore.isTrackLiked(currentTrack) ? 'Unlike current track' : 'Like current track'} onClick={() => currentTrack && toggleLike(currentTrack)}>{currentTrack && playlistStore.isTrackLiked(currentTrack) ? '♥' : '♡'} Like</button></div>
            <div className="moodlift__save-playlist">
              {playlists.length > 0 && <label htmlFor="moodlift-destination">Add song to</label>}
              {playlists.length > 0 && <select id="moodlift-destination" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
              <p>{savedToPlaylist}</p>
              {step === 'playing' && <button type="button" className="moodlift__save-button" disabled={savedPlaylist} onClick={saveFullPlaylist}>{savedPlaylist ? '✓ Playlist saved' : '▤ Save MoodLift Playlist'}</button>}
            </div>
          </aside>
        </div>
        {adaptation === 'checkin' && <div className="moodlift__adaptation"><div><span className="moodlift__eyebrow">A QUICK, OPTIONAL CHECK-IN</span><h2>How are you feeling now?</h2></div><div className="moodlift__adaptation-options">
          <button type="button" disabled={loading} onClick={() => void adaptMoodLift('still-same')}>😔 <span>Still the same</span></button>
          <button type="button" disabled={loading} onClick={() => void adaptMoodLift('little-better')}>😐 <span>A little better</span></button>
          <button type="button" disabled={loading} onClick={() => void adaptMoodLift('better')}>🙂 <span>Feeling better</span></button>
          <button type="button" disabled={loading} onClick={() => void adaptMoodLift('much-better')}>😊 <span>Much better</span></button>
          <button type="button" className="moodlift__skip-checkin" onClick={() => setAdaptation('')}>Not now</button>
        </div></div>}
        {step === 'playing' && songsPlayed >= 7 && <button className="moodlift__finish-link" type="button" onClick={finishSession}>Finish MoodLift and see your recap →</button>}
      </section>}

      {step === 'complete' && <section className="moodlift__complete">
        <div className="moodlift__complete-sun">☀</div>
        <span className="moodlift__eyebrow">A MOMENT, HELD IN MUSIC</span>
        <h1>Your MoodLift is Complete <span>✦</span></h1>
        <p className="moodlift__complete-message">We hope the music made your moment a little brighter.</p>
        <div className="moodlift__recap">
          <div><small>STARTED</small><b>{mood?.icon} {mood?.label}</b></div>
          <span>→</span>          <div><small>NOW</small><b>{adaptationUsed ? moodResult : '☀ A little brighter'}</b></div>
          <div><small>SONGS PLAYED</small><b>{songsPlayed}</b></div>
          <div><small>LISTENING TIME</small><b>{formatTime(elapsed)}</b></div>
        </div>
        {savedToPlaylist && <p className="moodlift__notice">{savedToPlaylist}</p>}
        {error && <p className="moodlift__error" role="alert">{error}</p>}
        <div className="moodlift__complete-actions">
          <button type="button" className="moodlift__primary" onClick={replayMoodLift}>↻ Replay MoodLift</button>
          <button type="button" className="moodlift__secondary" disabled={savedPlaylist} onClick={saveFullPlaylist}>{savedPlaylist ? '✓ Playlist saved' : '▤ Save Playlist'}</button>
          <button type="button" className="moodlift__done" onClick={done}>Done</button>
        </div>
        <small className="moodlift__complete-note">A personal music experience, not a promise of treatment.</small>
      </section>}

      <footer className="moodlift__footer"><span>“Tell us how you feel. Let Melodixa choose what you need to hear.”</span><span>MELODIXA <i>✦</i></span></footer>
    </main>
  );
}
