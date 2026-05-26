// scripts/process-cn-news.ts
// Run via: npx tsx scripts/process-cn-news.ts
import { loadEnvConfig } from '@next/env';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

import { chatCompletion, getLlmModelName } from '../lib/llm/client';
import { parseJsonWithRepair } from '../lib/opportunity/llm-json';

loadEnvConfig(process.cwd());

const PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), 'prompts/cn_news_event_extraction.md'),
  'utf-8',
);

const THEME_KEYWORDS = [
  '半导体', '存储芯片', '国产替代', '光模块', 'AI服务器',
  '液冷', '算力', '人工智能', '机器人', '新能源',
];

const MAX_LLM_CALLS = Number(process.env.MAX_CN_DEEPSEEK_CALLS_PER_RUN ?? '20');
const LOOKBACK_HOURS = Number(process.env.CN_NEWS_LOOKBACK_HOURS ?? '8');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface CnRawNews {
  id: number;
  source: string;
  source_type: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  published_at: string | null;
  related_symbol: string | null;
  confidence_level: string;
  raw_json: Record<string, unknown>;
}

interface CnAnnouncement {
  id: number;
  symbol: string;
  name: string | null;
  title: string;
  announcement_type: string | null;
  url: string | null;
  published_at: string | null;
  confidence_level: string;
}

interface CnTarget {
  symbol: string;
  name: string;
  theme: string;
  notes: string;
}

interface ExtractedCnEvent {
  is_relevant: boolean;
  related_core_symbols: string[];
  theme: string;
  cn_event_type: string;
  event_type: string;
  event_direction: 'positive' | 'neutral' | 'negative' | 'mixed';
  importance_score: number;
  cn_confidence_level: string;
  event_summary: string;
  watch_points: string[];
  risk_notes: string[];
  positive_factors: string[];
  negative_factors: string[];
  uncertainty: string[];
  evidence: { text: string; reason: string }[];
}

async function loadCnTargets(client: ReturnType<typeof adminClient>): Promise<CnTarget[]> {
  const { data, error } = await client
    .from('watchlist_core')
    .select('symbol,name,theme,notes')
    .eq('market', 'CN')
    .eq('is_active', true);
  if (error) throw new Error(`[loadCnTargets] ${error.message}`);
  return (data ?? []) as CnTarget[];
}

async function loadRecentCnNews(
  client: ReturnType<typeof adminClient>,
  sinceIso: string,
): Promise<CnRawNews[]> {
  const { data, error } = await client
    .from('raw_cn_news')
    .select('id,source,source_type,title,summary,content,url,published_at,related_symbol,confidence_level,raw_json')
    .gte('fetched_at', sinceIso)
    .order('published_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`[loadRecentCnNews] ${error.message}`);
  return (data ?? []) as CnRawNews[];
}

async function loadRecentCnAnnouncements(
  client: ReturnType<typeof adminClient>,
  sinceIso: string,
): Promise<CnAnnouncement[]> {
  const { data, error } = await client
    .from('raw_cn_announcement')
    .select('id,symbol,name,title,announcement_type,url,published_at,confidence_level')
    .gte('fetched_at', sinceIso)
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`[loadRecentCnAnnouncements] ${error.message}`);
  return (data ?? []) as CnAnnouncement[];
}

function buildPrompt(
  documentText: string,
  source: string,
  confidenceLevel: string,
  targets: CnTarget[],
): string {
  const watchlistSummary = targets
    .map(t => `${t.symbol} ${t.name} [${t.theme}]`)
    .join('\n');
  return PROMPT_TEMPLATE
    .replaceAll('{{watchlist_core}}', watchlistSummary)
    .replaceAll('{{theme_keywords}}', THEME_KEYWORDS.join(', '))
    .replaceAll('{{document_text}}', documentText.slice(0, 3000))
    .replaceAll('{{source}}', source)
    .replaceAll('{{confidence_level}}', confidenceLevel);
}

async function extractCnEvent(
  text: string,
  source: string,
  confidenceLevel: string,
  targets: CnTarget[],
): Promise<ExtractedCnEvent | null> {
  const prompt = buildPrompt(text, source, confidenceLevel, targets);
  const raw = await chatCompletion([{ role: 'user', content: prompt }], {
    temperature: 0.1,
    maxTokens: 900,
  });
  return parseJsonWithRepair<ExtractedCnEvent>({
    rawText: raw,
    repair: (invalid) =>
      chatCompletion(
        [
          { role: 'system', content: 'Repair this into valid strict JSON only. Output JSON only.' },
          { role: 'user', content: invalid },
        ],
        { temperature: 0, maxTokens: 900 },
      ),
  });
}

async function insertCnCompanyEvent(
  client: ReturnType<typeof adminClient>,
  symbol: string,
  companyName: string,
  event: ExtractedCnEvent,
  evidenceNewsIds: number[],
  model: string,
  sourceType: string,
  sourceLabel: string,
): Promise<number | null> {
  const row = {
    symbol,
    market: 'CN',
    company_name: companyName,
    theme: event.theme,
    event_type: event.event_type as string,
    event_direction: event.event_direction,
    importance_score: event.importance_score,
    event_summary: event.event_summary,
    evidence_news_ids: evidenceNewsIds,
    published_at: new Date().toISOString(),
    raw_llm_json: {
      ...event,
      cn_event_type: event.cn_event_type,
      cn_confidence_level: event.cn_confidence_level,
      cn_source_type: sourceType,
      cn_source_label: sourceLabel,
      watch_points: event.watch_points,
      risk_notes: event.risk_notes,
    },
    llm_input_summary: `CN news for ${symbol}`,
    llm_model: model,
    extraction_status: 'ok',
  };
  const { data, error } = await client.from('company_event').insert(row).select('id');
  if (error) { console.error('[insertCnCompanyEvent]', error.message); return null; }
  return (data?.[0] as { id: number } | undefined)?.id ?? null;
}

