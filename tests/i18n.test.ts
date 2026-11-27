import { test } from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/i18n";
import { metrics } from "../shared/catalog";
import { boardGroups } from "../src/board-layout";

test("both locales preserve interpolation, codes and source semantics", () => {
  assert.equal(translate("前移{0}", "zh-CN", "沪深300"), "前移沪深300");
  assert.equal(translate("前移{0}", "en", "沪深300"), "Move CSI 300 earlier");
  assert.equal(
    translate("中文证券搜索暂不可用，结果可能不完整", "en"),
    "Chinese security search is temporarily unavailable; results may be incomplete",
  );
  assert.equal(translate("AAPL", "en"), "AAPL");
  assert.equal(
    translate(
      "观测日期：{0}{1}\n{2}\n{3}",
      "en",
      "2026-11-25",
      " UTC",
      "Yahoo Finance",
      "待采集",
    ),
    "Observation date: 2026-11-25 UTC\nYahoo Finance\nPending",
  );
});
test("all built-in indicator labels, units, source notes and market headings have English translations", () => {
  for (const metric of metrics) {
    for (const value of [
      metric.name,
      metric.unit,
      metric.source,
      metric.note,
      metric.volumeUnit || "",
    ])
      assert.doesNotMatch(translate(value, "en"), /[\u4e00-\u9fff]/, value);
  }
  for (const group of boardGroups)
    assert.doesNotMatch(
      translate(group.name, "en"),
      /[\u4e00-\u9fff]/,
      group.name,
    );
});
