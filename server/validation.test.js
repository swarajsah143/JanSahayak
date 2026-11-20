import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEmailAddress,
  normalizeEmailVerification,
  normalizeAdminDirectoryInput,
  normalizeDisplayName,
  normalizeLogin,
  normalizeRegistration,
  toPublicAccount,
} from "./validation.js";

test("email verification validates normalized email and six-digit codes", () => {
  assert.equal(normalizeEmailAddress({ email: "  CITIZEN@example.org " }), "citizen@example.org");
  assert.deepEqual(normalizeEmailVerification({
    email: " CITIZEN@example.org ",
    code: "012345",
  }), {
    email: "citizen@example.org",
    code: "012345",
  });
  assert.throws(() => normalizeEmailVerification({
    email: "citizen@example.org",
    code: "12345x",
  }), /six-digit verification code/);
});

test("registration normalizes email and rejects invalid or oversized credentials", () => {
  assert.deepEqual(normalizeRegistration({
    email: "  CITIZEN@example.org ",
    fullName: " Asha Rao ",
    password: "secure-password",
  }), {
    email: "citizen@example.org",
    fullName: "Asha Rao",
    password: "secure-password",
  });
  assert.throws(() => normalizeRegistration({
    email: "bad-email",
    fullName: "Asha",
    password: "secure-password",
  }), /valid email/);
  assert.throws(() => normalizeRegistration({
    email: "citizen@example.org",
    fullName: "Asha",
    password: "short",
  }), /Password must be/);
  assert.throws(() => normalizeRegistration({
    email: "citizen@example.org",
    fullName: "Asha",
    password: "a".repeat(73),
  }), /72 UTF-8 bytes/);
});

test("login and profile updates validate user-controlled values", () => {
  assert.deepEqual(normalizeLogin({
    email: "CITIZEN@example.org",
    password: "password",
  }), {
    email: "citizen@example.org",
    password: "password",
  });
  assert.throws(() => normalizeDisplayName({ fullName: "  " }), /name between/);
});

test("admin directory input is limited to intended public fields", () => {
  assert.deepEqual(normalizeAdminDirectoryInput({
    displayName: " Asha Rao ",
    roleTitle: "Officer",
    department: "Public Welfare",
    publicContact: "",
    role: "admin",
    email: "private@example.org",
  }), {
    displayName: "Asha Rao",
    roleTitle: "Officer",
    department: "Public Welfare",
    publicContact: "",
  });
  assert.throws(() => normalizeAdminDirectoryInput({
    displayName: "Asha",
    roleTitle: "Officer",
    department: "x".repeat(161),
  }), /Department is required/);
});

test("public account serialization never includes password hashes or private data", () => {
  const account = toPublicAccount({
    _id: { toString: () => "user-id" },
    email: "citizen@example.org",
    fullName: "Asha Rao",
    role: "user",
    passwordHash: "never-return-this",
    privateNotes: "never-return-this-either",
  });
  assert.deepEqual(account, {
    id: "user-id",
    email: "citizen@example.org",
    fullName: "Asha Rao",
    role: "user",
  });
});
