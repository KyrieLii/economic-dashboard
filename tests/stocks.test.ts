import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockAgent, setGlobalDispatcher } from "undici";
import { db, initDb } from "../server/db";
import {
  parseStockSearch,
  parseChinaSearch,
  searchStocks,
  stockQuery,
  stockMetric,
  registerStock,
} from "../server/stocks";
import { allMetrics } from "../server/registry";
import { app } from "../server/app";
import { collect } from "../server/collect";
import { defaultLayout, normalizeLayout, placeCard } from "../src/board-layout";

const directory = mkdtempSync(join(tmpdir(), "economic-stock-test-"));
process.env.DATABASE_URL = `file:${directory}/test.db`;
delete process.env.TURSO_DATABASE_URL;
delete process.env.VERCEL;
const agent = new MockAgent();
agent.disableNetConnect();
setGlobalDispatcher(agent);
const pool = agent.get("https://query1.finance.yahoo.com");
await initDb();
after(async () => {
  db().close();
  await agent.close();
  rmSync(directory, { recursive: true, force: true });
});
const payload = {
  chart: {
    result: [
      {
        meta: {
          symbol: "AAPL",
          longName: "Apple test fixture",
          exchangeName: "NMS",
          instrumentType: "EQUITY",
          currency: "USD",
          exchangeTimezoneName: "America/New_York",
        },
        timestamp: [1764000000, 1764086400],
        indicators: { quote: [{ close: [100, 102], volume: [1000, 1200] }] },
      },
    ],
  },
};

test("stock search corrects the requested Apple typo and excludes ETFs, unsupported listings, duplicate and invalid symbols", () => {
  assert.equal(stockQuery("APEL"), "AAPL");
  assert.equal(stockQuery("苹果"), "AAPL");
  assert.equal(stockQuery("MSFT"), "MSFT");
  const quote = {
    symbol: "AAPL",
    quoteType: "EQUITY",
    exchange: "NMS",
    shortname: "Apple",
  };
  assert.deepEqual(
    parseStockSearch({
      quotes: [
        quote,
        quote,
        { ...quote, symbol: "AAPU", quoteType: "ETF" },
        { ...quote, symbol: "AAPL.TO", exchange: "TOR" },
        { ...quote, symbol: "../secret" },
      ],
    }),
    [{ symbol: "AAPL", name: "Apple", exchange: "NMS", market: "us" }],
  );
  assert.throws(() =>
    stockMetric(
      {
        chart: {
          result: [
            { meta: { ...payload.chart.result[0].meta, currency: "CAD" } },
          ],
        },
      },
      "AAPL",
    ),
  );
});
test("registered stocks keep history across dashboard reads, join scheduled collection, and survive saved-layout normalization", async () => {
  pool
    .intercept({ path: "/v8/finance/chart/AAPL?range=5y&interval=1d" })
    .reply(200, payload);
  const metric = await registerStock(db(), "AAPL");
  assert.equal(metric.id, "stock-aapl");
  assert.equal((await registerStock(db(), "AAPL")).id, metric.id);
  assert.ok((await allMetrics(db())).some((m) => m.id === metric.id));
  const dashboard = await (await app.request("/api/dashboard")).json();
  assert.equal(dashboard.metrics.find((m: any) => m.id === metric.id).count, 2);
  const history = await app.request(`/api/history/${metric.id}`);
  assert.equal(history.status, 200);
  assert.equal((await history.json()).points.length, 2);
  pool
    .intercept({ path: "/v8/finance/chart/AAPL?range=1mo&interval=1d" })
    .reply(200, payload);
  const result = await collect([metric.id]);
  assert.equal(result.successes, 1);
  assert.equal(result.failures, 0);
  const layout = placeCard(defaultLayout(), metric.id, "us", 0);
  assert.equal(
    normalizeLayout(JSON.parse(JSON.stringify(layout))).us[0],
    metric.id,
  );
  agent.assertNoPendingInterceptors();
});
test("stock registration validates requests and respects read authentication", async () => {
  assert.equal((await app.request("/api/stocks/search?q=")).status, 400);
  assert.equal(
    (
      await app.request("/api/stocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({ symbol: "AAPL" }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await app.request("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "AAPL",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await app.request("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "../bad" }),
      })
    ).status,
    400,
  );
  process.env.DASHBOARD_PASSWORD = "fixture-password";
  assert.equal(
    (
      await app.request("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "AAPL" }),
      })
    ).status,
    401,
  );
  delete process.env.DASHBOARD_PASSWORD;
});

