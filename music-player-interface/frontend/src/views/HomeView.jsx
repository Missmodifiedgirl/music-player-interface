import React, { useEffect, useState } from 'react';
import { getTrendingTracks } from '../lastfm-api.js';
import { getPlaceholderSvg } from '../utils.js';

function HomeView({ ui, musicPlayer, playlistStore }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    let active = true;

    getTrendingTracks(1, 10)
      .then((results) => {
        if (active) setTracks(results.slice(0, 8));
      })
      .catch((error) => {
        console.warn('Error loading home trending:', error);
        if (active) setLoadError('Trending tracks could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const playTrack = (track) => musicPlayer.playTrack(track, tracks);
  const artists = [...new Set(tracks.map((track) => track.artist))].slice(0, 6);

  return (
    <div className="view-home animate-fade-in">
      <header className="home-hero">
        <div className="hero-content">
          <span className="hero-tag">Welcome to Music Player Interface</span>
          <h1 className="hero-title">{greeting}</h1>
          <p className="hero-subtitle">Stream trending tracks from Last.fm, search Spotify, and build playlists around your day.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => ui.switchView('trending')}>
              Listen to Trending Charts
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => ui.openCreatePlaylistModal()}>
              New Playlist
            </button>
          </div>
        </div>
      </header>

      <section className="section-block">
        <h2 className="section-title">Quick Access</h2>
        <div className="quick-play-grid">
          <button
            className="quick-play-card"
            type="button"
            onClick={() => {
              const playlist = playlistStore.getPlaylistById('liked-songs');
              if (playlist?.tracks.length) {
                musicPlayer.playTrack(playlist.tracks[0], playlist.tracks);
              } else {
                ui.showToast('No liked songs yet. Like a track to add it here.', 'info');
              }
            }}
          >
            <span className="quick-icon-liked" aria-hidden="true">♥</span>
            <span className="quick-title">Liked Songs</span>
            <span className="card-play-btn" aria-hidden="true">▶</span>
          </button>
          <button className="quick-play-card" type="button" onClick={() => ui.switchView('trending')}>
            <span className="quick-icon-trending" aria-hidden="true">↗</span>
            <span className="quick-title">Global Top 50</span>
            <span className="card-play-btn" aria-hidden="true">▶</span>
          </button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-header">
          <div>
            <h2 className="section-title">Trending Worldwide</h2>
            <p className="section-desc">Popular tracks from Last.fm charts</p>
          </div>
          <button className="btn btn-text" type="button" onClick={() => ui.switchView('trending')}>See all charts</button>
        </div>
        {loading ? (
          <div className="cards-carousel" aria-live="polite">Loading trending tracks…</div>
        ) : loadError ? (
          <p className="section-desc" role="status">{loadError}</p>
        ) : (
          <div className="cards-carousel">
            {tracks.map((track) => (
              <article className="music-card" key={track.id}>
                <div className="card-cover-wrapper">
                  <img
                    src={track.image || getPlaceholderSvg(track.name)}
                    alt={`${track.name} cover`}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.src = getPlaceholderSvg(track.name); }}
                  />
                  <button className="card-play-btn" type="button" title={`Play ${track.name}`} onClick={() => playTrack(track)}>▶</button>
                </div>
                <div className="card-body">
                  <h3 className="card-title">{track.name}</h3>
                  <button className="card-subtitle artist-link" type="button" onClick={() => ui.openArtistByName(track.artist)}>{track.artist}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-header">
          <div>
            <h2 className="section-title">Popular Artists</h2>
            <p className="section-desc">Explore artists from today’s charts</p>
          </div>
          <button className="btn btn-text" type="button" onClick={() => ui.switchView('artists')}>Explore artists</button>
        </div>
        <div className="artists-grid-compact">
          {artists.map((artist) => {
            const image = tracks.find((track) => track.artist === artist)?.image || getPlaceholderSvg(artist);
            return (
              <button className="artist-card-circle" key={artist} type="button" onClick={() => ui.openArtistByName(artist)}>
                <span className="artist-img-wrapper"><img src={image} alt="" loading="lazy" /></span>
                <span className="artist-name">{artist}</span>
                <span className="artist-role">Artist</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default HomeView;