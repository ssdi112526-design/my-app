# my-app — setup status

## Installed on this Mac

| Tool | Status | Location / notes |
|------|--------|------------------|
| **Node.js** | Yes (v22.16.0) | `~/.local/node/bin` (downloaded, not Homebrew) |
| **npm** | Yes (10.9.2) | Same as Node |
| **Git** | No | Install: `xcode-select --install` |
| **Homebrew** | Yes (user install) | `~/.homebrew/bin/brew` |
| **Project** | Yes | `/Users/chandra/my-app` (ZIP download, not `git clone`) |

## Environment files

| File | Status |
|------|--------|
| `frontend/.env` | Yes |
| `backend/.env` | Yes |

## Dev URLs (after both servers run)

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- Frontend calls API via `/api` proxy (no CORS)

## Start commands

```bash
export PATH="$HOME/.local/node/bin:$PATH"

# Terminal 1 — backend (needs MongoDB)
cd /Users/chandra/my-app/backend && npm start

# Terminal 2 — frontend
cd /Users/chandra/my-app/frontend && npm start
```

## MongoDB required

Backend will not start until MongoDB is reachable. Use **Atlas** in `backend/.env` or start local MongoDB:

```bash
export PATH="$HOME/.homebrew/bin:$PATH"
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```
