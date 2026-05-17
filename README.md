# Market Radar

美股 ETF 智能监控台。每日自动拉取行情、计算均线指标、聚合新闻并用 AI 生成摘要，输出关注等级和定投建议。

## Tech Stack

Next.js 16 · Supabase · Tailwind CSS · ECharts · Vercel

## 本地运行

```bash
cp .env.example .env.local
# 填写 Supabase Key（M1 阶段可留空，占位值即可）
npm install
npm run dev
```

## Milestone

- [x] M1: Foundation + Mock Dashboard
- [ ] M2: 行情接入 + 指标计算（Alpha Vantage / Finnhub）
- [ ] M3: 新闻接入 + LLM 摘要
- [ ] M4: 推荐规则引擎
- [ ] M5: 每日复盘自动生成
- [ ] M6: 定时任务 + Vercel 部署

## 数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql` 建表。