test("Chinese security search distinguishes shares from same-code indices and supports Shanghai, Shenzhen, Beijing and Hong Kong", () => {
  const rows = parseChinaSearch({
    QuotationCodeTable: {
      Data: [
        {
          Code: "600519",
          Name: "贵州茅台",
          Classify: "AStock",
          MktNum: "1",
          SecurityTypeName: "沪A",
        },
        {
          Code: "000001",
          Name: "平安银行",
          Classify: "AStock",
          MktNum: "0",
          SecurityTypeName: "深A",
        },
        {
          Code: "000001",
          Name: "上证指数",
          Classify: "Index",
          MktNum: "1",
          SecurityTypeName: "指数",
        },
        {
          Code: "920000",
          Name: "安徽凤凰",
          Classify: "NEEQ",
          MktNum: "0",
          SecurityTypeName: "京A",
        },
        {
          Code: "00700",
          Name: "腾讯控股",
          Classify: "HK",
          SecurityType: "19",
          SecurityTypeName: "港股",
        },
        {
          Code: "13005",
          Name: "腾讯购A",
          Classify: "HK",
          SecurityType: "6",
          SecurityTypeName: "港股",
        },
        {
          Code: "02800",
          Name: "基金",
          Classify: "HK",
          SecurityType: "13",
          SecurityTypeName: "ETF",
        },
      ],
    },
  });
  assert.deepEqual(
    rows.map((r) => r.symbol),
    ["600519.SS", "000001.SZ", "920000.BJ", "0700.HK"],
  );
  assert.equal(stockQuery("000001"), "000001.SZ");
  assert.equal(stockQuery("00700"), "0700.HK");
  assert.equal(stockQuery("狗狗币"), "DOGE-USD");
  assert.equal(stockQuery("SOL"), "SOL");
  assert.equal(stockQuery("Solana"), "Solana");
});

test("multi-market registration validates currency and saves the correct group with crypto volumes suppressed", async () => {
  for (const [symbol, exchange, currency, type, zone, group, unit] of [
    ["600519.SS", "SHH", "CNY", "EQUITY", "Asia/Shanghai", "A股", "人民币"],
    ["0700.HK", "HKG", "HKD", "EQUITY", "Asia/Hong_Kong", "港股", "港元"],
    ["SOL-USD", "CCC", "USD", "CRYPTOCURRENCY", "UTC", "加密货币", "美元"],
  ]) {
    const data = structuredClone(payload);
    Object.assign(data.chart.result[0].meta, {
      symbol,
      exchangeName: exchange,
      currency,
      instrumentType: type,
      exchangeTimezoneName: zone,
    });
    pool
      .intercept({ path: `/v8/finance/chart/${symbol}?range=5y&interval=1d` })
      .reply(200, data);
    // Name enrichment is best-effort; disabled network intentionally exercises fallback.
    const metric = await registerStock(db(), symbol);
    assert.equal(metric.group, group);
    assert.equal(metric.unit, unit);
    const history = await (
      await app.request(`/api/history/${metric.id}`)
    ).json();
    assert.equal(history.points.length, 2);
    if (group === "加密货币")
      assert.ok(history.points.every((p: any) => p.volume === null));
    assert.equal(
      normalizeLayout(placeCard(defaultLayout(), metric.id, "a", 0)).a[0],
      metric.id,
    );
  }
  assert.equal((await registerStock(db(), "BTC-USD")).id, "btc");
  const invalid = structuredClone(payload);
  Object.assign(invalid.chart.result[0].meta, {
    symbol: "600519.SS",
    exchangeName: "SHH",
    currency: "USD",
  });
  assert.throws(() => stockMetric(invalid, "600519.SS"));
  agent.assertNoPendingInterceptors();
});

test("partial search failures preserve usable results with a visible warning", async () => {
  pool
    .intercept({
      path: "/v1/finance/search?q=Solana&quotesCount=20&newsCount=0",
    })
    .reply(200, {
      quotes: [
        {
          symbol: "SOL-USD",
          quoteType: "CRYPTOCURRENCY",
          exchange: "CCC",
          shortname: "Solana",
        },
      ],
    });
  const result = await searchStocks("Solana");
  assert.equal(result.results[0].market, "crypto");
  assert.ok(result.warnings.length > 0);
  assert.equal(
    (await app.request("/api/stocks/search?q=BTC&market=invalid")).status,
    400,
  );
  agent.assertNoPendingInterceptors();
});
