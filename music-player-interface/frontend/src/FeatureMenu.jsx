import React, { useEffect, useState } from 'react';
import { featureComponents, featureInfo } from './features/index.jsx';

const features = [
  ['🧠', 'Music Memory', 'music-memory'],
  ['🗓️', 'Life Event Planner', 'life-event'],
  ['🔒', 'Future Message', 'future-message'],
  ['🌀', 'Emotional Journey', 'emotion-journey'],
  ['🕰️', 'Music Through Time', 'music-through-time'],
  ['👥', 'Friend Sync', 'friend-sync'],
  ['🧬', 'Music DNA', 'music-dna'],
  ['🎙️', 'Voice Playlist', 'voice-playlist'],
  ['🎵', 'Local Culture', 'local-culture'],
  ['📔', 'Music Journal', 'music-journal'],
  ['😴', 'Sleep Timer', 'sleep-time'],
  ['☀️', 'MoodLift', 'mood-music'],
  ['🎯', 'Focus / Study Mode', 'focus-mode'],
];

function FeatureMenu() {
  const [open, setOpen] = useState(false);
  const [activeReactFeature, setActiveReactFeature] = useState(null);

  useEffect(() => {
    if (!open && !activeReactFeature) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setActiveReactFeature(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, activeReactFeature]);

  useEffect(() => {
    const openFeature = (event) => {
      const featureId = event.detail?.featureId;
      if (!featureComponents[featureId]) return;
      setOpen(false);
      setActiveReactFeature(featureId);
    };
    const closeFeature = () => setActiveReactFeature(null);
    window.addEventListener('melodixa-open-feature', openFeature);
    window.addEventListener('melodixa-close-feature', closeFeature);
    return () => {
      window.removeEventListener('melodixa-open-feature', openFeature);
      window.removeEventListener('melodixa-close-feature', closeFeature);
    };
  }, []);

  const launchFeature = (featureId) => {
    setOpen(false);
    setActiveReactFeature(featureId);
  };

  return (
    <>
    <div className={`react-feature-menu ${activeReactFeature === 'life-event' ? 'is-life-event-open' : ''} ${activeReactFeature === 'music-memory' ? 'is-memory-open' : ''} ${activeReactFeature === 'music-journal' ? 'is-journal-open' : ''} ${activeReactFeature === 'emotion-journey' ? 'is-journey-open' : ''} ${activeReactFeature === 'future-message' ? 'is-future-message-open' : ''} ${activeReactFeature === 'friend-sync' ? 'is-friend-sync-open' : ''} ${activeReactFeature === 'why-song' ? 'is-why-song-open' : ''} ${activeReactFeature === 'music-dna' ? 'is-music-dna-open' : ''} ${activeReactFeature === 'song-conversation' ? 'is-song-conversation-open' : ''} ${activeReactFeature === 'sleep-time' ? 'is-sleep-mode-open' : ''} ${activeReactFeature === 'focus-mode' ? 'is-focus-mode-open' : ''} ${activeReactFeature === 'voice-playlist' ? 'is-voice-playlist-open' : ''} ${activeReactFeature === 'mood-music' ? 'is-mood-lift-open' : ''} ${activeReactFeature === 'music-through-time' ? 'is-music-through-time-open' : ''}`}>
      {open && (
        <section
          className="react-feature-menu__panel"
          id="react-feature-menu-panel"
          aria-label="Music features"
        >
          <h2>MELODIXA</h2>
          <p>Explore your music experience</p>
          <div className="react-feature-menu__list">
            {features.map(([icon, name, featureId], index) => (
              <button
                className="react-feature-menu__item"
                key={featureId}
                type="button"
                onClick={() => launchFeature(featureId)}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{name}</span>
                <small>{index + 1}</small>
              </button>
            ))}
          </div>
          <footer>MELODIXA · Music Player Interface</footer>
        </section>
      )}
      <button
        aria-expanded={open}
        aria-controls="react-feature-menu-panel"
        className="react-feature-menu__toggle"
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {open ? 'Close features' : 'Music features'}
      </button>
    </div>
    {activeReactFeature && (
      <div className={`modal-overlay active ${activeReactFeature === 'music-through-time' ? 'feature-music-through-time-overlay' : ''} ${activeReactFeature === 'life-event' ? 'feature-life-event-overlay' : ''} ${activeReactFeature === 'music-memory' ? 'feature-memory-overlay' : ''} ${activeReactFeature === 'music-journal' ? 'feature-journal-overlay' : ''} ${activeReactFeature === 'emotion-journey' ? 'feature-journey-overlay' : ''} ${activeReactFeature === 'future-message' ? 'feature-future-message-overlay' : ''} ${activeReactFeature === 'friend-sync' ? 'feature-friend-sync-overlay' : ''} ${activeReactFeature === 'why-song' ? 'feature-why-song-overlay' : ''} ${activeReactFeature === 'music-dna' ? 'feature-music-dna-overlay' : ''} ${activeReactFeature === 'song-conversation' ? 'feature-song-conversation-overlay' : ''} ${activeReactFeature === 'sleep-time' ? 'feature-sleep-mode-overlay' : ''} ${activeReactFeature === 'focus-mode' ? 'feature-focus-mode-overlay' : ''} ${activeReactFeature === 'voice-playlist' ? 'feature-voice-playlist-overlay' : ''} ${activeReactFeature === 'local-culture' ? 'feature-local-culture-overlay' : ''} ${activeReactFeature === 'mood-music' ? 'feature-mood-lift-overlay' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveReactFeature(null); }}>
        <section className={`modal-card feature-react-dialog ${activeReactFeature === 'music-through-time' ? 'feature-music-through-time-dialog' : ''} ${activeReactFeature === 'life-event' ? 'feature-life-event-dialog' : ''} ${activeReactFeature === 'music-memory' ? 'feature-memory-dialog' : ''} ${activeReactFeature === 'music-journal' ? 'feature-journal-dialog' : ''} ${activeReactFeature === 'emotion-journey' ? 'feature-journey-dialog' : ''} ${activeReactFeature === 'future-message' ? 'feature-future-message-dialog' : ''} ${activeReactFeature === 'friend-sync' ? 'feature-friend-sync-dialog' : ''} ${activeReactFeature === 'why-song' ? 'feature-why-song-dialog' : ''} ${activeReactFeature === 'music-dna' ? 'feature-music-dna-dialog' : ''} ${activeReactFeature === 'song-conversation' ? 'feature-song-conversation-dialog' : ''} ${activeReactFeature === 'sleep-time' ? 'feature-sleep-mode-dialog' : ''} ${activeReactFeature === 'focus-mode' ? 'feature-focus-mode-dialog' : ''} ${activeReactFeature === 'voice-playlist' ? 'feature-voice-playlist-dialog' : ''} ${activeReactFeature === 'local-culture' ? 'feature-local-culture-dialog' : ''} ${activeReactFeature === 'mood-music' ? 'feature-mood-lift-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={featureInfo[activeReactFeature]?.title || 'Music feature'}>
          <button className="modal-close-btn" type="button" aria-label="Close dialog" onClick={() => setActiveReactFeature(null)}>×</button>
          {React.createElement(featureComponents[activeReactFeature], {
            ui: window.ui,
            musicPlayer: window.musicPlayer,
            playlistStore: window.playlistStore,
          })}
        </section>
      </div>
    )}
    </>
  );
}

export default FeatureMenu;