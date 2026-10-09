import React, { useEffect, useState } from 'react';
import { findTracks } from '../song-search.js';
import { getPlaceholderSvg } from '../../utils.js';
import './LocalCulture.css';

const REGIONS = [
  { id: 'tamil-nadu', name: 'Tamil Nadu', flag: '🇮🇳', language: 'Tamil', sound: 'Parai · Gaana · Carnatic', query: 'Tamil songs', color: '#e0a36f', image: 'photo-1519681393784-d120267933ba' },
  { id: 'kerala', name: 'Kerala', flag: '🇮🇳', language: 'Malayalam', sound: 'Chenda · Sopana · Mappila', query: 'Malayalam songs', color: '#78b99e', image: 'photo-1602216056096-3b40cc0c9944' },
  { id: 'karnataka', name: 'Karnataka', flag: '🇮🇳', language: 'Kannada', sound: 'Yakshagana · Dollu · Carnatic', query: 'Kannada songs', color: '#b394d1', image: 'photo-1606293926075-69a00dbfde81' },
  { id: 'andhra-pradesh', name: 'Andhra Pradesh', flag: '🇮🇳', language: 'Telugu', sound: 'Burra Katha · Dappu · Folk', query: 'Telugu songs', color: '#df8e78', image: 'photo-1561361513-2d000a50f0dc' },
  { id: 'maharashtra', name: 'Maharashtra', flag: '🇮🇳', language: 'Marathi', sound: 'Lavani · Powada · Abhang', query: 'Marathi songs', color: '#dda95f', image: 'photo-1570168007204-dfb528c6958f' },
  { id: 'west-bengal', name: 'West Bengal', flag: '🇮🇳', language: 'Bengali', sound: 'Baul · Rabindra Sangeet · Folk', query: 'Bengali songs', color: '#7da9cb', image: 'photo-1558431382-27e303142255' },
];

