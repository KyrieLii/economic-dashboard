import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, initDb } from "../server/db";
import { app } from "../server/app";
import { metricById } from "../shared/catalog";
import { parseEastmoneyQuote, parseYahooQuote, parseTencentQuote, readQuotes } from "../server/quotes";
import { displayedChange, displayedQuote, type Quote } from "../shared/quotes";
import { readDashboard, saveObservations } from "../server/store";

const directory = mkdtempSync(join(tmpdir(), "economic-quotes-"));
process.env.DATABASE_URL = `file:${directory}/test.db`;
delete process.env.TURSO_DATABASE_URL;
delete process.env.VERCEL;
delete process.env.DASHBOARD_PASSWORD;
await initDb();
after(() => { db().close(); rmSync(directory, { recursive: true, force: true }); });
const csi500 = metricById.get("csi500")!;
const sse50 = metricById.get("sse50")!;
const now = new Date("2026-11-27T02:00:00Z"); // 10:00 during A-share trading.
const eastmoney = (code: string, price: number) => ({ data: {
  f57: code, f59: 2, f43: price, f60: 600000, f86: now.getTime() / 1000,
} });
const sample = (value: number, time = now.getTime()): Quote => ({
  value, previousClose: 6000, asOf: new Date(time).toISOString(),
  fetchedAt: new Date(time).toISOString(), timeZone: "Asia/Shanghai", source: "东方财富",
});

test("A-share quotes use source precision, previous close and exchange timestamp", () => {
  const quote = parseEastmoneyQuote(eastmoney("000905", 631363), csi500, now);
  assert.equal(quote.value, 6313.63);
  assert.equal(quote.previousClose, 6000);
  assert.equal(quote.asOf, now.toISOString());
  assert.equal(parseEastmoneyQuote(eastmoney("000016", 283468), sse50, now).value, 2834.68);
  for (const bad of [
    { f57: "000016" }, { f43: "-" }, { f43: null }, { f43: 0 },
    { f59: null }, { f59: 99 }, { f86: 0 }, { f86: now.getTime() },
  ]) assert.throws(() => parseEastmoneyQuote({ data: { ...eastmoney("000905", 631363).data, ...bad } }, csi500, now));
});

test("Yahoo and Tencent quotes validate identities, source dates and previous close", () => {
  const metric = metricById.get("btc")!;
  const meta = { symbol: "BTC-USD", regularMarketPrice: 90000, previousClose: 89000,
    regularMarketTime: now.getTime() / 1000, exchangeTimezoneName: "UTC" };
  const payload = (m: unknown) => ({ chart: { result: [{ meta: m }] } });
  assert.equal(parseYahooQuote(payload(meta), metric, now).previousClose, 89000);
  assert.equal(parseYahooQuote(payload({ ...meta, previousClose: undefined }), metric, now).previousClose, null);
  for (const bad of [{ symbol: "ETH-USD" }, { regularMarketPrice: null },
    { regularMarketTime: undefined }, { exchangeTimezoneName: "bad-zone" }])
    assert.throws(() => parseYahooQuote(payload({ ...meta, ...bad }), metric, now));
  const fields = Array(31).fill("0");
  fields[2] = "HSTECH"; fields[3] = "4000.123"; fields[4] = "3900.123"; fields[30] = "2026/11/27 10:00:00";
  const text = `v_hkHSTECH="${fields.join("~")}";\n`;
  assert.equal(parseTencentQuote(text, metricById.get("hstech")!, now).asOf, now.toISOString());
  assert.throws(() => parseTencentQuote(text.replace("hkHSTECH", "hkHSI"), metricById.get("hstech")!, now));
});

