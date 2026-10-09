/**
 * UI Renderer and View Controller
 * Handles view switching, component rendering, modals, and toasts.
 */

import { formatTime, escapeHtml, getPlaceholderSvg } from './utils.js';
import { playlistStore } from './playlist-store.js';
import { musicPlayer } from './player.js';
import { getTrendingTracks, getArtistInfo, getSimilarArtistsLastFm, getArtistTopTracksLastFm } from './lastfm-api.js';
import { searchSpotify, getArtist, getArtistTopTracks, getArtistRelatedArtists, getCurrentUserProfile } from './spotify-api.js';
import { isAuthenticated, loginWithSpotify, logoutSpotify, loginWithToken } from './spotify-auth.js';
import { getSpotifyClientId, getSpotifyRedirectUri, STORAGE_KEYS } from './config.js';
import { backendApi } from './backend-api.js';
import { createRoot } from 'react-dom/client';
import React from 'react';
import HomeView from './views/HomeView.jsx';
import SearchView from './views/SearchView.jsx';
import TrendingView from './views/TrendingView.jsx';
import ArtistsView from './views/ArtistsView.jsx';
import AccountView from './views/AccountView.jsx';
import PlaylistsView from './views/PlaylistsView.jsx';
import ArtistDetailView from './views/ArtistDetailView.jsx';

class UIController {
  constructor() {
    this.currentView = 'home';
    this.selectedArtist = null;
    this.selectedPlaylist = null;
    this.searchQuery = '';
    this.activeSearchFilter = 'all';
    this.searchDebounceTimer = null;
    this.accountMode = 'login';
    this.localUser = null;
    this.localAccountError = '';
    this.reactViewRoot = null;
  }

  init() {
    this.bindGlobalNavigation();
    this.bindPlayerEvents();
    this.bindModals();
    this.updateAuthStatus();
    this.renderCurrentView();
    this.renderLocalAccountStatus();
    this.loadLocalAccount();

    window.addEventListener('spotify-auth-changed', () => {
      this.updateAuthStatus();
      this.renderSidebarPlaylists();
      if (this.currentView === 'playlists' || this.currentView === 'home') {
        this.renderCurrentView();
      }
    });

    window.addEventListener('playlists-updated', () => {
      this.renderSidebarPlaylists();
      if (this.currentView === 'playlists') {
        this.renderPlaylistsView();
      } else if (this.currentView === 'playlist-detail' && this.selectedPlaylist) {
        const updated = playlistStore.getPlaylistById(this.selectedPlaylist.id);
        if (updated) {
          this.selectedPlaylist = updated;
          this.renderPlaylistDetailView(updated);
        } else {
          this.switchView('playlists');
        }
      }
    });
  }

  /**
   * Bind navigation clicks on sidebar and header
   */
  bindGlobalNavigation() {
    document.querySelectorAll('[data-view]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = elem.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Your Library - Create Playlist (+) button
const sidebarAddPlaylistBtn = document.getElementById('sidebar-add-playlist-btn');

if (sidebarAddPlaylistBtn) {
  sidebarAddPlaylistBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.openCreatePlaylistModal();
  });
}
    // Mobile sidebar toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuBtn && sidebar && overlay) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    // Connect Spotify button
    const authBtn = document.getElementById('auth-action-btn');
    if (authBtn) {
      authBtn.addEventListener('click', async () => {
        if (isAuthenticated()) {
          if (confirm('Log out from Spotify?')) {
            logoutSpotify();
            this.showToast('Logged out from Spotify', 'info');
          }
        } else {
          this.openSpotifyConnectModal();
        }
      });
    }

