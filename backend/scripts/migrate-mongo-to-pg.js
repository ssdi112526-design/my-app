#!/usr/bin/env node
/**
 * Copy documents from MongoDB into PostgreSQL without modifying MongoDB.
 *
 *   npm run migrate:mongo
 *
 * Requires MONGO_URI (read-only source) and DATABASE_URL (destination).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { models } = require("../src/db/model");
const { MONGO_COLLECTIONS } = require("../src/db/tableNames");

function transformValue(value) {
  if (value == null) return value;
  if (typeof value === "object" && value._bsontype === "ObjectId") return String(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(transformValue);
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "__v") continue;
      out[key] = transformValue(nested);
    }
    return out;
  }
  return value;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is not set. Skipping data copy (schema-only PostgreSQL is fine).");
    process.exit(0);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  let MongoClient;
  try {
    ({ MongoClient } = require("mongodb"));
  } catch (_err) {
    console.error("Install the MongoDB driver for import: npm i mongodb --save-dev");
    process.exit(1);
  }

  await connectDB(process.env.DATABASE_URL);
  const mongo = new MongoClient(mongoUri);
  try {
    await mongo.connect();
  } catch (err) {
    console.error("Could not reach MongoDB (read-only source). PostgreSQL schema is already in place.");
    console.error(err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
  const db = mongo.db();

  console.log("Connected to MongoDB (read-only) and PostgreSQL.\n");

  const report = [];
  try {
    for (const [modelName, Model] of Object.entries(models)) {
      const collectionName = MONGO_COLLECTIONS[modelName];
      if (!collectionName) continue;
      const collection = db.collection(collectionName);
      const mongoCount = await collection.countDocuments();
      let inserted = 0;
      let skipped = 0;
      let failed = 0;

      const cursor = collection.find({});
      while (await cursor.hasNext()) {
        const raw = await cursor.next();
        const doc = transformValue(raw);
        if (doc._id) doc._id = String(doc._id);
        try {
          await Model.create(doc);
          inserted += 1;
        } catch (err) {
          if (err.code === 11000 || /duplicate|unique/i.test(err.message || "")) {
            skipped += 1;
          } else {
            failed += 1;
            console.error(`  ${modelName} ${doc._id}: ${err.message}`);
          }
        }
      }

      const pgCount = await Model.countDocuments();
      report.push({ modelName, collectionName, mongoCount, inserted, skipped, failed, pgCount });
      console.log(
        `${modelName.padEnd(28)} mongo=${mongoCount} inserted=${inserted} skipped=${skipped} failed=${failed} pg=${pgCount}`
      );
    }
  } finally {
    await mongo.close();
    await mongoose.disconnect();
  }

  const failedTotal = report.reduce((sum, row) => sum + row.failed, 0);
  console.log(failedTotal ? "\nCompleted with errors." : "\nData copy complete. MongoDB was not modified.");
  process.exit(failedTotal ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
