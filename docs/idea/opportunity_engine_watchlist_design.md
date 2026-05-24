# 自选标的机会发现引擎设计文档

> 面向 Codex / Cursor / Claude Code 的实现说明。  
> 目标：将现有股市雷达升级为“自选基金 / ETF / 股票 / 公司”的机会发现引擎。  
> 原则：只围绕用户选中的标的信息收集、财报新闻分析、预期差判断和买入观察；其他公司默认剔除，仅在与核心标的强相关时作为上下文信号。

---

## 0. 项目定位

当前系统已经具备股市雷达能力，并接入 DeepSeek。下一阶段要做的是：

```text
自选标的驱动的科技机会发现引擎
```

系统关注对象包括：

```text
1. 用户手动选择的基金
2. 用户手动选择的 ETF
3. 用户手动选择的美股股票
4. 用户手动选择的 A 股股票
5. 用户手动选择的公司，包括未上市公司，例如 CXMT / 长鑫存储
```

系统不做全市场荐股，不做自动交易，不对陌生股票直接输出买入建议。

---

## 1. 核心设计原则

### 1.1 只推荐核心关注池

系统只对 `watchlist_core` 中的标的输出完整机会判断：

```text
行情监控
新闻收集
财报 / 公告收集
一致预期收集
AI 事件抽取
预期差分析
机会打分
买入观察条件
风险提示
```

### 1.2 其他公司只做关联信号

非核心标的默认不进入推荐池，只在以下情况下进入 `watchlist_context`：

```text
1. 是核心标的的竞争对手
2. 是核心标的的供应商
3. 是核心标的的客户
4. 是核心标的所在 ETF 的核心持仓
5. 是核心标的新闻 / 财报 / 电话会中反复出现的公司
6. 是核心主题的产业链关键公司
```

例如：

```text
用户关注 MU：
- Samsung Memory：竞争对手，作为 HBM / DRAM 供给信号
- SK Hynix：竞争对手，作为 HBM / DRAM 供给信号
- CXMT：国产 DRAM 映射信号
```

这些公司只作为背景，不直接输出“买入”。

### 1.3 未知公司先进入待确认池

系统发现的新公司进入 `discovered_candidates`，状态为 `pending`。

只有用户确认后，才进入 `watchlist_core` 或 `watchlist_context`。

---

## 2. 信息池分层

### 2.1 核心池：watchlist_core

核心池是用户真正关心、希望系统持续跟踪和输出机会判断的对象。

典型对象：

```text
NVDA
MU
AMD
AVGO
TSM
ASML
AMAT
LRCX
QQQ
SPY
SMH
SOXX
广发纳指100F
博时标普500E
CXMT / 长鑫存储
A 股科技龙头
```

### 2.2 关联池：watchlist_context

关联池只服务于核心池，不直接推荐。

典型关系：

```text
competitor      竞争对手
supplier        供应商
customer        客户
peer            同行业公司
etf_holding     ETF 重要持仓
industry_signal 行业信号源
policy_signal   政策 / 产业事件源
```

### 2.3 发现池：discovered_candidates

系统在新闻、公告、财报、电话会、主题扫描中发现的公司先放入发现池。

页面可以显示：

```text
系统发现：某公司近期多次出现在 AI 液冷 / HBM / 数据中心电力新闻中
关联标的：NVDA / MU
建议：是否加入核心关注池？
```

---

## 3. 整体数据流

```text
GitHub Actions / Cron 每 4 小时触发
        ↓
读取 watchlist_core
        ↓
读取 watchlist_context
        ↓
拉取核心池行情、新闻、财报、公告、预期
        ↓
拉取与核心池相关的关联新闻
        ↓
新闻去重、低质量过滤
        ↓
实体识别：公司 / ticker / 主题 / 事件
        ↓
剔除与核心池无关的信息
        ↓
DeepSeek 做事件抽取
        ↓
规则系统计算：
    news_score
    expectation_score
    reality_score
    surprise_score
    price_position_score
    risk_score
        ↓
生成 opportunity_decision
        ↓
DeepSeek 生成机会解释卡
        ↓
写入 Supabase
        ↓
前端展示最新结果
```

---

## 4. 每 4 小时采集范围