    // Settings Modal trigger
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettingsModal());
    }

    // Search bar input
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchQuery = e.target.value.trim();
        this.searchDebounceTimer = setTimeout(() => {
          if (this.currentView !== 'search') {
            this.switchView('search');
          } else {
            this.performSearch();
          }
        }, 300);
      });

      // Clear search button
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          this.searchQuery = '';
          this.performSearch();
        });
      }
    }
  }

  /**
   * Switch the active view
   */
  switchView(viewName, params = {}) {
    this.unmountReactView();
    this.currentView = viewName;

    // Update active nav state in sidebar
    document.querySelectorAll('[data-view]').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Close mobile sidebar if open
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    // Scroll to top of main content
    const mainContent = document.getElementById('main-content-scroll');
    if (mainContent) mainContent.scrollTop = 0;

    if (viewName === 'artist-detail' && params.artist) {
      this.selectedArtist = params.artist;
      this.renderArtistDetailView(params.artist);
    } else if (viewName === 'playlist-detail' && params.playlist) {
      this.selectedPlaylist = params.playlist;
      this.renderPlaylistDetailView(params.playlist);
    } else {
      this.renderCurrentView();
    }
  }

  /**
   * Render the view corresponding to this.currentView
   */
  renderCurrentView() {
    switch (this.currentView) {
      case 'home':
        this.renderHomeView();
        break;
      case 'search':
        this.renderSearchView();
        break;
      case 'trending':
        this.renderTrendingView();
        break;
      case 'artists':
        this.renderArtistsView();
        break;
      case 'playlists':
        this.renderPlaylistsView();
        break;
      case 'account':
        this.renderAccountView();
        break;
      default:
        this.renderHomeView();
    }
  }

  async loadLocalAccount() {
    try {
      const result = await backendApi.me();
      this.localUser = result.authenticated ? result.user : null;
      this.localAccountError = '';
    } catch (error) {
      this.localAccountError = 'Could not reach the Django account service. Make sure the backend is running.';
      console.warn('Could not restore local account session:', error);
    }

    this.renderLocalAccountStatus();
    if (this.currentView === 'account') this.renderAccountView();
  }

  getLocalAccountName() {
    return this.localUser?.name || this.localUser?.username || this.localUser?.email?.split('@')[0] || 'Account';
  }

  renderLocalAccountStatus() {
    const container = document.getElementById('local-account-status');
    if (!container) return;

    const accountName = this.localUser ? this.getLocalAccountName() : 'Website login';
    container.innerHTML = `
      <button class="local-account-chip" id="local-account-chip" type="button" aria-label="Open website account">
        <span class="local-account-label">${this.localUser ? 'SIGNED IN' : 'ACCOUNT'}</span>
        <strong>${escapeHtml(accountName)}</strong>
      </button>
    `;
    document.getElementById('local-account-chip')?.addEventListener('click', () => this.switchView('account'));
  }

  renderAccountView() {
    this.renderReactView(AccountView, {
      ui: this,
      user: this.localUser,
      initialError: this.localAccountError,
      accountMode: this.accountMode,
    });
  }

  /**
   * Update Spotify Auth UI in Sidebar
   */
  async updateAuthStatus() {
    const userContainer = document.getElementById('user-profile-badge');
    if (!userContainer) return;

    if (isAuthenticated()) {
      try {
        const user = await getCurrentUserProfile();
        userContainer.innerHTML = `
          <div class="user-profile-card">
            <img class="user-avatar" src="${user.images?.[0]?.url || getPlaceholderSvg(user.display_name || 'User')}" alt="User Avatar" />
            <div class="user-info">
              <span class="user-name">${escapeHtml(user.display_name || 'Spotify User')}</span>
              <span class="user-tier-badge ${user.product === 'premium' ? 'premium' : 'free'}">
                ${user.product === 'premium' ? '★ Spotify Premium' : 'Spotify Free'}
              </span>
            </div>
            <button id="auth-logout-btn" class="icon-btn" title="Logout" aria-label="Logout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        `;

        document.getElementById('auth-logout-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          logoutSpotify();
          this.showToast('Logged out from Spotify', 'info');
        });

        // Hide guest connect banner
        const connectPrompt = document.getElementById('spotify-connect-banner');
        if (connectPrompt) connectPrompt.style.display = 'none';

      } catch (err) {
        console.warn('Failed to load user profile:', err);
      }
    } else {
      userContainer.innerHTML = `
        <button id="auth-login-trigger" class="btn btn-spotify-connect">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Connect Spotify
        </button>
      `;

      document.getElementById('auth-login-trigger')?.addEventListener('click', () => {
        this.openSpotifyConnectModal();
      });

      const connectPrompt = document.getElementById('spotify-connect-banner');
      if (connectPrompt) connectPrompt.style.display = 'flex';
    }
  }

  /**
   * Render playlists list in the sidebar
   */
  renderSidebarPlaylists() {
    const container = document.getElementById('sidebar-playlists-list');
    if (!container) return;

    const playlists = playlistStore.getAllPlaylists();
    container.innerHTML = playlists.map(pl => `
      <div class="sidebar-playlist-item ${this.selectedPlaylist?.id === pl.id ? 'active' : ''}" data-playlist-id="${pl.id}">
        <span class="pl-icon">${pl.isLiked ? '❤️' : '📁'}</span>
        <span class="pl-name" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</span>
        <span class="pl-count">${pl.tracks.length}</span>
      </div>
    `).join('');

    container.querySelectorAll('.sidebar-playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-playlist-id');
        const pl = playlistStore.getPlaylistById(id);
        if (pl) {
          this.switchView('playlist-detail', { playlist: pl });
        }
      });
    });
  }

  /**
   * 1. HOME VIEW
   */
  async renderHomeView() {
    this.renderReactView(HomeView, {
      ui: this,
      musicPlayer,
      playlistStore,
    });
  }

  renderReactView(Component, props) {
    const main = document.getElementById('view-container');
    if (!main) return;
    if (!this.reactViewRoot) this.reactViewRoot = createRoot(main);
    this.reactViewRoot.render(React.createElement(Component, props));
  }

  unmountReactView() {
    if (this.reactViewRoot) {
      this.reactViewRoot.unmount();
      this.reactViewRoot = null;
    }
  }

  /**
   * 2. SEARCH VIEW
   */
  renderSearchView() {
    this.renderReactView(SearchView, {
      ui: this,
      musicPlayer,
      playlistStore,
      query: this.searchQuery,
      activeFilter: this.activeSearchFilter,
    });
  }

  /**
   * Perform Search using Spotify Web API (or fallback if not logged in)
   */
  async performSearch() {
    if (this.currentView === 'search') this.renderSearchView();
  }

  /**
   * 3. TRENDING SONGS VIEW (Last.fm API Global Charts)
   */
  async renderTrendingView() {
    this.renderReactView(TrendingView, { ui: this, musicPlayer });
  }

  /**
   * 4. ARTISTS VIEW
   */
  async renderArtistsView() {
    this.renderReactView(ArtistsView, { ui: this });
  }

  /**
   * Open Artist Detail (Bio, Top Tracks, Similar Artists)
   */
  async openArtistByName(artistName) {
    this.switchView('artist-detail', { artist: { name: artistName } });
  }

  async openArtistByIdOrName(artistId, artistName) {
    this.switchView('artist-detail', { artist: { id: artistId, name: artistName } });
  }

  /**
   * 5. ARTIST DETAIL VIEW
   */
  async renderArtistDetailView(artistObj) {
    this.renderReactView(ArtistDetailView, { artist: artistObj, ui: this, musicPlayer });
  }

  /**
   * 6. PLAYLISTS VIEW
   */
  renderPlaylistsView() {
    this.renderReactView(PlaylistsView, { ui: this, playlistStore, musicPlayer });
  }

  /**
   * 7. PLAYLIST DETAIL VIEW
   */
  renderPlaylistDetailView(playlist) {
    this.renderReactView(PlaylistsView, { ui: this, playlistStore, musicPlayer, playlist });
  }

  /**
   * Helper: Render Table of Tracks
   */
  renderTrackTable(tracks, options = {}) {
    const { showRank = false, showListeners = false, showRemove = false, playlistId = null } = options;

    return `
      <div class="track-table-wrapper">
        <table class="track-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-title">Title</th>
              <th class="col-artist">Artist</th>
              ${showListeners ? '<th class="col-listeners">Listeners</th>' : '<th class="col-album">Album</th>'}
              <th class="col-duration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${tracks.map((track, idx) => {
              const isLiked = playlistStore.isTrackLiked(track);
              const isCurrent = musicPlayer.currentTrack?.name === track.name;
              const isPlayingCurrent = isCurrent && musicPlayer.isPlaying;

              return `
                <tr class="track-row ${isCurrent ? 'current-track' : ''}" data-track-id="${track.id || idx}">
                  <td class="col-num">
                    <span class="track-index">${idx + 1}</span>
                    <button class="row-play-btn" title="Play">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        ${isPlayingCurrent ? 
                          '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>' : 
                          '<polygon points="5 3 19 12 5 21 5 3"></polygon>'
                        }
                      </svg>
                    </button>
                  </td>
                  <td class="col-title">
                    <div class="track-title-cell">
                      <img class="track-thumb" src="${track.image || getPlaceholderSvg(track.name)}" alt="" onerror="this.src='${getPlaceholderSvg(track.name)}'" />
                      <div class="track-title-info">
                        <span class="track-name ${isCurrent ? 'highlight' : ''}">${escapeHtml(track.name)}</span>
                      </div>
                    </div>
                  </td>
                  <td class="col-artist">
                    <span class="artist-link" data-artist-name="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                  </td>
                  ${showListeners ? `
                    <td class="col-listeners">${(track.listeners || 0).toLocaleString()}</td>
                  ` : `
                    <td class="col-album">${escapeHtml(track.album || '—')}</td>
                  `}
                  <td class="col-duration">${formatTime(track.duration_ms ? track.duration_ms / 1000 : 210)}</td>
                  <td class="col-actions">
                    <div class="track-actions-group">
                      <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" title="${isLiked ? 'Unlike' : 'Like'}">
                        ${isLiked ? '❤️' : '🤍'}
                      </button>
                      <button class="action-btn add-pl-btn" title="Add to Playlist">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      </button>
                      ${track.spotifyUrl || track.uri ? `
                        <a href="${track.spotifyUrl || `https://open.spotify.com/track/${track.uri.replace('spotify:track:', '')}`}" target="_blank" rel="noopener noreferrer" class="action-btn spotify-link-btn" title="Open in Spotify">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                        </a>
                      ` : ''}
                      ${showRemove && playlistId ? `
                        <button class="action-btn remove-track-btn" title="Remove from playlist">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Bind event listeners to track table rows
   */
  bindTrackTableEvents(container, tracks, playlistId = null) {
    container.querySelectorAll('.track-row').forEach((row, idx) => {
      const track = tracks[idx];
      if (!track) return;

      // Play row
      row.querySelector('.row-play-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        musicPlayer.playTrack(track, tracks);
      });

      // Double-click row plays track
      row.addEventListener('dblclick', () => {
        musicPlayer.playTrack(track, tracks);
      });

      // Like button
      row.querySelector('.like-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const liked = playlistStore.toggleLikedTrack(track);
        e.currentTarget.innerHTML = liked ? '❤️' : '🤍';
        e.currentTarget.classList.toggle('liked', liked);
        this.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
      });

      // Add to playlist button
      row.querySelector('.add-pl-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAddToPlaylistModal(track);
      });

      // Artist name link
      row.querySelector('.artist-link')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openArtistByName(track.artist);
      });

      // Remove from playlist button
      row.querySelector('.remove-track-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playlistId) {
          playlistStore.removeTrackFromPlaylist(playlistId, track.id || track.uri);
          this.showToast(`Removed "${track.name}" from playlist.`, 'info');
        }
      });
    });
  }

  /**
   * Helper: Render Track Card for carousels
   */
  renderTrackCard(track) {
    return `
      <div class="music-card" data-track-name="${escapeHtml(track.name)}">
        <div class="card-cover-wrapper">
          <img src="${track.image || getPlaceholderSvg(track.name)}" alt="${escapeHtml(track.name)}" onerror="this.src='${getPlaceholderSvg(track.name)}'" loading="lazy" />
          <button class="card-play-btn" title="Play">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        </div>
        <div class="card-body">
          <h4 class="card-title" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h4>
          <span class="card-subtitle artist-link" data-artist-name="${escapeHtml(track.artist)}" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
        </div>
      </div>
    `;
  }

  bindTrackCardEvents(container, tracks) {
    container.querySelectorAll('.music-card').forEach((card, idx) => {
      const track = tracks[idx];
      if (!track) return;

      card.querySelector('.card-play-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        musicPlayer.playTrack(track, tracks);
      });

      card.addEventListener('click', () => {
        musicPlayer.playTrack(track, tracks);
      });

      card.querySelector('.artist-link')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openArtistByName(track.artist);
      });
    });
  }

  renderLoadingCards(count = 6, type = 'card') {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-card skeleton-${type}">
        <div class="skeleton-img"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text-sub"></div>
      </div>
    `).join('');
  }

  /**
   * Bind Bottom Music Player Events & Synchronization
   */
  bindPlayerEvents() {
    const playPauseBtn = document.getElementById('player-play-pause-btn');
    const prevBtn = document.getElementById('player-prev-btn');
    const nextBtn = document.getElementById('player-next-btn');
    const shuffleBtn = document.getElementById('player-shuffle-btn');
    const repeatBtn = document.getElementById('player-repeat-btn');
    const progressBar = document.getElementById('player-progress-bar');
    const volumeSlider = document.getElementById('player-volume-slider');
    const volumeBtn = document.getElementById('player-volume-btn');
    const likeBtn = document.getElementById('player-like-btn');
    const trackArtist = document.getElementById('player-track-artist');

    playPauseBtn?.addEventListener('click', () => musicPlayer.togglePlay());
    prevBtn?.addEventListener('click', () => musicPlayer.previous());
    nextBtn?.addEventListener('click', () => musicPlayer.next());
    shuffleBtn?.addEventListener('click', () => musicPlayer.toggleShuffle());
    repeatBtn?.addEventListener('click', () => musicPlayer.cycleRepeatMode());
    volumeBtn?.addEventListener('click', () => musicPlayer.toggleMute());

    // Seeking
    progressBar?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (musicPlayer.duration > 0) {
        musicPlayer.seek((value / 100) * musicPlayer.duration);
      }
    });

    // Volume
    volumeSlider?.addEventListener('input', (e) => {
      musicPlayer.setVolume(parseFloat(e.target.value) / 100);
    });

    // Player Like Button
    likeBtn?.addEventListener('click', () => {
      if (musicPlayer.currentTrack) {
        const liked = playlistStore.toggleLikedTrack(musicPlayer.currentTrack);
        likeBtn.innerHTML = liked ? '❤️' : '🤍';
        likeBtn.classList.toggle('liked', liked);
        this.showToast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
      }
    });

    // Artist click in player
    trackArtist?.addEventListener('click', () => {
      if (musicPlayer.currentTrack?.artist) {
        this.openArtistByName(musicPlayer.currentTrack.artist);
      }
    });

    // Listen to Player Events
    window.addEventListener('music-player-track-changed', (e) => {
      this.updatePlayerTrack(e.detail.track, e.detail.playbackMode);
    });

    window.addEventListener('music-player-playback-state-changed', (e) => {
      this.updatePlayerPlayState(e.detail.isPlaying);
    });

    window.addEventListener('music-player-time-updated', (e) => {
      this.updatePlayerTime(e.detail.currentTime, e.detail.duration, e.detail.progressPercent);
    });

    window.addEventListener('music-player-volume-changed', (e) => {
      this.updatePlayerVolume(e.detail.volume, e.detail.isMuted);
    });

    window.addEventListener('music-player-shuffle-changed', (e) => {
      shuffleBtn?.classList.toggle('active', e.detail.isShuffle);
    });

    window.addEventListener('music-player-repeat-changed', (e) => {
      if (repeatBtn) {
        repeatBtn.classList.toggle('active', e.detail.repeatMode !== 'none');
        repeatBtn.setAttribute('title', `Repeat: ${e.detail.repeatMode}`);
      }
    });

    // Handle Playback Notice Modal (Honest, supportive Spotify feedback)
    window.addEventListener('music-player-playback-notice', (e) => {
      this.openPlaybackNoticeModal(e.detail);
    });
  }

  updatePlayerTrack(track, playbackMode) {
    if (!track) return;

    const img = document.getElementById('player-track-img');
    const title = document.getElementById('player-track-title');
    const artist = document.getElementById('player-track-artist');
    const likeBtn = document.getElementById('player-like-btn');
    const spotifyBtn = document.getElementById('player-open-spotify-btn');
    const modeBadge = document.getElementById('player-playback-badge');

    if (img) img.src = track.image || getPlaceholderSvg(track.name);
    if (title) title.textContent = track.name;
    if (artist) artist.textContent = track.artist;

    if (likeBtn) {
      const isLiked = playlistStore.isTrackLiked(track);
      likeBtn.innerHTML = isLiked ? '❤️' : '🤍';
      likeBtn.classList.toggle('liked', isLiked);
    }

    if (spotifyBtn) spotifyBtn.style.display = 'none';

    if (modeBadge) {
      if (playbackMode === 'sdk') {
        modeBadge.textContent = 'Spotify Web SDK';
        modeBadge.className = 'playback-badge sdk';
      } else if (playbackMode === 'preview') {
        modeBadge.textContent = 'Audio Preview (30s)';
        modeBadge.className = 'playback-badge preview';
      } else {
        modeBadge.textContent = 'Unavailable here';
        modeBadge.className = 'playback-badge external';
      }
    }
  }

  updatePlayerPlayState(isPlaying) {
    const playPauseBtn = document.getElementById('player-play-pause-btn');
    if (!playPauseBtn) return;

    playPauseBtn.innerHTML = isPlaying ? `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    ` : `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    playPauseBtn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
  }

  updatePlayerTime(currentTime, duration, progressPercent) {
    const currSpan = document.getElementById('player-current-time');
    const durSpan = document.getElementById('player-duration');
    const progressBar = document.getElementById('player-progress-bar');

    if (currSpan) currSpan.textContent = formatTime(currentTime);
    if (durSpan) durSpan.textContent = formatTime(duration);
    if (progressBar && !progressBar.matches(':active')) {
      progressBar.value = progressPercent;
    }
  }

  updatePlayerVolume(volume, isMuted) {
    const slider = document.getElementById('player-volume-slider');
    const btn = document.getElementById('player-volume-btn');

    if (slider) slider.value = Math.round(volume * 100);
    if (btn) {
      btn.innerHTML = isMuted || volume === 0 ? `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      ` : `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    }
  }

  /**
   * Playback Notice Modal (Honest, high-fidelity Spotify UX requirement)
   */
  openPlaybackNoticeModal(notice) {
    const modal = document.getElementById('playback-notice-modal');
    if (!modal) return;

    const track = notice.track || {};
    const titleElem = document.getElementById('notice-modal-title');
    const msgElem = document.getElementById('notice-modal-message');
    const imgElem = document.getElementById('notice-track-img');
    const nameElem = document.getElementById('notice-track-name');
    const artistElem = document.getElementById('notice-track-artist');
    const embedContainer = document.getElementById('notice-embed-container');
    const spotifyLink = document.getElementById('notice-open-spotify');

    if (titleElem) titleElem.textContent = notice.title || 'Playback unavailable';
    if (msgElem) msgElem.textContent = notice.message || 'This track could not be played in the website.';
    if (imgElem) imgElem.src = track.image || getPlaceholderSvg(track.name);
    if (nameElem) nameElem.textContent = track.name || '';
    if (artistElem) artistElem.textContent = track.artist || '';

    if (spotifyLink) {
      const trackId = track.uri?.match(/^spotify:track:(.+)$/)?.[1];
      const url = track.spotifyUrl || (trackId
        ? `https://open.spotify.com/track/${trackId}`
        : `https://open.spotify.com/search/${encodeURIComponent(`${track.name || ''} ${track.artist || ''}`.trim())}`);
      spotifyLink.href = url;
      spotifyLink.style.display = track.name ? 'inline-flex' : 'none';
    }

    if (embedContainer) {
      embedContainer.innerHTML = '';
      embedContainer.style.display = 'none';
    }

    modal.classList.add('active');
  }

  /**
   * Modals: Create Playlist, Add To Playlist, Settings
   */
  bindModals() {
    // Close modals on overlay or close button click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Create Playlist Form
    const createForm = document.getElementById('create-playlist-form');
    if (createForm) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-playlist-name');
        const descInput = document.getElementById('new-playlist-desc');
        const coverInput = document.getElementById('new-playlist-cover');

        try {
          const newPl = playlistStore.createPlaylist({
            name: nameInput.value,
            description: descInput.value,
            coverArt: coverInput.value.trim() || null
          });
          document.getElementById('create-playlist-modal')?.classList.remove('active');
          createForm.reset();
          this.showToast(`Playlist "${newPl.name}" created!`, 'success');
          this.switchView('playlist-detail', { playlist: newPl });
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Settings Form
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const customClientId = document.getElementById('settings-client-id').value.trim();
        const customRedirect = document.getElementById('settings-redirect-uri')?.value.trim();

        if (customClientId) {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_CLIENT_ID, customClientId);
        } else {
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_CLIENT_ID);
        }

        if (customRedirect) {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_REDIRECT_URI, customRedirect);
        } else {
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_REDIRECT_URI);
        }

        document.getElementById('settings-modal')?.classList.remove('active');
        this.showToast('Settings saved successfully.', 'success');
      });
    }
  }

  openCreatePlaylistModal() {
    const modal = document.getElementById('create-playlist-modal');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('new-playlist-name')?.focus();
    }
  }

  openAddToPlaylistModal(track) {
    const modal = document.getElementById('add-to-playlist-modal');
    const container = document.getElementById('add-playlist-list');
    if (!modal || !container) return;

    const playlists = playlistStore.getAllPlaylists().filter(p => !p.isLiked);

    container.innerHTML = playlists.map(pl => {
      const alreadyIn = pl.tracks.some(t => t.name.toLowerCase() === track.name.toLowerCase());
      return `
        <div class="add-pl-item ${alreadyIn ? 'already-added' : ''}" data-pl-id="${pl.id}">
          <div class="add-pl-icon">📁</div>
          <div class="add-pl-info">
            <span class="add-pl-title">${escapeHtml(pl.name)}</span>
            <span class="add-pl-meta">${pl.tracks.length} tracks ${alreadyIn ? '• Already added' : ''}</span>
          </div>
          <button class="btn btn-sm ${alreadyIn ? 'btn-secondary' : 'btn-primary'}">
            ${alreadyIn ? 'Added ✓' : '+ Add'}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.add-pl-item').forEach(item => {
      item.addEventListener('click', () => {
        const plId = item.getAttribute('data-pl-id');
        const added = playlistStore.addTrackToPlaylist(plId, track);
        if (added) {
          const pl = playlistStore.getPlaylistById(plId);
          this.showToast(`Added to "${pl.name}"`, 'success');
          modal.classList.remove('active');
        } else {
          this.showToast('Track is already in this playlist.', 'info');
        }
      });
    });

    modal.classList.add('active');
  }

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const clientIdInput = document.getElementById('settings-client-id');
    const redirectUriInput = document.getElementById('settings-redirect-uri');

    if (clientIdInput) clientIdInput.value = getSpotifyClientId();
    if (redirectUriInput) redirectUriInput.value = getSpotifyRedirectUri();

    modal.classList.add('active');
  }

  openSpotifyConnectModal() {
    const modal = document.getElementById('spotify-connect-modal');
    if (!modal) return;

    const uriDisplay = document.getElementById('connect-redirect-uri-display');
    if (uriDisplay) {
      uriDisplay.textContent = getSpotifyRedirectUri();
    }

    const oauthBtn = document.getElementById('modal-oauth-login-btn');
    if (oauthBtn) {
      oauthBtn.onclick = async () => {
        try {
          oauthBtn.disabled = true;
          oauthBtn.textContent = 'Redirecting to Spotify...';
          await loginWithSpotify();
        } catch (err) {
          oauthBtn.disabled = false;
          oauthBtn.textContent = '🚀 Sign In with Spotify';
          this.showToast(`Login failed: ${err.message}`, 'error');
        }
      };
    }

    const tokenForm = document.getElementById('direct-token-form');
    if (tokenForm) {
      tokenForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('direct-token-input');
        const token = input?.value.trim();
        if (!token) {
          this.showToast('Please paste a Spotify access token.', 'warning');
          return;
        }

        const submitBtn = tokenForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Verifying Token...';
        }

        try {
          const user = await loginWithToken(token);
          this.showToast(`Connected as ${user.display_name || 'Spotify User'}!`, 'success');
          modal.classList.remove('active');
          this.updateAuthStatus();
          this.renderCurrentView();
        } catch (err) {
          this.showToast(err.message || 'Invalid Spotify token.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Connect with Token';
          }
        }
      };
    }

    modal.classList.add('active');
  }

  /**
   * Floating Toast Notifications
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-up`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }
}

export const ui = new UIController();
