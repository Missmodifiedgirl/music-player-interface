import React, { useEffect, useState } from 'react';
import { getTrendingTracks } from '../lastfm-api.js';
import { getPlaceholderSvg } from '../utils.js';

function ArtistsView({ ui }) {
  const [tracks, setTracks] = useState([]);
  const [artistQuery, setArtistQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTrendingTracks(1, 30)
      .then((results) => { if (active) setTracks(results); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const artists = [...new Set(tracks.map((track) => track.artist))];
  const openArtist = (name) => {
    if (name.trim()) ui.openArtistByName(name.trim());
  };

  return (
    <div className="view-artists animate-fade-in">
      <header className="view-header">
        <h1 className="view-title">Featured Artists</h1>
        <p className="section-desc">Discover biographies, global statistics, top tracks, and similar creators.</p>
        <form className="artist-search-bar" onSubmit={(event) => { event.preventDefault(); openArtist(artistQuery); }}>
          <input className="input-field" type="search" value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="Find an artist by name…" aria-label="Artist name" />
          <button className="btn btn-primary" type="submit">Search artist</button>
        </form>
      </header>
      {loading ? (
        <p className="loading-state" aria-live="polite">Loading artists…</p>
      ) : (
        <div className="artists-grid">
          {artists.map((name) => {
            const image = tracks.find((track) => track.artist === name)?.image || getPlaceholderSvg(name);
            return (
              <button className="artist-catalog-card" key={name} type="button" onClick={() => openArtist(name)}>
                <span className="artist-card-cover"><img src={image} alt="" loading="lazy" /></span>
                <span className="artist-card-body"><strong className="artist-card-title">{name}</strong><span className="artist-card-subtitle">Artist</span></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ArtistsView;