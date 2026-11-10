import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimitHeaders, getGatewayRateLimit } from "../src/lib/gateway-rate-limit";

test("gateway rate limit defaults to 60 and accepts configured whole numbers", () => {
  assert.equal(getGatewayRateLimit(undefined), 60);
  assert.equal(getGatewayRateLimit(" 120 "), 120);
  assert.equal(getGatewayRateLimit(""), 60);
  assert.equal(getGatewayRateLimit("   "), 60);
  assert.equal(getGatewayRateLimit("1"), 1);
});

test("gateway rate limit rejects invalid or unsafe values", () => {
  for (const invalid of ["0", "-1", "1.5", "NaN", "10001", "9007199254740992"]) {
    assert.throws(() => getGatewayRateLimit(invalid));
  }
});

test("rate limit headers include normalized counts and an epoch reset", () => {
  const headers = createRateLimitHeaders(60, 4, "2026-11-10T10:30:00.000Z");
  assert.deepEqual(headers, {
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "4",
    "X-RateLimit-Reset": String(Date.parse("2026-11-10T10:30:00.000Z") / 1000)
  });
  assert.equal(createRateLimitHeaders(60, -1, "2026-11-10T10:30:00Z")["X-RateLimit-Remaining"], "0");
  assert.throws(() => createRateLimitHeaders(60, 1, "invalid"));
});
