export type QuotaMessage = { content: string };

export function getMonthlyTokenLimit(): number | null {
  const raw = process.env.DEFAULT_MONTHLY_TOKEN_LIMIT?.trim();
  if (!raw) return null;

  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("DEFAULT_MONTHLY_TOKEN_LIMIT must be a positive whole number.");
  }

  return limit;
}

/**
 * A conservative preflight estimate. The provider's reported usage is stored
 * after streaming; this estimate reserves capacity before the upstream call.
 */
export function estimatePromptTokens(messages: QuotaMessage[]): number {
  const characters = messages.reduce((total, message) => total + message.content.length, 0);
  return Math.max(messages.length, Math.ceil(characters / 3) + messages.length * 4);
}
