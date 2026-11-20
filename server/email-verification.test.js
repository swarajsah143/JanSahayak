import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailVerificationCode,
  hashEmailVerificationCode,
  matchesEmailVerificationCode,
} from "./email-verification.js";

test("verification codes are six digits and are stored as keyed hashes", () => {
  const email = "citizen@example.org";
  const code = createEmailVerificationCode();
  const hash = hashEmailVerificationCode(email, code, "test-secret");

  assert.match(code, /^\d{6}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(matchesEmailVerificationCode(email, code, hash, "test-secret"), true);
  assert.equal(matchesEmailVerificationCode(email, "000000", hash, "test-secret"), false);
  assert.equal(matchesEmailVerificationCode("other@example.org", code, hash, "test-secret"), false);
});
