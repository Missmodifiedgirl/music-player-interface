from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("emotional-journey/", views.emotional_journey, name="emotional_journey"),
    path("music-through-time/", views.music_through_time, name="music_through_time"),
    path("lastfm/", views.lastfm_proxy, name="lastfm_proxy"),
    path("transition-recommendations/", views.transition_recommendations, name="transition_recommendations"),
    path("auth/signup/", views.signup, name="signup"),
    path("auth/login/", views.login, name="login"),
    path("auth/logout/", views.logout, name="logout"),
    path("auth/me/", views.me, name="me"),
    path("playlists/", views.playlists, name="playlists"),
    path("playlists/create/", views.create_playlist, name="create_playlist"),
    path("playlists/<int:playlist_id>/", views.update_playlist, name="update_playlist"),
    path("playlists/<int:playlist_id>/delete/", views.delete_playlist, name="delete_playlist"),
    path("playlists/<int:playlist_id>/tracks/", views.add_track, name="add_track"),
    path("playlists/<int:playlist_id>/tracks/<int:track_id>/", views.delete_track, name="delete_track"),
]
