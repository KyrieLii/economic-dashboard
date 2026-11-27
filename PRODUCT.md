# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
用户要求简单、单页、拒绝 Next.js，建议 TanStack。采用 Vite + React + TypeScript + TanStack Query；Hono 数据接口；libSQL 本地文件或远程数据库。pnpm。

## Users
个人每日浏览全球市场与经济数据，查看历史变化；桌面为主，移动端可用。

## Product Purpose
一个页面浏览 A 股、美股、港股、商品、汇率、利率、美债，筛选指标并查看历史趋势与数据出处。

## Capabilities and Constraints
保留历史及来源修订。支持 Vercel 与极空间 Docker。Vercel 使用远程持久数据库，Docker 使用挂载卷。未取得的数据不得伪造。免费数据源失败应显示状态而保留已获取历史。

## Brand Commitments
名称 economic-dashboard / 经济数据看板。用户希望现代、极客、信息一目了然。中文产品文案，数据代码保留原文。

## Evidence on Hand
README.md、docs/indicators.md、docs/data-plan.md、docs/history.md。原有文档为规划，接口需实测。

## Product Principles
来源可追溯；日期与口径明确；一屏扫描优先；数据缺失不等于零；不推断因果或投资建议。
