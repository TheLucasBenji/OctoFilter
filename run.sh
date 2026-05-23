#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Kill all background jobs on exit
trap 'echo ""; echo "Stopping..."; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM EXIT

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "▸ Installing frontend dependencies..."
  (cd frontend && npm install)
fi

# Check uvicorn is available
if ! command -v uvicorn &> /dev/null; then
  echo "▸ uvicorn not found. Installing backend deps..."
  pip install fastapi uvicorn[standard] python-multipart
fi

echo ""
echo "▸ Starting backend on http://localhost:8000"
uvicorn backend.main:app --port 8000 --reload 2>&1 | sed 's/^/[backend] /' &

echo "▸ Starting frontend on http://localhost:5173"
(cd frontend && npm run dev) 2>&1 | sed 's/^/[frontend] /' &

echo ""
echo "  Octopus running:"
echo "  → http://localhost:5173"
echo "  → http://localhost:8000/docs  (API)"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

wait