const CULTURE = {
  'tamil-nadu': {
    subtitle: 'Discover the sounds of Tamil culture.',
    artists: [['A. R. Rahman', 'Composer · film & contemporary'], ['Ilaiyaraaja', 'Composer · folk & orchestral'], ['Dhee', 'Singer · contemporary Tamil']],
    styles: [['Parai Attam', 'Resonant frame drums with a long history in Tamil community and ceremonial music.', '🥁'], ['Gaana', 'An energetic Chennai-born urban folk tradition carried by voice and rhythm.', '🎙️'], ['Carnatic', 'A classical South Indian tradition shaped by melody, improvisation, and rhythmic cycles.', '🎼']],
    festivals: [['Pongal', '🌾', 'Tamil harvest songs and celebration'], ['Tamil New Year', '🎊', 'New beginnings in Tamil music'], ['Karthigai Deepam', '🪔', 'Devotional songs of light']],
    languages: ['Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Hindi'],
  },
  kerala: {
    subtitle: 'Follow Kerala’s music from temple courtyards to the coast.',
    artists: [['K. J. Yesudas', 'Singer · classical & film'], ['Sithara Krishnakumar', 'Singer · contemporary Malayalam'], ['Thaikkudam Bridge', 'Band · folk fusion']],
    styles: [['Chenda Melam', 'A powerful ensemble of drums traditionally heard at temple festivals and processions.', '🥁'], ['Sopana Sangeetham', 'A devotional singing tradition associated with Kerala temple arts.', '🪷'], ['Mappila Paattu', 'A lyrical song tradition shaped by the coastal Muslim communities of Malabar.', '🌊']],
    festivals: [['Onam', '🌸', 'Songs for Kerala’s harvest celebration'], ['Vishu', '🌿', 'Festive Malayalam sounds'], ['Thrissur Pooram', '🥁', 'Percussion and procession traditions']],
    languages: ['Malayalam', 'Tamil', 'Kannada', 'Telugu', 'Hindi'],
  },
  karnataka: {
    subtitle: 'Explore Karnataka’s classical, folk, and contemporary sounds.',
    artists: [['Vijay Prakash', 'Singer · Kannada & Indian film'], ['Vasuki Vaibhav', 'Singer · contemporary Kannada'], ['Mysore Ananthaswamy', 'Composer · Kannada Bhavageethe']],
    styles: [['Dollu Kunitha', 'A spirited group drum dance performed at community gatherings and festivals.', '🪘'], ['Yakshagana', 'A vibrant theatre tradition bringing together music, dance, and storytelling.', '🎭'], ['Carnatic', 'A classical tradition with deep roots in Karnataka’s musical heritage.', '🎼']],
    festivals: [['Mysuru Dasara', '🎊', 'Music and pageantry of the royal festival'], ['Ugadi', '🌱', 'Kannada new-year celebration songs'], ['Karaga', '🌼', 'Music around Bengaluru’s folk festival']],
    languages: ['Kannada', 'Tulu', 'Konkani', 'Tamil', 'Telugu'],
  },
  'andhra-pradesh': {
    subtitle: 'Hear Andhra Pradesh through Telugu song and folk performance.',
    artists: [['S. P. Balasubrahmanyam', 'Singer · Telugu & Indian film'], ['Mangli', 'Singer · Telugu folk & film'], ['M. M. Keeravani', 'Composer · film & orchestral']],
    styles: [['Dappu', 'A large frame drum at the heart of many Andhra folk dances and processions.', '🥁'], ['Burra Katha', 'A lively storytelling form blending narration, song, and rhythmic accompaniment.', '📖'], ['Kuchipudi music', 'Expressive music accompanying Andhra Pradesh’s classical dance tradition.', '💃']],
    festivals: [['Sankranti', '🌾', 'Harvest songs and festive folk music'], ['Ugadi', '🌱', 'Telugu new-year sounds'], ['Tirupati Brahmotsavam', '🪷', 'Devotional music and procession']],
    languages: ['Telugu', 'Urdu', 'Tamil', 'Kannada', 'Hindi'],
  },
  maharashtra: {
    subtitle: 'Discover Maharashtra’s devotional, folk, and modern music.',
    artists: [['Lata Mangeshkar', 'Singer · Marathi & Indian music'], ['Ajay–Atul', 'Composer duo · Marathi & film'], ['Shahir Sable', 'Folk poet · Powada & Lavani']],
    styles: [['Lavani', 'A spirited song-and-dance tradition known for expressive rhythm and poetic performance.', '💃'], ['Powada', 'A dramatic ballad tradition celebrating history through powerful sung storytelling.', '📯'], ['Abhang', 'Devotional poetry and song associated with the Varkari tradition.', '🙏']],
    festivals: [['Ganesh Chaturthi', '🐘', 'Devotional and procession music'], ['Gudi Padwa', '🚩', 'Marathi new-year songs'], ['Makar Sankranti', '🌾', 'Seasonal folk celebration']],
    languages: ['Marathi', 'Hindi', 'Konkani', 'Gujarati', 'Kannada'],
  },
  'west-bengal': {
    subtitle: 'Travel through Bengal’s Baul, literary, and folk traditions.',
    artists: [['Rashid Khan', 'Vocalist · Hindustani classical'], ['Anupam Roy', 'Singer-songwriter · Bengali'], ['Paban Das Baul', 'Singer · Baul tradition']],
    styles: [['Baul', 'Songs of wandering mystics, rooted in Bengal’s devotional and philosophical traditions.', '🎶'], ['Rabindra Sangeet', 'Songs written and composed by Rabindranath Tagore, woven into Bengali cultural life.', '🪕'], ['Bhawaiya', 'A folk song tradition from North Bengal, often shaped by longing and everyday life.', '🌾']],
    festivals: [['Durga Puja', '🪔', 'Bengal’s festive songs and seasonal releases'], ['Poila Boishakh', '🌺', 'Bengali new-year music'], ['Poush Mela', '🎶', 'Baul and folk sounds of the winter fair']],
    languages: ['Bengali', 'Hindi', 'Nepali', 'Santali', 'Urdu'],
  },
};

const CULTURE_KEY = 'melodixa-cultural-collection-v1';

function readCollection() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CULTURE_KEY) || '{"regions":[],"tracks":[]}');
    return { regions: Array.isArray(parsed.regions) ? parsed.regions : [], tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [] };
  } catch (error) {
    console.warn('Could not read the cultural collection:', error);
    return { regions: [], tracks: [] };
  }
}

