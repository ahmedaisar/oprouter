export function getProviderTimeoutMs(raw = process.env.OPENROUTER_TIMEOUT_MS): number {
  const value = raw?.trim();
  if (!value) return 120_000;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 300_000) {
    throw new Error("OPENROUTER_TIMEOUT_MS must be a whole number between 1 and 300000.");
  }
  return timeout;
}
