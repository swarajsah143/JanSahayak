import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const EMAIL_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const EMAIL_CODE_RESEND_DELAY_MS = 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function createEmailVerificationCode() {
  return randomInt(100_000, 1_000_000).toString();
}

export function hashEmailVerificationCode(email, code, secret) {
  return createHmac("sha256", secret)
    .update(`${email}:${code}`)
    .digest("hex");
}

export function matchesEmailVerificationCode(email, code, storedHash, secret) {
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/.test(storedHash)) {
    return false;
  }
  const expectedHash = Buffer.from(storedHash, "hex");
  const submittedHash = Buffer.from(hashEmailVerificationCode(email, code, secret), "hex");
  return timingSafeEqual(expectedHash, submittedHash);
}
