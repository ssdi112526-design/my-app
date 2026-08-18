const { query } = require("./pool");
const { qident } = require("./filterToSql");
const { pgTypeFor, isFieldDescriptor, schemaDefault } = require("./schema");
const { models } = require("./model");

function columnDefault(name, spec, pgType) {
  const def = schemaDefault(spec);
  if (def === undefined) return "";
  if (typeof def === "function") {
    if (pgType === "JSONB") {
      try {
        const val = def();
        if (Array.isArray(val)) return ` DEFAULT '[]'::jsonb`;
        if (val && typeof val === "object") return ` DEFAULT '{}'::jsonb`;
      } catch (_err) {
        return "";
      }
    }
    return "";
  }
  if (def === null) return " DEFAULT NULL";
  if (pgType === "BOOLEAN") return ` DEFAULT ${def ? "TRUE" : "FALSE"}`;
  if (pgType === "JSONB") {
    if (Array.isArray(def)) return ` DEFAULT '[]'::jsonb`;
    if (typeof def === "object") return ` DEFAULT '{}'::jsonb`;
  }
  if (typeof def === "number") return ` DEFAULT ${def}`;
  if (typeof def === "string") return ` DEFAULT ${escapeLiteral(def)}`;
  if (typeof def === "boolean") return ` DEFAULT ${def ? "TRUE" : "FALSE"}`;
  return "";
}

function escapeLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function columnSql(name, spec) {
  const pgType = isFieldDescriptor(spec) ? pgTypeFor(name, spec) : "JSONB";
  const required = spec && typeof spec === "object" && spec.required && spec.default === undefined;
  const notNull = required ? " NOT NULL" : "";
  const def = columnDefault(name, spec, pgType);
  return `${qident(name)} ${pgType}${notNull}${def}`;
}

function createTableSQL(model) {
  const schema = model.schema;
  const cols = [`${qident("_id")} VARCHAR(24) PRIMARY KEY`];
  for (const [name, spec] of Object.entries(schema.definition)) {
    cols.push(columnSql(name, spec));
  }
  if (schema.options.timestamps) {
    cols.push(`${qident("createdAt")} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
    cols.push(`${qident("updatedAt")} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
  }
  return `CREATE TABLE IF NOT EXISTS ${qident(model.tableName)} (\n  ${cols.join(",\n  ")}\n);`;
}

function indexSQL(model) {
  const statements = [];
  const schema = model.schema;
  const table = model.tableName;

  for (const [name, spec] of Object.entries(schema.definition)) {
    if (spec && typeof spec === "object" && spec.unique) {
      const idx = `${table}_${name}_unique`.replace(/[^a-zA-Z0-9_]/g, "_");
      if (spec.sparse) {
        statements.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${qident(idx)} ON ${qident(table)} (${qident(name)}) WHERE ${qident(name)} IS NOT NULL;`
        );
      } else {
        statements.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${qident(idx)} ON ${qident(table)} (${qident(name)});`
        );
      }
    } else if (spec && typeof spec === "object" && spec.index) {
      const idx = `${table}_${name}_idx`.replace(/[^a-zA-Z0-9_]/g, "_");
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${qident(idx)} ON ${qident(table)} (${qident(name)});`
      );
    }
  }

  (schema._indexes || []).forEach((item, i) => {
    const fields = Object.keys(item.fields || {});
    if (!fields.length) return;
    const idx = `${table}_compound_${i}`.replace(/[^a-zA-Z0-9_]/g, "_");
    const cols = fields.map(qident).join(", ");
    if (item.options?.unique) {
      statements.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${qident(idx)} ON ${qident(table)} (${cols});`
      );
    } else {
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${qident(idx)} ON ${qident(table)} (${cols});`
      );
    }
  });

  return statements;
}

function generateInitSQL() {
  const lines = [
    "-- Reproducible PostgreSQL schema generated from existing Mongoose models.",
    "-- Runtime also applies the same DDL on startup (CREATE IF NOT EXISTS).",
    "",
  ];
  const list = Object.values(models);
  for (const model of list) {
    lines.push(createTableSQL(model));
    lines.push("");
    indexSQL(model).forEach((s) => lines.push(s));
    lines.push("");
  }
  return lines.join("\n");
}

async function ensureSchema() {
  const list = Object.values(models);
  if (!list.length) {
    throw new Error("No models registered before PostgreSQL schema sync.");
  }
  for (const model of list) {
    await query(createTableSQL(model));
    const statements = indexSQL(model);
    for (const sql of statements) {
      await query(sql);
    }
    await addMissingColumns(model);
  }
}

async function addMissingColumns(model) {
  const result = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [model.tableName]
  );
  const existing = new Set(result.rows.map((r) => r.column_name));
  const needed = ["_id", ...Object.keys(model.schema.definition)];
  if (model.schema.options.timestamps) needed.push("createdAt", "updatedAt");
  for (const name of needed) {
    if (existing.has(name)) continue;
    const spec = model.schema.definition[name];
    let col;
    if (name === "createdAt" || name === "updatedAt") {
      col = `${qident(name)} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`;
    } else {
      col = columnSql(name, spec);
    }
    await query(`ALTER TABLE ${qident(model.tableName)} ADD COLUMN IF NOT EXISTS ${col}`);
  }
}

module.exports = {
  ensureSchema,
  generateInitSQL,
  createTableSQL,
  indexSQL,
};