function LocalCulture({ musicPlayer, playlistStore }) {
  const [selectedId, setSelectedId] = useState('tamil-nadu');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [artistIndex, setArtistIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedFestival, setSelectedFestival] = useState(null);
  const [collection, setCollection] = useState(readCollection);
  const region = REGIONS.find((item) => item.id === selectedId) || REGIONS[0];
  const culture = CULTURE[selectedId];
  const spotlight = culture.artists[artistIndex % culture.artists.length];

  useEffect(() => {
    let active = true;
    const search = selectedLanguage
      ? `${selectedLanguage} songs ${region.name}`
      : selectedFestival
        ? `${region.language} ${selectedFestival[0]} celebration songs`
        : `${region.query} regional folk artists`;
    setLoading(true);
    setError('');
    findTracks(search, selectedLanguage || region.language)
      .then((result) => { if (active) setTracks(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Regional music could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, selectedLanguage, selectedFestival]);

  const persistCollection = (next) => {
    try {
      localStorage.setItem(CULTURE_KEY, JSON.stringify(next));
      setCollection(next);
    } catch (storageError) {
      console.error('Could not save the cultural collection:', storageError);
      setError('Your collection could not be saved in this browser.');
    }
  };

  const selectRegion = (id) => {
    setSelectedId(id);
    setArtistIndex(0);
    setSelectedLanguage('');
    setSelectedFestival(null);
  };

  const toggleRegion = () => {
    const regions = collection.regions.includes(region.id)
      ? collection.regions.filter((id) => id !== region.id)
      : [...collection.regions, region.id];
    persistCollection({ ...collection, regions });
  };

  const saveTrack = (track) => {
    const key = track.uri || track.id || `${track.name}-${track.artist}`;
    const exists = collection.tracks.some((saved) => saved.key === key);
    persistCollection({
      ...collection,
      tracks: exists
        ? collection.tracks.filter((saved) => saved.key !== key)
        : [...collection.tracks, {
          key,
          name: track.name,
          artist: track.artist,
          image: track.image,
          regionId: region.id,
          uri: track.uri,
          preview_url: track.preview_url,
          duration_ms: track.duration_ms,
          album: track.album,
          spotifyUrl: track.spotifyUrl,
        }],
    });
  };

  const playTrack = (track) => {
    musicPlayer.playTrack(track, tracks).catch((playError) => {
      console.error('Could not play regional track:', playError);
      setError('This track could not be played right now.');
    });
  };

  const playCollection = () => {
    if (tracks.length) musicPlayer.playTrack(tracks[0], tracks);
  };

  return (
    <main className="local-culture">
      <header className="local-culture__topbar">
        <div className="local-culture__brand"><span>✦</span> MELODIXA <i>/</i> SOUND ATLAS</div>
        <div className="local-culture__top-note">MUSIC · PLACE · PEOPLE</div>
        <button type="button" className={`local-culture__save-region ${collection.regions.includes(region.id) ? 'is-saved' : ''}`} onClick={toggleRegion}>
          {collection.regions.includes(region.id) ? '♥ Saved to your collection' : '+ Save Region'}
        </button>
      </header>

      <div className="local-culture__content">
        <section className="local-culture__hero" style={{ '--region-accent': region.color, '--region-image': `url(https://images.unsplash.com/${region.image}?auto=format&fit=crop&w=1700&q=85)` }}>
          <div className="local-culture__hero-copy">
            <span className="local-culture__eyebrow">A JOURNEY THROUGH SOUND · INDIA</span>
            <h1>Local Culture <span>🌍</span></h1>
            <p>Explore the music, artists, languages, and sounds that make every place unique.</p>
            <a href="#lc-regions" className="local-culture__hero-link">Choose a region <span>↓</span></a>
          </div>
          <div className="local-culture__hero-place"><span>{region.flag}</span><strong>{region.name}</strong><small>{region.language} · {region.sound}</small><span className="local-culture__hero-coordinate">10° 47′ N &nbsp; 78° 42′ E</span></div>
          <div className="local-culture__hero-label">EVERY PLACE HAS A SOUND</div>
        </section>

        <section className="local-culture__atlas-section" id="lc-regions">
          <div className="local-culture__section-title"><div><span className="local-culture__eyebrow">START YOUR JOURNEY</span><h2>Choose a Region</h2><p>Each place holds its own rhythm, language, and living traditions.</p></div><span className="local-culture__section-index">01 / THE ATLAS</span></div>
          <div className="local-culture__atlas">
            <div className="local-culture__map" aria-label="Interactive map of music regions in India">
              <svg viewBox="0 0 280 340" role="img" aria-label="Illustrated outline of India">
                <path d="M92 16 130 27 157 25 169 39 193 43 209 60 224 67 218 88 237 105 228 120 235 143 219 160 227 177 213 192 205 216 190 222 186 242 168 255 164 276 148 289 139 319 126 310 120 282 107 267 102 248 87 232 79 211 63 198 58 178 45 163 52 149 41 130 48 114 42 98 55 83 58 65 73 56 77 38Z" />
              </svg>
              {REGIONS.map((item) => <button key={item.id} type="button" aria-label={`Explore ${item.name}`} aria-pressed={selectedId === item.id} className={`local-culture__map-pin local-culture__map-pin--${item.id} ${selectedId === item.id ? 'is-active' : ''}`} onClick={() => selectRegion(item.id)}><i />{item.name}</button>)}
              <span className="local-culture__map-caption">INDIA · SOUND ATLAS</span>
            </div>
            <div className="local-culture__region-list">
              {REGIONS.map((item, index) => <button key={item.id} type="button" className={`local-culture__region-card ${selectedId === item.id ? 'is-active' : ''}`} style={{ '--region-accent': item.color }} onClick={() => selectRegion(item.id)}>
                <span className="local-culture__region-number">0{index + 1}</span><span className="local-culture__region-flag">{item.flag}</span><span className="local-culture__region-copy"><strong>{item.name}</strong><small>{item.language} · {item.sound.split(' · ')[0]}</small></span><i>↗</i>
              </button>)}
              <button type="button" className="local-culture__explore-region" onClick={() => document.getElementById('lc-discover')?.scrollIntoView({ behavior: 'smooth' })}>Explore {region.name}<span>→</span></button>
            </div>
          </div>
        </section>

        <section className="local-culture__region-banner" id="lc-discover" style={{ '--region-accent': region.color, '--region-image': `url(https://images.unsplash.com/${region.image}?auto=format&fit=crop&w=1500&q=80)` }}>
          <div className="local-culture__region-banner-copy"><span className="local-culture__eyebrow">NOW EXPLORING · {region.language.toUpperCase()}</span><h2>{region.flag} {region.name}</h2><p>{culture.subtitle}</p><div className="local-culture__region-chips"><span>🗣 {region.language}</span><span>〰 {region.sound}</span></div></div>
          <button type="button" className="local-culture__banner-play" onClick={playCollection} disabled={!tracks.length}>▶ <span>Listen to regional picks</span></button>
          <span className="local-culture__banner-mark">{region.language.slice(0, 1)}</span>
        </section>

        <section className="local-culture__discover-grid">
          <article className="local-culture__panel local-culture__sounds-panel">
            <div className="local-culture__section-title local-culture__section-title--compact"><div><span className="local-culture__eyebrow">MUSIC CONNECTED TO THIS REGION</span><h2>{selectedFestival ? `${selectedFestival[0]} Sounds ${selectedFestival[1]}` : selectedLanguage ? `${selectedLanguage} Music` : 'Sounds From Home 🏡'}</h2><p>{selectedFestival ? selectedFestival[2] : `A listening trail through ${region.name} and ${region.language} music.`}</p></div><span className="local-culture__section-index">02 / LISTEN</span></div>
            <div className="local-culture__track-list">
              {loading && <div className="local-culture__loading"><i /> Finding sounds across the music catalog…</div>}
              {!loading && error && <p className="local-culture__inline-error" role="alert">{error}</p>}
              {!loading && !error && tracks.slice(0, 5).map((track, index) => {
                const key = track.uri || track.id || `${track.name}-${track.artist}`;
                const saved = collection.tracks.some((item) => item.key === key);
                return <article className="local-culture__track" key={key}>
                  <span className="local-culture__track-index">{String(index + 1).padStart(2, '0')}</span><img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" />
                  <div className="local-culture__track-copy"><strong>{track.name}</strong><small>{track.artist || 'Artist information unavailable'}</small><span><i>{region.language}</i><i>{region.name}</i><i>{region.sound.split(' · ')[index % 3]}</i></span></div>
                  <button type="button" className="local-culture__track-save" aria-label={saved ? `Remove ${track.name} from collection` : `Save ${track.name}`} onClick={() => saveTrack(track)}>{saved ? '♥' : '♡'}</button>
                  <button type="button" className="local-culture__track-play" aria-label={`Play ${track.name}`} onClick={() => playTrack(track)}>▶</button>
                </article>;
              })}
              {!loading && !error && !tracks.length && <p className="local-culture__empty">No catalog results are available right now. Try another language or region.</p>}
            </div>
            <p className="local-culture__catalog-note">Catalog results can vary by music provider; cultural notes describe regional traditions and are not track-level verification.</p>
          </article>

          <aside className="local-culture__spotlight" style={{ '--region-accent': region.color }}>
            <div className="local-culture__spotlight-art"><span>{region.flag}</span><b>{spotlight[0].split(' ').map((part) => part[0]).join('').slice(0, 2)}</b><i>ARTIST SPOTLIGHT</i></div>
            <div className="local-culture__spotlight-copy"><span className="local-culture__eyebrow">LOCAL ARTIST SPOTLIGHT</span><h2>{spotlight[0]}</h2><p>{region.name} · {region.language}<br />{spotlight[1]}</p><div className="local-culture__popular-tracks"><small>POPULAR TRACKS TO EXPLORE</small>{tracks.slice(0, 3).map((track, index) => <button type="button" key={track.id || `${track.name}-${index}`} onClick={() => playTrack(track)}><span>0{index + 1}</span>{track.name}<i>▶</i></button>)}{!tracks.length && <span className="local-culture__artist-note">Search the catalog to see available tracks.</span>}</div><button type="button" className="local-culture__next-artist" onClick={() => setArtistIndex((index) => index + 1)}>Next artist <span>↗</span></button></div>
          </aside>
        </section>

        <section className="local-culture__traditions">
          <div className="local-culture__section-title"><div><span className="local-culture__eyebrow">LIVING TRADITIONS</span><h2>Traditional Sounds 🥁</h2><p>Small introductions to music shaped by place, craft, and community.</p></div><span className="local-culture__section-index">03 / ROOTS</span></div>
          <div className="local-culture__style-list">{culture.styles.map(([name, description, icon], index) => <article className={`local-culture__style local-culture__style--${index + 1}`} key={name} style={{ '--region-accent': region.color }}><div className="local-culture__style-art"><span>{icon}</span><i>{region.name.toUpperCase()}</i></div><div className="local-culture__style-copy"><span className="local-culture__eyebrow">REGIONAL SOUND · 0{index + 1}</span><h3>{name}</h3><p>{description}</p><button type="button" onClick={() => { setSelectedFestival([name, icon, `Explore music connected with ${name}.`]); document.querySelector('.local-culture__sounds-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Explore sound <span>→</span></button></div></article>)}</div>
          <div className="local-culture__about"><span>✧</span><div><small>ABOUT THIS SOUND</small><p><b>{region.name}</b> · {region.language} · {region.sound}. These traditions are connected to local performance, celebration, and everyday cultural life. Practices vary across communities and generations.</p></div></div>
        </section>

        <section className="local-culture__languages">
          <div className="local-culture__section-title"><div><span className="local-culture__eyebrow">A PLACE, HEARD IN MANY VOICES</span><h2>Explore a Language 🗣️</h2><p>Choose a language to tune this region’s discovery trail.</p></div><span className="local-culture__section-index">04 / VOICES</span></div>
          <div className="local-culture__language-list">{culture.languages.map((language, index) => <button type="button" aria-pressed={selectedLanguage === language} className={`local-culture__language ${selectedLanguage === language ? 'is-active' : ''}`} key={language} onClick={() => { setSelectedFestival(null); setSelectedLanguage(selectedLanguage === language ? '' : language); }}><span>{['அ', 'അ', 'ಕ', 'అ', 'अ'][index % 5]}</span><strong>{language}</strong><small>{language === region.language ? 'Local language' : 'Explore a neighboring voice'}</small><i>{selectedLanguage === language ? '✓' : '↗'}</i></button>)}</div>
          <div className="local-culture__language-prompt"><span>✧</span><p>Never explored <b>{culture.languages.find((language) => language !== region.language) || region.language}</b> music?</p><button type="button" onClick={() => setSelectedLanguage(culture.languages.find((language) => language !== region.language) || region.language)}>Explore a new voice →</button></div>
        </section>

        <section className="local-culture__festivals">
          <div className="local-culture__section-title"><div><span className="local-culture__eyebrow">MUSIC IN COMMUNITY</span><h2>Music of the Season 🎉</h2><p>Choose a celebration to find music connected to its traditions.</p></div><span className="local-culture__section-index">05 / CELEBRATE</span></div>
          <div className="local-culture__festival-list">{culture.festivals.map(([name, icon, description], index) => <button type="button" className={`local-culture__festival ${selectedFestival?.[0] === name ? 'is-active' : ''}`} key={name} onClick={() => { setSelectedLanguage(''); setSelectedFestival([name, icon, description]); document.querySelector('.local-culture__sounds-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><span>{icon}</span><small>0{index + 1} · {region.name}</small><strong>{name}</strong><i>{description}</i><b>Play collection →</b></button>)}</div>
        </section>

        <section className="local-culture__trending">
          <div className="local-culture__section-title"><div><span className="local-culture__eyebrow">REGIONAL CATALOG DISCOVERY</span><h2>Trending Locally 🔥</h2><p>Explore popular catalog results for {region.name}; availability and rankings vary by provider.</p></div><button type="button" className="local-culture__listen-now" onClick={playCollection} disabled={!tracks.length}>Listen now →</button></div>
          <div className="local-culture__trending-list">{tracks.slice(0, 3).map((track, index) => <button type="button" className="local-culture__trending-card" key={track.uri || track.id || `${track.name}-${index}`} onClick={() => playTrack(track)}><span className="local-culture__trend-rank">#{index + 1}</span><img src={track.image || getPlaceholderSvg(track.name)} alt="" loading="lazy" /><span className="local-culture__trend-copy"><strong>{track.name}</strong><small>{track.artist}</small><i>♫ {region.language} · {region.name}</i></span><span className="local-culture__trend-play">▶</span></button>)}</div>
        </section>

        <section className="local-culture__collection">
          <div className="local-culture__collection-copy"><span className="local-culture__eyebrow">YOUR PERSONAL SOUND ATLAS</span><h2>My Cultural Collection <span>♥</span></h2><p>Keep the places and songs you want to return to. Saved on this device.</p><button type="button" onClick={toggleRegion}>{collection.regions.includes(region.id) ? '♥ Region saved' : '+ Save this region'}</button></div>
          <div className="local-culture__saved-list">{collection.regions.length ? collection.regions.map((id) => { const savedRegion = REGIONS.find((item) => item.id === id); return savedRegion && <button type="button" key={id} onClick={() => selectRegion(id)}><span>{savedRegion.flag}</span><strong>{savedRegion.name}</strong><small>{collection.tracks.filter((track) => track.regionId === id).length} saved {collection.tracks.filter((track) => track.regionId === id).length === 1 ? 'song' : 'songs'}</small><i>↗</i></button>; }) : <div className="local-culture__collection-empty"><span>⌖</span><p>Your saved regions will become a personal map of the music you discover.</p></div>}
            {collection.tracks.length > 0 && <div className="local-culture__saved-tracks">{collection.tracks.map((track) => {
              const savedRegion = REGIONS.find((item) => item.id === track.regionId);
              return <div className="local-culture__saved-track" key={track.key}><img src={track.image || getPlaceholderSvg(track.name)} alt="" /><div><strong>{track.name}</strong><small>{track.artist} · {savedRegion?.name || 'Local Culture'}</small></div><button type="button" aria-label={`Play ${track.name}`} onClick={() => musicPlayer.playTrack(track).catch((playError) => { console.error('Could not play saved cultural track:', playError); setError('This saved track could not be played right now.'); })}>▶</button><button type="button" aria-label={`Remove ${track.name} from collection`} onClick={() => persistCollection({ ...collection, tracks: collection.tracks.filter((item) => item.key !== track.key) })}>×</button></div>;
            })}</div>}
            <div className="local-culture__saved-song-count"><span>♫</span><strong>{collection.tracks.length}</strong><small>songs saved across your regions</small></div>
          </div>
        </section>

        <footer className="local-culture__footer"><span>“Every place has a sound. Discover yours.”</span><small>MELODIXA · MUSIC WITHOUT BORDERS</small></footer>
      </div>
    </main>
  );
}

export default LocalCulture;
