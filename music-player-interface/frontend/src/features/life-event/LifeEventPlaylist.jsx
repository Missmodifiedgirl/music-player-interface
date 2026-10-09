import React, { useMemo, useState } from 'react';
import { findTracks } from '../song-search.js';
import { getPlaceholderSvg } from '../../utils.js';
import MusicLanguageSelect from '../../MusicLanguageSelect.jsx';
import { MUSIC_LANGUAGES } from '../../music-languages.js';

const STORAGE_KEY = 'melodixa-life-events';
const EVENT_TYPES = ['Birthday', 'Engagement', 'Wedding', 'Graduation', 'Travel', 'Celebration', 'College Event', 'Achievement', 'Party'];
const STYLES = ['Romantic', 'Pop', 'Indie', 'R&B', 'Bollywood', 'Acoustic', 'Electronic', 'Jazz', 'Classical', 'Mixed'];
const MOODS = ['Elegant', 'Joyful', 'Romantic', 'Uplifting', 'Laid-back', 'High-energy', 'Nostalgic'];
const LANGUAGES = MUSIC_LANGUAGES;
const STAGE_PRESETS = [
  { id: 'welcome', name: 'Welcome', subtitle: 'Soft & elegant', query: 'soft elegant welcoming' },
  { id: 'main', name: 'Main Event', subtitle: 'The heart of the occasion', query: 'romantic heartfelt' },
  { id: 'celebration', name: 'Celebration', subtitle: 'Raise a glass', query: 'happy celebratory' },
  { id: 'dance', name: 'Dance', subtitle: 'Bring the room to life', query: 'energetic dance party' },
  { id: 'wind-down', name: 'Wind Down', subtitle: 'End on a high note', query: 'calm acoustic mellow' },
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readEvents() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && Array.isArray(item.stages)) : [];
  } catch (error) {
    console.warn('Could not read Life Event plans:', error);
    return [];
  }
}

function toDateInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
  if (!date) return 'Date to be decided';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function durationLabel(milliseconds = 0) {
  const seconds = Math.floor((milliseconds || 0) / 1000);
  if (!seconds) return '--:--';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getCountdown(date) {
  const target = new Date(`${date}T00:00:00`);
  const difference = Math.ceil((target.getTime() - new Date(`${toDateInput()}T00:00:00`).getTime()) / 86400000);
  if (difference < 0) return 'Event day has passed';
  if (difference === 0) return 'It’s event day!';
  if (difference === 1) return '1 day to go';
  return `${difference} days to go`;
}

function initialStages() {
  return STAGE_PRESETS.map((stage) => ({ ...stage, tracks: [] }));
}

function Icon({ name, size = 16 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'play') return <svg {...props}><path d="m8 5 12 7-12 7V5Z" /></svg>;
  if (name === 'search') return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === 'calendar') return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === 'clock') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'music') return <svg {...props}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === 'arrow') return <svg {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === 'up') return <svg {...props}><path d="m6 14 6-6 6 6" /></svg>;
  if (name === 'down') return <svg {...props}><path d="m6 10 6 6 6-6" /></svg>;
  if (name === 'replace') return <svg {...props}><path d="M20 7h-7a4 4 0 0 0-4 4v6" /><path d="m5 14 4 4 4-4M4 7h3" /></svg>;
  if (name === 'close') return <svg {...props}><path d="m18 6-12 12M6 6l12 12" /></svg>;
  return <svg {...props}><path d="M12 5v14m-7-7h14" /></svg>;
}

