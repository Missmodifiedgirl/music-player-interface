import json
from functools import wraps

from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .music_services import (
    MusicApiError,
    get_emotional_journey_recommendations,
    get_music_through_time_tracks,
    proxy_lastfm_request,
    get_transition_recommendations,
)
from .models import Playlist, Track

User = get_user_model()


def json_body(request):
    try:
        value = json.loads(request.body or "{}")
    except (TypeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def api_login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=401)
        return view(request, *args, **kwargs)

    return wrapper


def clean_text(value, default=""):
    if value is None:
        return default
    return str(value).strip()


def safe_int(value, default=210000, minimum=0):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(number, minimum)


def track_to_dict(track):
    return {
        "id": track.spotify_id or str(track.id),
        "db_id": track.id,
        "uri": track.uri or None,
        "name": track.name,
        "artist": track.artist,
        "album": track.album,
        "image": track.image,
        "duration_ms": track.duration_ms,
        "spotifyUrl": track.spotify_url or None,
        "preview_url": track.preview_url or None,
        "dateAdded": track.added_at.isoformat(),
    }


def playlist_to_dict(playlist, include_tracks=True):
    data = {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "coverArt": playlist.cover_art,
        "isLiked": playlist.is_liked,
        "createdAt": playlist.created_at.isoformat(),
        "updatedAt": playlist.updated_at.isoformat(),
        "tracks": [],
        "trackCount": playlist.tracks.count(),
    }
    if include_tracks:
        data["tracks"] = [track_to_dict(track) for track in playlist.tracks.all()]
    return data


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({"status": "ok", "service": "Music Player Django API"})


@require_http_methods(["GET"])
def emotional_journey(request):
    mood = request.GET.get("mood", "")
    authorization = request.headers.get("Authorization", "")
    spotify_token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""

    try:
        result = get_emotional_journey_recommendations(mood, spotify_token)
    except MusicApiError as error:
        return JsonResponse({"error": str(error)}, status=error.status_code or 400)
    return JsonResponse(result)


@require_http_methods(["GET"])
def music_through_time(request):
    authorization = request.headers.get("Authorization", "")
    spotify_token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
    try:
        start_year = int(request.GET.get("start_year", ""))
        end_year = int(request.GET.get("end_year", ""))
        offset = int(request.GET.get("offset", "0"))
        limit = int(request.GET.get("limit", "30"))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Start year, end year, offset, and limit must be whole numbers."}, status=400)

    try:
        result = get_music_through_time_tracks(
            spotify_token=spotify_token,
            start_year=start_year,
            end_year=end_year,
            language=request.GET.get("language", ""),
            artist=request.GET.get("artist", ""),
            composer=request.GET.get("composer", ""),
            movie=request.GET.get("movie", ""),
            query=request.GET.get("query", ""),
            offset=offset,
            limit=limit,
        )
    except MusicApiError as error:
        return JsonResponse({"error": str(error)}, status=error.status_code or 400)
    return JsonResponse(result)


@csrf_exempt
@require_http_methods(["POST"])
def lastfm_proxy(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)
    try:
        result = proxy_lastfm_request(data)
    except MusicApiError as error:
        return JsonResponse({"error": str(error)}, status=error.status_code or 502)
    return JsonResponse(result)


