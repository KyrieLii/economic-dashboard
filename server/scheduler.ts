import { db, initDb } from "./db";
import { collect } from "./collect";

export function latestScheduledSlot(now: Date): Date {
  // 08:00 and 18:30 in UTC+8; UTC avoids host timezone and DST surprises.
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const evening = midnight + 10.5 * 3600000;
  return new Date(now.getTime() >= evening ? evening : midnight);
}
export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== "true" || process.env.VERCEL)
    return () => {};
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await initDb();
      const result = await db().execute(
        "SELECT started_at FROM runs WHERE status IN ('success','partial','running') ORDER BY started_at DESC LIMIT 1",
      );
      const last = result.rows[0]?.started_at as string | undefined;
      if (!last || Date.parse(last) < latestScheduledSlot(new Date()).getTime())
        console.log("[scheduler]", await collect());
    } catch (error) {
      console.error(
        "[scheduler]",
        error instanceof Error ? error.constructor.name : "failed",
      );
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60000);
  return () => clearInterval(timer);
}
