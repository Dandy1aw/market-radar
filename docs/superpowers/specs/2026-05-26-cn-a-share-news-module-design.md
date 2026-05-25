# A股资讯模块设计文档

**日期**：2026-05-26  
**范围**：全栈（后端采集 + LLM 处理 + 前端展示）  
**前端策略**：先用 mock 数据，后续接真实数据  

---

## 1. 目标

在 dashboard 新增一个独立的「A股资讯信号」区块，平行于现有的 opportunity 卡片区块（美股/ETF），展示用户 `watchlist_core` 中 A股自选标的的资讯信号、公告事件、可信度和后续观察点。

数据来源：东方财富个股新闻（AkShare）、巨潮资讯公告（AkShare）、新浪财经 RSS（feedparser）。

---

## 2. 架构方案：Hybrid（新采集表 + 共享下游）

```
Python 采集层
  → raw_cn_news / raw_cn_announcement（新表，CN 专属字段）
  → TypeScript LLM 处理层
    → company_event（market='CN'）
    → opportunity_decision（market='CN'）
    → 前端 A股资讯区块（按 market='CN' 过滤）
```

**关键决定：**
- 采集层用新表隔离，保留 CN 特有字段（`confidence_level`、`related_symbol`、`announcement_type`）
- `company_event` 和 `opportunity_decision` 不改结构，只写入 `market='CN'` 数据
- Python 只负责采集入库，TypeScript 复用现有 LLM pipeline 处理事件和决策
- 前端先用 mock 数据，后续替换 `page.tsx` 一处 import 即可切换真实数据

---

## 3. 数据库

### 3.1 新增表

```sql
CREATE TABLE IF NOT EXISTS raw_cn_news (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_type TEXT,                        -- 'company_news' | 'rss'
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT UNIQUE NOT NULL,               -- 去重
  related_symbol TEXT,                     -- CN 专属
  related_theme TEXT,                      -- CN 专属
  confidence_level TEXT DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_cn_announcement (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  market TEXT NOT NULL DEFAULT 'CN',
  title TEXT NOT NULL,
  announcement_type TEXT,                  -- '业绩快报' | '年报' | '公司公告' 等
  url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT UNIQUE NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'high',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_cn_news_symbol ON raw_cn_news(related_symbol);
CREATE INDEX IF NOT EXISTS idx_raw_cn_news_published ON raw_cn_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_cn_announcement_symbol ON raw_cn_announcement(symbol, published_at DESC);
```

### 3.2 现有表复用

| 表 | 操作 |
|---|---|
| `company_event` | 写入 `market='CN'` 行，复用现有 event_type 枚举 |
| `opportunity_decision` | 写入 `market='CN'` 行，不改表结构 |
| `watchlist_core` | 已有 `market='CN'` 字段，直接读取 |

---

## 4. 脚本结构

### 4.1 Python 采集层

```
scripts/
  fetch_cn_free_sources.py          # 主入口，GitHub Actions 执行这个
  fetch_cn_eastmoney_news.py        # 东方财富个股新闻（AkShare: stock_news_em）
  fetch_cn_cninfo_announcements.py  # 巨潮资讯公告（AkShare: stock_zh_a_disclosure_report_cninfo）
  fetch_cn_sina_rss.py              # 新浪财经 RSS（feedparser）
```

主入口流程：
1. 读 `watchlist_core`（market='CN'）
2. 对每个 CN 标的拉东方财富新闻和巨潮公告
3. 拉新浪财经 RSS（按 theme_keywords 过滤）
4. hash 去重
5. 写入 `raw_cn_news` / `raw_cn_announcement`

依赖：`akshare`, `feedparser`, `supabase`, `python-dotenv`

### 4.2 TypeScript LLM 处理层

```
scripts/
  process-cn-news.ts                # 主入口：读 raw_cn_* → LLM → 写 company_event + opportunity_decision

lib/cn-news/
  types.ts                          # CnNewsCardData, CnRawNews, CnAnnouncement 类型
  mock.ts                           # 前端 mock 数据（3-4 条示例卡片）
  queries.ts                        # getCnNewsData()：读 opportunity_decision WHERE market='CN'

prompts/
  cn_news_event_extraction.md       # 中文 LLM prompt（复用设计文档第 10 节结构）
```

`process-cn-news.ts` 复用现有：
- `lib/llm/client.ts`（chatCompletion）
- `lib/opportunity/event-extraction.ts` 逻辑（适配 CN prompt）
- `lib/opportunity/decision-synthesis.ts`
- `lib/supabase/opportunity-ingestion.ts`（insertCompanyEvents, replaceLatestOpportunityDecisions）

---

## 5. 前端组件

### 5.1 新增文件

```
components/cn-news/
  CnNewsSummaryBar.tsx              # 4 格统计栏
  CnNewsCard.tsx                    # 单张 A股资讯卡片
```

### 5.2 CnNewsCardData 类型

