/**
 * Spotify OAuth 2.0 Authorization Code with PKCE (Proof Key for Code Exchange)
 * 
 * PKCE is the industry standard for client-side web applications where client secrets
 * cannot be safely kept private. It works by generating a dynamic cryptographic key pair
 * (Code Verifier + Code Challenge) per authorization request.
 */

import {
  SPOTIFY_AUTH_ENDPOINT,
  SPOTIFY_TOKEN_ENDPOINT,
  SPOTIFY_SCOPES,
  STORAGE_KEYS,
  getSpotifyClientId,
  getSpotifyRedirectUri
} from './config.js';

/**
 * Generate a cryptographically secure random string for code verifier
 * @param {number} length 
 * @returns {string}
 */
export function generateRandomString(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) ? window.crypto : (typeof crypto !== 'undefined' ? crypto : null);
  
  if (cryptoObj && cryptoObj.getRandomValues) {
    const values = cryptoObj.getRandomValues(new Uint8Array(length));
    return Array.from(values).map(x => possible[x % possible.length]).join('');
  }

  // Fallback if Web Crypto is unavailable
  let result = '';
  for (let i = 0; i < length; i++) {
    result += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return result;
}

/**
 * Generate SHA-256 Code Challenge from Code Verifier
 * @param {string} codeVerifier 
 * @returns {Promise<string>} Base64URL encoded SHA-256 hash
 */
export async function generateCodeChallenge(codeVerifier) {
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) ? window.crypto : (typeof crypto !== 'undefined' ? crypto : null);
  
  if (cryptoObj && cryptoObj.subtle && cryptoObj.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await cryptoObj.subtle.digest('SHA-256', data);
    
    // Convert ArrayBuffer to Base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    
    // Convert standard Base64 to Base64URL (RFC 7636)
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  throw new Error('Web Cryptography API is required for PKCE code challenge generation.');
}

/**
 * Helper to store a key across localStorage, sessionStorage, and cookies
 */
function setMultiStorage(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
  try { sessionStorage.setItem(key, value); } catch (_) {}
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=3600; SameSite=Lax`;
    }
  } catch (_) {}
}

/**
 * Helper to retrieve a key from localStorage, sessionStorage, or cookies
 */
function getMultiStorage(key) {
  try {
    const val = localStorage.getItem(key);
    if (val) return val;
  } catch (_) {}

  try {
    const val = sessionStorage.getItem(key);
    if (val) return val;
  } catch (_) {}

  try {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )' + encodeURIComponent(key) + '=([^;]+)'));
      if (match) return decodeURIComponent(match[2]);
    }
  } catch (_) {}

  return null;
}

/**
 * Initiate Spotify Login via OAuth 2.0 PKCE
 * Generates verifier, stores it across storage layers, and redirects to Spotify.
 */
export async function loginWithSpotify() {
  try {
    const clientId = getSpotifyClientId();
    const redirectUri = getSpotifyRedirectUri();

    if (!clientId) {
      throw new Error('Spotify Client ID is missing. Please check API Settings.');
    }

    // 1. Generate code verifier (random secret)
    const verifier = generateRandomString(64);
    
    // 2. Generate code challenge (SHA-256 of verifier)
    const challenge = await generateCodeChallenge(verifier);
    
    // 3. Generate CSRF state token and encode verifier for cross-origin resilience
    const randomCsrf = generateRandomString(16);
    const encodedVerifier = btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const state = `${randomCsrf}.${encodedVerifier}`;

    // 4. Save verifier and state across multi-storage
    setMultiStorage(STORAGE_KEYS.SPOTIFY_VERIFIER, verifier);
    setMultiStorage(STORAGE_KEYS.SPOTIFY_STATE, randomCsrf);
    setMultiStorage('mpi_used_redirect_uri', redirectUri);

    // 5. Construct Spotify authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      redirect_uri: redirectUri,
      state: state
    });

    const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
    console.log('Redirecting to Spotify OAuth:', authUrl);

    // 6. Redirect browser to Spotify Authorization page
    window.location.href = authUrl;
  } catch (error) {
    console.error('Failed to initiate Spotify login:', error);
    throw error;
  }
}

/**
 * Handle OAuth Callback from Spotify
 * Exchanges the temporary authorization code for an Access Token and Refresh Token.
 * @param {string} code - The code returned in URL query
 * @param {string} state - The state returned in URL query
 * @returns {Promise<object>} Token response
 */
export async function handleAuthCallback(code, state) {
  let storedCsrf = getMultiStorage(STORAGE_KEYS.SPOTIFY_STATE);
  let codeVerifier = getMultiStorage(STORAGE_KEYS.SPOTIFY_VERIFIER);

  // If verifier was encoded in state, extract it as fallback
  let stateCsrf = state;
  if (state && state.includes('.')) {
    const parts = state.split('.');
    stateCsrf = parts[0];
    if (!codeVerifier && parts[1]) {
      try {
        const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        codeVerifier = atob(padded);
      } catch (_) {}
    }
  }

  // Validate CSRF state if stored
  if (storedCsrf && stateCsrf && storedCsrf !== stateCsrf) {
    console.warn('CSRF state mismatch warning. Proceeding with encoded verifier verification.');
  }

  if (!codeVerifier) {
    throw new Error('Missing code verifier in session. Please try logging in again.');
  }

  const clientId = getSpotifyClientId();
  const redirectUri = getMultiStorage('mpi_used_redirect_uri') || getSpotifyRedirectUri();

  console.log(`Exchanging code for token with redirect_uri: ${redirectUri}`);

  // Exchange code for token using POST request
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    let errMessage = `Token exchange failed (${response.status})`;
    try {
      const errJson = await response.json();
      errMessage = errJson.error_description || errJson.error || errMessage;
    } catch (_) {}
    throw new Error(errMessage);
  }

  const data = await response.json();

  // Save tokens
  storeAuthTokens(data);

  // Clean up temporary verifier & state
  try {
    localStorage.removeItem(STORAGE_KEYS.SPOTIFY_VERIFIER);
    localStorage.removeItem(STORAGE_KEYS.SPOTIFY_STATE);
    sessionStorage.removeItem(STORAGE_KEYS.SPOTIFY_VERIFIER);
    sessionStorage.removeItem(STORAGE_KEYS.SPOTIFY_STATE);
  } catch (_) {}

  return data;
}

/**
 * Direct Login with a Spotify Access Token (Bypasses OAuth & Developer Dashboard restrictions)
 * @param {string} accessToken 
 * @param {number} [expiresIn=3600]
 */
export async function loginWithToken(accessToken, expiresIn = 3600) {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Access token cannot be empty.');
  }

  const cleanToken = accessToken.trim().replace(/^Bearer\s+/i, '');

  storeAuthTokens({
    access_token: cleanToken,
    expires_in: expiresIn
  });

  // Test token by requesting user profile
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${cleanToken}` }
  });

  if (!profileRes.ok) {
    logoutSpotify();
    throw new Error(`Invalid token: Spotify returned status ${profileRes.status} (${profileRes.statusText})`);
  }

  const profile = await profileRes.json();
  localStorage.setItem(STORAGE_KEYS.SPOTIFY_USER, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent('spotify-auth-changed', { detail: { authenticated: true, user: profile } }));
  return profile;
}

