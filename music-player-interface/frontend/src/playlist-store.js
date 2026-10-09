/**
 * Playlist Management System
 * Handles local playlists with localStorage persistence
 * and Spotify integration.
 */

import { STORAGE_KEYS } from './config.js';
import {
  createPlaylist as createSpotifyPlaylist,
  addTracksToPlaylist as addTracksToSpotify,
  getCurrentUserProfile,
  searchSpotify
} from './spotify-api.js';
import { isAuthenticated } from './spotify-auth.js';

const DEFAULT_PLAYLISTS = [
  {
    id: 'liked-songs',
    name: 'Liked Songs',
    description: 'Your favorite tracks in one place',
    isLiked: true,
    coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
    tracks: []
  },
  {
    id: 'chill-vibes',
    name: 'Chill & Focus Vibes',
    description: 'Relaxing ambient and smooth contemporary grooves',
    isLiked: false,
    coverArt: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80',
    tracks: []
  }
];

class PlaylistStore {
  constructor() {
    this.playlists = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);

      if (data) {
        this.playlists = JSON.parse(data);

        if (!Array.isArray(this.playlists)) {
          this.playlists = [];
        }
      }

      if (!this.playlists.length) {
        this.playlists = DEFAULT_PLAYLISTS.map(playlist => ({
          ...playlist,
          tracks: [...playlist.tracks]
        }));

        this.saveToStorage();
      }

    } catch (error) {
      console.error('Error loading playlists:', error);

      this.playlists = DEFAULT_PLAYLISTS.map(playlist => ({
        ...playlist,
        tracks: [...playlist.tracks]
      }));

      this.saveToStorage();
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PLAYLISTS,
        JSON.stringify(this.playlists)
      );

      window.dispatchEvent(
        new CustomEvent('playlists-updated', {
          detail: {
            playlists: this.playlists
          }
        })
      );

    } catch (error) {
      console.error('Error saving playlists:', error);
    }
  }

  getAllPlaylists() {
    return this.playlists;
  }

  getPlaylistById(id) {
    return this.playlists.find(
      playlist => String(playlist.id) === String(id)
    ) || null;
  }

  createPlaylist({
    name,
    description = '',
    coverArt = null
  }) {

    if (!name || !name.trim()) {
      throw new Error('Playlist name cannot be empty.');
    }

    const defaultCovers = [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80'
    ];

    const newPlaylist = {
      id: `pl-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}`,

      name: name.trim(),

      description: description.trim(),

      coverArt:
        coverArt ||
        defaultCovers[
          Math.floor(Math.random() * defaultCovers.length)
        ],

      isLiked: false,

      tracks: [],

      createdAt: new Date().toISOString()
    };

    this.playlists.push(newPlaylist);

    this.saveToStorage();

    return newPlaylist;
  }

  deletePlaylist(id) {

    if (id === 'liked-songs') {
      throw new Error(
        'The "Liked Songs" playlist cannot be deleted.'
      );
    }

    this.playlists = this.playlists.filter(
      playlist => playlist.id !== id
    );

    this.saveToStorage();
  }

  addTrackToPlaylist(playlistId, track) {

    const playlist = this.getPlaylistById(playlistId);

    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    if (!track || !track.name) {
      throw new Error('Invalid track.');
    }

    if (!Array.isArray(playlist.tracks)) {
      playlist.tracks = [];
    }

    const trackId = track.id || null;
    const trackUri = track.uri || null;

    const alreadyExists = playlist.tracks.some(existingTrack => {

      if (
        trackUri &&
        existingTrack.uri &&
        trackUri === existingTrack.uri
      ) {
        return true;
      }

      if (
        trackId &&
        existingTrack.id &&
        trackId === existingTrack.id
      ) {
        return true;
      }

      const existingName =
        String(existingTrack.name || '').toLowerCase();

      const existingArtist =
        String(existingTrack.artist || '').toLowerCase();

      const newName =
        String(track.name || '').toLowerCase();

      const newArtist =
        String(track.artist || '').toLowerCase();

      return (
        existingName === newName &&
        existingArtist === newArtist
      );
    });

    if (alreadyExists) {
      return false;
    }

    const standardizedTrack = {
      id:
        track.id ||
        `track-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 7)}`,

      name: track.name,

      artist:
        track.artist ||
        track.artists?.[0]?.name ||
        'Unknown Artist',

      album:
        track.album ||
        track.album?.name ||
        'Unknown Album',

      image:
        track.image ||
        track.albumArt ||
        track.album?.images?.[0]?.url ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',

      duration_ms:
        track.duration_ms ||
        210000,

      uri:
        track.uri ||
        (
          track.id
            ? `spotify:track:${track.id}`
            : null
        ),

      spotifyUrl:
        track.spotifyUrl ||
        (
          track.id
            ? `https://open.spotify.com/track/${track.id}`
            : null
        ),

      preview_url:
        track.preview_url ||
        null,

      dateAdded:
        new Date().toISOString()
    };

    playlist.tracks.unshift(standardizedTrack);

    if (
      !playlist.coverArt ||
      playlist.coverArt.includes('unsplash')
    ) {
      playlist.coverArt = standardizedTrack.image;
    }

    this.saveToStorage();

    return true;
  }

  removeTrackFromPlaylist(playlistId, trackIdOrUri) {

    const playlist = this.getPlaylistById(playlistId);

    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    playlist.tracks = playlist.tracks.filter(track => {

      return (
        track.id !== trackIdOrUri &&
        track.uri !== trackIdOrUri
      );

    });

    this.saveToStorage();
  }

  isTrackLiked(track) {

    const likedPlaylist =
      this.getPlaylistById('liked-songs');

    if (!likedPlaylist) {
      return false;
    }

    return likedPlaylist.tracks.some(existingTrack => {

      if (
        track.uri &&
        existingTrack.uri &&
        track.uri === existingTrack.uri
      ) {
        return true;
      }

      if (
        track.id &&
        existingTrack.id &&
        track.id === existingTrack.id
      ) {
        return true;
      }

      return (
        String(existingTrack.name || '').toLowerCase() ===
          String(track.name || '').toLowerCase() &&

        String(existingTrack.artist || '').toLowerCase() ===
          String(
            track.artist ||
            track.artists?.[0]?.name ||
            ''
          ).toLowerCase()
      );
    });
  }

  toggleLikedTrack(track) {

    const likedPlaylist =
      this.getPlaylistById('liked-songs');

    if (!likedPlaylist) {
      return false;
    }

    if (this.isTrackLiked(track)) {

      this.removeTrackFromPlaylist(
        'liked-songs',
        track.id || track.uri
      );

      return false;
    }

    this.addTrackToPlaylist(
      'liked-songs',
      track
    );

    return true;
  }

  async exportPlaylistToSpotify(playlistId) {

    if (!isAuthenticated()) {
      throw new Error(
        'Please connect your Spotify account first.'
      );
    }

    const localPlaylist =
      this.getPlaylistById(playlistId);

    if (!localPlaylist) {
      throw new Error('Local playlist not found.');
    }

    const userProfile =
      await getCurrentUserProfile();

    if (!userProfile?.id) {
      throw new Error(
        'Failed to retrieve Spotify user profile.'
      );
    }

    const spotifyPlaylist =
      await createSpotifyPlaylist(
        userProfile.id,
        {
          name:
            `${localPlaylist.name} (via Music Player)`,

          description:
            localPlaylist.description ||
            'Exported from Music Player Interface',

          isPublic: false
        }
      );

    const urisToAdd = [];

    for (const track of localPlaylist.tracks) {

      if (
        track.uri &&
        track.uri.startsWith('spotify:track:')
      ) {

        urisToAdd.push(track.uri);

      } else {

        try {

          const searchResult =
            await searchSpotify(
              `${track.name} ${track.artist}`,
              'track',
              1
            );

          if (
            searchResult.tracks?.items?.length
          ) {

            urisToAdd.push(
              searchResult.tracks.items[0].uri
            );
          }

        } catch (error) {
          console.warn(
            'Could not resolve track:',
            track.name
          );
        }
      }
    }

    if (urisToAdd.length > 0) {

      await addTracksToSpotify(
        spotifyPlaylist.id,
        urisToAdd
      );
    }

    return spotifyPlaylist;
  }
}

export const playlistStore =
  new PlaylistStore();