import { buildNewsPrompt } from '@/lib/llm/client';

describe('buildNewsPrompt', () => {
  it('includes symbol name in prompt', () => {
    const prompt = buildNewsPrompt('NVDA', ['NVIDIA beats Q4 earnings']);
    expect(prompt).toContain('NVDA');
  });

  it('includes all headlines in prompt', () => {
    const headlines = ['Headline A', 'Headline B'];
    const prompt = buildNewsPrompt('AAPL', headlines);
    expect(prompt).toContain('Headline A');
    expect(prompt).toContain('Headline B');
  });

  it('requests sentiment output in Chinese format', () => {
    const prompt = buildNewsPrompt('MSFT', ['Some news']);
    expect(prompt).toContain('情绪');
  });
});
