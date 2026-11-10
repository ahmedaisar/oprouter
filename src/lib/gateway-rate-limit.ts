export function getGatewayRateLimit(raw = process.env.GATEWAY_RATE_LIMIT_PER_MINUTE): number {
  const value = raw?.trim();
  const limit = value ? Number(value) : 60;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) {
    throw new Error("GATEWAY_RATE_LIMIT_PER_MINUTE must be a whole number between 1 and 10000.");
  }
  return limit;
}

export function createRateLimitHeaders(limit: number, remaining: number, resetAt: string | Date): Record<string, string> {
  const reset = new Date(resetAt);
  if (!Number.isFinite(reset.getTime())) throw new Error("Rate limit reset time is invalid.");
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.trunc(remaining))),
    "X-RateLimit-Reset": String(Math.ceil(reset.getTime() / 1000))
  };
}
