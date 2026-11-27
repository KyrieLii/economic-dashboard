import { fetch as httpFetch, ProxyAgent } from "undici";
import type { Metric, Observation } from "../shared/model";
import { dateInZone, isDate } from "../shared/model";

const proxy = process.env.DATA_PROXY_URL
  ? new ProxyAgent(process.env.DATA_PROXY_URL)
  : undefined;
async function get(url: string): Promise<string> {
  const response = await httpFetch(url, {
    dispatcher: proxy,
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 (EconomicDashboard personal daily research)",
      Accept: "*/*",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`来源 HTTP ${response.status}`);
  }
  return response.text();
}
export function parseFred(csv: string): Observation[] {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^(DATE|observation_date),/.test(lines[0]))
    throw new Error("FRED 返回格式异常");
  return lines.slice(1).flatMap((line) => {
    const [date, raw] = line.split(",");
    const value = Number(raw);
    return isDate(date) && raw !== "" && raw !== "." && Number.isFinite(value)
      ? [{ date, value, volume: null }]
      : [];
  });
}
export function parseYahoo(data: any, now = new Date()): Observation[] {
  const result = data.chart?.result?.[0];
  if (!result || data.chart.error) throw new Error("行情来源暂无该指标");
  const quote = result.indicators?.quote?.[0];
  const timestamps: number[] = result.timestamp || [];
  const zone = result.meta?.exchangeTimezoneName || "UTC";
  const today = dateInZone(now, zone);
  const regularEnd = Number(
    result.meta?.currentTradingPeriod?.regular?.end || Infinity,
  );
  const closeIsFinal = regularEnd * 1000 + 30 * 60000 < now.getTime();
  return timestamps.flatMap((timestamp, index) => {
    const value = quote?.close?.[index];
    const date = dateInZone(new Date(timestamp * 1000), zone);
    // Keep an extra 30-minute settlement buffer; never store live prices as historical closes.
    if (
      date > today ||
      (date === today && !closeIsFinal) ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    )
      return [];
    const rawVolume = quote?.volume?.[index];
    return [
      {
        date,
        value,
        volume:
          typeof rawVolume === "number" &&
          Number.isFinite(rawVolume) &&
          rawVolume > 0
            ? rawVolume
            : null,
      },
    ];
  });
}
export function parseCrypto(data: unknown, now = new Date()): Observation[] {
  return parseYahoo(data, now)
    .filter((point) => point.date < dateInZone(now, "UTC"))
    .map((point) => ({ ...point, volume: null }));
}
export async function fetchMetric(
  metric: Metric,
  initial: boolean,
): Promise<Observation[]> {
  if (metric.provider === "yahoo") {
    const range = initial ? "5y" : "1mo";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(metric.symbol)}?range=${range}&interval=1d`;
    const payload = JSON.parse(await get(url));
    return metric.group === "加密货币"
      ? parseCrypto(payload)
      : parseYahoo(payload);
  }
  if (metric.provider === "eastmoney") {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (initial ? 365 * 3 : 45));
    const params = new URLSearchParams({
      secid: metric.symbol,
      klt: "101",
      fqt: "0",
      beg: from.toISOString().slice(0, 10).replaceAll("-", ""),
      end: "20500101",
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    });
    const json = JSON.parse(
      await get(
        `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`,
      ),
    );
    if (!Array.isArray(json.data?.klines))
      throw new Error("东方财富未返回日线");
    const today = dateInZone(new Date(), "Asia/Shanghai");
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    return json.data.klines.flatMap((line: string) => {
      const [date, , rawClose, , , rawVolume] = line.split(",");
      if (
        date > today ||
        (date === today && (metric.group === "汇率" || hour < 16))
      )
        return [];
      return [
        {
          date,
          value: Number(rawClose),
          volume:
            metric.group === "汇率" || Number(rawVolume) <= 0
              ? null
              : Number(rawVolume),
        },
      ];
    });
  }
  if (metric.provider === "tencent") {
    const json = JSON.parse(
      await get(
        `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${metric.symbol},day,,,${initial ? 1000 : 45},qfq`,
      ),
    );
    const rows = json.data?.[metric.symbol]?.day;
    if (!Array.isArray(rows)) throw new Error("腾讯财经未返回日线");
    const today = dateInZone(new Date(), "Asia/Hong_Kong");
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Hong_Kong",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    return rows
      .filter((r: string[]) => r[0] < today || (r[0] === today && hour >= 17))
      .map((r: string[]) => ({
        date: r[0],
        value: Number(r[2]),
        volume: null,
      }));
  }
  if (metric.provider === "fred") {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (initial ? 365 * 3 : 45));
    return parseFred(
      await get(
        `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${metric.symbol}&cosd=${from.toISOString().slice(0, 10)}`,
      ),
    );
  }
  if (metric.provider === "nyfed") {
    const family = metric.symbol === "sofr" ? "secured" : "unsecured";
    const from = new Date();
    from.setUTCFullYear(from.getUTCFullYear() - 3);
    const endpoint = initial
      ? `search.json?startDate=${from.toISOString().slice(0, 10)}&endDate=${new Date().toISOString().slice(0, 10)}`
      : "last/45.json";
    const json = JSON.parse(
      await get(
        `https://markets.newyorkfed.org/api/rates/${family}/${metric.symbol}/${endpoint}`,
      ),
    );
    if (!Array.isArray(json.refRates)) throw new Error("纽约联储返回格式异常");
    return json.refRates
      .filter(
        (r: any) =>
          isDate(r.effectiveDate) && typeof r.percentRate === "number",
      )
      .map((r: any) => ({
        date: r.effectiveDate,
        value: r.percentRate,
        volume: null,
      }));
  }
  const params = new URLSearchParams({
    reportName: "RPT_IMP_INTRESTRATEN",
    columns: "ALL",
    filter: `(MARKET_CODE="001")(CURRENCY_CODE="CNY")(INDICATOR_ID="${metric.symbol}")`,
    sortColumns: "REPORT_DATE",
    sortTypes: "-1",
    pageSize: initial ? "1000" : "45",
    pageNumber: "1",
  });
  const json = JSON.parse(
    await get(`https://datacenter-web.eastmoney.com/api/data/v1/get?${params}`),
  );
  if (!json.success || !Array.isArray(json.result?.data))
    throw new Error("Shibor 来源返回格式异常");
  return json.result.data
    .filter(
      (r: any) =>
        typeof r.IR_RATE === "number" && isDate(r.REPORT_DATE.slice(0, 10)),
    )
    .map((r: any) => ({
      date: r.REPORT_DATE.slice(0, 10),
      value: r.IR_RATE,
      volume: null,
    }));
}
