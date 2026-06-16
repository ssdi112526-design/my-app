require("dotenv").config();

const { Worker } = require("bullmq");
const connectDB = require("../config/db");
const { getRedisConnectionOptions, isRedisConfigured } = require("../config/redis");
const { UPLOAD_QUEUE_NAME } = require("../queues/queue.constants");
const {
  processUploadJob,
  failUploadJob,
} = require("../services/uploadJobProcessor.service");
const { processBankUploadJob } = require("../services/bankRecordProcessor.service");
const BankUploadBatch = require("../modules/bank/bankUploadBatch.model");

const CONCURRENCY = Number(process.env.UPLOAD_WORKER_CONCURRENCY || 2);

async function startWorker() {
  if (!isRedisConfigured()) {
    console.error("❌ REDIS_URL not set — worker cannot start.");
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URI);

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
        throw err;
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ✅ completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] ❌ failed ${job?.id}:`, err?.message);
  });

  console.log(
    `👷 Upload worker running (queue=${UPLOAD_QUEUE_NAME}, concurrency=${CONCURRENCY})`
  );
}

startWorker().catch((err) => {
  console.error("Worker startup error:", err.message);
  process.exit(1);
});