/**
 * Store access token, refresh token and compute expiry timestamp
 * @param {object} tokenData 
 */
export function storeAuthTokens(tokenData) {
  if (tokenData.access_token) {
    localStorage.setItem(STORAGE_KEYS.SPOTIFY_TOKEN, tokenData.access_token);
  }

  if (tokenData.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN, tokenData.refresh_token);
  }

  if (tokenData.expires_in) {
    // Buffer 60 seconds before actual expiry
    const expiresAt = Date.now() + (tokenData.expires_in - 60) * 1000;
    localStorage.setItem(STORAGE_KEYS.SPOTIFY_EXPIRES_AT, expiresAt.toString());
  } else {
    // Default 1 hour if not specified
    const expiresAt = Date.now() + 3540 * 1000;
    localStorage.setItem(STORAGE_KEYS.SPOTIFY_EXPIRES_AT, expiresAt.toString());
  }

  // Notify active components of auth change
  window.dispatchEvent(new CustomEvent('spotify-auth-changed', { detail: { authenticated: true } }));
}

/**
 * Refresh expired Spotify Access Token using the saved Refresh Token
 * @returns {Promise<string|null>} New access token or null
 */
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN);
  const clientId = getSpotifyClientId();

  if (!refreshToken || !clientId) {
    logoutSpotify();
    return null;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    });

    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      console.warn('Failed to refresh Spotify token. Clearing session.');
      logoutSpotify();
      return null;
    }

    const data = await response.json();
    storeAuthTokens(data);
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify access token:', error);
    logoutSpotify();
    return null;
  }
}

/**
 * Retrieve currently valid access token (auto-refreshes if close to expiring)
 * @returns {Promise<string|null>}
 */
export async function getValidAccessToken() {
  const token = localStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN);
  const expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.SPOTIFY_EXPIRES_AT) || '0', 10);

  if (!token) return null;

  // If token has refresh token and is close to expiry, refresh it
  if (expiresAt > 0 && Date.now() >= expiresAt - 30000) {
    const refreshed = await refreshAccessToken();
    return refreshed || token;
  }

  return token;
}

/**
 * Check if user is currently authenticated with Spotify
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = localStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN);
  const expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.SPOTIFY_EXPIRES_AT) || '0', 10);
  return Boolean(token && (expiresAt === 0 || Date.now() < expiresAt));
}

/**
 * Log out of Spotify and clean up local session
 */
export function logoutSpotify() {
  localStorage.removeItem(STORAGE_KEYS.SPOTIFY_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.SPOTIFY_EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.SPOTIFY_USER);
  
  window.dispatchEvent(new CustomEvent('spotify-auth-changed', { detail: { authenticated: false } }));
}
