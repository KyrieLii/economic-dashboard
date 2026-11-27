import { randomUUID } from "node:crypto";
import { metrics } from "../shared/catalog";
import { db, initDb } from "./db";
import { fetchMetric } from "./providers";
import {
  acquireLease,
  recordFailure,
  releaseLease,
  saveObservations,
} from "./store";

export async function collect(ids?: string[], backfill = false) {
  await initDb();
  const client = db();
  const owner = await acquireLease(client);
  if (!owner) return { busy: true, successes: 0, failures: 0 };
  const id = randomUUID();
  let successes = 0,
    failures = 0;
  await client.execute({
    sql: "INSERT INTO runs(id,started_at,status) VALUES (?,?,'running')",
    args: [id, new Date().toISOString()],
  });
  try {
    const counts = await client.execute(
      "SELECT metric_id,COUNT(*) AS n FROM observations GROUP BY metric_id",
    );
    const existing = new Map(
      counts.rows.map((row) => [String(row.metric_id), Number(row.n)]),
    );
    const queue = metrics.filter((metric) => !ids || ids.includes(metric.id));
    // Four network requests at a time; each has a bounded timeout.
    const worker = async () => {
      while (queue.length) {
        const metric = queue.shift()!;
        try {
          const points = await fetchMetric(
            metric,
            backfill || !existing.get(metric.id),
          );
          await saveObservations(client, metric.id, metric.source, points);
          successes++;
        } catch (error) {
          failures++;
          const message =
            error instanceof Error ? error.message : "数据采集失败";
          // Do not expose URLs/tokens in operational errors.
          await recordFailure(
            client,
            metric.id,
            /timeout|aborted/i.test(message)
              ? "数据源响应超时，等待下次重试"
              : /HTTP \d+/.exec(message)?.[0] || "数据源不可用或返回格式异常",
          );
          console.error(
            `[collect] ${metric.id}: ${/HTTP \d+/.exec(message)?.[0] || error?.constructor?.name || "error"}`,
          );
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    await client.execute({
      sql: "UPDATE runs SET finished_at=?,successes=?,failures=?,status=? WHERE id=?",
      args: [
        new Date().toISOString(),
        successes,
        failures,
        failures ? "partial" : "success",
        id,
      ],
    });
    return { busy: false, id, successes, failures };
  } catch (error) {
    await client.execute({
      sql: "UPDATE runs SET finished_at=?,status='failed' WHERE id=?",
      args: [new Date().toISOString(), id],
    });
    throw error;
  } finally {
    await releaseLease(client, owner);
  }
}
