import { parseJsonWithRepair } from './llm-json';
import type {
  OpportunityCompanyEvent,
  OpportunityCoreTarget,
  OpportunityIndicatorSnapshot,
} from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface SynthesizeDecisionInput {
  target: OpportunityCoreTarget;
  events: OpportunityCompanyEvent[];
  indicator: OpportunityIndicatorSnapshot;
}

export interface SynthesizedDecision {
  watch_conditions: string[];
  risk_factors: string[];
}

const SYNTHESIS_JSON_SCHEMA = `{
  "watch_conditions": [
    "三星HBM认证若获批将直接压缩MU份额，需持续追踪认证进度",
    "关注本季度存储价格环比变化，确认需求回升是否持续"
  ],
  "risk_factors": [
    "20日已涨18%，短期获利了结压力大",
    "供应链存在负向事件，需观察影响是否扩散"
  ]
}`;

function formatEventsForPrompt(events: OpportunityCompanyEvent[]): string {
  if (events.length === 0) return '(no events this run)';
  return events
    .map((e, i) => {
      const p = e.raw_payload;
      const positive = Array.isArray(p?.positive_factors)
        ? (p.positive_factors as string[]).join('; ')
        : '';
      const negative = Array.isArray(p?.negative_factors)
        ? (p.negative_factors as string[]).join('; ')
        : '';
      const uncertainty = Array.isArray(p?.uncertainty)
        ? (p.uncertainty as string[]).join('; ')
        : '';
      return [
        `Event ${i + 1}: [${e.event_type}/${e.event_direction}] importance=${e.importance_score}`,
        `  Summary: ${e.event_summary}`,
        positive && `  Positive: ${positive}`,
        negative && `  Negative: ${negative}`,
        uncertainty && `  Uncertainty: ${uncertainty}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildSynthesisPrompt({ target, events, indicator }: SynthesizeDecisionInput): string {
  return `You are a technology investing analyst generating monitoring conditions and risk warnings in Simplified Chinese.

Return strict JSON only. Do not wrap in markdown. Base your output on the provided evidence — do not use generic templates.

Target:
- Symbol: ${target.symbol} | ${target.name}
- Theme: ${target.theme}
- Notes: ${target.notes || 'none'}

Current indicators:
- 20-day price change: ${indicator.pct_change_20d != null ? `${indicator.pct_change_20d.toFixed(1)}%` : 'n/a'}
- Distance from 500-day MA: ${indicator.pct_from_ma500 != null ? `${indicator.pct_from_ma500.toFixed(1)}%` : 'n/a'}
- Volume ratio: ${indicator.volume_ratio != null ? indicator.volume_ratio.toFixed(2) : 'n/a'}
- Risk level: ${indicator.risk_level ?? 'n/a'}

Evidence events this run:
${formatEventsForPrompt(events)}

Output rules:
- watch_conditions: 3-4 items, each ≤35 Chinese characters, concrete and specific to the above evidence
- risk_factors: 2-4 items, each ≤35 Chinese characters, concrete and specific to the above indicators/events
- Simplified Chinese only
- No generic phrases without a specific subject from the evidence above

Return JSON with exactly this shape:
${SYNTHESIS_JSON_SCHEMA}`;
}

export async function synthesizeOpportunityDecision(
  input: SynthesizeDecisionInput,
  chat: ChatFn,
): Promise<SynthesizedDecision | null> {
  const prompt = buildSynthesisPrompt(input);
  try {
    const response = await chat([{ role: 'user', content: prompt }]);
    const result = await parseJsonWithRepair<SynthesizedDecision>({
      rawText: response,
      repair: (invalidJson) =>
        chat([
          {
            role: 'system',
            content: 'Repair this into valid strict JSON only. Do not add prose.',
          },
          { role: 'user', content: invalidJson },
        ]),
    });
    if (!Array.isArray(result?.watch_conditions) || !Array.isArray(result?.risk_factors)) {
      return null;
    }
    return {
      watch_conditions: result.watch_conditions,
      risk_factors: result.risk_factors,
    };
  } catch {
    return null;
  }
}
