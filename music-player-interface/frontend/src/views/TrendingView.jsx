import React, { useEffect, useState } from 'react';
import { getTrendingTracks } from '../lastfm-api.js';
import { getPlaceholderSvg } from '../utils.js';

function TrendingView({ ui, musicPlayer }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getTrendingTracks(1, 30)
      .then((results) => { if (active) setTracks(results); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Could not load trending songs.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [retry]);

  return (
    <div className="view-trending animate-fade-in">
      <header className="view-header">
        <div className="trending-badge"><span className="fire-icon" aria-hidden="true">↗</span> Last.fm global charts</div>
        <h1 className="view-title">Trending Songs</h1>
        <p className="section-desc">Popular tracks from the Last.fm global music community.</p>
      </header>
      {loading ? (
        <p className="loading-state" aria-live="polite">Loading chart…</p>
      ) : error ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button className="btn btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : (
        <div className="track-table-wrapper">
          <table className="track-table">
            <thead><tr><th>#</th><th>Track</th><th>Listeners</th><th>Play</th></tr></thead>
            <tbody>
              {tracks.map((track, index) => (
                <tr key={track.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="track-row-info">
                      <img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
                      <div><strong>{track.name}</strong><button type="button" onClick={() => ui.openArtistByName(track.artist)}>{track.artist}</button></div>
                    </div>
                  </td>
                  <td>{Number(track.listeners || 0).toLocaleString()}</td>
                  <td><button className="icon-btn" type="button" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, tracks)}>▶</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TrendingView;