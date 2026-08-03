#!/usr/bin/env bash
# run.sh — convenience wrapper
# Activates the venv and runs main.py with any arguments passed to this script.
# Usage:
#   ./run.sh                              # webcam
#   ./run.sh --source video.mp4          # video file
#   ./run.sh --save-video --output out.mp4
#   ./run.sh --no-track

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"

if [ ! -f "$VENV/bin/activate" ]; then
  echo "[ERROR] Virtual environment not found at $VENV"
  echo "        Run:  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

source "$VENV/bin/activate"
exec python3 "$SCRIPT_DIR/src/main.py" "$@"
