# Market Radar — 设计文档

## 1. 项目定位

个人投资监控工具。帮助用户每天快速判断：

1. 美股市场当前处于什么状态
2. 纳指、标普、重点 ETF 是否出现趋势或风险信号
3. 重点美股龙头是否有值得关注的新闻或异动
4. A 股当前哪些板块强势，以及板块内头部股票表现如何
5. 今日是否维持基础定投、增强关注或风险观察

**第一版不做：** 自动下单、高频量化、全市场个股推荐、复杂 ML 预测。

---

## 2. 技术选型与决策

### 2.1 技术栈

| 模块 | 选型 | 决策理由 |
|------|------|---------|
| 前端框架 | Next.js 15 (App Router) | 同时承担前端渲染和 API Routes，一个项目完成所有功能；Vercel 原生支持 |
| UI | Tailwind CSS v4 | 快速开发，无运行时开销 |
| 图表 | ECharts | K线、均线、热力图支持完整；bundle 按需加载 |
| 图标 | Lucide React | 轻量，Tree-shakeable |
| 数据库 | Supabase PostgreSQL | 免费层够用，自带 REST API，JS SDK 完善 |
| 定时任务 | GitHub Actions | 免费，配置即代码，方便 debug |
| 美股数据 | Alpha Vantage（主）/ Finnhub（补）| 免费层可覆盖每日批量需求 |
| A股数据 | AkShare（Python）via GitHub Actions | 开源免费，覆盖板块数据 |
| LLM | 厂商无关，通过 OpenAI 兼容接口调用 | 支持 OpenAI、DeepSeek、通义等，切换只需改环境变量 |
| 部署 | Vercel Hobby | 免费，Next.js 零配置部署 |
| 测试 | Jest + React Testing Library | Next.js 官方推荐方案 |

### 2.2 LLM 厂商无关设计

通过环境变量控制：

```bash
LLM_BASE_URL=https://api.openai.com/v1       # OpenAI
LLM_BASE_URL=https://api.deepseek.com/v1     # DeepSeek
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1  # 通义
LLM_MODEL=gpt-4o-mini / deepseek-chat / qwen-plus
```

`lib/llm/client.ts` 封装统一调用接口，上层代码不感知厂商差异。

### 2.3 A股数据方案

AkShare 是 Python 库，不提供 HTTP API。采用 GitHub Actions 方案：

```
GitHub Actions (Python)
  → AkShare 拉取板块数据
  → 清洗后写入 Supabase
Next.js API Routes
  → 从 Supabase 读取 A股板块数据
  → 返回前端
```

优点：不需要额外服务器，成本为零。

---

## 3. 整体架构

```
用户浏览器
    ↓ HTTP
Next.js 前端（Vercel）
    ↓ fetch
Next.js API Routes（Serverless）
    ↓ supabase-js
Supabase PostgreSQL
    ↑ 写入
GitHub Actions 定时任务（每日 UTC 23:00 ≈ 北京 07:00）
    ├── Python: AkShare → A股板块数据
    └── Node.js:
          ├── Alpha Vantage → 美股行情
          ├── Finnhub → 美股新闻
          ├── 指标计算（MA/回撤/信号）
          ├── LLM → 新闻摘要 + 每日复盘
          └── 推荐规则引擎 → 关注列表
```

### 3.1 数据流

```
行情 API / 新闻 API
      ↓
定时任务 fetch + 清洗
      ↓
指标计算（MA20/60/250/500/1000，回撤，量比）
      ↓
规则引擎（趋势分 + 新闻分 + 风险分）
      ↓
LLM 生成自然语言解释
      ↓
写入 Supabase
      ↓
Next.js /api/dashboard 读取
      ↓
前端渲染
```

### 3.2 请求流（页面打开）

```
用户打开 /
  → page.tsx (Server Component) fetch /api/dashboard
  → API Route 查 Supabase 最新数据
  → 返回 DashboardData JSON
  → 渲染各 section 组件
```

---

## 4. 数据库设计

### 表清单

