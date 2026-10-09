# Music Player Interface

This project separates the React frontend and Django backend into their own folders. The frontend is served by Vite and uses the existing Spotify PKCE session and shared player. Django handles website accounts and playlist endpoints, and proxies Last.fm requests and fetches Spotify/Last.fm recommendations for Emotional Journey.

## Project structure

```text
music-player-interface/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── style.css
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Mounts the player shell and initializes the player
│       ├── app-shell.html     # Existing player interface
│       └── backend-api.js     # Django API client
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── main/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── accounts/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/
│   └── templates/
├── start-frontend.bat
└── start-backend.bat
```

## Backend setup on Windows

From the project root, open PowerShell and enter the backend folder:

```powershell
cd .\backend
```

Create and activate a virtual environment:

```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
```

Install packages:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Check Django:

```powershell
python manage.py check
```

Create the database:

```powershell
python manage.py migrate
```

Create an admin account:

```powershell
python manage.py createsuperuser
```

Set the Last.fm API key in the backend process environment before starting Django. The key is never configured in React or browser storage:

```powershell
$env:LASTFM_API_KEY = "your-lastfm-api-key"
python manage.py runserver 127.0.0.1:8000
```

For local development, the backend also reads `backend\.env.local` (one line: `LASTFM_API_KEY=your-lastfm-api-key`). This file is excluded by `backend\.gitignore`; restart Django after changing it. An environment variable takes precedence.

Backend API:

`http://127.0.0.1:8000/api/health/`

Admin:

`http://127.0.0.1:8000/admin/`

## Frontend setup

Open a second terminal in the frontend folder:

```powershell
cd .\frontend
npm install
npm run dev
```

Frontend:

`http://127.0.0.1:5173/`

## One-click backend

Double-click:

`backend\start-backend.bat`

or from the project root:

`start-backend.bat`

The script creates a local `venv`, installs requirements, runs `manage.py check`, applies migrations, and starts Django.

## Backend features

- User signup/login/logout
- Session authentication
- Current-user endpoint
- Per-user playlists
- Create/update/delete playlists
- Add/remove playlist tracks
- Duplicate-track protection
- Django Admin
- SQLite database
- CORS for Vite development
- Health endpoint
- `GET /api/emotional-journey/?mood=sad` gathers paginated, mood-tagged Spotify and Last.fm tracks, ranks and deduplicates them, and reports per-source errors
- `POST /api/lastfm/` proxies existing Last.fm metadata requests using the backend-only `LASTFM_API_KEY` configuration

The frontend sends the current Spotify OAuth access token to Django for Emotional Journey requests; Django does not request or store Spotify credentials. Last.fm requests are proxied through Django so the Last.fm API key stays server-side. Track favorites and journey playlists continue to use the existing browser playlist store.
