import type { Client } from "@libsql/client";
import { fetch as httpFetch, ProxyAgent } from "undici";
import { activityMetrics } from "../shared/catalog.js";
import { dateInZone, isDate, type Observation } from "../shared/model.js";
import { recordFailure, saveObservations } from "./store.js";

type Market = "sh" | "sz" | "bj";
const proxy = process.env.DATA_PROXY_URL
  ? new ProxyAgent(process.env.DATA_PROXY_URL)
  : undefined;
const refs: Record<Market, string> = {
  sh: "https://www.sse.com.cn/market/stockdata/overview/day/",
  sz: "https://www.szse.cn/market/overview/index.html",
  bj: "https://www.bse.cn/static/statisticdata.html",
};
function numeric(raw: unknown): number {
  if (typeof raw !== "string" && typeof raw !== "number")
    throw new Error("统计字段缺失");
  const text = String(raw).replaceAll(",", "").trim();
  if (!text || !/^\d+(\.\d+)?$/.test(text)) throw new Error("统计字段无效");
  const n = Number(text);
  if (!Number.isFinite(n)) throw new Error("统计字段无效");
  return n;
}
export function parseShanghai(payload: any, date: string): Observation | null {
  if (!Array.isArray(payload.result)) throw new Error("上交所格式异常");
  if (!payload.result.length) return null;
  const rows = ["01", "03"].map((code) => {
    const matched = payload.result.filter((r: any) => r.PRODUCT_CODE === code);
    if (
      matched.length !== 1 ||
      matched[0].TRADE_DATE !== date.replaceAll("-", "")
    )
      throw new Error("上交所日期或市场不完整");
    return matched[0];
  });
  return {
    date,
    value:
      Math.round(rows.reduce((n, r) => n + numeric(r.TRADE_AMT), 0) * 100) /
      100,
    volume: Math.round(
      rows.reduce((n, r) => n + numeric(r.TRADE_VOL), 0) * 1e8,
    ),
  };
}
export function parseShenzhen(payload: any, date: string): Observation | null {
  if (!Array.isArray(payload)) throw new Error("深交所格式异常");
  const table = payload.find((t) => t.metadata?.tabkey === "tab1");
  if (!table || !Array.isArray(table.data) || table.error)
    throw new Error("深交所格式异常");
  if (!table.data.length) return null;
  if (
    table.metadata.subname !== date ||
    !/亿元/.test(table.metadata.cols?.cjje || "")
  )
    throw new Error("深交所日期或单位变化");
  const rows = ["主板A股", "创业板A股"].map((label) => {
    const matched = table.data.filter(
      (r: any) => String(r.lbmc).replaceAll("&nbsp;", "").trim() === label,
    );
    if (matched.length !== 1) throw new Error("深交所A股分类不完整");
    return matched[0];
  });
  return {
    date,
    value:
      Math.round(rows.reduce((n, r) => n + numeric(r.cjje), 0) * 100) / 100,
    volume: null,
  };
}
export function parseBeijing(payload: any, date: string): Observation | null {
  if (!Array.isArray(payload)) throw new Error("北交所格式异常");
  if (!payload.length) return null;
  const rows = payload.filter((r) => r.xxzrlx === "2");
  if (rows.length !== 1 || rows[0].rq !== date.replaceAll("-", ""))
    throw new Error("北交所日期或市场不完整");
  return {
    date,
    value: numeric(rows[0].hqcjje) / 1e8,
    volume: numeric(rows[0].hqcjsl),
  };
}
export function sumMarkets(series: Observation[][]): Observation[] {
  if (!series.length) return [];
  const maps = series.map((points) => new Map(points.map((p) => [p.date, p])));
  return [...maps[0].keys()].sort().flatMap((date) => {
    const points = maps.map((m) => m.get(date));
    if (points.some((p) => !p)) return [];
    return [
      {
        date,
        value: points.reduce((n, p) => n + p!.value, 0),
        volume: points.some((p) => p!.volume === null)
          ? null
          : points.reduce((n, p) => n + p!.volume!, 0),
      },
    ];
  });
}
export function activityDates(initial: boolean, now = new Date()): string[] {
  const today = dateInZone(now, "Asia/Shanghai");
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const dates: string[] = [];
  for (let i = hour >= 18 ? 0 : 1; i < (initial ? 45 : 10); i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
      dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
// Each exchange has its own short-lived cookie session. Follow same-URL redirects
// with normal Set-Cookie handling (needed by BSE); never persist browser cookies.
function session(market: Market, deadline: number) {
  const cookies = new Map<string, string>();
  return async (url: string) => {
    for (let redirects = 0; redirects < 4; redirects++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("统计采集超时");
      const response = await httpFetch(url, {
        dispatcher: proxy,
        redirect: "manual",
        signal: AbortSignal.timeout(Math.min(12000, remaining)),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: refs[market],
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        },
      });
      for (const cookie of response.headers.getSetCookie()) {
        const first = cookie.split(";")[0],
          equals = first.indexOf("=");
        if (equals > 0)
          cookies.set(first.slice(0, equals), first.slice(equals + 1));
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || new URL(location, url).origin !== new URL(url).origin)
          throw new Error("来源跳转异常");
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    }
    throw new Error("来源跳转异常");
  };
}
async function fetchDay(
  market: Market,
  date: string,
  get: (url: string) => Promise<string>,
) {
  if (!isDate(date)) throw new Error("无效日期");
  if (market === "sh") {
    const params = new URLSearchParams({
      sqlId: "COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C",
      PRODUCT_CODE: "01,02,03,11,17",
      type: "inParams",
      SEARCH_DATE: date,
    });
    return parseShanghai(
      JSON.parse(
        await get(`https://query.sse.com.cn/commonQuery.do?${params}`),
      ),
      date,
    );
  }
  if (market === "sz") {
    const params = new URLSearchParams({
      SHOWTYPE: "JSON",
      CATALOGID: "1803_sczm",
      TABKEY: "tab1",
      txtQueryDate: date,
    });
    return parseShenzhen(
      JSON.parse(
        await get(`https://www.szse.cn/api/report/ShowReport/data?${params}`),
      ),
      date,
    );
  }
  const body = await get(
    `https://www.bse.cn/marketStatController/dailyReport.do?callback=cb&HQJSRQ=${date.replaceAll("-", "")}`,
  );
  const match = /^\s*cb\(([\s\S]*)\)\s*;?\s*$/.exec(body);
  if (!match) throw new Error("北交所格式异常");
  return parseBeijing(JSON.parse(match[1]), date);
}
const activityIds = [
  "sh-turnover", "sz-turnover", "bj-turnover", "hs-turnover", "a-turnover",
];
const dependencies: Market[][] = [["sh"], ["sz"], ["bj"], ["sh", "sz"], ["sh", "sz", "bj"]];
const exchangeNames: Record<Market, string> = { sh: "SSE", sz: "SZSE", bj: "BSE" };
function failureKind(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/timeout|aborted|超时/i.test(message)) return "timeout";
  const http = /HTTP (\d{3})/.exec(message);
  if (http) return `HTTP ${http[1]}`;
  if (/fetch failed|ECONN|socket/i.test(message)) return "network";
  return "invalid-response";
}
function retryable(error: unknown) {
  return /timeout|aborted|fetch failed|ECONN|socket|HTTP (408|429|5\d\d)/i.test(
    error instanceof Error ? error.message : "",
  );
}