每 4 小时任务只做“轻量增量”。

### 4.1 每 4 小时执行

```text
1. 核心池新闻
2. 核心主题新闻
3. 关联池新闻
4. A 股科技板块新闻
5. 美股核心标的行情快照
6. A 股核心标的行情快照
7. 新事件去重
8. DeepSeek 事件抽取
9. 机会分数更新
10. 机会卡片更新
```

### 4.2 每天执行

```text
1. 美股日线
2. A 股日线
3. ETF / 基金净值或估算净值
4. MA20 / MA60 / MA250 / MA500 / MA1000
5. 回撤
6. 估值快照
7. 每日复盘
```

### 4.3 财报季增强任务

```text
1. SEC 10-Q / 10-K / 8-K
2. 美股 earnings release
3. EPS / revenue actual vs consensus
4. 管理层指引
5. 电话会纪要
6. A 股公告 / 业绩预告 / 业绩快报
```

### 4.4 每周执行

```text
1. 主题-公司映射更新
2. ETF 前十大持仓更新
3. 发现候选池汇总
4. 长期估值分位更新
5. 财报日历更新
```

---

## 5. 数据源建议

### 5.1 美股行情 / ETF

第一版可选：

```text
Finnhub
Alpha Vantage
FMP
Polygon / Massive，后续升级
```

### 5.2 美股财报 / 公告

优先使用：

```text
SEC EDGAR API
```

用途：

```text
10-K
10-Q
8-K
XBRL 财务字段
```

### 5.3 美股新闻 / 情绪

第一版可选：

```text
Finnhub Company News
Alpha Vantage News & Sentiment
FMP Stock News
NewsAPI / GNews 作为补充
```

### 5.4 美股一致预期

可选：

```text
Alpha Vantage Earnings Estimates
Finnhub Earnings Calendar
FMP Analyst Estimates
FMP Price Target
FMP Rating
```

### 5.5 A 股行情 / 板块 / 财务

第一版可选：

```text
AkShare：板块、概念、行情、部分资讯
Tushare Pro：财务、业绩预告、业绩快报、新闻
巨潮资讯：后续补公告抓取
```

---

## 6. 新闻过滤规则

### 6.1 保留条件

新闻进入候选处理队列需要满足至少一个条件：

```text
1. 标题或正文命中 watchlist_core.symbol
2. 标题或正文命中 watchlist_core.name
3. 标题或正文命中核心主题关键词
4. 标题或正文命中 watchlist_context.related_name
5. 新闻事件能映射到某个核心标的
6. 新闻事件能映射到某个核心主题
```

### 6.2 剔除条件

```text
1. 没有命中核心池或关联池
2. 没有命中核心主题
3. 无法映射到任何核心标的
4. 来源质量低
5. 重复转载
6. 标题党 / 非财经内容
7. 纯概念炒作，无证据链
```

### 6.3 示例

```text
新闻：Micron raises guidance due to HBM demand
处理：保留，直接关联 MU，主题为存储芯片 / HBM

新闻：Samsung HBM certification delayed
处理：保留，虽然不是核心池公司，但影响 MU 的竞争格局和 HBM 供需

新闻：某小盘 AI 概念股涨停
处理：默认剔除，除非该公司已经在核心池或关联池
```

---

## 7. 决策分层

系统不要直接输出“买入 / 卖出”，而是输出可解释的状态。

```text
可小仓试探
回调买入候选
继续强关注
突破确认观察
财报后再判断
风险过高
暂不跟踪
```

### 7.1 可小仓试探

触发条件示例：

```text
Surprise_Score > 15
Price_Position_Score > 60
Risk_Score < 50
近 20 日涨幅不过热
非财报前高风险窗口
```

### 7.2 回调买入候选

```text
Reality_Score 高
Surprise_Score >= 0
但 Price_Position_Score 低
或近 20 日涨幅过大
```

### 7.3 继续强关注

```text
产业强
公司强
新闻强
但市场预期已经很高
当前买点未触发
```

### 7.4 风险过高

```text
Expectation_Score 高
Reality_Score 未明显超预期
Price_Position 过热
估值分位高
近期放量滞涨或财报前涨幅过大
```

---

## 8. 评分模型

### 8.1 总分

