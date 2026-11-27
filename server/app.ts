import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "node:crypto";
import { allMetrics } from "./registry.js";
import { searchStocks, registerStock, StockError } from "./stocks.js";
import { isDate } from "../shared/model.js";
import { db, databaseUrl, initDb } from "./db.js";
import { readDashboard, toPoint } from "./store.js";
import { collect } from "./collect.js";

export const app = new Hono();
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  if (
    process.env.DASHBOARD_PASSWORD &&
    !["/api/cron", "/api/health"].includes(c.req.path)
  ) {
    return basicAuth({
      username: "viewer",
      password: process.env.DASHBOARD_PASSWORD,
    })(c, next);
  }
  await next();
});
app.get("/api/health", (c) => c.json({ ok: true }));
app.get("/api/dashboard", async (c) => {
  await initDb();
  return c.json({
    ...(await readDashboard(db())),
    generatedAt: new Date().toISOString(),
    storage: databaseUrl().startsWith("file:") ? "local" : "remote",
  });
});
app.get("/api/history/:id", async (c) => {
  await initDb();
  if (!(await allMetrics(db())).some((m) => m.id === c.req.param("id")))
    return c.json({ error: "未知指标" }, 404);
  const from = c.req.query("from") || "1900-01-01";
  const to = c.req.query("to") || "2100-01-01";
  if (!isDate(from) || !isDate(to) || from > to)
    return c.json({ error: "请提供有效的起止日期" }, 400);
  await initDb();
  const id = c.req.param("id");
  const result = await db().batch(
    [
      {
        sql: "SELECT * FROM observations WHERE metric_id=? AND date>=? AND date<=? ORDER BY date LIMIT 20000",
        args: [id, from, to],
      },
      {
        sql: "SELECT date,old_value,new_value,changed_at FROM revisions WHERE metric_id=? AND date>=? AND date<=? ORDER BY changed_at DESC LIMIT 100",
        args: [id, from, to],
      },
    ],
    "read",
  );
  const points = result[0].rows.map(toPoint);
  if (c.req.query("format") === "csv") {
    c.header(
      "Content-Disposition",
      `attachment; filename="${id}-${from}-${to}.csv"`,
    );
    c.header("Content-Type", "text/csv; charset=utf-8");
    return c.body(
      "\uFEFFdate,value,volume,source,first_fetched_at,revised_at\r\n" +
        result[0].rows
          .map((r) =>
            [
              r.date,
              r.value,
              r.volume ?? "",
              r.source,
              r.fetched_at,
              r.revised_at ?? "",
            ].join(","),
          )
          .join("\r\n"),
    );
  }
  return c.json({
    points,
    revisions: result[1].rows.map((r) => ({
      date: String(r.date),
      oldValue: Number(r.old_value),
      newValue: Number(r.new_value),
      changedAt: String(r.changed_at),
    })),
  });
});
app.get("/api/stocks/search", async (c) => {
  const query = (c.req.query("q") || "").trim();
  if (!query || query.length > 80)
    return c.json({ error: "请输入1至80个字符的名称或代码" }, 400);
  try {
    const market = c.req.query("market") || "all";
    if (!["all", "a", "hk", "us", "crypto"].includes(market))
      return c.json({ error: "未知搜索市场" }, 400);
    return c.json(
      await searchStocks(
        query,
        market as import("../shared/model.js").SearchMarket,
      ),
    );
  } catch {
    return c.json({ error: "资产搜索暂时不可用，请稍后重试" }, 502);
  }
});
app.post("/api/stocks", async (c) => {
  const origin = c.req.header("Origin");
  const requestUrl = new URL(c.req.url);
  let trustedOrigin = !origin || origin === requestUrl.origin;
  if (origin && !trustedOrigin) {
    try {
      const source = new URL(origin);
      const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
      // Vite forwards local requests to a different loopback port.
      trustedOrigin =
        loopback.has(source.hostname) && loopback.has(requestUrl.hostname);
    } catch {
      trustedOrigin = false;
    }
  }
  if (!trustedOrigin || c.req.header("Sec-Fetch-Site") === "cross-site")
    return c.json({ error: "不允许跨站修改" }, 403);
  if (
    !c.req.header("Content-Type")?.toLowerCase().startsWith("application/json")
  )
    return c.json({ error: "需要JSON请求" }, 415);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.symbol !== "string")
    return c.json({ error: "请提供资产代码" }, 400);
  await initDb();
  try {
    return c.json({
      metric: await registerStock(db(), body.symbol.trim().toUpperCase()),
    });
  } catch (error) {
    if (error instanceof StockError)
      return c.json({ error: error.message }, error.status);
    throw error;
  }
});
app.get("/api/cron", async (c) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return c.json({ error: "请先配置 CRON_SECRET" }, 503);
  const actual = c.req.header("Authorization") || "";
  const token = `Bearer ${expected}`;
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(token))
  )
    return c.json({ error: "Unauthorized" }, 401);
  const result = await collect();
  return c.json(result, result.busy ? 409 : 200);
});
app.notFound((c) => c.json({ error: "接口不存在" }, 404));
app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error("[api]", error.constructor.name);
  const configuration = error.message.startsWith("Vercel 需要配置");
  return c.json(
    {
      error: configuration
        ? error.message
        : "数据服务暂时不可用，请检查服务日志与数据库连接。",
    },
    503,
  );
});
