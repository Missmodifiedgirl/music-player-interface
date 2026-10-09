import React, { useEffect, useMemo, useState } from 'react';
import { getArtistInfo, getSimilarArtistsLastFm } from '../../lastfm-api.js';
import { getCurrentMood, getJournalEntries } from '../music-journal/journal-store.js';
import { getPlaceholderSvg } from '../../utils.js';
import './MusicDNA.css';

const PALETTE = ['#d5a7ff', '#7ddbd0', '#f3bb79', '#f187ae', '#83a9ff', '#c0db8a'];
const MOOD_DETAILS = {
  happy: ['😊', 'Happy', '#f4c95d'],
  calm: ['😌', 'Calm', '#70c7b2'],
  sad: ['🥹', 'Emotional', '#7ea6ee'],
  loved: ['❤️', 'Loved', '#ef88a5'],
  relaxed: ['🌿', 'Relaxed', '#ae91e8'],
  angry: ['🔥', 'Intense', '#ef826d'],
  hopeful: ['🌤️', 'Hopeful', '#f0a55f'],
  nostalgic: ['💭', 'Nostalgic', '#d38bd8'],
  focused: ['🎯', 'Focused', '#77b9e8'],
  tired: ['🌙', 'Tired', '#aaa7c8'],
  motivated: ['🔥', 'Motivated', '#f0a55f'],
  romantic: ['❤️', 'Romantic', '#ef88a5'],
  energetic: ['⚡', 'Energetic', '#f4c95d'],
  emotional: ['🥹', 'Emotional', '#7ea6ee'],
};

