require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
require("../db/mongooseAlias");

const { Worker, UnrecoverableError } = require("bullmq");
const connectDB = require("../config/db");
const mongoose = require("../db/mongoose");
const {
  getRedisConnectionOptions,
  isRedisConfigured,
  closeRedisClients,
  redisHostLabel,
} = require("../config/redis");
const {
  UPLOAD_QUEUE_NAME,
  UPLOAD_LOCK_DURATION_MS,
} = require("../queues/queue.constants");
const {
  processUploadJob,
  failUploadJob,
} = require("../services/uploadJobProcessor.service");
const { processBankUploadJob } = require("../services/bankRecordProcessor.service");
const BankUploadBatch = require("../modules/bank/bankUploadBatch.model");

const CONCURRENCY = Number(process.env.UPLOAD_WORKER_CONCURRENCY || 2);

function isFinalAttempt(job, err) {
  if (err instanceof UnrecoverableError) return true;
  const attempts = Number(job.opts?.attempts || 3);
  return Number(job.attemptsMade || 0) + 1 >= attempts;
}

async function startWorker() {
  if (!isRedisConfigured()) {
    console.error("❌ REDIS_URL not set — worker cannot start.");
    process.exit(1);
  }

  await connectDB(process.env.DATABASE_URL);

  const worker = new Worker(
    UPLOAD_QUEUE_NAME,
    async (job) => {
      console.log(`[worker] Job ${job.id} started (batch ${job.data.batchId})`);
      try {
        if (job.data.jobType === "bank_records") {
          await processBankUploadJob(job.data);
          console.log(`[worker] Job ${job.id} completed (bank records)`);
          return { jobType: "bank_records", batchId: job.data.batchId };
        }

        const result = await processUploadJob(job.data, job);
        console.log(`[worker] Job ${job.id} completed`, result);
        return result;
      } catch (err) {
        console.error(`[worker] Job ${job.id} failed:`, err.message);
        if (isFinalAttempt(job, err)) {
          if (job.data.jobType === "bank_records") {
            const batch = await BankUploadBatch.findById(job.data.batchId);
            if (batch) {
              batch.status = "failed";
              batch.errorMessage = err.message;
              await batch.save();
            }
          } else {
            await failUploadJob(job.data, err.message);
          }
        }
        throw err;
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: CONCURRENCY,
      lockDuration: UPLOAD_LOCK_DURATION_MS,
      stalledInterval: 60000,
      maxStalledCount: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ✅ completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] ❌ failed ${job?.id}:`, err?.message);
  });

  worker.on("error", (err) => {
    console.error("[worker] error:", err.message);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] ${signal} received — finishing active jobs…`);
    try {
      await worker.close();
      await closeRedisClients();
      await mongoose.disconnect();
    } catch (err) {
      console.error("[worker] shutdown error:", err.message);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log(
    `👷 Upload worker running (queue=${UPLOAD_QUEUE_NAME}, concurrency=${CONCURRENCY}, redis=${redisHostLabel()}, lock=${UPLOAD_LOCK_DURATION_MS}ms)`
  );
}

startWorker().catch((err) => {
  console.error("Worker startup error:", err.message);
  process.exit(1);
});
