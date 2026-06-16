#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="${HOME}/.local/node/bin:${PATH}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install from https://nodejs.org or run:"
  echo "  curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.xz | tar -xJ -C ~/.local && mv ~/.local/node-v22.16.0-darwin-arm64 ~/.local/node"
  exit 1
fi

if ! nc -z 127.0.0.1 27017 2>/dev/null; then
  echo "MongoDB is not running on port 27017."
  echo "Install and start MongoDB, or set MONGO_URI in backend/.env (e.g. MongoDB Atlas)."
  echo "  brew tap mongodb/brew && brew install mongodb-community@7.0"
  echo "  brew services start mongodb-community@7.0"
  exit 1
fi

echo "Starting backend on http://localhost:5000 ..."
(cd "$ROOT/backend" && node src/server.js) &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on http://localhost:3001 ..."
(cd "$ROOT/frontend" && PORT=3001 BROWSER=none npm start) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' INT TERM

echo ""
echo "Open: http://localhost:3000"
echo "API:  http://localhost:5000/api/health"
wait
