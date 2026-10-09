import json
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from django.test import TestCase, override_settings

from .music_services import (
    MusicApiError,
    _spotify_search,
    get_emotional_journey_recommendations,
    get_music_through_time_tracks,
)


class EmotionalJourneyApiTests(TestCase):
    @patch("accounts.music_services._request_json")
    def test_spotify_search_uses_supported_limit_and_existing_token(self, request_json):
        request_json.return_value = {"tracks": {"items": [], "total": 25}}

        tracks, total = _spotify_search("existing-token", "melancholic", 10)

        requested_url = request_json.call_args.args[0]
        headers = request_json.call_args.kwargs["headers"]
        self.assertEqual(parse_qs(urlparse(requested_url).query)["limit"], ["10"])
        self.assertEqual(parse_qs(urlparse(requested_url).query)["offset"], ["10"])
        self.assertEqual(headers["Authorization"], "Bearer existing-token")
        self.assertEqual(tracks, [])
        self.assertEqual(total, 25)

    def test_endpoint_passes_mood_and_existing_spotify_token_to_service(self):
        payload = {
            "mood": "sad",
            "count": 0,
            "tracks": [],
            "sources": {
                "spotify": {"available": False, "count": 0, "error": "Spotify is not connected."},
                "lastfm": {"available": True, "count": 0, "error": ""},
            },
        }
        with patch("accounts.views.get_emotional_journey_recommendations", return_value=payload) as service:
            response = self.client.get(
                "/api/emotional-journey/?mood=Sad",
                HTTP_AUTHORIZATION="Bearer existing-spotify-access-token",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), payload)
        service.assert_called_once_with("Sad", "existing-spotify-access-token")

    @override_settings(LASTFM_API_KEY="test-key")
    def test_lastfm_results_are_returned_when_spotify_fails(self):
        lastfm_track = {
            "id": "",
            "uri": "",
            "name": "A real API result",
            "artist": "An API artist",
            "album": "",
            "image": "",
            "duration_ms": 0,
            "preview_url": "",
            "listeners": 1000,
            "playcount": 2000,
            "spotifyUrl": "",
            "url": "https://www.last.fm/music/example",
            "source": "lastfm",
            "sources": ["lastfm"],
            "matched_tags": ["melancholic"],
        }
        with (
            patch(
                "accounts.music_services._collect_spotify_tracks",
                side_effect=MusicApiError("Spotify API rate limit reached (HTTP 429)."),
            ),
            patch(
                "accounts.music_services._collect_lastfm_tracks",
                return_value=([lastfm_track], []),
            ),
        ):
            result = get_emotional_journey_recommendations("sad", "expired-token")

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["tracks"][0]["source"], "lastfm")
        self.assertIn("rate limit", result["sources"]["spotify"]["error"])
        self.assertTrue(result["sources"]["lastfm"]["available"])

    @override_settings(LASTFM_API_KEY="")
    def test_spotify_results_are_returned_when_lastfm_key_is_missing(self):
        spotify_track = {
            "id": "spotify-track-id",
            "uri": "spotify:track:spotify-track-id",
            "name": "A Spotify result",
            "artist": "A Spotify artist",
            "album": "An album",
            "image": "",
            "duration_ms": 200000,
            "preview_url": "",
            "popularity": 70,
            "spotifyUrl": "https://open.spotify.com/track/spotify-track-id",
            "source": "spotify",
            "sources": ["spotify"],
            "matched_tags": [],
        }
        with patch(
            "accounts.music_services._collect_spotify_tracks",
            return_value=([spotify_track], []),
        ):
            result = get_emotional_journey_recommendations("calm", "valid-token")

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["tracks"][0]["source"], "spotify")
        self.assertIn("LASTFM_API_KEY", result["sources"]["lastfm"]["error"])
        self.assertTrue(result["sources"]["spotify"]["available"])

    @override_settings(LASTFM_API_KEY="")
    def test_lastfm_proxy_reports_missing_backend_key(self):
        response = self.client.post(
            "/api/lastfm/",
            data=json.dumps({"method": "chart.gettoptracks"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("LASTFM_API_KEY", response.json()["error"])


class MusicThroughTimeApiTests(TestCase):
    @patch("accounts.views.get_music_through_time_tracks")
    def test_endpoint_passes_filters_and_existing_spotify_token(self, search_tracks):
        payload = {
            "start_year": 1990,
            "end_year": 1999,
            "count": 0,
            "tracks": [],
            "sources": {},
            "metadata": {"language_verified": False},
        }
        search_tracks.return_value = payload
        response = self.client.get(
            "/api/music-through-time/?start_year=1990&end_year=1999&language=Tamil&artist=Rahman&composer=Rahman&movie=Roja&query=love&offset=30&limit=30",
            HTTP_AUTHORIZATION="Bearer existing-spotify-token",
        )

        self.assertEqual(response.status_code, 200)
        search_tracks.assert_called_once_with(
            spotify_token="existing-spotify-token",
            start_year=1990,
            end_year=1999,
            language="Tamil",
            artist="Rahman",
            composer="Rahman",
            movie="Roja",
            query="love",
            offset=30,
            limit=30,
        )

    @patch("accounts.music_services._collect_through_time_lastfm", return_value=([], []))
    @patch("accounts.music_services._collect_through_time_spotify")
    def test_release_year_and_artist_are_filtered_without_inventing_composer(
        self,
        spotify_search,
        _lastfm_search,
    ):
        spotify_search.return_value = ([
            {
                "id": "track-1",
                "uri": "spotify:track:track-1",
                "name": "Roja",
                "artist": "A. R. Rahman",
                "album": "Roja",
                "image": "",
                "duration_ms": 200000,
                "preview_url": "",
                "popularity": 50,
                "spotifyUrl": "https://open.spotify.com/track/track-1",
                "release_date": "1992-08-15",
                "composer": "",
                "movie": "",
                "source": "spotify",
                "sources": ["spotify"],
            },
            {
                "id": "track-2",
                "name": "Out of range",
                "artist": "A. R. Rahman",
                "album": "Album",
                "release_date": "2001",
                "source": "spotify",
                "sources": ["spotify"],
            },
        ], [])

        result = get_music_through_time_tracks(
            spotify_token="existing-token",
            start_year=1990,
            end_year=1999,
            artist="Rahman",
            movie="Roja",
            composer="A. R. Rahman",
        )

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["tracks"][0]["release_year"], 1992)
        self.assertEqual(result["tracks"][0]["composer"], "")
        self.assertFalse(result["metadata"]["language_verified"])

    def test_endpoint_rejects_non_numeric_year(self):
        response = self.client.get(
            "/api/music-through-time/?start_year=old&end_year=1999",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("whole numbers", response.json()["error"])
