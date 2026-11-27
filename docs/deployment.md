# 部署指南

## Vercel + Turso

1. 在Turso创建兼容libSQL的数据库，取得URL（通常 `libsql://...`）和授权令牌。
2. Vercel导入 `KyrieLii/economic-dashboard`，选Vite，根目录保持仓库根目录。Node.js选24；安装命令 `pnpm install --frozen-lockfile`；构建 `pnpm build`；输出 `dist`。
3. Production环境设置 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`、`CRON_SECRET`。密钥可用 `openssl rand -hex 32` 生成；`DASHBOARD_PASSWORD` 保护行情读取、搜索和新增资产，用户名 `viewer`；公网部署应设置强密码并使用HTTPS。未设置时任何访问者均可登记资产；当前不提供用户隔离或请求限流。
4. 部署后数据库表会自动初始化，尚未采集时页面显示空状态。
5. 首次采集：本地配置Turso环境变量并运行 `pnpm collect`；或由运维客户端请求 `/api/cron`，带 `Authorization: Bearer <CRON_SECRET>`。不要在网页输入管理密钥。
6. `vercel.json` 配置每日UTC `0 0 * * *`（北京时间约08:00）。Vercel自动发送CRON_SECRET。Hobby执行不保证精确到分钟，也不保证自动重试。

Vercel不启用常驻调度器，并拒绝使用 `file:` 数据库。Preview应使用独立测试数据库，不要与生产共享写令牌。函数最长300秒，初次回填遇超时可用CLI按指标补采。

2026-11-27官方定价页面列出Turso免费版5GB存储、每月5亿行读取、1000万行写入；以注册时套餐为准。项目不自动启用付费超额。

## 极空间 Docker

上传或拉取项目源码，在支持Compose的环境执行：

```sh
cp .env.example .env
# 按需设置 CRON_SECRET 和 DASHBOARD_PASSWORD
docker compose up -d --build
docker compose logs -f dashboard
```

访问 `http://<NAS局域网地址>:3001`。镜像基于Node.js 24，按构建主机平台安装依赖，运行用户为 `node`（UID 1000）。本机没有Docker，尚未验证实际镜像构建和极空间运行。

命名卷 `economic-data` 保存SQLite（实际卷名可能带项目前缀）。更新容器保留卷；需要保留历史时不要执行 `docker compose down -v`。

如用极空间目录挂载，将卷映射换成 `/你的数据目录/economic-dashboard:/app/data`，确保目录可由UID 1000写入。图形界面创建容器时使用相同端口、环境变量和挂载。

调度器每分钟检查，按北京时间08:00和18:30采集；启动时补最近未执行时段。部分失败保留状态，到下一时段补采。采集锁超时自动过期。

网络需要代理时，设置容器可达的 `DATA_PROXY_URL`。容器内 `127.0.0.1` 是容器自身，不是NAS或电脑。

## 备份与恢复

`pnpm backup` 使用一致性读事务导出观测、修订、状态和运行记录到 `backups/`，不包含凭据。请独立备份该目录。

恢复时先将环境变量指向空数据库，再运行 `pnpm restore backups/<文件>.json`。非空目标会被拒绝；失败会回滚。

生产Docker镜像不携带开发CLI。可停容器后备份整个SQLite数据卷，或在含CLI的项目目录连接数据库操作。不要在写入期间仅复制主数据库文件而遗漏日志。

## 验证边界

已验证本地采集、历史一致性、API、生产构建和浏览器交互。真实Turso连接、Vercel云端构建/Cron、极空间Docker运行需在部署时验证；当前没有线上实例。

## 官方参考

- [Vercel存储](https://vercel.com/docs/marketplace-storage)
- [Vercel Cron限制](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Turso定价](https://turso.tech/pricing)
- [Turso SDK](https://docs.turso.tech/sdk/ts/reference)
- [Hono Vercel](https://hono.dev/docs/getting-started/vercel)
