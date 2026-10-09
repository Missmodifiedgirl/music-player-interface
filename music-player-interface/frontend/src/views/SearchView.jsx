import React, { useEffect, useState } from 'react';
import { searchSpotify } from '../spotify-api.js';
import { getValidAccessToken } from '../spotify-auth.js';
import { BACKEND_API_BASE } from '../backend-api.js';
import { isAuthenticated } from '../spotify-auth.js';
import { getTrendingTracks } from '../lastfm-api.js';
import { getPlaceholderSvg } from '../utils.js';
import MusicLanguageSelect from '../MusicLanguageSelect.jsx';
import { addLanguageToSearch } from '../music-languages.js';

function SearchView({ ui, musicPlayer, playlistStore, query, activeFilter }) {
  const [filter, setFilter] = useState(activeFilter);
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [language, setLanguage] = useState('Any language');
  const authenticated = isAuthenticated();
  const [recommendedTracks, setRecommendedTracks] = useState([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState('');
  const [showRecommendationsFor, setShowRecommendationsFor] = useState(null);

  useEffect(() => setFilter(activeFilter), [activeFilter]);

  useEffect(() => {
    let active = true;

    if (!query.trim()) {
      setTracks([]);
      setArtists([]);
      setError('');
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError('');

    const loadResults = async () => {
      try {
        if (!authenticated) {
          const trending = await getTrendingTracks(1, 50);
          const normalizedQuery = query.trim().toLowerCase();
          const searchQuery = addLanguageToSearch(query, language).toLowerCase();
          const matches = trending.filter((track) =>
            `${track.name} ${track.artist}`.toLowerCase().includes(searchQuery)
          );
          if (active) {
            setTracks(matches);
            setArtists([]);
          }
          return;
        }

        const result = await searchSpotify(addLanguageToSearch(query, language), 'track,artist', 24);
        const nextTracks = (result.tracks?.items || []).map((track) => ({
          id: track.id,
          name: track.name,
          artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown Artist',
          album: track.album?.name || '',
          image: track.album?.images?.[0]?.url || getPlaceholderSvg(track.name),
          duration_ms: track.duration_ms,
          uri: track.uri,
          preview_url: track.preview_url,
          spotifyUrl: track.external_urls?.spotify,
          artistId: track.artists?.[0]?.id,
        }));
        const nextArtists = (result.artists?.items || []).map((artist) => ({
          id: artist.id,
          name: artist.name,
          image: artist.images?.[0]?.url || getPlaceholderSvg(artist.name),
          followers: artist.followers?.total || 0,
        }));
        if (active) {
          setTracks(nextTracks);
          setArtists(nextArtists);
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Search failed.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadResults();
    return () => { active = false; };
  }, [query, authenticated, retry, language]);

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    ui.activeSearchFilter = nextFilter;
  };

  async function fetchTransitionRecommendations(track) {
    setRecommendedTracks([]);
    setRecommendError('');
    setShowRecommendationsFor({ id: track.id, name: track.name });
    setIsRecommending(true);
    try {
      const token = await getValidAccessToken();
      const qp = new URLSearchParams({ track_id: track.id, name: track.name, artist: track.artist, limit: 20 });
      const res = await fetch(`${BACKEND_API_BASE}/transition-recommendations/?${qp.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Transition request failed (HTTP ${res.status})`);
      }
      const payload = await res.json();
      setRecommendedTracks(payload.tracks || []);
    } catch (err) {
      console.error('[SearchView] Transition recommendations failed:', err);
      setRecommendError(err.message || 'Could not fetch recommendations.');
    } finally {
      setIsRecommending(false);
    }
  }

  return (
    <div className="view-search animate-fade-in">
      <header className="search-view-header">
        <h1 className="view-title">Search</h1>
        <p className="section-desc">Search Spotify tracks and artists</p>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        <div className="filter-pills" role="group" aria-label="Search result type">
          {['all', 'tracks', 'artists'].map((item) => (
            <button
              className={`filter-pill ${filter === item ? 'active' : ''}`}
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => changeFilter(item)}
            >
              {item === 'all' ? 'All' : item === 'tracks' ? 'Tracks' : 'Artists'}
            </button>
          ))}
        </div>
      </header>

      <div className="react-search-results" aria-live="polite">
        {!query.trim() ? (
          <div className="search-empty-state">
            <h2>Discover your favorite music</h2>
            <p>Type in the search bar above to find songs and artists.</p>
            {!authenticated && (
              <button className="btn btn-spotify-connect" type="button" onClick={() => ui.openSpotifyConnectModal()}>
                Connect Spotify
              </button>
            )}
          </div>
        ) : loading ? (
          <p className="loading-state">Searching…</p>
        ) : error ? (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : (
          <>
            {!authenticated && (
              <div className="search-guest-banner">
                <div>
                  <strong>Connect Spotify for full search</strong>
                  <p>Showing matches from the local trending library.</p>
                </div>
                <button className="btn btn-spotify-connect" type="button" onClick={() => ui.openSpotifyConnectModal()}>
                  Connect Spotify
                </button>
              </div>
            )}
            {(filter === 'all' || filter === 'artists') && artists.length > 0 && (
              <section className="search-section">
                <h2 className="section-title">Artists</h2>
                <div className="artists-grid-compact">
                  {artists.slice(0, 6).map((artist) => (
                    <button className="artist-card-circle" key={artist.id} type="button" onClick={() => ui.openArtistByIdOrName(artist.id, artist.name)}>
                      <span className="artist-img-wrapper"><img src={artist.image} alt="" loading="lazy" /></span>
                      <span className="artist-name">{artist.name}</span>
                      <span className="artist-role">{artist.followers.toLocaleString()} followers</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {(filter === 'all' || filter === 'tracks') && tracks.length > 0 && (
              <section className="search-section">
                <h2 className="section-title">Songs <span>({tracks.length})</span></h2>
                <div className="react-search-track-list">
                  {tracks.map((track) => (
                    <article className="react-search-track" key={track.id}>
                      <img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
                      <div className="react-search-track__metadata">
                        <strong>{track.name}</strong>
                        <button type="button" onClick={() => ui.openArtistByIdOrName(track.artistId, track.artist)}>{track.artist}</button>
                      </div>
                      <span className="react-search-track__album">{track.album}</span>
                      <div className="react-search-track__actions">
                        <button className="icon-btn" type="button" title="Play track" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, tracks)}>▶</button>
                        <button className="icon-btn" type="button" title="Add to playlist" aria-label={`Add ${track.name} to a playlist`} onClick={() => ui.openAddToPlaylistModal(track)}>＋</button>
                        <button className="icon-btn" type="button" title="Like track" aria-label={`Like ${track.name}`} onClick={() => {
                          const liked = playlistStore.toggleLikedTrack(track);
                          ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
                        }}>♥</button>
                        <button className="icon-btn" type="button" title="Smooth transition" aria-label={`Smooth transition recommendations from ${track.name}`} onClick={() => void fetchTransitionRecommendations(track)}>⟲</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {showRecommendationsFor && (
              <section className="search-section">
                <h2 className="section-title">Smooth transition recommendations for "{showRecommendationsFor.name}"</h2>
                {isRecommending ? (
                  <p className="loading-state">Finding smooth transition songs…</p>
                ) : recommendError ? (
                  <div className="error-box">
                    <p>{recommendError}</p>
                  </div>
                ) : recommendedTracks.length ? (
                  <div className="react-search-track-list">
                    {recommendedTracks.map((rt) => (
                      <article className="react-search-track" key={`${rt.id}-${rt.source || 't'}`}>
                        <img src={rt.image || getPlaceholderSvg(rt.name)} alt="" loading="lazy" />
                        <div className="react-search-track__metadata">
                          <strong>{rt.name}</strong>
                          <button type="button" onClick={() => ui.openArtistByIdOrName(rt.artistId, rt.artist)}>{rt.artist}</button>
                        </div>
                        <span className="react-search-track__album">{rt.album}</span>
                        <div className="react-search-track__actions">
                          <button className="icon-btn" type="button" title="Play track" onClick={() => musicPlayer.playTrack(rt, recommendedTracks)}>▶</button>
                          <button className="icon-btn" type="button" title="Add to playlist" onClick={() => ui.openAddToPlaylistModal(rt)}>＋</button>
                          <button className="icon-btn" type="button" title="Like track" onClick={() => { const liked = playlistStore.toggleLikedTrack(rt); ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info'); }}>♥</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="search-empty-state">
                    <h3>No smooth transition recommendations found</h3>
                    <p>Try playing a different seed track or connecting Spotify for better recommendations.</p>
                  </div>
                )}
              </section>
            )}

            {tracks.length === 0 && artists.length === 0 && (
              <div className="search-empty-state">
                <h2>No results found for “{query}”</h2>
                <p>Try another song or artist name.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


  return (
    <div className="view-search animate-fade-in">
      <header className="search-view-header">
        <h1 className="view-title">Search</h1>
        <p className="section-desc">Search Spotify tracks and artists</p>
        <MusicLanguageSelect value={language} onChange={setLanguage} />
        <div className="filter-pills" role="group" aria-label="Search result type">
          {['all', 'tracks', 'artists'].map((item) => (
            <button
              className={`filter-pill ${filter === item ? 'active' : ''}`}
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => changeFilter(item)}
            >
              {item === 'all' ? 'All' : item === 'tracks' ? 'Tracks' : 'Artists'}
            </button>
          ))}
        </div>
      </header>

      <div className="react-search-results" aria-live="polite">
        {!query.trim() ? (
          <div className="search-empty-state">
            <h2>Discover your favorite music</h2>
            <p>Type in the search bar above to find songs and artists.</p>
            {!authenticated && (
              <button className="btn btn-spotify-connect" type="button" onClick={() => ui.openSpotifyConnectModal()}>
                Connect Spotify
              </button>
            )}
          </div>
        ) : loading ? (
          <p className="loading-state">Searching…</p>
        ) : error ? (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : (
          <>
            {!authenticated && (
              <div className="search-guest-banner">
                <div>
                  <strong>Connect Spotify for full search</strong>
                  <p>Showing matches from the local trending library.</p>
                </div>
                <button className="btn btn-spotify-connect" type="button" onClick={() => ui.openSpotifyConnectModal()}>
                  Connect Spotify
                </button>
              </div>
            )}
            {(filter === 'all' || filter === 'artists') && artists.length > 0 && (
              <section className="search-section">
                <h2 className="section-title">Artists</h2>
                <div className="artists-grid-compact">
                  {artists.slice(0, 6).map((artist) => (
                    <button className="artist-card-circle" key={artist.id} type="button" onClick={() => ui.openArtistByIdOrName(artist.id, artist.name)}>
                      <span className="artist-img-wrapper"><img src={artist.image} alt="" loading="lazy" /></span>
                      <span className="artist-name">{artist.name}</span>
                      <span className="artist-role">{artist.followers.toLocaleString()} followers</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {(filter === 'all' || filter === 'tracks') && tracks.length > 0 && (
              <section className="search-section">
                <h2 className="section-title">Songs <span>({tracks.length})</span></h2>
                <div className="react-search-track-list">
                  {tracks.map((track) => (
                    <article className="react-search-track" key={track.id}>
                      <img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
                      <div className="react-search-track__metadata">
                        <strong>{track.name}</strong>
                        <button type="button" onClick={() => ui.openArtistByIdOrName(track.artistId, track.artist)}>{track.artist}</button>
                      </div>
                      <span className="react-search-track__album">{track.album}</span>
                      <div className="react-search-track__actions">
                        <button className="icon-btn" type="button" title="Play track" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track, tracks)}>▶</button>
                        <button className="icon-btn" type="button" title="Add to playlist" aria-label={`Add ${track.name} to a playlist`} onClick={() => ui.openAddToPlaylistModal(track)}>＋</button>
                        <button className="icon-btn" type="button" title="Like track" aria-label={`Like ${track.name}`} onClick={() => {
                          const liked = playlistStore.toggleLikedTrack(track);
                          ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
                        }}>♥</button>
                        <button className="icon-btn" type="button" title="Smooth transition" aria-label={`Smooth transition recommendations from ${track.name}`} onClick={() => void fetchTransitionRecommendations(track)}>⟲</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {showRecommendationsFor && (
              <section className="search-section">
                <h2 className="section-title">Smooth transition recommendations for "{showRecommendationsFor.name}"</h2>
                {isRecommending ? (
                  <p className="loading-state">Finding smooth transition songs…</p>
                ) : recommendError ? (
                  <div className="error-box">
                    <p>{recommendError}</p>
                  </div>
                ) : recommendedTracks.length ? (
                  <div className="react-search-track-list">
                    {recommendedTracks.map((rt) => (
                      <article className="react-search-track" key={`${rt.id}-${rt.source || 't'}`}>
                        <img src={rt.image || getPlaceholderSvg(rt.name)} alt="" loading="lazy" />
                        <div className="react-search-track__metadata">
                          <strong>{rt.name}</strong>
                          <button type="button" onClick={() => ui.openArtistByIdOrName(rt.artistId, rt.artist)}>{rt.artist}</button>
                        </div>
                        <span className="react-search-track__album">{rt.album}</span>
                        <div className="react-search-track__actions">
                          <button className="icon-btn" type="button" title="Play track" onClick={() => musicPlayer.playTrack(rt, recommendedTracks)}>▶</button>
                          <button className="icon-btn" className="icon-btn" type="button" title="Add to playlist" onClick={() => ui.openAddToPlaylistModal(rt)}>＋</button>
                          <button className="icon-btn" type="button" title="Like track" onClick={() => { const liked = playlistStore.toggleLikedTrack(rt); ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info'); }}>♥</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="search-empty-state">
                    <h3>No smooth transition recommendations found</h3>
                    <p>Try playing a different seed track or connecting Spotify for better recommendations.</p>
                  </div>
                )}
              </section>
            )}

            {tracks.length === 0 && artists.length === 0 && (
              <div className="search-empty-state">
                <h2>No results found for “{query}”</h2>
                <p>Try another song or artist name.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchView;