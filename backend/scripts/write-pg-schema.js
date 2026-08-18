#!/usr/bin/env node
/**
 * Write reproducible PostgreSQL DDL from registered Mongoose schemas.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const fs = require("fs");
const path = require("path");
require("../src/modules/loadModels");
const { generateInitSQL } = require("../src/db/migrate");

const out = path.join(__dirname, "../migrations/001_init.sql");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, generateInitSQL());
console.log("Wrote", out);
