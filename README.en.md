# Economic Dashboard

[简体中文](README.md) | **English**

A single page for tracking mainland Chinese, US, and Hong Kong equities, commodities, exchange rates, interest rates, and cryptocurrencies. Keep historical observations and explore trends, sources, and revisions.

## Features

- 34 built-in indicators, including five separate market-turnover series and BTC/ETH, organized into six compact card groups. Open a card for details, search indicators, manage favorites, and switch between red-up/green-down and green-up/red-down colors.
- Historical charts with pointer and keyboard navigation, changes and highs/lows over the selected period, and market trading statistics.
- One-month, three-month, one-year, full-history, and custom date ranges, with CSV export.
- Daily data collection, initial backfills, and incremental updates. Collection failures retain saved history and show dates, errors, and available coverage.
- Deduplication by indicator and date, revision tracking for values, volumes, and sources, and database leases to prevent overlapping collection runs.
- Scheduled collection through Docker or Vercel Cron, database backups, and restoration into an empty database.

Customize cards by adding, removing, and reordering them. Search connected indicators when adding a card. Save the layout in the current browser, cancel changes, or restore defaults. Observation dates are available in each card’s information tooltip.

Search A-shares (Shanghai, Shenzhen and Beijing), Hong Kong stocks, US stocks and crypto under Settings → Add, with market filters. Try `600519` / 茅台, `00700` / 腾讯, `AAPL` / 苹果, or `SOL` / Solana / 狗狗币. `APEL` resolves to `AAPL`. Tracking backfills available history and joins daily collection. Up to 50 custom assets can be registered. Stocks use local exchange dates; crypto uses completed UTC daily bars, not live intraday quotes.

The language button immediately right of Settings switches Chinese / English. The three header icons use compact spacing. Language, layout and width are stored in the current browser’s localStorage and do not sync across devices. Asset definitions and history persist in SQLite / Turso; removing a card only hides it and preserves collection and history.

### Layout controls

Open Settings → Edit layout to drag whole cards with live insertion, or drag a group heading to reorder groups. Drop near the bottom of another group to start a new row. Arrow and row-break buttons are available as keyboard alternatives; Escape cancels the current drag. Save, Cancel and Restore defaults cover card placement, group order, row breaks and width. Cards keep a fixed width and align left; Settings adjusts it from 160 to 300 px. Width changes outside editing save immediately in the current browser. The last collection time appears as translucent text at the bottom right.

## Run locally

Requires Node.js 24 LTS and pnpm 11.

```sh
pnpm install
cp .env.example .env
pnpm collect
pnpm dev
```

The frontend defaults to `http://127.0.0.1:5173` and selects another port if it is occupied. The API defaults to port 3001. An empty database shows an empty state; the application does not generate simulated market data.

```sh
pnpm collect us10y sofr              # Collect selected indicators
pnpm collect csi300 --backfill       # Backfill and check for revisions
pnpm test
pnpm build
pnpm start                          # Production server, port 3001 by default
pnpm backup
pnpm restore backups/<file>.json     # Restore into an empty database only
```

The default local database is `file:data/economic.db`. To use a proxy for collection, set `DATA_PROXY_URL` in `.env`. The collection command exits with a nonzero status if any collection fails; successfully collected indicators are still saved.

## Deployment

- **Vercel**: static frontend, Node Function, and Turso. Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `CRON_SECRET`. Function-local files cannot provide persistent historical storage.

See the [deployment guide](docs/deployment.md) (Chinese). Cloud database accounts, credentials, and a production deployment have not been set up for this repository.

## Data coverage and limitations

[shared/catalog.ts](shared/catalog.ts) defines the current indicators. The [data notes](docs/data-plan.md) (Chinese) document the integrations.

Local verification on November 27, 2026: all 34 indicators have real data, totaling 29,721 observations. SSE 50 and CSI 1000 each have 727 observations; BTC and ETH each have 1,826. Cryptocurrency data uses completed UTC daily bars, so changes are not rolling 24-hour returns. Each of the five market-turnover series has 33 trading days starting October 14, 2026. Other series have roughly two to five years of history; actual coverage is shown in the application. The database is not committed to Git. New deployments require initial collection or restoration from a backup.

- Data is daily, not real-time. Charts follow observation order and do not fabricate values for market holidays.
- Public data endpoints have no availability guarantee and may require adapter maintenance when they change.
- A-share market trading statistics are separate from index data: combined Shanghai/Shenzhen/Beijing turnover, combined Shanghai/Shenzhen A-share turnover, and individual exchange series. They use official daily exchange statistics and exclude B shares, funds, bonds, and repos.
- Total A-share trading volume in shares is not yet available. Shanghai and Beijing share counts are available, but Shenzhen's pure A-share count still needs verification. Totals that include B shares or index volumes are not used as substitutes.
- Commodity series represent near-month futures. Contract rolls may cause price jumps; changes over a period are not investable returns.
- Interest-rate changes use basis points. EFFR is the effective federal funds rate, not the policy target range.
- LPR, policy target ranges, complete A-share trading volume, ETF total returns, and a macroeconomic calendar are not yet integrated.
- Observations more than four days old are marked as older data. This is an age indicator, not a complete exchange-calendar check.

## Project structure

- `src/`: single-page interface, SVG charts, and data queries.
- `shared/`: indicator definitions, types, and formatting.
- `server/`: API, data providers, storage, collection, and scheduling.
- `api/`: Vercel Node Function entry point.
- `scripts/`: collection, backup, and restoration utilities.
- `tests/`: data consistency, parsing, scheduling, and authentication checks.

`.env`, databases, backups, and logs are excluded from Git. Secrets are used only on the server; never prefix secret environment variables with `VITE_`.

Set `DASHBOARD_PASSWORD` to protect market-data reads, search and asset registration with HTTP Basic authentication (username: `viewer`). Static pages and JavaScript remain public. Without it, any visitor can read data, search and register assets, consuming shared collection and storage resources. Use a strong password and HTTPS for internet deployments. Collection endpoints are protected separately by `CRON_SECRET`. This is a shared instance without per-user isolation or request rate limiting.

## License

Original project code is licensed under the [MIT License](LICENSE). Fonts, icons and other dependencies retain their own licenses; frontend distributions include [third-party notices](public/third-party-notices.txt).

MIT does not grant rights to collect, commercially use or redistribute market data. Provider and exchange terms still apply; for example, [FRED](https://fred.stlouisfed.org/legal/) specifies different copyright and attribution requirements by series. Confirm each source’s permissions before publicly hosting data or distributing a database. Collected databases and backups are not included in this repository. See the [open-source review](docs/open-source.md).
