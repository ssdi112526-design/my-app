const UPLOAD_JOB_ATTEMPTS = Math.max(1, Number(process.env.UPLOAD_JOB_ATTEMPTS || 3));
const UPLOAD_JOB_BACKOFF_MS = Math.max(500, Number(process.env.UPLOAD_JOB_BACKOFF_MS || 5000));
const UPLOAD_LOCK_DURATION_MS = Math.max(
  60000,
  Number(process.env.UPLOAD_LOCK_DURATION_MS || 10 * 60 * 1000)
);

module.exports = {
  UPLOAD_QUEUE_NAME: "excel-upload-queue",
  UPLOAD_JOB_NAME: "process-excel-upload",
  SOCKET_CHANNEL: "upload-events",
  UPLOAD_JOB_ATTEMPTS,
  UPLOAD_JOB_BACKOFF_MS,
  UPLOAD_LOCK_DURATION_MS,
};
