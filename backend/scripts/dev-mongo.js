const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: "repo_app" },
  });
  console.log(`MongoDB ready: ${mongod.getUri()}`);
  process.on("SIGINT", async () => {
    await mongod.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await mongod.stop();
    process.exit(0);
  });
})().catch((err) => {
  console.error("MongoDB failed to start:", err.message);
  process.exit(1);
});
