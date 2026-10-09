from django.conf import settings
from django.db import models


class Playlist(models.Model):
    """A playlist owned by a local Music Player account."""
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="music_playlists",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    cover_art = models.URLField(blank=True)
    is_liked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.owner.username})"


class Track(models.Model):
    """Track metadata stored with a playlist so the app can work without local audio files."""
    playlist = models.ForeignKey(
        Playlist,
        on_delete=models.CASCADE,
        related_name="tracks",
    )
    spotify_id = models.CharField(max_length=120, blank=True)
    uri = models.CharField(max_length=255, blank=True)
    name = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, default="Unknown Artist")
    album = models.CharField(max_length=255, default="Unknown Album")
    image = models.URLField(blank=True)
    duration_ms = models.PositiveIntegerField(default=210000)
    spotify_url = models.URLField(blank=True)
    preview_url = models.URLField(blank=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-added_at"]

    def __str__(self):
        return f"{self.name} — {self.artist}"
