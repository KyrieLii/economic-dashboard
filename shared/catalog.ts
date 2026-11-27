import type { Group, Metric } from "./model";

const yahoo = (
  id: string,
  name: string,
  symbol: string,
  group: Group,
  unit = "点",
  precision = 2,
  extra: Partial<Metric> = {},
): Metric => ({
  id,
  name,
  code: symbol,
  symbol,
  group,
  unit,
  precision,
  provider: "yahoo",
  source: "Yahoo Finance",
  sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,
  note: "日线收盘价；按交易所当地日期归档。源成交量统计范围未独立核实，不视为全市场成交量。",
  ...extra,
});
const rate = (
  id: string,
  name: string,
  provider: Metric["provider"],
  symbol: string,
  source: string,
  sourceUrl: string,
  note: string,
): Metric => ({
  id,
  name,
  code: symbol.toUpperCase(),
  symbol,
  group: "利率与美债",
  unit: "%",
  precision: 3,
  provider,
  source,
  sourceUrl,
  note,
  rate: true,
});
export const activityMetrics: Metric[] = [
  [
    "a-turnover",
    "A股总成交额",
    "沪深北",
    "三所官方日度统计合计",
    "https://www.sse.com.cn/market/stockdata/overview/day/",
    "沪市主板A与科创板 + 深市主板A与创业板A + 北交所股票；不含B股、基金、债券和回购。同日三所数据齐全才合计。深市纯A股成交股数尚未核实，总成交量暂缺。",
  ],
  [
    "hs-turnover",
    "沪深A股成交额",
    "沪深",
    "沪深交易所官方日度统计",
    "https://www.szse.cn/market/overview/index.html",
    "沪市主板A与科创板 + 深市主板A与创业板A；不含北交所、B股、基金、债券和回购。同日两所数据齐全才合计。",
  ],
  [
    "sh-turnover",
    "沪市A股成交额",
    "上交所",
    "上交所 · 每日股票情况",
    "https://www.sse.com.cn/market/stockdata/overview/day/",
    "主板A（01）与科创板（03）相加，排除B股、回购。成交额原单位亿元，成交量原单位亿股；保留来源的两位小数精度。",
  ],
  [
    "sz-turnover",
    "深市A股成交额",
    "深交所",
    "深交所 · 证券类别统计",
    "https://www.szse.cn/market/overview/index.html",
    "主板A股与创业板A股成交金额相加，排除主板B股、基金和债券。深市日度概况的合计成交量含B股，暂不作为纯A股成交量使用。",
  ],
  [
    "bj-turnover",
    "北交所成交额",
    "北交所",
    "北交所 · 市场日报",
    "https://www.bse.cn/static/statisticdata.html",
    "北交所股票市场日报（xxzrlx=2），排除新三板。成交金额原单位元，成交数量原单位股；大宗交易附注不重复相加。",
  ],
].map(([id, name, code, source, sourceUrl, note]) => ({
  id,
  name,
  code,
  symbol: id,
  source,
  sourceUrl,
  note,
  group: "A股",
  provider: "exchange",
  unit: "亿元",
  precision: 2,
  marketActivity: true,
  volumeUnit: "股",
}));
const catalog: Metric[] = [
  ...activityMetrics,
  yahoo("sse", "上证指数", "000001.SS", "A股"),
  yahoo("sse50", "上证50", "000016.SS", "A股"),
  yahoo("csi300", "沪深300", "000300.SS", "A股"),
  yahoo("csi500", "中证500", "000905.SS", "A股"),
  yahoo("csi1000", "中证1000", "000852.SS", "A股"),
  yahoo("chinext", "创业板指", "399006.SZ", "A股"),
  yahoo("star50", "科创50", "000688.SS", "A股"),
  yahoo("sp500", "标普500", "^GSPC", "美股"),
  yahoo("nasdaq", "纳斯达克综合", "^IXIC", "美股"),
  yahoo("dow", "道琼斯工业", "^DJI", "美股"),
  yahoo("hsi", "恒生指数", "^HSI", "港股"),
  yahoo("hstech", "恒生科技", "HSTECH.HK", "港股"),
  yahoo("hscei", "恒生国企", "^HSCE", "港股"),
  ...(
    [
      ["btc", "比特币 BTC", "BTC-USD"],
      ["eth", "以太坊 ETH", "ETH-USD"],
    ] as const
  ).map(([id, name, symbol]) =>
    yahoo(id, name, symbol, "加密货币", "美元", 2, {
      code: id.toUpperCase(),
      note: "Yahoo Finance 加密货币美元参考报价；按 UTC 日期保存已结束日线，排除当日未完成价格。日变化相对前一条日线，不是滚动24小时涨跌。成交字段单位未核实，不展示。",
    }),
  ),
  ...(
    [
      ["gold", "COMEX 黄金", "GC=F", "美元/盎司"],
      ["silver", "COMEX 白银", "SI=F", "美元/盎司"],
      ["wti", "WTI 原油", "CL=F", "美元/桶"],
      ["brent", "布伦特原油", "BZ=F", "美元/桶"],
      ["copper", "COMEX 铜", "HG=F", "美元/磅"],
    ] as const
  ).map(([id, name, symbol, unit]) =>
    yahoo(id, name, symbol, "大宗商品", unit, 2, {
      volumeUnit: "合约",
      note: "Yahoo 近月期货日线，非现货或固定合约。滚动换月可能产生跳变，区间涨跌不等于可投资收益。",
    }),
  ),
  yahoo("usdcny", "美元 / 在岸人民币", "CNY=X", "汇率", "CNY / USD", 4, {
    note: "每1美元兑换的在岸人民币数量；数值上升表示美元升值。供应商日线参考报价，非中间价。",
  }),
  yahoo("usdcnh", "美元 / 离岸人民币", "USDCNH=X", "汇率", "CNH / USD", 4, {
    note: "每1美元兑换的离岸人民币数量；供应商日线参考报价。",
  }),
  rate(
    "us2y",
    "美债 2 年收益率",
    "fred",
    "DGS2",
    "FRED · 美联储",
    "https://fred.stlouisfed.org/series/DGS2",
    "固定期限国债收益率，非债券价格；官方日频数据有发布滞后。",
  ),
  rate(
    "us10y",
    "美债 10 年收益率",
    "fred",
    "DGS10",
    "FRED · 美联储",
    "https://fred.stlouisfed.org/series/DGS10",
    "固定期限国债收益率，非债券价格；日变化以基点表示。",
  ),
  rate(
    "us30y",
    "美债 30 年收益率",
    "fred",
    "DGS30",
    "FRED · 美联储",
    "https://fred.stlouisfed.org/series/DGS30",
    "固定期限国债收益率；缺失日期不补零。",
  ),
  rate(
    "sofr",
    "SOFR 担保隔夜利率",
    "nyfed",
    "sofr",
    "纽约联储",
    "https://www.newyorkfed.org/markets/reference-rates/sofr",
    "美国担保隔夜融资利率；按 effectiveDate 归档，次工作日发布。",
  ),
  rate(
    "effr",
    "有效联邦基金利率",
    "nyfed",
    "effr",
    "纽约联储",
    "https://www.newyorkfed.org/markets/reference-rates/effr",
    "实际有效利率 EFFR，非美联储政策目标区间。",
  ),
  rate(
    "shibor-on",
    "Shibor 隔夜",
    "shibor",
    "001",
    "东方财富 · Shibor",
    "https://www.chinamoney.com.cn/chinese/bkshibor/",
    "东方财富转引上海银行间同业拆放利率；按报告日期归档。",
  ),
  rate(
    "shibor-1w",
    "Shibor 1 周",
    "shibor",
    "101",
    "东方财富 · Shibor",
    "https://www.chinamoney.com.cn/chinese/bkshibor/",
    "人民币1周期同业拆放利率，非贷款市场报价利率 LPR。",
  ),
];
const eastmoneySymbols: Record<string, string> = {
  sse50: "1.000016",
  csi1000: "1.000852",
  csi300: "1.000300",
  csi500: "1.000905",
  chinext: "0.399006",
  star50: "1.000688",
  usdcnh: "133.USDCNH",
};
export const metrics: Metric[] = catalog.map((metric) => {
  if (eastmoneySymbols[metric.id])
    return {
      ...metric,
      provider: "eastmoney",
      symbol: eastmoneySymbols[metric.id],
      source: "东方财富",
      sourceUrl: "https://quote.eastmoney.com/",
      volumeUnit: metric.group === "A股" ? "手（指数口径）" : undefined,
      note:
        metric.group === "A股"
          ? "指数日线收盘价与源成交量（手）；统计范围依指数，不代表全市场。每条历史记录保留实际来源。"
          : "每1美元兑换的离岸人民币数量，东方财富日线参考报价；仅记录已结束的日期。",
    };
  if (metric.id === "hstech")
    return {
      ...metric,
      provider: "tencent",
      symbol: "hkHSTECH",
      source: "腾讯财经",
      sourceUrl: "https://gu.qq.com/hkHSTECH/zs",
      note: "恒生科技指数日线收盘价。该源成交字段口径未核实，暂不展示；逐条历史保留实际来源。",
    };
  return metric;
});
export const groups: Group[] = [
  "A股",
  "美股",
  "港股",
  "大宗商品",
  "汇率",
  "利率与美债",
  "加密货币",
];
export const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
