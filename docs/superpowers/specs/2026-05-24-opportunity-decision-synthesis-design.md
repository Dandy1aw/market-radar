# Opportunity Decision Synthesis Design

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** watch_conditions / risk_factors LLM 合成 + 证据展示优化

---

## 问题

`buildWatchConditions` 和 `buildRiskFactors` 是纯模板函数，输出固定字符串（如"跟踪后续新闻是否强化当前主题"），与具体证据内容无关，信息量接近零。证据区展示原始结构字段，格式嘈杂。

---

## 目标

1. `watch_conditions` 和 `risk_factors` 由 LLM 基于当次证据事件综合生成，中文，内容专属于该标的当前局面。
2. 证据区简化为一行一条 event_summary bullet 列表，无标签。
3. 提取阶段的 `event_summary` 改为中文输出。

---

## 架构

变更分四层：

| 层 | 文件 | 变更类型 |
|---|---|---|
| LLM 合成层 | `lib/opportunity/decision-synthesis.ts`（新建） | 新增 |
| 管道层 | `lib/opportunity/pipeline.ts` | 新增 synthesis step |
| 提取层 | `lib/opportunity/event-extraction.ts` | 小改 prompt |
| UI 层 | `components/opportunity/OpportunityCard.tsx` | 改证据区 |

`buildWatchConditions` / `buildRiskFactors`（`decision.ts`）保留，作无事件标的的兜底。

---

## 详细设计

### 1. `decision-synthesis.ts`

**类型定义：**

```ts
export interface SynthesizeDecisionInput {
  target: OpportunityCoreTarget;
  events: OpportunityCompanyEvent[];      // 含 raw_payload（key_facts、positive/negative_factors、uncertainty）
  indicator: OpportunityIndicatorSnapshot;
}

export interface SynthesizedDecision {
  watch_conditions: string[];   // 3-4 条，简体中文，≤35字/条，基于证据
  risk_factors: string[];       // 2-4 条，简体中文，≤35字/条，基于证据
}
```

**Prompt 约束：**
- 严格 JSON，不加 markdown
- 简体中文
- watch_conditions：基于正向因素、不确定项、供需逻辑，写具体观察结论（不得是泛化模板）
- risk_factors：基于负向因素、指标高位、风险项，写具体警示（不得是泛化模板）
- 每条 ≤35 字

**输出 JSON schema 示例：**
```json
{
  "watch_conditions": [
    "三星HBM认证若获批将直接压缩MU市场份额，需持续追踪认证进度",
    "关注本季度存储价格环比变化，确认需求回升是否持续"
  ],
  "risk_factors": [
    "20日已涨18%，短期获利了结压力大",
    "供应链中存在负向事件，需观察影响是否扩散"
  ]
}
```

**导出函数：**
```ts
export async function synthesizeOpportunityDecision(
  input: Omit<SynthesizeDecisionInput, never>,
  chat: ChatFn,
  model: string,
): Promise<SynthesizedDecision | null>
```

---

### 2. `pipeline.ts` — 新增 synthesis step

**`RunOpportunityNewsPipelineInput` 新增字段：**
```ts
synthesizeDecision?: (
  input: SynthesizeDecisionInput,
) => Promise<SynthesizedDecision | null>;
```
可选。不传则跳过合成，全部用模板兜底（测试 / 离线场景）。

**管道新增步骤**（在 `insertCompanyEvents` 之后、`buildOpportunityCards` 之前）：

```
1. 按 symbol 分组 opportunityEvents
2. for each symbol with events:
     indicator = indicatorBySymbol.get(symbol)
     target    = coreTargets.find(t => t.symbol === symbol)
     if indicator && target && synthesizeDecision:
       result = await synthesizeDecision({ target, events, indicator })
       synthesizedBySymbol.set(symbol, result)
3. buildOpportunityCards(原有参数, synthesizedBySymbol)
```

`buildOpportunityCards` 新增可选参数 `synthesizedBySymbol?: Map<string, SynthesizedDecision>`：
- 有对应合成结果 → 用 `synthesized.watch_conditions` / `synthesized.risk_factors`
- 无 → 调 `buildWatchConditions` / `buildRiskFactors` 模板兜底

**`PipelineSummary` 新增字段：**
```ts
decisionsynthesized: number;   // 本次合成的标的数
```

---

### 3. `event-extraction.ts` — summary 改中文

在 `buildEventExtractionPrompt` 中新增一行指令：

> `Write the "summary" field in Simplified Chinese (简体中文), under 30 characters.`

同步更新 `EVENT_JSON_SCHEMA` 示例的 summary 为中文。

其余字段（key_facts、positive_factors、negative_factors）保持英文（供内部逻辑使用），只有 `summary` 改中文（直接在 UI 展示）。

---

### 4. `OpportunityCard.tsx` — 证据区

**新逻辑：**
```
数据源优先级：
  1. evidence_events[].event_summary（一条事件一行）
  2. 兜底：evidence_news[].title（一条新闻一行）

格式：
  - 无标签
  - 纯 <ul> bullet 列表，text-sm
  - 折叠按钮保留，展示条数 = items.length
```

移除之前引入的 `{ text, reason }` 双行格式和"是什么/为什么"标签。

---

## 兜底与降级

| 场景 | 行为 |
|---|---|
| `synthesizeDecision` 未注入 | 全部用模板 |
| `synthesizeDecision` 返回 `null`（LLM 失败） | 模板兜底 |
| 标的无 evidenceEvents | 跳过合成，模板兜底 |
| `event_summary` 为空 | 显示 `evidence_news[].title` |

---

## 不在本次范围内

- 历史事件的 synthesis 补跑（只对当次管道运行的事件合成）
- 证据的中文翻译（仅 event_summary 改中文，原始新闻标题保持英文）
- `watch_conditions` / `risk_factors` 的多语言支持
