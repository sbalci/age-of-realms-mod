#!/bin/bash
# Starts Age of Realms: runs a small web server on this computer only and opens the game in your browser.
# Keep this window open while you play. Close it (or press Ctrl+C) to stop.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed to run the game and was not found."
  echo "macOS may offer to install it now (Command Line Developer Tools). Otherwise get it from https://www.python.org/downloads/"
  open "https://www.python.org/downloads/"
  read -r -p "Press Return to close."
  exit 1
fi
echo "Starting Age of Realms at http://127.0.0.1:8000/game/"
echo "Keep this window open while you play. Close it to stop the game server."
(sleep 2; open "http://127.0.0.1:8000/game/") &
python3 -m http.server 8000 --bind 127.0.0.1
