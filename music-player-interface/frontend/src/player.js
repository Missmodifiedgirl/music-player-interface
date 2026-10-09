/**
 * Unified Audio Playback Engine
 * Handles:
 * 1. Spotify Web Playback SDK (for full Spotify browser playback with Premium)
 * 2. Native HTML5 Audio (for 30-sec preview_url playback when available)
 * 3. Fallback with clear, honest "Open in Spotify" notifications when playback is restricted.
 * 
 * STRICT COMPLIANCE:
 * - NO fake song.mp3 audio
 * - NO pretend playback
 * - Proper error messaging & direct Spotify links
 */

import { STORAGE_KEYS } from './config.js';
import { getValidAccessToken, isAuthenticated } from './spotify-auth.js';
import {
  playTrack as spotifyApiPlay,
  pausePlayback as spotifyApiPause,
  seekPlayback as spotifyApiSeek,
  setVolume as spotifyApiSetVolume,
  getCurrentUserProfile,
  searchSpotify
} from './spotify-api.js';

class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.queue = [];
    this.currentIndex = -1;
    this.currentTrack = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = parseFloat(localStorage.getItem(STORAGE_KEYS.VOLUME) || '0.75');
    this.isMuted = false;
    this.previousVolume = this.volume;
    this.isShuffle = false;
    this.repeatMode = 'none'; // 'none' | 'all' | 'one'

    // Spotify SDK state
    this.spotifyPlayer = null;
    this.deviceId = null;
    this.isSdkReady = false;
    this.isPremium = false;
    this.sdkError = null;
    this.sdkSetupPromise = null;
    this.sdkSetupStarted = false;
    this.sdkReadyWaiters = new Set();
    this.playbackMode = 'none'; // 'sdk' | 'preview' | 'external' | 'none'

    this.initAudioEvents();
    this.setupSpotifySdkIfPossible();

    // Listen for auth changes
    window.addEventListener('spotify-auth-changed', (e) => {
      if (e.detail?.authenticated) {
        this.setupSpotifySdkIfPossible();
      } else {
        if (this.spotifyPlayer) {
          this.spotifyPlayer.disconnect();
          this.spotifyPlayer = null;
          this.isSdkReady = false;
        }
        this.sdkSetupStarted = false;
        this.isPremium = false;
      }
    });
  }

  /**
   * Set up HTML5 Audio listeners for preview URLs
   */
  initAudioEvents() {
    this.audio.volume = this.volume;

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.emitStateChange();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.emitStateChange();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.playbackMode === 'preview') {
        this.currentTime = this.audio.currentTime;
        this.duration = this.audio.duration || 30;
        this.emitTimeUpdate();
      }
    });

    this.audio.addEventListener('ended', () => {
      this.handleTrackEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('HTML5 Audio playback error:', e);
      if (this.playbackMode === 'preview') {
        this.isPlaying = false;
        this.emitStateChange();
        this.emitNotice({
          title: 'Preview unavailable',
          message: 'This track preview could not be played in the website.',
          track: this.currentTrack
        });
      }
    });
  }

  /**
   * Dynamically loads Spotify Web Playback SDK script and initializes player
   */
  async setupSpotifySdkIfPossible() {
    if (!isAuthenticated()) return;
    if (this.sdkSetupPromise) return this.sdkSetupPromise;
    if (this.sdkSetupStarted) return;
    this.sdkSetupStarted = true;

    this.sdkSetupPromise = (async () => {
      try {
        const user = await getCurrentUserProfile();
        this.isPremium = user.product === 'premium';
      } catch (error) {
        this.isPremium = false;
        this.sdkError = error.message || 'Could not verify the Spotify account plan.';
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        this.initializeSpotifyPlayer();
      };

      if (!window.Spotify) {
        const existingScript = document.getElementById('spotify-player-sdk');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'spotify-player-sdk';
          script.src = 'https://sdk.scdn.co/spotify-player.js';
          script.async = true;
          script.onerror = () => {
            this.sdkError = 'Spotify Web Playback SDK failed to load. Check your network or content blockers.';
          };
          document.body.appendChild(script);
        }
      }

      if (window.Spotify && !this.spotifyPlayer) {
        await this.initializeSpotifyPlayer();
      }
    })();

    try {
      await this.sdkSetupPromise;
    } finally {
      this.sdkSetupPromise = null;
    }
  }

  waitForSdkReady(timeoutMs = 7000) {
    if (this.isSdkReady && this.deviceId) return Promise.resolve(true);

    return new Promise(resolve => {
      const waiter = {
        resolve,
        timeout: window.setTimeout(() => {
          this.sdkReadyWaiters.delete(waiter);
          resolve(false);
        }, timeoutMs)
      };
      this.sdkReadyWaiters.add(waiter);
    });
  }

  resolveSdkReadyWaiters() {
    for (const waiter of this.sdkReadyWaiters) {
      window.clearTimeout(waiter.timeout);
      waiter.resolve(true);
    }
    this.sdkReadyWaiters.clear();
  }

  /**
   * Initialize Spotify.Player instance
   */
  async initializeSpotifyPlayer() {
    if (this.spotifyPlayer) return;

    const token = await getValidAccessToken();
    if (!token) return;

    try {
      this.spotifyPlayer = new window.Spotify.Player({
        name: 'Music Player Interface',
        getOAuthToken: async (cb) => {
          const freshToken = await getValidAccessToken();
          cb(freshToken || token);
        },
        volume: this.volume
      });

      // Player Ready
      this.spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify Web Playback SDK Ready with Device ID:', device_id);
        this.deviceId = device_id;
        this.isSdkReady = true;
        this.sdkError = null;
        this.resolveSdkReadyWaiters();
        this.emitEvent('sdk-ready', { deviceId: device_id });
      });

      // Player Not Ready
      this.spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.warn('Device ID went offline:', device_id);
        this.isSdkReady = false;
      });

      // State Changed
      this.spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        this.isPlaying = !state.paused;
        this.currentTime = state.position / 1000;
        this.duration = state.duration / 1000;
        this.emitTimeUpdate();
        this.emitStateChange();
      });

      // Account Error (e.g. Free Spotify tier not allowed to use Web Playback SDK)
      this.spotifyPlayer.addListener('account_error', ({ message }) => {
        console.warn('Spotify SDK Account Error (Requires Premium):', message);
        this.isPremium = false;
        this.sdkError = message;
      });

      this.spotifyPlayer.addListener('initialization_error', ({ message }) => {
        this.sdkError = `Spotify player initialization failed: ${message}`;
        console.error(this.sdkError);
      });

      this.spotifyPlayer.addListener('authentication_error', ({ message }) => {
        this.sdkError = `Spotify player authentication failed: ${message}`;
        console.error(this.sdkError);
      });

      this.spotifyPlayer.addListener('playback_error', ({ message }) => {
        this.sdkError = `Spotify playback failed: ${message}`;
        console.error(this.sdkError);
      });

      const connected = await this.spotifyPlayer.connect();
      if (!connected) {
        this.sdkError = 'Spotify Web Playback SDK could not connect to a playback device.';
      }
    } catch (err) {
      console.warn('Failed to initialize Spotify Web Playback SDK:', err);
      this.sdkError = `Spotify player initialization failed: ${err.message || err}`;
    }
  }

  /**
   * Play a track with queue support
   * @param {object} track 
   * @param {Array} [newQueue] 
   */
  async resolveTrackUri(track) {
    if (!track) return null;

    if (typeof track.uri === 'string' && /^spotify:track:[A-Za-z0-9]{22}$/.test(track.uri)) {
      return track.uri;
    }

    if (typeof track.id === 'string' && /^[A-Za-z0-9]{22}$/.test(track.id)) {
      return `spotify:track:${track.id}`;
    }

    if (!isAuthenticated()) return null;

    try {
      const query = [track.name, track.artist].filter(Boolean).join(' ');
      if (!query) return null;

      const searchResult = await searchSpotify(query, 'track', 12);
      const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const title = normalize(track.name);
      const artist = normalize(track.artist);
      const match = (searchResult.tracks?.items || []).find((candidate) => {
        const titleMatches = !title || normalize(candidate.name) === title || normalize(candidate.name).includes(title) || title.includes(normalize(candidate.name));
        const artistMatches = !artist || candidate.artists?.some(({ name }) => {
          const candidateArtist = normalize(name);
          return candidateArtist && (artist.includes(candidateArtist) || candidateArtist.includes(artist));
        });
        return titleMatches && artistMatches;
      });

      return match?.uri || null;
    } catch (error) {
      console.warn('Track URI resolution failed:', error);
      return null;
    }
  }

  async playTrack(track, newQueue = null) {
    if (!track) return;

    let activationPromise = null;
    try {
      activationPromise = this.spotifyPlayer?.activateElement?.();
    } catch (error) {
      this.sdkError = error.message || String(error);
    }

    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      this.queue = [...newQueue];
      this.currentIndex = this.queue.findIndex(t => (t.id && t.id === track.id) || (t.uri && t.uri === track.uri));
      if (this.currentIndex === -1) {
        this.queue.unshift(track);
        this.currentIndex = 0;
      }
    } else if (this.currentIndex === -1 || !this.queue.some(t => t.id === track.id)) {
      this.queue = [track];
      this.currentIndex = 0;
    }

    let resolvedTrack = { ...track };
    const resolvedUri = await this.resolveTrackUri(track);
    if (resolvedUri) {
      resolvedTrack = {
        ...resolvedTrack,
        id: resolvedTrack.id || resolvedUri.replace('spotify:track:', ''),
        uri: resolvedUri,
        spotifyUrl: resolvedTrack.spotifyUrl || `https://open.spotify.com/track/${resolvedUri.replace('spotify:track:', '')}`
      };
    } else {
      this.sdkError = `No Spotify track URI was available for "${track.name}" by ${track.artist || 'unknown artist'}.`;
    }

    if (resolvedTrack.uri && resolvedTrack.uri.startsWith('spotify:track:') && !resolvedTrack.preview_url && track.preview_url) {
      resolvedTrack.preview_url = track.preview_url;
    }

    if (isAuthenticated()) {
      await this.setupSpotifySdkIfPossible();
      if (!this.isSdkReady && !this.sdkError) {
        const ready = await this.waitForSdkReady();
        if (!ready) {
          this.sdkError = 'Spotify is still connecting. Try again after its player is ready.';
        }
      }
    }

    if (activationPromise) {
      await Promise.resolve(activationPromise).catch(error => {
        this.sdkError = error.message || String(error);
      });
    }

    this.currentTrack = resolvedTrack;
    this.currentTime = 0;
    this.duration = (resolvedTrack.duration_ms ? resolvedTrack.duration_ms / 1000 : 180);

    // Stop existing audio
    this.audio.pause();
    this.audio.currentTime = 0;

    // Check playback strategy:
    // Strategy A: Spotify Web Playback SDK (if a playback device is ready and a valid Spotify track URI exists)
    if (this.isSdkReady && this.deviceId && resolvedTrack.uri && resolvedTrack.uri.startsWith('spotify:track:')) {
      try {
        await spotifyApiPlay(resolvedTrack.uri, this.deviceId);
        this.playbackMode = 'sdk';
        this.isPlaying = true;
        this.sdkError = null;
        this.emitTrackChange();
        this.emitStateChange();
        return;
      } catch (sdkError) {
        console.warn('Spotify SDK play failed, checking alternative options:', sdkError);
        this.sdkError = sdkError.message || String(sdkError);
      }
    }

    // Strategy B: 30-sec Preview Audio URL (if provided by Spotify or source)
    const previewUrl = resolvedTrack.preview_url || track.preview_url;
    if (previewUrl) {
      try {
        this.audio.src = previewUrl;
        await this.audio.play();
        this.playbackMode = 'preview';
        this.isPlaying = true;
        this.emitTrackChange();
        this.emitStateChange();
        return;
      } catch (previewErr) {
        console.warn('Preview playback failed:', previewErr);
      }
    }

    // Spotify's Web API provides metadata, not full-track audio for this player.
    this.playbackMode = 'unavailable';
    this.isPlaying = false;
    this.emitTrackChange();
    this.emitStateChange();

    const hasSpotifyTrack = /^spotify:track:[A-Za-z0-9]{22}$/.test(resolvedTrack.uri || '');
    const failureReason = this.sdkError || (
      !hasSpotifyTrack
        ? 'No matching Spotify track was found for this item.'
        : !this.deviceId
          ? 'The Spotify playback device is not available.'
          : 'Spotify rejected the play request.'
    );

    this.emitNotice({
      title: !this.isPremium && !previewUrl ? 'Spotify Premium required' : 'Spotify player could not start',
      message: !this.isPremium && !previewUrl
        ? 'Your Spotify account is connected, but Spotify does not provide a playable preview for this track. Full playback in this website requires Spotify Premium and the Web Playback SDK.'
        : `The track was not played. ${failureReason}`,
      track: resolvedTrack
    });
  }

  /**
   * Toggle Play / Pause
   */
  async togglePlay() {
    if (!this.currentTrack) {
      if (this.queue.length > 0) {
        this.playTrack(this.queue[0]);
      }
      return;
    }

    if (this.playbackMode === 'sdk' && this.spotifyPlayer) {
      if (this.isPlaying) {
        await spotifyApiPause(this.deviceId);
      } else {
        await spotifyApiPlay(this.currentTrack.uri, this.deviceId);
      }
    } else if (this.playbackMode === 'preview') {
      if (this.isPlaying) {
        this.audio.pause();
      } else {
        await this.audio.play();
      }
    } else if (this.playbackMode === 'unavailable') {
      this.playTrack(this.currentTrack);
    }
  }

  setQueue(tracks) {
    if (!Array.isArray(tracks)) {
      throw new TypeError('Playback queue must be an array.');
    }

    this.queue = [...tracks];
    this.currentIndex = this.currentTrack
      ? this.queue.findIndex((track) => (
        (this.currentTrack.uri && track.uri === this.currentTrack.uri)
        || (this.currentTrack.id && track.id === this.currentTrack.id)
      ))
      : -1;
    this.emitEvent('queue-changed', {
      queue: this.queue,
      currentIndex: this.currentIndex,
    });
  }

  /**
   * Play Next Track in Queue
   */
  next() {
    if (this.queue.length === 0) return;

    if (this.repeatMode === 'one' && this.currentTrack) {
      this.playTrack(this.currentTrack);
      return;
    }

    if (this.isShuffle) {
      let nextIndex = Math.floor(Math.random() * this.queue.length);
      if (this.queue.length > 1 && nextIndex === this.currentIndex) {
        nextIndex = (nextIndex + 1) % this.queue.length;
      }
      this.currentIndex = nextIndex;
      this.playTrack(this.queue[this.currentIndex]);
      return;
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this.playTrack(this.queue[this.currentIndex]);
    } else if (this.repeatMode === 'all') {
      this.currentIndex = 0;
      this.playTrack(this.queue[this.currentIndex]);
    } else {
      this.isPlaying = false;
      this.emitStateChange();
      this.emitEvent('queue-finished', {
        track: this.currentTrack,
        playbackMode: this.playbackMode
      });
    }
  }

  /**
   * Play Previous Track in Queue
   */
  previous() {
    // If played more than 3 seconds, restart current track
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.queue.length === 0) return;

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playTrack(this.queue[this.currentIndex]);
    } else if (this.repeatMode === 'all') {
      this.currentIndex = this.queue.length - 1;
      this.playTrack(this.queue[this.currentIndex]);
    } else {
      this.seek(0);
    }
  }

  /**
   * Seek to specific timestamp in seconds
   * @param {number} seconds 
   */
  async seek(seconds) {
    this.currentTime = Math.max(0, Math.min(seconds, this.duration));

    if (this.playbackMode === 'sdk' && this.spotifyPlayer) {
      await spotifyApiSeek(Math.round(this.currentTime * 1000), this.deviceId);
    } else if (this.playbackMode === 'preview') {
      this.audio.currentTime = this.currentTime;
    }

    this.emitTimeUpdate();
  }

  /**
   * Set volume (0.0 to 1.0)
   * @param {number} volume 
   */
  async setVolume(volume) {
    this.volume = Math.max(0, Math.min(volume, 1));
    this.audio.volume = this.volume;
    this.isMuted = (this.volume === 0);

    localStorage.setItem(STORAGE_KEYS.VOLUME, this.volume.toString());

    if (this.playbackMode === 'sdk' && this.spotifyPlayer) {
      await spotifyApiSetVolume(Math.round(this.volume * 100), this.deviceId);
    }

    this.emitEvent('volume-changed', { volume: this.volume, isMuted: this.isMuted });
  }

  /**
   * Toggle Mute / Unmute
   */
  toggleMute() {
    if (this.isMuted) {
      this.setVolume(this.previousVolume || 0.75);
    } else {
      this.previousVolume = this.volume > 0 ? this.volume : 0.75;
      this.setVolume(0);
    }
  }

  /**
   * Toggle Shuffle mode
   */
  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.emitEvent('shuffle-changed', { isShuffle: this.isShuffle });
  }

  /**
   * Cycle Repeat mode: none -> all -> one -> none
   */
  cycleRepeatMode() {
    if (this.repeatMode === 'none') {
      this.repeatMode = 'all';
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else {
      this.repeatMode = 'none';
    }
    this.emitEvent('repeat-changed', { repeatMode: this.repeatMode });
  }

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.playTrack(this.currentTrack);
    } else {
      this.next();
    }
  }

  emitTrackChange() {
    this.emitEvent('track-changed', {
      track: this.currentTrack,
      playbackMode: this.playbackMode
    });
  }

  emitStateChange() {
    this.emitEvent('playback-state-changed', {
      isPlaying: this.isPlaying,
      playbackMode: this.playbackMode
    });
  }

  emitTimeUpdate() {
    this.emitEvent('time-updated', {
      currentTime: this.currentTime,
      duration: this.duration,
      progressPercent: this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
    });
  }

  emitNotice(noticeData) {
    this.emitEvent('playback-notice', noticeData);
  }

  emitEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(`music-player-${name}`, { detail }));
  }
}

export const musicPlayer = new MusicPlayer();
