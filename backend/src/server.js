require("dotenv").config();
require("./db/mongooseAlias");

const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.DATABASE_URL);

    const server = http.createServer(app);
    initSocket(server);
    const { initSocketBridge } = require("./utils/socketBridge");
    initSocketBridge();

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `❌ Port ${PORT} is already in use. Stop the other server (or close old terminals), then restart.`
        );
      } else {
        console.error("❌ Server error:", err.message);
      }
      process.exit(1);
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO enabled on /socket.io`);
      const { isUploadQueueEnabled, redisHostLabel } = require("./config/redis");
      if (isUploadQueueEnabled()) {
        console.log(`📬 Upload queue ON (${redisHostLabel()}) — run: npm run worker`);
      } else {
        console.warn("📬 Upload queue OFF — set REDIS_URL and UPLOAD_USE_QUEUE=true, then run npm run worker");
      }
      const { isS3Configured } = require("./utils/s3Storage");
      if (isS3Configured()) {
        console.log(
          `📦 Upload storage: AWS S3 bucket "${process.env.AWS_S3_BUCKET}" (${process.env.AWS_REGION || "us-east-1"})`
        );
        const { applyBucketCors } = require("./utils/s3Storage");
        applyBucketCors()
          .then((result) => {
            if (result.applied) {
              console.log(`📦 S3 CORS allowed origins: ${result.origins.join(", ")}`);
            }
          })
          .catch((err) => {
            console.warn("⚠️  Could not update S3 bucket CORS:", err.message);
          });
      } else {
        console.warn("⚠️  AWS S3 not configured — Excel uploads will fail until .env is set.");
      }
    });
    const shutdownApi = async (signal) => {
      console.log(`${signal} received — closing API…`);
      try {
        const { closeUploadQueue } = require("./queues/uploadQueue");
        const { closeRedisClients } = require("./config/redis");
        await closeUploadQueue();
        await closeRedisClients();
      } catch (_err) {
        /* ignore */
      }
      process.exit(0);
    };
    process.on("SIGTERM", () => shutdownApi("SIGTERM"));
    process.on("SIGINT", () => shutdownApi("SIGINT"));
  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
})();