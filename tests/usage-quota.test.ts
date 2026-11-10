import assert from "node:assert/strict";
import { test } from "node:test";
import { estimatePromptTokens, getMonthlyTokenLimit } from "../src/lib/usage-quota";

test("prompt token estimate is positive and accounts for message overhead", () => {
  assert.equal(estimatePromptTokens([{ content: "" }]), 4);
  assert.ok(estimatePromptTokens([{ content: "Hello world" }]) >= 4);
  assert.ok(estimatePromptTokens([{ content: "こんにちは" }]) >= 5);
  assert.ok(estimatePromptTokens([{ content: "a" }, { content: "b" }]) >= 2);
});

test("monthly token limit accepts an unset value and rejects invalid configuration", () => {
  const original = process.env.DEFAULT_MONTHLY_TOKEN_LIMIT;
  try {
    delete process.env.DEFAULT_MONTHLY_TOKEN_LIMIT;
    assert.equal(getMonthlyTokenLimit(), null);
    process.env.DEFAULT_MONTHLY_TOKEN_LIMIT = "250000";
    assert.equal(getMonthlyTokenLimit(), 250000);
    for (const invalid of ["0", "-1", "1.5", "not-a-number", "9007199254740992"]) {
      process.env.DEFAULT_MONTHLY_TOKEN_LIMIT = invalid;
      assert.throws(() => getMonthlyTokenLimit());
    }
  } finally {
    if (original === undefined) delete process.env.DEFAULT_MONTHLY_TOKEN_LIMIT;
    else process.env.DEFAULT_MONTHLY_TOKEN_LIMIT = original;
  }
});
