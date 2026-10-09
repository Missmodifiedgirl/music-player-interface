import React, { useEffect, useRef, useState } from 'react';
import { backendApi } from '../../backend-api.js';
import { getValidAccessToken } from '../../spotify-auth.js';
import { getPlaceholderSvg } from '../../utils.js';
import './MusicThroughTime.css';

const MIN_YEAR = 1950;
const YEAR_LOOKAHEAD = 5;
const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEAR = CURRENT_YEAR + YEAR_LOOKAHEAD;
const PAGE_SIZE = 30;
const LANGUAGES = [
  'All Languages', 'Tamil', 'Malayalam', 'Telugu', 'Hindi', 'English',
  'Kannada', 'Bengali', 'Marathi', 'Punjabi', 'Spanish', 'French',
  'Korean', 'Japanese', 'Mandarin', 'Arabic', 'Urdu', 'Gujarati',
  'Portuguese', 'German', 'Italian', 'Russian', 'Thai', 'Turkish',
  'Indonesian', 'Other',
];
const ERAS = [
  { id: 'classic', label: '1950s–1970s', start: 1950, end: 1979, note: 'Golden-age classics', icon: '◷' },
  { id: 'eighties', label: '1980s', start: 1980, end: 1989, note: 'Synths & big choruses', icon: '▤' },
  { id: 'nineties', label: '1990s', start: 1990, end: 1999, note: 'A decade of discovery', icon: '✳' },
  { id: 'two-thousands', label: '2000s', start: 2000, end: 2009, note: 'New sounds, new scenes', icon: '▧' },
  { id: 'early-teens', label: '2010–2015', start: 2010, end: 2015, note: 'The streaming era begins', icon: '♫' },
  { id: 'late-teens', label: '2016–2020', start: 2016, end: 2020, note: 'Global sounds connect', icon: '◎' },
  { id: 'now', label: '2021–Present', start: 2021, end: CURRENT_YEAR, note: 'The sound of right now', icon: '✦' },
];

function initialFilters() {
  const era = ERAS[2];
  return {
    eraId: era.id,
    startYear: era.start,
    endYear: era.end,
    language: 'All Languages',
    artist: '',
    composer: '',
    movie: '',
    query: '',
  };
}

function trackKey(track) {
  return `${track.name || ''}::${track.artist || ''}`.trim().toLowerCase();
}

function mergeTracks(current, incoming) {
  const tracks = new Map(current.map((track) => [trackKey(track), track]));
  incoming.forEach((track) => {
    const key = trackKey(track);
    if (key && !tracks.has(key)) tracks.set(key, track);
  });
  return [...tracks.values()];
}

