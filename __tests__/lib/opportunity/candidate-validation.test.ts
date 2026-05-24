import {
  applyCandidateHardRules,
  buildCandidateValidationPrompt,
} from '@/lib/opportunity/candidate-validation';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type {
  CandidateValidationDecision,
  ExtractedCompanyMention,
} from '@/lib/opportunity/types';

const mention: ExtractedCompanyMention = {
  name: 'Samsung Electronics',
  symbol: '005930.KS',
  market: 'KR',
  theme: 'HBM / memory cycle',
  relation_to_core: 'competitor',
  related_core_symbol: 'MU',
  reason: 'Samsung is a recurring HBM competitor signal.',
  confidence: 0.86,
};

describe('candidate validation', () => {
  it('builds a prompt that asks for one of the allowed decisions', () => {
    const prompt = buildCandidateValidationPrompt({
      mention,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      evidenceNewsIds: [2],
      sourceSummary: 'Samsung HBM certification slipped again.',
    });

    expect(prompt).toContain('add_context');
    expect(prompt).toContain('add_core');
    expect(prompt).toContain('keep_candidate');
    expect(prompt).toContain('reject');
  });

  it('allows high-confidence competitors to auto-add to context', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.86,
      name: mention.name,
      symbol: mention.symbol,
      market: mention.market,
      theme: mention.theme,
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: mention.reason,
      evidence_news_ids: [2],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 1,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext.filter(
          (entity) => entity.related_name !== 'Samsung Electronics',
        ),
      }),
    ).toEqual(expect.objectContaining({ status: 'auto_added_context' }));
  });

  it('keeps low-confidence mentions out of context and core', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.61,
      name: mention.name,
      symbol: mention.symbol,
      market: mention.market,
      theme: mention.theme,
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: mention.reason,
      evidence_news_ids: [2],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 1,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'pending_ai_review' }));
  });

  it('requires repeated high-confidence mentions to auto-add to core', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_core',
      confidence: 0.92,
      name: 'Marvell Technology',
      symbol: 'MRVL',
      market: 'US',
      theme: 'AI networking',
      related_core_symbol: 'NVDA',
      relation_type: 'peer',
      reason:
        'The candidate repeatedly appears as a direct AI infrastructure tracking object.',
      evidence_news_ids: [3, 4],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 2,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'auto_added_core' }));
  });

  it('does not auto-add unsupported markets to core', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_core',
      confidence: 0.94,
      name: 'Samsung Electronics',
      symbol: '005930.KS',
      market: 'KR',
      theme: 'HBM / memory cycle',
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: 'The candidate repeatedly appears as a core tracking object.',
      evidence_news_ids: [2, 5],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 3,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'pending_ai_review' }));
  });

  it('rejects very low confidence candidates', () => {
    const decision: CandidateValidationDecision = {
      decision: 'keep_candidate',
      confidence: 0.42,
      name: 'Unknown AI Supplier',
      symbol: null,
      market: null,
      theme: null,
      related_core_symbol: null,
      relation_type: null,
      reason: 'Weak evidence.',
      evidence_news_ids: [],
      risk_notes: ['Unclear relation.'],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 1,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'rejected' }));
  });
});
