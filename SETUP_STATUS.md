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
# Terminal 1 — backend (needs PostgreSQL via DATABASE_URL)
cd backend && npm start

# Terminal 2 — frontend
cd frontend && npm start
```

## PostgreSQL required

Backend will not start until PostgreSQL is reachable. Set `DATABASE_URL` in `backend/.env` (Render External URL from this machine).