function EventForm({ initialEvent, onCancel, onSave }) {
  const [name, setName] = useState(initialEvent?.name || '');
  const [date, setDate] = useState(initialEvent?.date || toDateInput());
  const [type, setType] = useState(initialEvent?.type || EVENT_TYPES[0]);
  const [style, setStyle] = useState(initialEvent?.style || 'Romantic');
  const [mood, setMood] = useState(initialEvent?.mood || 'Joyful');
  const [energy, setEnergy] = useState(initialEvent?.energy ?? 55);
  const [duration, setDuration] = useState(initialEvent?.duration || 4);
  const [language, setLanguage] = useState(initialEvent?.language || 'Any language');

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...(initialEvent || {}),
      id: initialEvent?.id || makeId(),
      name: name.trim(),
      date,
      type,
      style,
      mood,
      energy: Number(energy),
      duration: Number(duration),
      language,
      stages: initialEvent?.stages || initialStages(),
      createdAt: initialEvent?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="life-event__form-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="life-event__form-panel" role="dialog" aria-modal="true" aria-labelledby="life-event-form-title">
        <button className="life-event__form-close" type="button" aria-label="Close event form" onClick={onCancel}><Icon name="close" /></button>
        <span className="life-event__eyebrow">{initialEvent ? 'REFINE THE PLAN' : 'MAKE IT A DAY TO REMEMBER'}</span>
        <h2 id="life-event-form-title">{initialEvent ? 'Edit your event' : 'Plan your occasion'}</h2>
        <p>Set the scene. We’ll give your music a flow that feels right from the first hello to the last song.</p>
        <form className="life-event__form" onSubmit={submit}>
          <label className="life-event__field"><span>Event name</span><input className="input-field" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Maya & Arjun’s engagement" maxLength={80} required /></label>
          <div className="life-event__form-grid">
            <label className="life-event__field"><span>Event date</span><input className="input-field" type="date" min={toDateInput()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="life-event__field"><span>What are we celebrating?</span><select className="input-field" value={type} onChange={(event) => setType(event.target.value)}>{EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="life-event__field"><span>Music style</span><select className="input-field" value={style} onChange={(event) => setStyle(event.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="life-event__field"><span>Overall mood</span><select className="input-field" value={mood} onChange={(event) => setMood(event.target.value)}>{MOODS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="life-event__field"><span>Language preference</span><select className="input-field" value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="life-event__field"><span>Event duration <strong>{duration} hours</strong></span><input type="range" min="1" max="12" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
          <label className="life-event__field"><span>Energy <strong>{energy < 34 ? 'Low & easy' : energy < 68 ? 'Medium & warm' : 'High & electric'}</strong></span><div className="life-event__energy-labels"><span>Low key</span><span>Bring the energy</span></div><input type="range" min="0" max="100" value={energy} onChange={(event) => setEnergy(event.target.value)} /></label>
          <div className="life-event__form-actions"><button className="life-event__cancel" type="button" onClick={onCancel}>Cancel</button><button className="life-event__save" type="submit">{initialEvent ? 'Save event details' : 'Build my music flow'} <Icon name="arrow" size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}

function StageSearch({ event, stage, onAdd, onClose, replacing }) {
  const defaultQuery = `${event.style} ${stage.query} ${event.mood}`.trim();
  const [query, setQuery] = useState(defaultQuery);
  const [language, setLanguage] = useState(event.language || 'Any language');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (formEvent) => {
    formEvent.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      setResults(await findTracks(query.trim(), language));
    } catch (requestError) {
      setError(requestError.message || 'Could not search for songs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="life-event__stage-search">
      <form onSubmit={search}><Icon name="search" size={15} /><input aria-label={`Search songs for ${stage.name}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Find songs for ${stage.name}`} /><button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button><button className="life-event__search-close" type="button" aria-label="Close song search" onClick={onClose}><Icon name="close" size={15} /></button></form>
      <MusicLanguageSelect value={language} onChange={setLanguage} />
      {error && <p className="life-event__search-error" role="alert">{error}</p>}
      {results.length > 0 && <div className="life-event__search-results">{results.map((track, index) => <div className="life-event__result" key={track.id || `${track.name}-${index}`}><img src={track.image || getPlaceholderSvg(track.name)} alt="" /><span><strong>{track.name}</strong><small>{track.artist}</small></span><button type="button" onClick={() => onAdd(track)}><Icon name={replacing ? 'replace' : 'plus'} size={14} />{replacing ? 'Replace' : 'Add'}</button></div>)}</div>}
      {!loading && !error && !results.length && <p className="life-event__search-hint">Search Spotify for songs that fit this moment in your event.</p>}
    </div>
  );
}

function SongRow({ track, stage, index, onPlay, onRemove, onMove, onReplace }) {
  return (
    <article className="life-event__song">
      <span className="life-event__song-index">{String(index + 1).padStart(2, '0')}</span>
      <img src={track.image || getPlaceholderSvg(track.name)} alt={`${track.name} album artwork`} loading="lazy" />
      <span className="life-event__song-meta"><strong>{track.name}</strong><small>{track.artist}</small></span>
      <span className="life-event__song-duration">{durationLabel(track.duration_ms)}</span>
      <div className="life-event__song-actions">
        <button type="button" aria-label={`Play ${track.name}`} title="Play" onClick={() => onPlay(track, stage.tracks)}><Icon name="play" size={14} /></button>
        <button type="button" aria-label={`Move ${track.name} up`} title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" size={14} /></button>
        <button type="button" aria-label={`Move ${track.name} down`} title="Move down" onClick={() => onMove(1)}><Icon name="down" size={14} /></button>
        <button type="button" aria-label={`Replace ${track.name}`} title="Replace" onClick={onReplace}><Icon name="replace" size={14} /></button>
        <button type="button" aria-label={`Remove ${track.name}`} title="Remove" onClick={onRemove}><Icon name="close" size={14} /></button>
      </div>
    </article>
  );
}

export default function LifeEventPlaylist({ musicPlayer, ui }) {
  const [events, setEvents] = useState(readEvents);
  const [activeId, setActiveId] = useState(events[0]?.id || '');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchStageId, setSearchStageId] = useState('');
  const [replaceTrackIndex, setReplaceTrackIndex] = useState(null);

  const activeEvent = events.find((item) => item.id === activeId) || events[0] || null;
  const upcomingEvents = useMemo(() => [...events].filter((event) => event.date >= toDateInput()).sort((a, b) => a.date.localeCompare(b.date)), [events]);
  const allTracks = activeEvent?.stages.flatMap((stage) => stage.tracks) || [];
  const stageCount = activeEvent?.stages.filter((stage) => stage.tracks.length > 0).length || 0;
  const progress = activeEvent ? Math.round((stageCount / activeEvent.stages.length) * 100) : 0;

  const persist = (nextEvents) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
      setEvents(nextEvents);
      return true;
    } catch (error) {
      console.error('Could not save Life Event plans:', error);
      ui?.showToast?.('Your event plan could not be saved. Check your browser storage and try again.', 'error');
      return false;
    }
  };

  const saveEvent = (event) => {
    const isNew = !events.some((item) => item.id === event.id);
    const nextEvents = isNew ? [...events, event] : events.map((item) => item.id === event.id ? event : item);
    if (persist(nextEvents)) {
      setActiveId(event.id);
      setFormOpen(false);
      setEditingEvent(null);
      ui?.showToast?.(isNew ? 'Your event plan is ready to build.' : 'Event details updated.', 'success');
    }
  };

  const updateStage = (stageId, updater) => {
    if (!activeEvent) return;
    persist(events.map((event) => event.id !== activeEvent.id ? event : {
      ...event,
      stages: event.stages.map((stage) => stage.id === stageId ? updater(stage) : stage),
    }));
  };

  const addTrack = (stage, track) => {
    const normalized = {
      ...track,
      id: track.id || track.uri || `${track.name}-${track.artist}`,
      image: track.image || getPlaceholderSvg(track.name),
      artist: track.artist || 'Unknown artist',
    };
    if (replaceTrackIndex !== null) {
      updateStage(stage.id, (item) => ({ ...item, tracks: item.tracks.map((song, index) => index === replaceTrackIndex ? normalized : song) }));
    } else {
      updateStage(stage.id, (item) => ({ ...item, tracks: [...item.tracks, normalized] }));
    }
    setReplaceTrackIndex(null);
    setSearchStageId('');
  };

  const playSongs = async (track, songs = allTracks) => {
    try {
      await musicPlayer?.playTrack(track, songs);
    } catch (error) {
      console.error('Could not start event music:', error);
      ui?.showToast?.('Music playback could not be started right now.', 'error');
    }
  };

  const startEvent = () => {
    if (!activeEvent) return ui?.showToast?.('Create an event and add songs to its flow first.', 'warning');
    if (!allTracks.length) return ui?.showToast?.('Add at least one song before starting Event Mode.', 'warning');
    void playSongs(allTracks[0], allTracks);
    ui?.showToast?.(`Event Mode started · ${activeEvent.name}`, 'success');
  };

  const deleteEvent = () => {
    if (!activeEvent || !window.confirm(`Delete the plan for “${activeEvent.name}”?`)) return;
    const nextEvents = events.filter((event) => event.id !== activeEvent.id);
    if (persist(nextEvents)) {
      setActiveId(nextEvents[0]?.id || '');
      ui?.showToast?.('Event plan deleted.', 'success');
    }
  };

  return (
    <main className="life-event">
      <header className="life-event__header">
        <div className="life-event__brand"><span className="life-event__brand-icon"><Icon name="music" size={16} /></span><span>MELODIXA <i>/</i> LIFE EVENT</span></div>
        <div className="life-event__header-actions">
          {activeEvent && <button className="life-event__edit-event" type="button" onClick={() => { setEditingEvent(activeEvent); setFormOpen(true); }}>Edit event</button>}
          <button className="life-event__create-button" type="button" onClick={() => { setEditingEvent(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Plan an event</button>
        </div>
      </header>

      <section className="life-event__hero">
        <div className="life-event__hero-copy">
          <span className="life-event__eyebrow">THE MOMENTS THAT DESERVE A SOUNDTRACK</span>
          <h1>Make it a day<br />that <em>sounds like you.</em></h1>
          <p>Plan the music around your occasion — from the first arrival to the final song.</p>
          {!activeEvent && <button className="life-event__hero-button" type="button" onClick={() => setFormOpen(true)}>Plan your first event <Icon name="arrow" size={15} /></button>}
          <div className="life-event__journey"><span>Life event</span><i /><span>Plan the occasion</span><i /><span>Build the music flow</span><i /><strong>Enjoy the event</strong></div>
        </div>
        <div className="life-event__hero-visual" aria-hidden="true">
          <div className="life-event__hero-disc"><span /></div>
          <div className="life-event__hero-tile life-event__hero-tile--one">01 <b>THE ARRIVAL</b><small>Soft &amp; elegant</small></div>
          <div className="life-event__hero-tile life-event__hero-tile--two">04 <b>THE DANCE</b><small>Turn it up</small></div>
          <span className="life-event__hero-star">✳</span>
        </div>
      </section>

      {activeEvent ? (
        <section className="life-event__workspace">
          <aside className="life-event__event-sidebar">
            <div className="life-event__event-summary">
              <span className="life-event__eyebrow">YOUR NEXT CHAPTER</span>
              <h2>{activeEvent.name}</h2>
              <div className="life-event__date"><Icon name="calendar" size={15} />{formatDate(activeEvent.date)}</div>
              <div className="life-event__countdown"><span>COUNTING DOWN</span><strong>{getCountdown(activeEvent.date)}</strong></div>
              <div className="life-event__summary-tags"><span>{activeEvent.type}</span><span>{activeEvent.style}</span><span>{activeEvent.mood}</span></div>
            </div>
            <div className="life-event__progress">
              <div><span>PREPARATION</span><strong>{progress}%</strong></div>
              <div className="life-event__progress-track"><i style={{ width: `${progress}%` }} /></div>
              <small>{stageCount} of {activeEvent.stages.length} moments have music</small>
              <button type="button" onClick={() => { setEditingEvent(activeEvent); setFormOpen(true); }}>Tune event details <Icon name="arrow" size={13} /></button>
            </div>
            <button className="life-event__start" type="button" onClick={startEvent}><span className="life-event__start-icon"><Icon name="play" size={18} /></span><span><strong>Start Event Mode</strong><small>Play your full music flow</small></span><Icon name="arrow" size={15} /></button>
            <div className="life-event__upcoming">
              <div className="life-event__upcoming-heading"><span>UPCOMING EVENTS</span><button type="button" aria-label="Create event" onClick={() => { setEditingEvent(null); setFormOpen(true); }}><Icon name="plus" size={14} /></button></div>
              {upcomingEvents.map((event) => <button className={`life-event__upcoming-item ${event.id === activeEvent.id ? 'is-active' : ''}`} key={event.id} type="button" onClick={() => setActiveId(event.id)}><span className="life-event__upcoming-date"><strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong><small>{new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</small></span><span><strong>{event.name}</strong><small>{event.type}</small></span><Icon name="arrow" size={14} /></button>)}
            </div>
            <button className="life-event__delete-event" type="button" onClick={deleteEvent}>Delete this event plan</button>
          </aside>

          <div className="life-event__flow">
            <div className="life-event__flow-heading">
              <div><span className="life-event__eyebrow">MADE FOR THIS MOMENT</span><h2>Your music flow</h2><p>{activeEvent.style} <i>·</i> {activeEvent.mood} <i>·</i> {activeEvent.energy < 34 ? 'Low' : activeEvent.energy < 68 ? 'Medium' : 'High'} → {activeEvent.energy < 34 ? 'Medium' : 'High'} energy <i>·</i> {activeEvent.language}</p></div>
              <span className="life-event__duration"><Icon name="clock" size={15} /> {activeEvent.duration}h event</span>
            </div>

            <div className="life-event__stages">
              {activeEvent.stages.map((stage, stageIndex) => (
                <section className={`life-event__stage ${stage.tracks.length ? 'has-tracks' : ''}`} key={stage.id}>
                  <div className="life-event__stage-rail"><span>{String(stageIndex + 1).padStart(2, '0')}</span><i /></div>
                  <div className="life-event__stage-body">
                    <header className="life-event__stage-heading"><div><h3>{stage.name}</h3><p>{stage.subtitle}</p></div><div className="life-event__stage-heading-actions">{stage.tracks.length > 0 && <button type="button" onClick={() => void playSongs(stage.tracks[0], stage.tracks)}><Icon name="play" size={13} /> Play stage</button>}<button className="life-event__add-song" type="button" onClick={() => { setSearchStageId(searchStageId === stage.id ? '' : stage.id); setReplaceTrackIndex(null); }}><Icon name="plus" size={14} /> Add songs</button></div></header>
                    {stage.tracks.length > 0 ? <div className="life-event__songs">{stage.tracks.map((track, index) => <SongRow key={`${track.id}-${index}`} track={track} stage={stage} index={index} onPlay={playSongs} onRemove={() => updateStage(stage.id, (item) => ({ ...item, tracks: item.tracks.filter((_, songIndex) => songIndex !== index) }))} onMove={(direction) => updateStage(stage.id, (item) => { const tracks = [...item.tracks]; const target = index + direction; if (target < 0 || target >= tracks.length) return item; [tracks[index], tracks[target]] = [tracks[target], tracks[index]]; return { ...item, tracks }; })} onReplace={() => { setReplaceTrackIndex(index); setSearchStageId(stage.id); }} />)}</div> : <button className="life-event__stage-empty" type="button" onClick={() => { setSearchStageId(stage.id); setReplaceTrackIndex(null); }}><span><Icon name="plus" size={15} /></span><span><strong>Give this moment a soundtrack</strong><small>Find songs that fit your {stage.name.toLowerCase()}.</small></span><Icon name="arrow" size={14} /></button>}
                    {searchStageId === stage.id && <StageSearch key={`${activeEvent.id}-${stage.id}-${replaceTrackIndex}`} event={activeEvent} stage={stage} replacing={replaceTrackIndex !== null} onAdd={(track) => addTrack(stage, track)} onClose={() => { setSearchStageId(''); setReplaceTrackIndex(null); }} />}
                  </div>
                </section>
              ))}
            </div>
            {!allTracks.length && <p className="life-event__flow-note">Your occasion, your order. Add a few songs to start shaping the day.</p>}
          </div>
        </section>
      ) : (
        <section className="life-event__empty-events">
          <span><Icon name="calendar" size={21} /></span><h2>No events on the calendar yet</h2><p>Build a soundtrack with a beginning, a high point, and the perfect last song.</p><button type="button" onClick={() => setFormOpen(true)}>Plan your first event <Icon name="arrow" size={14} /></button>
        </section>
      )}
      <footer className="life-event__footer">A good day has a rhythm. <strong>Give yours a soundtrack.</strong></footer>
      {formOpen && <EventForm initialEvent={editingEvent} onCancel={() => { setFormOpen(false); setEditingEvent(null); }} onSave={saveEvent} />}
    </main>
  );
}
