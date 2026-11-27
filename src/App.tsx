import { t, useLocale, setLocale, getLocale } from "./i18n";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Plus,
  Pencil,
  Check,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Trash2,
  Database,
  Download,
  ExternalLink,
  Globe2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Settings,
  Languages,
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
import { displayedQuote, displayedChange, supportsQuote, type QuotesData } from "../shared/quotes";
import { HistoryChart, Spark } from "./Chart";
import { InfoTip } from "./InfoTip";
import {
  boardGroups,
  defaultLayout,
  normalizeLayout,
  placeCard,
  layoutKey,
  boardKey,
  normalizePreferences,
  placeGroup,
  type BoardPreferences,
  type BoardLayout,
} from "./board-layout";
import { useBoardDrag } from "./useBoardDrag";
import { AddCardDialog } from "./BoardEditor";
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
    ? new Intl.DateTimeFormat(getLocale(), {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : t("尚未采集");
}
function quoteWarning(metric: Summary) {
  if (!metric.quoteState) return null;
  if (metric.quoteState.error) return t(metric.quoteState.error);
  const checked = metric.quoteState.checkedAt;
  if (!checked || Date.now() - Date.parse(checked) > 180000)
    return t("报价待刷新");
  return null;
}
function quoteNote(metric: Summary) {
  if (!supportsQuote(metric)) return "";
  const quote = displayedQuote(metric);
  const warning = quoteWarning(metric);
  return "\n" + (quote
    ? t("当前报价：{0} · 北京时间（UTC+8）\n报价来源：{1}\n涨跌相对来源前收盘价；加密货币不代表滚动24小时涨跌。\n页面可见时每60秒检查报价，来源可能延迟；迷你图与详情曲线仍为已完成日线。",
        timeLabel(quote.asOf), t(quote.source))
    : t("暂未取得可用报价，当前显示已保存日线。")) +
    (warning ? "\n" + warning : "");
}
function compact(value: number | null | undefined) {
  if (getLocale() === "en-US" && value != null)
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
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
      <span className="status warn" title={t(metric.error)}>
        {t("采集异常")}
      </span>
    );
  if (!metric.latest)
    return <span className="status muted">{t("待采集")}</span>;
  if (freshness(metric.latest.date) === "delayed")
    return (
      <span
        className="status warn"
        title={t("距观测日期已超过4天；可能为休市、发布滞后或来源延迟")}
      >
        {t("较早数据")}
      </span>
    );
  return null;
}
export function App() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "en"
        ? "Economic Dashboard"
        : "Economic Dashboard · 经济数据看板";
  }, [locale]);
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
  const [layout, setLayout] = useState(() =>
    normalizeLayout(
      readSaved<{
        layout?: unknown;
      }>(boardKey, {}).layout ?? readSaved(layoutKey, null),
    ),
  );
  const [draft, setDraft] = useState<BoardLayout | null>(null);
  const [addGroup, setAddGroup] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() =>
    normalizePreferences(
      readSaved<{
        preferences?: unknown;
      }>(boardKey, {}).preferences,
    ),
  );
  const [draftPreferences, setDraftPreferences] =
    useState<BoardPreferences | null>(null);
  const currentPreferences = draftPreferences || preferences;
  const [layoutError, setLayoutError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const editing = draft !== null;
  const currentLayout = draft || layout;
  const startEditing = () => {
    setDraft(layout);
    setDraftPreferences(preferences);
    setSearch("");
    setWatchOnly(false);
    setLayoutError("");
  };
  const saveLayout = () => {
    if (!draft) return;
    try {
      localStorage.setItem(
        boardKey,
        JSON.stringify({ layout: draft, preferences: currentPreferences }),
      );
      setPreferences(currentPreferences);
      setDraftPreferences(null);
      setLayout(draft);
      setDraft(null);
      setLayoutError("");
      setAnnouncement("看板布局已保存");
    } catch {
      setLayoutError(
        "无法保存到此浏览器，请允许本地存储后重试。当前修改仍保留。 ",
      );
    }
  };
  const moveCard = (id: string, group: string, position: number) => {
    setDraft((old) => (old ? placeCard(old, id, group, position) : old));
    setAnnouncement(`${catalog.find((m) => m.id === id)?.name}已移动`);
  };
  const changeWidth = (width: number) => {
    const next = { ...currentPreferences, width };
    if (editing) setDraftPreferences(next);
    else {
      try {
        localStorage.setItem(
          boardKey,
          JSON.stringify({ layout, preferences: next }),
        );
        setPreferences(next);
        setLayoutError("");
      } catch {
        setLayoutError("无法保存卡片宽度，请允许本地存储后重试。");
      }
    }
  };
  const drag = useBoardDrag(
    (moving, x, y) => {
      const element = document.elementFromPoint(x, y);
      const groupElement = element?.closest<HTMLElement>(
        ".market-groups [data-group]",
      );
      if (!groupElement) return;
      const targetGroup = groupElement.dataset.group!;
      if (moving.kind === "group") {
        if (moving.id === targetGroup) return;
        const rect = groupElement.getBoundingClientRect();
        const newRow = y > rect.bottom - 24;
        const after = newRow || x > rect.left + rect.width / 2;
        setDraftPreferences((old) =>
          old ? placeGroup(old, moving.id, targetGroup, after, newRow) : old,
        );
      } else {
        const card = element?.closest<HTMLElement>("[data-card]");
        if (card?.dataset.card === moving.id) return;
        const ids = currentLayout[targetGroup].filter((id) => id !== moving.id);
        let position = ids.length;
        if (card) {
          const rect = card.getBoundingClientRect();
          position =
            ids.indexOf(card.dataset.card!) +
            Number(x > rect.left + rect.width / 2);
        }
        setDraft((old) =>
          old ? placeCard(old, moving.id, targetGroup, position) : old,
        );
      }
    },
    () => {
      setDraft(currentLayout);
      setDraftPreferences(currentPreferences);
    },
  );
  const shiftGroup = (id: string, delta: number) => {
    const index = currentPreferences.order.indexOf(id);
    const target = currentPreferences.order[index + delta];
    if (target)
      setDraftPreferences(
        placeGroup(currentPreferences, id, target, delta > 0),
      );
  };
  const [showStatus, setShowStatus] = useState(false);
  const [redUp, setRedUp] = useState(() => readSaved("economic:red-up", true));
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = () => settingsRef.current?.hidePopover();
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
        if (!selected && !addGroup && !editing) {
          settingsRef.current?.showPopover();
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, addGroup, editing]);
  const rawMetrics: Summary[] =
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
  const quoteIds = [...new Set([...Object.values(currentLayout).flat(), ...(selected ? [selected] : [])])]
    .filter(id => rawMetrics.some(m => m.id === id && supportsQuote(m))).sort();
  const quotes = useQuery({
    queryKey: ["quotes", quoteIds],
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < quoteIds.length; i += 50) {
        const params = new URLSearchParams({ ids: quoteIds.slice(i, i + 50).join(",") });
        batches.push(getJson<QuotesData>(`/api/quotes?${params}`));
      }
      const results = await Promise.all(batches);
      return { quotes: Object.assign({}, ...results.map(result => result.quotes)) } as QuotesData;
    },
    enabled: !!dashboard.data && quoteIds.length > 0,
    staleTime: 50000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const refreshing = dashboard.isFetching || quotes.isFetching;
  const refresh = () => {
    void dashboard.refetch();
    if (quoteIds.length) void quotes.refetch();
  };
  const quoteUpdatedAt = Object.values(quotes.data?.quotes || {})
    .map(state => state.quote?.fetchedAt || "").sort().at(-1);
  const all = rawMetrics.map((metric) => ({
    ...metric,
    quoteState: quotes.isError && supportsQuote(metric)
      ? { quote: quotes.data?.quotes[metric.id]?.quote || null,
          checkedAt: quotes.data?.quotes[metric.id]?.checkedAt || null,
          error: "报价更新失败，保留上次数据" }
      : quotes.data?.quotes[metric.id],
    searchTerms: `${metric.name} ${metric.englishName || ""} ${t(metric.name)}`,
    name: locale === "en" ? metric.englishName || t(metric.name) : metric.name,
    source: t(metric.source),
    note: t(metric.note),
    unit: t(metric.unit),
    volumeUnit: metric.volumeUnit ? t(metric.volumeUnit) : undefined,
  }));
  const active = all.find((m) => m.id === selected);
  const ready = all.filter((m) => m.latest).length;
  const failures = all.filter((m) => m.error).length;
  const run = dashboard.data?.runs[0];
  const filtering = !editing && (search.trim() !== "" || watchOnly);
  const visibleGroups = currentPreferences.order
    .map((id) => boardGroups.find((g) => g.id === id)!)
    .map((group) => ({
      ...group,
      shown: currentLayout[group.id]
        .map((id) => all.find((m) => m.id === id)!)
        .filter(Boolean)
        .filter(
          (m) =>
            editing ||
            ((!watchOnly || favorites.includes(m.id)) &&
              `${m.name} ${m.code} ${m.id} ${m.symbol} ${m.searchTerms || ""}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())),
        ),
    }))
    .filter((group) => editing || group.shown.length);
  const toggleFavorite = (id: string) =>
    setFavorites((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  return (
    <div
      className={`app card-dashboard ${redUp ? "red-up" : "green-up"}`}
      style={
        { "--card-width": `${currentPreferences.width}px` } as CSSProperties
      }
    >
      <header className="header">
        <a className="brand" href="/" aria-label={t("Economic Dashboard 首页")}>
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            economic<span className="brand-light"> / dashboard</span>
          </span>
        </a>
        <div className="header-right">
          <button
            className={`icon-button settings-button ${settingsOpen || filtering ? "active" : ""}`}
            aria-label={t("看板设置")}
            title={t("看板设置")}
            aria-expanded={settingsOpen}
            aria-controls="board-settings"
            popoverTarget="board-settings"
          >
            <Settings size={17} />
          </button>
          <button
            className="icon-button settings-button language-button"
            aria-label={locale === "zh-CN" ? "Switch to English" : "切换为中文"}
            title={locale === "zh-CN" ? "Switch to English" : "切换为中文"}
            onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
          >
            <Languages size={17} />
          </button>
          <button
            className="icon-button refresh-button"
            aria-label={t("刷新看板")}
            title={t("刷新报价与看板 · 报价缓存60秒")}
            aria-busy={refreshing}
            disabled={refreshing}
            onClick={refresh}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "spin" : ""}
            />
          </button>
        </div>
      </header>
      <div
        id="board-settings"
        ref={settingsRef}
        popover="auto"
        className="settings-popover"
        onToggle={(event) => setSettingsOpen(event.newState === "open")}
      >
        <div className="settings-heading">
          <strong>{t("看板设置")}</strong>
          <button
            className="icon-button"
            aria-label={t("关闭看板设置")}
            onClick={closeSettings}
          >
            <X size={16} />
          </button>
        </div>
        <div className="settings-controls">
          <label className="search">
            <Search size={15} />
            <input
              disabled={editing}
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("搜索市场 / 指标")}
              aria-label={t("搜索市场或指标")}
            />
            {search ? (
              <button
                className="icon-button"
                onClick={() => setSearch("")}
                aria-label={t("清除搜索")}
              >
                <X size={14} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </label>
          <button
            className={`button ghost small ${watchOnly ? "active" : ""}`}
            disabled={editing}
            onClick={() => setWatchOnly(!watchOnly)}
            aria-pressed={watchOnly}
          >
            <Star size={14} fill={watchOnly ? "currentColor" : "none"} />
            {t("仅显示关注")}
          </button>
          {!editing && (
            <>
              <button
                className="button ghost small"
                onClick={() => {
                  closeSettings();
                  startEditing();
                  setAddGroup("auto");
                }}
              >
                <Plus size={14} />
                {t("新增")}
              </button>
              <button
                className="button ghost small"
                aria-label={t("编辑看板")}
                title={t("编辑看板")}
                onClick={() => {
                  closeSettings();
                  startEditing();
                }}
              >
                <Pencil size={15} />
                {t("编辑布局")}
              </button>
            </>
          )}
          <button
            className="button ghost small"
            onClick={() => setRedUp(!redUp)}
            aria-label={redUp ? t("切换为绿涨红跌") : t("切换为红涨绿跌")}
            title={redUp ? t("红涨绿跌") : t("绿涨红跌")}
          >
            <SlidersHorizontal size={15} />
            {redUp ? t("红涨绿跌") : t("绿涨红跌")}
          </button>
        </div>
        <label className="card-width-setting">
          <span>
            {t("卡片宽度")}
            <output>{currentPreferences.width} px</output>
          </span>
          <input
            type="range"
            min="160"
            max="300"
            step="10"
            value={currentPreferences.width}
            aria-label={t("卡片宽度")}
            onChange={(event) => changeWidth(Number(event.target.value))}
          />
        </label>
        <button
          className={`button ghost ${showStatus ? "active" : ""}`}
          onClick={() => {
            setShowStatus(!showStatus);
            closeSettings();
          }}
          aria-expanded={showStatus}
        >
          <Database size={14} />
          {t("数据状态")}
          {failures > 0 && <span className="count-warn">{failures}</span>}
        </button>
      </div>
      <main>
        {filtering && (
          <div className="filter-summary">
            {search && t("搜索：{0}", search)} {watchOnly && t("仅关注")}
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {t(announcement)}
        </span>
        {editing && (
          <div className="board-editbar">
            <span>
              {t("编辑看板")}{" "}
              <small>
                {t("拖动卡片或组标题排序 · 拖到组底部换行 · Esc 撤销拖动")}
              </small>
            </span>
            <div className="editbar-actions">
              <button
                className="button ghost small"
                onClick={() => {
                  setDraft(defaultLayout());
                  setDraftPreferences(normalizePreferences(null));
                  setAnnouncement(t("已恢复默认布局，保存后生效"));
                }}
              >
                <RotateCcw size={14} />
                {t("恢复默认")}
              </button>
              <button
                className="button ghost small"
                onClick={() => {
                  setDraft(null);
                  setDraftPreferences(null);
                  setLayoutError("");
                }}
              >
                {t("取消")}
              </button>
              <button className="button primary small" onClick={saveLayout}>
                <Check size={14} />
                {t("保存")}
              </button>
            </div>
          </div>
        )}
        {layoutError && (
          <div className="notice error" role="alert">
            {t(layoutError)}
          </div>
        )}
        {dashboard.isError && (
          <div className="notice error" role="alert">
            <CircleAlert size={18} />
            <span>
              {t("暂时无法读取数据：")}
              {t(dashboard.error.message)}
            </span>
            <button className="button" onClick={refresh}>
              {t("重试")}
            </button>
          </div>
        )}
        {dashboard.isPending && (
          <p className="board-loading" role="status">
            {t("正在读取市场档案…")}
          </p>
        )}
        {dashboard.data && !ready && (
          <div className="notice">
            <Database size={18} />
            <span>
              {t("尚无日线历史。可用报价会自动更新，历史数据需要每日采集。")}
            </span>
          </div>
        )}
        {showStatus && (
          <section className="status-panel" aria-label={t("数据状态详情")}>
            <div className="section-head">
              <h2 className="inline-heading">
                {t("数据管线")}{" "}
                <InfoTip
                  label={t("采集规则")}
                  text={t(
                    "页面可见时每60秒检查行情报价，来源可能延迟。历史曲线为已完成日线，Vercel每日约08:00、Docker每日08:00和18:30采集（UTC+8）。利率和全市场成交额按来源发布频率更新。",
                  )}
                />
              </h2>
              <button
                className="icon-button"
                onClick={() => setShowStatus(false)}
                aria-label={t("关闭数据状态")}
              >
                <X size={16} />
              </button>
            </div>
            <div className="pipeline-summary">
              <span>
                {t("历史观测")}{" "}
                <b>
                  {all.reduce((n, m) => n + m.count, 0).toLocaleString()}
                  {t("条")}
                </b>
              </span>
              <span>
                {t("存储")}{" "}
                <b>
                  {dashboard.data?.storage === "remote" ? "Turso" : "SQLite"}
                </b>
              </span>
              <span>
                {t("最近采集")}
                <b>{timeLabel(run?.finishedAt || run?.startedAt)}</b>
              </span>
            </div>
            {all
              .filter((m) => m.error)
              .map((m) => (
                <div className="error-row" key={m.id}>
                  <span>{m.name}</span>
                  <span>{t(m.error || "")}</span>
                </div>
              ))}
          </section>
        )}
        <div
          className={`market-groups ${filtering ? "is-filtered" : ""} ${editing ? "is-editing" : ""} ${drag.active?.kind === "group" ? "sorting-groups" : ""}`}
        >
          {visibleGroups.map((group, groupIndex) => (
            <Fragment key={group.id}>
              {groupIndex > 0 &&
                currentPreferences.rowStarts.includes(group.id) && (
                  <div className="group-row-break" aria-hidden="true" />
                )}
              <section
                data-group={group.id}
                style={
                  {
                    "--group-width": `${Math.max(1, group.shown.length) * currentPreferences.width + Math.max(0, group.shown.length - 1) * 8}px`,
                  } as CSSProperties
                }
                className={`market-group group-${group.id} ${drag.active?.kind === "group" && drag.active.id === group.id ? "sort-placeholder" : ""}`}
                aria-labelledby={`group-${group.id}`}
              >
                <div
                  className="group-heading"
                  onPointerDown={(event) => {
                    if (
                      !editing ||
                      (event.target as HTMLElement).closest(
                        ".group-edit-actions",
                      )
                    )
                      return;
                    drag.start(event, { kind: "group", id: group.id });
                  }}
                >
                  <h2 id={`group-${group.id}`}>
                    {editing && (
                      <button
                        className="icon-button group-drag-handle"
                        aria-label={t("拖动{0}分组", group.name)}
                        title={t("拖动整组；也可用右侧箭头排序")}
                      >
                        <GripVertical size={16} />
                      </button>
                    )}
                    {t(group.name)}
                    <span>{group.shown.length}</span>
                  </h2>
                  {editing && (
                    <div className="group-edit-actions">
                      <button
                        className="icon-button"
                        aria-label={t("前移{0}分组", group.name)}
                        disabled={groupIndex === 0}
                        onClick={() => shiftGroup(group.id, -1)}
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={t("后移{0}分组", group.name)}
                        disabled={groupIndex === visibleGroups.length - 1}
                        onClick={() => shiftGroup(group.id, 1)}
                      >
                        <ArrowRight size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={t(
                          "{0}{1}分组",
                          currentPreferences.rowStarts.includes(group.id)
                            ? t("合并")
                            : t("换行"),
                          group.name,
                        )}
                        title={
                          currentPreferences.rowStarts.includes(group.id)
                            ? t("允许与前组同行")
                            : t("移到下一行")
                        }
                        aria-pressed={currentPreferences.rowStarts.includes(
                          group.id,
                        )}
                        onClick={() =>
                          setDraftPreferences({
                            ...currentPreferences,
                            rowStarts: currentPreferences.rowStarts.includes(
                              group.id,
                            )
                              ? currentPreferences.rowStarts.filter(
                                  (id) => id !== group.id,
                                )
                              : [...currentPreferences.rowStarts, group.id],
                          })
                        }
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="group-more"
                        aria-label={t("向{0}添加卡片", group.name)}
                        onClick={() => setAddGroup(group.id)}
                      >
                        <Plus size={14} />
                        {t("添加")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="metric-cards">
                  {group.shown.map((m, index) => (
                    <MarketCard
                      key={m.id}
                      metric={m}
                      favorite={favorites.includes(m.id)}
                      onFavorite={() => toggleFavorite(m.id)}
                      onOpen={() => setSelected(m.id)}
                      editor={
                        editing
                          ? {
                              dragging:
                                drag.active?.kind === "card" &&
                                drag.active.id === m.id,
                              onPointerDown: (event) =>
                                drag.start(event, { kind: "card", id: m.id }),
                              onPrevious:
                                index > 0
                                  ? () => moveCard(m.id, group.id, index - 1)
                                  : undefined,
                              onNext:
                                index < group.shown.length - 1
                                  ? () => moveCard(m.id, group.id, index + 1)
                                  : undefined,
                              onRemove: () => {
                                setDraft((old) =>
                                  old
                                    ? {
                                        ...old,
                                        [group.id]: old[group.id].filter(
                                          (id) => id !== m.id,
                                        ),
                                      }
                                    : old,
                                );
                                setAnnouncement(t("已移除{0}", m.name));
                              },
                            }
                          : undefined
                      }
                    />
                  ))}
                  {editing && !group.shown.length && (
                    <button
                      className="empty-group"
                      onClick={() => setAddGroup(group.id)}
                    >
                      <Plus size={16} />
                      {t("添加卡片或拖到这里")}
                    </button>
                  )}
                </div>
                {drag.active?.kind === "group" && (
                  <div className="group-row-target" aria-hidden="true">
                    {t("拖到这里，另起一行")}
                  </div>
                )}
              </section>
            </Fragment>
          ))}
        </div>
        {!visibleGroups.length && (
          <div className="table-empty">
            <Search size={22} />
            <strong>
              {filtering
                ? watchOnly
                  ? t("没有匹配的关注指标")
                  : t("没有匹配的指标")
                : t("看板还没有卡片")}
            </strong>
            <button
              className="button"
              onClick={() => {
                if (!filtering) {
                  startEditing();
                  setAddGroup("auto");
                } else {
                  setSearch("");
                  setWatchOnly(false);
                }
              }}
            >
              {filtering ? t("重置筛选") : t("添加卡片")}
            </button>
          </div>
        )}
        <div
          className="update-watermark"
          title={t(
            "最近取得报价或完成日线采集的时间 · 北京时间（UTC+8）；实际报价时刻见卡片 tooltip",
          )}
        >
          {t("更新于")}
          {timeLabel([quoteUpdatedAt, run?.finishedAt].filter(Boolean).sort().at(-1))}
        </div>
      </main>
      {addGroup && draft && (
        <AddCardDialog
          groupId={addGroup}
          layout={draft}
          metrics={all}
          onAdd={(id, group) => {
            setDraft((old) =>
              old ? placeCard(old, id, group, old[group].length) : old,
            );
            setAnnouncement(t("卡片已添加到草稿"));
          }}
          onTrack={async (symbol, group) => {
            const response = await fetch("/api/stocks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ symbol }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || "添加个股失败");
            const result = await dashboard.refetch();
            if (result.isError)
              throw new Error(t("历史已保存，但看板刷新失败，请重试添加"));
            setDraft((old) =>
              old
                ? placeCard(old, body.metric.id, group, old[group].length)
                : old,
            );
            setAnnouncement(t("{0}已加入看板草稿", symbol));
          }}
          onClose={() => setAddGroup(null)}
        />
      )}
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
  editor,
}: {
  metric: Summary;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  editor?: {
    dragging: boolean;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPrevious?: () => void;
    onNext?: () => void;
    onRemove: () => void;
  };
}) {
  const quote = displayedQuote(metric);
  const delta = displayedChange(metric);
  return (
    <article
      className={`market-card ${metric.error ? "has-error" : ""} ${editor ? "editable" : ""} ${editor?.dragging ? "sort-placeholder" : ""}`}
      data-card={metric.id}
      onPointerDown={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (button && !button.classList.contains("card-open")) return;
        editor?.onPointerDown(event);
      }}
    >
      {editor && (
        <div className="card-editor">
          <span
            className="drag-handle"
            title={t("拖动排序")}
            aria-hidden="true"
          >
            <GripVertical size={16} />
          </span>
          <button
            className="icon-button"
            aria-label={t("前移{0}", metric.name)}
            disabled={!editor.onPrevious}
            onClick={editor.onPrevious}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            className="icon-button"
            aria-label={t("后移{0}", metric.name)}
            disabled={!editor.onNext}
            onClick={editor.onNext}
          >
            <ArrowRight size={14} />
          </button>
          <button
            className="icon-button remove-card"
            aria-label={t("移除{0}", metric.name)}
            onClick={editor.onRemove}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <button
        className="card-open"
        onClick={editor ? undefined : onOpen}
        aria-label={t("查看{0}详情", metric.name)}
        aria-haspopup="dialog"
      >
        <span className="card-name">{metric.name}</span>
        <span className="card-quote">
          <strong>{formatValue(quote?.value ?? metric.latest?.value, metric.precision)}</strong>
          <small>{metric.unit}</small>
        </span>
        <span className="card-trend">
          <Delta value={delta} rate={metric.rate} />
          <Spark points={metric.spark} positive={(delta || 0) >= 0} />
        </span>
        {quoteWarning(metric) ? (
          <span className="card-meta"><span className="status warn" title={quoteWarning(metric)!}>{t("报价待更新")}</span></span>
        ) : !quote && (metric.error || !metric.latest || freshness(metric.latest.date) === "delayed") ? (
          <span className="card-meta"><Status metric={metric} /></span>
        ) : null}
      </button>
      <div className="card-actions">
        <InfoTip
          label={t("{0}日期、来源与口径", metric.name)}
          text={t(
            "观测日期：{0}{1}\n{2}\n{3}",
            metric.latest?.date || t("待采集"),
            metric.group === "加密货币" ? " UTC" : "",
            metric.source,
            metric.note,
          ) + quoteNote(metric)}
        />
        <button
          className={`icon-button favorite ${favorite ? "saved" : ""}`}
          aria-label={`${favorite ? t("取消关注") : t("关注")}${metric.name}`}
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
        <span id="drawer-title">
          {t(metric.group)}
          {t("/ 历史详情")}
        </span>
        <button
          autoFocus
          className="icon-button"
          aria-label={t("关闭详情")}
          title={t("关闭详情 · Esc")}
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
  const quote = displayedQuote(metric);
  const delta = displayedChange(metric);
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
            {t(metric.group)}
            <span>/</span>
            {metric.code}
          </span>
        </div>
        <div className="detail-actions">
          <InfoTip
            label={t("数据来源与统计口径")}
            text={t(
              "{0}\n{1}\n观测日：{2} · 单位：{3}\n最近成功：{4}\n历史始于：{5}",
              metric.source,
              metric.note,
              metric.latest?.date || t("待采集"),
              metric.unit,
              timeLabel(metric.lastSuccess),
              metric.firstDate || "尚未采集",
            ) + quoteNote(metric)}
          />
          <a
            className="icon-button"
            href={metric.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("打开原始数据来源")}
            title={t("打开原始数据来源")}
          >
            <ExternalLink size={14} />
          </a>
          <button
            className={`icon-button favorite ${favorite ? "saved" : ""}`}
            aria-label={favorite ? t("取消关注当前指标") : t("关注当前指标")}
            aria-pressed={favorite}
            onClick={onFavorite}
          >
            <Star size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <div className="detail-value">
        <strong>{formatValue(quote?.value ?? metric.latest?.value, metric.precision)}</strong>
        <span>{metric.unit}</span>
      </div>
      <div className="detail-change">
        <Delta value={delta} rate={metric.rate} />
        <span>
          {quote ? t("较前收盘价 · 当前报价") : t("较前次观测")}
          {!quote && metric.previous ? ` · ${metric.previous.date}` : ""}
        </span>
      </div>
      <div className="period-toolbar">
        <div className="periods" role="group" aria-label={t("历史时间范围")}>
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
              {p === "ALL" ? t("全部") : p}
            </button>
          ))}
        </div>
        <button
          className={`icon-button ${showDates ? "active" : ""}`}
          onClick={() => setShowDates(!showDates)}
          aria-label={t("自选日期")}
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
          aria-label={t("导出当前区间 CSV")}
          title={t("导出当前区间 CSV")}
        >
          <Download size={16} />
        </a>
      </div>
      {showDates && (
        <div className="date-controls">
          <label>
            {t("开始日期")}
            <input
              type="date"
              aria-label={t("开始日期")}
              value={customFrom || start}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label>
            {t("结束日期")}
            <input
              type="date"
              aria-label={t("结束日期")}
              value={customTo || end}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {invalid ? (
        <div className="chart-empty error-text" role="alert">
          {t("开始日期不能晚于结束日期")}
        </div>
      ) : history.isPending ? (
        <div className="chart-empty" role="status">
          {t("正在加载历史曲线…")}
        </div>
      ) : history.isError ? (
        <div className="chart-empty">
          <span>{t(history.error.message)}</span>
          <button className="button" onClick={() => void history.refetch()}>
            {t("重试")}
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
          <span>{t("区间变化")}</span>
          <Delta
            value={points.length > 1 ? rangeChange : null}
            rate={metric.rate}
          />
        </div>
        <div>
          <span>{t("区间最高")}</span>
          <b>
            {formatValue(
              values.length ? Math.max(...values) : null,
              metric.precision,
            )}
          </b>
        </div>
        <div>
          <span>{t("区间最低")}</span>
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
            {metric.marketActivity ? t("市场成交量") : t("源成交量")}{" "}
            <small>{metric.volumeUnit || t("未核实")}</small>
            <InfoTip
              label={t("成交量统计口径")}
              text={
                metric.marketActivity
                  ? t(
                      "{0}\n成交量与成交额分别记录，缺失股数不补零。",
                      metric.note,
                    )
                  : t(
                      "单位：{0}。源成交量不视为全市场成交量。",
                      metric.volumeUnit || "尚未核实",
                    )
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
            <span>{t("最新成交 / 前20次均量")}</span>
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
        <span>{metric.latest?.date || t("待采集")}</span>
        <span>
          {metric.count.toLocaleString()}
          {t("条历史")}
        </span>
        <Status metric={metric} />
      </div>
      {metric.error && (
        <div className="source-error">
          <CircleAlert size={14} />
          {t(metric.error)}
        </div>
      )}
      <details className="history-details">
        <summary>
          {t("历史记录与修订")}{" "}
          <span>
            {points.length}
            {t("条")}
            <ChevronDown size={14} />
          </span>
        </summary>
        <div className="history-caption">
          {t("最近20条")}{" "}
          <InfoTip
            label={t("历史记录说明")}
            text={t(
              "展示区间内最近20条，完整记录可导出 CSV。累计历史始于 {0}。",
              metric.firstDate || "尚未采集",
            ) + quoteNote(metric)}
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
                  {p.revisedAt ? t("已修订") : null}
                  <InfoTip
                    label={t("{0} 数据来源", p.date)}
                    text={t(
                      "{0}\n首次采集：{1}{2}",
                      p.source,
                      timeLabel(p.fetchedAt),
                      p.revisedAt
                        ? t("\n修订：{0}", timeLabel(p.revisedAt))
                        : "",
                    )}
                  />
                </span>
              </div>
            ))}
        </div>
        {!!history.data?.revisions.length && (
          <>
            <h3>{t("最近修订（最多100条）")}</h3>
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
