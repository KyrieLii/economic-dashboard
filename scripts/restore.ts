import { readFile } from "node:fs/promises";
import { db, initDb } from "../server/db";

const file = process.argv[2];
if (!file)
  throw new Error(
    "用法：pnpm restore backups/<文件>.json；仅允许恢复到空数据库。",
  );
const backup = JSON.parse(await readFile(file, "utf8"));
if (backup.schema !== 1 || !backup.tables) throw new Error("不支持的备份格式");
// Older backups predate user-added stocks.
backup.tables.custom_metrics ??= [];
const columns: Record<string, string[]> = {
  custom_metrics: ["id", "definition", "created_at"],
  observations: [
    "metric_id",
    "date",
    "value",
    "volume",
    "source",
    "fetched_at",
    "revised_at",
  ],
  revisions: [
    "id",
    "metric_id",
    "date",
    "old_value",
    "new_value",
    "old_volume",
    "new_volume",
    "changed_at",
    "source",
  ],
  metric_status: ["metric_id", "last_attempt", "last_success", "error"],
  runs: ["id", "started_at", "finished_at", "successes", "failures", "status"],
};
for (const name of Object.keys(columns))
  if (!Array.isArray(backup.tables[name])) throw new Error(`备份缺少 ${name}`);
await initDb();
const client = db();
const tx = await client.transaction("write");
try {
  for (const name of Object.keys(columns)) {
    const count = await tx.execute(`SELECT COUNT(*) AS n FROM ${name}`);
    if (Number(count.rows[0].n) !== 0)
      throw new Error("目标数据库已有数据，已取消恢复；请使用空数据库。");
  }
  for (const [name, fields] of Object.entries(columns)) {
    const rows = backup.tables[name] as Record<
      string,
      string | number | null
    >[];
    for (let i = 0; i < rows.length; i += 100)
      await tx.batch(
        rows.slice(i, i + 100).map((row) => ({
          sql: `INSERT INTO ${name} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
          args: fields.map((field) => row[field] ?? null),
        })),
      );
  }
  await tx.commit();
  console.log(
    `恢复完成：${backup.tables.observations.length} 条观测，${backup.tables.revisions.length} 条修订。`,
  );
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  tx.close();
  client.close();
}
