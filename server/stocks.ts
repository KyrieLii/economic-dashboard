import type { Client } from "@libsql/client";
import type { Metric, StockCandidate, SearchMarket } from "../shared/model";
import { metrics } from "../shared/catalog";
import { get, parseYahoo, parseCrypto, fetchMetric } from "./providers";
import { acquireLease, releaseLease, saveObservations } from "./store";

const usExchanges = new Set(["NMS", "NGM", "NCM", "NYQ", "ASE", "BTS", "PCX"]);
export const validStockSymbol = (symbol: string) =>
  /^[A-Z0-9][A-Z0-9.-]{0,39}$/.test(symbol);
const cryptoAliases: Record<string, string> = {
  比特币: "BTC-USD",
  以太坊: "ETH-USD",
  狗狗币: "DOGE-USD",
  索拉纳: "SOL-USD",
  瑞波币: "XRP-USD",
  莱特币: "LTC-USD",
  币安币: "BNB-USD",
  艾达币: "ADA-USD",
  雪崩: "AVAX-USD",
  波卡: "DOT-USD",
};
export function stockQuery(query: string) {
  const value = query.trim();
  if (/^(apel|苹果)$/i.test(value)) return "AAPL";
  if (cryptoAliases[value]) return cryptoAliases[value];
  if (/^\d{6}$/.test(value))
    return `${value}.${value.startsWith("6") ? "SS" : /^[489]/.test(value) ? "BJ" : "SZ"}`;
  if (/^\d{1,5}(\.HK)?$/i.test(value))
    return `${String(Number(value.split(".")[0])).padStart(4, "0")}.HK`;
  return value.replace(/^(\d{6})\.SH$/i, "$1.SS");
}
function yahooMarket(
  symbol: string,
  type: string,
  exchange: string,
): SearchMarket | undefined {
  if (
    type === "CRYPTOCURRENCY" &&
    exchange === "CCC" &&
    /^[A-Z0-9][A-Z0-9-]*-USD$/.test(symbol)
  )
    return "crypto";
  if (type !== "EQUITY") return;
  if (usExchanges.has(exchange) && /^[A-Z][A-Z0-9.-]*$/.test(symbol))
    return "us";
  if (exchange === "SHH" && /^6\d{5}\.SS$/.test(symbol)) return "a";
  if (exchange === "SHZ" && /^[03]\d{5}\.SZ$/.test(symbol)) return "a";
  if (exchange === "HKG" && /^\d{4,5}\.HK$/.test(symbol)) return "hk";
}
export function parseStockSearch(payload: any): StockCandidate[] {
  if (!Array.isArray(payload.quotes)) throw new Error("资产搜索来源格式异常");
  const seen = new Set<string>();
  return payload.quotes.flatMap((quote: any) => {
    if (
      typeof quote.symbol !== "string" ||
      !validStockSymbol(quote.symbol) ||
      seen.has(quote.symbol)
    )
      return [];
    const market = yahooMarket(quote.symbol, quote.quoteType, quote.exchange);
    if (!market) return [];
    seen.add(quote.symbol);
    return [
      {
        symbol: quote.symbol,
        name: String(quote.longname || quote.shortname || quote.symbol),
        exchange: String(quote.exchDisp || quote.exchange),
        market,
      },
    ];
  });
}
export function parseChinaSearch(payload: any): StockCandidate[] {
  const rows = payload.QuotationCodeTable?.Data;
  if (!Array.isArray(rows)) throw new Error("中文证券搜索来源格式异常");
  return rows.flatMap((q: any) => {
    const code = String(q.Code);
    let symbol: string, market: SearchMarket;
    if (
      q.Classify === "AStock" &&
      /^\d{6}$/.test(code) &&
      ((q.MktNum === "1" && /^6/.test(code)) ||
        (q.MktNum === "0" && /^[03]/.test(code)))
    ) {
      market = "a";
      symbol = `${code}.${q.MktNum === "1" ? "SS" : "SZ"}`;
    } else if (q.SecurityTypeName === "京A" && /^[489]\d{5}$/.test(code)) {
      market = "a";
      symbol = `${code}.BJ`;
    } else if (
      q.Classify === "HK" &&
      (Number(code) < 10000 ||
        (Number(code) >= 80000 && Number(code) < 90000)) &&
      /^\d{5}$/.test(code) &&
      ["6", "19"].includes(q.SecurityType)
    ) {
      market = "hk";
      symbol = `${String(Number(code)).padStart(4, "0")}.HK`;
    } else return [];
    return [
      {
        symbol,
        name: String(q.Name || code),
        exchange: String(q.SecurityTypeName),
        market,
      },
    ];
  });
}
async function chinaSearch(query: string) {
  const needle = /^(\d+)\.(SS|SZ|BJ|HK)$/i.test(query)
    ? query.split(".")[0].padStart(query.endsWith("HK") ? 5 : 6, "0")
    : query;
  return parseChinaSearch(
    JSON.parse(
      await get(
        `https://searchapi.eastmoney.com/api/suggest/get?${new URLSearchParams({ input: needle, type: "14", count: "20" })}`,
      ),
    ),
  );
}
async function yahooSearch(query: string) {
  return parseStockSearch(
    JSON.parse(
      await get(
        `https://query1.finance.yahoo.com/v1/finance/search?${new URLSearchParams({ q: query, quotesCount: "20", newsCount: "0" })}`,
      ),
    ),
  );
}
const searches = new Map<
  string,
  { expires: number; results: StockCandidate[]; warnings: string[] }
