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
import { groups } from "../shared/catalog";
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
  return <span className="status muted">日频</span>;
}
export function App() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getJson<DashboardData>("/api/dashboard"),
    refetchInterval: 300000,
  });
  const [selected, setSelected] = useState("sp500");
  const [category, setCategory] = useState("全部市场");
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
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const data = dashboard.data;
  const all = data?.metrics || [];
  const active = all.find((m) => m.id === selected);
  const shown = all.filter(
    (m) =>
      (category === "全部市场" || m.group === category) &&
      (!watchOnly || favorites.includes(m.id)) &&
      `${m.name} ${m.code} ${m.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ready = all.filter((m) => m.latest).length;
  const failures = all.filter((m) => m.error).length;
  const delayed = all.filter(
    (m) => m.latest && freshness(m.latest.date) === "delayed",
  ).length;
  const run = data?.runs[0];
  const selectMetric = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 600px)").matches)
      requestAnimationFrame(() => {
        const detail = document.getElementById("metric-detail");
        detail?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
        detail?.focus({ preventScroll: true });
      });
  };
  const toggleFavorite = (id: string) =>
    setFavorites((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  return (
    <div className={`app ${redUp ? "red-up" : "green-up"}`}>
      <header className="header">
        <a className="brand" href="/" aria-label="Economic Dashboard 首页">
          <span className="brand-mark">
            <Activity size={23} />
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
            <Database size={15} />
            数据状态
            {failures > 0 && <span className="count-warn">{failures}</span>}
          </button>
        </div>
      </header>
      <main>
        <section className="page-intro">
          <div>
            <h1>
              全球市场<span className="title-separator">/</span>
              <span className="title-light">每日观察</span>
            </h1>
            <p>把市场的变化，放在同一张图景里。</p>
          </div>
          <div className="intro-actions">
            <span className="update-label">
              最近采集 <b>{timeLabel(run?.finishedAt || run?.startedAt)}</b>
            </span>
            <button
              className="button primary"
              onClick={() => {
                void dashboard.refetch();
              }}
              disabled={dashboard.isFetching}
              title="重新读取已保存的数据；数据采集由后台定时任务执行"
            >
              <RefreshCw
                size={15}
                className={dashboard.isFetching ? "spin" : ""}
              />
              刷新看板
            </button>
          </div>
        </section>
        {dashboard.isError && (
          <div className="notice error" role="alert">
            <CircleAlert size={18} />
            <div>
              <strong>暂时无法读取数据</strong>
              <p>{dashboard.error.message}</p>
            </div>
            <button className="button" onClick={() => void dashboard.refetch()}>
              重试
            </button>
          </div>
        )}
        {data && ready === 0 && (
          <div className="notice">
            <Database size={20} />
            <div>
              <strong>你的市场档案，从第一次采集开始</strong>
              <p>
                本地运行 <code>pnpm collect</code> 获取真实数据；Docker
                自动采集，Vercel 由每日任务更新。尚未获取的数值保留为空。
              </p>
            </div>
          </div>
        )}
        {showStatus && (
          <section className="status-panel" aria-label="数据状态详情">
            <div className="section-head">
              <h2>数据管线</h2>
              <button
                className="icon-button"
                onClick={() => setShowStatus(false)}
                aria-label="关闭数据状态"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pipeline-summary">
              <span>
                已存历史{" "}
                <b>
                  {ready}/{all.length}
                </b>
              </span>
              <span>
                存储{" "}
                <b>
                  {data?.storage === "remote"
                    ? "Turso 远程数据库"
                    : "本地 SQLite"}
                </b>
              </span>
              <span>
                历史观测{" "}
                <b>
                  {all.reduce((n, m) => n + m.count, 0).toLocaleString()} 条
                </b>
              </span>
            </div>
            <p className="muted">
              日频数据，非实时行情。日期以各市场的交易日或官方观测日为准；超过4天标为较早数据，不推断市场是否休市。
            </p>
            {run && (
              <p>
                最近任务：
                {run.status === "running"
                  ? "采集中；若长时间不变请检查服务日志"
                  : `${run.successes} 项成功 / ${run.failures} 项失败`}{" "}
                · {timeLabel(run.startedAt)}
              </p>
            )}
            {all
              .filter((m) => m.error)
              .map((m) => (
                <div className="error-row" key={m.id}>
                  <span>{m.name}</span>
                  <span>{m.error}</span>
                </div>
              ))}
            <p className="muted">
              刷新看板读取数据库，不会触发抓取。Vercel 每日约08:00、Docker
              每日08:00和18:30更新（UTC+8）。
            </p>
          </section>
        )}
        <section className="benchmarks" aria-label="核心指标">
          {["csi300", "sp500", "hsi", "gold", "us10y"].map((id) => {
            const m = all.find((x) => x.id === id);
            return (
              <button
                key={id}
                className={`benchmark ${selected === id ? "selected" : ""}`}
                onClick={() => selectMetric(id)}
                aria-pressed={selected === id}
              >
                <span className="benchmark-name">
                  {m?.name ||
                    {
                      csi300: "沪深300",
                      sp500: "标普500",
                      hsi: "恒生指数",
                      gold: "COMEX 黄金",
                      us10y: "美债 10 年收益率",
                    }[id]}
                  <span>{m?.rate ? "YIELD" : m?.group}</span>
                </span>
                <span className="benchmark-value">
                  {formatValue(m?.latest?.value, m?.precision)}
                  <small>{m?.rate ? "%" : ""}</small>
                </span>
                <span className="benchmark-bottom">
                  <Delta
                    value={change(
                      m?.latest?.value,
                      m?.previous?.value,
                      m?.rate,
                    )}
                    rate={m?.rate}
                  />
                  <span>{m?.latest?.date?.slice(5) || "等待数据"}</span>
                </span>
              </button>
            );
          })}
        </section>
        <div className="workspace">
          <section className="market-panel" aria-label="市场指标列表">
            <div className="section-head">
              <h2>
                市场全景{" "}
                <span className="subtle">
                  {shown.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <button
                className={`button ghost small ${watchOnly ? "active" : ""}`}
                onClick={() => setWatchOnly(!watchOnly)}
                aria-pressed={watchOnly}
              >
                <Star size={14} fill={watchOnly ? "currentColor" : "none"} />
                我的关注
              </button>
            </div>
            <nav className="tabs" aria-label="市场分类">
              {["全部市场", ...groups].map((group) => (
                <button
                  key={group}
                  className={category === group ? "active" : ""}
                  onClick={() => setCategory(group)}
                  aria-pressed={category === group}
                >
                  {group}
                </button>
              ))}
            </nav>
            <div className="table-tools">
              <label className="search">
                <Search size={16} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索指标或代码"
                  aria-label="搜索指标或代码"
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
                className="color-toggle"
                onClick={() => setRedUp(!redUp)}
                title="切换涨跌颜色"
              >
                <SlidersHorizontal size={13} />
                {redUp ? "红涨绿跌" : "绿涨红跌"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">关注</span>
                    </th>
                    <th>指标 / 代码</th>
                    <th>最新值</th>
                    <th>日变化</th>
                    <th className="trend-column">近31次观测</th>
                    <th className="date-column">数据日期</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const delta = change(
                      m.latest?.value,
                      m.previous?.value,
                      m.rate,
                    );
                    return (
                      <tr
                        key={m.id}
                        className={selected === m.id ? "selected" : ""}
                        onClick={() => selectMetric(m.id)}
                      >
                        <td>
                          <button
                            className={`favorite icon-button ${favorites.includes(m.id) ? "saved" : ""}`}
                            aria-label={`${favorites.includes(m.id) ? "取消关注" : "关注"}${m.name}`}
                            aria-pressed={favorites.includes(m.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(m.id);
                            }}
                          >
                            <Star
                              size={14}
                              fill={
                                favorites.includes(m.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </td>
                        <td>
                          <button
                            className="metric-name"
                            aria-pressed={selected === m.id}
                            onClick={() => selectMetric(m.id)}
                          >
                            {m.name}
                            <span>
                              {m.code}
                              <span className="mobile-date">
                                {" "}
                                · {m.latest?.date || "待采集"}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="numeric">
                          {formatValue(m.latest?.value, m.precision)}
                          {m.rate && m.latest && <small>%</small>}
                        </td>
                        <td>
                          <Delta value={delta} rate={m.rate} />
                        </td>
                        <td className="trend-column">
                          <Spark
                            points={m.spark}
                            positive={(delta || 0) >= 0}
                          />
                        </td>
                        <td className="date-column">
                          <span className="data-date">
                            {m.latest?.date?.slice(5) || "—"}
                          </span>
                          <Status metric={m} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dashboard.isPending && (
                <div className="table-empty" role="status">
                  <RefreshCw className="spin" size={20} />
                  正在读取市场档案…
                </div>
              )}
              {!dashboard.isPending && shown.length === 0 && (
                <div className="table-empty">
                  <Search size={22} />
                  <strong>
                    {watchOnly ? "没有符合条件的关注指标" : "没有匹配的指标"}
                  </strong>
                  <span>试试其他关键词或市场分类。</span>
                  <button
                    className="button"
                    onClick={() => {
                      setSearch("");
                      setCategory("全部市场");
                      setWatchOnly(false);
                    }}
                  >
                    重置筛选
                  </button>
                </div>
              )}
            </div>
            <div className="table-foot">
              <span>点击指标，查看历史与来源</span>
              <span>日变化：% / 利率：bp</span>
            </div>
          </section>
          <aside
            id="metric-detail"
            tabIndex={-1}
            className="detail-panel"
            aria-label="指标历史详情"
          >
            {active ? (
              <Detail
                key={active.id}
                metric={active}
                onFavorite={() => toggleFavorite(active.id)}
                favorite={favorites.includes(active.id)}
              />
            ) : (
              <div className="detail-placeholder">
                <Activity size={30} />
                <h2>每一次变化，都有迹可循。</h2>
                <p>选中一个指标，展开历史记录。</p>
              </div>
            )}
          </aside>
        </div>
        <footer className="footer">
          <span>
            <span className={`health-dot ${failures ? "warning" : ""}`} />
            {ready}/{all.length || 25} 项有历史数据
            {failures ? ` · ${failures} 项采集异常` : ""}
            {delayed ? ` · ${delayed} 项较早数据` : ""}
          </span>
          <span>
            来源可追溯 · 历史可回看
            <span className="footer-end">Economic Dashboard / v0.1</span>
          </span>
        </footer>
      </main>
    </div>
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
        <button
          className={`icon-button favorite ${favorite ? "saved" : ""}`}
          aria-label={favorite ? "取消关注当前指标" : "关注当前指标"}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Star size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
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
      <div className="volume-line">
        <span>
          源成交量 <small>{metric.volumeUnit || "单位 / 统计范围未核实"}</small>
        </span>
        <b>{compact(metric.latest?.volume)}</b>
      </div>
      {metric.volumeUnit && volumePoints.length >= 21 && (
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
      <div className="provenance">
        <div className="source-heading">
          <span>
            <Database size={13} />
            数据来源
          </span>
          <a href={metric.sourceUrl} target="_blank" rel="noreferrer">
            {metric.source}
            <ExternalLink size={12} />
          </a>
        </div>
        <p>{metric.note}</p>
        <div className="source-meta">
          <span>
            观测日 <b>{metric.latest?.date || "—"}</b>
          </span>
          <span>
            留存 <b>{metric.count.toLocaleString()} 条</b>
          </span>
        </div>
        <div className="source-meta">
          <span>
            最近成功 <b>{timeLabel(metric.lastSuccess)}</b>
          </span>
        </div>
        {metric.error && (
          <div className="source-error">
            <CircleAlert size={14} />
            {metric.error}；已有历史仍可查看。
          </div>
        )}
      </div>
      <details className="history-details">
        <summary>
          历史记录与修订{" "}
          <span>
            {points.length} 条<ChevronDown size={14} />
          </span>
        </summary>
        <p className="muted">
          展示区间内最近20条；完整记录可导出 CSV。累计历史始于{" "}
          {metric.firstDate || "尚未采集"}。
        </p>
        <div className="history-rows">
          {points
            .slice(-20)
            .reverse()
            .map((p) => (
              <div key={p.date}>
                <span>{p.date}</span>
                <b>{formatValue(p.value, metric.precision)}</b>
                <span title={p.source}>
                  {p.revisedAt ? "已修订" : p.source}
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