test("intraday updates change cards relative to yesterday's close without changing daily history", async () => {
  await saveObservations(db(), csi500.id, "东方财富", [
    { date: "2026-11-25", value: 5900, volume: null },
    { date: "2026-11-26", value: 6000, volume: null },
  ]);
  let clock = now.getTime();
  let calls = 0;
  const fetcher = async () => { calls++; return sample(calls === 1 ? 6060 : 6120, clock); };
  const first = await readQuotes(db(), [csi500], fetcher, () => clock);
  const metric = (await readDashboard(db())).metrics.find(m => m.id === csi500.id)!;
  assert.equal(displayedChange({ ...metric, quoteState: first.quotes[csi500.id] }), 1);
  await readQuotes(db(), [csi500], fetcher, () => clock + 59000);
  assert.equal(calls, 1);
  clock += 61000;
  const second = await readQuotes(db(), [csi500], fetcher, () => clock);
  assert.equal(displayedChange({ ...metric, quoteState: second.quotes[csi500.id] }), 2);
  assert.equal(calls, 2);
  assert.equal((await readDashboard(db())).metrics.find(m => m.id === csi500.id)!.latest!.value, 6000);
  assert.equal((await db().execute("SELECT COUNT(*) AS n FROM observations")).rows[0].n, 2);
  assert.equal((await db().execute("SELECT COUNT(*) AS n FROM revisions")).rows[0].n, 0);
  const stale = { ...second.quotes[csi500.id], quote: sample(5800, Date.parse("2026-11-25T07:00:00Z")) };
  assert.equal(displayedQuote({ ...metric, quoteState: stale }), null);
});

test("failed or out-of-order quotes preserve the last value and back off", async () => {
  let clock = now.getTime() + 180000;
  let calls = 0;
  const fail = async (): Promise<Quote> => { calls++; throw new Error("secret URL must never reach API"); };
  const failed = await readQuotes(db(), [csi500], fail, () => clock);
  assert.equal(failed.quotes[csi500.id].quote!.value, 6120);
  assert.equal(failed.quotes[csi500.id].error, "报价更新失败，保留上次数据");
  await readQuotes(db(), [csi500], fail, () => clock);
  assert.equal(calls, 1);
  clock += 61000;
  const older = await readQuotes(db(), [csi500], async () => sample(1), () => clock);
  assert.equal(older.quotes[csi500.id].quote!.value, 6120);
  assert.ok(older.quotes[csi500.id].error);
});

test("concurrent readers share a refresh; expired lease owners cannot overwrite a newer quote", async () => {
  let clock = now.getTime();
  let resolve!: (quote: Quote) => void;
  let started!: () => void;
  const fetching = new Promise<void>(r => { started = r; });
  const pending = readQuotes(db(), [sse50], () => {
    started(); return new Promise<Quote>(r => { resolve = r; });
  }, () => clock);
  await fetching;
  const cached = await readQuotes(db(), [sse50], async () => { throw new Error("must not fetch twice"); }, () => clock);
  assert.equal(cached.quotes[sse50.id].quote, null);
  clock += 241000;
  await readQuotes(db(), [sse50], async () => sample(2850, clock), () => clock);
  resolve(sample(2800));
  await pending;
  const final = await readQuotes(db(), [sse50], async () => { throw new Error("cached"); }, () => clock);
  assert.equal(final.quotes[sse50.id].quote!.value, 2850);
});

test("quote API bounds queries, keeps read authentication and excludes daily-only series", async () => {
  assert.equal((await app.request('/api/quotes')).status, 400);
  assert.equal((await app.request('/api/quotes?ids=unknown')).status, 400);
  assert.equal((await app.request('/api/quotes?ids='+Array.from({length:51},(_,i)=>i).join(','))).status, 400);
  const daily = await app.request('/api/quotes?ids=us10y,a-turnover');
  assert.deepEqual(await daily.json(), { quotes: {} });
  process.env.DASHBOARD_PASSWORD = 'test-password';
  try { assert.equal((await app.request('/api/quotes?ids=csi500')).status, 401); }
  finally { delete process.env.DASHBOARD_PASSWORD; }
});
