import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { createApp } from "./app.js";

const sessionSecret = "a-test-secret-long-enough-to-sign-app-sessions";

function createTestDatabase(initialUsers = []) {
  const usersById = new Map(initialUsers.map((user) => [
    user._id.toString(),
    { sessionVersion: 0, ...user },
  ]));
  const verificationsByEmail = new Map();
  const users = {
    findOne: async (query) => {
      if (query.email) {
        return [...usersById.values()].find((user) => user.email === query.email) ?? null;
      }
      return usersById.get(query._id.toString()) ?? null;
    },
    insertOne: async (user) => {
      const _id = new ObjectId();
      usersById.set(_id.toString(), { ...user, _id });
      return { insertedId: _id };
    },
    updateOne: async (query, update) => {
      const user = usersById.get(query._id.toString());
      Object.assign(user, update.$set);
      for (const [field, increment] of Object.entries(update.$inc ?? {})) {
        user[field] = (user[field] ?? 0) + increment;
      }
    },
  };
  const adminDirectory = {
    findOne: async () => null,
    find: () => ({
      sort() {
        return this;
      },
      toArray: async () => [],
    }),
    updateOne: async () => ({ acknowledged: true }),
  };
  const emailVerifications = {
    findOne: async (query) => {
      const verification = verificationsByEmail.get(query.email);
      if (!verification) return null;
      if (query.expiresAt?.$gt && verification.expiresAt <= query.expiresAt.$gt) return null;
      return { ...verification };
    },
    insertOne: async (verification) => {
      if (verificationsByEmail.has(verification.email)) {
        throw Object.assign(new Error("Duplicate pending email"), { code: 11000 });
      }
      const _id = new ObjectId();
      verificationsByEmail.set(verification.email, { ...verification, _id });
      return { insertedId: _id };
    },
    updateOne: async (query, update) => {
      const verification = verificationsByEmail.get(query.email) ??
        [...verificationsByEmail.values()].find((entry) => entry._id.equals(query._id));
      if (!verification ||
        (query._id && !verification._id.equals(query._id)) ||
        (query.codeHash && verification.codeHash !== query.codeHash) ||
        (query.attempts !== undefined && verification.attempts !== query.attempts) ||
        (query.deliveryStatus !== undefined && verification.deliveryStatus !== query.deliveryStatus) ||
        (query.lastSentAt && verification.lastSentAt.getTime() !== query.lastSentAt.getTime()) ||
        (query.expiresAt?.$gt && verification.expiresAt <= query.expiresAt.$gt)) {
        return { matchedCount: 0 };
      }
      Object.assign(verification, update.$set);
      for (const [field, increment] of Object.entries(update.$inc ?? {})) {
        verification[field] = (verification[field] ?? 0) + increment;
      }
      return { matchedCount: 1 };
    },
    deleteOne: async (query) => {
      const verification = query.email
        ? verificationsByEmail.get(query.email)
        : [...verificationsByEmail.values()].find((entry) => entry._id.equals(query._id));
      if (verification && (!query._id || verification._id.equals(query._id))) {
        verificationsByEmail.delete(verification.email);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
  };

  return {
    collection(name) {
      if (name === "users") return users;
      if (name === "adminDirectory") return adminDirectory;
      return emailVerifications;
    },
    usersById,
    verificationsByEmail,
  };
}

function createTestMailTransport(sendError) {
  const sentMessages = [];
  return {
    sentMessages,
    transport: {
      sendMail: async (message) => {
        if (sendError) throw sendError;
        sentMessages.push(message);
      },
    },
  };
}

async function startTestServer(t, app) {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function waitForVerificationStatus(baseUrl, email, expectedStatus) {
  const deadline = Date.now() + 2000;
  let status;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${baseUrl}/api/auth/verification-status?email=${encodeURIComponent(email)}`,
    );
    assert.equal(response.status, 200);
    ({ status } = await response.json());
    if (status === expectedStatus) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(status, expectedStatus, `email delivery status did not become ${expectedStatus}`);
}

test("registration creates a user only after email verification and never accepts a client role", async (t) => {
  const db = createTestDatabase();
  const { transport, sentMessages } = createTestMailTransport();
  const app = createApp({
    db,
    sessionSecret,
    emailTransport: transport,
    emailFrom: "Jan Sahayak <no-reply@example.org>",
    appOrigins: ["http://localhost:5173"],
  });
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
      role: "admin",
    }),
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    verificationRequired: true,
    email: "citizen@example.org",
  });
  await waitForVerificationStatus(baseUrl, "citizen@example.org", "sent");
  assert.equal(db.usersById.size, 0);
  const pendingVerification = db.verificationsByEmail.get("citizen@example.org");
  assert.ok(pendingVerification);
  const code = sentMessages[0].text.match(/\b\d{6}\b/)[0];
  assert.match(pendingVerification.codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(pendingVerification.codeHash, code);

  const verified = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ email: "citizen@example.org", code }),
  });
  assert.equal(verified.status, 201);
  const { account } = await verified.json();
  assert.equal(account.role, "user");
  assert.equal([...db.usersById.values()][0].role, "user");
  assert.notEqual([...db.usersById.values()][0].passwordHash, "a-secure-password");
  assert.ok([...db.usersById.values()][0].emailVerifiedAt);
  assert.equal(db.verificationsByEmail.size, 0);
  const cookie = verified.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);

  const restored = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie.split(";")[0] },
  });
  assert.equal((await restored.json()).account.id, account.id);
});

test("registration returns before SMTP finishes and reports delivery state", async (t) => {
  const db = createTestDatabase();
  const sentMessages = [];
  let markSendStarted;
  let finishSend;
  const sendStarted = new Promise((resolve) => { markSendStarted = resolve; });
  const sendGate = new Promise((resolve) => { finishSend = resolve; });
  const app = createApp({
    db,
    sessionSecret,
    emailTransport: {
      sendMail: async (message) => {
        sentMessages.push(message);
        markSendStarted();
        await sendGate;
      },
    },
    emailFrom: "Jan Sahayak <no-reply@example.org>",
  });
  const baseUrl = await startTestServer(t, app);
  const registrationRequest = fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
    }),
  });
  await sendStarted;

  let response;
  let deliveryStatusResponse;
  let timeoutId;
  try {
    response = await Promise.race([
      registrationRequest,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Registration waited for SMTP delivery.")), 1500);
      }),
    ]);
    deliveryStatusResponse = await fetch(
      `${baseUrl}/api/auth/verification-status?email=${encodeURIComponent("citizen@example.org")}`,
    );
  } finally {
    clearTimeout(timeoutId);
    finishSend();
    await registrationRequest;
  }

  assert.equal(response.status, 202);
  assert.deepEqual(await deliveryStatusResponse.json(), { status: "sending" });
  await waitForVerificationStatus(baseUrl, "citizen@example.org", "sent");
  assert.equal(sentMessages.length, 1);
});

test("verification limits code guesses and resending rotates the code", async (t) => {
  const db = createTestDatabase();
  const { transport, sentMessages } = createTestMailTransport();
  const app = createApp({
    db,
    sessionSecret,
    emailTransport: transport,
    emailFrom: "Jan Sahayak <no-reply@example.org>",
  });
  const baseUrl = await startTestServer(t, app);
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
    }),
  });
  await waitForVerificationStatus(baseUrl, "citizen@example.org", "sent");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "citizen@example.org", code: "000000" }),
    });
    const responseText = await response.text();
    assert.equal(response.status, attempt === 4 ? 429 : 400, `attempt ${attempt}: ${responseText}`);
  }

  const cooldown = await fetch(`${baseUrl}/api/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "citizen@example.org" }),
  });
  assert.equal(cooldown.status, 429);

  db.verificationsByEmail.get("citizen@example.org").lastSentAt =
    new Date(Date.now() - 61_000);
  const resent = await fetch(`${baseUrl}/api/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "citizen@example.org" }),
  });
  assert.equal(resent.status, 200);
  await waitForVerificationStatus(baseUrl, "citizen@example.org", "sent");
  assert.equal(sentMessages.length, 2);

  const oldCode = sentMessages[0].text.match(/\b\d{6}\b/)[0];
  const oldCodeResponse = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "citizen@example.org", code: oldCode }),
  });
  assert.equal(oldCodeResponse.status, 400);

  const code = sentMessages[1].text.match(/\b\d{6}\b/)[0];
  const verified = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "citizen@example.org", code }),
  });
  assert.equal(verified.status, 201);
});

test("admin directory editing checks the current database role on every request", async (t) => {
  const userId = new ObjectId();
  const db = createTestDatabase([{
    _id: userId,
    email: "citizen@example.org",
    fullName: "Asha Rao",
    role: "user",
  }]);
  const app = createApp({ db, sessionSecret });
  const baseUrl = await startTestServer(t, app);
  const token = jwt.sign({ sub: userId.toString() }, sessionSecret, {
    expiresIn: "1h",
    issuer: "jan-sahayak",
  });
  const cookie = `jan_sahayak_session=${token}`;

  const denied = await fetch(`${baseUrl}/api/admin-directory/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(denied.status, 403);

  db.usersById.get(userId.toString()).role = "admin";
  const allowed = await fetch(`${baseUrl}/api/admin-directory/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { profile: null });
});

test("logout invalidates the signed session on the server", async (t) => {
  const userId = new ObjectId();
  const db = createTestDatabase([{
    _id: userId,
    email: "citizen@example.org",
    fullName: "Asha Rao",
    role: "user",
  }]);
  const app = createApp({ db, sessionSecret });
  const baseUrl = await startTestServer(t, app);
  const token = jwt.sign({
    sub: userId.toString(),
    sessionVersion: 0,
  }, sessionSecret, {
    expiresIn: "1h",
    issuer: "jan-sahayak",
  });
  const cookie = `jan_sahayak_session=${token}`;

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 204);

  const restored = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await restored.json()).account, null);
});

test("unconfigured API reports setup state and rejects database-backed operations", async (t) => {
  const app = createApp({ db: null, sessionSecret: null });
  const baseUrl = await startTestServer(t, app);

  const health = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await health.json(), { configured: false, emailConfigured: false });

  const response = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "MONGODB_NOT_CONFIGURED");
});

test("registration clearly reports when SMTP delivery is not configured", async (t) => {
  const app = createApp({ db: createTestDatabase(), sessionSecret });
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
    }),
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "EMAIL_NOT_CONFIGURED");
});

test("failed email delivery is reported and allows the pending registration to retry", async (t) => {
  const db = createTestDatabase();
  const { transport } = createTestMailTransport(new Error("SMTP credentials rejected"));
  const app = createApp({
    db,
    sessionSecret,
    emailTransport: transport,
    emailFrom: "Jan Sahayak <no-reply@example.org>",
  });
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
    }),
  });

  assert.equal(response.status, 202);
  await waitForVerificationStatus(baseUrl, "citizen@example.org", "failed");
  assert.equal(db.verificationsByEmail.size, 1);
  assert.equal(db.usersById.size, 0);
});

test("mutating API requests reject an unexpected browser origin", async (t) => {
  const app = createApp({
    db: createTestDatabase(),
    sessionSecret,
    appOrigins: ["http://localhost:5173"],
  });
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unexpected.example",
    },
    body: JSON.stringify({
      email: "citizen@example.org",
      fullName: "Asha Rao",
      password: "a-secure-password",
    }),
  });

  assert.equal(response.status, 403);
});
