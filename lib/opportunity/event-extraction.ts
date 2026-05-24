import { parseJsonWithRepair } from './llm-json';
import type { FilteredNews } from './news-filter';
import type {
  ExtractedOpportunityEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
} from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

interface BuildEventExtractionPromptInput {
  filtered: FilteredNews;
  coreTargets: OpportunityCoreTarget[];
  contextEntities: OpportunityContextEntity[];
}

export interface ExtractOpportunityEventInput extends BuildEventExtractionPromptInput {
  chat: ChatFn;
  model: string;
}

type RawExtractedOpportunityEvent = Omit<
  ExtractedOpportunityEvent,
  'raw_llm_json' | 'llm_input_summary' | 'llm_model'
>;

const EVENT_JSON_SCHEMA = `{
  "is_relevant": true,
  "related_core_symbols": ["MU"],
  "related_context_entities": ["Samsung Memory"],
  "theme": "HBM / memory cycle",
  "event_type": "competition",
  "event_direction": "positive",
  "importance_score": 78,
  "summary": "Samsung HBM certification delay may keep near-term HBM supply tight.",
  "key_facts": ["Samsung HBM certification timeline reportedly slipped again."],
  "positive_factors": ["Tighter HBM supply may support MU's competitive setup."],
  "negative_factors": [],
  "supply_chain_mentions": ["Samsung Memory"],
  "new_company_mentions": [],
  "uncertainty": [],
  "evidence": [
    {
      "text": "Samsung HBM certification timeline reportedly slips again",
      "reason": "This directly supports the extracted event."
    }
  ]
}`;

function summarizeCoreTargets(coreTargets: OpportunityCoreTarget[]): string {
  return coreTargets
    .filter((target) => target.is_active)
    .map(
      (target) =>
        `- ${target.symbol} | ${target.name} | ${target.market} | ${target.asset_type} | ${target.theme}`,
    )
    .join('\n');
}

function summarizeContext(contextEntities: OpportunityContextEntity[]): string {
  return contextEntities
    .filter((entity) => entity.is_active)
    .map(
      (entity) =>
        `- ${entity.core_symbol} <= ${entity.related_name}${
          entity.related_symbol ? ` (${entity.related_symbol})` : ''
        } | ${entity.relation_type} | strength=${entity.relation_strength}`,
    )
    .join('\n');
}

export function buildEventExtractionPrompt({
  filtered,
  coreTargets,
  contextEntities,
}: BuildEventExtractionPromptInput): string {
  return `You are a technology investing research assistant extracting structured event facts from news.

Return strict JSON only. Do not wrap the response in markdown. Do not output buy or sell instructions. Do not invent facts. The rule engine owns decision_level; you only extract evidence-backed events.

Allowed event_type values: demand, competition, product, supply_chain, earnings_risk, macro, price_action.
Allowed event_direction values: positive, neutral, negative, mixed.

Active core watchlist:
${summarizeCoreTargets(coreTargets)}

Active context entities:
${summarizeContext(contextEntities)}

Rule pre-filter:
- matched core symbols: ${filtered.matched_core_symbols.join(', ') || 'none'}
- matched context entities: ${
    filtered.matched_context.map((match) => match.related_name).join(', ') || 'none'
  }
- matched themes: ${filtered.matched_themes.join(', ') || 'none'}
- rule confidence: ${filtered.rule_confidence}

News input:
${filtered.llm_input_summary}

Return JSON with exactly this shape:
${EVENT_JSON_SCHEMA}`;
}

function normalizeExtractedEvent(
  raw: RawExtractedOpportunityEvent,
): RawExtractedOpportunityEvent {
  return {
    is_relevant: Boolean(raw.is_relevant),
    related_core_symbols: raw.related_core_symbols ?? [],
    related_context_entities: raw.related_context_entities ?? [],
    theme: raw.theme ?? '',
    event_type: raw.event_type,
    event_direction: raw.event_direction,
    importance_score: Number(raw.importance_score ?? 0),
    summary: raw.summary ?? '',
    key_facts: raw.key_facts ?? [],
    positive_factors: raw.positive_factors ?? [],
    negative_factors: raw.negative_factors ?? [],
    supply_chain_mentions: raw.supply_chain_mentions ?? [],
    new_company_mentions: raw.new_company_mentions ?? [],
    uncertainty: raw.uncertainty ?? [],
    evidence: raw.evidence ?? [],
  };
}

export async function extractOpportunityEvent({
  filtered,
  coreTargets,
  contextEntities,
  chat,
  model,
}: ExtractOpportunityEventInput): Promise<ExtractedOpportunityEvent | null> {
  const prompt = buildEventExtractionPrompt({
    filtered,
    coreTargets,
    contextEntities,
  });
  const response = await chat([{ role: 'user', content: prompt }]);
  const raw = await parseJsonWithRepair<RawExtractedOpportunityEvent>({
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
  const normalized = normalizeExtractedEvent(raw);

  if (!normalized.is_relevant) {
    return null;
  }

  return {
    ...normalized,
    raw_llm_json: raw as unknown as Record<string, unknown>,
    llm_input_summary: filtered.llm_input_summary,
    llm_model: model,
  };
}