>();
export async function searchStocks(
  query: string,
  market: SearchMarket = "all",
) {
  const normalized = stockQuery(query);
  const key = `${market}:${normalized.toUpperCase()}`;
  const cached = searches.get(key);
  if (cached && cached.expires > Date.now())
    return {
      query: normalized,
      results: cached.results,
      warnings: cached.warnings,
    };
  const tasks: { label: string; run: Promise<StockCandidate[]> }[] = [];
  if (["all", "a", "hk"].includes(market))
    tasks.push({ label: "中文证券搜索", run: chinaSearch(normalized) });
  if (market !== "a" && !/[\u4e00-\u9fff]/.test(normalized))
    tasks.push({ label: "全球行情搜索", run: yahooSearch(normalized) });
  if (
    ["all", "crypto"].includes(market) &&
    /^[a-z0-9]{1,20}$/i.test(normalized)
  )
    tasks.push({
      label: "加密货币搜索",
      run: yahooSearch(`${normalized.toUpperCase()}-USD`),
    });
  const responses = await Promise.allSettled(tasks.map((task) => task.run));
  if (responses.every((result) => result.status === "rejected"))
    throw new Error("搜索来源暂不可用");
  const warnings = responses.flatMap((result, i) =>
    result.status === "rejected"
      ? [`${tasks[i].label}暂不可用，结果可能不完整`]
      : [],
  );
  const seen = new Set<string>();
  const results = responses
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => {
      if ((market !== "all" && item.market !== market) || seen.has(item.symbol))
        return false;
      seen.add(item.symbol);
      return true;
    });
  if (searches.size >= 100) searches.delete(searches.keys().next().value!);
  searches.set(key, {
    expires: Date.now() + (warnings.length ? 5000 : 60000),
    results,
    warnings,
  });
  return { query: normalized, results, warnings };
}
export function stockMetric(payload: any, symbol: string): Metric {
  const meta = payload.chart?.result?.[0]?.meta;
  const market =
    meta && yahooMarket(symbol, meta.instrumentType, meta.exchangeName);
  const units: Record<string, string> = {
    USD: "美元",
    CNY: "人民币",
    HKD: "港元",
  };
  if (
    !meta ||
    meta.symbol !== symbol ||
    !market ||
    !units[meta.currency] ||
    ((market === "us" || market === "crypto") && meta.currency !== "USD") ||
    (market === "a" && meta.currency !== "CNY") ||
    (market === "crypto" && meta.exchangeTimezoneName !== "UTC")
  )
    throw new Error("资产市场、币种或类型未通过核验");
  const group = (
    { a: "A股", hk: "港股", us: "美股", crypto: "加密货币" } as const
  )[market as Exclude<SearchMarket, "all">];
  return {
    id: `stock-${symbol.toLowerCase()}`,
    name: String(meta.longName || meta.shortName || symbol),
    code: symbol,
    symbol,
    group,
    provider: "yahoo",
    unit: units[meta.currency],
    precision: market === "crypto" ? 6 : 2,
    ...(market === "crypto" ? {} : { volumeUnit: "股" }),
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,
    note:
      market === "crypto"
        ? "加密货币美元参考报价；仅保存已完成UTC日线，涨跌相对前次日线，不是滚动24小时涨跌。成交字段单位未核实，不展示。"
        : `${group}个股日线；按 ${meta.exchangeTimezoneName} 交易日记录，收盘后保留30分钟缓冲。非实时价格；分红和拆股可能影响口径，不代表含股息总回报。`,
  };
}
export class StockError extends Error {
  constructor(
    message: string,
    public status: 400 | 409 | 422 | 429 | 502,
  ) {
    super(message);
  }
}
export async function registerStock(
  client: Client,
  symbol: string,
): Promise<Metric> {
  if (!validStockSymbol(symbol)) throw new StockError("资产代码格式无效", 400);
  const builtin = metrics.find(
    (metric) =>
      metric.symbol === symbol &&
      ["A股", "港股", "美股", "加密货币"].includes(metric.group),
  );
  if (builtin) return builtin;
  const id = `stock-${symbol.toLowerCase()}`;
  const existing = await client.execute({
    sql: "SELECT definition FROM custom_metrics WHERE id=?",
    args: [id],
  });
  if (existing.rows.length)
    return JSON.parse(String(existing.rows[0].definition));
  const owner = await acquireLease(client);
  if (!owner) throw new StockError("正在采集数据，请稍后再添加", 409);
  try {
    const registered = await client.execute({
      sql: "SELECT definition FROM custom_metrics WHERE id=?",
      args: [id],
    });
    if (registered.rows.length)
      return JSON.parse(String(registered.rows[0].definition));
    const count = await client.execute(
      "SELECT COUNT(*) AS n FROM custom_metrics",
    );
    if (Number(count.rows[0].n) >= 50)
      throw new StockError("当前最多追踪50项自定义资产", 429);
    let metric: Metric, points;
    if (/^[489]\d{5}\.BJ$/.test(symbol)) {
      const candidate = (await chinaSearch(symbol)).find(
        (item) => item.symbol === symbol && item.exchange === "京A",
      );
      if (!candidate) throw new StockError("未找到已核实的北交所股票", 422);
      metric = {
        id,
        name: candidate.name,
        code: symbol,
        symbol: `0.${symbol.split(".")[0]}`,
        group: "A股",
        provider: "eastmoney",
        unit: "人民币",
        precision: 2,
        source: "东方财富",
        sourceUrl: `https://quote.eastmoney.com/bj/${symbol.split(".")[0]}.html`,
        note: "北交所个股不复权日线，按北京时间交易日记录；16:00前不保存当日价格。成交字段单位未独立核实，不展示；不代表含股息总回报。",
      };
      points = await fetchMetric(metric, true);
    } else {
      let payload: any;
      try {
        payload = JSON.parse(
          await get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`,
          ),
        );
      } catch {
        throw new StockError("行情来源暂时不可用，请稍后重试", 502);
      }
      try {
        metric = stockMetric(payload, symbol);
      } catch {
        throw new StockError(
          "未找到支持的股票或加密货币，请检查市场和代码",
          422,
        );
      }
      if (["A股", "港股"].includes(metric.group)) {
        metric.englishName = metric.name;
        const candidate = await chinaSearch(symbol)
          .then((rows) => rows.find((item) => item.symbol === symbol))
          .catch(() => undefined);
        if (candidate) metric.name = candidate.name;
      }
      points =
        metric.group === "加密货币"
          ? parseCrypto(payload)
          : parseYahoo(payload);
    }
    if (!points.length) throw new StockError("该资产暂无已完成日线", 422);
    await saveObservations(client, id, metric.source, points);
    await client.execute({
      sql: "INSERT INTO custom_metrics(id,definition,created_at) VALUES (?,?,?)",
      args: [id, JSON.stringify(metric), new Date().toISOString()],
    });
    return metric;
  } finally {
    await releaseLease(client, owner);
  }
}
