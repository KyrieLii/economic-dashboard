import { change, dateInZone, type Metric, type Summary } from "./model.js";

export interface Quote {
  value: number;
  previousClose: number | null;
  asOf: string;
  fetchedAt: string;
  timeZone: string;
  source: string;
}
export interface QuoteState {
  quote: Quote | null;
  checkedAt: string | null;
  error: string | null;
}
export interface QuotesData {
  quotes: Record<string, QuoteState>;
}
export function supportsQuote(metric: Metric) {
  return ["yahoo", "eastmoney", "tencent"].includes(metric.provider) &&
    !metric.marketActivity && !metric.rate;
}
// Quotes never replace daily observations: charts, exports and revisions stay daily.
export function displayedQuote(metric: Summary): Quote | null {
  const quote = metric.quoteState?.quote;
  if (!quote || (metric.latest &&
    dateInZone(new Date(quote.asOf), quote.timeZone) < metric.latest.date)) return null;
  return quote;
}
export function displayedChange(metric: Summary) {
  const quote = displayedQuote(metric);
  return quote
    ? change(quote.value, quote.previousClose ?? undefined)
    : change(metric.latest?.value, metric.previous?.value, metric.rate);
}
