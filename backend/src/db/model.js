const { ObjectId } = require("./objectId");
const { query } = require("./pool");
const { qident, filterToSql, sortToSql, normalizeValue } = require("./filterToSql");
const {
  Document,
  hydrateRow,
  wrapArrays,
  applyDefaults,
  applyStringTransforms,
  applyUpdate,
  toJsonbParam,
} = require("./document");
const { runAggregate } = require("./aggregate");
const { tableFor } = require("./tableNames");

const models = {};

function isJsonbField(schema, name) {
  return schema.jsonbPaths.has(name) || schema.arrayPaths.has(name);
}

function prepareValue(schema, name, value) {
  if (value === undefined) return undefined;
  if (schema.objectIdPaths.has(name)) {
    return value == null ? null : String(value);
  }
  if (schema.datePaths.has(name)) {
    if (value == null || value === "") return null;
    return value instanceof Date ? value : new Date(value);
  }
  if (schema.booleanPaths.has(name)) {
    return value == null ? null : Boolean(value);
  }
  if (schema.numberPaths.has(name)) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (isJsonbField(schema, name)) {
    if (value == null) return null;
    return toJsonbParam(value);
  }
  if (schema.stringPaths.has(name)) {
    if (value == null) return null;
    return applyStringTransforms(name, String(value), schema);
  }
  if (value != null && typeof value === "object") return toJsonbParam(value);
  return value;
}

function rowToDoc(model, row, { lean = false } = {}) {
  if (!row) return null;
  const data = hydrateRow(row, model.schema);
  if (lean) {
    wrapArrays(data, model.schema);
    return data;
  }
  return new Document(model, data, { isNew: false });
}

class Query {
  constructor(model, filter = {}, options = {}) {
    this.model = model;
    this.filter = filter || {};
    this.options = {
      select: null,
      sort: null,
      skip: 0,
      limit: null,
      lean: false,
      populate: [],
      one: !!options.one,
      count: !!options.count,
      distinct: options.distinct || null,
      op: options.op || "find",
      update: options.update || null,
      updateOptions: options.updateOptions || {},
      delete: !!options.delete,
    };
  }

  select(spec) {
    this.options.select = spec;
    return this;
  }

  sort(spec) {
    this.options.sort = spec;
    return this;
  }

  skip(n) {
    this.options.skip = Number(n) || 0;
    return this;
  }

  limit(n) {
    this.options.limit = n == null ? null : Number(n);
    return this;
  }

  lean(v = true) {
    this.options.lean = v;
    return this;
  }

  populate(path, select) {
    if (path && typeof path === "object") {
      this.options.populate.push(path);
    } else {
      this.options.populate.push({ path, select });
    }
    return this;
  }

  session() {
    return this;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  async exec() {
    if (this.options.op === "update") {
      return this.model._update(this.filter, this.options.update, this.options.updateOptions);
    }
    if (this.options.op === "delete") {
      return this.model._delete(this.filter);
    }
    if (this.options.count) {
      const params = [];
      const where = filterToSql(this.filter, this.model.schema, params);
      const result = await query(
        `SELECT COUNT(*)::int AS c FROM ${qident(this.model.tableName)} WHERE ${where}`,
        params
      );
      return result.rows[0]?.c || 0;
    }
    if (this.options.distinct) {
      const params = [];
      const where = filterToSql(this.filter, this.model.schema, params);
      const col = qident(this.options.distinct);
      const result = await query(
        `SELECT DISTINCT ${col} FROM ${qident(this.model.tableName)} WHERE ${where}`,
        params
      );
      return result.rows
        .map((r) => r[this.options.distinct])
        .filter((v) => v !== undefined);
    }

    const params = [];
    const where = filterToSql(this.filter, this.model.schema, params);
    const projection = this._selectSql();
    let sql = `SELECT ${projection} FROM ${qident(this.model.tableName)} WHERE ${where}`;
    sql += sortToSql(this.options.sort);
    if (this.options.one) sql += " LIMIT 1";
    else {
      if (this.options.limit != null) sql += ` LIMIT ${Number(this.options.limit)}`;
      if (this.options.skip) sql += ` OFFSET ${Number(this.options.skip)}`;
    }
    const result = await query(sql, params);
    const docs = result.rows.map((row) =>
      rowToDoc(this.model, row, { lean: this.options.lean })
    );
    if (this.options.populate.length) {
      await this.model._populateDocs(docs, this.options.populate);
    }
    return this.options.one ? docs[0] || null : docs;
  }

  _selectSql() {
    const spec = this.options.select;
    const hidden = this.model.schema.selectFalse;
    if (!spec) {
      if (!hidden.size) return "*";
      const cols = ["_id", ...Object.keys(this.model.schema.definition)].filter(
        (n) => !hidden.has(n)
      );
      if (this.model.schema.options.timestamps) {
        cols.push("createdAt", "updatedAt");
      }
      return [...new Set(cols)].map(qident).join(", ");
    }

    const include = [];
    const exclude = new Set();
    const plus = new Set();
    const tokens = String(spec).split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (token.startsWith("-")) exclude.add(token.slice(1));
      else if (token.startsWith("+")) plus.add(token.slice(1));
      else include.push(token);
    }

    if (include.length) {
      if (!include.includes("_id") && !exclude.has("_id")) include.unshift("_id");
      return include.map(qident).join(", ");
    }

    const cols = ["_id", ...Object.keys(this.model.schema.definition)];
    if (this.model.schema.options.timestamps) cols.push("createdAt", "updatedAt");
    const selected = [...new Set(cols)].filter(
      (n) => !exclude.has(n) && (!hidden.has(n) || plus.has(n))
    );
    return selected.map(qident).join(", ");
  }
}

