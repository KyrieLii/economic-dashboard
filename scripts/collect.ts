import { collect } from "../server/collect";
import { allMetrics } from "../server/registry";
import { db, initDb } from "../server/db";

const args = process.argv.slice(2);
const ids = args.filter((arg) => !arg.startsWith("--"));
await initDb();
const known = new Set((await allMetrics(db())).map((m) => m.id));
if (ids.some((id) => !known.has(id)))
  throw new Error("未知指标ID；请查 shared/catalog.ts");
try {
  const result = await collect(
    ids.length ? ids : undefined,
    args.includes("--backfill"),
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.failures || result.busy) process.exitCode = 1;
} finally {
  db().close();
}
