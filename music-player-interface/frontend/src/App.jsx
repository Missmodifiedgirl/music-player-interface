import React, { useEffect } from 'react';
import shell from './app-shell.html?raw';
import FeatureMenu from './FeatureMenu.jsx';
import { ui } from './ui.js';
import { musicPlayer } from './player.js';
import { playlistStore } from './playlist-store.js';
import * as spotifyAuth from './spotify-auth.js';
import * as spotifyApi from './spotify-api.js';
import * as lastfmApi from './lastfm-api.js';
import { backendApi } from './backend-api.js';
import { startMusicJournalTracking } from './features/music-journal/journal-store.js';

function App() {
  useEffect(() => {
    window.musicPlayer = musicPlayer;
    window.playlistStore = playlistStore;
    window.ui = ui;
    window.spotifyAuth = spotifyAuth;
    window.spotifyApi = spotifyApi;
    window.lastfmApi = lastfmApi;
    window.backendApi = backendApi;

    ui.init();
    const stopMusicJournalTracking = startMusicJournalTracking(musicPlayer);

    const handleSpotifyAuth = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'SPOTIFY_AUTH_SUCCESS') return;
      ui.updateAuthStatus();
      ui.showToast('Spotify connected successfully!', 'success');
      ui.renderCurrentView();
    };

    const whySongButton = document.getElementById('player-why-song-btn');
    const talkSongButton = document.getElementById('player-talk-song-btn');
    const openWhySong = () => window.dispatchEvent(new CustomEvent('melodixa-open-feature', { detail: { featureId: 'why-song' } }));
    const openSongConversation = () => window.dispatchEvent(new CustomEvent('melodixa-open-feature', { detail: { featureId: 'song-conversation' } }));
    const updateSongAvailability = (event) => {
      const available = Boolean(event.detail?.track || musicPlayer.currentTrack);
      if (whySongButton) whySongButton.disabled = !available;
      if (talkSongButton) talkSongButton.disabled = !available;
    };
    whySongButton?.addEventListener('click', openWhySong);
    talkSongButton?.addEventListener('click', openSongConversation);
    window.addEventListener('music-player-track-changed', updateSongAvailability);
    updateSongAvailability({ detail: { track: musicPlayer.currentTrack } });

    const handleKeydown = (event) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (event.code === 'Space') {
        event.preventDefault();
        musicPlayer.togglePlay();
      } else if (event.code === 'ArrowRight') {
        event.shiftKey ? musicPlayer.seek(musicPlayer.currentTime + 5) : musicPlayer.next();
      } else if (event.code === 'ArrowLeft') {
        event.shiftKey ? musicPlayer.seek(musicPlayer.currentTime - 5) : musicPlayer.previous();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        musicPlayer.setVolume(musicPlayer.volume + 0.05);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        musicPlayer.setVolume(musicPlayer.volume - 0.05);
      } else if (event.key === 'm' || event.key === 'M') {
        musicPlayer.toggleMute();
      } else if (event.key === 'l' || event.key === 'L') {
        if (musicPlayer.currentTrack) {
          const liked = playlistStore.toggleLikedTrack(musicPlayer.currentTrack);
          ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
        }
      } else if (event.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((modal) => modal.classList.remove('active'));
      }
    };

    window.addEventListener('message', handleSpotifyAuth);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      stopMusicJournalTracking();
      window.removeEventListener('message', handleSpotifyAuth);
      document.removeEventListener('keydown', handleKeydown);
      whySongButton?.removeEventListener('click', openWhySong);
      talkSongButton?.removeEventListener('click', openSongConversation);
      window.removeEventListener('music-player-track-changed', updateSongAvailability);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations
        .filter((registration) => {
          const worker = registration.active || registration.waiting || registration.installing;
          return worker?.scriptURL === `${window.location.origin}/service-worker.js`
            || (!worker && registration.scope === `${window.location.origin}/`);
        })
        .forEach((registration) => registration.unregister());
    }).catch((error) => {
      console.warn('Could not unregister the removed offline service worker:', error);
    });

    if ('caches' in window) {
      window.caches.delete('melodixa-app-shell-v1').catch((error) => {
        console.warn('Could not clear the removed offline app cache:', error);
      });
    }
    return undefined;
  }, []);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: shell }} />
      <FeatureMenu />
    </>
  );
}

export default App;
