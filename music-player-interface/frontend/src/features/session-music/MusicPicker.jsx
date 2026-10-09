import React, { useMemo, useState } from 'react';
import { findTracks } from '../song-search.js';
import { getJournalEntries } from '../music-journal/journal-store.js';
import { getPlaceholderSvg } from '../../utils.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import './MusicPicker.css';

export function normalizeSleepTrack(track) {
  if (!track) return null;
  const album = typeof track.album === 'object' ? track.album : null;
  return {
    ...track,
    artist: track.artist || track.artists?.map?.((artist) => artist.name).join(', ') || 'Unknown artist',
    albumName: album?.name || (typeof track.album === 'string' ? track.album : ''),
    image: track.image || track.albumArt || album?.images?.[0]?.url || getPlaceholderSvg(track.name),
  };
}

function trackKey(track) {
  return `${track?.name || ''}::${track?.artist || ''}`.toLowerCase();
}

function SongRow({ track, onSelect, onPlay }) {
  return (
    <article className="session-music__song">
      <img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
      <div><strong>{track.name}</strong><span>{track.artist}</span><small>{track.albumName || 'Album unavailable'}</small></div>
      <button type="button" aria-label={`Play ${track.name}`} onClick={() => onPlay(track)}>▶</button>
      <button type="button" className="session-music__select" onClick={() => onSelect(track)}>Select</button>
    </article>
  );
}

export default function MusicPicker({ playlistStore, musicPlayer, onSelectSong, onSelectPlaylist, onClose }) {
  const [view, setView] = useState('choices');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('Any language');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const favorites = playlists.find((playlist) => playlist.id === 'liked-songs' || playlist.isLiked)?.tracks || [];
  const recentlyPlayed = useMemo(() => {
    const unique = new Map();
    getJournalEntries().forEach((entry) => {
      const track = normalizeSleepTrack(entry.track);
      if (track?.name && !unique.has(trackKey(track))) unique.set(trackKey(track), track);
    });
    return [...unique.values()].slice(0, 5);
  }, []);

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      setResults((await findTracks(query.trim(), language)).map(normalizeSleepTrack).filter(Boolean));
    } catch (searchError) {
      console.error('Could not search for sleep music:', searchError);
      setError('Search is unavailable right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const play = async (track, queue = null) => {
    try {
      await musicPlayer?.playTrack?.(track, queue);
    } catch (playError) {
      console.error('Could not preview session music:', playError);
      setError('This track could not be played right now.');
    }
  };

  return (
    <section className="session-music" aria-label="Choose music">
      <header className="session-music__header">
        <div><span>BUILD YOUR SOUNDTRACK</span><h2>Choose Music</h2></div>
        <button type="button" aria-label="Close music selector" onClick={onClose}>×</button>
      </header>
      {view === 'choices' && (
        <>
          <div className="session-music__choices">
            <button type="button" disabled={!musicPlayer?.currentTrack} onClick={() => onSelectSong(normalizeSleepTrack(musicPlayer.currentTrack))}><span>🎵</span><strong>Currently Playing</strong><small>{musicPlayer?.currentTrack?.name || 'No song playing'}</small></button>
            <button type="button" onClick={() => setView('search')}><span>🔎</span><strong>Select a Song</strong><small>Search songs and browse recent listens</small></button>
            <button type="button" onClick={() => setView('playlists')}><span>📋</span><strong>Select a Playlist</strong><small>Choose a playlist for your session</small></button>
            <button type="button" onClick={() => setView('favorites')}><span>❤️</span><strong>Favorites</strong><small>{favorites.length} saved songs</small></button>
          </div>
          {!!recentlyPlayed.length && <div className="session-music__recent"><span>RECENTLY PLAYED</span>{recentlyPlayed.map((track) => <SongRow key={trackKey(track)} track={track} onSelect={onSelectSong} onPlay={play} />)}</div>}
        </>
      )}
      {view === 'search' && <>
        <button className="session-music__back" type="button" onClick={() => setView('choices')}>← Music choices</button>
        <form className="session-music__search" onSubmit={search}><input aria-label="Search songs" placeholder="Search songs..." value={query} onChange={(event) => setQuery(event.target.value)} /><button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search'}</button></form>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        {error && <p className="session-music__error" role="alert">{error}</p>}
        {results.map((track) => <SongRow key={trackKey(track)} track={track} onSelect={onSelectSong} onPlay={play} />)}
        {!!recentlyPlayed.length && <div className="session-music__recent"><span>RECENTLY PLAYED</span>{recentlyPlayed.map((track) => <SongRow key={trackKey(track)} track={track} onSelect={onSelectSong} onPlay={play} />)}</div>}
      </>}
      {view === 'playlists' && <>
        <button className="session-music__back" type="button" onClick={() => setView('choices')}>← Music choices</button>
        {playlists.filter((playlist) => playlist.tracks?.length).map((playlist) => <article className="session-music__playlist" key={playlist.id}>
          <img src={playlist.coverArt || playlist.tracks[0]?.image || getPlaceholderSvg(playlist.name)} alt="" />
          <div><strong>{playlist.name}</strong><span>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}</span></div>
          <button type="button" onClick={() => onSelectPlaylist(playlist)}>Select</button>
        </article>)}
        {!playlists.some((playlist) => playlist.tracks?.length) && <p className="session-music__empty">Your playlists are empty. Add songs to a playlist to use it here.</p>}
      </>}
      {view === 'favorites' && <>
        <button className="session-music__back" type="button" onClick={() => setView('choices')}>← Music choices</button>
        {favorites.map((track) => <SongRow key={trackKey(normalizeSleepTrack(track))} track={normalizeSleepTrack(track)} onSelect={onSelectSong} onPlay={play} />)}
        {!favorites.length && <p className="session-music__empty">Save songs to Liked Songs and they’ll appear here.</p>}
      </>}
    </section>
  );
}
