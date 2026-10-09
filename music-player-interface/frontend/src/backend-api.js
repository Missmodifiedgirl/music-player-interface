/**
 * Django backend API client.
 * Shared Django API client for local data and server-side music API requests.
 */

export const BACKEND_API_BASE =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000/api";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BACKEND_API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(`Network error reaching the Django backend: ${error.message}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let data = {};
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`Django returned invalid JSON (HTTP ${response.status}): ${error.message}`);
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || `Backend request failed (HTTP ${response.status})`);
    error.status = response.status;
    error.response = data;
    throw error;
  }

  return data;
}

async function getEmotionalJourney(mood, accessToken) {
  const params = new URLSearchParams({ mood });
  const url = `${BACKEND_API_BASE}/emotional-journey/?${params.toString()}`;
  console.info("[EmotionalJourney] Requesting mood recommendations", {
    url,
    params: { mood },
    spotifyAccessTokenAvailable: Boolean(accessToken),
  });
  return request(`/emotional-journey/?${params.toString()}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

async function getMusicThroughTime(filters, accessToken) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return request(`/music-through-time/?${params.toString()}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export const backendApi = {
  health: () => request("/health/"),
  getEmotionalJourney,
  getMusicThroughTime,
  lastfm: (params) =>
    request("/lastfm/", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  signup: (name, email, password) =>
    request("/auth/signup/", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email, password) =>
    request("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/auth/logout/", { method: "POST" }),
  me: () => request("/auth/me/"),
  getPlaylists: () => request("/playlists/"),
  createPlaylist: (payload) =>
    request("/playlists/create/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePlaylist: (id, payload) =>
    request(`/playlists/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePlaylist: (id) =>
    request(`/playlists/${id}/delete/`, { method: "DELETE" }),
  addTrack: (playlistId, track) =>
    request(`/playlists/${playlistId}/tracks/`, {
      method: "POST",
      body: JSON.stringify(track),
    }),
  deleteTrack: (playlistId, trackDbId) =>
    request(`/playlists/${playlistId}/tracks/${trackDbId}/`, {
      method: "DELETE",
    }),
};