export async function collectActivity(
  client: Client,
  initial: boolean,
  deadline: number,
  options: { now?: Date; fetchDay?: typeof fetchDay } = {},
) {
  const now = options.now || new Date();
  const historyDates = activityDates(true, now);
  const recentDates = activityDates(false, now);
  // A partial first backfill must not permanently shrink the retry window to ten
  // days. Revisit gaps evidenced by another exchange or an existing total.
  const stored = await client.execute({
    sql: `SELECT metric_id,date FROM observations WHERE metric_id IN (${activityIds.map(() => "?").join(",")}) AND date>=?`,
    args: [...activityIds, historyDates.at(-1)!],
  });
  const coverage = new Map<string, Set<string>>();
  for (const row of stored.rows) {
    const date = String(row.date);
    const ids = coverage.get(date) || new Set<string>();
    ids.add(String(row.metric_id));
    coverage.set(date, ids);
  }
  const dates = initial ? historyDates : historyDates.filter(date =>
    recentDates.includes(date) || (coverage.has(date) && coverage.get(date)!.size < activityIds.length),
  );
  const data: Record<Market, Observation[]> = { sh: [], sz: [], bj: [] };
  const errors: Record<Market, Map<string, string>> = { sh: new Map(), sz: new Map(), bj: new Map() };
  const fetch = options.fetchDay || fetchDay;
  await Promise.all(
    (["sh", "sz", "bj"] as Market[]).map(async (market) => {
      const get = session(market, deadline);
      let consecutiveFailures = 0;
      for (const [index, date] of dates.entries()) {
        if (Date.now() >= deadline || consecutiveFailures >= 3) {
          const reason = Date.now() >= deadline ? "deadline" : "source-unavailable";
          for (const remaining of dates.slice(index)) errors[market].set(remaining, reason);
          break;
        }
        try {
          let point: Observation | null;
          try {
            point = await fetch(market, date, get);
          } catch (error) {
            if (!retryable(error) || Date.now() + 250 >= deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 200));
            point = await fetch(market, date, get);
          }
          if (point) data[market].push(point);
          consecutiveFailures = 0;
        } catch (error) {
          errors[market].set(date, failureKind(error));
          consecutiveFailures++;
          console.error(`[activity] ${market} ${date}: ${failureKind(error)}`);
          // An isolated date failure must not discard all older available dates.
        }
      }
    }),
  );
  const results = [
    data.sh, data.sz, data.bj,
    sumMarkets([data.sh, data.sz]),
    sumMarkets([data.sh, data.sz, data.bj]),
  ];
  const latestObserved = Object.values(data).flat().map(p => p.date).sort().at(-1);
  let successes = 0, failures = 0;
  for (const [i, id] of activityIds.entries()) {
    const metric = activityMetrics.find(m => m.id === id)!;
    if (results[i].length)
      await saveObservations(client, metric.id, metric.source, results[i]);
    const missing = dependencies[i].flatMap(market =>
      [...errors[market]].map(([date, reason]) => ({ market, date, reason })),
    );
    const latest = results[i].map(p => p.date).sort().at(-1);
    const incompleteLatest = !latest || (latestObserved && latest < latestObserved) ||
      missing.some(item => item.date >= latest);
    if (missing.length || incompleteLatest) {
      failures++;
      const details = missing.slice(0, 3).map(item =>
        `${exchangeNames[item.market]} ${item.date} [${item.reason}]`,
      ).join(", ") + (missing.length > 3 ? ` … (+${missing.length - 3})` : "");
      await recordFailure(client, metric.id, incompleteLatest
        ? `交易所最新统计未完整取得；保留已存历史。未完成：${details || latestObserved || dates[0]}`
        : `历史补采未完整；最新统计已保存（${latest}）。未完成：${details}`);
    } else successes++;
  }
  return { successes, failures };
}