@csrf_exempt
@require_http_methods(["POST"])
def signup(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    email = clean_text(data.get("email")).lower()
    password = str(data.get("password", ""))
    name = clean_text(data.get("name")) or email.split("@", 1)[0]

    if not email or not password:
        return JsonResponse({"error": "Email and password are required."}, status=400)
    if "@" not in email:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)
    if len(name) > 150:
        return JsonResponse({"error": "Name must be 150 characters or fewer."}, status=400)
    if len(password) < 6:
        return JsonResponse({"error": "Password must contain at least 6 characters."}, status=400)

    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return JsonResponse({"error": "An account with that email already exists."}, status=409)

    try:
        user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
    except IntegrityError:
        return JsonResponse({"error": "Unable to create account."}, status=400)

    django_login(request, user)
    return JsonResponse(
        {"message": "Account created.", "user": {"id": user.id, "email": user.email, "name": user.first_name}},
        status=201,
    )


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    email = clean_text(data.get("email")).lower()
    password = str(data.get("password", ""))
    user = authenticate(request, username=email, password=password)

    if user is None:
        return JsonResponse({"error": "Email or password is incorrect."}, status=401)

    django_login(request, user)
    return JsonResponse(
        {
            "message": "Login successful.",
            "user": {"id": user.id, "email": user.email, "name": user.first_name or user.username.split("@", 1)[0]},
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    django_logout(request)
    return JsonResponse({"message": "Logged out."})


@require_http_methods(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False, "user": None})

    return JsonResponse(
        {
            "authenticated": True,
            "user": {
                "id": request.user.id,
                "email": request.user.email,
                "username": request.user.username,
                "name": request.user.first_name or request.user.username.split("@", 1)[0],
            },
        }
    )


@api_login_required
@require_http_methods(["GET"])
def playlists(request):
    user_playlists = Playlist.objects.filter(owner=request.user).prefetch_related("tracks")
    return JsonResponse({"playlists": [playlist_to_dict(p) for p in user_playlists]})


@require_http_methods(["GET"])
def transition_recommendations(request):
    """GET /api/transition-recommendations/?track_id=&name=&artist=&limit="""
    authorization = request.headers.get("Authorization", "")
    spotify_token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
    spotify_track_id = request.GET.get("track_id", "").strip()
    name = request.GET.get("name", "").strip()
    artist = request.GET.get("artist", "").strip()
    try:
        limit = int(request.GET.get("limit", "20"))
    except (TypeError, ValueError):
        limit = 20

    try:
        result = get_transition_recommendations(spotify_token=spotify_token, spotify_track_id=spotify_track_id or None, name=name, artist=artist, limit=limit)
    except MusicApiError as error:
        return JsonResponse({"error": str(error)}, status=error.status_code or 400)
    return JsonResponse(result)


@api_login_required
@csrf_exempt
@require_http_methods(["POST"])
def create_playlist(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    name = clean_text(data.get("name"))
    if not name:
        return JsonResponse({"error": "Playlist name is required."}, status=400)

    playlist = Playlist.objects.create(
        owner=request.user,
        name=name,
        description=clean_text(data.get("description")),
        cover_art=clean_text(data.get("coverArt")),
        is_liked=bool(data.get("isLiked", False)),
    )
    return JsonResponse({"playlist": playlist_to_dict(playlist)}, status=201)


def owned_playlist(request, playlist_id):
    try:
        return Playlist.objects.get(id=playlist_id, owner=request.user)
    except Playlist.DoesNotExist:
        return None


@api_login_required
@csrf_exempt
@require_http_methods(["PUT", "PATCH"])
def update_playlist(request, playlist_id):
    playlist = owned_playlist(request, playlist_id)
    if not playlist:
        return JsonResponse({"error": "Playlist not found."}, status=404)

    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    if "name" in data:
        name = clean_text(data["name"])
        if not name:
            return JsonResponse({"error": "Playlist name cannot be empty."}, status=400)
        playlist.name = name
    if "description" in data:
        playlist.description = clean_text(data["description"])
    if "coverArt" in data:
        playlist.cover_art = clean_text(data["coverArt"])
    if "isLiked" in data:
        playlist.is_liked = bool(data["isLiked"])

    playlist.save()
    return JsonResponse({"playlist": playlist_to_dict(playlist)})


@api_login_required
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_playlist(request, playlist_id):
    playlist = owned_playlist(request, playlist_id)
    if not playlist:
        return JsonResponse({"error": "Playlist not found."}, status=404)
    if playlist.is_liked:
        return JsonResponse({"error": "Liked Songs cannot be deleted."}, status=400)

    playlist.delete()
    return JsonResponse({"message": "Playlist deleted."})


@api_login_required
@csrf_exempt
@require_http_methods(["POST"])
def add_track(request, playlist_id):
    playlist = owned_playlist(request, playlist_id)
    if not playlist:
        return JsonResponse({"error": "Playlist not found."}, status=404)

    data = json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    name = clean_text(data.get("name"))
    if not name:
        return JsonResponse({"error": "Track name is required."}, status=400)

    spotify_id = clean_text(data.get("id"))
    uri = clean_text(data.get("uri"))

    duplicate = None
    if spotify_id:
        duplicate = Track.objects.filter(playlist=playlist, spotify_id=spotify_id).first()
    if duplicate is None and uri:
        duplicate = Track.objects.filter(playlist=playlist, uri=uri).first()

    if duplicate:
        return JsonResponse({"added": False, "track": track_to_dict(duplicate)})

    track = Track.objects.create(
        playlist=playlist,
        spotify_id=spotify_id,
        uri=uri,
        name=name,
        artist=clean_text(data.get("artist"), "Unknown Artist"),
        album=clean_text(data.get("album"), "Unknown Album"),
        image=clean_text(data.get("image")),
        duration_ms=safe_int(data.get("duration_ms"), 210000),
        spotify_url=clean_text(data.get("spotifyUrl")),
        preview_url=clean_text(data.get("preview_url")),
    )
    playlist.save(update_fields=["updated_at"])
    return JsonResponse({"added": True, "track": track_to_dict(track)}, status=201)


@api_login_required
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_track(request, playlist_id, track_id):
    playlist = owned_playlist(request, playlist_id)
    if not playlist:
        return JsonResponse({"error": "Playlist not found."}, status=404)

    try:
        track = playlist.tracks.get(id=track_id)
    except Track.DoesNotExist:
        return JsonResponse({"error": "Track not found."}, status=404)

    track.delete()
    playlist.save(update_fields=["updated_at"])
    return JsonResponse({"message": "Track removed."})
