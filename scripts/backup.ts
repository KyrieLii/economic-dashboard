import { mkdir, writeFile } from "node:fs/promises";
import { db, initDb } from "../server/db";

await initDb();
const client = db();
const tx = await client.transaction("read");
try {
  const tables = [
    "observations",
    "revisions",
    "metric_status",
    "runs",
    "custom_metrics",
  ];
  const results = await tx.batch(tables.map((name) => `SELECT * FROM ${name}`));
  await tx.commit();
  const now = new Date().toISOString();
  const path = `backups/economic-${now.replaceAll(":", "-")}.json`;
  await mkdir("backups", { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      schema: 1,
      createdAt: now,
      tables: Object.fromEntries(
        tables.map((table, i) => [table, results[i].rows]),
      ),
    }),
  );
  console.log(`备份已保存：${path}`);
} finally {
  tx.close();
  client.close();
}
