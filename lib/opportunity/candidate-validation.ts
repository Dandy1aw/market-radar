import type {
  CandidateAutoStatus,
  CandidateValidationDecision,
  ExtractedCompanyMention,
  OpportunityContextEntity,
  OpportunityCoreTarget,
} from './types';

const ALLOWED_CONTEXT_RELATIONS: Array<OpportunityContextEntity['relation_type']> = [
  'competitor',
  'supplier',
  'customer',
  'peer',
  'industry_signal',
  'policy_signal',
];

const SUPPORTED_CORE_MARKETS = new Set(['US', 'CN']);

interface BuildCandidateValidationPromptInput {
  mention: ExtractedCompanyMention;
  coreTargets: OpportunityCoreTarget[];
  contextEntities: OpportunityContextEntity[];
  evidenceNewsIds: number[];
  sourceSummary: string;
}

interface ApplyCandidateHardRulesInput {
  decision: CandidateValidationDecision;
  mentionCount: number;
  coreTargets: OpportunityCoreTarget[];
  contextEntities: OpportunityContextEntity[];
}

export interface CandidateHardRuleResult {
  status: CandidateAutoStatus;
  shouldAddContext: boolean;
  shouldAddCore: boolean;
  reason: string;
}

function summarizeCoreTargets(coreTargets: OpportunityCoreTarget[]): string {
  return coreTargets
    .filter((target) => target.is_active)
    .map((target) => `- ${target.symbol}: ${target.name} (${target.theme})`)
    .join('\n');
}

function summarizeContext(contextEntities: OpportunityContextEntity[]): string {
  return contextEntities
    .filter((entity) => entity.is_active)
    .map(
      (entity) =>
        `- ${entity.core_symbol}: ${entity.related_name} | ${entity.relation_type}`,
    )
    .join('\n');
}

export function buildCandidateValidationPrompt({
  mention,
  coreTargets,
  contextEntities,
  evidenceNewsIds,
  sourceSummary,
}: BuildCandidateValidationPromptInput): string {
  return `You are validating whether a newly mentioned company should enter an opportunity engine watchlist.

Return strict JSON only. Choose exactly one decision: add_context, add_core, keep_candidate, reject.
Do not output buy or sell instructions.

Use add_context for companies that are useful background signals for an existing core target.
Use add_core only for a clear, directly trackable security/company that should become a primary tracked object.
Use keep_candidate when evidence is plausible but insufficient.
Use reject when relation to the core watchlist is unclear.

Active core watchlist:
${summarizeCoreTargets(coreTargets)}

Active context watchlist:
${summarizeContext(contextEntities)}

Candidate mention:
${JSON.stringify(mention, null, 2)}

Evidence news ids: ${evidenceNewsIds.join(', ') || 'none'}
Source summary:
${sourceSummary}

relation_type must be exactly one of: competitor, supplier, customer, peer, etf_holding, industry_signal, policy_signal

Return JSON shape:
{
  "decision": "add_context",
  "confidence": 0.86,
  "name": "Samsung Electronics",
  "symbol": "005930.KS",
  "market": "KR",
  "theme": "HBM / memory cycle",
  "related_core_symbol": "MU",
  "relation_type": "competitor",
  "reason": "Samsung HBM progress is a recurring competitive signal for MU.",
  "evidence_news_ids": [2],
  "risk_notes": ["Foreign ticker may not be supported by current market data pipeline."]
}`;
}

function hasActiveCore(
  coreTargets: OpportunityCoreTarget[],
  symbol: string | null,
): boolean {
  return coreTargets.some((target) => target.is_active && target.symbol === symbol);
}

function alreadyContext(
  contextEntities: OpportunityContextEntity[],
  decision: CandidateValidationDecision,
): boolean {
  return contextEntities.some(
    (entity) =>
      entity.is_active &&
      entity.core_symbol === decision.related_core_symbol &&
      entity.relation_type === decision.relation_type &&
      (entity.related_name.toLowerCase() === decision.name.toLowerCase() ||
        (decision.symbol != null && entity.related_symbol === decision.symbol)),
  );
}

function alreadyCore(
  coreTargets: OpportunityCoreTarget[],
  decision: CandidateValidationDecision,
): boolean {
  return coreTargets.some(
    (target) =>
      target.symbol === decision.symbol ||
      target.name.toLowerCase() === decision.name.toLowerCase(),
  );
}

function canAddContext(
  input: ApplyCandidateHardRulesInput,
): CandidateHardRuleResult | null {
  const { decision, coreTargets, contextEntities } = input;

  if (decision.decision !== 'add_context') return null;
  if (decision.confidence < 0.75) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Context confidence is below auto-add threshold.',
    };
  }
  if (!hasActiveCore(coreTargets, decision.related_core_symbol)) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Related core symbol is not active.',
    };
  }
  if (
    !decision.relation_type ||
    !ALLOWED_CONTEXT_RELATIONS.includes(decision.relation_type)
  ) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Relation type is not eligible for context auto-add.',
    };
  }
  if (decision.evidence_news_ids.length === 0) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Candidate has no evidence news ids.',
    };
  }
  if (alreadyContext(contextEntities, decision)) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Candidate is already present in context watchlist.',
    };
  }

  return {
    status: 'auto_added_context',
    shouldAddContext: true,
    shouldAddCore: false,
    reason: 'Candidate passed context auto-add rules.',
  };
}

function canAddCore(
  input: ApplyCandidateHardRulesInput,
): CandidateHardRuleResult | null {
  const { decision, mentionCount, coreTargets } = input;

  if (decision.decision !== 'add_core') return null;
  if (
    decision.confidence < 0.9 ||
    !decision.symbol ||
    !decision.market ||
    !decision.name ||
    mentionCount < 2 ||
    !SUPPORTED_CORE_MARKETS.has(decision.market) ||
    alreadyCore(coreTargets, decision) ||
    !/core|tracking object|primary tracked/i.test(decision.reason)
  ) {
    return {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Candidate did not pass core auto-add hard rules.',
    };
  }

  return {
    status: 'auto_added_core',
    shouldAddContext: false,
    shouldAddCore: true,
    reason: 'Candidate passed core auto-add rules.',
  };
}

export function applyCandidateHardRules(
  input: ApplyCandidateHardRulesInput,
): CandidateHardRuleResult {
  const { decision } = input;

  if (decision.decision === 'reject' || decision.confidence < 0.6) {
    return {
      status: 'rejected',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Candidate was rejected or below minimum confidence.',
    };
  }

  return (
    canAddContext(input) ??
    canAddCore(input) ?? {
      status: 'pending_ai_review',
      shouldAddContext: false,
      shouldAddCore: false,
      reason: 'Candidate requires more evidence before auto-add.',
    }
  );
}