| 表名 | 用途 |
|------|------|
| `watchlist` | 关注标的（指数/ETF/股票/A股板块） |
| `market_price_daily` | 日线行情（OHLCV） |
| `market_indicator_daily` | 计算后的指标（均线、回撤、量比、风险等级） |
| `market_news` | 新闻（含 LLM 摘要、情绪标签） |
| `recommendation_daily` | 每日推荐结果（强关注/回调/风险/定投/板块） |
| `daily_report` | 每日复盘文案（LLM 生成） |

### 核心字段说明

**market_indicator_daily**

| 字段 | 说明 |
|------|------|
| `pct_from_ma500` | (close - ma500) / ma500，判断距关键均线距离 |
| `pct_from_ma1000` | 同上，MA1000 为极长期参考 |
| `drawdown_1y` | 距近一年高点的回撤幅度（负数） |
| `volume_ratio` | 今日成交量 / 20日均量，> 1.5 视为放量 |
| `risk_level` | low / medium / high / extreme |

**recommendation_daily**

| `recommendation_type` | 含义 |
|----------------------|------|
| `strong_watch` | 强关注：趋势强 + 新闻正面 + 无明显追高风险 |
| `pullback_watch` | 回调关注：长期趋势好 + 短期回调 + 无明显利空 |
| `risk_watch` | 风险观察：短期追高 / 利空新闻 / 跌破关键均线 |
| `base_dca` | 基础定投标的（QQQ / SPY） |
| `sector_watch` | A股板块观察 |

---

## 5. 评分模型

综合评分（满分 100）：

```
score =
  趋势分  × 0.35
+ 新闻分  × 0.25
+ 基本面分 × 0.20   （M1 暂不实现，用中性值 50 填充）
+ 估值风险分 × 0.10 （M1 暂不实现）
+ 波动风险分 × 0.10
```

### 趋势分规则

| 条件 | 分值 |
|------|------|
| 价格 > MA20 | +15 |
| 价格 > MA60 | +20 |
| 价格 > MA250 | +25 |
| 价格 > MA500 | +30 |
| 价格 > MA1000 | +10 |
| 价格 < MA500 | -20（风险加权） |
| 价格 < MA1000 | -30（极端区） |

### 新闻分规则

| 条件 | 分值 |
|------|------|
| 正面重大新闻 | +20 |
| 多条正面新闻 | +10 |
| 财报超预期 | +25 |
| 监管/诉讼/业绩下修 | -25 |
| 新闻热度高但股价放量下跌 | -15 |

### 风险分规则（扣分项）

| 条件 | 扣分 |
|------|------|
| 5日涨幅 > 15% | -20（追高风险） |
| 距一年高点 < 2% 且量比 > 1.5 | -15 |
| 跌破 MA60 | -15 |
| 跌破 MA250 | -25 |
| VIX > 25 | 全市场风险偏好降级 |

---

## 6. 定投策略

### 基础定投

| 标的 | 金额/日 |
|------|---------|
| QQQ（纳指100） | ¥1000 |
| SPY（标普500） | ¥200 |

### 增强加仓触发

| 市场状态 | 条件 | 动作 |
|----------|------|------|
| 正常区 | 价格 > MA500，回撤 < 10% | 基础定投 |
| 轻度回撤 | 回撤 10%~15% | 基础 + 小额关注 |
| 中度回撤 | 回撤 15%~25% 或接近 MA500 | 增强关注，分批加仓 |
| 深度回撤 | 跌破 MA500 或回撤 > 25% | 分批增强加仓 |
| 极端区 | 接近或跌破 MA1000 | 谨慎分批，不一次打满 |

---

## 7. 定时任务设计

| 任务 | 执行时间（北京）| 说明 |
|------|---------------|------|
| `fetch-us-market` | 07:00（工作日）| 拉美股行情、计算指标 |
| `fetch-us-news` | 07:30（工作日）| 拉新闻、LLM 摘要 |
| `fetch-cn-sectors` | 16:30（工作日）| AkShare 拉 A股收盘板块数据 |
| `generate-recommendations` | 08:00（工作日）| 规则引擎生成推荐 |
| `generate-daily-report` | 08:30（工作日）| LLM 生成复盘 |

GitHub Actions cron 时区为 UTC，北京时间 = UTC + 8。

---

## 8. API 接口设计

### GET /api/dashboard

