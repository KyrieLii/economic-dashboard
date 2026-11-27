import { metrics } from "../shared/catalog";

export const boardGroups = [
  {
    id: "a",
    name: "A 股",
    groups: ["A股"],
    primary: [
      "a-turnover",
      "sse50",
      "csi300",
      "csi500",
      "csi1000",
      "chinext",
      "star50",
    ],
  },
  {
    id: "us",
    name: "美股 / 美元",
    groups: ["美股", "汇率"],
    primary: ["nasdaq", "sp500", "usdcny", "usdcnh"],
  },
  {
    id: "hk",
    name: "港股",
    groups: ["港股"],
    primary: ["hsi", "hstech", "hscei"],
  },
  {
    id: "commodities",
    name: "黄金 / 布油",
    groups: ["大宗商品"],
    primary: ["gold", "brent"],
  },
  {
    id: "crypto",
    name: "加密货币",
    groups: ["加密货币"],
    primary: ["btc", "eth"],
  },
  {
    id: "rates",
    name: "利率 / 美债",
    groups: ["利率与美债"],
    primary: [
      "us2y",
      "us10y",
      "us30y",
      "sofr",
      "effr",
      "shibor-on",
      "shibor-1w",
    ],
  },
];

export type BoardLayout = Record<string, string[]>;
export const layoutKey = "economic:board-layout:v1";
export function defaultLayout(): BoardLayout {
  return Object.fromEntries(boardGroups.map((g) => [g.id, [...g.primary]]));
}
export function normalizeLayout(value: unknown): BoardLayout {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return defaultLayout();
  const input = value as Record<string, unknown>;
  if (!boardGroups.every((g) => Array.isArray(input[g.id])))
    return defaultLayout();
  const known = new Set(metrics.map((m) => m.id));
  const seen = new Set<string>();
  return Object.fromEntries(
    boardGroups.map((g) => [
      g.id,
      (input[g.id] as unknown[]).filter((id): id is string => {
        if (
          typeof id !== "string" ||
          (!known.has(id) && !/^stock-[a-z0-9][a-z0-9.-]{0,39}$/.test(id)) ||
          seen.has(id)
        )
          return false;
        seen.add(id);
        return true;
      }),
    ]),
  );
}
// Position is measured in the destination list after removing the moving card.
export function placeCard(
  layout: BoardLayout,
  id: string,
  group: string,
  position: number,
): BoardLayout {
  if (
    !boardGroups.some((g) => g.id === group) ||
    (!metrics.some((m) => m.id === id) &&
      !/^stock-[a-z0-9][a-z0-9.-]{0,39}$/.test(id))
  )
    return layout;
  const next = Object.fromEntries(
    Object.entries(layout).map(([key, ids]) => [
      key,
      ids.filter((x) => x !== id),
    ]),
  );
  const ids = next[group];
  ids.splice(Math.max(0, Math.min(position, ids.length)), 0, id);
  return next;
}

export const boardKey = "economic:board:v2";
export interface BoardPreferences {
  order: string[];
  rowStarts: string[];
  width: number;
}
export function normalizePreferences(value: unknown): BoardPreferences {
  const input = (
    value && typeof value === "object" ? value : {}
  ) as Partial<BoardPreferences>;
  const ids = boardGroups.map((g) => g.id);
  const order = Array.isArray(input.order)
    ? [...new Set(input.order.filter((id) => ids.includes(id)))]
    : [];
  return {
    order: [...order, ...ids.filter((id) => !order.includes(id))],
    rowStarts: Array.isArray(input.rowStarts)
      ? [...new Set(input.rowStarts.filter((id) => ids.includes(id)))]
      : ["a", "us", "commodities", "rates"],
    width:
      typeof input.width === "number" && Number.isFinite(input.width)
        ? Math.max(160, Math.min(300, Math.round(input.width / 10) * 10))
        : 190,
  };
}
export function placeGroup(
  prefs: BoardPreferences,
  id: string,
  target: string,
  after: boolean,
  newRow = false,
): BoardPreferences {
  if (
    id === target ||
    !prefs.order.includes(id) ||
    !prefs.order.includes(target)
  )
    return prefs;
  const order = prefs.order.filter((key) => key !== id);
  order.splice(order.indexOf(target) + Number(after), 0, id);
  return {
    ...prefs,
    order,
    rowStarts: [
      ...prefs.rowStarts.filter((key) => key !== id),
      ...(newRow ? [id] : []),
    ],
  };
}
