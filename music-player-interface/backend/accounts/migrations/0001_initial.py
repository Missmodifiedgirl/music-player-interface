from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="Playlist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("cover_art", models.URLField(blank=True)),
                ("is_liked", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="music_playlists", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="Track",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("spotify_id", models.CharField(blank=True, max_length=120)),
                ("uri", models.CharField(blank=True, max_length=255)),
                ("name", models.CharField(max_length=255)),
                ("artist", models.CharField(default="Unknown Artist", max_length=255)),
                ("album", models.CharField(default="Unknown Album", max_length=255)),
                ("image", models.URLField(blank=True)),
                ("duration_ms", models.PositiveIntegerField(default=210000)),
                ("spotify_url", models.URLField(blank=True)),
                ("preview_url", models.URLField(blank=True)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                ("playlist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tracks", to="accounts.playlist")),
            ],
            options={"ordering": ["-added_at"]},
        ),
    ]
