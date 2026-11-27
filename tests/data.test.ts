import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, initDb } from "../server/db";
import {
  saveObservations,
  acquireLease,
  releaseLease,
  recordFailure,
} from "../server/store";
import { parseFred, parseYahoo } from "../server/providers";
import { change, dateInZone, isDate } from "../shared/model";
import { latestScheduledSlot } from "../server/scheduler";
import { app } from "../server/app";

const path = mkdtempSync(join(tmpdir(), "economic-test-"));
process.env.DATABASE_URL = `file:${path}/test.db`;
delete process.env.TURSO_DATABASE_URL;
delete process.env.VERCEL;
await initDb();
after(() => {
  db().close();
  rmSync(path, { recursive: true, force: true });
});

test("daily history is idempotent and revisions are atomic, including volume-only changes", async () => {
  const points = [
    { date: "2026-11-20", value: 100, volume: 200 },
    { date: "2026-11-23", value: 102, volume: 210 },
  ];
  await saveObservations(
    db(),
    "sp500",
    "fixture",
    points,
    "2026-11-24T00:00:00Z",
  );
  await saveObservations(
    db(),
    "sp500",
    "fixture",
    points,
    "2026-11-25T00:00:00Z",
  );
  assert.equal(
    (await db().execute("SELECT COUNT(*) AS n FROM observations")).rows[0].n,
    2,
  );
  assert.equal(
    (await db().execute("SELECT COUNT(*) AS n FROM revisions")).rows[0].n,
    0,
  );
  await saveObservations(
    db(),
    "sp500",
    "fixture",
    [{ date: "2026-11-23", value: 103, volume: 210 }],
    "2026-11-26T00:00:00Z",
  );
  const revision = (await db().execute("SELECT * FROM revisions")).rows[0];
  assert.equal(revision.old_value, 102);
  assert.equal(revision.new_value, 103);
  await saveObservations(db(), "sp500", "fixture", [
    { date: "2026-11-23", value: 103, volume: 220 },
  ]);
  assert.equal(
    (await db().execute("SELECT COUNT(*) AS n FROM revisions")).rows[0].n,
    2,
  );
  const current = (
    await db().execute("SELECT * FROM observations WHERE date='2026-11-23'")
  ).rows[0];
  assert.equal(current.fetched_at, "2026-11-24T00:00:00Z");
  assert.equal(current.volume, 220);
});
test("invalid values cannot partially persist a series", async () => {
  await assert.rejects(
    saveObservations(db(), "invalid", "fixture", [
      { date: "2026-11-24", value: 1, volume: null },
      { date: "2026-02-30", value: 2, volume: null },
    ]),
  );
  assert.equal(
    (
      await db().execute(
        "SELECT COUNT(*) AS n FROM observations WHERE metric_id='invalid'",
      )
    ).rows[0].n,
    0,
  );
});
test("parallel series writes serialize and failure retains history", async () => {
  await Promise.all(
    ["one", "two", "three"].map((id) =>
      saveObservations(db(), id, "fixture", [
        { date: "2026-11-24", value: 0, volume: null },
      ]),
    ),
  );
  await recordFailure(db(), "one", "timeout");
  assert.equal(
    (await db().execute("SELECT value FROM observations WHERE metric_id='one'"))
      .rows[0].value,
    0,
  );
  assert.ok(
    (
      await db().execute(
        "SELECT last_success FROM metric_status WHERE metric_id='one'",
      )
    ).rows[0].last_success,
  );
});
test("lease excludes simultaneous collectors, expires, and only owner can release", async () => {
  const owner = await acquireLease(db(), 100, 200);
  assert.ok(owner);
  assert.equal(await acquireLease(db(), 101, 200), null);
  await releaseLease(db(), "wrong");
  assert.equal(await acquireLease(db(), 102, 200), null);
  const next = await acquireLease(db(), 301, 200);
  assert.ok(next);
  await releaseLease(db(), owner!);
  assert.equal(await acquireLease(db(), 302, 200), null);
  await releaseLease(db(), next!);
});
test("FRED skips missing observations without creating zero or holiday values", () => {
  assert.deepEqual(
    parseFred(
      "observation_date,DGS10\n2026-11-23,4.20\n2026-11-24,.\n2026-11-25,\n2026-11-26,0",
    ),
    [
      { date: "2026-11-23", value: 4.2, volume: null },
      { date: "2026-11-26", value: 0, volume: null },
    ],
  );
  assert.throws(() => parseFred("<html>error</html>"));
});
test("Yahoo excludes unfinished sessions, null closes and zero placeholder volumes", () => {
  const payload = {
    chart: {
      result: [
        {
          meta: {
            exchangeTimezoneName: "Asia/Shanghai",
            currentTradingPeriod: {
              regular: { end: Date.parse("2026-11-27T07:00:00Z") / 1000 },
            },
          },
          timestamp: [
            Date.parse("2026-11-26T01:30:00Z") / 1000,
            Date.parse("2026-11-27T01:30:00Z") / 1000,
          ],
          indicators: { quote: [{ close: [100, 102], volume: [0, 900] }] },
        },
      ],
    },
  };
  assert.deepEqual(parseYahoo(payload, new Date("2026-11-27T06:00:00Z")), [
    { date: "2026-11-26", value: 100, volume: null },
  ]);
  assert.equal(parseYahoo(payload, new Date("2026-11-27T07:31:00Z")).length, 2);
});
test("rate basis points, zero denominator and timezone dates are correct", () => {
  assert.ok(Math.abs(change(4.1, 4, true)! - 10) < 1e-8);
  assert.equal(change(10, 0), null);
  assert.equal(change(110, 100), 10);
  assert.equal(
    dateInZone(new Date("2026-11-26T23:00:00Z"), "Asia/Shanghai"),
    "2026-11-27",
  );
  assert.equal(isDate("2026-02-30"), false);
});
test("Docker schedule is independent of host timezone", () => {
  assert.equal(
    latestScheduledSlot(new Date("2026-11-27T10:29:00Z")).toISOString(),
    "2026-11-27T00:00:00.000Z",
  );
  assert.equal(
    latestScheduledSlot(new Date("2026-11-27T10:30:00Z")).toISOString(),
    "2026-11-27T10:30:00.000Z",
  );
});
test("API rejects invalid ranges, unknown IDs and unauthorized collection", async () => {
  assert.equal((await app.request("/api/history/not-real")).status, 404);
  assert.equal(
    (await app.request("/api/history/sp500?from=2026-12-01&to=2026-01-01"))
      .status,
    400,
  );
  assert.equal(
    (await app.request("/api/history/sp500?from=2026-02-30")).status,
    400,
  );
  process.env.CRON_SECRET = "test-secret-not-a-real-credential";
  assert.equal((await app.request("/api/cron")).status, 401);
  assert.equal(
    (
      await app.request("/api/cron", {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status,
    401,
  );
  const csv = await app.request("/api/history/sp500?format=csv");
  assert.ok(csv.headers.get("content-type")?.includes("text/csv"));
  assert.match(await csv.text(), /2026-11-23,103,220,fixture/);
});
test("optional read protection applies to dashboard and history", async () => {
  process.env.DASHBOARD_PASSWORD = "test-only";
  assert.equal((await app.request("/api/dashboard")).status, 401);
  assert.equal((await app.request("/api/history/sp500")).status, 401);
  assert.equal((await app.request("/api/health")).status, 200);
  const result = await app.request("/api/dashboard", {
    headers: {
      Authorization: `Basic ${Buffer.from("viewer:test-only").toString("base64")}`,
    },
  });
  assert.equal(result.status, 200);
  delete process.env.DASHBOARD_PASSWORD;
});
