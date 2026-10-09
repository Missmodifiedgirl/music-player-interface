import React, { useEffect, useState } from 'react';
import { getArtist, getArtistTopTracks, searchSpotify } from '../spotify-api.js';
import { isAuthenticated } from '../spotify-auth.js';
import { getArtistInfo, getArtistTopTracksLastFm } from '../lastfm-api.js';
import { formatTime, getPlaceholderSvg } from '../utils.js';

function ArtistDetailView({ artist, ui, musicPlayer }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [readFullBio, setReadFullBio] = useState(false);

  useEffect(() => {
    let active = true;

    const loadArtist = async () => {
      setDetails(null);
      setError('');
      try {
        const lastFmInfo = await getArtistInfo(artist.name);
        let spotifyArtist = null;
        let topTracks = [];

        if (isAuthenticated()) {
          try {
            if (artist.id) {
              [spotifyArtist, topTracks] = await Promise.all([
                getArtist(artist.id),
                getArtistTopTracks(artist.id).then((result) => result.tracks || []),
              ]);
            } else {
              const searchResult = await searchSpotify(artist.name, 'artist', 1);
              spotifyArtist = searchResult.artists?.items?.[0] || null;
              if (spotifyArtist) {
                const result = await getArtistTopTracks(spotifyArtist.id);
                topTracks = result.tracks || [];
              }
            }
          } catch (spotifyError) {
            console.warn('Could not load Spotify artist tracks:', spotifyError);
          }
        }

        if (!topTracks.length) topTracks = await getArtistTopTracksLastFm(artist.name, 10);
        const tracks = topTracks.map((track) => ({
          id: track.id || `artist-${encodeURIComponent(track.name)}`,
          name: track.name,
          artist: artist.name,
          album: track.album?.name || track.name,
          image: track.album?.images?.[0]?.url || track.image || lastFmInfo.image || getPlaceholderSvg(artist.name),
          duration_ms: track.duration_ms || 210000,
          uri: track.uri || (track.id ? `spotify:track:${track.id}` : null),
          preview_url: track.preview_url || null,
          spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(`${artist.name} ${track.name}`)}`,
        }));

        if (active) setDetails({ lastFmInfo, spotifyArtist, tracks });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Failed to load artist details.');
      }
    };

    loadArtist();
    return () => { active = false; };
  }, [artist.id, artist.name]);

  return (
    <div className="view-artist-detail animate-fade-in">
      <button className="btn btn-text back-btn" type="button" onClick={() => ui.switchView('artists')}>Back to artists</button>
      {!details && !error && <p className="loading-state" aria-live="polite">Loading artist details…</p>}
      {error && <div className="error-box" role="alert">{error}</div>}
      {details && (() => {
        const { lastFmInfo, spotifyArtist, tracks } = details;
        const heroImage = spotifyArtist?.images?.[0]?.url || lastFmInfo.image || getPlaceholderSvg(artist.name);
        const biography = readFullBio ? lastFmInfo.bio?.content : lastFmInfo.bio?.summary || lastFmInfo.bio?.content;

        return (
          <>
            <header className="artist-hero-banner" style={{ backgroundImage: `linear-gradient(to bottom, rgba(18, 18, 22, 0.4), rgba(18, 18, 22, 0.95)), url("${heroImage}")` }}>
              <div className="artist-hero-left"><div className="artist-hero-avatar"><img src={heroImage} alt={`${artist.name}`} /></div></div>
              <div className="artist-hero-info">
                <div className="artist-verified-badge">Artist</div>
                <h1 className="artist-hero-name">{artist.name}</h1>
                <div className="artist-stats-row">
                  {lastFmInfo.listeners > 0 && <span><strong>{lastFmInfo.listeners.toLocaleString()}</strong> Last.fm listeners</span>}
                  {lastFmInfo.playcount > 0 && <span><strong>{lastFmInfo.playcount.toLocaleString()}</strong> total scrobbles</span>}
                  {spotifyArtist?.followers?.total > 0 && <span><strong>{spotifyArtist.followers.total.toLocaleString()}</strong> Spotify followers</span>}
                </div>
                <div className="artist-tags-row">{(lastFmInfo.tags || []).slice(0, 5).map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div>
              </div>
            </header>

            <div className="artist-action-bar">
              {!!tracks.length && <button className="btn btn-primary" type="button" onClick={() => musicPlayer.playTrack(tracks[0], tracks)}>Play top tracks</button>}
              {spotifyArtist?.external_urls?.spotify && <a className="btn btn-secondary" href={spotifyArtist.external_urls.spotify} target="_blank" rel="noreferrer">Open in Spotify</a>}
            </div>

            <section className="section-block">
              <h2 className="section-title">Popular Tracks</h2>
              {tracks.length ? (
                <div className="track-table-wrapper">
                  <table className="track-table">
                    <thead><tr><th>#</th><th>Title</th><th>Album</th><th>Duration</th><th /></tr></thead>
                    <tbody>{tracks.map((track, index) => (
                      <tr className="track-row" key={track.id}>
                        <td>{index + 1}</td>
                        <td><div className="track-title-cell"><img className="track-thumb" src={track.image} alt="" /><span className="track-name">{track.name}</span></div></td>
                        <td>{track.album}</td>
                        <td>{formatTime(track.duration_ms / 1000)}</td>
                        <td><button className="row-play-btn" type="button" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, tracks)}>▶</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="empty-text">No top tracks available.</p>}
            </section>

            <section className="section-block artist-bio-section">
              <h2 className="section-title">About the Artist</h2>
              <div className="artist-bio-card">
                <p>{biography || 'No biography available for this artist.'}</p>
                {lastFmInfo.bio?.content && lastFmInfo.bio.content !== lastFmInfo.bio.summary && (
                  <button className="btn btn-text" type="button" onClick={() => setReadFullBio((value) => !value)}>{readFullBio ? 'Show less' : 'Read full biography'}</button>
                )}
              </div>
            </section>

            {!!lastFmInfo.similar?.length && (
              <section className="section-block">
                <h2 className="section-title">Fans Also Like</h2>
                <div className="artists-grid-compact">
                  {lastFmInfo.similar.map((similar) => (
                    <button className="artist-card-circle" key={similar.name} type="button" onClick={() => ui.openArtistByName(similar.name)}>
                      <span className="artist-img-wrapper"><img src={similar.image || getPlaceholderSvg(similar.name)} alt="" loading="lazy" /></span>
                      <span className="artist-name">{similar.name}</span>
                      <span className="artist-role">Similar artist</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}

export default ArtistDetailView;