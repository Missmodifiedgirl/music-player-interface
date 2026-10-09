import React, { useEffect, useMemo, useState } from 'react';
import { backendApi } from '../../backend-api.js';
import { getValidAccessToken } from '../../spotify-auth.js';
import { getPlaceholderSvg } from '../../utils.js';
import {
  getCurrentMood,
  setCurrentMood,
} from '../music-journal/journal-store.js';
import './EmotionJourney.css';

const MOODS = [
  { name: 'Sad', emoji: '😢', color: '#8ba8f2' },
  { name: 'Lonely', emoji: '😔', color: '#a29ce8' },
  { name: 'Stressed', emoji: '😰', color: '#85b7c9' },
  { name: 'Calm', emoji: '😌', color: '#72c8b3' },
  { name: 'Romantic', emoji: '❤️', color: '#ef88a5' },
  { name: 'Happy', emoji: '😊', color: '#f4c95d' },
  { name: 'Energetic', emoji: '🔥', color: '#f28c63' },
  { name: 'Relaxed', emoji: '😴', color: '#ae91e8' },
  { name: 'Hopeful', emoji: '🌟', color: '#f0a55f' },
  { name: 'Motivated', emoji: '💪', color: '#e7a94d' },
];

const CATEGORY_NAMES = ['Best Match', 'Popular Picks', 'All Tracks'];
const ACTIVE_KEY = 'melodixa-emotional-journey-active';
const SAVED_KEY = 'melodixa-emotional-journeys';
const PAGE_SIZE = 10;

function safeRead(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    console.warn(`Could not read Emotional Journey data (${key}):`, error);
    return fallback;
  }
}

function saveActiveJourney(journey) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(journey));
  } catch (error) {
    console.error('Could not save Emotional Journey progress:', error);
  }
}

function moodDetails(name) {
  return MOODS.find((mood) => mood.name === name) || MOODS[0];
}

function transitionPrompt(fromMood, toMood) {
  const pair = `${fromMood}->${toMood}`;
  const prompts = {
    'Sad->Calm': 'gentle ambient soft acoustic songs for easing from sadness into calm',
    'Calm->Hopeful': 'uplifting gentle songs that feel peaceful and hopeful',
    'Hopeful->Happy': 'bright positive feel good songs moving from hope to happiness',
    'Happy->Energetic': 'high energy upbeat dance songs to build on a happy mood',
    'Stressed->Calm': 'soothing ambient relaxation music for unwinding',
    'Lonely->Romantic': 'warm intimate romantic songs about connection',
    'Relaxed->Motivated': 'steady uplifting songs that gently build motivation',
  };
  return prompts[pair] || `songs blending ${fromMood.toLowerCase()} and ${toMood.toLowerCase()} moods`;
}

function trackIdentity(track) {
  return `${track.name || ''}::${track.artist || ''}`.trim().toLowerCase();
}

function createStage(mood) {
  return { mood, explored: 0, playedTracks: [], listenedSeconds: 0, selectedTracks: [], favoriteTrack: null };
}

function createJourney(mood) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
    startedAt: new Date().toISOString(),
    status: 'active',
    stages: [createStage(mood)],
  };
}

function dedupeTracks(tracks) {
  const byIdentity = new Map();
  tracks.forEach((track) => {
    if (!track?.name) return;
    const key = trackIdentity(track);
    const old = byIdentity.get(key);
    byIdentity.set(key, old ? { ...old, ...track, image: track.image || old.image } : track);
  });
  return [...byIdentity.values()];
}

