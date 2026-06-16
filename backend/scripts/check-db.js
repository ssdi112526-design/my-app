#!/usr/bin/env node
/**
 * Quick MongoDB connectivity check — run: npm run check:db
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URI is not set in backend/.env");
  process.exit(1);
}

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 12000 })
  .then(() => {
    console.log("✅ MongoDB connection OK");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:");
    console.error(err.message);
    process.exit(1);
  });