class Model {
  constructor(name, schema) {
    this.modelName = name;
    this.schema = schema;
    this.tableName = tableFor(name);
    this.collection = { name: this.tableName };
  }

  find(filter = {}, projection) {
    const q = new Query(this, filter);
    if (projection) q.select(projection);
    return q;
  }

  findOne(filter = {}, projection) {
    const q = new Query(this, filter, { one: true });
    if (projection) q.select(projection);
    return q;
  }

  findById(id, projection) {
    if (id == null || id === "") {
      return this.findOne({ _id: "__invalid__" });
    }
    return this.findOne({ _id: String(id) }, projection);
  }

  countDocuments(filter = {}) {
    return new Query(this, filter, { count: true });
  }

  estimatedDocumentCount() {
    return this.countDocuments({});
  }

  distinct(field, filter = {}) {
    return new Query(this, filter, { distinct: field });
  }

  exists(filter = {}) {
    return this.findOne(filter).select("_id").lean().then((doc) => (doc ? { _id: doc._id } : null));
  }

  create(docs) {
    const list = Array.isArray(docs) ? docs : [docs];
    return Promise.all(list.map((d) => this._insertOne(d))).then((created) =>
      Array.isArray(docs) ? created : created[0]
    );
  }

  async insertMany(docs, options = {}) {
    const created = [];
    for (const doc of docs || []) {
      try {
        created.push(await this._insertOne(doc));
      } catch (err) {
        if (options.ordered === false && isUniqueError(err)) continue;
        if (options.ordered === false) continue;
        throw err;
      }
    }
    return created;
  }

  updateOne(filter, update, options = {}) {
    return this._update(filter, update, { ...options, multi: false });
  }

  updateMany(filter, update, options = {}) {
    return this._update(filter, update, { ...options, multi: true });
  }

  deleteOne(filter = {}) {
    return this._delete(filter, false);
  }

  deleteMany(filter = {}) {
    return this._delete(filter, true);
  }

  findOneAndUpdate(filter, update, options = {}) {
    return this._findOneAndUpdate(filter, update, options);
  }

  findByIdAndUpdate(id, update, options = {}) {
    return this._findOneAndUpdate({ _id: String(id) }, update, options);
  }

  findOneAndDelete(filter) {
    return this._findOneAndDelete(filter);
  }

  findByIdAndDelete(id) {
    return this._findOneAndDelete({ _id: String(id) });
  }

  findByIdAndRemove(id) {
    return this.findByIdAndDelete(id);
  }

  aggregate(pipeline) {
    return runAggregate(this, pipeline);
  }

