export type QuotaMessage = { content: string };

export function getMonthlyTokenLimit(): number | null {
  const raw = process.env.DEFAULT_MONTHLY_TOKEN_LIMIT?.trim();
  if (!raw) return null;

  if (!/^\\d+$/.test(raw)) {
    throw new Error("DEFAULT_MONTHLY_TOKEN_LIMIT must be a positive whole number.");
  }
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("DEFAULT_MONTHLY_TOKEN_LIMIT must be a positive whole number.");
  }

  return limit;
}

/**
 * A conservative preflight estimate. ASCII text is estimated at three
 * characters per token; non-ASCII code points reserve at least one token each.
 * The provider's reported usage is stored after streaming.
 */
export function estimatePromptTokens(messages: QuotaMessage[]): number {
  let estimatedTokens = messages.length * 4;

  for (const message of messages) {
    for (const character of message.content) {
      estimatedTokens += (character.codePointAt(0) ?? 0) <= 0x7f ? 1 / 3 : 1;
    }
  }

  return Math.max(messages.length, Math.ceil(estimatedTokens));
}
