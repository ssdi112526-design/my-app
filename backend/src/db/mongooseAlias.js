/**
 * Resolve `require("mongoose")` to the PostgreSQL compatibility layer.
 * Must load before any model/controller imports.
 */
const Module = require("module");
const path = require("path");

const TARGET = path.join(__dirname, "mongoose.js");
const original = Module._resolveFilename;

if (!Module.__pgMongoosePatched) {
  Module.__pgMongoosePatched = true;
  Module._resolveFilename = function resolveMongoose(request, parent, isMain, options) {
    if (request === "mongoose") return TARGET;
    return original.call(this, request, parent, isMain, options);
  };
}
