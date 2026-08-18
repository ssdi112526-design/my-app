# Upload pipeline (S3 → BullMQ → Worker)

```
Browser → S3 (presigned PUT)
       → API /uploads/s3/complete
       → BullMQ job (Redis)
       → Worker streams Excel from S3
       → 1000 rows/chunk → bulkWrite (optional)
       → Socket.IO progress → React UI
```

## Services

| Service | Role |
|---------|------|
| **AWS S3** | Store Excel files |
| **Upstash Redis** | BullMQ queue backend |
| **BullMQ Worker** | Background Excel processing |
| **MongoDB Atlas** | Upload batch metadata only (cases optional) |

## Environment (`backend/.env`)

```env
# S3 (required)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-north-1
AWS_S3_BUCKET=fastrecovery

# Redis / Upstash (required for queue)
REDIS_URL=rediss://default:PASSWORD@HOST:6379

# PostgreSQL — metadata + optional row import
DATABASE_URL=

# false = S3 only (default, saves Atlas space)
ENABLE_MONGO_IMPORT=false
MAX_MONGO_IMPORT_ROWS=50000
EXCEL_CHUNK_SIZE=1000
UPLOAD_WORKER_CONCURRENCY=2
```

## Run (3 terminals)

```bash
# 1 API
cd backend && npm run dev

# 2 Worker
cd backend && npm run worker:dev

# 3 Frontend
cd frontend && npm start
```

## Scaling

- **More uploads**: increase `UPLOAD_WORKER_CONCURRENCY` or run multiple worker processes
- **Huge files**: keep `ENABLE_MONGO_IMPORT=false`; data stays on S3
- **Search in app**: set `ENABLE_MONGO_IMPORT=true` + upgrade Atlas (M10+)

## Files

| Path | Purpose |
|------|---------|
| `src/config/redis.js` | Redis connection |
| `src/queues/uploadQueue.js` | Job producer |
| `src/workers/worker.js` | Worker entry |
| `src/services/excelStream.service.js` | ExcelJS streaming |
| `src/services/uploadBulk.service.js` | MongoDB bulkWrite |
| `src/services/uploadJobProcessor.service.js` | Job logic |
| `src/utils/socketBridge.js` | Worker → Socket.IO via Redis |