```typescript
type CnEventDirection = 'positive' | 'neutral' | 'negative' | 'mixed';
type CnConfidenceLevel = 'high' | 'medium' | 'low';
type CnSourceType = 'announcement' | 'company_news' | 'rss';

interface CnNewsCardData {
  symbol: string;
  company_name: string;
  theme: string;
  event_direction: CnEventDirection;
  confidence_level: CnConfidenceLevel;
  source_type: CnSourceType;
  source_label: string;       // "巨潮资讯" | "东方财富" | "新浪RSS"
  event_type: string;         // "业绩快报" | "公司公告" | "产业政策" 等
  importance_score: number;
  event_summary: string;
  watch_points: string[];
  risk_notes: string[];
  evidence: string[];
  updated_at: string;
}
```

### 5.3 CnNewsSummaryBar

4 格统计栏：活跃信号 / 正面信号 / 负面信号 / 高可信度

### 5.4 CnNewsCard

字段展示：
- 标题行：symbol + company_name + 事件方向 badge + 来源类型 badge
- 副标题：theme
- 右侧：可信度（高/中/低）
- 正文：event_summary
- chips：来源标签 / 事件类型 / 重要性分数
- 两列：后续观察 + 风险提示
- 可折叠证据区

颜色规则：
- 正面 → green-400
- 负面 → red-400
- 中性 → gray-400
- 混合 → amber-400
- 高可信度（公告）→ amber-400 badge

### 5.5 真实数据查询策略

`getCnNewsData()` 在 `lib/cn-news/queries.ts` 中实现：

1. 查询 `opportunity_decision WHERE market='CN'`，取最新一条每个 symbol
2. 通过 `evidence_event_ids` JOIN `company_event`，取 `event_direction`、`importance_score`、`event_summary`
3. `confidence_level` 和 `source_label` 来自 `company_event.raw_llm_json`（`process-cn-news.ts` 写入时存入）：
   - 公告证据 → `confidence_level: 'high'`，`source_label: '巨潮资讯'`
   - 东方财富新闻 → `confidence_level: 'medium'`，`source_label: '东方财富'`
   - 新浪 RSS → `confidence_level: 'low'`，`source_label: '新浪RSS'`
   - 多来源时取最高可信度

这样 `process-cn-news.ts` 在写 `company_event` 时需要在 `raw_llm_json` 中额外存入 `cn_source_type` 和 `cn_confidence_level` 两个字段。

### 5.6 Dashboard 接入（app/page.tsx）

新区块插在 OpportunityCard 网格之后、RecommendationSection 之前：

```tsx
// 先用 mock
import { mockCnNewsData } from '@/lib/cn-news/mock';

// 新区块（插在 OpportunityCard 网格之后、RecommendationSection 之前）
<section>
  <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
    A股资讯信号
  </h2>
  <CnNewsSummaryBar data={mockCnNewsData} />
  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 mt-3">
    {mockCnNewsData.cards.map(card => (
      <CnNewsCard key={card.symbol} card={card} />
    ))}
  </div>
</section>
```

切换真实数据时，只需将 `mockCnNewsData` 替换为 `await getCnNewsData()`，组件不变。

---

## 6. GitHub Actions

新增 `.github/workflows/fetch-cn-news.yml`，每 4 小时执行：

```yaml
name: Fetch CN News

on:
  schedule:
    - cron: "0 */4 * * 1-5"
  workflow_dispatch:

jobs:
  fetch-cn-news:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Python deps
        run: pip install akshare feedparser supabase python-dotenv requests pandas

      - name: Fetch CN raw news
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python scripts/fetch_cn_free_sources.py

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Node deps
        run: npm ci

      - name: Process CN news with LLM
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
        run: npx tsx scripts/process-cn-news.ts
```

---

## 7. 实现顺序

| 步骤 | 内容 | 产物 |
|---|---|---|
| 1 | DB schema | `raw_cn_news` + `raw_cn_announcement` migration SQL |
| 2 | 前端 mock | types.ts + mock.ts + CnNewsSummaryBar + CnNewsCard + page.tsx 接入 |
| 3 | Python 采集 | 4 个 .py 脚本 |
| 4 | LLM 处理 | prompts/cn_news_event_extraction.md + process-cn-news.ts |
| 5 | GitHub Actions | fetch-cn-news.yml |
| 6 | 真实数据接入 | queries.ts + page.tsx 切换 |

---

## 8. 约束与注意事项

- 第一版不依赖 Tushare，只用 AkShare 免费接口
- 公告（巨潮）= high_confidence，东方财富新闻 = medium_confidence，新浪 RSS = low_confidence
- 低可信度新闻不能单独触发机会判断，只作为补充信号
- Python 脚本每次运行需做 hash 去重，不重复写入
- LLM 每次运行有调用上限（`MAX_CN_LLM_CALLS_PER_RUN`，建议默认 20）
- 后续升级（Tushare / 财联社 / Choice）只替换 Python 采集层，不改 TS 和前端
