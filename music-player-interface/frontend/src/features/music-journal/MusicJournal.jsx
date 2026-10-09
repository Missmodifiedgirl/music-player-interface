import React, { useEffect, useMemo, useState } from 'react';
import { getPlaceholderSvg } from '../../utils.js';
import { addJournalEntry, getJournalEntries, getJournalTrack, updateJournalEntry } from './journal-store.js';

const moods = ['Happy', 'Calm', 'Sad', 'Loved', 'Relaxed', 'Angry', 'Hopeful', 'Nostalgic', 'Focused', 'Tired'];
const moodEmojis = {
  Happy: '😊',
  Calm: '😌',
  Sad: '😔',
  Loved: '😍',
  Relaxed: '😴',
  Angry: '😡',
  Hopeful: '🌤️',
  Nostalgic: '💭',
  Focused: '🎯',
  Tired: '🥱',
};

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.floor((seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function MusicJournal({ musicPlayer, ui }) {
  const [entries, setEntries] = useState(getJournalEntries);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [mood, setMood] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const refreshEntries = () => setEntries(getJournalEntries());
    window.addEventListener('music-journal-updated', refreshEntries);
    return () => window.removeEventListener('music-journal-updated', refreshEntries);
  }, []);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const entriesByDate = useMemo(() => {
    return entries.reduce((grouped, entry) => {
      if (entry.date) grouped[entry.date] = [...(grouped[entry.date] || []), entry];
      return grouped;
    }, {});
  }, [entries]);

  const dayEntries = entriesByDate[selectedDate] || [];
  const listenedEntries = dayEntries.filter((entry) => entry.track);
  const totalSeconds = dayEntries.reduce((total, entry) => total + (entry.listeningSeconds || 0), 0);
  const trackCounts = listenedEntries.reduce((counts, entry) => {
    const name = entry.track.name || 'Unknown track';
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const favoriteTrack = Object.entries(trackCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const moodCounts = dayEntries.reduce((counts, entry) => {
    if (entry.mood) counts[entry.mood] = (counts[entry.mood] || 0) + 1;
    return counts;
  }, {});
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sortedEntries = [...dayEntries].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
  const activeTrack = musicPlayer.currentTrack;
  const currentDate = new Date();

  const changeMonth = (offset) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const saveNote = (event) => {
    event.preventDefault();
    if (!note.trim() && !mood && !location.trim()) return;
    addJournalEntry({
      date: selectedDate,
      track: getJournalTrack(activeTrack),
      mood,
      location: location.trim(),
      note: note.trim(),
      playedAt: new Date().toISOString(),
    });
    setMood('');
    setLocation('');
    setNote('');
    ui?.showToast('Journal entry saved.', 'success');
  };

  const updateEntryMood = (entry, nextMood) => {
    updateJournalEntry(entry.id, { mood: nextMood });
  };

  return (
    <main className="music-journal">
      <header className="music-journal__header">
        <div>
          <span className="music-journal__eyebrow">MELODIXA · YOUR LISTENING DIARY</span>
          <h1>Music Journal</h1>
          <p>A little record of the songs, moments, and moods that make up your days.</p>
        </div>
        <div className="music-journal__today">
          <span>Today</span>
          <strong>{currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
        </div>
      </header>

      <section className="music-journal__stats" aria-label="Listening summary">
        <article className="music-journal__stat">
          <span className="music-journal__stat-icon">🎵</span>
          <div><strong>{listenedEntries.length}</strong><span>Songs listened</span></div>
        </article>
        <article className="music-journal__stat">
          <span className="music-journal__stat-icon">⏱️</span>
          <div><strong>{formatDuration(totalSeconds)}</strong><span>Listening time</span></div>
        </article>
        <article className="music-journal__stat music-journal__stat--favorite">
          <span className="music-journal__stat-icon">❤️</span>
          <div><strong>{favoriteTrack || 'Not yet today'}</strong><span>Favourite song</span></div>
        </article>
        <article className="music-journal__stat">
          <span className="music-journal__stat-icon">🌤️</span>
          <div><strong>{dominantMood || 'Add your mood'}</strong><span>Dominant mood</span></div>
        </article>
      </section>

      <div className="music-journal__layout">
        <section className="music-journal__timeline-panel">
          <div className="music-journal__section-heading">
            <div><span>YOUR MOMENTS</span><h2>{formatDate(selectedDate)}</h2></div>
            <span className="music-journal__entry-count">{dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          {activeTrack && (
            <div className="music-journal__now-playing">
              <img src={activeTrack.image || getPlaceholderSvg(activeTrack.name)} alt="" />
              <div><span>NOW IN YOUR PLAYER</span><strong>{activeTrack.name}</strong><small>{activeTrack.artist}</small></div>
              <span className="music-journal__live-dot" aria-label={musicPlayer.isPlaying ? 'Playing' : 'Paused'} />
            </div>
          )}

          {sortedEntries.length ? (
            <div className="music-journal__timeline">
              {sortedEntries.map((entry) => (
                <article className="music-journal__timeline-entry" key={entry.id}>
                  <div className="music-journal__timeline-rail"><span /></div>
                  <div className="music-journal__entry-card">
                    <div className="music-journal__entry-time">
                      <time dateTime={entry.playedAt}>{new Date(entry.playedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
                      {entry.listeningSeconds > 0 && <span>{formatDuration(entry.listeningSeconds)}</span>}
                    </div>
                    {entry.track && (
                      <button
                        className="music-journal__track"
                        type="button"
                        onClick={() => musicPlayer.playTrack(entry.track)}
                        aria-label={`Play ${entry.track.name}`}
                      >
                        <img src={entry.track.image || getPlaceholderSvg(entry.track.name)} alt="" />
                        <span><strong>{entry.track.name}</strong><small>{entry.track.artist}</small></span>
                        <span className="music-journal__play" aria-hidden="true">▶</span>
                      </button>
                    )}
                    {entry.note && <p className="music-journal__note">{entry.note}</p>}
                    <div className="music-journal__entry-meta">
                      {entry.mood ? <span className="music-journal__tag">{moodEmojis[entry.mood] || '🎵'} {entry.mood}</span> : (
                        <label className="music-journal__mood-select">
                          <span className="sr-only">Add mood</span>
                          <select value="" onChange={(event) => updateEntryMood(entry, event.target.value)} aria-label="Add a mood">
                            <option value="">＋ Add mood</option>
                            {moods.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                        </label>
                      )}
                      {entry.location && <span className="music-journal__tag">📍 {entry.location}</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="music-journal__empty">
              <span>🌙</span>
              <h3>A new page, waiting for a song</h3>
              <p>Your listening sessions and journal notes for this day will appear here.</p>
            </div>
          )}
        </section>

        <aside className="music-journal__side">
          <section className="music-journal__calendar-panel">
            <div className="music-journal__calendar-heading">
              <div><span>YOUR LISTENING MAP</span><h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2></div>
              <div className="music-journal__month-controls">
                <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
                <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
              </div>
            </div>
            <div className="music-journal__calendar-grid" role="grid" aria-label="Select a journal date">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((weekday, index) => <span className="music-journal__weekday" key={`${weekday}-${index}`}>{weekday}</span>)}
              {Array.from({ length: firstWeekday }, (_, index) => <span className="music-journal__calendar-blank" key={`blank-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
                const hasEntries = Boolean(entriesByDate[key]?.length);
                return (
                  <button
                    className={`music-journal__calendar-day ${selectedDate === key ? 'is-selected' : ''} ${dateKey(currentDate) === key ? 'is-today' : ''} ${hasEntries ? 'has-entry' : ''}`}
                    type="button"
                    key={key}
                    onClick={() => setSelectedDate(key)}
                    aria-pressed={selectedDate === key}
                    aria-label={`${formatDate(key)}${hasEntries ? ', has journal entries' : ''}`}
                  >
                    {day}{hasEntries && <i />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="music-journal__write-panel">
            <div className="music-journal__write-heading"><span>✍️</span><div><span>CAPTURE THE MOMENT</span><h2>Add to your day</h2></div></div>
            {activeTrack ? (
              <div className="music-journal__attached-track">
                <img src={activeTrack.image || getPlaceholderSvg(activeTrack.name)} alt="" />
                <span><strong>{activeTrack.name}</strong><small>{activeTrack.artist}</small></span>
              </div>
            ) : <p className="music-journal__helper">Play a song to attach it to your note, or just capture how you feel.</p>}
            <form className="music-journal__form" onSubmit={saveNote}>
              <label>
                <span>How are you feeling?</span>
                <select value={mood} onChange={(event) => setMood(event.target.value)}>
                  <option value="">Choose a mood</option>
                  {moods.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Where are you?</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} placeholder="A place or a little detail" />
              </label>
              <label>
                <span>Your thoughts</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="What does this moment sound like?" />
              </label>
              <button className="music-journal__save" type="submit" disabled={!mood && !location.trim() && !note.trim()}>Save this moment <span>↗</span></button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default MusicJournal;
