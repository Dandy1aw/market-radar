interface ParseJsonWithRepairInput {
  rawText: string;
  repair: (invalidJson: string) => Promise<string>;
}

function extractFencedJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch?.[1]?.trim() ?? text.trim();
}

function parseJson<T>(text: string): T {
  return JSON.parse(extractFencedJson(text)) as T;
}

export async function parseJsonWithRepair<T>({
  rawText,
  repair,
}: ParseJsonWithRepairInput): Promise<T> {
  try {
    return parseJson<T>(rawText);
  } catch {
    const repaired = await repair(rawText);

    try {
      return parseJson<T>(repaired);
    } catch (error) {
      throw new Error(
        `Unable to parse LLM JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
