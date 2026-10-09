from django.contrib import admin
from .models import Playlist, Track


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_liked", "created_at", "updated_at")
    search_fields = ("name", "owner__username")
    list_filter = ("is_liked",)


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("name", "artist", "playlist", "added_at")
    search_fields = ("name", "artist", "playlist__name")