  async bulkWrite(ops = [], options = {}) {
    let insertedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;
    const writeErrors = [];
    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      try {
        if (op.insertOne) {
          await this._insertOne(op.insertOne.document);
          insertedCount += 1;
        } else if (op.updateOne) {
          const res = await this._update(op.updateOne.filter, op.updateOne.update, {
            upsert: op.updateOne.upsert,
            multi: false,
          });
          modifiedCount += res.modifiedCount || 0;
          upsertedCount += res.upsertedCount || 0;
        } else if (op.deleteOne) {
          await this._delete(op.deleteOne.filter, false);
        } else if (op.deleteMany) {
          await this._delete(op.deleteMany.filter, true);
        }
      } catch (err) {
        if (options.ordered === false) {
          writeErrors.push({ index: i, errmsg: err.message });
          continue;
        }
        throw err;
      }
    }
    const result = { insertedCount, modifiedCount, upsertedCount };
    if (writeErrors.length) {
      const error = new Error("bulkWrite error");
      error.writeErrors = writeErrors;
      throw error;
    }
    return result;
  }

  async _saveDocument(doc) {
    const payload = {};
    for (const key of Object.keys(doc)) {
      if (key.startsWith("$")) continue;
      payload[key] = doc[key];
    }
    if (doc.$isNew) {
      const created = await this._insertOne(payload);
      Object.assign(doc, created);
      doc.$isNew = false;
      return doc;
    }
    await this._update({ _id: String(doc._id) }, payload, { multi: false, replace: true });
    doc.$isNew = false;
    return doc;
  }

  async _insertOne(raw) {
    const schema = this.schema;
    let data = { ...raw };
    if (data._id == null) data._id = new ObjectId();
    data = applyDefaults(data, schema, {
      timestamps: !!schema.options.timestamps,
      isInsert: true,
    });
    for (const name of Object.keys(data)) {
      if (schema.stringPaths.has(name) && typeof data[name] === "string") {
        data[name] = applyStringTransforms(name, data[name], schema);
      }
    }

    const columns = ["_id"];
    const values = [String(data._id)];
    const placeholders = ["$1"];
    let i = 2;
    const fieldNames = [
      ...Object.keys(schema.definition),
      ...(schema.options.timestamps ? ["createdAt", "updatedAt"] : []),
    ];
    for (const name of fieldNames) {
      if (data[name] === undefined) continue;
      columns.push(name);
      const prepared = prepareValue(schema, name, data[name]);
      values.push(prepared);
      if (isJsonbField(schema, name) && prepared != null) {
        placeholders.push(`$${i}::jsonb`);
      } else {
        placeholders.push(`$${i}`);
      }
      i += 1;
    }

    const sql = `INSERT INTO ${qident(this.tableName)} (${columns.map(qident).join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *`;
    try {
      const result = await query(sql, values);
      return rowToDoc(this, result.rows[0]);
    } catch (err) {
      throw mapPgError(err);
    }
  }

  async _update(filter, update, options = {}) {
    const params = [];
    const where = filterToSql(filter, this.schema, params);
    const existing = await query(
      `SELECT * FROM ${qident(this.tableName)} WHERE ${where}${options.multi ? "" : " LIMIT 1"}`,
      params
    );

    if (!existing.rows.length) {
      if (options.upsert) {
        const merged = {};
        applyUpdate(merged, update);
        if (update.$setOnInsert) Object.assign(merged, update.$setOnInsert);
        Object.assign(merged, flattenNonOps(filter));
        if (options.setDefaultsOnInsert !== false) {
          /* defaults applied in _insertOne */
        }
        const created = await this._insertOne(merged);
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 1,
          upsertedId: created._id,
          _upsertedDoc: created,
        };
      }
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    let modifiedCount = 0;
    for (const row of existing.rows) {
      const current = hydrateRow(row, this.schema);
      if (options.replace) {
        for (const key of Object.keys(this.schema.definition)) {
          if (update[key] !== undefined) current[key] = update[key];
        }
        if (this.schema.options.timestamps) current.updatedAt = new Date();
        Object.keys(update).forEach((k) => {
          if (!k.startsWith("$") && k !== "_id") current[k] = update[k];
        });
      } else {
        applyUpdate(current, update);
        if (this.schema.options.timestamps) current.updatedAt = new Date();
      }
      const sets = [];
      const values = [];
      let i = 1;
      const fieldNames = [
        ...Object.keys(this.schema.definition),
        ...(this.schema.options.timestamps ? ["createdAt", "updatedAt"] : []),
      ];
      for (const name of fieldNames) {
        if (current[name] === undefined) continue;
        const prepared = prepareValue(this.schema, name, current[name]);
        if (isJsonbField(this.schema, name) && prepared != null) {
          sets.push(`${qident(name)} = $${i}::jsonb`);
        } else {
          sets.push(`${qident(name)} = $${i}`);
        }
        values.push(prepared);
        i += 1;
      }
      values.push(String(current._id));
      await query(
        `UPDATE ${qident(this.tableName)} SET ${sets.join(", ")} WHERE "_id" = $${i}`,
        values
      );
      modifiedCount += 1;
    }

    return {
      acknowledged: true,
      matchedCount: existing.rows.length,
      modifiedCount,
      upsertedCount: 0,
    };
  }

  async _delete(filter, multi = true) {
    const params = [];
    const where = filterToSql(filter, this.schema, params);
    const sql = `DELETE FROM ${qident(this.tableName)} WHERE ${where}${
      multi ? "" : " AND ctid IN (SELECT ctid FROM " + qident(this.tableName) + " WHERE " + where + " LIMIT 1)"
    }`;
    // For deleteOne use a simpler subquery to avoid duplicate params issues
    if (!multi) {
      const result = await query(
        `DELETE FROM ${qident(this.tableName)} WHERE "_id" IN (
           SELECT "_id" FROM ${qident(this.tableName)} WHERE ${where} LIMIT 1
         )`,
        params
      );
      return { acknowledged: true, deletedCount: result.rowCount || 0 };
    }
    const result = await query(
      `DELETE FROM ${qident(this.tableName)} WHERE ${where}`,
      params
    );
    return { acknowledged: true, deletedCount: result.rowCount || 0 };
  }

  async _findOneAndUpdate(filter, update, options = {}) {
    const beforeParams = [];
    const where = filterToSql(filter, this.schema, beforeParams);
    const before = await query(
      `SELECT * FROM ${qident(this.tableName)} WHERE ${where} LIMIT 1`,
      beforeParams
    );
    const oldDoc = before.rows[0] ? rowToDoc(this, before.rows[0]) : null;
    const result = await this._update(filter, update, { ...options, multi: false });
    if (!oldDoc && result._upsertedDoc) {
      return options.new === false ? null : result._upsertedDoc;
    }
    if (!oldDoc) return null;
    if (options.new) {
      return this.findOne({ _id: String(oldDoc._id) });
    }
    return oldDoc;
  }

  async _findOneAndDelete(filter) {
    const doc = await this.findOne(filter);
    if (!doc) return null;
    await this._delete({ _id: String(doc._id) }, false);
    return doc;
  }

  async _populateDocs(docs, populates) {
    const list = (docs || []).filter(Boolean);
    if (!list.length) return;
    for (const spec of populates) {
      const path = spec.path || spec;
      const select = spec.select;
      if (!path) continue;
      const ref = this.schema.transforms[path]?.ref;
      if (!ref || !models[ref]) continue;
      const Related = models[ref];
      const ids = [
        ...new Set(
          list
            .map((d) => d[path])
            .filter((v) => v != null)
            .map((v) => String(v))
        ),
      ];
      if (!ids.length) continue;
      let q = Related.find({ _id: { $in: ids } });
      if (select) q = q.select(select);
      if (list[0] && !(list[0] instanceof Document)) q = q.lean();
      const related = await q;
      const map = new Map(related.map((r) => [String(r._id), r]));
      list.forEach((doc) => {
        if (doc[path] != null) doc[path] = map.get(String(doc[path])) || doc[path];
      });
    }
  }
}