function getEntryDate(entry) {
  const parsed = new Date(entry.playedAt || `${entry.date || ''}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(seconds) {
  if (!seconds) return 'Not enough session data yet';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function getHourLabel(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const clockHour = hour % 12 || 12;
  return `${clockHour} ${period}`;
}

function getPersonality({ totalPlays, nightShare, uniqueArtistShare, replayShare, moodCounts }) {
  if (!totalPlays) {
    return {
      title: 'Your sound is taking shape',
      emoji: '✨',
      description: 'Every listen adds a new strand. Come back as your Music Journal gathers more of your listening moments.',
      basis: 'Your profile will grow with your listening history',
    };
  }

  const moodTotal = Object.values(moodCounts).reduce((sum, count) => sum + count, 0);
  const moodShare = (name) => moodTotal ? (moodCounts[name] || 0) / moodTotal : 0;
  if (nightShare >= 0.35) {
    return {
      title: 'The Night Listener',
      emoji: '🌙',
      description: 'You feel most connected to music when the world gets quiet. Your listening history tends to come alive after dark.',
      basis: `${Math.round(nightShare * 100)}% of your logged listens happen at night`,
    };
  }
  if (moodShare('loved') + moodShare('romantic') >= 0.3) {
    return {
      title: 'The Romantic Soul',
      emoji: '❤️',
      description: 'You gravitate toward songs that make room for feeling, closeness, and the little details in a melody.',
      basis: 'Based on the moods you have logged',
    };
  }
  if (moodShare('happy') + moodShare('energetic') + moodShare('motivated') >= 0.35) {
    return {
      title: 'The Energy Seeker',
      emoji: '🔥',
      description: 'Music is a spark for you. Your mood check-ins lean toward bright, energized moments.',
      basis: 'Based on the moods you have logged',
    };
  }
  if (uniqueArtistShare >= 0.65 && totalPlays >= 4) {
    return {
      title: 'The Music Explorer',
      emoji: '🌍',
      description: 'You like to follow a new sound wherever it leads, building a wide-ranging soundtrack along the way.',
      basis: `${Math.round(uniqueArtistShare * 100)}% of your logged plays feature different artists`,
    };
  }
  if (replayShare >= 0.4) {
    return {
      title: 'The Melody Lover',
      emoji: '🎸',
      description: 'When a song connects, you return to it. Familiar melodies are an important part of your musical story.',
      basis: `${Math.round(replayShare * 100)}% of your logged plays revisit a favorite`,
    };
  }
  return {
    title: 'The Emotional Explorer',
    emoji: '🌙',
    description: 'You balance familiar favorites with room for discovery, letting the feeling of a song guide the way.',
    basis: 'A blend of your replay, discovery, and mood patterns',
  };
}

function Ring({ score, children }) {
  return (
    <div className="music-dna__ring" style={{ '--dna-score': `${(score || 0) * 3.6}deg` }}>
      <div><strong>{score === null ? '—' : `${score}%`}</strong><span>{children}</span></div>
    </div>
  );
}

function DnaHelix() {
  return (
    <svg className="music-dna__helix" viewBox="0 0 300 400" role="img" aria-label="Glowing musical DNA helix illustration">
      <defs>
        <linearGradient id="dna-strand-a" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#f3bdff" /><stop offset="1" stopColor="#9274ff" />
        </linearGradient>
        <linearGradient id="dna-strand-b" x1="0" x2="1" y1="1" y2="0">
          <stop stopColor="#63e5d1" /><stop offset="1" stopColor="#759aff" />
        </linearGradient>
        <filter id="dna-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d="M72 12 C254 74 46 126 228 190 C46 254 254 310 72 388" fill="none" stroke="url(#dna-strand-a)" strokeWidth="4" filter="url(#dna-glow)" />
      <path d="M228 12 C46 74 254 126 72 190 C254 254 46 310 228 388" fill="none" stroke="url(#dna-strand-b)" strokeWidth="4" filter="url(#dna-glow)" />
      {[28, 68, 108, 148, 188, 228, 268, 308, 348, 378].map((y, index) => {
        const left = index % 2 ? 97 : 203;
        const right = 300 - left;
        return <g key={y} opacity={index % 3 === 0 ? 0.9 : 0.55}><path d={`M${left} ${y} H${right}`} stroke="#dbd3ff" strokeWidth="1.5" /><circle cx={left} cy={y} r="4" fill="#f0d2ff" /><circle cx={right} cy={y} r="4" fill="#8fe8de" /></g>;
      })}
      <g className="music-dna__note" fill="#f2d9ff"><path d="M253 82v18.5a5 5 0 1 1-3-4.58V86l14-3v14.5a5 5 0 1 1-3-4.58V79z" /><circle cx="43" cy="263" r="4" /><path d="M43 263v-13l11-2v10a4 4 0 1 1-2-3.5v-4.5l-7 1.2v9.8a4 4 0 1 1-2-3z" /></g>
    </svg>
  );
}

function MusicDNA({ playlistStore, musicPlayer, ui }) {
  const [entries, setEntries] = useState(getJournalEntries);
  const [currentMood, setCurrentMood] = useState(getCurrentMood);
  const [artistTags, setArtistTags] = useState({});
  const [similarArtists, setSimilarArtists] = useState([]);
  const [similarArtistsLoading, setSimilarArtistsLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [libraryRevision, setLibraryRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setEntries(getJournalEntries());
      setCurrentMood(getCurrentMood());
    };
    window.addEventListener('music-journal-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('music-journal-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    const refreshLibrary = () => setLibraryRevision((value) => value + 1);
    window.addEventListener('playlists-updated', refreshLibrary);
    return () => window.removeEventListener('playlists-updated', refreshLibrary);
  }, []);

  const playlists = playlistStore?.getAllPlaylists?.() || [];
  const libraryTracks = useMemo(
    () => playlists.flatMap((playlist) => playlist.tracks || []),
    [playlistStore, libraryRevision],
  );
  const profile = useMemo(() => {
    const played = entries.filter((entry) => entry.track?.name);
    const trackCounts = new Map();
    const songCounts = new Map();
    const artistCounts = new Map();
    const genreCounts = new Map();
    const languageCounts = new Map();
    const moodCounts = new Map();
    const hourCounts = Array.from({ length: 24 }, () => 0);
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    let monthSeconds = 0;
    let longestSession = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthArtists = new Set();
    const monthArtists = new Set();

    played.forEach((entry) => {
      const artist = entry.track.artist || 'Unknown artist';
      const trackKey = `${entry.track.name.toLowerCase()}::${artist.toLowerCase()}`;
      trackCounts.set(trackKey, (trackCounts.get(trackKey) || 0) + 1);
      const song = songCounts.get(trackKey) || { ...entry.track, artist, plays: 0 };
      songCounts.set(trackKey, { ...song, plays: song.plays + 1 });
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      const trackGenres = Array.isArray(entry.track.genres)
        ? entry.track.genres
        : (entry.track.genre ? [entry.track.genre] : []);
      trackGenres.forEach((genre) => {
        if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
      const language = entry.track.language;
      if (language) languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      if (entry.mood) moodCounts.set(entry.mood, (moodCounts.get(entry.mood) || 0) + 1);

      const seconds = Math.max(0, Number(entry.listeningSeconds) || 0);
      longestSession = Math.max(longestSession, seconds);
      const date = getEntryDate(entry);
      if (date) {
        hourCounts[date.getHours()] += 1;
        weekdayCounts[date.getDay()] += 1;
        if (date >= monthStart) {
          monthSeconds += seconds;
          monthArtists.add(artist);
        } else {
          lastMonthArtists.add(artist);
        }
      }
    });

    const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const libraryArtistCounts = new Map();
    libraryTracks.forEach((track) => {
      const artist = track.artist || track.artists?.[0]?.name;
      if (artist && !artistCounts.has(artist)) libraryArtistCounts.set(artist, (libraryArtistCounts.get(artist) || 0) + 1);
    });
    const artistsForDisplay = topArtists.length
      ? topArtists
      : [...libraryArtistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLanguages = [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSongs = [...songCounts.values()].sort((a, b) => b.plays - a.plays).slice(0, 5);
    const topMoods = [...moodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const mostReplayed = [...trackCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const distinctArtists = artistCounts.size;
    const discoveryScore = played.length ? Math.round((distinctArtists / played.length) * 100) : 0;
    const repeatedPlays = [...trackCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    const replayShare = played.length ? repeatedPlays / played.length : 0;
    const nightPlays = hourCounts.slice(21).reduce((sum, count) => sum + count, 0) + hourCounts.slice(0, 3).reduce((sum, count) => sum + count, 0);
    const peakHour = hourCounts.reduce((best, count, hour) => count > hourCounts[best] ? hour : best, 0);
    const moodTotal = topMoods.reduce((sum, [, count]) => sum + count, 0);
    const totalGenreCount = topGenres.reduce((sum, [, count]) => sum + count, 0);
    const periodCounts = [
      { label: 'Morning', icon: '🌅', count: hourCounts.slice(5, 12).reduce((sum, count) => sum + count, 0) },
      { label: 'Afternoon', icon: '☀️', count: hourCounts.slice(12, 17).reduce((sum, count) => sum + count, 0) },
      { label: 'Evening', icon: '🌆', count: hourCounts.slice(17, 21).reduce((sum, count) => sum + count, 0) },
      { label: 'Night', icon: '🌙', count: hourCounts.slice(21).concat(hourCounts.slice(0, 5)).reduce((sum, count) => sum + count, 0) },
    ];
    const activePeriod = periodCounts.reduce((best, period) => period.count > best.count ? period : best, periodCounts[0]);
    const weeklyPlays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        count: played.filter((entry) => entry.date === key || getEntryDate(entry)?.toDateString() === date.toDateString()).length,
      };
    });
    const mostActiveDayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const chronologicalPlays = [...played].sort((a, b) => (getEntryDate(a)?.getTime() || 0) - (getEntryDate(b)?.getTime() || 0));
    const midpoint = Math.floor(chronologicalPlays.length / 2);
    const summarizeEra = (era) => {
      const counts = new Map();
      era.forEach((entry) => {
        const labels = [
          ...(Array.isArray(entry.track.genres) ? entry.track.genres : []),
          ...(entry.track.genre ? [entry.track.genre] : []),
          ...(entry.mood ? [entry.mood] : []),
        ];
        labels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1));
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };
    const earlierTaste = summarizeEra(chronologicalPlays.slice(0, midpoint));
    const recentTaste = summarizeEra(chronologicalPlays.slice(midpoint));
    const identityTraits = [];
    if (played.length) {
      if (replayShare >= 0.3) identityTraits.push({ icon: '↻', label: 'A favorite-song revisiter', basis: `${Math.round(replayShare * 100)}% of plays revisit tracks` });
      if (nightPlays / played.length >= 0.3) identityTraits.push({ icon: '🌙', label: 'A night listener', basis: `${Math.round((nightPlays / played.length) * 100)}% of plays happen late` });
      if (distinctArtists / played.length >= 0.65 && distinctArtists >= 4) identityTraits.push({ icon: '🔎', label: 'A music explorer', basis: `${distinctArtists} artists across ${played.length} plays` });
      if (topArtists[0] && topArtists[0][1] / played.length >= 0.4) identityTraits.push({ icon: '🎤', label: 'An artist loyalist', basis: `${topArtists[0][0]} leads your listening` });
      const emotionalMoods = ['sad', 'loved', 'romantic', 'nostalgic', 'emotional'];
      const emotionalPlays = played.filter((entry) => entry.mood && emotionalMoods.includes(entry.mood.toLowerCase())).length;
      if (emotionalPlays / played.length >= 0.3) identityTraits.push({ icon: '♡', label: 'Emotion led', basis: `${emotionalPlays} listens logged with reflective moods` });
      if (topGenres[0]) identityTraits.push({ icon: '♫', label: `${topGenres[0][0]} curious`, basis: 'Your most-played tagged genre' });
    }

    return {
      played,
      trackCounts,
      artistCounts,
      topArtists: artistsForDisplay,
      topGenres,
      topLanguages,
      topSongs,
      topMoods,
      moodTotal,
      totalGenreCount,
      hourCounts,
      weekdayCounts,
      weeklyPlays,
      mostActiveDay: played.length ? new Date(2024, 0, 7 + mostActiveDayIndex).toLocaleDateString(undefined, { weekday: 'long' }) : '',
      periodCounts,
      activePeriod: activePeriod.count ? activePeriod : null,
      earlierTaste,
      recentTaste,
      identityTraits,
      peakHour,
      monthSeconds,
      longestSession,
      monthPlays: played.filter((entry) => {
        const date = getEntryDate(entry);
        return date && date >= monthStart;
      }).length,
      newArtists: [...monthArtists].filter((artist) => !lastMonthArtists.has(artist)).length,
      distinctArtists,
      discoveryScore,
      replayShare,
      replayHabit: replayShare >= 0.4 ? 'High' : replayShare >= 0.15 ? 'Growing' : played.length ? 'Varied' : 'Building',
      nightShare: played.length ? nightPlays / played.length : 0,
      personality: getPersonality({
        totalPlays: played.length,
        nightShare: played.length ? nightPlays / played.length : 0,
        uniqueArtistShare: played.length ? distinctArtists / played.length : 0,
        replayShare,
        moodCounts: Object.fromEntries([...moodCounts].map(([mood, count]) => [mood.toLowerCase(), count])),
      }),
      mostReplayed: mostReplayed ? { name: mostReplayed[0].split('::')[0], artist: mostReplayed[0].split('::')[1], plays: mostReplayed[1] } : null,
      hasHistory: played.length > 0,
    };
  }, [entries, libraryTracks]);

  const artistKey = profile.topArtists.map(([artist]) => artist).filter((artist) => artist && artist !== 'Unknown artist').slice(0, 5).join('\u0000');

  useEffect(() => {
    let cancelled = false;
    const artist = profile.topArtists[0]?.[0];
    if (!artist) {
      setSimilarArtists([]);
      setSimilarArtistsLoading(false);
      return undefined;
    }

    setSimilarArtistsLoading(true);
    getSimilarArtistsLastFm(artist, 6)
      .then((results) => {
        if (!cancelled) {
          const listenedArtists = new Set(profile.topArtists.map(([name]) => name.toLowerCase()));
          setSimilarArtists(results.filter((item) => item.name && !listenedArtists.has(item.name.toLowerCase())).slice(0, 4));
        }
      })
      .finally(() => {
        if (!cancelled) setSimilarArtistsLoading(false);
      });
    return () => { cancelled = true; };
  }, [profile.topArtists]);

  useEffect(() => {
    let cancelled = false;
    const artists = artistKey ? artistKey.split('\u0000') : [];
    if (!artists.length) {
      setArtistTags({});
      return undefined;
    }

    Promise.all(artists.map(async (artist) => {
      const localGenres = profile.played
        .filter((entry) => entry.track?.artist === artist)
        .flatMap((entry) => entry.track.genres || (entry.track.genre ? [entry.track.genre] : []));
      if (localGenres.length) return [artist, localGenres];
      const info = await getArtistInfo(artist);
      if (info.bio?.summary?.startsWith(`${artist} is one of the most prominent musical artists globally`)) return [artist, []];
      return [artist, (info.tags || []).slice(0, 5)];
    }))
      .then((results) => {
        if (cancelled) return;
        setArtistTags(Object.fromEntries(results));
      })
      .catch((error) => {
        console.warn('Could not load Music DNA artist genres:', error);
        if (!cancelled) setArtistTags({});
      });
    return () => { cancelled = true; };
  }, [artistKey]);

  const artistGenreCounts = new Map();
  Object.entries(artistTags).forEach(([artist, tags]) => {
    const plays = profile.artistCounts.get(artist) || 1;
    tags.forEach((tag) => {
      const normalized = String(tag).trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
      if (normalized && !['Seen Live', 'Favorites', 'Beautiful', 'All'].includes(normalized)) {
        artistGenreCounts.set(normalized, (artistGenreCounts.get(normalized) || 0) + plays);
      }
    });
  });
  const genreRows = profile.topGenres.length
    ? profile.topGenres
    : [...artistGenreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const genreTotal = profile.topGenres.length
    ? profile.totalGenreCount
    : genreRows.reduce((sum, [, count]) => sum + count, 0);
  const tasteRecommendations = useMemo(() => {
    const listened = new Set(profile.played.map((entry) => `${entry.track?.name || ''}::${entry.track?.artist || ''}`.toLowerCase()));
    const topArtists = new Set(profile.topArtists.map(([artist]) => artist.toLowerCase()));
    const topGenres = new Set(profile.topGenres.map(([genre]) => genre.toLowerCase()));
    const topLanguages = new Set(profile.topLanguages.map(([language]) => language.toLowerCase()));
    const candidates = new Map();
    libraryTracks.forEach((track) => {
      const artist = track.artist || track.artists?.[0]?.name || 'Unknown artist';
      if (!track.name || listened.has(`${track.name}::${artist}`.toLowerCase())) return;
      const genres = Array.isArray(track.genres) ? track.genres : track.genre ? [track.genre] : [];
      const language = track.language || '';
      const score = (topArtists.has(artist.toLowerCase()) ? 3 : 0)
        + genres.filter((genre) => topGenres.has(String(genre).toLowerCase())).length * 2
        + (language && topLanguages.has(language.toLowerCase()) ? 1 : 0);
      if (score > 0) {
        const key = `${track.name}::${artist}`.toLowerCase();
        const current = candidates.get(key);
        if (!current || current.score < score) candidates.set(key, { track, artist, score });
      }
    });
    return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 5).map(({ track, artist }) => ({ ...track, artist }));
  }, [libraryTracks, profile]);
  const peakRange = profile.hasHistory
    ? `${getHourLabel(profile.peakHour)} – ${getHourLabel((profile.peakHour + 2) % 24)}`
    : 'Waiting for your first listen';
  const currentMoodDetails = MOOD_DETAILS[currentMood?.toLowerCase()] || null;

  const createShareCard = () => [
    '✦ MY MUSIC TASTE · MELODIXA',
    `${profile.personality.title} ${profile.personality.emoji}`,
    `Top Genre: ${profile.topGenres[0]?.[0] || 'Still discovering'}`,
    `Top Language: ${profile.topLanguages[0]?.[0] || 'Not available in listening data'}`,
    `Top Artist: ${profile.topArtists[0]?.[0] || 'Not in your listening history yet'}`,
    `Listening Style: ${profile.identityTraits.slice(0, 2).map((trait) => trait.label).join(' & ') || 'Still taking shape'}`,
    `Favorite Listening Time: ${profile.activePeriod?.label || 'Still discovering'}`,
    '#MyMusicTaste #Melodixa',
  ].join('\n');

  const shareProfile = async () => {
    const text = createShareCard();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Music Taste · Melodixa', text });
        setShareMessage('Your Music Taste profile was shared.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareMessage('Your Music Taste profile was copied to your clipboard.');
      } else {
        setShareMessage('Sharing is not available in this browser.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Could not share Music DNA:', error);
        setShareMessage('Your Music Taste profile could not be shared. Please try again.');
      }
    }
  };

  const playProfileTrack = (track) => {
    if (!track || !musicPlayer?.playTrack) {
      ui?.showToast?.('Playback is not available right now.', 'warning');
      return;
    }
    musicPlayer.playTrack(track);
  };

  const addProfileTrack = (track) => {
    if (!playlistStore || !track) return;
    try {
      const playlist = playlistStore.getAllPlaylists?.().find((item) => item.isLiked || item.id === 'liked-songs')
        || playlistStore.createPlaylist({ name: 'Liked Songs', description: 'Your favorite tracks in one place', coverArt: track.image || track.albumArt });
      const added = playlistStore.addTrackToPlaylist(playlist.id, track);
      ui?.showToast?.(added ? `Added ${track.name} to ${playlist.name}.` : `${track.name} is already in ${playlist.name}.`, added ? 'success' : 'info');
      setLibraryRevision((value) => value + 1);
    } catch (error) {
      console.error('Could not add Music Taste recommendation to playlist:', error);
      ui?.showToast?.('Could not add this song to your playlist. Please try again.', 'error');
    }
  };

  const selectTab = (id) => {
    setActiveTab(id);
    const target = id === 'artists' ? '.music-dna__artists' : id === 'insights' ? '.music-dna__insights' : '.music-dna__hero';
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: id === 'overview' ? 'start' : 'center' });
  };

  return (
    <main className="music-dna">
      <header className="music-dna__topbar">
        <div className="music-dna__brand"><span>✳</span> MELODIXA <i>/</i> YOUR LISTENING IDENTITY</div>
        <div className="music-dna__topbar-actions">
          {currentMoodDetails && <span className="music-dna__current-mood"><span>{currentMoodDetails[0]}</span> Listening in {currentMoodDetails[1]}</span>}
          <span className="music-dna__privacy"><span /> PRIVATE TO YOU</span>
        </div>
      </header>

      <div className="music-dna__layout">
        <section className="music-dna__hero">
          <div className="music-dna__hero-copy">
            <span className="music-dna__eyebrow"><span>✧</span> A PORTRAIT IN SOUND</span>
            <h1>Your Music <em>DNA</em></h1>
            <p className="music-dna__hero-intro">Melodixa doesn’t just know what you listen to.<br /><strong>It starts to understand what moves you.</strong></p>
            <div className="music-dna__personality">
              <span className="music-dna__personality-icon">{profile.personality.emoji}</span>
              <div><span>YOUR LISTENER TYPE</span><h2>{profile.personality.title}</h2><p>{profile.personality.description}</p><small>{profile.personality.basis}</small></div>
            </div>
            <div className="music-dna__hero-meta"><span><strong>{profile.played.length}</strong> logged listens</span><span className="music-dna__meta-dot" /><span><strong>{profile.distinctArtists}</strong> artists in your history</span></div>
          </div>
          <div className="music-dna__helix-wrap">
            <div className="music-dna__orbit music-dna__orbit--one" /><div className="music-dna__orbit music-dna__orbit--two" />
            <DnaHelix />
            <span className="music-dna__float music-dna__float--note">♪</span><span className="music-dna__float music-dna__float--spark">✦</span>
            <div className="music-dna__helix-caption"><span>♪</span> Every listen leaves a trace</div>
          </div>
        </section>

        <nav className="music-dna__tabs" aria-label="Music DNA sections">
          {[['overview', 'Overview'], ['artists', 'Your artists'], ['insights', 'Listening habits']].map(([id, label]) => (
            <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} aria-pressed={activeTab === id} onClick={() => selectTab(id)}>{label}</button>
          ))}
          <span className="music-dna__updated">BUILT FROM YOUR JOURNAL & LIBRARY</span>
        </nav>

        <section className="music-dna__dna-grid" aria-label="Genre and mood DNA">
          <article className="music-dna__panel music-dna__genres">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">THE SOUNDS YOU RETURN TO</span><h2>Your Genre DNA</h2></div><span className="music-dna__heading-glyph">〰</span></div>
            {genreRows.length ? (
              <div className="music-dna__bar-list">{genreRows.map(([genre, count], index) => {
                const percentage = genreTotal ? Math.round((count / genreTotal) * 100) : 0;
                return <div className="music-dna__bar-row" key={genre}><div className="music-dna__bar-label"><span><i style={{ '--row-color': PALETTE[index % PALETTE.length] }} />{genre}</span><strong>{percentage}%</strong></div><div className="music-dna__bar-track"><span style={{ width: `${percentage}%`, '--row-color': PALETTE[index % PALETTE.length], animationDelay: `${index * 90}ms` }} /></div></div>;
              })}</div>
            ) : <div className="music-dna__empty-inline"><span>〰</span><p>Genres will appear as your journal learns what you listen to. Your saved listening history is kept on this device.</p></div>}
            <p className="music-dna__source-note">{profile.topGenres.length ? 'Based on genre details attached to your listening history.' : genreRows.length ? 'Artist-associated tags from Last.fm; these describe artists, not confirmed track genres.' : 'No genre labels found in your saved listening history yet.'}</p>
          </article>

          <article className="music-dna__panel music-dna__moods">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">THE FEELINGS IN YOUR MUSIC</span><h2>Your Mood DNA</h2></div><span className="music-dna__heading-glyph">♡</span></div>
            {profile.topMoods.length ? (
              <div className="music-dna__mood-list">{profile.topMoods.map(([mood, count]) => {
                const details = MOOD_DETAILS[mood.toLowerCase()] || ['✦', mood, '#c3a1e8'];
                const percentage = Math.round((count / profile.moodTotal) * 100);
                return <div className="music-dna__mood-item" key={mood} style={{ '--mood-color': details[2] }}><span className="music-dna__mood-icon">{details[0]}</span><div className="music-dna__mood-copy"><div><strong>{details[1]}</strong><span>{percentage}%</span></div><div className="music-dna__mood-track"><span style={{ width: `${percentage}%` }} /></div></div></div>;
              })}</div>
            ) : <div className="music-dna__empty-inline"><span>♡</span><p>Log a feeling in Emotional Journey or Music Journal and we’ll find the moods that shape your sound.</p></div>}
            <p className="music-dna__source-note">{profile.topMoods.length ? 'Mood check-ins saved with your listening moments.' : 'Mood insights appear after you save a mood with a listening moment.'}</p>
          </article>
        </section>

        <section className="music-dna__middle-grid">
          <article className="music-dna__panel music-dna__artists" aria-label="Your top artists">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">THE VOICES IN YOUR ROTATION</span><h2>Your Top Artists</h2></div><span className="music-dna__subtle-count">{profile.topArtists.length ? `${profile.topArtists.length} of ${profile.artistCounts.size || profile.topArtists.length}` : '—'}</span></div>
            {profile.topArtists.length ? <div className="music-dna__artist-list">{profile.topArtists.slice(0, 5).map(([artist, count], index) => {
              const recentEntry = profile.played.find((entry) => entry.track?.artist === artist && entry.track?.image);
              const libraryTrack = libraryTracks.find((track) => (track.artist || track.artists?.[0]?.name) === artist);
              const image = recentEntry?.track?.image || libraryTrack?.image || libraryTrack?.albumArt;
              const maxCount = profile.topArtists[0][1];
              const width = profile.hasHistory ? Math.round((count / maxCount) * 100) : Math.round((count / profile.topArtists[0][1]) * 100);
              const playableTrack = profile.played.find((entry) => entry.track?.artist === artist)?.track
                || libraryTracks.find((track) => (track.artist || track.artists?.[0]?.name) === artist);
              return <div className="music-dna__artist-row" key={artist}><span className="music-dna__artist-rank">0{index + 1}</span><span className="music-dna__artist-art">{image ? <img src={image} alt="" loading="lazy" /> : <span>♫</span>}</span><div className="music-dna__artist-details"><div><strong>{artist}</strong><small>{profile.hasHistory ? `${count} ${count === 1 ? 'play' : 'plays'}` : 'In your saved library'}</small></div><div className="music-dna__artist-line"><span style={{ width: `${width}%` }} /></div></div>{playableTrack && <button className="music-dna__mini-play" type="button" aria-label={`Play ${artist}`} onClick={() => playProfileTrack(playableTrack)}>▶</button>}</div>;
            })}</div> : <div className="music-dna__empty-inline"><span>♫</span><p>Save music to your library or play songs to meet the artists in your DNA.</p></div>}
          </article>

          <article className="music-dna__panel music-dna__time">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">WHEN YOUR SOUNDTRACK HAPPENS</span><h2>Your Listening Hours</h2></div><span className="music-dna__heading-glyph">◷</span></div>
            <div className="music-dna__peak"><span className="music-dna__peak-moon">{profile.peakHour >= 19 || profile.peakHour < 5 ? '☾' : profile.peakHour >= 5 && profile.peakHour < 12 ? '☼' : '◷'}</span><div><small>YOUR PEAK WINDOW</small><strong>{peakRange}</strong><p>{profile.hasHistory ? 'Your music comes alive around this time.' : 'Your listening rhythm will show up here.'}</p></div></div>
            <div className="music-dna__hours" aria-label="Listening plays by hour of day">{profile.hourCounts.map((count, hour) => {
              const max = Math.max(...profile.hourCounts, 1);
              const height = count ? Math.max(8, Math.round((count / max) * 100)) : 4;
              return <span key={hour} title={`${getHourLabel(hour)}: ${count} ${count === 1 ? 'play' : 'plays'}`} aria-label={`${getHourLabel(hour)}: ${count} plays`} style={{ '--hour-height': `${height}%`, '--hour-opacity': count ? 1 : 0.22 }}><i /></span>;
            })}</div>
            <div className="music-dna__hours-labels"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
          </article>
        </section>

        <section className="music-dna__people-like-me">
          <div className="music-dna__people-heading"><div><span className="music-dna__eyebrow">MUSIC DNA · SHARED SOUND</span><h2>People Like Me <span>✧</span></h2><p>Discover artists connected to the sounds you already return to.</p></div><span className="music-dna__people-source">BASED ON YOUR TOP ARTIST</span></div>
          {profile.topArtists[0] ? <div className="music-dna__similar-strip">
            <div className="music-dna__similar-origin"><span>♫</span><small>YOUR SOUND STARTS WITH</small><strong>{profile.topArtists[0][0]}</strong><i>{profile.topArtists[0][1]} {profile.hasHistory ? 'logged plays' : 'saved tracks'}</i></div>
            <div className="music-dna__similar-artists">{similarArtistsLoading && <p className="music-dna__similar-status">Finding related artists…</p>}
              {!similarArtistsLoading && similarArtists.length ? similarArtists.map((artist) => <a href={artist.url || `https://www.last.fm/music/${encodeURIComponent(artist.name)}`} target="_blank" rel="noreferrer" className="music-dna__similar-artist" key={artist.name}>
                <span>{artist.image ? <img src={artist.image} alt="" loading="lazy" /> : <i>♫</i>}</span><strong>{artist.name}</strong><small>{Math.round(artist.match * 100)}% artist similarity</small><b>Explore ↗</b>
              </a>) : !similarArtistsLoading && <p className="music-dna__similar-status">Related-artist data isn’t available for this artist right now. Keep exploring your library and check back later.</p>}
            </div>
          </div> : <div className="music-dna__similar-empty"><span>♫</span><p>Add tracks to your library or listening journal to discover artists connected to your taste.</p></div>}
          <p className="music-dna__similar-disclaimer">“People Like Me” is an artist-discovery view based on similar-artist metadata. It does not compare you with or identify other listeners.</p>
        </section>

        <section className="music-dna__insights" aria-label="Listening habit insights">
          <div className="music-dna__insights-heading"><div><span className="music-dna__eyebrow">LITTLE THINGS THAT MAKE IT YOURS</span><h2>Your Listening Habits</h2></div><span>PERSONAL, NOT A SCORECARD</span></div>
          <div className="music-dna__stat-grid">
            <article className="music-dna__stat"><span className="music-dna__stat-icon">↻</span><small>MOST REPLAYED</small><strong>{profile.mostReplayed?.name || 'Waiting for a favorite'}</strong><span>{profile.mostReplayed ? `${profile.mostReplayed.plays} logged ${profile.mostReplayed.plays === 1 ? 'play' : 'plays'}` : 'Your repeat song will appear here'}</span></article>
            <article className="music-dna__stat"><span className="music-dna__stat-icon">✧</span><small>NEW-TO-YOU ARTISTS</small><strong>{profile.hasHistory ? profile.newArtists : '—'}</strong><span>{profile.hasHistory ? 'First logged this month' : 'Build a listening history to see this'}</span></article>
            <article className="music-dna__stat"><span className="music-dna__stat-icon">◷</span><small>LONGEST LOGGED SESSION</small><strong>{formatDuration(profile.longestSession)}</strong><span>{profile.longestSession ? 'From Music Journal session data' : 'Session lengths are still being recorded'}</span></article>
            <article className="music-dna__stat"><span className="music-dna__stat-icon">⏱</span><small>LISTENING THIS MONTH</small><strong>{profile.monthSeconds ? formatDuration(profile.monthSeconds) : 'Not recorded yet'}</strong><span>{profile.monthPlays ? `${profile.monthPlays} logged ${profile.monthPlays === 1 ? 'listen' : 'listens'} this month` : 'Time is counted while a session is active'}</span></article>
          </div>
        </section>

        <section className="music-dna__taste-profile" aria-labelledby="music-dna-taste-title">
          <header className="music-dna__taste-heading">
            <div><span className="music-dna__eyebrow">YOUR LONG-TERM LISTENING IDENTITY</span><h2 id="music-dna-taste-title">Your Music Taste</h2><p>A personal portrait shaped by the songs and listening moments you’ve saved.</p></div>
            <span className="music-dna__taste-badge">{profile.personality.emoji} {profile.personality.title}</span>
          </header>
          {!profile.hasHistory ? (
            <div className="music-dna__taste-empty"><span>♫</span><div><strong>Keep listening to discover your Music Taste.</strong><p>Your profile grows from your Music Journal listening history. We’ll reveal your favorites, patterns, and musical identity as you listen.</p></div></div>
          ) : (
            <>
              <div className="music-dna__taste-grid">
                <article className="music-dna__taste-card music-dna__taste-songs">
                  <div className="music-dna__taste-card-title"><div><span>ON REPEAT</span><h3>Your Top Songs</h3></div><b>♪</b></div>
                  {profile.topSongs.length ? <div className="music-dna__taste-song-list">{profile.topSongs.map((song, index) => {
                    const image = song.image || song.albumArt || song.album?.images?.[0]?.url;
                    return <div className="music-dna__taste-song" key={`${song.name}::${song.artist}`}>
                      <span className="music-dna__taste-song-rank">0{index + 1}</span>
                      <img src={image || getPlaceholderSvg(song.name)} alt="" loading="lazy" />
                      <div className="music-dna__taste-song-copy"><strong>{song.name}</strong><span>{song.artist} · {song.plays} {song.plays === 1 ? 'play' : 'plays'}</span></div>
                      <button className="music-dna__mini-play" type="button" aria-label={`Play ${song.name}`} onClick={() => playProfileTrack(song)}>▶</button>
                      <button className="music-dna__mini-save" type="button" aria-label={`Add ${song.name} to playlist`} onClick={() => addProfileTrack(song)}>＋</button>
                    </div>;
                  })}</div> : <p className="music-dna__taste-empty-note">Your most-played songs will appear here.</p>}
                </article>

                <article className="music-dna__taste-card">
                  <div className="music-dna__taste-card-title"><div><span>WORDS THAT MOVE YOU</span><h3>Language Taste</h3></div><b>文</b></div>
                  {profile.topLanguages.length ? <div className="music-dna__taste-bars">{profile.topLanguages.map(([language, count], index) => {
                    const percentage = Math.round((count / profile.topLanguages.reduce((sum, [, plays]) => sum + plays, 0)) * 100);
                    return <div key={language}><div><span>{language}</span><strong>{percentage}%</strong></div><span className="music-dna__taste-track"><i style={{ width: `${percentage}%`, '--row-color': PALETTE[index % PALETTE.length] }} /></span></div>;
                  })}</div> : <div className="music-dna__taste-empty-note">Language details aren’t present in your listening history yet. We’ll show this once your tracks include language information.</div>}
                </article>
              </div>

              <div className="music-dna__taste-grid music-dna__taste-grid--lower">
                <article className="music-dna__taste-card music-dna__taste-pattern">
                  <div className="music-dna__taste-card-title"><div><span>YOUR LISTENING RHYTHM</span><h3>When You Listen</h3></div><b>◷</b></div>
                  <div className="music-dna__taste-periods">{profile.periodCounts.map((period) => <div className={profile.activePeriod?.label === period.label ? 'is-peak' : ''} key={period.label}><span>{period.icon}</span><small>{period.label}</small><strong>{period.count}</strong></div>)}</div>
                  <div className="music-dna__taste-week"><div><strong>This week</strong><span>Last 7 days · {profile.weeklyPlays.reduce((sum, day) => sum + day.count, 0)} songs</span></div><div className="music-dna__taste-week-bars">{profile.weeklyPlays.map((day) => {
                    const max = Math.max(...profile.weeklyPlays.map((item) => item.count), 1);
                    return <div key={day.label} title={`${day.label}: ${day.count} songs`}><i style={{ height: `${Math.max(day.count ? 12 : 4, (day.count / max) * 100)}%` }} /><small>{day.label}</small></div>;
                  })}</div></div>
                  <p className="music-dna__taste-footnote">{profile.mostActiveDay ? `Your most active day is ${profile.mostActiveDay}.` : 'Your weekly rhythm is still taking shape.'} {profile.activePeriod ? `You listen most in the ${profile.activePeriod.label.toLowerCase()}.` : ''}</p>
                </article>

                <article className="music-dna__taste-card">
                  <div className="music-dna__taste-card-title"><div><span>HOW YOUR SOUND SHIFTS</span><h3>Your Taste Evolution</h3></div><b>↗</b></div>
                  {profile.earlierTaste && profile.recentTaste ? <><div className="music-dna__evolution"><div><small>EARLIER</small><strong>{profile.earlierTaste}</strong></div><span>→</span><div><small>RECENTLY</small><strong>{profile.recentTaste}</strong></div></div><p className="music-dna__taste-footnote">{profile.earlierTaste.toLowerCase() === profile.recentTaste.toLowerCase() ? 'Your recent listens are staying close to the sounds that first drew you in.' : `Your recent listening is shifting from ${profile.earlierTaste} toward ${profile.recentTaste}.`}</p></> : <div className="music-dna__taste-empty-note">Keep listening and your early and recent sound preferences will appear here.</div>}
                </article>
              </div>

              <article className="music-dna__taste-card music-dna__identity-card">
                <div className="music-dna__taste-card-title"><div><span>MORE THAN A GENRE</span><h3>Your Musical Identity</h3></div><b>✧</b></div>
                {profile.identityTraits.length ? <div className="music-dna__identity-traits">{profile.identityTraits.map((trait) => <div key={trait.label}><span>{trait.icon}</span><strong>{trait.label}</strong><small>{trait.basis}</small></div>)}</div> : <p className="music-dna__taste-empty-note">Your personal listening traits will appear as more listening patterns are recorded.</p>}
              </article>

              <article className="music-dna__taste-recommendations">
                <div className="music-dna__taste-card-title"><div><span>BASED ON YOUR OVERALL LISTENING</span><h3>Because This Is Your Taste…</h3></div><b>✦</b></div>
                <p className="music-dna__taste-recommendation-intro">A few saved-library tracks that connect with the artists, genres, or languages you return to.</p>
                {tasteRecommendations.length ? <div className="music-dna__recommendation-list">{tasteRecommendations.map((track) => {
                  const image = track.image || track.albumArt || track.album?.images?.[0]?.url;
                  return <article className="music-dna__recommendation" key={`${track.name}::${track.artist}`}>
                    <img src={image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
                    <div><strong>{track.name}</strong><span>{track.artist}</span><small>{track.genres?.[0] || track.genre || track.language || 'From your saved library'}</small></div>
                    <button type="button" aria-label={`Play ${track.name}`} onClick={() => playProfileTrack(track)}>▶</button>
                    <button type="button" aria-label={`Add ${track.name} to playlist`} onClick={() => addProfileTrack(track)}>＋</button>
                  </article>;
                })}</div> : <div className="music-dna__taste-empty-note">{libraryTracks.length ? 'Your saved library doesn’t yet include tracks that match these listening patterns.' : 'Save more music to your library and we’ll find recommendations connected to your overall taste.'}</div>}
              </article>
            </>
          )}
        </section>

        <section className="music-dna__bottom-grid">
          <article className="music-dna__panel music-dna__discovery">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">FAMILIAR FAVOURITES, NEW HORIZONS</span><h2>Your Discovery Score</h2></div><span className="music-dna__heading-glyph">✧</span></div>
            <div className="music-dna__discovery-content"><Ring score={profile.hasHistory ? profile.discoveryScore : null}>{profile.hasHistory ? 'EXPLORATION' : 'BUILDING'}</Ring><div><strong>{profile.hasHistory ? `${profile.distinctArtists} unique ${profile.distinctArtists === 1 ? 'artist' : 'artists'} so far` : 'Your first listens are the beginning'}</strong><p>{profile.hasHistory ? 'A simple snapshot of how many different artists appear in your logged plays. It grows as you explore.' : 'Play a few songs and this will reflect the variety in your listening history.'}</p><small>Unique artists ÷ logged plays · This is a descriptive ratio, not a quality rating.</small></div></div>
          </article>
          <article className="music-dna__panel music-dna__current">
            <div className="music-dna__section-heading"><div><span className="music-dna__eyebrow">THE FEELING YOU’RE IN NOW</span><h2>Current Mood</h2></div><span className="music-dna__heading-glyph">♡</span></div>
            <div className="music-dna__current-body">{currentMoodDetails ? <><span className="music-dna__current-emoji">{currentMoodDetails[0]}</span><div><strong>{currentMoodDetails[1]}</strong><p>Your current check-in, ready to become part of your listening story.</p></div></> : <><span className="music-dna__current-emoji">✧</span><div><strong>No mood check-in yet</strong><p>Choose a mood in Emotional Journey to add this personal detail.</p></div></>}</div>
          </article>
        </section>

        <section className="music-dna__summary">
          <div className="music-dna__summary-orb"><span>🧬</span></div>
          <div className="music-dna__summary-copy"><span className="music-dna__eyebrow">A LITTLE PORTRAIT OF YOU</span><h2>Your Music DNA</h2><strong>{profile.personality.title} {profile.personality.emoji}</strong><p>{profile.personality.description}</p><div className="music-dna__summary-tags"><span>Top genre <b>{genreRows[0]?.[0] || 'Still discovering'}</b></span><span>Top mood <b>{profile.topMoods[0]?.[0] || currentMood || 'Not logged'}</b></span><span>Top artist <b>{profile.topArtists[0]?.[0] || 'Not logged'}</b></span><span>Peak time <b>{profile.hasHistory ? getHourLabel(profile.peakHour) : 'Still discovering'}</b></span><span>Replay habit <b>{profile.replayHabit}</b></span></div><div className="music-dna__summary-actions"><button type="button" className="music-dna__share" onClick={() => setShareCardOpen(true)}>↗ Share My Music Taste</button><button type="button" className="music-dna__explore" onClick={() => selectTab('artists')}>Explore My Taste <span>→</span></button></div>{shareMessage && <p className="music-dna__share-message" role="status">{shareMessage}</p>}</div>
          <div className="music-dna__summary-score"><Ring score={profile.hasHistory ? profile.discoveryScore : null}>{profile.hasHistory ? 'DISCOVERY' : 'BUILDING'}</Ring><span>YOUR EXPLORATION</span></div>
        </section>

        {!profile.hasHistory && !libraryTracks.length && <p className="music-dna__footnote">Your listening profile is private and built from Music Journal entries on this device. Start a song and log a mood to see your personal patterns take shape.</p>}
        <footer className="music-dna__footer"><span>MELODIXA · MADE OF WHAT MOVES YOU</span><button type="button" onClick={() => ui?.showToast?.('Your Music DNA is private to this device.', 'info')}>Your data stays yours <span>↗</span></button></footer>
      </div>
      {shareCardOpen && <div className="music-dna__share-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareCardOpen(false); }}>
        <section className="music-dna__share-dialog" role="dialog" aria-modal="true" aria-labelledby="music-dna-share-title">
          <button type="button" className="music-dna__share-close" aria-label="Close share card" onClick={() => setShareCardOpen(false)}>×</button>
          <div className="music-dna__share-card">
            <span>✦ MELODIXA · MY MUSIC TASTE</span>
            <h2 id="music-dna-share-title">{profile.personality.title} {profile.personality.emoji}</h2>
            <p>{profile.personality.description}</p>
            <div><span>TOP GENRE<strong>{profile.topGenres[0]?.[0] || 'Still discovering'}</strong></span><span>TOP ARTIST<strong>{profile.topArtists[0]?.[0] || 'Still discovering'}</strong></span><span>TOP LANGUAGE<strong>{profile.topLanguages[0]?.[0] || 'Not in listening data'}</strong></span><span>LISTENING STYLE<strong>{profile.identityTraits.slice(0, 2).map((trait) => trait.label).join(' & ') || 'Taking shape'}</strong></span></div>
            <small>Made of what moves you · MELODIXA</small>
          </div>
          <button type="button" className="music-dna__share-card-action" onClick={shareProfile}>Share or copy profile ↗</button>
          {shareMessage && <p className="music-dna__share-message" role="status">{shareMessage}</p>}
        </section>
      </div>}
    </main>
  );
}

export default MusicDNA;
