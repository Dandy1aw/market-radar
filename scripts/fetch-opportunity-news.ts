// Run via: npx tsx scripts/fetch-opportunity-news.ts
import { loadEnvConfig } from '@next/env';

import { fetchCompanyNews } from '../lib/data-sources/finnhub';
import { chatCompletion, getLlmModelName } from '../lib/llm/client';
import { buildCandidateValidationPrompt } from '../lib/opportunity/candidate-validation';
import { extractOpportunityEvent } from '../lib/opportunity/event-extraction';
import { parseJsonWithRepair } from '../lib/opportunity/llm-json';
import { runOpportunityNewsPipeline } from '../lib/opportunity/pipeline';
import { seedIndicators } from '../lib/opportunity/seed';
import {
  getContextEntities,
  getCoreTargets,
  insertCompanyEvents,
  replaceLatestOpportunityDecisions,
  upsertContextFromCandidate,
  upsertCoreFromCandidate,
  upsertDiscoveredCandidate,
  upsertRawNews,
} from '../lib/supabase/opportunity-ingestion';
import type {
  CandidateValidationDecision,
  ExtractedCompanyMention,
  OpportunityCoreTarget,
} from '../lib/opportunity/types';
import type { NewsLike } from '../lib/opportunity/news-dedupe';

loadEnvConfig(process.cwd());

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FINNHUB_API_KEY',
  'LLM_API_KEY',
] as const;

function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dateRange(): { from: string; to: string } {
  const lookbackDays = numberEnv('OPPORTUNITY_NEWS_LOOKBACK_DAYS', 1);
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - lookbackDays);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapFinnhubNews(symbol: string, item: Awaited<ReturnType<typeof fetchCompanyNews>>[number]): NewsLike {
  return {
    source: item.source || 'finnhub',
    source_type: 'company_news',
    title: item.title,
    summary: item.summary || null,
    content: null,
    url: item.url || null,
    published_at: new Date(item.datetime * 1000).toISOString(),
    lang: 'en',
    raw_json: { ...item, symbol },
  };
}

async function fetchNewsForCoreTargets(coreTargets: OpportunityCoreTarget[]): Promise<NewsLike[]> {
  const apiKey = process.env.FINNHUB_API_KEY!;
  const { from, to } = dateRange();
  const activeUsTargets = coreTargets.filter(
    (target) => target.is_active && target.market === 'US' && target.symbol,
  );
  const news: NewsLike[] = [];

  for (const target of activeUsTargets) {
    const items = await fetchCompanyNews(target.symbol, from, to, apiKey);
    news.push(...items.map((item) => mapFinnhubNews(target.symbol, item)));
    await sleep(1000);
  }

  return news;
}

async function validateCandidateWithLlm({
  mention,
  coreTargets,
  contextEntities,
  evidenceNewsIds,
  sourceSummary,
}: {
  mention: ExtractedCompanyMention;
  coreTargets: Awaited<ReturnType<typeof getCoreTargets>>;
  contextEntities: Awaited<ReturnType<typeof getContextEntities>>;
  evidenceNewsIds: number[];
  sourceSummary: string;
}): Promise<{ decision: CandidateValidationDecision } | null> {
  const prompt = buildCandidateValidationPrompt({
    mention,
    coreTargets,
    contextEntities,
    evidenceNewsIds,
    sourceSummary,
  });
  const raw = await chatCompletion([{ role: 'user', content: prompt }], {
    temperature: 0.1,
    maxTokens: 700,
  });
  const decision = await parseJsonWithRepair<CandidateValidationDecision>({
    rawText: raw,
    repair: (invalidJson) =>
      chatCompletion(
        [
          {
            role: 'system',
            content: 'Repair this into valid strict JSON only. Do not add prose.',
          },
          { role: 'user', content: invalidJson },
        ],
        { temperature: 0, maxTokens: 700 },
      ),
  });

  return { decision };
}

async function main(): Promise<void> {
  assertRequiredEnv();

  const coreTargets = await getCoreTargets();
  const contextEntities = await getContextEntities();
  const summary = await runOpportunityNewsPipeline({
    coreTargets,
    contextEntities,
    indicators: seedIndicators,
    fetchNews: () => fetchNewsForCoreTargets(coreTargets),
    extractEvent: ({ filtered }) =>
      extractOpportunityEvent({
        filtered,
        coreTargets,
        contextEntities,
        chat: (messages) => chatCompletion(messages, { temperature: 0.1, maxTokens: 900 }),
        model: getLlmModelName(),
      }),
    validateCandidate: ({ mention, evidenceNewsIds, sourceSummary }) =>
      validateCandidateWithLlm({
        mention,
        coreTargets,
        contextEntities,
        evidenceNewsIds,
        sourceSummary,
      }),
    persist: {
      upsertRawNews,
      insertCompanyEvents,
      replaceLatestOpportunityDecisions,
      upsertDiscoveredCandidate,
      upsertContextFromCandidate,
      upsertCoreFromCandidate,
    },
    limits: {
      maxNewsPerRun: numberEnv('OPPORTUNITY_MAX_NEWS_PER_RUN', 50),
      maxLlmCallsPerRun: numberEnv('OPPORTUNITY_MAX_LLM_CALLS_PER_RUN', 20),
    },
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
