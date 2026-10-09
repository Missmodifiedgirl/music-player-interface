import React, { useEffect, useState } from 'react';
import { formatTime, getPlaceholderSvg } from '../utils.js';
import { isAuthenticated } from '../spotify-auth.js';

function PlaylistsView({ ui, playlistStore, musicPlayer, playlist = null }) {
  const [, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    window.addEventListener('playlists-updated', refresh);
    return () => window.removeEventListener('playlists-updated', refresh);
  }, []);

  const playlists = playlistStore.getAllPlaylists();
  const currentPlaylist = playlist
    ? playlistStore.getPlaylistById(playlist.id) || playlist
    : null;

  const playPlaylist = (selected) => {
    if (selected.tracks.length) {
      musicPlayer.playTrack(selected.tracks[0], selected.tracks);
    } else {
      ui.showToast('This playlist is empty. Add songs from Trending or Search.', 'info');
    }
  };

  const exportPlaylist = async () => {
    if (!isAuthenticated()) {
      ui.showToast('Please connect Spotify first to export playlists.', 'warning');
      return;
    }

    setExporting(true);
    try {
      const result = await playlistStore.exportPlaylistToSpotify(currentPlaylist.id);
      setExported(true);
      ui.showToast(`Successfully created “${result.name}” on Spotify.`, 'success');
    } catch (error) {
      ui.showToast(`Export failed: ${error.message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!currentPlaylist) {
    return (
      <div className="view-playlists animate-fade-in">
        <div className="section-header">
          <div>
            <h1 className="view-title">Your Playlists</h1>
            <p className="section-desc">Create and organize your music collections.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => ui.openCreatePlaylistModal()}>Create playlist</button>
        </div>
        <div className="playlists-grid">
          {playlists.map((item) => (
            <article className="playlist-card" key={item.id} onClick={() => ui.switchView('playlist-detail', { playlist: item })}>
              <div className="playlist-cover-wrapper">
                <img src={item.coverArt || getPlaceholderSvg(item.name)} alt="" onError={(event) => { event.currentTarget.src = getPlaceholderSvg(item.name); }} />
                <button className="card-play-btn" type="button" title={`Play ${item.name}`} onClick={(event) => { event.stopPropagation(); playPlaylist(item); }}>▶</button>
              </div>
              <div className="playlist-card-info">
                <h2 className="playlist-title">{item.name}</h2>
                <p className="playlist-desc">{item.description || `${item.tracks.length} songs`}</p>
                <span className="playlist-meta">{item.tracks.length} {item.tracks.length === 1 ? 'track' : 'tracks'}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const totalMinutes = Math.round(currentPlaylist.tracks.reduce((sum, track) => sum + (track.duration_ms || 200000), 0) / 60000);

  return (
    <div className="view-playlist-detail animate-fade-in">
      <button className="btn btn-text back-btn" type="button" onClick={() => ui.switchView('playlists')}>Back to Playlists</button>
      <header className="playlist-header">
        <div className="playlist-header-cover"><img src={currentPlaylist.coverArt || getPlaceholderSvg(currentPlaylist.name)} alt="" /></div>
        <div className="playlist-header-info">
          <span className="playlist-type-badge">{currentPlaylist.isLiked ? 'SPECIAL COLLECTION' : 'PLAYLIST'}</span>
          <h1 className="playlist-header-title">{currentPlaylist.name}</h1>
          <p className="playlist-header-desc">{currentPlaylist.description}</p>
          <div className="playlist-header-meta"><span><strong>{currentPlaylist.tracks.length}</strong> songs</span><span>About {totalMinutes} min</span></div>
        </div>
      </header>

      <div className="playlist-action-bar">
        {currentPlaylist.tracks.length > 0 && <button className="btn btn-primary" type="button" onClick={() => playPlaylist(currentPlaylist)}>Play all</button>}
        {!currentPlaylist.isLiked && (
          <>
            <button className="btn btn-secondary" type="button" disabled={exporting} onClick={exportPlaylist}>
              {exporting ? 'Exporting…' : exported ? 'Exported to Spotify' : 'Export to Spotify'}
            </button>
            <button className="btn btn-danger-outline" type="button" onClick={() => {
              if (window.confirm(`Delete “${currentPlaylist.name}”?`)) {
                playlistStore.deletePlaylist(currentPlaylist.id);
                ui.showToast('Playlist deleted.', 'info');
              }
            }}>Delete playlist</button>
          </>
        )}
      </div>

      {currentPlaylist.tracks.length ? (
        <div className="track-table-wrapper">
          <table className="track-table">
            <thead><tr><th>#</th><th>Title</th><th>Artist</th><th>Album</th><th>Duration</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {currentPlaylist.tracks.map((track, index) => (
                <tr className="track-row" key={`${track.id || track.uri || track.name}-${index}`}>
                  <td><button className="row-play-btn" type="button" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, currentPlaylist.tracks)}>▶</button></td>
                  <td><div className="track-title-cell"><img className="track-thumb" src={track.image || getPlaceholderSvg(track.name)} alt="" /><span className="track-name">{track.name}</span></div></td>
                  <td><button className="artist-link" type="button" onClick={() => ui.openArtistByName(track.artist)}>{track.artist}</button></td>
                  <td>{track.album || '—'}</td>
                  <td>{formatTime((track.duration_ms || 210000) / 1000)}</td>
                  <td className="track-actions-group">
                    <button className="action-btn like-btn" type="button" title="Toggle liked song" onClick={() => playlistStore.toggleLikedTrack(track)}>♥</button>
                    <button className="action-btn add-pl-btn" type="button" title="Add to playlist" onClick={() => ui.openAddToPlaylistModal(track)}>＋</button>
                    <button className="action-btn remove-track-btn" type="button" title="Remove from playlist" onClick={() => playlistStore.removeTrackFromPlaylist(currentPlaylist.id, track.id || track.uri)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-playlist-box">
          <p>This playlist has no songs yet.</p>
          <button className="btn btn-secondary" type="button" onClick={() => ui.switchView('trending')}>Browse trending songs</button>
        </div>
      )}
    </div>
  );
}

export default PlaylistsView;