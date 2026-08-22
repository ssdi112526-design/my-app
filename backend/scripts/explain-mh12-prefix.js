#!/usr/bin/env node
/** Isolated EXPLAIN: contains %MH12% vs prefix MH12% */
const { Client, PERF_DATABASE_URL, COMPANY_LARGE, explain } = require("./perf-local-common");

(async () => {
  const client = new Client({ connectionString: PERF_DATABASE_URL });
  await client.connect();
  const cid = COMPANY_LARGE;
  const list = `SELECT * FROM upload_search_rows WHERE "companyId" = $1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC, "sourceRowIndex" ASC LIMIT 50`;
  const contains = await explain(client, list, [cid, "%MH12%"]);
  const prefix = await explain(client, list, [cid, "MH12%"]);
  const countContains = await client.query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\'`,
    [cid, "%MH12%"]
  );
  const countPrefix = await client.query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\'`,
    [cid, "MH12%"]
  );
  console.log(
    JSON.stringify(
      {
        env: "local-isolated-6M",
        contains: {
          matched: countContains.rows[0].n,
          execMs: contains.execMs,
          planMs: contains.planMs,
          index: contains.index,
          gin: contains.gin,
          bitmap: contains.bitmap,
          seq: contains.seq,
          heapBlocks: contains.heapBlocks,
        },
        prefix: {
          matched: countPrefix.rows[0].n,
          execMs: prefix.execMs,
          planMs: prefix.planMs,
          index: prefix.index,
          gin: prefix.gin,
          bitmap: prefix.bitmap,
          seq: prefix.seq,
          heapBlocks: prefix.heapBlocks,
        },
      },
      null,
      2
    )
  );
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
