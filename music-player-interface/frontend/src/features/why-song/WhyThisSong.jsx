import React, { useEffect, useMemo, useState } from 'react';
import { getArtistInfo, getTrendingTracks } from '../../lastfm-api.js';
import { getPlaceholderSvg } from '../../utils.js';
import { getCurrentMood, getJournalEntries } from '../music-journal/journal-store.js';
import './WhyThisSong.css';

const DISMISSED_KEY = 'melodixa-why-song-dismissed';
const MOOD_GROUPS = {
  happy: ['happy', 'joyful', 'uplifting', 'feel good', 'energetic', 'dance'],
  calm: ['calm', 'peaceful', 'relaxed', 'chill', 'ambient', 'acoustic'],
  sad: ['sad', 'melancholy', 'emotional', 'bittersweet', 'heartbreak', 'reflective'],
  loved: ['romantic', 'love', 'loved', 'tender', 'soul', 'intimate'],
  hopeful: ['hopeful', 'uplifting', 'inspiring', 'optimistic', 'dreamy'],
  motivated: ['motivational', 'energetic', 'powerful', 'anthem', 'workout'],
  focused: ['focus', 'instrumental', 'ambient', 'classical', 'minimal'],
  nostalgic: ['nostalgic', 'classic', 'memories', 'retro', 'throwback'],
  relaxed: ['calm', 'relaxed', 'chill', 'soft', 'ambient'],
  tired: ['calm', 'soft', 'slow', 'ambient', 'peaceful'],
  angry: ['intense', 'heavy', 'rock', 'metal', 'powerful'],
};

function normalizeTrack(track) {
  if (!track || typeof track !== 'object' || !track.name) return null;
  return {
    id: track.id || track.uri || track.name,
    name: track.name,
    artist: track.artist || track.artists?.map?.((artist) => artist.name).join(', ') || 'Unknown artist',
    album: track.album || track.album?.name || '',
    image: track.image || track.albumImage || track.album?.images?.[0]?.url || getPlaceholderSvg(track.name),
    uri: track.uri || '',
    preview_url: track.preview_url || '',
    spotifyUrl: track.spotifyUrl || '',
    duration_ms: track.duration_ms || 0,
    genre: track.genre || '',
  };
}

function sameTrack(left, right) {
  if (!left || !right) return false;
  return (left.id && right.id && String(left.id) === String(right.id))
    || (left.name?.toLowerCase() === right.name?.toLowerCase() && left.artist?.toLowerCase() === right.artist?.toLowerCase());
}

function readDismissed() {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn('Could not read dismissed recommendation preferences:', error);
    return [];
  }
}

function addDismissed(track, reason) {
  try {
    const dismissed = readDismissed().filter((item) => !sameTrack(item.track, track));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([{ track, reason, dismissedAt: new Date().toISOString() }, ...dismissed].slice(0, 100)));
    return true;
  } catch (error) {
    console.error('Could not save recommendation feedback:', error);
    return false;
  }
}

function getTrackGenre(track, artistTags) {
  if (track?.genre) return track.genre;
  if (track?.genres?.length) return track.genres.slice(0, 2).join(' · ');
  const likelyGenres = (artistTags || []).filter((tag) => !['seen live', 'favorites', 'beautiful', 'all'].includes(tag.toLowerCase()));
  return likelyGenres.slice(0, 2).map((tag) => tag.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' · ') || 'Genre details unavailable';
}

function matchPercentage(count, total, base = 72) {
  if (!count || !total) return base;
  return Math.min(98, Math.round(78 + (count / total) * 20));
}

function Icon({ name, size = 18 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'mood') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>;
  if (name === 'taste') return <svg {...props}><path d="M3 11.5 12 4l9 7.5M5 10v10h14V10M9 20v-6h6v6" /></svg>;
  if (name === 'artist') return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>;
  if (name === 'genre') return <svg {...props}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === 'time') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'play') return <svg {...props}><path d="m8 5 12 7-12 7V5Z" /></svg>;
  if (name === 'pause') return <svg {...props}><path d="M8 5v14M16 5v14" /></svg>;
  if (name === 'heart') return <svg {...props}><path d="M20.8 8.7c0 5.2-8.8 11.3-8.8 11.3S3.2 13.9 3.2 8.7a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z" /></svg>;
  if (name === 'spark') return <svg {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></svg>;
  if (name === 'refresh') return <svg {...props}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></svg>;
  if (name === 'plus') return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'clock') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  return <svg {...props}><path d="M4 12h16" /></svg>;
}

