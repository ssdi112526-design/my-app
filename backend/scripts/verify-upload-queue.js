#!/usr/bin/env node
/**
 * Verify Redis + existing BullMQ upload queue (no new queue).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const Redis = require("ioredis");
const { Queue } = require("bullmq");
const {
  isRedisConfigured,
  isUploadQueueEnabled,
  getRedisConnectionOptions,
  redisHostLabel,
} = require("../src/config/redis");
const {
  UPLOAD_QUEUE_NAME,
  UPLOAD_JOB_NAME,
  UPLOAD_JOB_ATTEMPTS,
  UPLOAD_JOB_BACKOFF_MS,
  UPLOAD_LOCK_DURATION_MS,
} = require("../src/queues/queue.constants");
const { enqueueUploadJob, getUploadQueue } = require("../src/queues/uploadQueue");

(async () => {
  const report = {
    redisConfigured: isRedisConfigured(),
    queueEnabled: isUploadQueueEnabled(),
    host: isRedisConfigured() ? redisHostLabel() : null,
    queueName: UPLOAD_QUEUE_NAME,
    jobName: UPLOAD_JOB_NAME,
    attempts: UPLOAD_JOB_ATTEMPTS,
    backoffMs: UPLOAD_JOB_BACKOFF_MS,
    lockDurationMs: UPLOAD_LOCK_DURATION_MS,
    ping: null,
    counts: null,
    duplicate: null,
    error: null,
  };

  if (!isRedisConfigured()) {
    report.error = "REDIS_URL / UPSTASH_REDIS_URL is not set";
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const redis = new Redis(getRedisConnectionOptions());
  try {
    report.ping = await redis.ping();
    const queue = getUploadQueue();
    report.counts = await queue.getJobCounts(
      "wait",
      "active",
      "delayed",
      "completed",
      "failed",
      "paused"
    );

    const probeId = `verify-dup-${Date.now()}`;
    const first = await enqueueUploadJob({ batchId: probeId, probe: true });
    const second = await enqueueUploadJob({ batchId: probeId, probe: true });
    report.duplicate = { first, second };
    const probeJob = await queue.getJob(probeId);
    if (probeJob) await probeJob.remove();

    console.log(JSON.stringify(report, null, 2));
    if (report.ping !== "PONG") process.exit(1);
  } catch (err) {
    report.error = err.message;
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  } finally {
    await redis.quit().catch(() => {});
    const q = getUploadQueue();
    if (q) await q.close().catch(() => {});
  }
})();
