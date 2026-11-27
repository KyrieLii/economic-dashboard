import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { metrics } from "../shared/catalog";
import {
  isDate,
  type Observation,
  type Point,
  type Run,
  type Summary,
} from "../shared/model";

const writers = new WeakMap<Client, Promise<unknown>>();
export function saveObservations(
  client: Client,
  metricId: string,
  source: string,
  points: Observation[],
  now = new Date().toISOString(),
) {
  const operation = (writers.get(client) || Promise.resolve())
    .catch(() => undefined)
    .then(() => saveSeries(client, metricId, source, points, now));
  writers.set(client, operation);
  return operation;
}

async function saveSeries(
  client: Client,
  metricId: string,
  source: string,
  points: Observation[],
  now = new Date().toISOString(),
) {
  // A transaction makes each series atomic: revisions and current values change together.
  const clean = new Map<string, Observation>();
  for (const point of points) {
    if (
      !isDate(point.date) ||
      !Number.isFinite(point.value) ||
      (point.volume !== null &&
        (!Number.isFinite(point.volume) || point.volume < 0))
    )
      throw new Error("数据校验失败：日期、数值或成交量无效");
    clean.set(point.date, point);
  }
  if (clean.size === 0) throw new Error("来源未返回有效的已完成日线");
  const tx = await client.transaction("write");
  try {
    const existing = await tx.execute({
      sql: "SELECT date, value, volume, source FROM observations WHERE metric_id = ?",
      args: [metricId],
    });
    const prior = new Map(existing.rows.map((row) => [String(row.date), row]));
    const statements = [];
    for (const point of clean.values()) {
      const old = prior.get(point.date);
      if (
        old &&
        old.source === source &&
        Number(old.value) === point.value &&
        (old.volume == null ? null : Number(old.volume)) === point.volume
      )
        continue;
      if (old)
        statements.push({
          sql: "INSERT INTO revisions (metric_id,date,old_value,new_value,old_volume,new_volume,changed_at,source) VALUES (?,?,?,?,?,?,?,?)",
          args: [
            metricId,
            point.date,
            old.value,
            point.value,
            old.volume,
            point.volume,
            now,
            `${old.source} → ${source}`,
          ],
        });
      statements.push({
        sql: `INSERT INTO observations (metric_id,date,value,volume,source,fetched_at,revised_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(metric_id,date) DO UPDATE SET value=excluded.value,volume=excluded.volume,source=excluded.source,revised_at=excluded.revised_at`,
        args: [
          metricId,
          point.date,
          point.value,
          point.volume,
          source,
          now,
          old ? now : null,
        ],
      });
    }
    // Bound request size for the remote database, while retaining the transaction.
    for (let index = 0; index < statements.length; index += 100)
      await tx.batch(statements.slice(index, index + 100));
    await tx.execute({
      sql: `INSERT INTO metric_status (metric_id,last_attempt,last_success,error) VALUES (?,?,?,NULL)
      ON CONFLICT(metric_id) DO UPDATE SET last_attempt=excluded.last_attempt,last_success=excluded.last_success,error=NULL`,
      args: [metricId, now, now],
    });
    await tx.commit();
    return clean.size;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
export async function recordFailure(client: Client, id: string, error: string) {
  await client.execute({
    sql: `INSERT INTO metric_status (metric_id,last_attempt,error) VALUES (?,?,?)
    ON CONFLICT(metric_id) DO UPDATE SET last_attempt=excluded.last_attempt,error=excluded.error`,
    args: [id, new Date().toISOString(), error],
  });
}
export function toPoint(row: Record<string, unknown>): Point {
  return {
    date: String(row.date),
    value: Number(row.value),
    volume: row.volume == null ? null : Number(row.volume),
    source: String(row.source),
    fetchedAt: String(row.fetched_at),
    revisedAt: row.revised_at ? String(row.revised_at) : null,
  };
}
export async function readDashboard(client: Client) {
  const results = await client.batch(
    [
      `SELECT * FROM (SELECT *, ROW_NUMBER() OVER(PARTITION BY metric_id ORDER BY date DESC) AS rn FROM observations) WHERE rn <= 31 ORDER BY date`,
      "SELECT metric_id, COUNT(*) AS count, MIN(date) AS first_date FROM observations GROUP BY metric_id",
      "SELECT * FROM metric_status",
      "SELECT * FROM runs ORDER BY started_at DESC LIMIT 5",
    ],
    "read",
  );
  const statuses = new Map(
    results[2].rows.map((row) => [String(row.metric_id), row]),
  );
  const counts = new Map(
    results[1].rows.map((row) => [String(row.metric_id), row]),
  );
  const summaries: Summary[] = metrics.map((metric) => {
    const points = results[0].rows
      .filter((row) => row.metric_id === metric.id)
      .map(toPoint);
    const status = statuses.get(metric.id);
    return {
      ...metric,
      latest: points.at(-1) || null,
      previous: points.at(-2) || null,
      spark: points,
      count: Number(counts.get(metric.id)?.count || 0),
      firstDate: (counts.get(metric.id)?.first_date as string) || null,
      lastAttempt: (status?.last_attempt as string) || null,
      lastSuccess: (status?.last_success as string) || null,
      error: (status?.error as string) || null,
    };
  });
  const runs: Run[] = results[3].rows.map((row) => ({
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at as string | null,
    successes: Number(row.successes),
    failures: Number(row.failures),
    status: String(row.status),
  }));
  return { metrics: summaries, runs };
}
export async function acquireLease(
  client: Client,
  now = Date.now(),
  ttl = 240000,
) {
  const owner = randomUUID();
  const result = await client.execute({
    sql: `INSERT INTO leases (name,owner,expires_at) VALUES ('collect',?,?)
    ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE leases.expires_at < ?`,
    args: [owner, now + ttl, now],
  });
  return result.rowsAffected ? owner : null;
}
export async function releaseLease(client: Client, owner: string) {
  await client.execute({
    sql: "DELETE FROM leases WHERE name='collect' AND owner=?",
    args: [owner],
  });
}
