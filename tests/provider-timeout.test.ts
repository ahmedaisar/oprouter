import assert from "node:assert/strict";
import { test } from "node:test";
import { getProviderTimeoutMs } from "../src/lib/provider-timeout";

test("provider timeout defaults to 120 seconds and accepts configured milliseconds", () => {
  assert.equal(getProviderTimeoutMs(undefined), 120_000);
  assert.equal(getProviderTimeoutMs(" 2500 "), 2500);
  assert.equal(getProviderTimeoutMs("1"), 1);
});

test("provider timeout rejects invalid and unsafe configuration", () => {
  for (const invalid of ["0", "-1", "1.5", "NaN", "300001", "9007199254740992"]) {
    assert.throws(() => getProviderTimeoutMs(invalid));
  }
});
