import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseShanghai,
  parseShenzhen,
  parseBeijing,
  sumMarkets,
  activityDates,
} from "../server/market-activity";
const date = "2026-11-26";
test("Shanghai sums only main-board A and STAR, with hundred-million share conversion", () => {
  const payload = {
    result: [
      {
        PRODUCT_CODE: "01",
        TRADE_DATE: "20261126",
        TRADE_AMT: "4,249.56",
        TRADE_VOL: "413.51",
      },
      {
        PRODUCT_CODE: "02",
        TRADE_DATE: "20261126",
        TRADE_AMT: "1.16",
        TRADE_VOL: "0.18",
      },
      {
        PRODUCT_CODE: "03",
        TRADE_DATE: "20261126",
        TRADE_AMT: "1886.94",
        TRADE_VOL: "40.67",
      },
      {
        PRODUCT_CODE: "17",
        TRADE_DATE: "20261126",
        TRADE_AMT: "6137.67",
        TRADE_VOL: "454.36",
      },
    ],
  };
  assert.deepEqual(parseShanghai(payload, date), {
    date,
    value: 6136.5,
    volume: 45418000000,
  });
  assert.throws(() => parseShanghai(payload, "2026-11-25"));
  assert.throws(() =>
    parseShanghai({ result: payload.result.slice(0, 2) }, date),
  );
  assert.equal(parseShanghai({ result: [] }, date), null);
});
test("Shenzhen excludes B shares, funds and bonds and does not mistake security count for volume", () => {
  const payload = [
    {
      metadata: {
        tabkey: "tab1",
        subname: date,
        cols: { cjje: "成交金额<br>(亿元)" },
      },
      data: [
        { lbmc: "&nbsp;主板A股", cjje: "3,666.10", zqsl: "1494" },
        { lbmc: "主板B股", cjje: "0.43" },
        { lbmc: "创业板A股", cjje: "3,381.47" },
        { lbmc: "基金", cjje: "1036.61" },
        { lbmc: "债券", cjje: "3804.42" },
      ],
    },
  ];
  assert.deepEqual(parseShenzhen(payload, date), {
    date,
    value: 7047.57,
    volume: null,
  });
  assert.throws(() => parseShenzhen(payload, "2026-11-25"));
  payload[0].metadata.cols.cjje = "成交金额(元)";
  assert.throws(() => parseShenzhen(payload, date));
});
test("Beijing keeps zero, excludes NEEQ and never double-counts block-trade footnotes", () => {
  const payload = [
    { xxzrlx: "2", rq: "20261126", hqcjje: 8769886867.88, hqcjsl: 535642085 },
    { xxzrlx: "XJX", rq: "20261126", hqcjje: 670000, hqcjsl: 100000 },
    { xxzrlx: "1", rq: "20261126", hqcjje: 80782008.71, hqcjsl: 22710136 },
  ];
  assert.deepEqual(parseBeijing(payload, date), {
    date,
    value: 87.6988686788,
    volume: 535642085,
  });
  assert.equal(parseBeijing([{ ...payload[0], hqcjsl: 0 }], date)!.volume, 0);
  assert.throws(() => parseBeijing([{ ...payload[0], hqcjsl: "-" }], date));
  assert.throws(() => parseBeijing(payload, "2026-11-25"));
});
test("total uses date intersection, preserves missing volume, and never substitutes index or stale data", () => {
  const sh = [
    { date, value: 100, volume: 10 },
    { date: "2026-11-27", value: 110, volume: 11 },
  ];
  const sz = [{ date, value: 200, volume: null }];
  const bj = [{ date, value: 3, volume: 1 }];
  assert.deepEqual(sumMarkets([sh, sz, bj]), [
    { date, value: 303, volume: null },
  ]);
  assert.deepEqual(sumMarkets([sh, sz, []]), []);
  assert.deepEqual(sumMarkets([sh, bj]), [{ date, value: 103, volume: 11 }]);
});
test("exchange collection excludes unfinished days and weekends in Shanghai timezone", () => {
  assert.equal(
    activityDates(false, new Date("2026-11-27T09:59:00Z"))[0],
    "2026-11-26",
  );
  assert.equal(
    activityDates(false, new Date("2026-11-27T10:00:00Z"))[0],
    "2026-11-27",
  );
  assert.equal(
    activityDates(false, new Date("2026-11-29T12:00:00Z"))[0],
    "2026-11-27",
  );
});
