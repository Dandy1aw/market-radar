import type { NewsWithHash } from './news-dedupe';
import type { OpportunityContextEntity, OpportunityCoreTarget } from './types';

const THEME_KEYWORDS: Record<string, string[]> = {
  'HBM / memory cycle': ['hbm', 'dram', 'nand', 'memory supply', 'certification'],
  'AI compute': ['ai compute', 'data center', 'accelerator', 'gpu', 'cloud capex'],
  'AI accelerator competition': [
    'ai accelerator',
    'mi300',
    'mi350',
    'gpu competition',
  ],
  'semiconductor basket': [
    'semiconductor',
    'chip',
    'wafer',
    'advanced packaging',
    'capex',
  ],
  'Nasdaq 100 beta': ['nasdaq', 'mega cap', 'growth stocks'],
};

export interface ContextMatch {
  core_symbol: string;
  related_symbol: string | null;
  related_name: string;
  relation_type: string;
  relation_strength: number;
}

export interface FilteredNews<T extends NewsWithHash = NewsWithHash> {
  news: T;
  matched_core_symbols: string[];
  matched_context: ContextMatch[];
  matched_themes: string[];
  rule_confidence: number;
  llm_input_summary: string;
}

function searchableText(news: NewsWithHash): string {
  return [news.title, news.summary, news.content].filter(Boolean).join(' ').toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(text: string, phrase: string): boolean {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) return false;

  const phrasePattern = normalized.split(/\s+/).map(escapeRegex).join('\\s+');
  const pattern = new RegExp(`(^|[^a-z0-9])${phrasePattern}(?=$|[^a-z0-9])`);
  return pattern.test(text);
}

function hasSymbol(text: string, symbol: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(symbol.toLowerCase())}([^a-z0-9]|$)`);
  return pattern.test(text);
}

interface ContextAlias {
  value: string;
  requireContextTerms: boolean;
}

function contextAliases(entity: OpportunityContextEntity): ContextAlias[] {
  const aliases: ContextAlias[] = [
    { value: entity.related_name, requireContextTerms: false },
  ];

  if (entity.related_symbol) {
    aliases.push({ value: entity.related_symbol, requireContextTerms: false });
  }

  const firstToken = entity.related_name.split(/\s+/)[0];
  if (firstToken && firstToken.length >= 3) {
    aliases.push({ value: firstToken, requireContextTerms: true });
  }

  return aliases;
}

function coreThemeMatches(text: string, core: OpportunityCoreTarget | undefined): boolean {
  if (!core?.is_active) return false;

  const themeKeywords = THEME_KEYWORDS[core.theme] ?? [];
  return themeKeywords.some((keyword) => hasPhrase(text, keyword));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildLlmInputSummary(news: NewsWithHash): string {
  const parts = [`Title: ${news.title}`];

  if (news.summary) {
    parts.push(`Summary: ${news.summary}`);
  }

  if (news.content) {
    parts.push(`Content: ${news.content}`);
  }

  return parts.join('\n').slice(0, 4000);
}

export function extract_context_matches(
  news: NewsWithHash,
  coreWatchlist: OpportunityCoreTarget[],
  context: OpportunityContextEntity[],
): ContextMatch[] {
  const text = searchableText(news);
  const activeCoreBySymbol = new Map(
    coreWatchlist
      .filter((core) => core.is_active)
      .map((core) => [core.symbol, core] as const),
  );

  return context
    .filter((entity) => entity.is_active && activeCoreBySymbol.has(entity.core_symbol))
    .filter((entity) =>
      contextAliases(entity).some((alias) => {
        const core = activeCoreBySymbol.get(entity.core_symbol);
        const matchedAlias =
          entity.related_symbol === alias.value
            ? hasSymbol(text, alias.value)
            : hasPhrase(text, alias.value);

        return (
          matchedAlias &&
          (!alias.requireContextTerms || coreThemeMatches(text, core))
        );
      }),
    )
    .map((entity) => ({
      core_symbol: entity.core_symbol,
      related_symbol: entity.related_symbol,
      related_name: entity.related_name,
      relation_type: entity.relation_type,
      relation_strength: entity.relation_strength,
    }));
}

export function filter_news_by_watchlist<T extends NewsWithHash>(
  newsItems: T[],
  coreWatchlist: OpportunityCoreTarget[],
  context: OpportunityContextEntity[],
): Array<FilteredNews<T>> {
  const activeCore = coreWatchlist.filter((core) => core.is_active);
  const activeThemes = new Set(activeCore.map((core) => core.theme));

  return newsItems.flatMap((item) => {
    const text = searchableText(item);
    const directCoreHits = activeCore
      .filter((core) => hasSymbol(text, core.symbol) || hasPhrase(text, core.name))
      .map((core) => core.symbol);
    const matchedContext = extract_context_matches(item, activeCore, context);
    const matchedThemes = Object.entries(THEME_KEYWORDS)
      .filter(
        ([theme, keywords]) =>
          activeThemes.has(theme) && keywords.some((keyword) => hasPhrase(text, keyword)),
      )
      .map(([theme]) => theme);
    const themeCoreHits = activeCore
      .filter((core) => matchedThemes.includes(core.theme))
      .map((core) => core.symbol);
    const matchedCoreSymbols = unique([
      ...directCoreHits,
      ...matchedContext.map((match) => match.core_symbol),
      ...themeCoreHits,
    ]);

    if (matchedCoreSymbols.length === 0 && matchedThemes.length === 0) {
      return [];
    }

    const confidences = [
      directCoreHits.length > 0 ? 0.9 : 0,
      matchedContext.length > 0 ? 0.8 : 0,
      matchedThemes.length > 0 ? 0.65 : 0,
    ];

    return [
      {
        news: item,
        matched_core_symbols: matchedCoreSymbols,
        matched_context: matchedContext,
        matched_themes: matchedThemes,
        rule_confidence: Math.max(...confidences),
        llm_input_summary: buildLlmInputSummary(item),
      },
    ];
  });
}
