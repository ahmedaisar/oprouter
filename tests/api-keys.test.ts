import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiKey, hashApiKey } from "../src/lib/api-keys";

test("API keys use a high-entropy secret and expose only a lookup prefix", () => {
  const first = createApiKey();
  const second = createApiKey();

  assert.match(first.value, /^opk_live_[A-Za-z0-9_-]{40,}$/);
  assert.equal(first.prefix, first.value.slice(0, 17));
  assert.equal(first.hash, hashApiKey(first.value));
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.value, second.value);
  assert.notEqual(first.hash, second.hash);
  assert.equal(first.hash.includes(first.value), false);
});

test("API key hashing is deterministic", () => {
  assert.equal(hashApiKey("example-key"), hashApiKey("example-key"));
  assert.notEqual(hashApiKey("example-key"), hashApiKey("different-key"));
});
