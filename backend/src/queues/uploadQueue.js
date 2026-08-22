const { Queue } = require("bullmq");
const { isRedisConfigured, getRedisConnectionOptions } = require("../config/redis");
const {
  UPLOAD_QUEUE_NAME,
  UPLOAD_JOB_NAME,
  UPLOAD_JOB_ATTEMPTS,
  UPLOAD_JOB_BACKOFF_MS,
} = require("./queue.constants");

let uploadQueue = null;

function getUploadQueue() {
  if (!isRedisConfigured()) return null;

  if (!uploadQueue) {
    uploadQueue = new Queue(UPLOAD_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: UPLOAD_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: UPLOAD_JOB_BACKOFF_MS },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }

  return uploadQueue;
}

/**
 * Enqueue Excel processing after file is on S3.
 * jobId = batchId prevents duplicate jobs for the same upload.
 */
async function enqueueUploadJob(payload) {
  const queue = getUploadQueue();
  if (!queue) {
    return { queued: false, reason: "redis_not_configured" };
  }

  const jobId = String(payload.batchId);

  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["waiting", "active", "delayed", "paused"].includes(state)) {
      return { queued: true, jobId, duplicate: true, state };
    }
    if (state === "completed") {
      return { queued: true, jobId, duplicate: true, state };
    }
    if (state === "failed") {
      await existing.retry();
      return { queued: true, jobId, duplicate: false, retried: true, state };
    }
  }

  try {
    const job = await queue.add(UPLOAD_JOB_NAME, payload, { jobId });
    return { queued: true, jobId: job.id, duplicate: false };
  } catch (err) {
    if (/already (exists|exist)/i.test(String(err.message || ""))) {
      return { queued: true, jobId, duplicate: true };
    }
    throw err;
  }
}

async function closeUploadQueue() {
  if (!uploadQueue) return;
  await uploadQueue.close();
  uploadQueue = null;
}

module.exports = {
  getUploadQueue,
  enqueueUploadJob,
  closeUploadQueue,
};
