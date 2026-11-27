export type Group =
  "A股" | "美股" | "港股" | "大宗商品" | "汇率" | "利率与美债" | "加密货币";
export interface Metric {
  id: string;
  name: string;
  englishName?: string;
  code: string;
  group: Group;
  unit: string;
  provider:
    | "yahoo"
    | "fred"
    | "nyfed"
    | "shibor"
    | "eastmoney"
    | "tencent"
    | "exchange";
  symbol: string;
  source: string;
  sourceUrl: string;
  note: string;
  rate?: boolean;
  volumeUnit?: string;
  marketActivity?: boolean;
  precision: number;
}
export interface Observation {
  date: string;
  value: number;
  volume: number | null;
}
export interface Point extends Observation {
  fetchedAt: string;
  revisedAt: string | null;
  source: string;
}
export interface Summary extends Metric {
  searchTerms?: string;
  latest: Point | null;
  previous: Point | null;
  spark: Observation[];
  count: number;
  firstDate: string | null;
  lastAttempt: string | null;
  lastSuccess: string | null;
  error: string | null;
}
export interface Run {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  successes: number;
  failures: number;
  status: string;
}
export interface DashboardData {
  metrics: Summary[];
  runs: Run[];
  generatedAt: string;
  storage: "local" | "remote";
}
export interface HistoryData {
  points: Point[];
  revisions: {
    date: string;
    oldValue: number;
    newValue: number;
    changedAt: string;
  }[];
}

export function change(
  current: number | undefined,
  previous: number | undefined,
  rate = false,
): number | null {
  if (
    current == null ||
    previous == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  )
    return null;
  if (rate) return (current - previous) * 100;
  return previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}
export function formatValue(
  value: number | null | undefined,
  precision = 2,
): string {
  return value == null
    ? "—"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });
}
export function formatChange(value: number | null, rate = false): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${rate ? " bp" : "%"}`;
}
export function dateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function freshness(
  date: string | undefined,
  now = new Date(),
): "missing" | "recent" | "delayed" {
  if (!date) return "missing";
  // A conservative age signal, not an exchange-holiday/open-market assertion.
  return now.getTime() - Date.parse(date + "T23:59:59Z") > 4 * 86400000
    ? "delayed"
    : "recent";
}

export type SearchMarket = "all" | "a" | "hk" | "us" | "crypto";
export interface StockCandidate {
  market: SearchMarket;
  symbol: string;
  name: string;
  exchange: string;
}
