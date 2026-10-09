/**
 * Spotify Web API Client
 * Wraps REST endpoints for search, track data, artist data, user playlists, and playback.
 */

import { SPOTIFY_API_BASE } from './config.js';
import { getValidAccessToken, refreshAccessToken, logoutSpotify } from './spotify-auth.js';

/**
 * Base wrapper for Spotify Web API requests with auto-token attachment and 401 retry
 * @param {string} endpoint - Path relative to /v1 or absolute URL
 * @param {object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function spotifyFetch(endpoint, options = {}) {
  let token = await getValidAccessToken();

  if (!token) {
    throw new Error('NOT_AUTHENTICATED: Please connect your Spotify account.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, token might have just expired. Refresh and retry once.
  if (response.status === 401) {
    console.warn('Spotify API returned 401 Unauthorized. Attempting token refresh...');
    token = await refreshAccessToken();
    if (!token) {
      logoutSpotify();
      throw new Error('SESSION_EXPIRED: Spotify session has expired. Please log in again.');
    }
    headers['Authorization'] = `Bearer ${token}`;
    response = await fetch(url, { ...options, headers });
  }

  if (response.status === 204) {
    // 204 No Content (e.g. playback commands)
    return null;
  }

  if (!response.ok) {
    let errorDetail = `Spotify API error: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch (_) {}
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

/**
 * Get current user profile
 * @returns {Promise<object>}
 */
export async function getCurrentUserProfile() {
  return await spotifyFetch('/me');
}

/**
 * Search Spotify for tracks, artists, and playlists
 * @param {string} query 
 * @param {string} type - Comma-separated types: 'track,artist,playlist'
 * @param {number} limit 
 * @returns {Promise<object>}
 */
export async function searchSpotify(query, type = 'track,artist', limit = 10) {
  if (!query || !query.trim()) {
    return {
      tracks: { items: [] },
      artists: { items: [] }
    };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);

  const params = new URLSearchParams({
    q: query.trim(),
    type: type,
    limit: safeLimit.toString()
  });

  return await spotifyFetch(`/search?${params.toString()}`);
}

export async function searchSpotifyMoodTracks(query, limit = 50) {
  if (!query?.trim()) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);
  const params = new URLSearchParams({
    q: query.trim(),
    type: 'track',
    limit: String(safeLimit),
  });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  return data.tracks?.items || [];
}

/**
 * Get a single track by Spotify ID
 * @param {string} trackId 
 * @returns {Promise<object>}
 */
export async function getTrack(trackId) {
  return await spotifyFetch(`/tracks/${trackId}`);
}

/**
 * Get an artist's profile details
 * @param {string} artistId 
 * @returns {Promise<object>}
 */
export async function getArtist(artistId) {
  return await spotifyFetch(`/artists/${artistId}`);
}

/**
 * Get an artist's top tracks
 * @param {string} artistId 
 * @param {string} market 
 * @returns {Promise<object>}
 */
export async function getArtistTopTracks(artistId, market = 'US') {
  return await spotifyFetch(`/artists/${artistId}/top-tracks?market=${market}`);
}

/**
 * Get related / similar artists
 * @param {string} artistId 
 * @returns {Promise<object>}
 */
export async function getArtistRelatedArtists(artistId) {
  return await spotifyFetch(`/artists/${artistId}/related-artists`);
}

/**
 * Get current user's playlists
 * @param {number} limit 
 * @returns {Promise<object>}
 */
export async function getUserPlaylists(limit = 50) {
  return await spotifyFetch(`/me/playlists?limit=${limit}`);
}

/**
 * Get a specific playlist
 * @param {string} playlistId 
 * @returns {Promise<object>}
 */
export async function getPlaylist(playlistId) {
  return await spotifyFetch(`/playlists/${playlistId}`);
}

/**
 * Create a new playlist for the current user
 * @param {string} userId 
 * @param {object} playlistData - { name, description, public }
 * @returns {Promise<object>}
 */
export async function createPlaylist(userId, { name, description = '', isPublic = false }) {
  return await spotifyFetch(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name: name,
      description: description,
      public: isPublic
    })
  });
}

/**
 * Add tracks to a playlist
 * @param {string} playlistId 
 * @param {string[]} uris - Array of Spotify URIs (e.g. ["spotify:track:xxxx"])
 * @returns {Promise<object>}
 */
export async function addTracksToPlaylist(playlistId, uris) {
  return await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris })
  });
}

/**
 * Remove tracks from a playlist
 * @param {string} playlistId 
 * @param {string[]} uris 
 * @returns {Promise<object>}
 */
export async function removeTracksFromPlaylist(playlistId, uris) {
  const tracks = uris.map(uri => ({ uri }));
  return await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'DELETE',
    body: JSON.stringify({ tracks })
  });
}

/**
 * Playback Control (Spotify Connect / Web Playback SDK device control)
 */

/**
 * Get active user devices
 * @returns {Promise<object>}
 */
export async function getAvailableDevices() {
  return await spotifyFetch('/me/player/devices');
}

/**
 * Transfer playback to a specific device
 * @param {string} deviceId 
 * @param {boolean} play 
 */
export async function transferPlayback(deviceId, play = false) {
  return await spotifyFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [deviceId],
      play: play
    })
  });
}

/**
 * Start or resume playback of tracks on active Spotify device
 * @param {string|string[]} uris 
 * @param {string} [deviceId]
 */
export async function playTrack(uris, deviceId = null) {
  const endpoint = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
  const uriArray = Array.isArray(uris) ? uris : [uris];
  return await spotifyFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify({ uris: uriArray })
  });
}

/**
 * Pause playback on active Spotify device
 * @param {string} [deviceId]
 */
export async function pausePlayback(deviceId = null) {
  const endpoint = deviceId ? `/me/player/pause?device_id=${deviceId}` : '/me/player/pause';
  return await spotifyFetch(endpoint, { method: 'PUT' });
}

/**
 * Skip to next track
 */
export async function nextTrack(deviceId = null) {
  const endpoint = deviceId ? `/me/player/next?device_id=${deviceId}` : '/me/player/next';
  return await spotifyFetch(endpoint, { method: 'POST' });
}

/**
 * Skip to previous track
 */
export async function previousTrack(deviceId = null) {
  const endpoint = deviceId ? `/me/player/previous?device_id=${deviceId}` : '/me/player/previous';
  return await spotifyFetch(endpoint, { method: 'POST' });
}

/**
 * Seek to position in ms
 * @param {number} positionMs 
 */
export async function seekPlayback(positionMs, deviceId = null) {
  const endpoint = deviceId ? `/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}` : `/me/player/seek?position_ms=${positionMs}`;
  return await spotifyFetch(endpoint, { method: 'PUT' });
}

/**
 * Set playback volume (0 to 100)
 * @param {number} volumePercent 
 */
export async function setVolume(volumePercent, deviceId = null) {
  const endpoint = deviceId ? `/me/player/volume?volume_percent=${volumePercent}&device_id=${deviceId}` : `/me/player/volume?volume_percent=${volumePercent}`;
  return await spotifyFetch(endpoint, { method: 'PUT' });
}
