import type { Client } from "@libsql/client";
import { metrics } from "../shared/catalog";
import type { Metric } from "../shared/model";

export async function registeredMetrics(client: Client): Promise<Metric[]> {
  const result = await client.execute(
    "SELECT definition FROM custom_metrics ORDER BY created_at, id",
  );
  return result.rows.map((row) => JSON.parse(String(row.definition)) as Metric);
}
export async function allMetrics(client: Client): Promise<Metric[]> {
  return [...metrics, ...(await registeredMetrics(client))];
}