function MusicThroughTime({ musicPlayer, ui }) {
  const [filters, setFilters] = useState(initialFilters);
  const [tracks, setTracks] = useState([]);
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const nextOffset = useRef(0);
  const requestId = useRef(0);

  const buildRequestFilters = (selection, offset = 0) => ({
    start_year: selection.startYear,
    end_year: selection.endYear,
    language: selection.language === 'All Languages' ? '' : selection.language,
    artist: selection.artist.trim(),
    composer: selection.composer.trim(),
    movie: selection.movie.trim(),
    query: selection.query.trim(),
    offset,
    limit: PAGE_SIZE,
  });

  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      setTracks([]);
      setSources(null);
      setHasMore(false);
      nextOffset.current = 0;
      try {
        const token = await getValidAccessToken();
        const result = await backendApi.getMusicThroughTime(buildRequestFilters(filters), token);
        if (id !== requestId.current) return;
        setTracks(result.tracks || []);
        setSources(result.sources || null);
        setHasMore(Boolean(result.has_more));
        nextOffset.current = PAGE_SIZE;
      } catch (requestError) {
        if (id !== requestId.current) return;
        console.error('[MusicThroughTime] Recommendation request failed:', requestError);
        setError(requestError.message || 'Music search failed. Please try again.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [filters, retry]);

  const selectEra = (era) => {
    setValidationError('');
    setFilters((previous) => ({
      ...previous,
      eraId: era.id,
      startYear: era.start,
      endYear: Math.min(era.end, MAX_YEAR),
    }));
  };

  const updateYear = (key, value) => {
    setFilters((previous) => ({ ...previous, eraId: 'custom', [key]: value }));
    setValidationError('');
  };

  const validateRange = (event) => {
    event.preventDefault();
    const start = Number(filters.startYear);
    const end = Number(filters.endYear);
    if (!Number.isInteger(start) || !Number.isInteger(end)
      || start < MIN_YEAR || end > MAX_YEAR || start > end) {
      setValidationError(`Choose whole years from ${MIN_YEAR} to ${MAX_YEAR}, with the start year no later than the end year.`);
      return;
    }
    setValidationError('');
    setRetry((value) => value + 1);
  };

  const clearAdvancedFilters = () => {
    const era = ERAS.find((item) => item.id === filters.eraId) || ERAS[2];
    setValidationError('');
    setFilters((previous) => ({
      ...previous,
      eraId: era.id,
      startYear: era.start,
      endYear: Math.min(era.end, MAX_YEAR),
      language: 'All Languages',
      artist: '',
      composer: '',
      movie: '',
      query: '',
    }));
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const token = await getValidAccessToken();
      const result = await backendApi.getMusicThroughTime(
        buildRequestFilters(filters, nextOffset.current),
        token,
      );
      setTracks((previous) => mergeTracks(previous, result.tracks || []));
      setSources(result.sources || sources);
      setHasMore(Boolean(result.has_more));
      nextOffset.current += PAGE_SIZE;
    } catch (requestError) {
      console.error('[MusicThroughTime] Could not load more tracks:', requestError);
      setError(requestError.message || 'Could not load more tracks.');
    } finally {
      setLoadingMore(false);
    }
  };

  const playTrack = async (track) => {
    if (!track.uri && !track.preview_url) {
      ui?.showToast?.('This result does not have a playable Spotify URI or preview.', 'warning');
      return;
    }
    try {
      await musicPlayer?.playTrack?.(track, tracks);
    } catch (playError) {
      console.error('[MusicThroughTime] Playback failed:', playError);
      ui?.showToast?.(playError.message || 'This track could not be played. Check your Spotify connection or active player.', 'error');
    }
  };

  const sourceMessages = sources
    ? Object.entries(sources).filter(([, source]) => source.error).map(([name, source]) => ({
      name: name === 'lastfm' ? 'Last.fm' : 'Spotify',
      error: source.error,
    }))
    : [];
  const bothSourcesFailed = sources
    && Object.values(sources).every((source) => !source.available);

  return (
    <main className="music-through-time">
      <header className="music-through-time__hero">
        <div className="music-through-time__hero-copy">
          <span className="music-through-time__eyebrow">MELODIXA · A SOUNDTRACK THROUGH THE YEARS</span>
          <h1>Music Through <em>Time</em></h1>
          <p>Follow the songs, voices, and albums that shaped every generation. Choose an era to begin exploring.</p>
          <span className="music-through-time__hero-note"><i /> REAL CATALOG RESULTS · NO MADE-UP TRACKS</span>
        </div>
        <div className="music-through-time__hero-art" aria-hidden="true">
          <div className="music-through-time__vinyl"><i /><b>♫</b></div>
          <span className="music-through-time__orbit music-through-time__orbit--one">1950</span>
          <span className="music-through-time__orbit music-through-time__orbit--two">{CURRENT_YEAR}</span>
          <span className="music-through-time__orbit music-through-time__orbit--three">♫</span>
        </div>
      </header>

      <section className="music-through-time__section">
        <div className="music-through-time__section-title">
          <div><span>01 / PICK A GENERATION</span><h2>Choose your era</h2></div>
          <span>Scroll through the decades</span>
        </div>
        <div className="music-through-time__era-grid">
          {ERAS.map((era, index) => (
            <button
              type="button"
              key={era.id}
              className={`music-through-time__era-card music-through-time__era-card--${index} ${filters.eraId === era.id ? 'is-selected' : ''}`}
              aria-pressed={filters.eraId === era.id}
              onClick={() => selectEra(era)}
            >
              <span className="music-through-time__era-icon">{era.icon}</span>
              <strong>{era.label}</strong>
              <small>{era.note}</small>
              <i>{filters.eraId === era.id ? 'SELECTED' : 'EXPLORE'} ↗</i>
            </button>
          ))}
        </div>
      </section>

      <section className="music-through-time__filters">
        <div className="music-through-time__section-title">
          <div><span>02 / MAKE IT YOURS</span><h2>Refine the search</h2></div>
          <button type="button" onClick={clearAdvancedFilters}>Clear filters</button>
        </div>
        <form onSubmit={validateRange}>
          <label className="music-through-time__field music-through-time__field--query">
            <span>Search songs, artists, albums</span>
            <input value={filters.query} onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} placeholder="Try a song title or a sound…" />
          </label>
          <label className="music-through-time__field">
            <span>Language</span>
            <select value={filters.language} onChange={(event) => setFilters((value) => ({ ...value, language: event.target.value }))}>
              {LANGUAGES.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          <label className="music-through-time__field">
            <span>Artist / singer</span>
            <input value={filters.artist} onChange={(event) => setFilters((value) => ({ ...value, artist: event.target.value }))} placeholder="Artist or singer" />
          </label>
          <label className="music-through-time__field">
            <span>Composer <small>provider search hint</small></span>
            <input value={filters.composer} onChange={(event) => setFilters((value) => ({ ...value, composer: event.target.value }))} placeholder="Composer name" />
          </label>
          <label className="music-through-time__field">
            <span>Movie / soundtrack <small>provider search hint</small></span>
            <input value={filters.movie} onChange={(event) => setFilters((value) => ({ ...value, movie: event.target.value }))} placeholder="Movie or soundtrack" />
          </label>
          <fieldset className="music-through-time__years">
            <legend>Release year range</legend>
            <label><span>From</span><input type="number" min={MIN_YEAR} max={MAX_YEAR} value={filters.startYear} onChange={(event) => updateYear('startYear', event.target.value)} /></label>
            <span aria-hidden="true">—</span>
            <label><span>To</span><input type="number" min={MIN_YEAR} max={MAX_YEAR} value={filters.endYear} onChange={(event) => updateYear('endYear', event.target.value)} /></label>
          </fieldset>
          <button className="music-through-time__search-button" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Find songs'} <span>↗</span></button>
        </form>
        <p className="music-through-time__metadata-note">Spotify and Last.fm do not provide reliable track-language or composer/movie credits. Language, composer, and movie are search hints; years are only shown when returned release metadata supports them.</p>
        {validationError && <p className="music-through-time__error" role="alert">{validationError}</p>}
      </section>

      <section className="music-through-time__results" aria-live="polite">
        <div className="music-through-time__section-title">
          <div><span>03 / YOUR LISTENING TRAIL</span><h2>{filters.startYear}–{filters.endYear} discoveries</h2></div>
          {!loading && <span>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'} found</span>}
        </div>
        {sourceMessages.length > 0 && (
          <div className="music-through-time__source-notices" role="status">
            {sourceMessages.map(({ name, error: sourceError }) => <p key={name}><strong>{name}:</strong> {sourceError}</p>)}
          </div>
        )}
        {loading ? (
          <div className="music-through-time__loading"><span /><strong>Turning the dial…</strong><small>Searching real music catalogs for your selection.</small></div>
        ) : error ? (
          <div className="music-through-time__empty" role="alert"><span>!</span><h3>We couldn’t complete that search</h3><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry search</button></div>
        ) : bothSourcesFailed ? (
          <div className="music-through-time__empty" role="alert"><span>!</span><h3>Music catalogs are unavailable</h3><p>Check the source messages above, then retry when the connection or API credentials are available.</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry search</button></div>
        ) : tracks.length ? (
          <>
            <div className="music-through-time__track-grid">
              {tracks.map((track, index) => (
                <article className="music-through-time__track-card" key={trackKey(track) || `${track.id}-${index}`}>
                  <div className="music-through-time__artwork">
                    <img src={track.image || getPlaceholderSvg(track.name)} alt={`${track.album || track.name} artwork`} loading="lazy" />
                    <span>{track.release_year}</span>
                  </div>
                  <div className="music-through-time__track-copy">
                    <h3 title={track.name}>{track.name}</h3>
                    <p>{track.artist || 'Artist information unavailable'}</p>
                    <dl>
                      <div><dt>Album</dt><dd>{track.album || 'Not provided'}</dd></div>
                      <div><dt>Composer</dt><dd>{track.composer || 'Credit unavailable'}</dd></div>
                    </dl>
                  </div>
                  <div className="music-through-time__track-actions">
                    <button type="button" onClick={() => void playTrack(track)} disabled={!track.uri && !track.preview_url} title={track.uri || track.preview_url ? 'Play using Melodixa player' : 'No playable Spotify URI or preview is available'}>▶ <span>{track.uri || track.preview_url ? 'Play' : 'Unavailable'}</span></button>
                    <button type="button" onClick={() => ui?.openAddToPlaylistModal?.(track)}>＋ <span>Add to playlist</span></button>
                  </div>
                </article>
              ))}
            </div>
            {hasMore && <div className="music-through-time__more"><button type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more songs'}</button></div>}
          </>
        ) : (
          <div className="music-through-time__empty">
            <span>♫</span><h3>No matching songs in this search</h3>
            <p>Try a broader year range or clear an artist, composer, movie, or language hint. Tracks without a provider release year are omitted instead of being assigned an estimated date.</p>
            <button type="button" onClick={clearAdvancedFilters}>Clear filters</button>
          </div>
        )}
      </section>
      <footer className="music-through-time__footer">A journey through music, powered by live Spotify and Last.fm catalog searches.</footer>
    </main>
  );
}

export default MusicThroughTime;
