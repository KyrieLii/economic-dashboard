import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Database,
  Download,
  ExternalLink,
  Globe2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { metrics as catalog } from "../shared/catalog";
import {
  change,
  dateInZone,
  formatChange,
  formatValue,
  freshness,
  type DashboardData,
  type HistoryData,
  type Summary,
} from "../shared/model";
import { HistoryChart, Spark } from "./Chart";
import { InfoTip } from "./InfoTip";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `请求失败（${response.status}）`);
  }
  return response.json();
}
function readSaved<T>(key: string, initial: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? initial;
  } catch {
    return initial;
  }
}
function timeLabel(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "尚未采集";
}
function compact(value: number | null | undefined) {
  return value == null
    ? "—"
    : value >= 1e8
      ? `${formatValue(value / 1e8)}亿`
      : value >= 1e4
        ? `${formatValue(value / 1e4)}万`
        : formatValue(value, 0);
}
function Delta({
  value,
  rate = false,
}: {
  value: number | null;
  rate?: boolean;
}) {
  return (
    <span
      className={`delta ${value == null || value === 0 ? "muted" : value > 0 ? "up" : "down"}`}
    >
      {value != null &&
        value !== 0 &&
        (value > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      {formatChange(value, rate)}
    </span>
  );
}
function Status({ metric }: { metric: Summary }) {
  if (metric.error)
    return (
      <span className="status warn" title={metric.error}>
        采集异常
      </span>
    );
  if (!metric.latest) return <span className="status muted">待采集</span>;
  if (freshness(metric.latest.date) === "delayed")
    return (
      <span
        className="status warn"
        title="距观测日期已超过4天；可能为休市、发布滞后或来源延迟"
      >
        较早数据
      </span>
    );
  return null;
}
const boardGroups = [
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

export function App() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getJson<DashboardData>("/api/dashboard"),
    refetchInterval: 300000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() =>
    readSaved("economic:favorites", [
      "csi300",
      "sp500",
      "hsi",
      "gold",
      "us10y",
    ]),
  );
  const [watchOnly, setWatchOnly] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showStatus, setShowStatus] = useState(false);
  const [redUp, setRedUp] = useState(() => readSaved("economic:red-up", true));
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    localStorage.setItem("economic:favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("economic:red-up", JSON.stringify(redUp));
  }, [redUp]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!selected) searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);
  const all: Summary[] =
    dashboard.data?.metrics ||
    catalog.map((m) => ({
      ...m,
      latest: null,
      previous: null,
      spark: [],
      count: 0,
      firstDate: null,
      lastAttempt: null,
      lastSuccess: null,
      error: null,
    }));
  const active = all.find((m) => m.id === selected);
  const ready = all.filter((m) => m.latest).length;
  const failures = all.filter((m) => m.error).length;
  const run = dashboard.data?.runs[0];
  const filtering = search.trim() !== "" || watchOnly;
  const visibleGroups = boardGroups
    .map((group) => {
      const candidates = all.filter((m) => group.groups.includes(m.group));
      const order = new Map(group.primary.map((id, i) => [id, i]));
      const filtered = candidates.filter(
        (m) =>
          (!watchOnly || favorites.includes(m.id)) &&
          `${m.name} ${m.code} ${m.id}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      );
      const shown = filtered.filter(
        (m) => filtering || expanded.includes(group.id) || order.has(m.id),
      );
      shown.sort((a, b) => (order.get(a.id) ?? 100) - (order.get(b.id) ?? 100));
      return {
        ...group,
        shown,
        extra: candidates.filter((m) => !order.has(m.id)).length,
      };
    })
    .filter((group) => group.shown.length);
  const toggleFavorite = (id: string) =>
    setFavorites((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  return (
    <div className={`app card-dashboard ${redUp ? "red-up" : "green-up"}`}>
      <header className="header">
        <a className="brand" href="/" aria-label="Economic Dashboard 首页">
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            economic<span className="brand-light"> / dashboard</span>
          </span>
        </a>
        <div className="header-right">
          <span className="header-date">
            {dateInZone(new Date(), "Asia/Shanghai")} <span>UTC+8</span>
          </span>
          <button
            className={`button ghost ${showStatus ? "active" : ""}`}
            onClick={() => setShowStatus(!showStatus)}
            aria-expanded={showStatus}
          >
            <Database size={14} />
            数据状态
            {failures > 0 && <span className="count-warn">{failures}</span>}
          </button>
          <button
            className="icon-button refresh-button"
            aria-label="刷新看板"
            title="刷新看板 · 读取已保存数据"
            aria-busy={dashboard.isFetching}
            disabled={dashboard.isFetching}
            onClick={() => void dashboard.refetch()}
          >
            <RefreshCw
              size={15}
              className={dashboard.isFetching ? "spin" : ""}
            />
          </button>
        </div>
      </header>
      <main>
        <section className="board-toolbar" aria-label="看板筛选">
          <h1>
            市场全景{" "}
            <span className="subtle">
              {ready}/{all.length}
            </span>
          </h1>
          <div className="board-controls">
            <label className="search">
              <Search size={15} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索市场 / 指标"
                aria-label="搜索市场或指标"
              />
              {search ? (
                <button
                  className="icon-button"
                  onClick={() => setSearch("")}
                  aria-label="清除搜索"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>
            <button
              className={`button ghost small ${watchOnly ? "active" : ""}`}
              onClick={() => setWatchOnly(!watchOnly)}
              aria-pressed={watchOnly}
            >
              <Star size={14} fill={watchOnly ? "currentColor" : "none"} />
              关注
            </button>
            <button
              className="icon-button"
              onClick={() => setRedUp(!redUp)}
              aria-label={redUp ? "切换为绿涨红跌" : "切换为红涨绿跌"}
              title={redUp ? "红涨绿跌" : "绿涨红跌"}
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </section>
        {dashboard.isError && (
          <div className="notice error" role="alert">
            <CircleAlert size={18} />
            <span>暂时无法读取数据：{dashboard.error.message}</span>
            <button className="button" onClick={() => void dashboard.refetch()}>
              重试
            </button>
          </div>
        )}
        {dashboard.isPending && (
          <p className="board-loading" role="status">
            正在读取市场档案…
          </p>
        )}
        {dashboard.data && !ready && (
          <div className="notice">
            <Database size={18} />
            <span>
              尚未采集数据。运行 pnpm collect 后即可查看真实行情与历史。
            </span>
          </div>
        )}
        {showStatus && (
          <section className="status-panel" aria-label="数据状态详情">
            <div className="section-head">
              <h2 className="inline-heading">
                数据管线{" "}
                <InfoTip
                  label="采集规则"
                  text="日频参考数据，非实时行情。Vercel 每日约08:00、Docker 每日08:00和18:30采集（UTC+8）。加密货币按UTC已结束日线保存，涨跌不是滚动24小时变化。超过4天仅提示数据较早，不推断休市。"
                />
              </h2>
              <button
                className="icon-button"
                onClick={() => setShowStatus(false)}
                aria-label="关闭数据状态"
              >
                <X size={16} />
              </button>
            </div>
            <div className="pipeline-summary">
              <span>
                历史观测{" "}
                <b>
                  {all.reduce((n, m) => n + m.count, 0).toLocaleString()} 条
                </b>
              </span>
              <span>
                存储{" "}
                <b>
                  {dashboard.data?.storage === "remote" ? "Turso" : "SQLite"}
                </b>
              </span>
              <span>
                最近采集 <b>{timeLabel(run?.finishedAt || run?.startedAt)}</b>
              </span>
            </div>
            {all
              .filter((m) => m.error)
              .map((m) => (
                <div className="error-row" key={m.id}>
                  <span>{m.name}</span>
                  <span>{m.error}</span>
                </div>
              ))}
          </section>
        )}
        <div className={`market-groups ${filtering ? "is-filtered" : ""}`}>
          {visibleGroups.map((group) => (
            <section
              key={group.id}
              className={`market-group group-${group.id}`}
              aria-labelledby={`group-${group.id}`}
            >
              <div className="group-heading">
                <h2 id={`group-${group.id}`}>
                  {group.name}
                  <span>{group.shown.length}</span>
                </h2>
                {!filtering && group.extra > 0 && (
                  <button
                    className="group-more"
                    aria-expanded={expanded.includes(group.id)}
                    onClick={() =>
                      setExpanded((old) =>
                        old.includes(group.id)
                          ? old.filter((x) => x !== group.id)
                          : [...old, group.id],
                      )
                    }
                  >
                    {expanded.includes(group.id)
                      ? "收起"
                      : `其他 ${group.extra}`}
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>
              <div className="metric-cards">
                {group.shown.map((m) => (
                  <MarketCard
                    key={m.id}
                    metric={m}
                    favorite={favorites.includes(m.id)}
                    onFavorite={() => toggleFavorite(m.id)}
                    onOpen={() => setSelected(m.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {!visibleGroups.length && (
          <div className="table-empty">
            <Search size={22} />
            <strong>
              {watchOnly ? "没有匹配的关注指标" : "没有匹配的指标"}
            </strong>
            <button
              className="button"
              onClick={() => {
                setSearch("");
                setWatchOnly(false);
              }}
            >
              重置筛选
            </button>
          </div>
        )}
        <footer className="footer">
          <span>
            <span className={`health-dot ${failures ? "warning" : ""}`} />
            {ready}/{all.length} 项有历史数据
            {failures ? ` · ${failures} 项采集异常` : ""}
          </span>
          <span>
            日频 · 最近采集 {timeLabel(run?.finishedAt || run?.startedAt)}
          </span>
        </footer>
      </main>
      {active && (
        <DetailDrawer
          metric={active}
          favorite={favorites.includes(active.id)}
          onFavorite={() => toggleFavorite(active.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function MarketCard({
  metric,
  favorite,
  onFavorite,
  onOpen,
}: {
  metric: Summary;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  const delta = change(
    metric.latest?.value,
    metric.previous?.value,
    metric.rate,
  );
  return (
    <article className={`market-card ${metric.error ? "has-error" : ""}`}>
      <button
        className="card-open"
        onClick={onOpen}
        aria-label={`查看${metric.name}详情`}
        aria-haspopup="dialog"
      >
        <span className="card-name">{metric.name}</span>
        <span className="card-quote">
          <strong>{formatValue(metric.latest?.value, metric.precision)}</strong>
          <small>{metric.unit}</small>
        </span>
        <span className="card-trend">
          <Delta value={delta} rate={metric.rate} />
          <Spark points={metric.spark} positive={(delta || 0) >= 0} />
        </span>
        <span className="card-meta">
          <span>
            {metric.latest?.date || "待采集"}
            {metric.group === "加密货币" ? " UTC" : ""}
          </span>
          <Status metric={metric} />
        </span>
      </button>
      <div className="card-actions">
        <InfoTip
          label={`${metric.name}来源与口径`}
          text={`${metric.source}\n${metric.note}`}
        />
        <button
          className={`icon-button favorite ${favorite ? "saved" : ""}`}
          aria-label={`${favorite ? "取消关注" : "关注"}${metric.name}`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Star size={12} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
function DetailDrawer({
  metric,
  favorite,
  onFavorite,
  onClose,
}: {
  metric: Summary;
  favorite: boolean;
  onFavorite: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="detail-drawer"
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          event.currentTarget.close();
      }}
    >
      <div className="drawer-toolbar">
        <span id="drawer-title">{metric.group} / 历史详情</span>
        <button
          autoFocus
          className="icon-button"
          aria-label="关闭详情"
          title="关闭详情 · Esc"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <div className="drawer-scroll">
        <Detail
          key={metric.id}
          metric={metric}
          favorite={favorite}
          onFavorite={onFavorite}
        />
      </div>
    </dialog>
  );
}

function Detail({
  metric,
  favorite,
  onFavorite,
}: {
  metric: Summary;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const [period, setPeriod] = useState("1Y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDates, setShowDates] = useState(false);
  const end = metric.latest?.date || dateInZone(new Date(), "UTC");
  let start = "1900-01-01";
  if (period !== "ALL") {
    const date = new Date(end + "T00:00:00Z");
    date.setUTCDate(
      date.getUTCDate() - ({ "1M": 30, "3M": 90, "1Y": 365 }[period] || 365),
    );
    start = date.toISOString().slice(0, 10);
  }
  const from = customFrom || start,
    to = customTo || end;
  const invalid = from > to;
  const query = new URLSearchParams({ from, to });
  const history = useQuery({
    queryKey: ["history", metric.id, from, to, metric.lastSuccess],
    queryFn: () => getJson<HistoryData>(`/api/history/${metric.id}?${query}`),
    enabled: !invalid,
  });
  const points = history.data?.points || [];
  const delta = change(
    metric.latest?.value,
    metric.previous?.value,
    metric.rate,
  );
  const rangeChange = change(
    points.at(-1)?.value,
    points[0]?.value,
    metric.rate,
  );
  const values = points.map((p) => p.value);
  const volumePoints = points.filter((p) => p.volume != null);
  return (
    <>
      <div className="detail-heading">
        <div>
          <h2>{metric.name}</h2>
          <span className="detail-category">
            <Globe2 size={13} />
            {metric.group}
            <span>/</span>
            {metric.code}
          </span>
        </div>
        <div className="detail-actions">
          <InfoTip
            label="数据来源与统计口径"
            text={`${metric.source}\n${metric.note}\n观测日：${metric.latest?.date || "待采集"} · 单位：${metric.unit}\n最近成功：${timeLabel(metric.lastSuccess)}\n历史始于：${metric.firstDate || "尚未采集"}`}
          />
          <a
            className="icon-button"
            href={metric.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="打开原始数据来源"
            title="打开原始数据来源"
          >
            <ExternalLink size={14} />
          </a>
          <button
            className={`icon-button favorite ${favorite ? "saved" : ""}`}
            aria-label={favorite ? "取消关注当前指标" : "关注当前指标"}
            aria-pressed={favorite}
            onClick={onFavorite}
          >
            <Star size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <div className="detail-value">
        <strong>{formatValue(metric.latest?.value, metric.precision)}</strong>
        <span>{metric.unit}</span>
      </div>
      <div className="detail-change">
        <Delta value={delta} rate={metric.rate} />
        <span>
          较前次观测{metric.previous ? ` · ${metric.previous.date}` : ""}
        </span>
      </div>
      <div className="period-toolbar">
        <div className="periods" role="group" aria-label="历史时间范围">
          {["1M", "3M", "1Y", "ALL"].map((p) => (
            <button
              key={p}
              className={
                period === p && !customFrom && !customTo ? "active" : ""
              }
              onClick={() => {
                setPeriod(p);
                setCustomFrom("");
                setCustomTo("");
              }}
            >
              {p === "ALL" ? "全部" : p}
            </button>
          ))}
        </div>
        <button
          className={`icon-button ${showDates ? "active" : ""}`}
          onClick={() => setShowDates(!showDates)}
          aria-label="自选日期"
          aria-expanded={showDates}
        >
          <SlidersHorizontal size={16} />
        </button>
        <a
          className={`icon-button ${invalid ? "disabled" : ""}`}
          href={
            invalid
              ? undefined
              : `/api/history/${metric.id}?${query}&format=csv`
          }
          aria-label="导出当前区间 CSV"
          title="导出当前区间 CSV"
        >
          <Download size={16} />
        </a>
      </div>
      {showDates && (
        <div className="date-controls">
          <label>
            开始日期
            <input
              type="date"
              aria-label="开始日期"
              value={customFrom || start}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              aria-label="结束日期"
              value={customTo || end}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {invalid ? (
        <div className="chart-empty error-text" role="alert">
          开始日期不能晚于结束日期
        </div>
      ) : history.isPending ? (
        <div className="chart-empty" role="status">
          正在加载历史曲线…
        </div>
      ) : history.isError ? (
        <div className="chart-empty">
          <span>{history.error.message}</span>
          <button className="button" onClick={() => void history.refetch()}>
            重试
          </button>
        </div>
      ) : (
        <HistoryChart
          points={points}
          precision={metric.precision}
          unit={metric.unit}
        />
      )}
      <div className="range-stats">
        <div>
          <span>区间变化</span>
          <Delta
            value={points.length > 1 ? rangeChange : null}
            rate={metric.rate}
          />
        </div>
        <div>
          <span>区间最高</span>
          <b>
            {formatValue(
              values.length ? Math.max(...values) : null,
              metric.precision,
            )}
          </b>
        </div>
        <div>
          <span>区间最低</span>
          <b>
            {formatValue(
              values.length ? Math.min(...values) : null,
              metric.precision,
            )}
          </b>
        </div>
      </div>
      {metric.marketActivity ||
      (metric.group !== "A股" && metric.latest?.volume != null) ? (
        <div className="volume-line">
          <span>
            {metric.marketActivity ? "市场成交量" : "源成交量"}{" "}
            <small>{metric.volumeUnit || "未核实"}</small>
            <InfoTip
              label="成交量统计口径"
              text={
                metric.marketActivity
                  ? `${metric.note}\n成交量与成交额分别记录，缺失股数不补零。`
                  : `单位：${metric.volumeUnit || "尚未核实"}。源成交量不视为全市场成交量。`
              }
            />
          </span>
          <b>{compact(metric.latest?.volume)}</b>
        </div>
      ) : null}
      {(metric.group !== "A股" || metric.marketActivity) &&
        metric.volumeUnit &&
        volumePoints.length >= 21 && (
          <div className="volume-line">
            <span>最新成交 / 前20次均量</span>
            <b>
              {formatValue(
                volumePoints.at(-1)!.volume! /
                  (volumePoints
                    .slice(-21, -1)
                    .reduce((n, p) => n + p.volume!, 0) /
                    20),
              )}
              ×
            </b>
          </div>
        )}
      <div className="detail-meta">
        <span>{metric.latest?.date || "待采集"}</span>
        <span>{metric.count.toLocaleString()} 条历史</span>
        <Status metric={metric} />
      </div>
      {metric.error && (
        <div className="source-error">
          <CircleAlert size={14} />
          {metric.error}
        </div>
      )}
      <details className="history-details">
        <summary>
          历史记录与修订{" "}
          <span>
            {points.length} 条<ChevronDown size={14} />
          </span>
        </summary>
        <div className="history-caption">
          最近20条{" "}
          <InfoTip
            label="历史记录说明"
            text={`展示区间内最近20条，完整记录可导出 CSV。累计历史始于 ${metric.firstDate || "尚未采集"}。`}
          />
        </div>
        <div className="history-rows">
          {points
            .slice(-20)
            .reverse()
            .map((p) => (
              <div key={p.date}>
                <span>{p.date}</span>
                <b>{formatValue(p.value, metric.precision)}</b>
                <span className="history-source">
                  {p.revisedAt ? "已修订" : null}
                  <InfoTip
                    label={`${p.date} 数据来源`}
                    text={`${p.source}\n首次采集：${timeLabel(p.fetchedAt)}${p.revisedAt ? `\n修订：${timeLabel(p.revisedAt)}` : ""}`}
                  />
                </span>
              </div>
            ))}
        </div>
        {!!history.data?.revisions.length && (
          <>
            <h3>最近修订（最多100条）</h3>
            {history.data.revisions.map((r, i) => (
              <div className="revision" key={`${r.changedAt}-${i}`}>
                {r.date}：{formatValue(r.oldValue, metric.precision)} →{" "}
                {formatValue(r.newValue, metric.precision)}
                <span>{timeLabel(r.changedAt)}</span>
              </div>
            ))}
          </>
        )}
      </details>
    </>
  );
}