```text
Total_Score =
0.25 * Industry_Score
+ 0.20 * Company_Score
+ 0.20 * News_Score
+ 0.15 * Price_Position_Score
+ 0.10 * Valuation_Score
- 0.10 * Risk_Score
```

### 8.2 预期差

```text
Expectation_Score =
0.35 * Explicit_Expectation
+ 0.35 * Market_Implied_Expectation
+ 0.20 * Narrative_Expectation
+ 0.10 * Option_Implied_Expectation

Reality_Score =
0.35 * Financial_Result
+ 0.25 * Management_Guidance
+ 0.20 * Industry_Data
+ 0.20 * Event_Strength

Surprise_Score = Reality_Score - Expectation_Score
```

### 8.3 显性预期

```text
expected_revenue
expected_eps
analyst_count
estimate_revision_30d
estimate_revision_90d
guidance_expectation
```

### 8.4 隐性预期

```text
pre_event_return_5d
pre_event_return_20d
relative_return_vs_sector
relative_return_vs_index
volume_ratio
distance_to_52w_high
valuation_percentile
option_implied_move
```

### 8.5 叙事预期

```text
news_count_24h
news_count_7d
positive_news_ratio
theme_keyword_frequency
management_keyword_mentions
peer_news_spillover
```

---

## 9. 数据库表结构

数据库建议使用 Supabase PostgreSQL。

### 9.1 watchlist_core

```sql
CREATE TABLE IF NOT EXISTS watchlist_core (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  name TEXT NOT NULL,
  market TEXT NOT NULL, -- US / CN / HK / GLOBAL
  exchange TEXT,
  asset_type TEXT NOT NULL, -- stock / etf / fund / company / private_company
  theme TEXT,
  priority INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(symbol, market, asset_type)
);
```

### 9.2 watchlist_context

