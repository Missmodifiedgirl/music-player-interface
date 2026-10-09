import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


logger = logging.getLogger(__name__)

SPOTIFY_API_BASE = "https://api.spotify.com/v1"
LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/"
SPOTIFY_PAGE_SIZE = 10
LASTFM_PAGE_SIZE = 100
MAX_SPOTIFY_PAGES = 100
MINIMUM_TRACKS = 50

MOOD_MATCHES = {
    "sad": {
        "tags": ["melancholic", "sad", "heartbreak", "emotional", "slow"],
    },
    "lonely": {
        "tags": ["lonely", "solitude", "melancholic", "introspective", "sad"],
    },
    "stressed": {
        "tags": ["stress relief", "calming", "relaxing", "ambient", "meditation"],
    },
    "calm": {
        "tags": ["calm", "peaceful", "relaxing", "ambient", "acoustic"],
    },
    "romantic": {
        "tags": ["romantic", "love", "romance", "sensual", "love songs"],
    },
    "happy": {
        "tags": ["happy", "cheerful", "upbeat", "feel good", "joyful"],
    },
    "energetic": {
        "tags": ["energetic", "dance", "workout", "upbeat", "high energy"],
    },
    "relaxed": {
        "tags": ["relaxed", "downtempo", "chillout", "peaceful", "mellow"],
    },
    "hopeful": {
        "tags": ["hopeful", "uplifting", "inspirational", "positive", "optimistic"],
    },
    "motivated": {
        "tags": ["motivational", "powerful", "energetic", "uplifting", "workout"],
    },
}

LASTFM_METHODS = {
    "chart.gettoptracks",
    "tag.gettoptracks",
    "artist.getinfo",
    "artist.gettoptracks",
    "artist.getsimilar",
    "track.search",
}


class MusicApiError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def _request_json(url, provider, headers=None):
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=12) as response:
            body = response.read()
            status_code = response.status
    except HTTPError as error:
        body = error.read()
        try:
            payload = json.loads(body.decode("utf-8"))
            detail = payload.get("error", {}).get("message") or payload.get("message")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            detail = ""
        if error.code == 429:
            message = f"{provider} API rate limit reached (HTTP 429)."
        elif provider == "Spotify" and error.code == 401:
            message = "Spotify authentication expired or is invalid. Reconnect Spotify and retry."
        else:
            message = detail or f"{provider} API request failed (HTTP {error.code})."
        raise MusicApiError(message, error.code) from error
    except URLError as error:
        reason = getattr(error, "reason", error)
        raise MusicApiError(f"{provider} network request failed: {reason}") from error
    except TimeoutError as error:
        raise MusicApiError(f"{provider} network request timed out.") from error
    except OSError as error:
        raise MusicApiError(f"{provider} network request failed: {error}") from error

    logger.info("%s response status=%s", provider, status_code)
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise MusicApiError(f"{provider} returned an invalid JSON response.", status_code) from error
    if not isinstance(payload, dict):
        raise MusicApiError(f"{provider} returned an unexpected response.", status_code)
    return payload


def _lastfm_request(params):
    api_key = getattr(settings, "LASTFM_API_KEY", "").strip()
    if not api_key:
        raise MusicApiError(
            "Last.fm API key missing. Configure LASTFM_API_KEY in the Django backend environment.",
            503,
        )

    method = params.get("method", "")
    if method not in LASTFM_METHODS:
        raise MusicApiError("Unsupported Last.fm API method.", 400)

    logger.info(
        "Last.fm request params: method=%s params=%s",
        method,
        {key: value for key, value in params.items() if key != "api_key"},
    )
    query = {**params, "api_key": api_key, "format": "json"}
    payload = _request_json(f"{LASTFM_API_BASE}?{urlencode(query)}", "Last.fm")
    if payload.get("error"):
        error_code = payload.get("error")
        if str(error_code) == "29":
            message = "Last.fm API rate limit reached."
        elif str(error_code) in {"10", "26"}:
            message = "Last.fm API key is missing or invalid. Check LASTFM_API_KEY in the backend environment."
        else:
            message = f"Last.fm API request failed: {payload.get('message', 'unknown API error')}."
        raise MusicApiError(message)
    return payload