返回 `DashboardData`，包含当日全量展示数据。前端 Server Component 在渲染时调用，`cache: 'no-store'`。

### GET /api/symbol/[symbol]

返回标的历史价格、指标、新闻、推荐记录。用于标的详情页（M2+）。

### GET /api/report/latest

返回最新每日复盘。用于复盘列表页（M5+）。

### POST /api/tasks/refresh

手动触发数据刷新。必须携带 `Authorization: Bearer ${APP_ADMIN_TOKEN}`。

---

## 9. 前端页面结构

```
/                          # Dashboard 首页
/symbol/[symbol]           # 标的详情（价格图、均线、新闻、推荐）
/sectors                   # A股板块页
/reports                   # 每日复盘列表
/settings                  # 关注列表 + 定投策略配置
```

### Dashboard 组件树

```
DashboardPage (Server Component)
  ├── MarketStatusBanner      # 今日市场状态
  ├── IndexCard × 3           # NDX / SPX / VIX
  ├── EtfGrid                 # ETF × 5
  ├── RecommendationSection   # 强关注
  ├── RecommendationSection   # 回调关注
  ├── RecommendationSection   # 风险观察
  ├── RecommendationSection   # A股板块
  ├── DcaSuggestion           # 定投建议
  └── DailyReportCard         # 每日复盘
```

---

## 10. 环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # 仅服务端，不可加 NEXT_PUBLIC_

# 美股行情
ALPHA_VANTAGE_API_KEY=             # alphavantage.co，注册即得，500次/日
FINNHUB_API_KEY=                   # finnhub.io，注册即得，60次/分钟

# LLM（OpenAI 兼容接口）
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# App
APP_ADMIN_TOKEN=                   # 保护 /api/tasks/refresh
NEXT_PUBLIC_BASE_URL=              # 本地: http://localhost:3000, 生产: https://your-app.vercel.app
NEXT_PUBLIC_APP_NAME=Market Radar
```

**安全原则：** 不带 `NEXT_PUBLIC_` 的 Key 只能在 API Routes 和 GitHub Actions 中使用，绝不出现在前端代码。

---

## 11. 监控标的清单（第一版）

**美股指数**
- NDX（纳斯达克100）、SPX（标普500）、VIX（恐慌指数）

**ETF**
- QQQ、SPY、VOO、XLK、SMH、SOXX、TLT、GLD

**龙头股**
- AAPL、MSFT、NVDA、GOOGL、AMZN、META、AMD、AVGO、TSLA

**A股（板块）**
- 半导体、AI应用、新能源、消费、医药（板块数据，不做个股推荐）

---

## 12. Milestone 路线图

| Milestone | 目标 | 状态 |
|-----------|------|------|
| M1 | Foundation + Mock Dashboard | 🔨 进行中 |
| M2 | 行情接入 + 指标计算（Alpha Vantage / Finnhub）| 待开始 |
| M3 | 新闻接入 + LLM 摘要 | 待开始 |
| M4 | 推荐规则引擎 | 待开始 |
| M5 | 每日复盘自动生成 | 待开始 |
| M6 | GitHub Actions + Vercel 部署 | 待开始 |

---

## 13. 成本控制

| 资源 | 用量控制 |
|------|---------|
| Alpha Vantage | 每日一次批量拉取，关注池约 20 个标的，每次约 20 请求，远低于 500/日上限 |
| Finnhub | 新闻每标的最多 5 条，约 100 次/日 |
| LLM | 只对候选推荐股（约 5~10 只）调用，结果写入 DB 缓存，页面读缓存不重复调用 |
| Supabase | 免费层 500MB 存储，日线数据每条 < 1KB，20 标的 × 250 交易日 = 5000 条，极小 |
| Vercel | Hobby 免费层，Serverless Functions 每月 100GB-hrs，日均访问量个人使用远低于上限 |

---

## 14. 后续升级方向

1. 接入 AkShare / Tushare 做 A股个股分析（当前只做板块）
2. 使用付费实时行情源（Polygon.io / Tiingo）
3. 引入 ClickHouse 存大量时间序列数据
4. 策略回测系统
5. 微信 / Telegram 每日推送
6. 用户自定义关注列表
7. 基金映射（QQQ → 广发纳指100F / 大成纳指100A）