function flattenNonOps(filter) {
  const out = {};
  if (!filter || typeof filter !== "object") return out;
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && !(v instanceof ObjectId) && !(v instanceof Date) && !Array.isArray(v)) {
      continue;
    }
    out[k] = normalizeValue(v);
  }
  return out;
}

function isUniqueError(err) {
  return err && (err.code === "23505" || err.code === 11000);
}

function mapPgError(err) {
  if (err && err.code === "23505") {
    const mapped = new Error(err.message);
    mapped.code = 11000;
    mapped.name = "MongoServerError";
    return mapped;
  }
  return err;
}

function createModel(name, schema) {
  const instance = new Model(name, schema);
  const ctor = function DocumentCtor(data) {
    return new Document(ctor, data, { isNew: true });
  };
  Object.getOwnPropertyNames(Model.prototype).forEach((key) => {
    if (key === "constructor") return;
    const fn = Model.prototype[key];
    if (typeof fn === "function") ctor[key] = fn.bind(instance);
  });
  ctor.modelName = name;
  ctor.schema = schema;
  ctor.tableName = instance.tableName;
  ctor.collection = instance.collection;
  instance.self = ctor;
  models[name] = ctor;
  return ctor;
}

module.exports = {
  Query,
  Model,
  createModel,
  models,
  rowToDoc,
};
