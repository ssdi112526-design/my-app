const { ObjectId } = require("./objectId");

function jsonClone(value) {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v instanceof ObjectId) return String(v);
      if (v instanceof Date) return v.toISOString();
      return v;
    })
  );
}

class SubdocumentArray extends Array {
  id(id) {
    const match = this.find((item) => item && String(item._id) === String(id));
    return match || null;
  }

  push(...items) {
    const mapped = this._autoId === false ? items : items.map((item) => ensureSubId(item));
    return super.push(...mapped);
  }
}

function ensureSubId(item) {
  if (item == null || typeof item !== "object") return item;
  if (!item._id) item._id = new ObjectId();
  return item;
}

function wrapArrays(data, schema) {
  if (!schema || !data) return data;
  for (const name of schema.subdocArrayPaths || []) {
    const value = data[name];
    const autoId = schema.subdocAutoIdPaths && schema.subdocAutoIdPaths.has(name);
    if (Array.isArray(value) && !(value instanceof SubdocumentArray)) {
      const wrapped = SubdocumentArray.from(
        value.map((item) => (item && typeof item === "object" ? { ...item } : item))
      );
      wrapped._autoId = autoId;
      data[name] = wrapped;
    } else if (!Array.isArray(value)) {
      const wrapped = new SubdocumentArray();
      wrapped._autoId = autoId;
      data[name] = wrapped;
    }
  }
  for (const name of schema.arrayPaths || []) {
    if (schema.subdocArrayPaths.has(name)) continue;
    if (!Array.isArray(data[name])) data[name] = Array.isArray(data[name]) ? data[name] : [];
  }
  return data;
}

function coerceValue(name, value, schema) {
  if (value == null) return value;
  if (schema.objectIdPaths.has(name)) {
    if (value === "" ) return null;
    return value instanceof ObjectId ? value : new ObjectId(value);
  }
  if (schema.datePaths.has(name)) return value instanceof Date ? value : new Date(value);
  if (schema.booleanPaths.has(name)) return Boolean(value);
  if (schema.numberPaths.has(name)) {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
}

function hydrateRow(row, schema) {
  if (!row) return null;
  const data = {};
  for (const [key, value] of Object.entries(row)) {
    data[key] = coerceValue(key, value, schema);
  }
  wrapArrays(data, schema);
  return data;
}

function serializeValue(value) {
  if (value instanceof ObjectId) return String(value);
  if (value instanceof Date) return value;
  if (value instanceof SubdocumentArray) return [...value];
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

function applyStringTransforms(name, value, schema) {
  if (typeof value !== "string") return value;
  const t = schema.transforms[name];
  if (!t) return value;
  let next = value;
  if (t.trim) next = next.trim();
  if (t.lowercase) next = next.toLowerCase();
  if (t.uppercase) next = next.toUpperCase();
  return next;
}

function applyDefaults(data, schema, { timestamps, isInsert }) {
  const out = { ...data };
  for (const [name, spec] of Object.entries(schema.definition)) {
    if (out[name] !== undefined) continue;
    const def = spec && typeof spec === "object" ? spec.default : undefined;
    if (def === undefined) continue;
    out[name] = typeof def === "function" ? def() : jsonClone(def);
  }
  if (timestamps && isInsert && out.createdAt === undefined) out.createdAt = new Date();
  if (timestamps) out.updatedAt = new Date();
  return out;
}

function applyUpdate(target, update) {
  if (!update || typeof update !== "object") return target;
  const hasOp = Object.keys(update).some((k) => k.startsWith("$"));
  if (!hasOp) {
    Object.assign(target, update);
    return target;
  }

  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) setPath(target, k, v);
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) setPath(target, k, null);
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      const cur = Number(getPath(target, k) || 0);
      setPath(target, k, cur + Number(v));
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      const arr = Array.isArray(getPath(target, k)) ? getPath(target, k) : [];
      if (v && typeof v === "object" && Array.isArray(v.$each)) arr.push(...v.$each);
      else arr.push(v);
      setPath(target, k, arr);
    }
  }
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      const arr = Array.isArray(getPath(target, k)) ? getPath(target, k) : [];
      const items = v && typeof v === "object" && Array.isArray(v.$each) ? v.$each : [v];
      items.forEach((item) => {
        if (!arr.some((x) => JSON.stringify(x) === JSON.stringify(item))) arr.push(item);
      });
      setPath(target, k, arr);
    }
  }
  if (update.$pull) {
    for (const [k, cond] of Object.entries(update.$pull)) {
      const arr = Array.isArray(getPath(target, k)) ? getPath(target, k) : [];
      const next = arr.filter((item) => !matchesPull(item, cond));
      setPath(target, k, next);
    }
  }
  if (update.$setOnInsert) {
    // handled by caller on insert only
  }
  return target;
}

function matchesPull(item, cond) {
  if (cond == null || typeof cond !== "object") return item === cond;
  return Object.entries(cond).every(([k, v]) => String(item?.[k]) === String(v));
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[parts[0]] = value;
}

class Document {
  constructor(model, data = {}, { isNew = true } = {}) {
    this.$model = model;
    this.$isNew = isNew;
    const hydrated = hydrateRow({ ...data }, model.schema) || {};
    Object.assign(this, hydrated);
    if (!this._id) this._id = new ObjectId();
  }

  get id() {
    return this._id ? String(this._id) : undefined;
  }

  async save() {
    return this.$model._saveDocument(this);
  }

  toObject() {
    return documentToObject(this);
  }

  toJSON() {
    const obj = documentToObject(this);
    obj.id = this.id;
    return obj;
  }

  populate(path, select) {
    return this.$model._populateDocs([this], [{ path, select }]).then(() => this);
  }
}

function documentToObject(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("$")) continue;
    out[key] = serializeValue(value);
  }
  return out;
}

function toJsonbParam(value) {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof ObjectId) return String(v);
    return v;
  });
}

module.exports = {
  Document,
  SubdocumentArray,
  hydrateRow,
  wrapArrays,
  applyDefaults,
  applyStringTransforms,
  applyUpdate,
  serializeValue,
  toJsonbParam,
  jsonClone,
};
