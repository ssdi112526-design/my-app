require("./mongooseAlias");

const { Schema, Mixed } = require("./schema");
const { ObjectId } = require("./objectId");
const { createModel, models } = require("./model");
const { initPool, closePool, query, getPool } = require("./pool");
const { ensureSchema } = require("./migrate");

Schema.Types.ObjectId = ObjectId;
Schema.Types.Mixed = Mixed;
Schema.Types.String = String;
Schema.Types.Number = Number;
Schema.Types.Boolean = Boolean;
Schema.Types.Date = Date;

const connection = {
  readyState: 0,
  db: {
    async stats() {
      const result = await query(`SELECT pg_database_size(current_database()) AS size`);
      const size = Number(result.rows[0]?.size || 0);
      return { dataSize: size, indexSize: 0, storageSize: size };
    },
  },
};

async function connect(uri) {
  const url = uri || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL missing in .env");
  }
  initPool(url);
  require("../modules/loadModels");
  await ensureSchema();
  const { ensureUploadSearchSchema } = require("../services/uploadSearchRows.service");
  await ensureUploadSearchSchema();
  connection.readyState = 1;
  return mongoose;
}

async function disconnect() {
  await closePool();
  connection.readyState = 0;
}

function model(name, schema) {
  if (!schema) {
    if (!models[name]) throw new Error(`Model ${name} not registered`);
    return models[name];
  }
  return createModel(name, schema);
}

function set() {
  return mongoose;
}

const mongoose = {
  Schema,
  model,
  models,
  connect,
  disconnect,
  connection,
  set,
  Types: { ObjectId },
  SchemaTypes: Schema.Types,
};

module.exports = mongoose;
module.exports.default = mongoose;
