@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Music Player - Django Backend
echo ========================================

echo.
if not exist "venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    py -m venv venv
    if errorlevel 1 (
        echo.
        echo ERROR: Could not create the virtual environment.
        echo Please install Python 3.11 or newer and make sure the Python launcher is available.
        pause
        exit /b 1
    )
)

set "PY=venv\Scripts\python.exe"

"%PY%" -m pip install --upgrade pip
if errorlevel 1 goto :error

"%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo.
echo Running Django system check...
"%PY%" manage.py check
if errorlevel 1 goto :error

echo.
echo Applying database migrations...
"%PY%" manage.py migrate
if errorlevel 1 goto :error

echo.
echo Backend starting at http://127.0.0.1:8000/
"%PY%" manage.py runserver 127.0.0.1:8000
pause
exit /b 0

:error
echo.
echo ========================================
echo ERROR: Backend setup failed.
echo ========================================
pause
exit /b 1
