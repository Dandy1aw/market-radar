interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function getLlmModelName(): string {
  return process.env.LLM_MODEL ?? 'gpt-4o-mini';
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY!;
  const baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = getLlmModelName();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export function buildNewsPrompt(symbol: string, headlines: string[]): string {
  return `你是一位专业的股票分析师。以下是关于 ${symbol} 的最新新闻标题：

${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

请用2-3句中文总结这些新闻的核心信息，并判断情绪倾向（正面/负面/中性）。
格式：摘要：<内容> | 情绪：<正面/负面/中性>`;
}

export async function summarizeNews(
  symbol: string,
  headlines: string[],
): Promise<{ summary: string; sentiment: 'positive' | 'negative' | 'neutral' }> {
  const response = await chatCompletion([{ role: 'user', content: buildNewsPrompt(symbol, headlines) }]);

  const sentimentMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
    正面: 'positive', 负面: 'negative', 中性: 'neutral',
  };

  const sentimentMatch = response.match(/情绪[：:]\s*(正面|负面|中性)/);
  const summaryMatch = response.match(/摘要[：:]\s*(.+?)(?:\s*\||\s*情绪|$)/s);

  return {
    summary: summaryMatch?.[1]?.trim() ?? response.trim(),
    sentiment: sentimentMap[sentimentMatch?.[1] ?? '中性'] ?? 'neutral',
  };
}