function ReasonCard({ icon, eyebrow, title, score, children }) {
  return (
    <article className="why-song__reason">
      <div className={`why-song__reason-icon why-song__reason-icon--${icon}`}><Icon name={icon} size={17} /></div>
      <div className="why-song__reason-content">
        <div className="why-song__reason-heading"><span>{eyebrow}</span>{score !== undefined && <strong>{score}% match</strong>}</div>
        <h3>{title}</h3>
        {children}
        {score !== undefined && <div className="why-song__reason-meter" aria-label={`${score}% match`}><span style={{ width: `${score}%` }} /></div>}
      </div>
    </article>
  );
}

function WhyThisSong({ musicPlayer, playlistStore, ui }) {
  const [track, setTrack] = useState(() => normalizeTrack(musicPlayer?.currentTrack));
  const [currentMood, setCurrentMood] = useState(getCurrentMood);
  const [history, setHistory] = useState(getJournalEntries);
  const [artistTags, setArtistTags] = useState([]);
  const [artistError, setArtistError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [notInterestedOpen, setNotInterestedOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [playing, setPlaying] = useState(Boolean(musicPlayer?.isPlaying));
  const [liked, setLiked] = useState(() => Boolean(musicPlayer?.currentTrack && playlistStore?.isTrackLiked?.(musicPlayer.currentTrack)));

  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const libraryTracks = playlists.flatMap((playlist) => playlist.tracks || []).map(normalizeTrack).filter(Boolean);
  const historyTracks = history.map((entry) => normalizeTrack(entry.track)).filter(Boolean);
  const genre = getTrackGenre(track, artistTags);
  const artistHistory = historyTracks.filter((item) => item.artist.toLowerCase().includes(track?.artist?.toLowerCase() || '\u0000'));
  const artistLibrary = libraryTracks.filter((item) => item.artist.toLowerCase().includes(track?.artist?.toLowerCase() || '\u0000'));
  const tasteMatches = [...historyTracks, ...libraryTracks].filter((item) => {
    if (sameTrack(item, track)) return false;
    const sameArtist = item.artist.toLowerCase() === track?.artist?.toLowerCase();
    const currentGenreWords = genre.toLowerCase().split(/[·,\s]+/).filter((word) => word.length > 3);
    const songText = `${item.name} ${item.artist}`.toLowerCase();
    return sameArtist || currentGenreWords.some((word) => songText.includes(word));
  });
  const similarSongs = [...new Map([...artistHistory, ...artistLibrary, ...tasteMatches].filter((item) => !sameTrack(item, track)).map((item) => [`${item.name.toLowerCase()}-${item.artist.toLowerCase()}`, item])).values()].slice(0, 3);
  const artistCount = artistHistory.length + artistLibrary.length;
  const tasteScore = matchPercentage(tasteMatches.length, Math.max(1, historyTracks.length + libraryTracks.length), tasteMatches.length ? 72 : 0);
  const artistScore = matchPercentage(artistCount, Math.max(1, historyTracks.length + libraryTracks.length), artistCount ? 72 : 0);
  const genreScore = matchPercentage(artistTags.length || tasteMatches.length, Math.max(1, artistTags.length + historyTracks.length), artistTags.length || tasteMatches.length ? 72 : 0);
  const moodScore = currentMood ? (artistTags.some((tag) => (MOOD_GROUPS[currentMood.toLowerCase()] || []).some((word) => tag.toLowerCase().includes(word))) ? 94 : 85) : 82;
  const scores = [moodScore, tasteScore, genreScore, artistScore];
  const overallScore = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const likedPlaylist = playlists.find((playlist) => playlist.id === 'liked-songs');

  useEffect(() => {
    const onTrackChange = (event) => {
      const nextTrack = normalizeTrack(event.detail?.track || musicPlayer?.currentTrack);
      if (!nextTrack) return;
      setTrack(nextTrack);
      setLiked(Boolean(playlistStore?.isTrackLiked?.(nextTrack)));
      setFeedback('');
    };
    const onPlaybackChange = (event) => setPlaying(Boolean(event.detail?.isPlaying));
    const onMoodUpdate = () => setCurrentMood(getCurrentMood());
    const onJournalUpdate = () => {
      setHistory(getJournalEntries());
      setCurrentMood(getCurrentMood());
    };
    window.addEventListener('music-player-track-changed', onTrackChange);
    window.addEventListener('music-player-playback-state-changed', onPlaybackChange);
    window.addEventListener('music-journal-updated', onJournalUpdate);
    window.addEventListener('storage', onMoodUpdate);
    window.addEventListener('storage', onJournalUpdate);
    return () => {
      window.removeEventListener('music-player-track-changed', onTrackChange);
      window.removeEventListener('music-player-playback-state-changed', onPlaybackChange);
      window.removeEventListener('music-journal-updated', onJournalUpdate);
      window.removeEventListener('storage', onMoodUpdate);
      window.removeEventListener('storage', onJournalUpdate);
    };
  }, [musicPlayer, playlistStore]);

  useEffect(() => {
    let active = true;
    setArtistTags([]);
    setArtistError('');
    if (!track?.artist) return () => { active = false; };
    getArtistInfo(track.artist).then((info) => {
      if (active) setArtistTags(info.tags || []);
    }).catch((error) => {
      console.error('Could not load song genre context:', error);
      if (active) setArtistError('Genre details are unavailable right now.');
    });
    return () => { active = false; };
  }, [track?.artist]);

  const favoriteArtists = useMemo(() => {
    const counts = {};
    [...historyTracks, ...libraryTracks].forEach((item) => { counts[item.artist] = (counts[item.artist] || 0) + 1; });
    return counts;
  }, [historyTracks, libraryTracks]);
  const isFavoriteArtist = (favoriteArtists[track?.artist] || 0) > 1;

  const listeningPattern = useMemo(() => {
    const entries = history.filter((entry) => entry.track && entry.playedAt);
    if (!entries.length) return null;
    const counts = entries.reduce((result, entry) => {
      const hour = new Date(entry.playedAt).getHours();
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late at night';
      result[period] = (result[period] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [history]);

  const moodDescription = currentMood
    ? `You set your current mood to “${currentMood}”. ${artistTags.length ? `The ${genre.toLowerCase()} qualities here ${moodScore >= 90 ? 'resonate with' : 'offer a thoughtful counterpoint to'} that feeling.` : 'This pick is a gentle match for the moment you told Melodixa you are in.'}`
    : `There isn’t a current mood set, so this pick is based on your listening patterns${artistTags.length ? ` and the ${genre.toLowerCase()} feel` : ''}. Choose a mood in Mood Music to make this reason even more personal.`;
  const tasteDescription = tasteMatches.length
    ? `Your library has ${tasteMatches.length} ${tasteMatches.length === 1 ? 'track' : 'tracks'} with a similar ${artistCount ? 'artist or listening' : 'listening'} pattern. ${similarSongs[0] ? `It sits alongside ${similarSongs[0].name} by ${similarSongs[0].artist}.` : ''}`
    : 'Your listening history is still taking shape. This song is a fresh discovery chosen to start learning what you love.';
  const artistDescription = artistCount
    ? `You have listened to or saved ${track?.artist} ${artistCount} ${artistCount === 1 ? 'time' : 'times'} in your music history.`
    : `You haven’t saved a track by ${track?.artist} yet — this is a chance to discover someone new.`;
  const genreDescription = artistTags.length
    ? `This artist is tagged ${genre}. ${tasteMatches.length ? 'Those styles are close to what already appears in your music history.' : 'We use these artist tags as a starting point for your taste profile.'}`
    : 'We’re still learning this artist’s style. Genre insights will become more personal as your listening library grows.';
  const timeDescription = listeningPattern
    ? `Your listening journal shows you most often play music in the ${listeningPattern}. ${genre.toLowerCase() === 'genre details unavailable' ? 'This one might be a good soundtrack for then.' : `${genre} can be a lovely soundtrack for then.`}`
    : 'As you listen, Melodixa can learn when music tends to find its way into your day.';

  const playSong = async (song = track) => {
    if (!song) return;
    try {
      await musicPlayer?.playTrack(song);
    } catch (error) {
      console.error('Could not play recommendation:', error);
      ui?.showToast?.('This song could not be played right now.', 'error');
    }
  };

  const toggleLike = () => {
    if (!track || !playlistStore) return;
    try {
      const nextLiked = playlistStore.toggleLikedTrack(track);
      setLiked(nextLiked);
      ui?.showToast?.(nextLiked ? 'Added to Liked Songs.' : 'Removed from Liked Songs.', 'success');
    } catch (error) {
      console.error('Could not update liked song:', error);
      ui?.showToast?.('This song could not be updated in your library.', 'error');
    }
  };

  const addToPlaylist = () => {
    if (!track || !playlistStore) return;
    const target = playlists.find((playlist) => playlist.id !== 'liked-songs') || likedPlaylist;
    if (!target) {
      ui?.showToast?.('Create a playlist first, then add this song to it.', 'info');
      return;
    }
    try {
      if (target.id === 'liked-songs' && playlistStore.isTrackLiked?.(track)) {
        ui?.showToast?.('Already in Liked Songs.', 'info');
        return;
      }
      if (playlistStore.isTrackInPlaylist?.(target.id, track)) {
        ui?.showToast?.(`Already in ${target.name}.`, 'info');
        return;
      }
      playlistStore.addTrackToPlaylist(target.id, track);
      ui?.showToast?.(`Added to ${target.name}.`, 'success');
    } catch (error) {
      console.error('Could not add recommendation to playlist:', error);
      ui?.showToast?.('This song could not be added to your playlist.', 'error');
    }
  };

  const showAnotherRecommendation = async () => {
    setLoadingRecommendations(true);
    setFeedback('');
    try {
      const dismissed = readDismissed().map((item) => item.track);
      const candidates = [...libraryTracks, ...historyTracks].filter((item) => !sameTrack(item, track) && !dismissed.some((dismissedTrack) => sameTrack(dismissedTrack, item)));
      let nextTrack = candidates.find((candidate) => !sameTrack(candidate, track));
      if (!nextTrack) {
        const trending = await getTrendingTracks(1, 30);
        nextTrack = trending.map(normalizeTrack).find((candidate) => candidate && !sameTrack(candidate, track) && !dismissed.some((item) => sameTrack(item, candidate)));
      }
      if (!nextTrack) {
        setFeedback('There are no other recommendations to show right now. Try again after you have listened to a few more songs.');
        return;
      }
      setTrack(nextTrack);
      setLiked(Boolean(playlistStore?.isTrackLiked?.(nextTrack)));
      setRecommendations((current) => [track, ...current].filter(Boolean).slice(0, 8));
    } catch (error) {
      console.error('Could not load another recommendation:', error);
      setFeedback('Another recommendation could not be loaded right now. Please try again.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const submitNotInterested = async () => {
    if (!selectedReason || !track) return;
    if (!addDismissed(track, selectedReason)) {
      setFeedback('Your feedback could not be saved. Please check browser storage and try again.');
      return;
    }
    setNotInterestedOpen(false);
    setSelectedReason('');
    setFeedback(`Got it. We’ll keep “${track.name}” out of your next picks because it’s ${selectedReason.toLowerCase()}.`);
    await showAnotherRecommendation();
  };

  if (!track) {
    return (
      <main className="why-song">
        <header className="why-song__topbar"><span className="why-song__brand"><span>✳</span> MELODIXA <i>/</i> WHY THIS SONG</span><span className="why-song__on-device">A little more personal</span></header>
        <section className="why-song__empty"><span className="why-song__empty-icon"><Icon name="spark" size={24} /></span><span className="why-song__eyebrow">THE STORY BEHIND THE SOUND</span><h1>A song belongs to a moment.</h1><p>Play a track in Melodixa, then open Why This Song to see how it connects with your mood and listening taste.</p></section>
      </main>
    );
  }

  return (
    <main className="why-song">
      <header className="why-song__topbar">
        <span className="why-song__brand"><span>✳</span> MELODIXA <i>/</i> WHY THIS SONG</span>
        <span className="why-song__on-device"><span /> Built around your listening</span>
      </header>

      <section className="why-song__hero">
        <div className="why-song__hero-art"><div className="why-song__hero-glow" /><img src={track.image || getPlaceholderSvg(track.name)} alt={`${track.name} album artwork`} /><span className="why-song__art-label"><Icon name="spark" size={12} /> A song for this moment</span></div>
        <div className="why-song__hero-copy">
          <span className="why-song__eyebrow">A LITTLE CONTEXT FOR YOUR NEXT PLAY</span>
          <h1>{track.name}</h1>
          <p className="why-song__artist">{track.artist}</p>
          <div className="why-song__meta-tags"><span><Icon name="genre" size={13} /> {genre}</span><span><Icon name="clock" size={13} /> Picked for your moment</span></div>
          <div className="why-song__hero-actions">
            <button className="why-song__play-button" type="button" onClick={() => playSong()}><Icon name={playing && sameTrack(musicPlayer?.currentTrack, track) ? 'pause' : 'play'} size={16} /> {playing && sameTrack(musicPlayer?.currentTrack, track) ? 'Play again' : 'Play song'}</button>
            <button className={`why-song__like-button${liked ? ' is-liked' : ''}`} type="button" onClick={toggleLike} aria-pressed={liked}><Icon name="heart" size={17} /> {liked ? 'Liked' : 'Like'}</button>
          </div>
          <p className="why-song__hero-footnote"><Icon name="spark" size={14} /> Don’t just recommend a song. Tell you why it belongs in your moment.</p>
        </div>
        <aside className="why-song__score-card" aria-label={`${overallScore}% personal match`}>
          <span className="why-song__score-orbit"><span className="why-song__score-number">{overallScore}<small>%</small></span><span className="why-song__score-label">PERSONAL<br />MATCH</span></span>
          <div className="why-song__score-caption"><Icon name="spark" size={14} /> YOUR PERSONAL MATCH</div>
          <p>Music that feels a little more like <em>you.</em></p>
        </aside>
      </section>

      <section className="why-song__explanations">
        <div className="why-song__section-heading"><span className="why-song__eyebrow">NOT A GUESS. A LITTLE CONTEXT.</span><h2>Why we picked this song for you.</h2><p>Each reason draws from what you’ve told us and what you’ve chosen to play.</p></div>
        <div className="why-song__score-breakdown" aria-label="Personal match breakdown">
          {[['Mood', moodScore], ['Taste', tasteScore], ['Genre', genreScore], ['Artist', artistScore]].map(([label, value]) => <div className="why-song__breakdown-item" key={label}><span><span>{label}</span><strong>{value}%</strong></span><i><span style={{ width: `${value}%` }} /></i></div>)}
        </div>
        <div className="why-song__reason-grid">
          <ReasonCard icon="mood" eyebrow="01 · RIGHT NOW" title={`Mood match${currentMood ? ` for ${currentMood}` : ''}`} score={moodScore}><p>{moodDescription}</p></ReasonCard>
          <ReasonCard icon="taste" eyebrow="02 · YOUR LISTENING" title="Your taste"><p>{tasteDescription}</p></ReasonCard>
          <ReasonCard icon="artist" eyebrow="03 · FAMILIAR VOICES" title={isFavoriteArtist ? 'Artist you return to' : 'A new artist for you'}><p>{artistDescription}</p></ReasonCard>
          <ReasonCard icon="genre" eyebrow="04 · THE SOUND" title="Genre match" score={genreScore}><p>{genreDescription}{artistError && <span className="why-song__metadata-note"> {artistError}</span>}</p></ReasonCard>
        </div>
      </section>

      <section className="why-song__discovery-grid">
        <article className="why-song__discovery-card">
          <div className="why-song__discovery-heading"><span className="why-song__discovery-icon">↻</span><span><span className="why-song__eyebrow">SOUNDS A LITTLE FAMILIAR</span><h2>Because you liked…</h2></span></div>
          {similarSongs.length ? <div className="why-song__similar-list">{similarSongs.map((song, index) => <div className="why-song__similar-song" key={`${song.id}-${index}`}><img src={song.image || getPlaceholderSvg(song.name)} alt="" /><span><strong>{song.name}</strong><small>{song.artist}</small></span><button type="button" onClick={() => playSong(song)} aria-label={`Play ${song.name}`}><Icon name="play" size={13} /></button></div>)}</div> : <p className="why-song__discovery-copy">Your listening story is just starting. Save and play a few more tracks to find the songs this one reminds you of.</p>}
        </article>
        <article className="why-song__discovery-card why-song__time-card">
          <div className="why-song__discovery-heading"><span className="why-song__discovery-icon"><Icon name="time" size={17} /></span><span><span className="why-song__eyebrow">WHEN MUSIC FINDS YOU</span><h2>{listeningPattern ? `Made for your ${listeningPattern}` : 'Your listening rhythm'}</h2></span></div>
          <p className="why-song__discovery-copy">{timeDescription}</p>
          <div className="why-song__time-visual"><span>morning</span><i /><i /><i /><i /><i /><i /><i className={listeningPattern === 'evening' ? 'is-active' : ''} /><i className={listeningPattern === 'late at night' ? 'is-active' : ''} /><i /><span>late night</span></div>
        </article>
      </section>

      <section className="why-song__actions">
        <div className="why-song__actions-copy"><span className="why-song__eyebrow">YOUR CALL, ALWAYS</span><h2>Does this one feel right?</h2><p>Keep it, make it yours, or help us understand what you’d rather hear.</p></div>
        <div className="why-song__action-buttons"><button type="button" className="why-song__action-button is-primary" onClick={() => playSong()}><Icon name="play" size={15} /> Play song</button><button type="button" className="why-song__action-button" onClick={addToPlaylist}><Icon name="plus" size={15} /> Add to playlist</button><button type="button" className={`why-song__action-button${liked ? ' is-liked' : ''}`} onClick={toggleLike}><Icon name="heart" size={15} /> {liked ? 'Liked' : 'Like'}</button><button type="button" className="why-song__action-button is-subtle" onClick={() => { setNotInterestedOpen((value) => !value); setFeedback(''); }}>Not interested</button><button type="button" className="why-song__action-button is-subtle" onClick={showAnotherRecommendation} disabled={loadingRecommendations}><Icon name="refresh" size={14} /> {loadingRecommendations ? 'Finding one…' : 'Show another'}</button></div>
      </section>

      {notInterestedOpen && <section className="why-song__feedback-panel" aria-label="Recommendation feedback"><div><strong>What didn’t feel right?</strong><small>This helps us make your next pick more personal.</small></div><div className="why-song__feedback-options">{['Not my mood', "Don't like this genre", "Don't like this artist", 'Already heard it'].map((reason) => <button type="button" key={reason} className={selectedReason === reason ? 'is-selected' : ''} aria-pressed={selectedReason === reason} onClick={() => setSelectedReason(reason)}>{reason}</button>)}</div><button className="why-song__feedback-submit" type="button" disabled={!selectedReason} onClick={submitNotInterested}>Send feedback <span>↗</span></button></section>}

      {feedback && <p className="why-song__feedback" role="status">{feedback}</p>}
      {recommendations.length > 0 && <section className="why-song__previous-picks"><span className="why-song__eyebrow">RECENTLY EXPLORED</span><div>{recommendations.map((song, index) => <button type="button" key={`${song.id}-${index}`} onClick={() => { setTrack(song); setLiked(Boolean(playlistStore?.isTrackLiked?.(song))); }}><img src={song.image} alt="" /><span><strong>{song.name}</strong><small>{song.artist}</small></span></button>)}</div></section>}
      <footer className="why-song__privacy">Your listening context stays yours. Your taste is shaped by your music on this device.</footer>
    </main>
  );
}

export default WhyThisSong;
