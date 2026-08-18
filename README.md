# my-app

Personal full-stack project with a React frontend and Node.js backend.

## Project structure

- `frontend/` — React app
- `backend/` — API server

## Setup

### Frontend

```bash
cd frontend
npm install
npm start
```

Runs at [http://localhost:3000](http://localhost:3000).

### Backend

```bash
cd backend
npm install
npm start
```

Copy `.env.example` values into `backend/.env` and `frontend/.env` as needed (these files are not committed).

Backend runtime uses **PostgreSQL** via `DATABASE_URL`. Schema tables are created on startup from the existing models (`backend/migrations/001_init.sql` is the reproducible DDL). Optional one-time copy from MongoDB: `npm run migrate:mongo` (requires `MONGO_URI`; MongoDB is not modified).
