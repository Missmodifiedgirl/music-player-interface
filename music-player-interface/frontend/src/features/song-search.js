import { getTrendingTracks } from '../lastfm-api.js';
import { searchSpotify } from '../spotify-api.js';
import { isAuthenticated } from '../spotify-auth.js';
import { getPlaceholderSvg } from '../utils.js';
import { addLanguageToSearch } from '../music-languages.js';

export async function findTracks(query, language = 'Any language') {
  const searchQuery = addLanguageToSearch(query, language);
  if (!searchQuery) return [];

  if (isAuthenticated()) {
    const result = await searchSpotify(searchQuery, 'track', 12);
    const tracks = (result.tracks?.items || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown Artist',
      album: track.album?.name || '',
      image: track.album?.images?.[0]?.url || getPlaceholderSvg(track.name),
      duration_ms: track.duration_ms,
      uri: track.uri,
      preview_url: track.preview_url,
      spotifyUrl: track.external_urls?.spotify,
    }));
    if (tracks.length) return tracks;
  }

  const trending = await getTrendingTracks(1, 30);
  const keywords = searchQuery.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const matched = trending.filter((track) => keywords.some((word) => `${track.name} ${track.artist}`.toLowerCase().includes(word)));
  return (matched.length ? matched : language === 'Any language' ? trending : []).slice(0, 12);
}