function toLocalPlaylistTrack(track) {
  return {
    ...track,
    image: track.image || getPlaceholderSvg(track.name),
  };
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (seconds > 0 && minutes === 0) return '<1m';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function EmotionJourney({ musicPlayer, ui, playlistStore }) {
  const [currentMood, setMood] = useState(getCurrentMood);
  const [activeJourney, setActiveJourney] = useState(() => safeRead(ACTIVE_KEY, null));
  const [viewingStageIndex, setViewingStageIndex] = useState(null);
  const [savedJourneys, setSavedJourneys] = useState(() => safeRead(SAVED_KEY, []));
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(CATEGORY_NAMES[0]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [currentTrack, setCurrentTrack] = useState(musicPlayer?.currentTrack || null);
  const [isPlaying, setIsPlaying] = useState(Boolean(musicPlayer?.isPlaying));
  const [journeyName, setJourneyName] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState('');

  const currentStageIndex = viewingStageIndex ?? Math.max(0, (activeJourney?.stages?.length || 1) - 1);
  const currentStage = activeJourney?.stages?.[currentStageIndex];
  const selectedMood = currentStage?.mood || currentMood;
  const selectedMoodInfo = selectedMood ? moodDetails(selectedMood) : null;
  const stageCatalog = selectedMood ? catalog[selectedMood] : null;
  const sections = stageCatalog?.sections || {};
  const activeSongs = sections[category] || [];
  const visibleSongs = activeSongs.slice(0, visibleCount);
  const availableCount = stageCatalog?.tracks?.length || 0;

  const allPlaylists = playlistStore?.getAllPlaylists?.() || [];
  const userPlaylists = allPlaylists.filter((playlist) => playlist.id !== 'liked-songs');

  const favoritesForStage = useMemo(() => {
    if (!currentStage) return [];
    const liked = playlistStore?.getPlaylistById?.('liked-songs')?.tracks || [];
    const likedIds = new Set(liked.map(trackIdentity));
    return currentStage.playedTracks.filter((track) => likedIds.has(trackIdentity(track)));
  }, [currentStage, playlistStore]);

  const updateJourney = (transform) => {
    setActiveJourney((previous) => {
      if (!previous) return previous;
      const next = transform(previous);
      saveActiveJourney(next);
      return next;
    });
  };

  const loadMood = async (moodName, targetStageIndex = viewingStageIndex) => {
    const mood = moodDetails(moodName);
    console.info('[EmotionalJourney] Selected mood:', mood.name);
    setMood(mood.name);
    if (currentMood !== mood.name) setCurrentMood(mood.name, musicPlayer?.currentTrack);
    setCategory(CATEGORY_NAMES[0]);
    setVisibleCount(PAGE_SIZE);
    setError('');
    setLoading(true);

    try {
      const accessToken = await getValidAccessToken();
      const response = await backendApi.getEmotionalJourney(mood.name.toLowerCase(), accessToken);
      if (!Array.isArray(response.tracks) || !response.sources) {
        throw new Error('Django returned an incomplete mood recommendation response.');
      }
      const tracks = dedupeTracks(response.tracks);
      const popular = [...tracks].sort((a, b) =>
        (b.popularity || b.listeners || b.playcount || 0) - (a.popularity || a.listeners || a.playcount || 0));
      const sectionsForMood = {
        'Best Match': tracks,
        'Popular Picks': popular,
        'All Tracks': tracks,
      };
      const sourceIssues = Object.entries(response.sources).filter(([, source]) => source.error);
      console.info('[EmotionalJourney] Recommendation results', {
        mood: mood.name,
        spotify: response.sources.spotify,
        lastfm: response.sources.lastfm,
        filteredMoodMatchedTrackCount: tracks.length,
        finalUniqueTrackCount: response.count,
      });

      setCatalog((previous) => ({
        ...previous,
        [mood.name]: { tracks, sections: sectionsForMood },
      }));
      updateJourney((previous) => {
        if (!previous) return createJourney(mood.name);
        const stages = [...previous.stages];
        let targetIndex = targetStageIndex ?? stages.length - 1;
        if (targetStageIndex === null && stages[targetIndex]?.mood !== mood.name) {
          stages.push(createStage(mood.name));
          targetIndex = stages.length - 1;
        }
        if (stages[targetIndex]) stages[targetIndex] = { ...stages[targetIndex], explored: tracks.length };
        return { ...previous, stages, status: 'active' };
      });
      if (tracks.length && sourceIssues.length) {
        setError(`Showing ${tracks.length} available track${tracks.length === 1 ? '' : 's'}. ${sourceIssues.map(([name, source]) => `${name === 'lastfm' ? 'Last.fm' : 'Spotify'}: ${source.error}`).join(' ')}`);
      } else if (!tracks.length && sourceIssues.length) {
        setError(sourceIssues.map(([name, source]) => `${name === 'lastfm' ? 'Last.fm' : 'Spotify'}: ${source.error}`).join(' '));
      } else if (!tracks.length) {
        setError(`No matching tracks found for ${mood.name}.`);
      } else {
        setError('');
      }
    } catch (loadError) {
      console.error('Could not load Emotional Journey recommendations:', loadError);
      setError(loadError.message || 'Could not load recommendations from the Django backend.');
    } finally {
      setLoading(false);
    }
  };

  const startJourney = (mood) => {
    const journey = createJourney(mood);
    setActiveJourney(journey);
    setViewingStageIndex(null);
    saveActiveJourney(journey);
    setShowSummary(false);
    loadMood(mood, 0);
  };

  const chooseNextMood = (mood) => {
    if (!activeJourney) {
      startJourney(mood);
      return;
    }
    if (currentStage?.mood === mood) {
      loadMood(mood, currentStageIndex);
      return;
    }
    const nextStageIndex = activeJourney.stages.length;
    updateJourney((previous) => ({
      ...previous,
      status: 'active',
      stages: [...previous.stages, createStage(mood)],
    }));
    setViewingStageIndex(null);
    loadMood(mood, nextStageIndex);
  };

  useEffect(() => {
    const refresh = () => setCurrentTrack(musicPlayer?.currentTrack || null);
    const trackChanged = (event) => {
      const track = event.detail?.track || musicPlayer?.currentTrack;
      setCurrentTrack(track);
      setIsPlaying(Boolean(musicPlayer?.isPlaying));
      if (track && activeJourney) {
        const identity = trackIdentity(track);
        updateJourney((previous) => ({
          ...previous,
          stages: previous.stages.map((stage, index) => {
            if (index !== (viewingStageIndex ?? previous.stages.length - 1)) return stage;
            const playedTracks = stage.playedTracks || [];
            return playedTracks.some((played) => trackIdentity(played) === identity)
              ? stage
              : { ...stage, playedTracks: [...playedTracks, track] };
          }),
        }));
      }
    };
    const playbackChanged = (event) => {
      setIsPlaying(Boolean(event.detail?.isPlaying));
      refresh();
    };
    window.addEventListener('music-player-track-changed', trackChanged);
    window.addEventListener('music-player-playback-state-changed', playbackChanged);
    window.addEventListener('music-journal-updated', refresh);
    return () => {
      window.removeEventListener('music-player-track-changed', trackChanged);
      window.removeEventListener('music-player-playback-state-changed', playbackChanged);
      window.removeEventListener('music-journal-updated', refresh);
    };
  }, [musicPlayer, activeJourney, viewingStageIndex]);

  useEffect(() => {
    if (!activeJourney || !isPlaying) return undefined;
    const interval = window.setInterval(() => {
      setActiveJourney((previous) => {
        if (!previous || previous.status !== 'active') return previous;
        const next = {
          ...previous,
          stages: previous.stages.map((stage, index) => index === (viewingStageIndex ?? previous.stages.length - 1)
            ? { ...stage, listenedSeconds: (stage.listenedSeconds || 0) + 15 }
            : stage),
        };
        saveActiveJourney(next);
        return next;
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [activeJourney?.id, activeJourney?.status, currentStageIndex, isPlaying]);

  useEffect(() => {
    if (activeJourney && currentStage?.mood && !catalog[currentStage.mood] && !loading) loadMood(currentStage.mood, currentStageIndex);
  }, []);

  const playTrack = async (track, queue = activeSongs) => {
    try {
      await musicPlayer?.playTrack?.(track, queue);
      setCurrentTrack(track);
      setIsPlaying(true);
      updateJourney((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, index) => index === currentStageIndex
          ? {
            ...stage,
            playedTracks: stage.playedTracks.some((played) => trackIdentity(played) === trackIdentity(track))
              ? stage.playedTracks
              : [...stage.playedTracks, track],
          }
          : stage),
      }));
    } catch (playError) {
      console.error('Could not play Emotional Journey track:', playError);
      ui?.showToast?.('Could not play this track right now.', 'error');
    }
  };

  const toggleFavorite = (track) => {
    try {
      if (!playlistStore?.toggleLikedTrack) throw new Error('Favorites are not available.');
      playlistStore.toggleLikedTrack(toLocalPlaylistTrack(track));
      ui?.showToast?.('Favorite updated.', 'success');
    } catch (favoriteError) {
      console.error('Could not update Emotional Journey favorite:', favoriteError);
      ui?.showToast?.('Could not update favorites.', 'error');
    }
  };

  const addToPlaylist = (track, playlistId) => {
    if (!playlistId) return;
    try {
      if (!playlistStore?.addTrackToPlaylist) throw new Error('Playlists are not available.');
      playlistStore.addTrackToPlaylist(playlistId, toLocalPlaylistTrack(track));
      setPlaylistTarget('');
      ui?.showToast?.('Added to playlist.', 'success');
    } catch (playlistError) {
      console.error('Could not add Emotional Journey track to playlist:', playlistError);
      ui?.showToast?.('Could not add this track to the playlist.', 'error');
    }
  };

  const toggleJourneyTrack = (track) => {
    const identity = trackIdentity(track);
    updateJourney((previous) => ({
      ...previous,
      stages: previous.stages.map((stage, index) => {
        if (index !== (viewingStageIndex ?? previous.stages.length - 1)) return stage;
        const selectedTracks = stage.selectedTracks || [];
        const exists = selectedTracks.some((selected) => trackIdentity(selected) === identity);
        return { ...stage, selectedTracks: exists
          ? selectedTracks.filter((selected) => trackIdentity(selected) !== identity)
          : [...selectedTracks, track] };
      }),
    }));
  };

  const setStageFavorite = (track) => {
    updateJourney((previous) => ({
      ...previous,
      stages: previous.stages.map((stage, index) => index === (viewingStageIndex ?? previous.stages.length - 1) ? { ...stage, favoriteTrack: track } : stage),
    }));
  };

  const createJourneyPlaylist = () => {
    const tracks = (activeJourney?.stages || []).flatMap((stage) => stage.selectedTracks || []);
    if (!tracks.length) {
      ui?.showToast?.('Add songs to your journey before creating its playlist.', 'warning');
      return;
    }
    setPlaylistBusy(true);
    try {
      if (!playlistStore?.createPlaylist || !playlistStore?.addTrackToPlaylist) {
        throw new Error('Playlist creation is not available.');
      }
      const playlist = playlistStore.createPlaylist({
        name: journeyName.trim() || 'My Emotional Journey',
        description: (activeJourney?.stages || []).map((stage) => stage.mood).join(' → '),
        coverArt: tracks[0]?.image,
      });
      tracks.forEach((track) => playlistStore.addTrackToPlaylist(playlist.id, toLocalPlaylistTrack(track)));
      ui?.showToast?.(`Created "${playlist.name}" with ${tracks.length} journey songs.`, 'success');
    } catch (playlistError) {
      console.error('Could not create Emotional Journey playlist:', playlistError);
      ui?.showToast?.('Could not create the journey playlist.', 'error');
    } finally {
      setPlaylistBusy(false);
    }
  };

  const finishJourney = () => {
    updateJourney((previous) => ({ ...previous, status: 'completed', completedAt: new Date().toISOString() }));
    setShowSummary(true);
  };

  const saveJourney = () => {
    if (!activeJourney) return;
    const stages = activeJourney.stages || [];
    const record = {
      ...activeJourney,
      name: journeyName.trim() || `${new Date().toLocaleDateString(undefined, { weekday: 'long' })} Journey`,
      savedAt: new Date().toISOString(),
    };
    const next = [record, ...savedJourneys].slice(0, 30);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSavedJourneys(next);
      ui?.showToast?.(`Saved ${stages.map((stage) => stage.mood).join(' → ')} to My Journeys.`, 'success');
    } catch (saveError) {
      console.error('Could not save Emotional Journey:', saveError);
      ui?.showToast?.('Could not save this journey.', 'error');
    }
  };

  const loadSavedJourney = (journey) => {
    setActiveJourney({ ...journey, status: 'active' });
    setViewingStageIndex(null);
    setMood(journey.stages?.at(-1)?.mood || '');
    setShowSummary(false);
    const mood = journey.stages?.at(-1)?.mood;
    if (mood) loadMood(mood, (journey.stages || []).length - 1);
  };

  const resetJourney = () => {
    setActiveJourney(null);
    setViewingStageIndex(null);
    setMood('');
    setShowSummary(false);
    setCategory(CATEGORY_NAMES[0]);
    setVisibleCount(PAGE_SIZE);
    localStorage.removeItem(ACTIVE_KEY);
  };

  const selectedTrackIds = new Set((currentStage?.selectedTracks || []).map(trackIdentity));
  const timeline = activeJourney?.stages || [];
  const summaryPlayed = timeline.reduce((count, stage) => count + (stage.playedTracks?.length || 0), 0);
  const summaryExplored = timeline.reduce((count, stage) => count + (stage.explored || 0), 0);
  const summaryDuration = timeline.reduce((count, stage) => count + (stage.listenedSeconds || 0), 0);
  const transitionFromMood = currentStageIndex > 0 ? timeline[currentStageIndex - 1]?.mood : null;
  const nextStageMood = timeline[currentStageIndex + 1]?.mood;
  const transitionText = transitionFromMood && selectedMood
    ? transitionPrompt(transitionFromMood, selectedMood)
    : '';
  const profileClass = selectedMoodInfo ? `emotion-journey emotion-journey--${selectedMoodInfo.name.toLowerCase()}` : 'emotion-journey emotion-journey--welcome';

  return (
    <main className={profileClass} style={selectedMoodInfo ? { '--journey-mood': selectedMoodInfo.color } : undefined}>
      <header className="emotion-journey__hero">
        <div className="emotion-journey__hero-copy">
          <span className="emotion-journey__eyebrow">MELODIXA · A PERSONAL SOUNDTRACK THROUGH FEELING</span>
          <h1>Emotional Journey</h1>
          <p>Start where you are. Choose where the music takes you next.</p>
          {currentTrack && <div className="emotion-journey__now-playing"><img src={currentTrack.image || getPlaceholderSvg(currentTrack.name)} alt="" /><span><small>{isPlaying ? 'NOW PLAYING' : 'PAUSED'}</small><strong>{currentTrack.name}</strong><em>{currentTrack.artist}</em></span><button type="button" aria-label="Previous song" onClick={() => musicPlayer?.previous?.()}>|◀</button><button type="button" aria-label={isPlaying ? 'Pause playback' : 'Resume playback'} onClick={() => musicPlayer?.togglePlay?.()}>{isPlaying ? 'Ⅱ' : '▶'}</button><button type="button" aria-label="Next song" onClick={() => musicPlayer?.next?.()}>▶|</button></div>}
        </div>
        {selectedMoodInfo && <div className="emotion-journey__mood-orb" aria-hidden="true"><span>{selectedMoodInfo.emoji}</span></div>}
      </header>

      <section className="emotion-journey__mood-picker">
        <div className="emotion-journey__section-title"><div><span>YOUR JOURNEY STARTS HERE</span><h2>🎭 How are you feeling right now?</h2></div>{currentMood && <span className="emotion-journey__current-pill">Current mood · {moodDetails(currentMood).emoji} {currentMood}</span>}</div>
        <div className="emotion-journey__moods">
          {MOODS.map((mood) => <button className={`emotion-journey__mood ${selectedMood === mood.name ? 'is-selected' : ''}`} type="button" key={mood.name} aria-pressed={selectedMood === mood.name} style={{ '--mood-color': mood.color }} onClick={() => activeJourney ? chooseNextMood(mood.name) : startJourney(mood.name)}><span>{mood.emoji}</span><strong>{mood.name}</strong></button>)}
        </div>
      </section>

      {!activeJourney && <section className="emotion-journey__welcome">
        <span>✦</span><h2>Choose a feeling to begin</h2><p>Explore music for this moment, then choose any next stage that feels right to you.</p>
        {!!savedJourneys.length && <div className="emotion-journey__saved-list"><h3>Continue a previous journey</h3>{savedJourneys.slice(0, 4).map((journey) => <button type="button" key={journey.id} onClick={() => loadSavedJourney(journey)}><strong>{journey.name}</strong><span>{journey.stages.map((stage) => `${moodDetails(stage.mood).emoji} ${stage.mood}`).join(' → ')}</span></button>)}</div>}
      </section>}

      {!!activeJourney && <>
        <section className="emotion-journey__journey-card">
          <div className="emotion-journey__section-title"><div><span>YOUR PERSONAL MUSIC PATH</span><h2>Your Emotional Journey</h2></div><button className="emotion-journey__text-button" type="button" onClick={resetJourney}>Restart journey</button></div>
          <div className="emotion-journey__timeline">
            {timeline.map((stage, index) => {
              const details = moodDetails(stage.mood);
              const isCurrent = index === currentStageIndex;
              return <React.Fragment key={`${stage.mood}-${index}`}><button type="button" className={`emotion-journey__stage ${isCurrent ? 'is-current' : ''}`} style={{ '--mood-color': details.color }} onClick={() => { setViewingStageIndex(index); setMood(stage.mood); loadMood(stage.mood, index); }}><span>{details.emoji}</span><strong>{stage.mood}</strong><small>{stage.explored || 0} explored · {stage.playedTracks?.length || 0} played</small><small>{formatDuration(stage.listenedSeconds || 0)} listened</small>{stage.favoriteTrack && <small>♥ {stage.favoriteTrack.name}</small>}</button>{index < timeline.length - 1 && <span className="emotion-journey__timeline-arrow">→</span>}</React.Fragment>;
            })}
          </div>
          {selectedMoodInfo && <p className="emotion-journey__stage-message"><strong>{selectedMoodInfo.emoji} Current Stage: {selectedMoodInfo.name}</strong> · Previous Stage: {transitionFromMood || 'Starting stage'} · Next Stage: {nextStageMood || 'Choose below'} · Journey progress: Stage {currentStageIndex + 1} of {timeline.length}</p>}
        </section>

        <section className="emotion-journey__collection">
          {transitionFromMood && <div className="emotion-journey__transition"><span>MOOD TRANSITION</span><strong>{moodDetails(transitionFromMood).emoji} {transitionFromMood} <i>→</i> {selectedMoodInfo?.emoji} {selectedMoodInfo?.name}</strong><p>{transitionText}. This stage has its own fresh API-based recommendations.</p></div>}
          <header className="emotion-journey__collection-header"><div><span>MOOD-MATCHED MUSIC</span><h2>Your current mood: {selectedMoodInfo?.name}</h2><p>Recommended music for this mood · {loading ? 'Finding recommendations from Spotify and Last.fm…' : `${availableCount} unique API tracks${availableCount < 50 ? ' · showing the available selection without padding' : ' · explore in small sections'}`}</p></div><span className="emotion-journey__collection-mood">{selectedMoodInfo?.emoji}</span></header>
          {!!error && <div className="emotion-journey__notice" role="alert"><span>{error}</span><button type="button" onClick={() => loadMood(selectedMood)}>Retry</button></div>}
          {loading && !stageCatalog && <div className="emotion-journey__loading"><span className="emotion-journey__loader" />Gathering songs that fit this feeling…</div>}
          {!loading && !availableCount && <div className="emotion-journey__empty-results"><span>♫</span><strong>{error ? 'No recommendations are currently available.' : 'No matching tracks found for this mood.'}</strong><small>Check the source details above, then retry or choose another mood.</small><button type="button" onClick={() => loadMood(selectedMood)}>Retry recommendations</button></div>}
          {!!availableCount && <>
            <nav className="emotion-journey__categories" aria-label="Recommendation sections">{CATEGORY_NAMES.map((name) => <button className={category === name ? 'is-active' : ''} type="button" key={name} onClick={() => { setCategory(name); setVisibleCount(PAGE_SIZE); }}>{name}<small>{sections[name]?.length || 0}</small></button>)}</nav>
            <div className="emotion-journey__songs">
              {visibleSongs.map((track, index) => {
                const liked = Boolean(playlistStore?.isTrackLiked?.(track));
                const inJourney = selectedTrackIds.has(trackIdentity(track));
                const sourceLabel = (track.sources || [track.source]).filter(Boolean).map((source) => source === 'lastfm' ? 'Last.fm' : 'Spotify').join(' + ');
                return <article className="emotion-journey__song" key={trackIdentity(track)}><span className="emotion-journey__song-rank">{String(index + 1).padStart(2, '0')}</span><img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" /><div className="emotion-journey__song-info"><strong>{track.name}</strong><small>{track.artist}</small><span>{track.album || sourceLabel} · {(track.matched_tags || []).join(', ') || 'API search relevance'}</span><em className="emotion-journey__match-score">Mood match · {track.mood_match_score}%</em></div><button className="emotion-journey__play" type="button" aria-label={`Play ${track.name}`} onClick={() => playTrack(track, activeSongs)}>▶</button><button className={`emotion-journey__icon-action ${liked ? 'is-favorite' : ''}`} type="button" aria-label={liked ? `Remove ${track.name} from favorites` : `Add ${track.name} to favorites`} onClick={() => toggleFavorite(track)}>{liked ? '♥' : '♡'}</button><label className="emotion-journey__playlist-action"><span>＋ Playlist</span><select aria-label={`Add ${track.name} to playlist`} value="" onChange={(event) => addToPlaylist(track, event.target.value)}><option value="">Choose</option>{userPlaylists.map((playlist) => <option value={playlist.id} key={playlist.id}>{playlist.name}</option>)}</select></label><button className={`emotion-journey__add-journey ${inJourney ? 'is-added' : ''}`} type="button" onClick={() => toggleJourneyTrack(track)}>{inJourney ? 'Added ✓' : 'Add to journey'}</button><button className="emotion-journey__favorite-stage" type="button" aria-label={`Mark ${track.name} as stage favorite`} onClick={() => setStageFavorite(track)}>{currentStage?.favoriteTrack && trackIdentity(currentStage.favoriteTrack) === trackIdentity(track) ? '★' : '☆'}</button></article>;
              })}
            </div>
            {visibleCount < activeSongs.length && <div className="emotion-journey__load-more"><span>Showing {visibleCount} of {activeSongs.length}</span><button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load 10 more</button></div>}
            {activeSongs.length > 0 && <p className="emotion-journey__disclaimer">Recommendations are fetched from Spotify and Last.fm for each stage. The mood-match indicator uses API search rank, available tags, and popularity; counts reflect unique API tracks.</p>}
          </>}
        </section>

        <section className="emotion-journey__next">
          <div><span>YOU SET THE DIRECTION</span><h2>Where do you want your music journey to go?</h2><p>No prescribed path — choose any mood that feels right next.</p></div>
          <div className="emotion-journey__next-moods">{MOODS.filter((mood) => mood.name !== selectedMood).map((mood) => <button type="button" key={mood.name} style={{ '--mood-color': mood.color }} onClick={() => chooseNextMood(mood.name)}><span>{mood.emoji}</span>{mood.name}</button>)}</div>
        </section>

        <section className="emotion-journey__tools">
          <div className="emotion-journey__journey-actions"><div><span>BUILD YOUR SOUNDTRACK</span><h2>Keep the songs that define each stage</h2><p>{timeline.reduce((count, stage) => count + (stage.selectedTracks?.length || 0), 0)} songs added across your journey</p></div><input aria-label="Journey playlist name" value={journeyName} onChange={(event) => setJourneyName(event.target.value)} placeholder="My Emotional Journey" /><button type="button" disabled={playlistBusy} onClick={createJourneyPlaylist}>{playlistBusy ? 'Creating…' : '🎵 Create My Journey Playlist'}</button><button type="button" onClick={finishJourney}>Complete Journey</button></div>
          <div className="emotion-journey__stats"><article><strong>{summaryExplored}</strong><span>Songs explored</span></article><article><strong>{summaryPlayed}</strong><span>Songs played</span></article><article><strong>{formatDuration(summaryDuration)}</strong><span>Journey listening time</span></article><article><strong>{favoritesForStage.length}</strong><span>Current-stage favorites</span></article></div>
        </section>

        {showSummary && <section className="emotion-journey__summary"><span>✦</span><div><small>MELODIXA · JOURNEY COMPLETE</small><h2>Your journey, your pace.</h2><p>{timeline.map((stage) => `${moodDetails(stage.mood).emoji} ${stage.mood}`).join(' → ')}</p><strong>{summaryExplored} songs explored · {summaryPlayed} songs played · {formatDuration(summaryDuration)} listening time</strong><div className="emotion-journey__summary-favorites"><h3>Your Journey Favorites</h3>{timeline.map((stage, index) => stage.favoriteTrack && <span key={`${stage.mood}-${index}`}>{moodDetails(stage.mood).emoji} {stage.favoriteTrack.name} · {stage.favoriteTrack.artist}</span>)}</div><input aria-label="Saved journey name" value={journeyName} onChange={(event) => setJourneyName(event.target.value)} placeholder="Name this journey" /><button type="button" onClick={saveJourney}>Save Emotional Journey</button></div></section>}
      </>}

      <section className="emotion-journey__saved">
        <div className="emotion-journey__section-title"><div><span>YOUR COLLECTION</span><h2>My Journeys</h2></div><span>{savedJourneys.length} saved</span></div>
        {savedJourneys.length ? <div className="emotion-journey__saved-list">{savedJourneys.map((journey) => <button type="button" key={journey.id} onClick={() => loadSavedJourney(journey)}><strong>{journey.name}</strong><span>{journey.stages.map((stage) => `${moodDetails(stage.mood).emoji} ${stage.mood}`).join(' → ')}</span><small>{journey.stages.reduce((count, stage) => count + (stage.playedTracks?.length || 0), 0)} songs played</small></button>)}</div> : <p className="emotion-journey__saved-empty">Saved journeys will be kept here for you to revisit.</p>}
      </section>
    </main>
  );
}

export default EmotionJourney;
