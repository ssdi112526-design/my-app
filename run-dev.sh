#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.local/node/bin:${HOME}/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== my-app dev ==="
echo "Node: $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "Project: $ROOT"
echo ""

if ! nc -z 127.0.0.1 27017 2>/dev/null; then
  echo "ERROR: MongoDB is not running on port 27017."
  echo "  - Start local MongoDB, OR"
  echo "  - Set your Atlas MONGO_URI in backend/.env"
  echo ""
  exit 1
fi

echo "Starting backend (http://localhost:5001) ..."
(cd "$ROOT/backend" && node src/server.js) &
BACKEND_PID=$!
sleep 3

if ! curl -sf http://localhost:5001/api/health >/dev/null 2>&1; then
  echo "ERROR: Backend did not start. Check backend/.env and MongoDB."
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

echo "Starting frontend (http://localhost:3000) ..."
(cd "$ROOT/frontend" && npm start) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' INT TERM

echo ""
echo "Open: http://localhost:3000"
echo "API:  http://localhost:5001/api/health"
wait
