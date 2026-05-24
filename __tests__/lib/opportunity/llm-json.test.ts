import { parseJsonWithRepair } from '@/lib/opportunity/llm-json';

describe('LLM JSON parsing', () => {
  it('parses strict JSON', async () => {
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '{"ok":true}',
      repair: jest.fn(),
    });

    expect(result).toEqual({ ok: true });
  });

  it('parses fenced JSON', async () => {
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '```json\n{"ok":true}\n```',
      repair: jest.fn(),
    });

    expect(result).toEqual({ ok: true });
  });

  it('uses one repair retry for invalid JSON', async () => {
    const repair = jest.fn().mockResolvedValue('{"ok":true}');
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '{ok:true}',
      repair,
    });

    expect(result).toEqual({ ok: true });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('returns a controlled failure after repair fails', async () => {
    const repair = jest.fn().mockResolvedValue('{still bad}');

    await expect(
      parseJsonWithRepair({
        rawText: '{bad}',
        repair,
      }),
    ).rejects.toThrow('Unable to parse LLM JSON');
  });
});
