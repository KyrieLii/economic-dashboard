import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLayout,
  normalizeLayout,
  placeCard,
  normalizePreferences,
  placeGroup,
} from "../src/board-layout";

test("saved layouts reject corrupt schemas, remove obsolete IDs and duplicates, and retain deliberate empty groups", () => {
  assert.deepEqual(normalizeLayout(null), defaultLayout());
  assert.deepEqual(normalizeLayout({ a: "broken" }), defaultLayout());
  const layout = defaultLayout();
  layout.a = ["sse50", "sse50", "obsolete"];
  layout.us = ["sse50", "sp500"];
  layout.crypto = [];
  const result = normalizeLayout(layout);
  assert.deepEqual(result.a, ["sse50"]);
  assert.deepEqual(result.us, ["sp500"]);
  assert.deepEqual(result.crypto, []);
  assert.deepEqual(normalizeLayout(JSON.parse(JSON.stringify(result))), result);
});
test("moving cards preserves uniqueness, supports both directions and empty destinations without mutating the saved layout", () => {
  const original = defaultLayout();
  const moved = placeCard(original, "a-turnover", "a", 2);
  assert.equal(moved.a[2], "a-turnover");
  assert.equal(original.a[0], "a-turnover");
  assert.deepEqual(placeCard(moved, "a-turnover", "a", 0), original);
  const across = placeCard({ ...moved, crypto: [] }, "sse50", "crypto", 0);
  assert.deepEqual(across.crypto, ["sse50"]);
  assert.ok(!across.a.includes("sse50"));
  const added = placeCard(original, "bj-turnover", "a", 99);
  assert.equal(added.a.at(-1), "bj-turnover");
  assert.deepEqual(placeCard(added, "bj-turnover", "a", 99), added);
  assert.equal(placeCard(original, "unknown", "a", 0), original);
  assert.equal(placeCard(original, "sse50", "unknown", 0), original);
});

test("group preferences retain known groups, bound widths and survive serialization", () => {
  const preferences = normalizePreferences({
    order: ["hk", "hk", "missing"],
    rowStarts: ["hk", "missing"],
    width: 999,
  });
  assert.deepEqual(preferences.order, [
    "hk",
    "a",
    "us",
    "commodities",
    "crypto",
    "rates",
  ]);
  assert.deepEqual(preferences.rowStarts, ["hk"]);
  assert.equal(preferences.width, 300);
  assert.equal(normalizePreferences({ width: NaN }).width, 190);
  assert.deepEqual(
    normalizePreferences(JSON.parse(JSON.stringify(preferences))),
    preferences,
  );
  const moved = placeGroup(preferences, "crypto", "a", true, true);
  assert.deepEqual(moved.order, [
    "hk",
    "a",
    "crypto",
    "us",
    "commodities",
    "rates",
  ]);
  assert.ok(moved.rowStarts.includes("crypto"));
  const merged = placeGroup(moved, "crypto", "us", true);
  assert.ok(!merged.rowStarts.includes("crypto"));
  assert.deepEqual(preferences.order, [
    "hk",
    "a",
    "us",
    "commodities",
    "crypto",
    "rates",
  ]);
});