async function upsertCnOpportunityDecision(
  client: ReturnType<typeof adminClient>,
  target: CnTarget,
  events: Array<{ id: number; event: ExtractedCnEvent }>,
): Promise<void> {
  if (events.length === 0) return;

  const positiveCount = events.filter(e => e.event.event_direction === 'positive').length;
  const negativeCount = events.filter(e => e.event.event_direction === 'negative').length;
  const maxImportance = Math.max(...events.map(e => e.event.importance_score));
  const topConfidence = events.some(e => e.event.cn_confidence_level === 'high')
    ? 'high'
    : events.some(e => e.event.cn_confidence_level === 'medium')
      ? 'medium'
      : 'low';

  const newsScore = Math.min(10, Math.round(maxImportance));
  const riskScore = negativeCount > 0 ? -Math.min(5, negativeCount * 2) : 0;
  const totalScore = newsScore + riskScore + (topConfidence === 'high' ? 2 : 0);

  let decisionLevel: string;
  if (negativeCount > positiveCount) {
    decisionLevel = 'risk_high';
  } else if (totalScore >= 8) {
    decisionLevel = 'strong_watch';
  } else if (totalScore >= 5) {
    decisionLevel = 'pullback_candidate';
  } else {
    decisionLevel = 'post_earnings_wait';
  }

  const topEvent = events[0].event;
  const watchConditions = topEvent.watch_points ?? [];
  const riskFactors = topEvent.risk_notes ?? [];

  const row = {
    symbol: target.symbol,
    market: 'CN',
    company_name: target.name,
    asset_type: 'stock',
    theme: topEvent.theme || target.theme,
    decision_level: decisionLevel,
    total_score: totalScore,
    news_score: newsScore,
    price_position_score: 0,
    context_signal_score: 0,
    risk_score: riskScore,
    summary: topEvent.event_summary,
    watch_conditions: watchConditions,
    risk_factors: riskFactors,
    evidence_event_ids: events.map(e => e.id),
  };

  // No unique constraint on (symbol, market) — delete then insert
  const { error: deleteErr } = await client
    .from('opportunity_decision')
    .delete()
    .eq('symbol', target.symbol)
    .eq('market', 'CN');
  if (deleteErr) console.error('[upsertCnOpportunityDecision] delete error:', deleteErr.message);

  const { error } = await client.from('opportunity_decision').insert(row);
  if (error) console.error('[upsertCnOpportunityDecision]', error.message);
}

async function main(): Promise<void> {
  const missingEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LLM_API_KEY']
    .filter(k => !process.env[k]);
  if (missingEnv.length > 0) throw new Error(`Missing required env vars: ${missingEnv.join(', ')}`);

  const client = adminClient();
  const model = getLlmModelName();

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const targets = await loadCnTargets(client);
  const allNews = await loadRecentCnNews(client, sinceIso);
  const allAnnouncements = await loadRecentCnAnnouncements(client, sinceIso);

  console.log(`[process-cn-news] targets=${targets.length} news=${allNews.length} ann=${allAnnouncements.length}`);

  let llmCallCount = 0;

  for (const target of targets) {
    if (llmCallCount >= MAX_LLM_CALLS) break;

    const relevantNews = allNews.filter(n => n.related_symbol === target.symbol);
    const relevantAnn = allAnnouncements.filter(a => a.symbol === target.symbol);

    const items: Array<{ text: string; source: string; source_type: string; source_label: string; confidence: string; ids: number[] }> = [
      ...relevantAnn.map(a => ({
        text: `${a.title}\n${a.announcement_type ?? ''}`,
        source: `巨潮资讯 (${a.announcement_type ?? '公告'})`,
        source_type: 'announcement',
        source_label: '巨潮资讯',
        confidence: a.confidence_level,
        ids: [a.id],
      })),
      ...relevantNews.slice(0, 3).map(n => ({
        text: `${n.title}\n${n.summary ?? ''}\n${n.content?.slice(0, 500) ?? ''}`,
        source: n.source,
        source_type: n.source_type ?? 'company_news',
        source_label: n.source,
        confidence: n.confidence_level,
        ids: [n.id],
      })),
    ];

    if (items.length === 0) continue;

    const extractedEvents: Array<{ id: number; event: ExtractedCnEvent }> = [];

    for (const item of items.slice(0, 3)) {
      if (llmCallCount >= MAX_LLM_CALLS) break;
      llmCallCount++;

      let event: ExtractedCnEvent | null;
      try {
        event = await extractCnEvent(item.text, item.source, item.confidence, targets);
      } catch (err) {
        console.error(`[process-cn-news] extractCnEvent failed for ${target.symbol}:`, err);
        continue;
      }
      if (!event || !event.is_relevant) continue;

      const eventId = await insertCnCompanyEvent(
        client,
        target.symbol,
        target.name,
        event,
        item.ids,
        model,
        item.source_type,
        item.source_label,
      );
      if (eventId !== null) {
        extractedEvents.push({ id: eventId, event });
      }
    }

    await upsertCnOpportunityDecision(client, target, extractedEvents);
  }

  console.log(`[process-cn-news] Done. LLM calls used: ${llmCallCount}/${MAX_LLM_CALLS}`);
}

main().catch(err => { console.error(err); process.exit(1); });
