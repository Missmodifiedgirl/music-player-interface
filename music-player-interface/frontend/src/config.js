/**
 * Application Configuration & Constants
 * Contains API keys, endpoints, and localStorage keys.
 */

// Spotify Configuration
export const DEFAULT_SPOTIFY_CLIENT_ID = 'b7fd3c1f2e0e4661afd54d4a46ad834c';
export const DEFAULT_SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:5173/callback';

export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Spotify OAuth 2.0 PKCE Scopes
export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
  'user-top-read'
].join(' ');

// LocalStorage Keys
export const STORAGE_KEYS = {
  SPOTIFY_TOKEN: 'mpi_spotify_access_token',
  SPOTIFY_REFRESH_TOKEN: 'mpi_spotify_refresh_token',
  SPOTIFY_EXPIRES_AT: 'mpi_spotify_expires_at',
  SPOTIFY_VERIFIER: 'mpi_spotify_code_verifier',
  SPOTIFY_STATE: 'mpi_spotify_auth_state',
  SPOTIFY_USER: 'mpi_spotify_user_profile',
  CUSTOM_CLIENT_ID: 'mpi_custom_spotify_client_id',
  CUSTOM_REDIRECT_URI: 'mpi_custom_spotify_redirect_uri',
  PLAYLISTS: 'mpi_playlists',
  LIKED_TRACKS: 'mpi_liked_tracks',
  VOLUME: 'mpi_player_volume',
  RECENT_SEARCHES: 'mpi_recent_searches'
};

/**
 * Get active Spotify Client ID (custom or default)
 */
export function getSpotifyClientId() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.CUSTOM_CLIENT_ID) || DEFAULT_SPOTIFY_CLIENT_ID;
  }
  return DEFAULT_SPOTIFY_CLIENT_ID;
}

/**
 * Get active Redirect URI
 */
export function getSpotifyRedirectUri() {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_KEYS.CUSTOM_REDIRECT_URI);
    if (custom) return custom;
  }
  return DEFAULT_SPOTIFY_REDIRECT_URI;
}
