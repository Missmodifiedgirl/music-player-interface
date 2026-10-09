/**
 * Music Player Interface - Main Entry Point
 * Orchestrates modules, initializes UI, binds global keyboard shortcuts.
 */

import { ui } from './frontend/src/ui.js';
import { musicPlayer } from './frontend/src/player.js';
import { playlistStore } from './frontend/src/playlist-store.js';
import * as spotifyAuth from './frontend/src/spotify-auth.js';
import * as spotifyApi from './frontend/src/spotify-api.js';
import * as lastfmApi from './frontend/src/lastfm-api.js';
import { backendApi } from './frontend/src/backend-api.js';
// Expose globals for debugging & console interaction
window.musicPlayer = musicPlayer;
window.playlistStore = playlistStore;
window.ui = ui;
window.spotifyAuth = spotifyAuth;
window.spotifyApi = spotifyApi;
window.lastfmApi = lastfmApi;
window.backendApi = backendApi;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎵 Initializing Music Player Interface...');

  // Initialize UI controller
  ui.init();

  // Listen for popup auth completion message
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
      console.log('Received Spotify auth success message.');
      ui.updateAuthStatus();
      ui.showToast('Spotify connected successfully!', 'success');
      ui.renderCurrentView();
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore key presses inside text inputs or textareas
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    if (e.code === 'Space') {
      e.preventDefault();
      musicPlayer.togglePlay();
    } else if (e.code === 'ArrowRight') {
      if (e.shiftKey) {
        // Fast forward 5s
        musicPlayer.seek(musicPlayer.currentTime + 5);
      } else {
        musicPlayer.next();
      }
    } else if (e.code === 'ArrowLeft') {
      if (e.shiftKey) {
        // Rewind 5s
        musicPlayer.seek(musicPlayer.currentTime - 5);
      } else {
        musicPlayer.previous();
      }
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      musicPlayer.setVolume(musicPlayer.volume + 0.05);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      musicPlayer.setVolume(musicPlayer.volume - 0.05);
    } else if (e.key === 'm' || e.key === 'M') {
      musicPlayer.toggleMute();
    } else if (e.key === 'l' || e.key === 'L') {
      if (musicPlayer.currentTrack) {
        const liked = playlistStore.toggleLikedTrack(musicPlayer.currentTrack);
        ui.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
      }
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  console.log('✅ Music Player Interface ready!');
});
