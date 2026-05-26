// lib/cn-news/queries.ts
import { createClient } from '@supabase/supabase-js';
import type { CnNewsApiResponse, CnNewsCardData, CnEventDirection, CnConfidenceLevel, CnSourceType } from './types';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface DecisionRow {
  id: number;
  symbol: string;
  company_name: string;
  theme: string;
  decision_level: string;
  total_score: number;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_event_ids: number[] | null;
  created_at: string;
}

interface EventRow {
  id: number;
  event_direction: string;
  importance_score: number;
  event_summary: string;
  raw_llm_json: Record<string, unknown>;
}

function mapEventToCard(
  decision: DecisionRow,
  topEvent: EventRow | undefined,
): CnNewsCardData {
  const llmJson = topEvent?.raw_llm_json ?? {};

  return {
    symbol: decision.symbol,
    company_name: decision.company_name,
    theme: decision.theme,
    event_direction: (topEvent?.event_direction ?? 'neutral') as CnEventDirection,
    confidence_level: (llmJson.cn_confidence_level ?? 'medium') as CnConfidenceLevel,
    source_type: (llmJson.cn_source_type ?? 'company_news') as CnSourceType,
    source_label: String(llmJson.cn_source_label ?? '东方财富'),
    event_type: String(llmJson.cn_event_type ?? '资讯'),
    importance_score: Number(topEvent?.importance_score ?? 0),
    event_summary: decision.summary,
    watch_points: Array.isArray(llmJson.watch_points) ? llmJson.watch_points as string[] : [],
    risk_notes: Array.isArray(llmJson.risk_notes) ? llmJson.risk_notes as string[] : [],
    evidence: Array.isArray(llmJson.evidence)
      ? (llmJson.evidence as Array<{ text: string }>).map(e => e.text)
      : [],
    updated_at: decision.created_at,
  };
}

const EMPTY_RESPONSE: CnNewsApiResponse = {
  updated_at: '',
  summary: { total: 0, positive: 0, negative: 0, high_confidence: 0 },
  cards: [],
};

export async function getCnNewsData(): Promise<CnNewsApiResponse> {
  const client = adminClient();
  try {
  const { data: decisions, error: dErr } = await client
    .from('opportunity_decision')
    .select('id,symbol,company_name,theme,decision_level,total_score,summary,watch_conditions,risk_factors,evidence_event_ids,created_at')
    .eq('market', 'CN')
    .order('created_at', { ascending: false })
    .limit(50);

  if (dErr) throw dErr;
  if (!decisions || decisions.length === 0) {
    return { updated_at: new Date().toISOString(), summary: { total: 0, positive: 0, negative: 0, high_confidence: 0 }, cards: [] };
  }

  const latestBySymbol = new Map<string, DecisionRow>();
  for (const d of decisions as DecisionRow[]) {
    if (!latestBySymbol.has(d.symbol)) latestBySymbol.set(d.symbol, d);
  }
  const uniqueDecisions = Array.from(latestBySymbol.values());

  const allEventIds = uniqueDecisions.flatMap(d => d.evidence_event_ids ?? []);

  let events: EventRow[] = [];
  if (allEventIds.length > 0) {
    const { data: evData, error: evErr } = await client
      .from('company_event')
      .select('id,event_direction,importance_score,event_summary,raw_llm_json')
      .in('id', allEventIds);
    if (evErr) throw evErr;
    events = (evData ?? []) as EventRow[];
  }

  const eventMap = new Map(events.map(e => [e.id, e]));

  const cards: CnNewsCardData[] = uniqueDecisions.map(d => {
    const topEventId = d.evidence_event_ids?.[0];
    const topEvent = topEventId !== undefined ? eventMap.get(topEventId) : undefined;
    return mapEventToCard(d, topEvent);
  });

  const summary = {
    total: cards.length,
    positive: cards.filter(c => c.event_direction === 'positive').length,
    negative: cards.filter(c => c.event_direction === 'negative').length,
    high_confidence: cards.filter(c => c.confidence_level === 'high').length,
  };

  return {
    updated_at: uniqueDecisions[0]?.created_at ?? new Date().toISOString(),
    summary,
    cards,
  };
  } catch (err) {
    console.error('[getCnNewsData]', err);
    return { ...EMPTY_RESPONSE, updated_at: new Date().toISOString() };
  }
}
