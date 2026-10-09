import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getArtistInfo } from '../../lastfm-api.js';
import { searchSpotify } from '../../spotify-api.js';
import { isAuthenticated } from '../../spotify-auth.js';
import { getJournalEntries } from '../music-journal/journal-store.js';
import { getPlaceholderSvg } from '../../utils.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import { addLanguageToSearch } from '../../music-languages.js';
import './SongConversation.css';

const FEATURE_MOODS = {
  romantic: ['love', 'romantic', 'tender', 'intimate', 'soul'],
  motivational: ['motivational', 'powerful', 'inspiring', 'anthem', 'energetic'],
  nostalgic: ['nostalgic', 'memories', 'retro', 'classic', 'throwback'],
  emotional: ['emotional', 'melancholy', 'sad', 'heartbreak', 'reflective'],
};

function normalizeTrack(track) {
  if (!track) return null;
  const album = typeof track.album === 'object' ? track.album : null;
  const artist = track.artist || track.artists?.map?.((item) => item.name).join(', ') || 'Unknown artist';
  return {
    ...track,
    name: track.name || 'Unknown song',
    artist,
    albumName: album?.name || (typeof track.album === 'string' ? track.album : ''),
    image: track.image || track.albumArt || album?.images?.[0]?.url || getPlaceholderSvg(track.name),
    genres: Array.isArray(track.genres) ? track.genres : track.genre ? [track.genre] : [],
  };
}

function getStarters(track, tags = []) {
  const context = `${track?.mood || ''} ${track?.theme || ''} ${tags.join(' ')} ${track?.genres.join(' ')}`.toLowerCase();
  const starters = [];
  if (FEATURE_MOODS.romantic.some((word) => context.includes(word))) {
    starters.push('What makes this song romantic?', 'What kind of love does this song describe?');
  }
  if (FEATURE_MOODS.motivational.some((word) => context.includes(word))) {
    starters.push('What message does this song give?', 'Why does this song feel powerful?');
  }
  if (FEATURE_MOODS.nostalgic.some((word) => context.includes(word))) {
    starters.push('Why does this song feel nostalgic?', 'What emotion does this song create?');
  }
  if (FEATURE_MOODS.emotional.some((word) => context.includes(word))) {
    starters.push('What makes this song emotionally powerful?', 'What is the emotional theme?');
  }
  starters.push(
    `What can you tell me about “${track?.name || 'this song'}”?`,
    'What genre is this song?',
    'Tell me about the artist.',
    'Find songs with a similar feeling.',
    'Recommend songs like this one.',
  );
  return [...new Set(starters)].slice(0, 6);
}

