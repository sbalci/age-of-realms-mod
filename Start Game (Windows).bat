@echo off
rem Starts Age of Realms: runs a small web server on this computer only and opens the game in your browser.
rem Keep this window open while you play. Close it (or press Ctrl+C) to stop.
title Age of Realms
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py
if not defined PY (python --version >nul 2>nul && set PY=python)
if not defined PY (
  echo.
  echo Python is needed to run the game and was not found.
  echo The download page will open now. Install Python, tick "Add python.exe to PATH",
  echo then double-click this file again.
  echo.
  start "" https://www.python.org/downloads/
  pause
  exit /b 1
)
echo Starting Age of Realms at http://127.0.0.1:8000/game/
echo Keep this window open while you play. Close it to stop the game server.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://127.0.0.1:8000/game/"
%PY% -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo The game server could not start. If another program uses port 8000, close it and try again.
  pause
)
