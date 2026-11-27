# Economic Dashboard · 经济数据看板

一个页面观察 A 股、美股、港股、商品、汇率与利率。保存真实历史，查看趋势、来源和修订。

**Vite + React + TypeScript + TanStack Query · Hono · SQLite / Turso**

不使用 Next.js、服务端渲染、大型 UI 组件库或 ORM。Vercel 与极空间 Docker 共用数据接口与 SQL。

## 已实现

- 34项指标（含5项独立市场成交额及BTC/ETH），六组紧凑卡片、点击抽屉详情、搜索、自选关注，红涨绿跌/绿涨红跌可切换。
- 核心指标总览、历史曲线、指针/键盘查看观测值、区间变化与高低、市场成交统计。
- 1个月、3个月、1年、全部、自选日期、CSV导出。
- 真实日频采集、初次回填与增量更新；失败保留旧值，显示日期、错误与历史覆盖。
- 按指标和日期去重；价格、成交量和来源修订留痕；数据库租约防止采集重叠。
- Docker定时采集、Vercel Cron、数据库备份与空库恢复。

## 本地启动

需要 Node.js 24 LTS、pnpm 11。

```sh
pnpm install
cp .env.example .env
pnpm collect
pnpm dev
```

Vite默认地址 `http://127.0.0.1:5173`，占用时自动换端口；API默认3001。初次访问无数据时显示空状态，不生成模拟行情。

```sh
pnpm collect us10y sofr              # 指定指标补采
pnpm collect csi300 --backfill       # 回填与修订复核
pnpm test
pnpm build
pnpm start                          # 生产模式，默认3001端口
pnpm backup
pnpm restore backups/<文件>.json     # 仅能恢复到空数据库
```

本地默认数据库 `file:data/economic.db`。如需代理，在 `.env` 设置 `DATA_PROXY_URL`。采集有失败时 CLI 返回非零状态，成功指标仍然入库。

## 部署

- **Vercel**：Vite静态前端 + Node Function + Turso。配置 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`、`CRON_SECRET`。不能用函数本地文件保存持久历史。
- **极空间 Docker**：`docker compose up -d --build`，访问NAS的3001端口；命名卷保存SQLite，启动时补采，之后北京时间08:00、18:30运行。

详见[部署文档](docs/deployment.md)。未创建云数据库账号、配置云凭据或上线生产环境。

## 数据范围与限制

[shared/catalog.ts](shared/catalog.ts) 是当前指标定义；[数据说明](docs/data-plan.md)记录接入情况。

2026-11-27本机验证：34/34项有真实数据，共29,721条观测。上证50、中证1000各回填727条，BTC、ETH各1,826条；加密货币按已完成的UTC日线记录，不表示滚动24小时涨跌。市场成交额5项各33个交易日（2026-10-14起）。其他指标历史约2–5年，以页面实际覆盖为准。数据库不会提交到Git，新部署需首次采集或恢复备份。

- 日频而非实时行情；图表按观测顺序排列，不伪造休市数据。
- 公开行情接口无可用性保证，变更时需维护适配器。
- A股成交统计独立于指数：沪深北总成交额、沪深A股合计及三所分项，点击查看历史。来源为三所官方日度统计，排除B股、基金、债券和回购。
- 总成交量（股数）暂缺：上交所与北交所股数已取得，深市纯A股股数仍待核实，不使用含B股的合计或指数成交量代替。
- 商品为近月期货，换月可能产生跳变；区间变化不是可投资收益。
- 利率变化以基点显示；EFFR是有效利率，不是政策目标区间。
- 尚未接入LPR、政策目标区间、完整A股成交股数、ETF总回报及宏观日历。
- 超过4天标为“较早数据”，是年龄提示，不是完整交易所日历判断。

## 项目结构

- `src/`：React单页、SVG图表、TanStack Query。
- `shared/`：指标定义、类型与格式化。
- `server/`：Hono API、数据源、存储、采集与调度。
- `api/`：Vercel Node Function入口。
- `scripts/`：采集、备份与恢复。
- `tests/`：数据一致性、解析、调度与鉴权验证。

`.env`、数据库、备份与日志均不提交Git。所有秘密仅在服务端使用，不设置 `VITE_` 前缀的秘密变量。

可选 `DASHBOARD_PASSWORD` 保护读接口（HTTP Basic用户名 `viewer`）；静态页面和JS资源仍公开。未设置时行情数据公开。采集接口另由 `CRON_SECRET` 保护。
