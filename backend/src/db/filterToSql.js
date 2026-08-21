const { ObjectId } = require("./objectId");

function qident(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function jsRegexToPosix(source) {
  return String(source)
    .replace(/\\d/g, "[0-9]")
    .replace(/\\D/g, "[^0-9]")
    .replace(/\\w/g, "[A-Za-z0-9_]")
    .replace(/\\W/g, "[^A-Za-z0-9_]")
    .replace(/\\s/g, "[[:space:]]")
    .replace(/\\S/g, "[^[:space:]]");
}

function isPlainObject(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof ObjectId) &&
    !(value instanceof RegExp)
  );
}

function isOperatorObject(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

function normalizeValue(value) {
  if (value instanceof ObjectId) return String(value);
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value.toString("hex");
  return value;
}

function columnSql(field, schema) {
  if (field.includes(".")) {
    const [root, ...rest] = field.split(".");
    const path = rest.join(",");
    return `(${qident(root)} #>> '{${path}}')`;
  }
  return qident(field);
}

function emptyJson(value) {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length === 0;
  return Object.keys(value).length === 0;
}

function compilePredicate(field, value, schema, params) {
  const col = columnSql(field, schema);

  if (value instanceof RegExp) {
    params.push(jsRegexToPosix(value.source));
    const op = value.ignoreCase ? "~*" : "~";
    return `${col} ${op} $${params.length}`;
  }

  if (value === null) {
    return `${col} IS NULL`;
  }

  if (isOperatorObject(value)) {
    const parts = [];
    for (const [op, raw] of Object.entries(value)) {
      const v = normalizeValue(raw);
      if (op === "$eq") {
        if (v === null) parts.push(`${col} IS NULL`);
        else {
          params.push(v);
          parts.push(`${col} = $${params.length}`);
        }
      } else if (op === "$ne") {
        if (v === null) parts.push(`${col} IS NOT NULL`);
        else if (emptyJson(v)) {
          parts.push(`(${col} IS NULL OR ${col} <> '{}'::jsonb)`);
        } else {
          params.push(v);
          parts.push(`(${col} IS DISTINCT FROM $${params.length})`);
        }
      } else if (op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") {
        const sqlOp = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op];
        const isJsonbText = col.includes("#>>");
        if (v instanceof Date && isJsonbText) {
          params.push(v.toISOString());
          parts.push(
            `(NULLIF(${col}, ''))::timestamptz ${sqlOp} $${params.length}::timestamptz`
          );
        } else {
          params.push(v);
          parts.push(`${col} ${sqlOp} $${params.length}`);
        }
      } else if (op === "$in") {
        const list = Array.isArray(raw) ? raw.map(normalizeValue) : [];
        if (!list.length) {
          parts.push("FALSE");
        } else {
          const hasNull = list.some((x) => x === null);
          const rest = list.filter((x) => x !== null);
          const bits = [];
          if (rest.length) {
            const start = params.length + 1;
            rest.forEach((item) => params.push(item));
            const placeholders = rest.map((_, i) => `$${start + i}`).join(", ");
            bits.push(`${col} IN (${placeholders})`);
          }
          if (hasNull) bits.push(`${col} IS NULL`);
          parts.push(bits.length ? `(${bits.join(" OR ")})` : "FALSE");
        }
      } else if (op === "$nin") {
        const list = Array.isArray(raw) ? raw.map(normalizeValue) : [];
        if (!list.length) {
          parts.push("TRUE");
        } else {
          const hasNull = list.some((x) => x === null);
          const rest = list.filter((x) => x !== null);
          const bits = [];
          if (rest.length) {
            const start = params.length + 1;
            rest.forEach((item) => params.push(item));
            const placeholders = rest.map((_, i) => `$${start + i}`).join(", ");
            bits.push(`${col} NOT IN (${placeholders})`);
          }
          if (hasNull) bits.push(`${col} IS NOT NULL`);
          else bits.push("TRUE");
          parts.push(`(${bits.join(" AND ")})`);
        }
      } else if (op === "$regex") {
        const source = raw instanceof RegExp ? raw.source : String(raw);
        const opts = value.$options || (raw instanceof RegExp && raw.ignoreCase ? "i" : "");
        params.push(jsRegexToPosix(source));
        const sqlOp = String(opts).includes("i") ? "~*" : "~";
        parts.push(`${col} ${sqlOp} $${params.length}`);
      } else if (op === "$options") {
        continue;
      } else if (op === "$exists") {
        parts.push(v ? `${col} IS NOT NULL` : `${col} IS NULL`);
      } else if (op === "$not") {
        const inner = compilePredicate(field, raw, schema, params);
        parts.push(`NOT (${inner})`);
      } else {
        params.push(v);
        parts.push(`${col} = $${params.length}`);
      }
    }
    return parts.length ? parts.join(" AND ") : "TRUE";
  }

  const v = normalizeValue(value);
  params.push(v);
  return `${col} = $${params.length}`;
}

function filterToSql(filter, schema, params) {
  if (!filter || typeof filter !== "object") return "TRUE";
  const keys = Object.keys(filter);
  if (!keys.length) return "TRUE";

  const parts = [];
  for (const key of keys) {
    const value = filter[key];
    if (key === "$or" || key === "$and" || key === "$nor") {
      const arr = Array.isArray(value) ? value : [];
      if (!arr.length) {
        parts.push(key === "$and" ? "TRUE" : "FALSE");
        continue;
      }
      const compiled = arr.map((item) => `(${filterToSql(item, schema, params)})`);
      if (key === "$and") parts.push(`(${compiled.join(" AND ")})`);
      else if (key === "$or") parts.push(`(${compiled.join(" OR ")})`);
      else parts.push(`NOT (${compiled.join(" OR ")})`);
      continue;
    }
    parts.push(compilePredicate(key, value, schema, params));
  }
  return parts.length ? parts.join(" AND ") : "TRUE";
}

function sortExpr(field) {
  return String(field).includes(".") ? columnSql(field) : qident(field);
}

function sortToSql(sort) {
  if (!sort) return "";
  const parts = [];
  if (typeof sort === "string") {
    sort.split(/\s+/).filter(Boolean).forEach((token) => {
      if (token.startsWith("-")) parts.push(`${sortExpr(token.slice(1))} DESC`);
      else parts.push(`${sortExpr(token)} ASC`);
    });
  } else {
    for (const [field, dir] of Object.entries(sort)) {
      parts.push(`${sortExpr(field)} ${Number(dir) < 0 ? "DESC" : "ASC"}`);
    }
  }
  return parts.length ? ` ORDER BY ${parts.join(", ")}` : "";
}

module.exports = {
  qident,
  filterToSql,
  sortToSql,
  normalizeValue,
  jsRegexToPosix,
};
