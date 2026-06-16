# Loan Recovery & Repossession System — Roadmap

This document maps your **full enterprise spec** to what is **already built** in this repo vs **planned additions**. Existing login, confirmation, Excel upload, bank notify, and SSDI flows are **not redesigned**—only extended.

## Role mapping (spec → this codebase)

| Spec | Implemented as | Portal |
|------|----------------|--------|
| Super Admin | `SSDI_SUPER_ADMIN` | `/ssdi/*` |
| Repo Admin | `REPO_ADMIN` | `/repo-admin/login`, company panel |
| Staff | `TEAM_LEADER`, `HEAD_OFFICE_STAFF`, `OFFICE_STAFF` | `/repo-agent/login` |
| Tracer (field) | Same as staff + `REPO_STAFF` | Trace via `/confirmation`, `/details-view` |
| Viewer | `REPO_VIEWER` | Read-only menus |
| Bank Admin | **Planned** | Separate bank portal (not started) |

## Already implemented (keep as-is)

- JWT auth (SSDI, repo admin, repo agent logins)
- Company + repo admin creation (SSDI), plans, subscriptions, connect-fee hooks (dev skip)
- Excel bulk upload + preview (`/api/uploads`); files go to **AWS S3** when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET` are set in `backend/.env` (see `backend/.env.example`)
- Repo cases, find vehicles, remarks, bank notify (WhatsApp share URL, email/SMS)
- Confirmations (trace → admin review → inventory)
- Notifications (REST + panel)
- Company banks & branches
- Blacklist, feedback, finances, reports, exports
- User management + phone OTP (test OTP `123456`)
- LRMS-style confirmation detail, inventory upload

## Phase 1 — Added in codebase (foundation)

| Feature | API / UI |
|---------|----------|
| Field trace statuses | `PATCH /api/field-tracking/cases/:id/trace-status` |
| GPS location snapshots | `POST /api/field-tracking/cases/:id/location` |
| Case timeline | `GET /api/field-tracking/cases/:id/timeline` |
| Audit logs | `GET /api/audit-logs` (repo admin / SSDI) |
| Cases list | `/cases` (repo panel) |
| Live tracking page | `/live-tracking` (geolocation → API) |
| Real-time notifications | Socket.IO on same server as API |
| PWA manifest | Branded `manifest.json` |

## Phase 2 — Next (not breaking existing flows)

- Refresh tokens + password reset (email)
- Bank Admin role + bank upload portal
- Google Maps markers (needs `REACT_APP_GOOGLE_MAPS_KEY`)
- WhatsApp Cloud API (server-side send)
- AWS S3 / Cloudinary for media
- Helmet rate limits (production)
- Full payment UI (SSDI + Razorpay history)
- PDF inventory report
- Auto-assignment rules
- Multi-language

## Phase 3 — Enterprise / deploy

- Vercel (frontend) + Render (API) + MongoDB Atlas
- Domain split: `app.*` / `api.*`
- Push notifications (PWA service worker)
- Geo-fencing, route optimization, heatmaps

## Environment variables (additive)

```env
# Existing
MONGO_URI=
JWT_SECRET=

# Optional new
REACT_APP_GOOGLE_MAPS_KEY=
REACT_APP_SOCKET_URL=http://localhost:5000
SKIP_PAYMENT_CHECKS=true
```

## Test OTP (development)

Repo admin company create & user create: **`123456`**
