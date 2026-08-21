#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { applyBucketCors } = require("../src/utils/s3Storage");

applyBucketCors()
  .then((result) => {
    console.log(result);
    process.exit(result.applied ? 0 : 1);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