function createReply(question, track, artistInfo) {
  const text = question.toLowerCase();
  const tags = (artistInfo?.tags || []).slice(0, 4);
  const genres = track.genres.length ? track.genres : tags;
  const genreText = genres.length ? genres.join(', ') : '';
  const moodText = track.mood || track.theme || tags.slice(0, 2).join(' and ');

  if (text.includes('artist')) {
    const biography = artistInfo?.bio?.summary;
    return biography
      ? `${track.artist} is an artist whose Last.fm biography says: ${biography}`
      : `${track.artist} is the artist behind “${track.name}”${track.albumName ? ` from “${track.albumName}”` : ''}. I don’t have a verified artist biography available right now, but I can still explore the song’s style and your listening context.`;
  }
  if (text.includes('genre') || text.includes('style')) {
    if (track.genres.length) return `The track metadata lists ${track.genres.join(', ')} for “${track.name}” by ${track.artist}.`;
    if (tags.length) return `I don’t have a confirmed track-level genre for “${track.name},” but Last.fm tags ${track.artist} with ${tags.join(', ')}. Those are artist-level clues, not a guarantee of this song’s exact genre.`;
    return `I can identify “${track.name}” by ${track.artist}${track.albumName ? ` on “${track.albumName}”` : ''}, but no genre information is attached to the available track data yet.`;
  }
  if (text.includes('album')) {
    return track.albumName
      ? `“${track.name}” appears on “${track.albumName}” by ${track.artist}. ${genreText ? `The available style clues include ${genreText}.` : 'I don’t have verified album notes or track lyrics in the current song data.'}`
      : `I don’t have the album name attached to “${track.name}” by ${track.artist} yet. I can still talk about the track using its available style and mood information.`;
  }
  if (text.includes('similar') || text.includes('recommend') || text.includes('something like') || text.includes('explore')) {
    return `I’ll look for tracks connected to “${track.name}” by ${track.artist}${genreText ? ` and its ${genreText} sound` : ''}. I’ll prioritize songs from your library, then check Spotify if you’re connected.`;
  }
  if (text.includes('theme') || text.includes('about') || text.includes('emotional') || text.includes('romantic') || text.includes('powerful') || text.includes('message') || text.includes('feeling') || text.includes('emotion')) {
    if (moodText) return `For “${track.name}” by ${track.artist}, the available context points toward ${moodText}. That can give the song a ${text.includes('emotional') || text.includes('emotion') || text.includes('feeling') ? 'reflective, emotionally focused' : 'distinctive'} feel. I don’t have verified lyrics here, so I won’t guess at a specific story beyond those song and artist details.`;
    return `I can place “${track.name}” by ${track.artist}${track.albumName ? ` on “${track.albumName}”` : ''}, but the song data doesn’t include lyrics, a theme, or mood tags. If you share what part stands out to you, we can explore that feeling together without making up a song meaning.`;
  }
  return `We’re talking about “${track.name}” by ${track.artist}${track.albumName ? `, from “${track.albumName}”` : ''}.${genreText ? ` Its available style tags include ${genreText}.` : ''} Ask me about its style, the artist, its available context, or music with a similar sound.`;
}

function ConversationTrackCard({ track, playing, onTogglePlayback }) {
  return (
    <section className="song-conversation__track">
      <img src={track.image} alt="" />
      <div><span>NOW PLAYING · SONG CONTEXT</span><strong>{track.name}</strong><small>{track.artist}{track.albumName ? ` · ${track.albumName}` : ''}</small></div>
      <button type="button" aria-label={playing ? 'Pause current song' : 'Resume current song'} onClick={onTogglePlayback}>{playing ? 'Ⅱ' : '▶'}</button>
    </section>
  );
}

