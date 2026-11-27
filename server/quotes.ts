import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import type { Metric } from "../shared/model.js";
import { supportsQuote, type Quote, type QuotesData } from "../shared/quotes.js";
import { get } from "./providers.js";

export const QUOTE_TTL = 60000;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
function timestamp(value: unknown, now: Date) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
      value * 1000 > now.getTime() + 60000) throw new Error("Invalid quote timestamp");
  return new Date(value * 1000).toISOString();
}
export function parseEastmoneyQuote(payload: any, metric: Metric, now = new Date()): Quote {
  const d = payload?.data;
  if (!d || d.f57 !== metric.symbol.split(".")[1] ||
      !Number.isInteger(d.f59) || d.f59 < 0 || d.f59 > 8 || !positive(d.f43))
    throw new Error("Invalid quote identity or price");
  const scale = 10 ** d.f59;
  return {
    value: d.f43 / scale,
    previousClose: positive(d.f60) ? d.f60 / scale : null,
    asOf: timestamp(d.f86, now), fetchedAt: now.toISOString(),
    timeZone: "Asia/Shanghai", source: "东方财富",
  };
}
export function parseYahooQuote(payload: any, metric: Metric, now = new Date()): Quote {
  const meta = payload?.chart?.result?.[0]?.meta;
  if (payload?.chart?.error || meta?.symbol !== metric.symbol ||
      !positive(meta?.regularMarketPrice) || !meta?.exchangeTimezoneName)
    throw new Error("Invalid quote identity or price");
  // Validate the IANA zone rather than allowing malformed data into the UI.
  new Intl.DateTimeFormat("en", { timeZone: meta.exchangeTimezoneName });
  return {
    value: meta.regularMarketPrice,
    previousClose: positive(meta.previousClose) ? meta.previousClose : null,
    asOf: timestamp(meta.regularMarketTime, now), fetchedAt: now.toISOString(),
    timeZone: meta.exchangeTimezoneName, source: "Yahoo Finance",
  };
}
export function parseTencentQuote(text: string, metric: Metric, now = new Date()): Quote {
  const match = text.match(/^v_([A-Za-z0-9]+)="([^"\n]*)";?\s*$/);
  const fields = match?.[2].split("~");
  if (match?.[1] !== metric.symbol || fields?.[2] !== metric.symbol.slice(2) ||
      !fields || !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(fields[30]))
    throw new Error("Invalid quote identity or timestamp");
  const asOf = new Date(fields[30].replaceAll("/", "-").replace(" ", "T") + "+08:00");
  const value = Number(fields[3]);
  if (!positive(value)) throw new Error("Invalid quote price");
  return {
    value, previousClose: positive(Number(fields[4])) ? Number(fields[4]) : null,
    asOf: timestamp(asOf.getTime() / 1000, now), fetchedAt: now.toISOString(),
    timeZone: "Asia/Hong_Kong", source: "腾讯财经",
  };
}
export async function fetchQuote(metric: Metric): Promise<Quote> {
  if (metric.provider === "eastmoney") {
    const params = new URLSearchParams({ secid: metric.symbol, fields: "f43,f57,f59,f60,f86" });
    return parseEastmoneyQuote(JSON.parse(await get(`https://push2.eastmoney.com/api/qt/stock/get?${params}`)), metric);
  }
  if (metric.provider === "yahoo") {
    return parseYahooQuote(JSON.parse(await get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(metric.symbol)}?range=1d&interval=1m`,
    )), metric);
  }
  if (metric.provider === "tencent")
    return parseTencentQuote(await get(`https://qt.gtimg.cn/q=${encodeURIComponent(metric.symbol)}`), metric);
  throw new Error("Unsupported quote provider");
}

// Shared SQL cache also coalesces refreshes across Vercel instances and browsers.
export async function readQuotes(
  client: Client,
  metrics: Metric[],
  fetcher = fetchQuote,
  clock = Date.now,
): Promise<QuotesData> {
  const eligible = metrics.filter(supportsQuote);
  if (!eligible.length) return { quotes: {} };
  const ids = eligible.map(m => m.id);
  const placeholders = ids.map(() => "?").join(",");
  const read = () => client.execute({
    sql: `SELECT * FROM quote_cache WHERE metric_id IN (${placeholders})`, args: ids,
  });
  const cached = await read();
  const rows = new Map(cached.rows.map(row => [String(row.metric_id), row]));
  const due = eligible.filter(m => Number(rows.get(m.id)?.next_refresh_at || 0) <= clock());
  if (due.length) {
    const owner = randomUUID();
    const now = clock();
    // Four-minute recovery lease covers bounded upstream requests for up to 50 cards.
    await client.batch(due.map(m => ({
      sql: `INSERT INTO quote_cache(metric_id,next_refresh_at,owner) VALUES (?,?,?)
        ON CONFLICT(metric_id) DO UPDATE SET next_refresh_at=excluded.next_refresh_at,owner=excluded.owner
        WHERE quote_cache.next_refresh_at <= ?`,
      args: [m.id, now + 240000, owner, now],
    })), "write");
    const claimed = await client.execute({ sql: "SELECT metric_id FROM quote_cache WHERE owner=?", args: [owner] });
    const queue = due.filter(m => claimed.rows.some(row => row.metric_id === m.id));
    const worker = async () => {
      while (queue.length) {
        const metric = queue.shift()!;
        let quote: Quote | null = null;
        let error: string | null = null;
        try {
          quote = await fetcher(metric);
          const old = rows.get(metric.id)?.payload;
          if (old && quote.asOf < (JSON.parse(String(old)) as Quote).asOf)
            throw new Error("Quote timestamp moved backwards");
        } catch {
          quote = null;
          error = "报价更新失败，保留上次数据";
        }
        const finished = clock();
        await client.execute({
          sql: `UPDATE quote_cache SET payload=COALESCE(?,payload),checked_at=?,error=?,next_refresh_at=?,owner=NULL
            WHERE metric_id=? AND owner=?`,
          args: [quote ? JSON.stringify(quote) : null, new Date(finished).toISOString(),
            error, finished + QUOTE_TTL, metric.id, owner],
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  }
  const result: QuotesData = { quotes: {} };
  for (const row of (await read()).rows) {
    result.quotes[String(row.metric_id)] = {
      quote: row.payload ? JSON.parse(String(row.payload)) : null,
      checkedAt: row.checked_at ? String(row.checked_at) : null,
      error: row.error ? String(row.error) : null,
    };
  }
  return result;
}