```sql
CREATE TABLE IF NOT EXISTS watchlist_context (
  id BIGSERIAL PRIMARY KEY,
  core_id BIGINT REFERENCES watchlist_core(id) ON DELETE CASCADE,
  core_symbol TEXT,
  related_symbol TEXT,
  related_name TEXT NOT NULL,
  market TEXT,
  relation_type TEXT NOT NULL,
  relation_strength NUMERIC DEFAULT 0.5,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.3 theme_master

```sql
CREATE TABLE IF NOT EXISTS theme_master (
  id BIGSERIAL PRIMARY KEY,
  theme_name TEXT UNIQUE NOT NULL,
  theme_desc TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.4 raw_news

```sql
CREATE TABLE IF NOT EXISTS raw_news (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_type TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT now(),
  hash TEXT UNIQUE,
  lang TEXT,
  raw_json JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.5 news_entity_map

```sql
CREATE TABLE IF NOT EXISTS news_entity_map (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT REFERENCES raw_news(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- core / context / candidate / theme
  symbol TEXT,
  name TEXT,
  market TEXT,
  theme TEXT,
  relation_to_core TEXT,
  confidence NUMERIC DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.6 company_event

```sql
CREATE TABLE IF NOT EXISTS company_event (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  market TEXT,
  company_name TEXT,
  theme TEXT,
  event_type TEXT,
  event_direction TEXT, -- positive / neutral / negative / mixed
  importance_score NUMERIC,
  event_summary TEXT,
  evidence_news_ids BIGINT[],
  published_at TIMESTAMP,
  raw_llm_json JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.7 market_snapshot

```sql
CREATE TABLE IF NOT EXISTS market_snapshot (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL,
  trade_time TIMESTAMP,
  price NUMERIC,
  change_pct NUMERIC,
  volume NUMERIC,
  ma20 NUMERIC,
  ma60 NUMERIC,
  ma250 NUMERIC,
  ma500 NUMERIC,
  ma1000 NUMERIC,
  drawdown_1y NUMERIC,
  distance_to_ma20 NUMERIC,
  distance_to_ma60 NUMERIC,
  distance_to_52w_high NUMERIC,
  raw_json JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.8 market_expectation

```sql
CREATE TABLE IF NOT EXISTS market_expectation (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  market TEXT,
  trade_date DATE,
  expected_revenue NUMERIC,
  actual_revenue NUMERIC,
  revenue_surprise NUMERIC,
  expected_eps NUMERIC,
  actual_eps NUMERIC,
  eps_surprise NUMERIC,
  analyst_count INT,
  revision_30d NUMERIC,
  revision_90d NUMERIC,
  pre_event_return_20d NUMERIC,
  relative_return_20d NUMERIC,
  option_implied_move NUMERIC,
  expectation_score NUMERIC,
  expectation_level TEXT,
  raw_json JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.9 opportunity_decision

```sql
CREATE TABLE IF NOT EXISTS opportunity_decision (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  market TEXT,
  company_name TEXT,
  asset_type TEXT,
  theme TEXT,
  decision_level TEXT,
  total_score NUMERIC,
  industry_score NUMERIC,
  company_score NUMERIC,
  news_score NUMERIC,
  expectation_score NUMERIC,
  reality_score NUMERIC,
  surprise_score NUMERIC,
  price_position_score NUMERIC,
  valuation_score NUMERIC,
  risk_score NUMERIC,
  ai_summary TEXT,
  buy_conditions JSONB,
  risk_factors JSONB,
  evidence_event_ids BIGINT[],
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.10 discovered_candidates

```sql
CREATE TABLE IF NOT EXISTS discovered_candidates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  market TEXT,
  theme TEXT,
  discovered_from TEXT,
  related_to_symbol TEXT,
  reason TEXT,
  mention_count INT DEFAULT 1,
  importance_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending / approved_core / approved_context / rejected
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## 10. 后端 / 脚本目录结构

建议项目结构如下：

```text
.
├── app/
│   ├── page.tsx
│   ├── opportunity/
│   │   └── page.tsx
│   └── api/
│       ├── watchlist/
│       │   └── route.ts
│       ├── opportunity/
│       │   └── route.ts
│       └── candidates/
│           └── route.ts
├── components/
│   ├── OpportunityCard.tsx
│   ├── WatchlistTable.tsx
│   ├── CandidateReviewPanel.tsx
│   └── SignalBadge.tsx
├── lib/
│   ├── supabase.ts
│   ├── scoring.ts
│   ├── decision.ts
│   └── format.ts
├── scripts/
│   ├── fetch_opportunity_data.py
│   ├── fetch_us_news.py
│   ├── fetch_cn_news.py
│   ├── fetch_market_snapshot.py
│   ├── extract_events_deepseek.py
│   ├── compute_scores.py
│   └── generate_opportunity_cards.py
├── prompts/
│   ├── event_extraction.md
│   ├── expectation_gap.md
│   └── decision_summary.md
├── supabase/
│   └── schema.sql
├── .github/
│   └── workflows/
│       └── fetch-opportunity-data.yml
└── docs/
    └── opportunity-engine-watchlist-design.md
```

---

## 11. GitHub Actions 定时任务

每 4 小时执行一次。

```yaml
name: Fetch Opportunity Data

on:
  schedule:
    - cron: "0 */4 * * *"
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install requests pandas python-dotenv supabase akshare tushare

      - name: Run fetch job
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          FINNHUB_API_KEY: ${{ secrets.FINNHUB_API_KEY }}
          ALPHA_VANTAGE_API_KEY: ${{ secrets.ALPHA_VANTAGE_API_KEY }}
          FMP_API_KEY: ${{ secrets.FMP_API_KEY }}
          TUSHARE_TOKEN: ${{ secrets.TUSHARE_TOKEN }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
        run: |
          python scripts/fetch_opportunity_data.py
```

注意：

```text
1. GitHub Actions 的 schedule 使用 UTC 时间。
2. 不要依赖它做到秒级准时。
3. 需要支持 workflow_dispatch，方便手动触发。
4. API key 必须放在 GitHub Secrets 中。
```

---

## 12. DeepSeek Prompt 设计

### 12.1 事件抽取 Prompt

文件：`prompts/event_extraction.md`

```markdown
# 角色

你是科技行业投资研究助手。你的任务是从新闻、财报、公告或电话会纪要中抽取结构化事件。

# 重要约束

1. 只分析与核心关注池或关联池相关的信息。
2. 不要输出买入或卖出建议。
3. 不要编造事实。
4. 所有结论必须能追溯到输入文本。
5. 如果证据不足，输出 uncertainty。

# 输入

核心关注池：
{{watchlist_core}}

关联观察池：
{{watchlist_context}}

主题关键词：
{{theme_keywords}}

文本：
{{document_text}}

# 输出 JSON

{
  "is_relevant": true,
  "related_core_symbols": [],
  "related_context_entities": [],
  "theme": "",
  "event_type": "",
  "event_direction": "positive | neutral | negative | mixed",
  "importance_score": 0,
  "summary": "",
  "key_facts": [],
  "positive_factors": [],
  "negative_factors": [],
  "supply_chain_mentions": [],
  "new_company_mentions": [],
  "uncertainty": [],
  "evidence": [
    {
      "text": "",
      "reason": ""
    }
  ]
}
```

### 12.2 预期差分析 Prompt

文件：`prompts/expectation_gap.md`

```markdown
# 角色

你是科技行业预期差分析助手。你的任务是基于结构化数据判断“事实表现”相对于“市场预期”是否存在正向或负向预期差。

# 重要约束

1. 不要直接给买入或卖出建议。
2. 必须区分“公司很好”和“当前有买点”。
3. 必须显式说明市场是否已经提前反映利好。
4. 如果缺少一致预期、财报或行情数据，需要降低置信度。

# 输入

核心标的：
{{symbol}} / {{company_name}}

市场显性预期：
{{explicit_expectation}}

市场隐性预期：
{{market_implied_expectation}}

叙事预期：
{{narrative_expectation}}

事实表现：
{{reality_facts}}

行情位置：
{{price_position}}

# 输出 JSON

{
  "market_expectation_level": "low | medium | high | very_high",
  "actual_result_level": "weak | neutral | strong | very_strong",
  "surprise_type": "positive | mild_positive | neutral | mild_negative | negative",
  "surprise_score": 0,
  "reasoning": [],
  "already_priced_in_risk": "",
  "key_uncertainties": [],
  "confidence": 0
}
```

### 12.3 决策解释 Prompt

文件：`prompts/decision_summary.md`

```markdown
# 角色

你是机会发现引擎的解释层。规则系统已经给出了分数和决策等级，你负责把它解释成简洁、可执行、可复盘的机会卡片。

# 重要约束

1. 不要修改规则系统给出的 decision_level。
2. 不要输出“必须买入”“满仓”“清仓”等强指令。
3. 必须说明当前为什么可以买 / 为什么不能买。
4. 必须输出买入触发条件和风险因素。
5. 只围绕核心关注池标的输出，不要推荐陌生公司。

# 输入

标的：
{{symbol}} / {{company_name}}

规则系统决策：
{{decision_level}}

分数：
{{scores}}

事件证据：
{{events}}

行情位置：
{{price_position}}

预期差分析：
{{expectation_gap}}

# 输出 Markdown

## {{symbol}} / {{company_name}}

### 机会结论
{{decision_level}}

### AI 判断
...

### 预期差
...

### 当前不直接买入的原因
...

### 买入触发条件
1. ...
2. ...
3. ...

### 风险
1. ...
2. ...
3. ...

### 下一步观察
1. ...
2. ...
3. ...
```

---

## 13. API 设计

### 13.1 获取核心关注池

```http
GET /api/watchlist?type=core
```

返回：

```json
{
  "items": [
    {
      "id": 1,
      "symbol": "MU",
      "name": "Micron Technology",
      "market": "US",
      "asset_type": "stock",
      "theme": "存储芯片",
      "priority": 1
    }
  ]
}
```

### 13.2 新增核心关注标的

```http
POST /api/watchlist
```

请求：

```json
{
  "symbol": "MU",
  "name": "Micron Technology",
  "market": "US",
  "asset_type": "stock",
  "theme": "存储芯片",
  "priority": 1,
  "notes": "重点关注 HBM、DRAM、NAND 周期"
}
```

### 13.3 获取机会决策

```http
GET /api/opportunity?symbol=MU
```

返回：

```json
{
  "symbol": "MU",
  "decision_level": "回调买入候选",
  "total_score": 78,
  "surprise_score": 8,
  "ai_summary": "...",
  "buy_conditions": [],
  "risk_factors": [],
  "created_at": "2026-05-23T12:00:00Z"
}
```

### 13.4 获取发现候选

```http
GET /api/candidates?status=pending
```

### 13.5 审核发现候选

```http
POST /api/candidates/:id/approve
```

请求：

```json
{
  "target": "core",
  "theme": "AI 电力",
  "notes": "作为核心观察标的加入"
}
```

或者：

```json
{
  "target": "context",
  "related_to_symbol": "NVDA",
  "relation_type": "supplier",
  "relation_strength": 0.7
}
```

---

## 14. 前端页面设计

### 14.1 自选机会首页

路径：

```text
/opportunity
```

模块：

```text
1. 今日核心池变化
2. 强关注
3. 回调买入候选
4. 风险过高
5. 关联信号
6. 新发现候选
```

### 14.2 机会卡片字段

每张卡片展示：

```text
symbol / name
market
theme
decision_level
total_score
surprise_score
price_position_score
risk_score
AI 判断
买入触发条件
风险因素
更新时间
证据事件
```

### 14.3 新发现候选审核页

路径：

```text
/opportunity/candidates
```

操作：

```text
加入核心池
加入关联池
忽略
查看证据
```

---

## 15. 核心脚本逻辑

### 15.1 scripts/fetch_opportunity_data.py

伪代码：

```python
def main():
    core = load_watchlist_core()
    context = load_watchlist_context()
    themes = load_themes()

    raw_news = []
    raw_news += fetch_news_for_core(core)
    raw_news += fetch_news_for_themes(themes)
    raw_news += fetch_news_for_context(context)

    deduped_news = dedupe_news(raw_news)
    filtered_news = filter_news_by_watchlist(deduped_news, core, context, themes)

    save_raw_news(filtered_news)

    important_news = rank_news_importance(filtered_news)
    events = extract_events_with_deepseek(important_news, core, context, themes)

    save_company_events(events)

    snapshots = fetch_market_snapshots(core)
    save_market_snapshots(snapshots)

    scores = compute_opportunity_scores(core, events, snapshots)
    decisions = generate_decisions(scores)

    save_opportunity_decisions(decisions)

    cards = generate_ai_decision_summaries(decisions, events)
    update_decision_cards(cards)
```

---

## 16. 去重策略

### 16.1 新闻 hash

```text
hash = sha256(normalized_title + normalized_url_domain + published_date)
```

### 16.2 相似标题去重

```text
1. 标题 lowercase
2. 去标点
3. 去停用词
4. 计算相似度
5. 相似度 > 0.9 视为重复
```

### 16.3 同一事件合并

多篇新闻报道同一事件时，合并成一个 `company_event`。

合并 key：

```text
symbol + event_type + theme + date_bucket
```

---

## 17. 安全与成本控制

### 17.1 API Key

所有 key 放到 GitHub Secrets / Vercel Env / Supabase Edge Secrets。

禁止：

```text
1. 在前端暴露行情 API key
2. 在前端暴露 DeepSeek key
3. 把 service_role key 暴露给浏览器
```

### 17.2 DeepSeek 调用控制

不要让 DeepSeek 分析所有新闻。

只分析：

```text
1. 命中核心池
2. 命中关联池且能映射核心池
3. 重要性初筛高
4. 新事件
5. 财报 / 指引 / 公告类硬信息
```

### 17.3 每轮上限

建议第一版：

```text
每 4 小时最多处理 50 条新闻
每 4 小时最多调用 DeepSeek 20 次
每个核心标的最多保留 5 条最新事件
每个主题最多保留 10 条候选新闻
```

---

## 18. MVP 实现步骤

### Phase 1：基础表与关注池

任务：

```text
1. 创建 Supabase 表结构
2. 实现 watchlist_core CRUD
3. 实现 watchlist_context CRUD
4. 前端展示核心关注池
5. 支持手动新增核心标的
```

验收：

```text
可以在页面中新增 MU / NVDA / QQQ / CXMT
可以区分 stock / etf / fund / company / private_company
```

### Phase 2：4 小时新闻采集

任务：

```text
1. 创建 GitHub Actions 定时任务
2. 实现 fetch_us_news.py
3. 实现 fetch_cn_news.py
4. 实现新闻去重
5. 写入 raw_news
6. 按核心池过滤无关新闻
```

验收：

```text
每 4 小时自动拉取一次新闻
raw_news 中无明显重复
无关新闻被剔除
```

### Phase 3：DeepSeek 事件抽取

任务：

```text
1. 编写 event_extraction prompt
2. 对重要新闻调用 DeepSeek
3. 输出结构化 JSON
4. 写入 company_event
5. 实现失败重试和 JSON 修复
```

验收：

```text
MU 的新闻能归类到存储芯片 / HBM
NVDA 的新闻能归类到 AI 算力
无关新闻 is_relevant=false
```

### Phase 4：行情位置与分数

任务：

```text
1. 拉取核心标的行情快照
2. 计算 MA20 / MA60 / MA250
3. 计算 20 日涨幅、回撤、距离高点
4. 计算 news_score
5. 计算 price_position_score
6. 生成 opportunity_decision
```

验收：

```text
系统可以输出：
- 继续强关注
- 回调买入候选
- 风险过高
```

### Phase 5：AI 机会卡片

任务：

```text
1. 编写 decision_summary prompt
2. 用规则决策 + 事件 + 行情生成机会解释
3. 前端展示 OpportunityCard
4. 支持按更新时间排序
5. 支持查看证据新闻
```

验收：

```text
每个核心标的都有：
- 当前结论
- AI 判断
- 买入触发条件
- 风险
- 证据事件
```

### Phase 6：发现候选池

任务：

```text
1. 从 DeepSeek 输出 new_company_mentions
2. 写入 discovered_candidates
3. 前端展示待确认候选
4. 支持加入核心池 / 关联池 / 忽略
```

验收：

```text
陌生公司不会直接进入推荐池
只有用户确认后才进入 watchlist_core
```

---

## 19. 示例输出

```markdown
# 今日自选科技机会雷达

## 今日核心池机会变化

### MU / Micron Technology
- 当前结论：回调买入候选
- 变化：存储需求新闻继续偏强，HBM 相关叙事增强
- 市场预期：偏高
- 买点状态：未触发，等待回调
- 风险：股价可能已部分反映利好

### NVDA / NVIDIA
- 当前结论：继续强关注，但不追高
- 变化：AI 算力需求仍强
- 市场预期：很高
- 买点状态：未触发
- 风险：估值和拥挤度高

## 关联信号

- Samsung HBM 进展影响 MU 供需判断
- TSMC CapEx 变化影响 NVDA 供应链判断
- CXMT IPO / 扩产新闻影响国产存储主题

## 新发现候选

- 暂无，或展示等待用户确认的新公司
```

---

## 20. Codex 实现注意事项

1. 不要一次性实现全部功能，按 Phase 逐步提交。
2. 所有外部 API 调用必须封装成独立模块。
3. 所有 DeepSeek 调用必须有超时、重试和 JSON 解析保护。
4. 所有新闻必须先去重再入库。
5. 所有推荐必须能追溯到 `company_event` 和 `raw_news`。
6. 前端不允许直接访问第三方行情 API。
7. Supabase service role key 只能在服务端或 GitHub Actions 中使用。
8. 任何未在 `watchlist_core` 中的公司，不得直接出现在“推荐买入候选”区域。
9. 发现的新公司只能进入 `discovered_candidates`，等待用户确认。
10. 所有 AI 输出必须保留模型名、输入摘要、创建时间，方便复盘。

---

## 21. 外部官方文档参考

- GitHub Actions schedule / cron：`https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions`
- Supabase REST API：`https://supabase.com/docs/guides/api`
- Supabase Python upsert：`https://supabase.com/docs/reference/python/upsert`
- SEC EDGAR API：`https://www.sec.gov/search-filings/edgar-application-programming-interfaces`
- SEC Developer Resources：`https://www.sec.gov/about/developer-resources`

---

## 22. 最终目标

最终系统应该做到：

```text
只围绕用户选中的基金、ETF、股票、公司做深度跟踪；
其他公司只作为产业链和预期差背景；
AI 不直接荐股，而是解释事实、预期差、买点条件和风险；
规则系统决定是否进入机会池；
用户决定是否真正买入。
```
