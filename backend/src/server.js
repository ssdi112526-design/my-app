require("dotenv").config();

const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);

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
      const { isS3Configured } = require("./utils/s3Storage");
      if (isS3Configured()) {
        console.log(
          `📦 Upload storage: AWS S3 bucket "${process.env.AWS_S3_BUCKET}" (${process.env.AWS_REGION || "us-east-1"})`
        );
      } else {
        console.warn("⚠️  AWS S3 not configured — Excel uploads will fail until .env is set.");
      }
    });
  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
})();