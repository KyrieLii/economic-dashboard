# 开源检查 / Open-source review

2026-11-27：当前源码可以按 MIT 发布；本次检查未发现阻止代码公开的凭据或已知生产依赖漏洞。此结论不代表行情数据授权、完整安全审计或托管服务的商用许可。

The source can be published under MIT based on this review. This is not a complete security audit or permission to collect, host, or redistribute market data.

## 检查范围 / Scope

- Gitleaks 8.30.1：扫描本地全部 Git refs 的历史与待提交源码，均为 0 项发现。规则扫描不能保证不存在所有形式的秘密。
- `pnpm audit --prod`：0 项已知漏洞；结果仅代表检查时的依赖与公告数据库。
- 已安装生产依赖声明为 MIT、ISC、BSD-3-Clause、Apache-2.0 和 OFL-1.1；前端打包依赖的完整许可及字体版权声明保留在 `public/third-party-notices.txt`，由 Vite 复制到发行目录。后端依赖保留在 `node_modules`。更新依赖时应重新检查许可证并更新声明。
- 根目录 MIT 许可证、中文和英文 README 已提供；Docker 发行镜像携带项目 LICENSE。
- `.env`、数据库及其日志、采集备份、运行日志、构建目录不进入 Git。历史与源码中未发现这些敏感文件或本机绝对路径。
- 27 项测试通过；TypeScript、前端及 API 生产构建通过；第三方许可文件已验证进入前端构建目录。
- 尚未验证真实 Vercel / Turso 部署与极空间 Docker 运行，详见[部署文档](deployment.md)。

## 数据与公开部署 / Data and hosting

项目 MIT 仅覆盖原创代码。Yahoo、东方财富、交易所与 FRED 的数据不因代码开源获得额外授权。公开可访问的接口也不等于可自由采集、商业使用或再分发；公开展示数据、输出数据包或提供收费服务前，需要核对具体来源和序列的条件。仓库不附带采集数据库或备份。

[FRED 官方条款](https://fred.stlouisfed.org/legal/)区分序列版权与署名要求，第三方数据授权不能由 FRED 代授。[Yahoo 条款入口](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)及各来源的最新条款须由部署者按使用范围确认；本检查没有取得数据提供方的再分发许可。

MIT covers original code, not provider data. Confirm source-specific permissions before public hosting, commercial use or database redistribution. No provider redistribution licenses were obtained as part of this review.

`DASHBOARD_PASSWORD` 保护读取、搜索和新增资产；不设置时，访问者可写入共享资产列表并触发历史回填。同源校验不是鉴权。互联网部署使用强密码和 HTTPS，`CRON_SECRET` 单独保护采集入口。当前没有多用户隔离或请求限流，应按个人或可信共享实例部署。

Without `DASHBOARD_PASSWORD`, visitors can register assets and trigger backfills. Use HTTPS and strong credentials for internet deployments. The app has no per-user isolation or rate limiting.