function SongConversation({ musicPlayer, playlistStore, ui }) {
  const [track, setTrack] = useState(() => normalizeTrack(musicPlayer?.currentTrack));
  const [playing, setPlaying] = useState(Boolean(musicPlayer?.isPlaying));
  const [artistInfo, setArtistInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('Any language');
  const [sending, setSending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [recommendationError, setRecommendationError] = useState('');
  const [findingRecommendations, setFindingRecommendations] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [journalRevision, setJournalRevision] = useState(0);
  const chatEndRef = useRef(null);
  const trackRequestRef = useRef(0);

  useEffect(() => {
    const onTrackChange = (event) => {
      trackRequestRef.current += 1;
      setTrack(normalizeTrack(event.detail?.track || musicPlayer?.currentTrack));
      setMessages([]);
      setSending(false);
      setRecommendations([]);
      setRecommendationMessage('');
      setRecommendationError('');
      setFindingRecommendations(false);
      setInput('');
    };
    const onPlaybackChange = (event) => setPlaying(Boolean(event.detail?.isPlaying));
    const onLibraryChange = () => setLibraryRevision((value) => value + 1);
    const onJournalChange = () => setJournalRevision((value) => value + 1);
    window.addEventListener('music-player-track-changed', onTrackChange);
    window.addEventListener('music-player-playback-state-changed', onPlaybackChange);
    window.addEventListener('playlists-updated', onLibraryChange);
    window.addEventListener('music-journal-updated', onJournalChange);
    window.addEventListener('storage', onJournalChange);
    return () => {
      window.removeEventListener('music-player-track-changed', onTrackChange);
      window.removeEventListener('music-player-playback-state-changed', onPlaybackChange);
      window.removeEventListener('playlists-updated', onLibraryChange);
      window.removeEventListener('music-journal-updated', onJournalChange);
      window.removeEventListener('storage', onJournalChange);
    };
  }, [musicPlayer]);

  useEffect(() => {
    let active = true;
    setArtistInfo(null);
    if (!track?.artist || track.artist === 'Unknown artist') return () => { active = false; };
    getArtistInfo(track.artist).then((info) => {
      if (active) {
        const genericFallback = info.bio?.summary?.startsWith(`${track.artist} is one of the most prominent musical artists globally`);
        setArtistInfo(genericFallback ? { ...info, bio: { ...info.bio, summary: '' }, tags: [] } : info);
      }
    }).catch((error) => {
      console.warn('Could not load Song Conversation artist context:', error);
    });
    return () => { active = false; };
  }, [track?.artist]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const suggestions = useMemo(() => getStarters(track, artistInfo?.tags || []), [track, artistInfo]);
  const availableTracks = useMemo(() => {
    const library = playlists.flatMap((playlist) => playlist.tracks || []);
    const history = getJournalEntries().map((entry) => entry.track).filter(Boolean);
    const byTrack = new Map();
    [...library, ...history].forEach((item) => {
      const normalized = normalizeTrack(item);
      if (!normalized || normalized.name.toLowerCase() === track?.name?.toLowerCase()
        && normalized.artist.toLowerCase() === track?.artist?.toLowerCase()) return;
      byTrack.set(`${normalized.name}::${normalized.artist}`.toLowerCase(), normalized);
    });
    return [...byTrack.values()];
  }, [playlists, libraryRevision, journalRevision, track?.name, track?.artist]);

  const exploreRecommendations = async () => {
    if (!track) return [];
    const requestVersion = trackRequestRef.current;
    setFindingRecommendations(true);
    setRecommendationError('');
    const contextTerms = [...track.genres, ...(artistInfo?.tags || []).slice(0, 2)].filter(Boolean);
    const contextText = contextTerms.join(' ').trim();
    const matched = availableTracks.filter((candidate) => {
      const sameArtist = candidate.artist.toLowerCase() === track.artist.toLowerCase();
      const candidateContext = `${candidate.genre || ''} ${(candidate.genres || []).join(' ')}`.toLowerCase();
      const sameStyle = contextTerms.some((term) => candidateContext.includes(term.toLowerCase()));
      return sameArtist || sameStyle;
    }).slice(0, 5);
    if (matched.length >= 3 || !isAuthenticated()) {
      setRecommendations(matched);
      setRecommendationMessage(matched.length
        ? `Because you connected with “${track.name},” these songs share an artist or style from your library.`
        : 'There are no clearly related tracks in your listening history or saved library yet. Connect Spotify or save more music to discover a closer match.');
      setFindingRecommendations(false);
      return matched;
    }

    setRecommendationMessage('Searching Spotify for songs connected to this track…');
    try {
      const query = [track.artist, ...contextTerms].filter(Boolean).join(' ');
      const result = await searchSpotify(addLanguageToSearch(query, language), 'track', 10);
      if (requestVersion !== trackRequestRef.current) return [];
      const spotifyTracks = (result.tracks?.items || []).map((item) => normalizeTrack({
        id: item.id,
        name: item.name,
        artist: item.artists?.map((artist) => artist.name).join(', '),
        album: item.album,
        image: item.album?.images?.[0]?.url,
        uri: item.uri,
        preview_url: item.preview_url,
        duration_ms: item.duration_ms,
        spotifyUrl: item.external_urls?.spotify,
      })).filter((candidate) => candidate && (
        candidate.name.toLowerCase() !== track.name.toLowerCase()
        || candidate.artist.toLowerCase() !== track.artist.toLowerCase()
      ));
      const merged = [...matched, ...spotifyTracks].filter((item, index, list) => list.findIndex((other) => (
        other.name.toLowerCase() === item.name.toLowerCase() && other.artist.toLowerCase() === item.artist.toLowerCase()
      )) === index).slice(0, 5);
      setRecommendations(merged);
      setRecommendationMessage(merged.length
        ? `Because you connected with “${track.name},” these songs share an artist or style from your listening context.`
        : 'Spotify didn’t return a close match for this track. Try exploring your saved library again later.');
      setFindingRecommendations(false);
      return merged;
    } catch (error) {
      if (requestVersion !== trackRequestRef.current) return [];
      console.error('Could not search for Song Conversation recommendations:', error);
      setRecommendations(matched);
      setRecommendationError('Spotify recommendations could not be loaded right now.');
      setRecommendationMessage(matched.length
        ? 'Showing related songs already in your library.'
        : 'No related tracks were found in your library, and Spotify could not be reached.');
      setFindingRecommendations(false);
      return matched;
    }
  };

  const askQuestion = async (question) => {
    const prompt = question.trim();
    if (!prompt || sending || !track) return;
    const requestVersion = trackRequestRef.current;
    const asksForRecommendations = /similar|recommend|something like|explore/i.test(prompt);
    setInput('');
    setMessages((items) => [...items, { role: 'user', text: prompt }]);
    setSending(true);
    try {
      const response = createReply(prompt, track, artistInfo);
      if (asksForRecommendations) {
        await exploreRecommendations();
        if (requestVersion !== trackRequestRef.current) return;
        setMessages((items) => [...items, { role: 'assistant', text: response }]);
      } else {
        setMessages((items) => [...items, { role: 'assistant', text: response }]);
      }
    } finally {
      if (requestVersion === trackRequestRef.current) setSending(false);
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    askQuestion(input);
  };

  const playTrack = async (song) => {
    try {
      await musicPlayer?.playTrack?.(song);
    } catch (error) {
      console.error('Could not play Song Conversation recommendation:', error);
      ui?.showToast?.('This song could not be played right now.', 'error');
    }
  };

  const saveTrack = (song) => {
    if (!playlistStore) return;
    try {
      const liked = playlistStore.getAllPlaylists?.().find((item) => item.id === 'liked-songs' || item.isLiked)
        || playlistStore.createPlaylist({ name: 'Liked Songs', description: 'Your favorite tracks in one place', coverArt: song.image });
      const added = playlistStore.addTrackToPlaylist(liked.id, song);
      ui?.showToast?.(added ? `Added to ${liked.name}.` : `Already in ${liked.name}.`, added ? 'success' : 'info');
    } catch (error) {
      console.error('Could not save Song Conversation recommendation:', error);
      ui?.showToast?.('This song could not be added to your playlist.', 'error');
    }
  };

  const closePanel = () => window.dispatchEvent(new CustomEvent('melodixa-close-feature'));

  return (
    <main className="song-conversation">
      <header className="song-conversation__header">
        <button type="button" className="song-conversation__back" onClick={closePanel}>← <span>Back to player</span></button>
        <div><span className="song-conversation__eyebrow">MELODIXA · SONG CONVERSATION</span><h1>Talk about this song</h1></div>
        <span className="song-conversation__ai"><i /> SONG GUIDE</span>
      </header>
      {track ? (
        <>
          <ConversationTrackCard track={track} playing={playing} onTogglePlayback={() => musicPlayer?.togglePlay?.()} />
          <div className="song-conversation__layout">
            <section className="song-conversation__chat-panel">
              <div className="song-conversation__chat-heading"><div><span className="song-conversation__ai-dot">✦</span><div><strong>Melodixa</strong><small>{artistInfo?.tags?.length ? `Song-aware · ${artistInfo.tags.slice(0, 2).join(' / ')}` : 'Your music companion'}</small></div></div><span>ABOUT THIS SONG</span></div>
              <div className="song-conversation__messages" aria-live="polite">
                {!messages.length && <article className="song-conversation__bubble song-conversation__bubble--assistant"><span>MELODIXA</span><p>Let’s explore <strong>{track.name}</strong> by <strong>{track.artist}</strong>. I’ll use the song and artist details available to me—and I’ll be clear when lyrics or other details aren’t available.</p></article>}
                {messages.map((message, index) => <article className={`song-conversation__bubble song-conversation__bubble--${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'assistant' ? 'MELODIXA' : 'YOU'}</span><p>{message.text}</p></article>)}
                {sending && <article className="song-conversation__bubble song-conversation__bubble--assistant"><span>MELODIXA</span><p className="song-conversation__thinking">Thinking about this song<span> ···</span></p></article>}
                <div ref={chatEndRef} />
              </div>
              <div className="song-conversation__suggestions"><span>KEEP THE CONVERSATION GOING</span><div>{suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={sending} onClick={() => askQuestion(suggestion)}>{suggestion}</button>)}</div></div>
              <form className="song-conversation__composer" onSubmit={sendMessage}>
                <input aria-label="Ask about this song" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything about this song…" maxLength={500} disabled={sending} />
                <button type="submit" aria-label="Send message" disabled={!input.trim() || sending}>↑</button>
              </form>
            </section>
            <aside className="song-conversation__side">
              <article className="song-conversation__context">
                <span>SONG CONTEXT</span><h2>Listen closer</h2>
                <dl><div><dt>🎵 Song</dt><dd>{track.name}</dd></div><div><dt>🎤 Artist</dt><dd>{track.artist}</dd></div><div><dt>💿 Album</dt><dd>{track.albumName || 'Album details unavailable'}</dd></div><div><dt>〰 Genre</dt><dd>{track.genres.length ? track.genres.join(', ') : artistInfo?.tags?.slice(0, 3).join(', ') || 'Not available in track data'}</dd></div></dl>
                {artistInfo?.bio?.summary && <p className="song-conversation__artist-note">{artistInfo.bio.summary}</p>}
              </article>
              <MusicLanguageSelect value={language} onChange={setLanguage} />
              <button type="button" className="song-conversation__explore" onClick={exploreRecommendations} disabled={findingRecommendations}>{findingRecommendations ? 'Finding songs…' : '✦ Explore Similar Songs'} <span>→</span></button>
            </aside>
          </div>
          {recommendationMessage && <section className="song-conversation__recommendations">
            <header><div><span>AFTER THIS CONVERSATION</span><h2>Because you liked this song…</h2><p>{recommendationMessage}</p></div><strong>YOUR NEXT LISTEN</strong></header>
            {recommendationError && <p className="song-conversation__recommendation-error" role="status">{recommendationError}</p>}
            {recommendations.length ? <div className="song-conversation__recommendation-grid">{recommendations.map((song) => <article className="song-conversation__recommendation" key={`${song.name}::${song.artist}`}>
              <img src={song.image} alt="" loading="lazy" /><div><strong>{song.name}</strong><span>{song.artist}</span><small>{song.genres?.[0] || song.genre || 'Related listening'}</small></div>
              <button type="button" aria-label={`Play ${song.name}`} onClick={() => playTrack(song)}>▶</button><button type="button" aria-label={`Add ${song.name} to playlist`} onClick={() => saveTrack(song)}>＋</button>
            </article>)}</div> : <div className="song-conversation__recommendation-empty">Save more tracks or connect Spotify to build a song match from your listening world.</div>}
          </section>}
        </>
      ) : (
        <section className="song-conversation__empty"><span>♫</span><h2>Start with the song you’re playing</h2><p>Choose a track in Melodixa, then come back to explore its sound, artist, and the music it connects to.</p><button type="button" onClick={closePanel}>Back to player</button></section>
      )}
      <footer className="song-conversation__footer">A music-first conversation, grounded in available song and artist details.</footer>
    </main>
  );
}

export default SongConversation;