def proxy_lastfm_request(params):
    try:
        return _lastfm_request(params)
    except MusicApiError as error:
        logger.warning("Last.fm proxy request failed (method=%s): %s", params.get("method"), error)
        raise


def _track_identity(track):
    name = " ".join(str(track.get("name", "")).casefold().split())
    artist = " ".join(str(track.get("artist", "")).split(",", 1)[0].casefold().split())
    return f"{name}::{artist}"


def _lastfm_image(images):
    if not isinstance(images, list):
        return ""
    preferred = ("mega", "extralarge", "large", "medium", "small")
    for size in preferred:
        for image in images:
            url = image.get("#text", "")
            if image.get("size") == size and url and "2a96cbd8b46e442fc41c2b86b821562f" not in url:
                return url
    return ""


def _spotify_search(token, term, offset):
    logger.info(
        "Spotify request params: q=%r type=track limit=%s offset=%s",
        term,
        SPOTIFY_PAGE_SIZE,
        offset,
    )
    query = urlencode({"q": term, "type": "track", "limit": SPOTIFY_PAGE_SIZE, "offset": offset})
    payload = _request_json(
        f"{SPOTIFY_API_BASE}/search?{query}",
        "Spotify",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    result = payload.get("tracks")
    if not isinstance(result, dict) or not isinstance(result.get("items"), list):
        raise MusicApiError("Spotify returned a response without track results.")

    tracks = []
    for index, item in enumerate(result["items"]):
        album = item.get("album") or {}
        artists = item.get("artists") or []
        artist_names = [artist.get("name", "") for artist in artists if artist.get("name")]
        external_urls = item.get("external_urls") or {}
        images = album.get("images") or []
        tracks.append({
            "id": item.get("id") or "",
            "uri": item.get("uri") or "",
            "name": item.get("name") or "",
            "artist": artist_names[0] if artist_names else "Unknown artist",
            "album": album.get("name") or "",
            "image": images[0].get("url", "") if images else "",
            "duration_ms": item.get("duration_ms") or 0,
            "preview_url": item.get("preview_url") or "",
            "popularity": item.get("popularity") or 0,
            "search_relevance": max(0, 100 - index * 2),
            "spotifyUrl": external_urls.get("spotify") or "",
            "source": "spotify",
            "sources": ["spotify"],
            "matched_tags": [],
        })
    return tracks, int(result.get("total") or 0)


def _collect_spotify_tracks(token, tags):
    if not token:
        raise MusicApiError("Spotify is not connected. Connect Spotify to include Spotify recommendations.")

    tracks = []
    errors = []
    offsets_by_tag = {tag: 0 for tag in tags}
    for _ in range(MAX_SPOTIFY_PAGES):
        active = [(tag, offset) for tag, offset in offsets_by_tag.items() if offset < 1000]
        if not active:
            break
        with ThreadPoolExecutor(max_workers=min(8, len(active))) as executor:
            requests = {
                executor.submit(_spotify_search, token, tag, offset): (tag, offset)
                for tag, offset in active
            }
            for future in as_completed(requests):
                tag, offset = requests[future]
                try:
                    page_tracks, total = future.result()
                except MusicApiError as error:
                    errors.append(str(error))
                    logger.warning("Spotify mood search failed for term %r: %s", tag, error)
                    offsets_by_tag[tag] = 1000
                    continue
                tracks.extend(page_tracks)
                next_offset = offset + SPOTIFY_PAGE_SIZE
                offsets_by_tag[tag] = next_offset if next_offset < total else 1000
        if len({_track_identity(track) for track in tracks}) >= MINIMUM_TRACKS:
            break
    return tracks, errors


def _lastfm_tag_tracks(tag, page):
    payload = _lastfm_request({
        "method": "tag.gettoptracks",
        "tag": tag,
        "limit": str(LASTFM_PAGE_SIZE),
        "page": str(page),
    })
    result = payload.get("tracks")
    if not isinstance(result, dict):
        raise MusicApiError(f"Last.fm returned no track results for tag {tag!r}.")
    items = result.get("track", [])
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        raise MusicApiError(f"Last.fm returned malformed track results for tag {tag!r}.")

    tracks = []
    for index, item in enumerate(items):
        artist = item.get("artist") or {}
        if isinstance(artist, dict):
            artist = artist.get("name", "")
        tracks.append({
            "id": item.get("mbid") or "",
            "uri": "",
            "name": item.get("name") or "",
            "artist": artist or "Unknown artist",
            "album": "",
            "image": _lastfm_image(item.get("image")),
            "duration_ms": 0,
            "preview_url": "",
            "listeners": int(item.get("listeners") or 0),
            "playcount": int(item.get("playcount") or 0),
            "search_relevance": max(0, 100 - index * 2),
            "spotifyUrl": "",
            "url": item.get("url") or "",
            "source": "lastfm",
            "sources": ["lastfm"],
            "matched_tags": [tag],
        })
    attributes = result.get("@attr") or {}
    try:
        total_pages = int(attributes.get("totalPages", page))
    except (TypeError, ValueError):
        total_pages = page
    return tracks, total_pages


def _collect_lastfm_tracks(tags):
    if not getattr(settings, "LASTFM_API_KEY", "").strip():
        raise MusicApiError(
            "Last.fm API key missing. Configure LASTFM_API_KEY in the Django backend environment.",
            503,
        )

    tracks = []
    errors = []
    pages_by_tag = {tag: 1 for tag in tags}
    while True:
        active = [(tag, page) for tag, page in pages_by_tag.items() if page is not None]
        if not active:
            break
        with ThreadPoolExecutor(max_workers=min(8, len(active))) as executor:
            requests = {
                executor.submit(_lastfm_tag_tracks, tag, page): (tag, page)
                for tag, page in active
            }
            for future in as_completed(requests):
                tag, page = requests[future]
                try:
                    page_tracks, total_pages = future.result()
                except MusicApiError as error:
                    errors.append(str(error))
                    logger.warning("Last.fm mood search failed for tag %r: %s", tag, error)
                    pages_by_tag[tag] = None
                    continue
                tracks.extend(page_tracks)
                pages_by_tag[tag] = page + 1 if page < total_pages else None
        if len({_track_identity(track) for track in tracks}) >= MINIMUM_TRACKS:
            break
    return tracks, errors


def _track_popularity(track):
    if track.get("source") == "spotify":
        return max(0, min(100, int(track.get("popularity") or 0)))
    listeners = max(0, int(track.get("listeners") or 0))
    return min(100, int(math.log10(listeners + 1) * 15))


def _score_track(track, configured_tags):
    text = " ".join((track.get("name", ""), track.get("artist", ""), track.get("album", ""))).casefold()
    tags = set(track.get("matched_tags") or [])
    tags.update(tag for tag in configured_tags if tag.casefold() in text)
    track["matched_tags"] = sorted(tags)
    tag_signal = min(100, len(tags) * 25)
    track["mood_match_score"] = round(
        track.get("search_relevance", 0) * 0.5
        + tag_signal * 0.4
        + _track_popularity(track) * 0.1
    )
    return track


def _merge_tracks(tracks, configured_tags):
    merged = {}
    for candidate in tracks:
        if not candidate.get("name") or not candidate.get("artist"):
            continue
        key = _track_identity(candidate)
        existing = merged.get(key)
        if existing is None:
            merged[key] = dict(candidate)
            continue
        preferred = candidate if candidate.get("source") == "spotify" else existing
        fallback = existing if preferred is candidate else candidate
        combined = {**fallback, **preferred}
        combined["image"] = preferred.get("image") or fallback.get("image") or ""
        combined["sources"] = sorted(set(existing.get("sources", [])) | set(candidate.get("sources", [])))
        combined["matched_tags"] = sorted(set(existing.get("matched_tags", [])) | set(candidate.get("matched_tags", [])))
        combined["listeners"] = max(existing.get("listeners", 0), candidate.get("listeners", 0))
        combined["playcount"] = max(existing.get("playcount", 0), candidate.get("playcount", 0))
        combined["popularity"] = max(existing.get("popularity", 0), candidate.get("popularity", 0))
        combined["search_relevance"] = max(
            existing.get("search_relevance", 0),
            candidate.get("search_relevance", 0),
        )
        combined["source"] = "spotify" if "spotify" in combined["sources"] else "lastfm"
        merged[key] = combined
    ranked = [_score_track(track, configured_tags) for track in merged.values()]
    ranked.sort(
        key=lambda track: (track["mood_match_score"], _track_popularity(track), track["name"].casefold()),
        reverse=True,
    )
    return ranked


def _collect_source(fetcher, *args):
    try:
        tracks, errors = fetcher(*args)
        message = "; ".join(dict.fromkeys(errors[:3])) if errors else ""
        return tracks, {"available": not errors, "count": len(tracks), "error": message}
    except MusicApiError as error:
        logger.warning("Mood recommendation source failed: %s", error)
        return [], {"available": False, "count": 0, "error": str(error)}


def _through_time_spotify_search(token, query, offset):
    logger.info("Music Through Time Spotify request offset=%s query=%r", offset, query)
    params = urlencode({"q": query, "type": "track", "limit": SPOTIFY_PAGE_SIZE, "offset": offset})
    payload = _request_json(
        f"{SPOTIFY_API_BASE}/search?{params}",
        "Spotify",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    result = payload.get("tracks")
    if not isinstance(result, dict) or not isinstance(result.get("items"), list):
        raise MusicApiError("Spotify returned a response without track results.")

    tracks = []
    for item in result["items"]:
        album = item.get("album") or {}
        artists = item.get("artists") or []
        artist_names = [artist.get("name", "") for artist in artists if artist.get("name")]
        images = album.get("images") or []
        tracks.append({
            "id": item.get("id") or "",
            "uri": item.get("uri") or "",
            "name": item.get("name") or "",
            "artist": ", ".join(artist_names) or "Unknown artist",
            "album": album.get("name") or "",
            "image": images[0].get("url", "") if images else "",
            "duration_ms": item.get("duration_ms") or 0,
            "preview_url": item.get("preview_url") or "",
            "popularity": item.get("popularity") or 0,
            "spotifyUrl": (item.get("external_urls") or {}).get("spotify") or "",
            "release_date": album.get("release_date") or "",
            "release_date_precision": album.get("release_date_precision") or "",
            "composer": "",
            "movie": "",
            "source": "spotify",
            "sources": ["spotify"],
        })
    return tracks


def _collect_through_time_spotify(token, query, offset, limit):
    if not token:
        raise MusicApiError("Spotify is not connected. Connect Spotify to search its catalog.")
    tracks = []
    errors = []
    pages = (limit + SPOTIFY_PAGE_SIZE - 1) // SPOTIFY_PAGE_SIZE
    for page in range(pages):
        try:
            tracks.extend(_through_time_spotify_search(
                token,
                query,
                offset + page * SPOTIFY_PAGE_SIZE,
            ))
        except MusicApiError as error:
            errors.append(str(error))
            logger.warning("Music Through Time Spotify search failed: %s", error)
            break
    return tracks[:limit], errors


def _collect_through_time_lastfm(query, offset, limit):
    if not query:
        return [], []
    page_size = min(LASTFM_PAGE_SIZE, 30)
    page = offset // page_size + 1
    payload = _lastfm_request({
        "method": "track.search",
        "track": query,
        "limit": str(min(limit, page_size)),
        "page": str(page),
    })
    results = payload.get("results") or {}
    matches = (results.get("trackmatches") or {}).get("track", [])
    if isinstance(matches, dict):
        matches = [matches]
    if not isinstance(matches, list):
        raise MusicApiError("Last.fm returned malformed track search results.")
    tracks = []
    for item in matches:
        artist = item.get("artist") or "Unknown artist"
        tracks.append({
            "id": item.get("mbid") or "",
            "uri": "",
            "name": item.get("name") or "",
            "artist": artist,
            "album": "",
            "image": _lastfm_image(item.get("image")),
            "duration_ms": 0,
            "preview_url": "",
            "popularity": 0,
            "spotifyUrl": "",
            "release_date": "",
            "release_date_precision": "",
            "composer": "",
            "movie": "",
            "source": "lastfm",
            "sources": ["lastfm"],
            "url": item.get("url") or "",
        })
    return tracks, []


def _filter_through_time_tracks(tracks, start_year, end_year, artist, movie):
    filtered = []
    artist_query = artist.casefold().strip()
    movie_query = movie.casefold().strip()
    for track in tracks:
        release_date = str(track.get("release_date") or "")
        try:
            release_year = int(release_date[:4])
        except (TypeError, ValueError):
            continue
        if not start_year <= release_year <= end_year:
            continue
        if artist_query and artist_query not in track.get("artist", "").casefold():
            continue
        if movie_query and movie_query not in track.get("album", "").casefold():
            continue
        track["release_year"] = release_year
        filtered.append(track)
    return filtered


def get_music_through_time_tracks(
    *,
    spotify_token,
    start_year,
    end_year,
    language="",
    artist="",
    composer="",
    movie="",
    query="",
    offset=0,
    limit=30,
):
    current_year = date.today().year
    max_year = current_year + 5
    if not 1950 <= start_year <= max_year or not 1950 <= end_year <= max_year:
        raise MusicApiError(f"Choose years between 1950 and {max_year}.", 400)
    if start_year > end_year:
        raise MusicApiError("The start year must be earlier than or equal to the end year.", 400)
    if offset < 0 or offset > 1000:
        raise MusicApiError("The result offset must be between 0 and 1000.", 400)
    limit = max(1, min(limit, 50))

    terms = [query, language if language.casefold() != "all languages" else "", artist, composer, movie]
    terms = [str(term).strip() for term in terms if str(term or "").strip()]
    search_query = " ".join(terms + [f"year:{start_year}-{end_year}"])
    lastfm_query = " ".join([
        str(query).strip(),
        str(artist).strip(),
        str(composer).strip(),
        str(movie).strip(),
    ]).strip()

    try:
        spotify_tracks, spotify_errors = _collect_through_time_spotify(
            spotify_token, search_query, offset, limit,
        )
        spotify_status = {
            "available": not spotify_errors,
            "count": len(spotify_tracks),
            "error": "; ".join(dict.fromkeys(spotify_errors[:2])),
        }
    except MusicApiError as error:
        logger.warning("Music Through Time Spotify search failed: %s", error)
        spotify_tracks = []
        spotify_status = {"available": False, "count": 0, "error": str(error)}

    try:
        lastfm_tracks, lastfm_errors = _collect_through_time_lastfm(lastfm_query, offset, limit)
        lastfm_status = {
            "available": bool(lastfm_query) and not lastfm_errors,
            "count": len(lastfm_tracks),
            "error": "; ".join(dict.fromkeys(lastfm_errors[:2])) or (
                "Last.fm tracks without a release year cannot be confirmed for this era."
                if lastfm_tracks else ""
            ),
        }
        if not lastfm_query:
            lastfm_status["error"] = "Add a song, artist, composer, or movie search term to use Last.fm."
    except MusicApiError as error:
        logger.warning("Music Through Time Last.fm search failed: %s", error)
        lastfm_tracks = []
        lastfm_status = {"available": False, "count": 0, "error": str(error)}

    tracks = _filter_through_time_tracks(
        spotify_tracks + lastfm_tracks,
        start_year,
        end_year,
        str(artist),
        str(movie),
    )
    unique = {}
    for track in tracks:
        identity = _track_identity(track)
        previous = unique.get(identity)
        if previous is None or track.get("source") == "spotify":
            combined = {**(previous or {}), **track}
            combined["sources"] = sorted(set((previous or {}).get("sources", [])) | set(track.get("sources", [])))
            unique[identity] = combined
        elif previous:
            previous["sources"] = sorted(set(previous.get("sources", [])) | set(track.get("sources", [])))
    result = list(unique.values())
    logger.info(
        "Music Through Time years=%s-%s Spotify=%s Last.fm=%s unique=%s",
        start_year,
        end_year,
        spotify_status["count"],
        lastfm_status["count"],
        len(result),
    )
    return {
        "start_year": start_year,
        "end_year": end_year,
        "count": len(result),
        "offset": offset,
        "has_more": len(spotify_tracks) >= limit or len(lastfm_tracks) >= min(limit, 30),
        "tracks": result,
        "sources": {"spotify": spotify_status, "lastfm": lastfm_status},
        "metadata": {
            "language_verified": False,
            "composer_available": False,
            "movie_available": False,
            "release_year_source": "Spotify album release date; tracks without a usable year are omitted.",
        },
    }


def _get_spotify_audio_features(token, track_id):
    if not token:
        raise MusicApiError("Spotify is not connected. Connect Spotify to include Spotify recommendations.")
    payload = _request_json(f"{SPOTIFY_API_BASE}/audio-features/{track_id}", "Spotify", headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    return payload


def _spotify_recommendations(token, seed_track_id, limit=20, targets=None):
    if not token:
        raise MusicApiError("Spotify is not connected. Connect Spotify to include Spotify recommendations.")
    params = {"seed_tracks": seed_track_id, "limit": str(limit)}
    if isinstance(targets, dict):
        for k, v in targets.items():
            if v is None:
                continue
            params[f"target_{k}"] = str(v)
    query = urlencode(params)
    payload = _request_json(f"{SPOTIFY_API_BASE}/recommendations?{query}", "Spotify", headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    items = payload.get("tracks") or []
    tracks = []
    for item in items:
        album = item.get("album") or {}
        artists = item.get("artists") or []
        artist_names = [artist.get("name", "") for artist in artists if artist.get("name")]
        images = album.get("images") or []
        tracks.append({
            "id": item.get("id") or "",
            "uri": item.get("uri") or "",
            "name": item.get("name") or "",
            "artist": artist_names[0] if artist_names else "Unknown artist",
            "album": album.get("name") or "",
            "image": images[0].get("url", "") if images else "",
            "duration_ms": item.get("duration_ms") or 0,
            "preview_url": item.get("preview_url") or "",
            "popularity": item.get("popularity") or 0,
            "spotifyUrl": (item.get("external_urls") or {}).get("spotify") or "",
            "release_date": album.get("release_date") or "",
            "source": "spotify",
            "sources": ["spotify"],
        })
    return tracks


def _lastfm_transition_fallback(track_name, artist_name, limit=20):
    # Use Last.fm artist.getsimilar + artist.gettoptracks to build a candidate list
    candidates = []
    if not artist_name:
        return candidates
    try:
        payload = _lastfm_request({"method": "artist.getsimilar", "artist": artist_name, "limit": "10"})
        similars = (payload.get("similarartists") or {}).get("artist") or []
        if isinstance(similars, dict):
            similars = [similars]
        for similar in similars:
            name = similar.get("name")
            if not name:
                continue
            top_payload = _lastfm_request({"method": "artist.gettoptracks", "artist": name, "limit": "5"})
            tracks = (top_payload.get("toptracks") or {}).get("track") or []
            if isinstance(tracks, dict):
                tracks = [tracks]
            for t in tracks:
                candidates.append({
                    "id": t.get("mbid") or "",
                    "uri": "",
                    "name": t.get("name") or "",
                    "artist": name,
                    "album": "",
                    "image": _lastfm_image(t.get("image")),
                    "duration_ms": 0,
                    "preview_url": "",
                    "popularity": int(t.get("playcount") or 0),
                    "spotifyUrl": "",
                    "release_date": "",
                    "source": "lastfm",
                    "sources": ["lastfm"],
                })
                if len(candidates) >= limit:
                    return candidates[:limit]
    except MusicApiError:
        return candidates
    return candidates[:limit]


def get_transition_recommendations(*, spotify_token=None, spotify_track_id=None, name='', artist='', limit=20):
    """Return up to `limit` tracks suitable as smooth transitions from the given track.

    Preference is given to Spotify's recommendations endpoint using the seed track's
    audio features (tempo, energy, valence). If Spotify is unavailable or fails,
    Last.fm is used as a fallback by finding similar artists and their top tracks.
    """
    limit = max(1, min(int(limit or 20), 50))
    sources = {"spotify": {"available": False, "count": 0, "error": ""}, "lastfm": {"available": False, "count": 0, "error": ""}}

    spotify_tracks = []
    lastfm_tracks = []

    # Try Spotify-based recommendations first
    if spotify_token and spotify_track_id:
        try:
            features = _get_spotify_audio_features(spotify_token, spotify_track_id)
            # features: tempo, energy, valence, danceability
            tempo = features.get("tempo")
            energy = features.get("energy")
            valence = features.get("valence")
            danceability = features.get("danceability")
            targets = {}
            if tempo:
                targets["tempo"] = round(float(tempo), 2)
            if energy is not None:
                targets["energy"] = round(float(energy), 3)
            if valence is not None:
                targets["valence"] = round(float(valence), 3)
            if danceability is not None:
                targets["danceability"] = round(float(danceability), 3)

            spotify_tracks = _spotify_recommendations(spotify_token, spotify_track_id, limit=min(limit, 50), targets=targets)
            sources["spotify"] = {"available": True, "count": len(spotify_tracks), "error": ""}
        except MusicApiError as error:
            logger.warning("Transition recommendations via Spotify failed: %s", error)
            sources["spotify"] = {"available": False, "count": 0, "error": str(error)}
    else:
        if not spotify_token:
            sources["spotify"]["error"] = "Spotify is not connected. Connect Spotify to include Spotify recommendations."
        elif not spotify_track_id:
            sources["spotify"]["error"] = "No Spotify track id provided for seed recommendations."

    # If Spotify didn't return enough tracks, attempt Last.fm fallback (artist-similar + toptracks)
    if len(spotify_tracks) < limit:
        try:
            lastfm_tracks = _lastfm_transition_fallback(name, artist, limit=limit)
            sources["lastfm"] = {"available": bool(lastfm_tracks), "count": len(lastfm_tracks), "error": ""}
        except MusicApiError as error:
            logger.warning("Transition recommendations via Last.fm failed: %s", error)
            sources["lastfm"] = {"available": False, "count": 0, "error": str(error)}

    # Merge and deduplicate: prefer Spotify metadata when available
    combined = {}
    for track in (spotify_tracks + lastfm_tracks):
        identity = _track_identity(track)
        prev = combined.get(identity)
        if prev is None or track.get("source") == "spotify":
            combined[identity] = {**(prev or {}), **track, "sources": sorted(set((prev or {}).get("sources", [])) | set(track.get("sources", [])))}
        else:
            prev["sources"] = sorted(set(prev.get("sources", [])) | set(track.get("sources", [])))
    result = list(combined.values())[:limit]

    return {"count": len(result), "tracks": result, "sources": sources}


def get_emotional_journey_recommendations(mood, spotify_token=None):
    mood_key = str(mood or "").strip().casefold()
    mood_config = MOOD_MATCHES.get(mood_key)
    if not mood_config:
        raise MusicApiError("Choose one of the supported moods.", 400)

    tags = mood_config["tags"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        spotify_future = executor.submit(_collect_source, _collect_spotify_tracks, spotify_token, tags)
        lastfm_future = executor.submit(_collect_source, _collect_lastfm_tracks, tags)
        spotify_tracks, spotify_status = spotify_future.result()
        lastfm_tracks, lastfm_status = lastfm_future.result()

    tracks = _merge_tracks(spotify_tracks + lastfm_tracks, tags)
    logger.info(
        "Emotional Journey mood=%s Spotify=%s Last.fm=%s final_unique=%s",
        mood_key,
        spotify_status["count"],
        lastfm_status["count"],
        len(tracks),
    )
    return {
        "mood": mood_key,
        "count": len(tracks),
        "tracks": tracks,
        "sources": {
            "spotify": spotify_status,
            "lastfm": lastfm_status,
        },
    }
