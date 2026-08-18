const { filterToSql, qident } = require("./filterToSql");
const { query } = require("./pool");
const { hydrateRow } = require("./document");

function compileExpr(expr) {
  if (expr === 1 || expr === "1") return "1";
  if (typeof expr === "number") return String(expr);
  if (typeof expr === "string") {
    if (expr === "$$ROOT") return "TRUE";
    if (expr.startsWith("$")) return qident(expr.slice(1));
    return `'${expr.replace(/'/g, "''")}'`;
  }
  if (!expr || typeof expr !== "object") return "NULL";

  if (Object.prototype.hasOwnProperty.call(expr, "$sum")) {
    if (expr.$sum === 1) return "COUNT(*)";
    return `COALESCE(SUM(${compileExpr(expr.$sum)}), 0)`;
  }
  if (Object.prototype.hasOwnProperty.call(expr, "$first")) {
    if (expr.$first === "$$ROOT") return "TRUE";
    return `(ARRAY_AGG(${compileExpr(expr.$first)}))[1]`;
  }
  if (Object.prototype.hasOwnProperty.call(expr, "$addToSet")) {
    return `ARRAY_REMOVE(ARRAY_AGG(DISTINCT ${compileExpr(expr.$addToSet)}), NULL)`;
  }
  if (Object.prototype.hasOwnProperty.call(expr, "$ifNull")) {
    const [a, b] = expr.$ifNull;
    return `COALESCE(${compileExpr(a)}, ${compileExpr(b)})`;
  }
  if (Object.prototype.hasOwnProperty.call(expr, "$gt")) {
    const [a, b] = expr.$gt;
    return `(${compileExpr(a)} > ${compileExpr(b)})`;
  }
  if (Object.prototype.hasOwnProperty.call(expr, "$cond")) {
    const [c, t, f] = Array.isArray(expr.$cond)
      ? expr.$cond
      : [expr.$cond.if, expr.$cond.then, expr.$cond.else];
    return `CASE WHEN ${compileExpr(c)} THEN ${compileExpr(t)} ELSE ${compileExpr(f)} END`;
  }
  return "NULL";
}

function groupIdSql(idExpr) {
  if (idExpr == null) return null;
  if (typeof idExpr === "string" && idExpr.startsWith("$")) return qident(idExpr.slice(1));
  return null;
}

function coerceAggNumbers(row) {
  const out = { ...row };
  for (const key of ["count", "total", "totalAmount"]) {
    if (out[key] != null) out[key] = Number(out[key]);
  }
  return out;
}

function applyProject(row, project) {
  const includeId = project._id !== 0 && project._id !== false;
  const out = {};
  if (includeId && row._id !== undefined) out._id = row._id;
  for (const [key, spec] of Object.entries(project)) {
    if (key === "_id") continue;
    if (spec === 0 || spec === false) continue;
    if (spec === 1 || spec === true) out[key] = row[key];
    else if (typeof spec === "string" && spec.startsWith("$")) {
      out[key] = row[spec.slice(1)];
    }
  }
  return out;
}

async function runAggregate(model, pipeline = []) {
  const params = [];
  let where = "TRUE";
  let sort = "";
  let group = null;
  let project = null;
  let skip = 0;
  let limit = null;

  for (const stage of pipeline) {
    if (stage.$match) {
      const extra = filterToSql(stage.$match, model.schema, params);
      where = where === "TRUE" ? extra : `${where} AND ${extra}`;
    } else if (stage.$sort) {
      const parts = Object.entries(stage.$sort).map(
        ([field, dir]) => `${qident(field)} ${Number(dir) < 0 ? "DESC" : "ASC"}`
      );
      sort = parts.length ? ` ORDER BY ${parts.join(", ")}` : "";
    } else if (stage.$group) {
      group = stage.$group;
    } else if (stage.$project) {
      project = stage.$project;
    } else if (stage.$skip) {
      skip = Number(stage.$skip) || 0;
    } else if (stage.$limit) {
      limit = Number(stage.$limit);
    }
  }

  const from = qident(model.tableName);

  if (group) {
    const wantsRoot = Object.values(group).some(
      (v) => v && typeof v === "object" && v.$first === "$$ROOT"
    );
    const idCol = groupIdSql(group._id);
    const idField = typeof group._id === "string" ? group._id.replace(/^\$/, "") : "_id";

    if (wantsRoot && idCol) {
      const extraOrder = sort ? sort.replace(/^ ORDER BY /i, "") : `${qident("createdAt")} DESC`;
      const sql = `
        SELECT DISTINCT ON (${idCol}) *
        FROM ${from}
        WHERE ${where}
        ORDER BY ${idCol} ASC, ${extraOrder}
      `;
      const result = await query(sql, params);
      return result.rows.map((row) => {
        const hydrated = hydrateRow(row, model.schema);
        return { _id: hydrated[idField], latest: hydrated };
      });
    }

    const selectParts = [];
    const groupBy = [];
    if (idCol) {
      selectParts.push(`${idCol} AS "_id"`);
      groupBy.push(idCol);
    } else {
      selectParts.push(`NULL AS "_id"`);
    }

    for (const [alias, expr] of Object.entries(group)) {
      if (alias === "_id") continue;
      selectParts.push(`${compileExpr(expr)} AS ${qident(alias)}`);
    }

    let sql = `SELECT ${selectParts.join(", ")} FROM ${from} WHERE ${where}`;
    if (groupBy.length) sql += ` GROUP BY ${groupBy.join(", ")}`;
    sql += sort;
    if (limit != null) sql += ` LIMIT ${Number(limit)}`;
    if (skip) sql += ` OFFSET ${Number(skip)}`;

    const result = await query(sql, params);
    let rows = result.rows.map(coerceAggNumbers);
    if (project) rows = rows.map((row) => applyProject(row, project));
    return rows;
  }

  let sql = `SELECT * FROM ${from} WHERE ${where}${sort}`;
  if (limit != null) sql += ` LIMIT ${Number(limit)}`;
  if (skip) sql += ` OFFSET ${Number(skip)}`;
  const result = await query(sql, params);
  let rows = result.rows.map((row) => hydrateRow(row, model.schema));
  if (project) rows = rows.map((row) => applyProject(row, project));
  return rows;
}

module.exports = { runAggregate, compileExpr };
