import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { StockCandidate, Summary, SearchMarket } from "../shared/model";
import { boardGroups, type BoardLayout } from "./board-layout";
export function AddCardDialog({
  groupId,
  layout,
  metrics,
  onAdd,
  onTrack,
  onClose,
}: {
  groupId: string;
  layout: BoardLayout;
  metrics: Summary[];
  onAdd: (id: string, group: string) => void;
  onTrack: (symbol: string, group: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<SearchMarket>("all");
  const markets: {
    id: SearchMarket;
    label: string;
    group?: string;
  }[] = [
    { id: "all", label: "全部" },
    { id: "a", label: "A 股", group: "A股" },
    { id: "hk", label: "港股", group: "港股" },
    { id: "us", label: "美股", group: "美股" },
    { id: "crypto", label: "加密货币", group: "加密货币" },
  ];
  const [target, setTarget] = useState(groupId);
  const [notice, setNotice] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [stockError, setStockError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const stockSearch = useQuery({
    queryKey: ["stock-search", debounced, market],
    enabled: debounced.length > 0,
    staleTime: 60000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/stocks/search?${new URLSearchParams({ q: debounced, market })}`,
        { signal },
      );
      const body = await response.json().catch(() => {
        throw new Error(t("资产搜索失败"));
      });
      if (!response.ok) throw new Error(body.error || "资产搜索失败");
      return body as {
        query: string;
        results: StockCandidate[];
        warnings?: string[];
      };
    },
  });
  const searchReady = query.trim() === debounced;
  const needle =
    searchReady && stockSearch.data ? stockSearch.data.query : query;
  const stockResults = searchReady
    ? (stockSearch.data?.results || []).filter(
        (stock) =>
          !metrics.some(
            (m) => m.symbol === stock.symbol || m.code === stock.symbol,
          ),
      )
    : [];
  const destination = (group: string) =>
    target === "auto"
      ? boardGroups.find((g) => g.groups.includes(group))!.id
      : target;
  const added = new Set(Object.values(layout).flat());
  const results = metrics.filter(
    (m) =>
      (market === "all" ||
        markets.find((item) => item.id === market)?.group === m.group) &&
      `${m.name} ${m.code} ${m.id} ${m.symbol} ${m.group} ${m.searchTerms || ""}`
        .toLowerCase()
        .includes(needle.trim().toLowerCase()),
  );
  useEffect(() => {
    dialog.current!.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="add-card-dialog"
      aria-labelledby="add-card-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return;
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
        <h2 id="add-card-title">{t("添加指标卡片")}</h2>
        <button
          className="icon-button"
          aria-label={t("关闭添加卡片")}
          disabled={pending !== null}
          onClick={() => dialog.current?.close()}
        >
          <X size={18} />
        </button>
      </div>
      <div className="picker-controls">
        <label className="search">
          <Search size={16} />
          <input
            autoFocus
            disabled={pending !== null}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("名称或代码：茅台、腾讯、AAPL、SOL")}
            aria-label={t("搜索可添加的指标")}
          />
          {query && (
            <button
              className="icon-button"
              aria-label={t("清除指标搜索")}
              disabled={pending !== null}
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className="picker-markets" role="group" aria-label={t("搜索市场")}>
          {markets.map((item) => (
            <button
              key={item.id}
              className="button ghost small"
              aria-pressed={market === item.id}
              disabled={pending !== null}
              onClick={() => setMarket(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <label className="picker-target">
          {t("添加到")}
          <select
            aria-label={t("卡片分组")}
            value={target}
            disabled={pending !== null}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="auto">{t("按市场自动分组")}</option>
            {boardGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {t(g.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="picker-summary">
          <span>
            {results.length}
            {t("项已接入指标")}
          </span>
          <span role="status">{t(notice)}</span>
        </div>
      </div>
      <div className="picker-results">
        {results.map((m) => (
          <div className="picker-result" key={m.id}>
            <div>
              <strong>{t(m.name)}</strong>
              <small>
                {t(m.group)} · {m.code} · {t(m.unit)}
              </small>
            </div>
            <button
              className={`button small ${added.has(m.id) ? "ghost" : ""}`}
              disabled={added.has(m.id)}
              aria-label={
                added.has(m.id) ? t("已添加{0}", m.name) : t("添加{0}", m.name)
              }
              onClick={() => {
                onAdd(m.id, destination(m.group));
                setNotice(t("已添加 {0}", m.name));
              }}
            >
              {added.has(m.id) ? <Check size={14} /> : <Plus size={14} />}
              {added.has(m.id) ? t("已添加") : t("添加")}
            </button>
          </div>
        ))}
        {query.trim() && (
          <div className="stock-search-results">
            <h3>{t("搜索股票 / 加密货币")}</h3>
            {searchReady &&
              stockSearch.data &&
              stockSearch.data.query.toLowerCase() !==
                query.trim().toLowerCase() && (
                <p className="stock-hint">
                  {t("按")}
                  {stockSearch.data.query}
                  {stockSearch.data.query === "AAPL" ? t("（苹果）") : ""}
                  {t("搜索")}
                </p>
              )}
            {(!searchReady || stockSearch.isFetching) && (
              <p className="stock-hint" role="status">
                {t("正在搜索资产…")}
              </p>
            )}
            {searchReady && stockSearch.isError && (
              <div className="stock-search-error" role="alert">
                <span>{t(stockSearch.error.message)}</span>
                <button
                  className="button small"
                  onClick={() => void stockSearch.refetch()}
                >
                  {t("重试")}
                </button>
              </div>
            )}
            {searchReady &&
              stockSearch.data?.warnings?.map((warning) => (
                <p
                  className="stock-search-error"
                  role="status"
                  key={t(warning)}
                >
                  {t(warning)}{" "}
                  <button
                    className="button small"
                    onClick={() => void stockSearch.refetch()}
                  >
                    {t("重试")}
                  </button>
                </p>
              ))}
            {stockResults.map((stock) => (
              <div className="picker-result" key={stock.symbol}>
                <div>
                  <strong>{t(stock.name)}</strong>
                  <small>
                    {t(
                      markets.find((item) => item.id === stock.market)?.label ||
                        "",
                    )}{" "}
                    · {stock.symbol} · {t(stock.exchange)}
                  </small>
                </div>
                <button
                  className="button small"
                  disabled={
                    pending !== null ||
                    added.has(`stock-${stock.symbol.toLowerCase()}`)
                  }
                  aria-label={t("追踪{0}", stock.symbol)}
                  onClick={async () => {
                    setPending(stock.symbol);
                    setStockError("");
                    try {
                      await onTrack(
                        stock.symbol,
                        destination(
                          markets.find((item) => item.id === stock.market)!
                            .group!,
                        ),
                      );
                      setNotice(t("已添加 {0}", stock.symbol));
                    } catch (error) {
                      setStockError(
                        error instanceof Error
                          ? error.message
                          : t("添加失败，请重试"),
                      );
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  {pending === stock.symbol
                    ? t("采集中…")
                    : added.has(`stock-${stock.symbol.toLowerCase()}`)
                      ? t("已添加")
                      : t("追踪")}
                </button>
              </div>
            ))}
            {stockError && (
              <p className="stock-search-error" role="alert">
                {t(stockError)}
              </p>
            )}
            {searchReady && stockSearch.isSuccess && !stockResults.length && (
              <p className="stock-hint">{t("没有更多匹配的股票或加密货币")}</p>
            )}
          </div>
        )}
        {!query.trim() && (
          <p className="stock-hint">
            {t("支持 A 股（沪深北）、港股、美股及加密货币；按名称或代码搜索。")}
          </p>
        )}
        {!results.length && !query.trim() && (
          <div className="picker-empty">
            <Search size={22} />
            <strong>{t("没有找到指标")}</strong>
            <span>{t("试试指标名称、交易代码或市场名称。")}</span>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <span role="status">
          {pending
            ? t("正在保存资产历史，请稍候…")
            : t("关闭后点击“保存”应用布局")}
        </span>
        <button
          className="button"
          disabled={pending !== null}
          onClick={() => dialog.current?.close()}
        >
          {t("完成添加")}
        </button>
      </div>
    </dialog>
  );
}
