import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import {
  createEmailVerificationCode,
  EMAIL_CODE_LIFETIME_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_DELAY_MS,
  hashEmailVerificationCode,
  matchesEmailVerificationCode,
} from "./email-verification.js";
import {
  InputError,
  normalizeAdminDirectoryInput,
  normalizeDisplayName,
  normalizeEmailAddress,
  normalizeEmailVerification,
  normalizeLogin,
  normalizeRegistration,
  toPublicAccount,
} from "./validation.js";

const COOKIE_NAME = "jan_sahayak_session";
const TOKEN_ISSUER = "jan-sahayak";
const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const SETUP_MESSAGE = "Set MONGODB_URI and SESSION_SECRET in the server .env file, then restart the API.";
const EMAIL_SETUP_MESSAGE = "Email verification requires SMTP settings in the server .env file.";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  };
}

function sendSetupRequired(response) {
  response.status(503).json({
    error: "MongoDB Atlas authentication is not configured. " + SETUP_MESSAGE,
    code: "MONGODB_NOT_CONFIGURED",
  });
}

export function createApp({ db, sessionSecret, emailTransport, emailFrom, appOrigins = [] }) {
  const app = express();
  const configured = Boolean(db && sessionSecret);
  const emailConfigured = Boolean(emailTransport && emailFrom);
  const origins = new Set(appOrigins);
  const users = db?.collection("users");
  const adminDirectory = db?.collection("adminDirectory");
  const emailVerifications = db?.collection("emailVerifications");

  app.disable("x-powered-by");
  app.use(helmet({
    strictTransportSecurity: process.env.NODE_ENV === "production" ? undefined : false,
  }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  app.use("/api", (request, response, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      const requestOrigin = request.get("origin");
      const localDevelopmentOrigin = process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin || "");
      if (requestOrigin && !origins.has(requestOrigin) && !localDevelopmentOrigin) {
        return response.status(403).json({ error: "This request origin is not allowed." });
      }
    }
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ configured, emailConfigured });
  });

  app.use("/api", (_request, response, next) => {
    if (!configured) {
      sendSetupRequired(response);
      return;
    }
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait and try again." },
  });

  app.use("/api/auth", (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  function setSessionCookie(response, user) {
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        sessionVersion: user.sessionVersion ?? 0,
      },
      sessionSecret,
      { expiresIn: TOKEN_LIFETIME_SECONDS, issuer: TOKEN_ISSUER },
    );
    response.cookie(COOKIE_NAME, token, {
      ...cookieOptions(),
      maxAge: TOKEN_LIFETIME_SECONDS * 1000,
    });
  }

  function clearSessionCookie(response) {
    response.clearCookie(COOKIE_NAME, cookieOptions());
  }

  function sendEmailSetupRequired(response) {
    response.status(503).json({
      error: `${EMAIL_SETUP_MESSAGE} Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM.`,
      code: "EMAIL_NOT_CONFIGURED",
    });
  }

  async function sendVerificationEmail(email, code) {
    await emailTransport.sendMail({
      from: emailFrom,
      to: email,
      subject: "Verify your Jan Sahayak account",
      text: [
        `Your Jan Sahayak verification code is ${code}.`,
        "It expires in 10 minutes.",
        "If you did not start this registration, you can ignore this email.",
      ].join("\n\n"),
    });
  }

  async function findSessionUser(request, response) {
    const token = request.cookies[COOKIE_NAME];
    if (!token) return null;

    try {
      const payload = jwt.verify(token, sessionSecret, {
        issuer: TOKEN_ISSUER,
        algorithms: ["HS256"],
      });
      if (typeof payload.sub !== "string" || !ObjectId.isValid(payload.sub)) {
        clearSessionCookie(response);
        return null;
      }
      const user = await users.findOne(
        { _id: new ObjectId(payload.sub) },
        { projection: { email: 1, fullName: 1, role: 1, sessionVersion: 1 } },
      );
      if (!user ||
        !["user", "admin"].includes(user.role) ||
        (payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
        clearSessionCookie(response);
        return null;
      }
      return user;
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        clearSessionCookie(response);
        return null;
      }
      throw error;
    }
  }

  async function requireAuth(request, response, next) {
    try {
      const user = await findSessionUser(request, response);
      if (!user) {
        response.status(401).json({ error: "Sign in to continue." });
        return;
      }
      request.user = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireAdmin(request, response, next) {
    if (request.user?.role !== "admin") {
      response.status(403).json({ error: "Administrator access is required." });
      return;
    }
    next();
  }

  app.get("/api/auth/me", async (request, response, next) => {
    try {
      const user = await findSessionUser(request, response);
      response.set("Cache-Control", "no-store");
      response.json({ account: user ? toPublicAccount(user) : null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register", authLimiter, async (request, response, next) => {
    try {
      if (!emailConfigured) {
        sendEmailSetupRequired(response);
        return;
      }

      const { email, fullName, password } = normalizeRegistration(request.body);
      if (await users.findOne({ email }, { projection: { _id: 1 } })) {
        response.status(409).json({ error: "An account with that email already exists." });
        return;
      }

      const now = new Date();
      const pendingVerification = await emailVerifications.findOne({ email });
      if (pendingVerification) {
        if (pendingVerification.expiresAt > now) {
          response.status(202).json({ verificationRequired: true, email });
          return;
        }
        await emailVerifications.deleteOne({ _id: pendingVerification._id });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const code = createEmailVerificationCode();
      const pendingUser = {
        email,
        fullName,
        passwordHash,
        codeHash: hashEmailVerificationCode(email, code, sessionSecret),
        attempts: 0,
        expiresAt: new Date(now.getTime() + EMAIL_CODE_LIFETIME_MS),
        lastSentAt: now,
        createdAt: now,
      };
      let verificationId;
      try {
        const { insertedId } = await emailVerifications.insertOne(pendingUser);
        verificationId = insertedId;
      } catch (error) {
        if (error.code === 11000) {
          response.status(202).json({ verificationRequired: true, email });
          return;
        }
        throw error;
      }

      try {
        await sendVerificationEmail(email, code);
      } catch (error) {
        await emailVerifications.deleteOne({ _id: verificationId });
        console.error("Could not send the email verification code.", error.message);
        response.status(503).json({ error: "Could not send the verification email. Check SMTP settings and try again." });
        return;
      }

      response.status(202).json({ verificationRequired: true, email });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/verify-email", authLimiter, async (request, response, next) => {
    try {
      const { email, code } = normalizeEmailVerification(request.body);
      const now = new Date();
      const pendingUser = await emailVerifications.findOne({
        email,
        expiresAt: { $gt: now },
      });
      if (!pendingUser) {
        response.status(400).json({ error: "The verification code is incorrect or expired. Request a new code." });
        return;
      }
      if (pendingUser.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        response.status(429).json({ error: "Too many incorrect codes. Request a new verification code." });
        return;
      }

      const codeMatches = matchesEmailVerificationCode(
        email,
        code,
        pendingUser.codeHash,
        sessionSecret,
      );
      const attemptUpdate = await emailVerifications.updateOne(
        {
          _id: pendingUser._id,
          codeHash: pendingUser.codeHash,
          attempts: pendingUser.attempts,
          expiresAt: { $gt: now },
        },
        { $inc: { attempts: 1 } },
      );
      if (attemptUpdate.matchedCount !== 1) {
        response.status(409).json({ error: "The verification code changed. Request the latest code and try again." });
        return;
      }
      if (!codeMatches) {
        response.status(pendingUser.attempts + 1 >= EMAIL_CODE_MAX_ATTEMPTS ? 429 : 400)
          .json({
            error: pendingUser.attempts + 1 >= EMAIL_CODE_MAX_ATTEMPTS
              ? "Too many incorrect codes. Request a new verification code."
              : "The verification code is incorrect or expired. Request a new code.",
          });
        return;
      }

      if (await users.findOne({ email }, { projection: { _id: 1 } })) {
        await emailVerifications.deleteOne({ _id: pendingUser._id });
        response.status(409).json({ error: "An account with that email already exists." });
        return;
      }

      const user = {
        email: pendingUser.email,
        fullName: pendingUser.fullName,
        passwordHash: pendingUser.passwordHash,
        role: "user",
        sessionVersion: 0,
        emailVerifiedAt: now,
        createdAt: now,
      };
      try {
        const { insertedId } = await users.insertOne(user);
        user._id = insertedId;
      } catch (error) {
        if (error.code === 11000) {
          await emailVerifications.deleteOne({ _id: pendingUser._id });
          response.status(409).json({ error: "An account with that email already exists." });
          return;
        }
        throw error;
      }

      await emailVerifications.deleteOne({ _id: pendingUser._id });
      setSessionCookie(response, user);
      response.status(201).json({ account: toPublicAccount(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/resend-otp", authLimiter, async (request, response, next) => {
    try {
      if (!emailConfigured) {
        sendEmailSetupRequired(response);
        return;
      }

      const email = normalizeEmailAddress(request.body);
      const pendingUser = await emailVerifications.findOne({ email });
      const now = new Date();
      if (!pendingUser || pendingUser.expiresAt <= now) {
        response.status(400).json({
          error: "This verification request expired. Return to sign-up and create the account again.",
        });
        return;
      }
      if (now.getTime() - pendingUser.lastSentAt.getTime() < EMAIL_CODE_RESEND_DELAY_MS) {
        response.status(429).json({ error: "Please wait before requesting another code." });
        return;
      }

      let code = createEmailVerificationCode();
      let codeHash = hashEmailVerificationCode(email, code, sessionSecret);
      while (codeHash === pendingUser.codeHash) {
        code = createEmailVerificationCode();
        codeHash = hashEmailVerificationCode(email, code, sessionSecret);
      }
      const expiresAt = new Date(now.getTime() + EMAIL_CODE_LIFETIME_MS);
      const update = await emailVerifications.updateOne(
        {
          _id: pendingUser._id,
          codeHash: pendingUser.codeHash,
          attempts: pendingUser.attempts,
          lastSentAt: pendingUser.lastSentAt,
        },
        {
          $set: { codeHash, expiresAt, attempts: 0, lastSentAt: now },
        },
      );
      if (update.matchedCount !== 1) {
        response.status(409).json({ error: "The verification request changed. Try again." });
        return;
      }

      try {
        await sendVerificationEmail(email, code);
      } catch (error) {
        try {
          await emailVerifications.updateOne(
            { _id: pendingUser._id, codeHash },
            {
              $set: {
                codeHash: pendingUser.codeHash,
                expiresAt: pendingUser.expiresAt,
                attempts: pendingUser.attempts,
                lastSentAt: pendingUser.lastSentAt,
              },
            },
          );
        } catch (rollbackError) {
          console.error("Could not restore the pending email verification after delivery failed.", rollbackError);
        }
        console.error("Could not resend the email verification code.", error.message);
        response.status(503).json({ error: "Could not send the verification email. Check SMTP settings and try again." });
        return;
      }

      response.json({ message: "A new verification code has been sent." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", authLimiter, async (request, response, next) => {
    try {
      const { email, password } = normalizeLogin(request.body);
      const user = await users.findOne({ email });
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        response.status(401).json({ error: "Email or password is incorrect." });
        return;
      }
      setSessionCookie(response, user);
      response.set("Cache-Control", "no-store");
      response.json({ account: toPublicAccount(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", async (request, response, next) => {
    try {
      const user = await findSessionUser(request, response);
      if (user) {
        await users.updateOne(
          { _id: user._id },
          { $inc: { sessionVersion: 1 } },
        );
      }
      clearSessionCookie(response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (request, response, next) => {
    try {
      const fullName = normalizeDisplayName(request.body);
      await users.updateOne(
        { _id: request.user._id },
        { $set: { fullName } },
      );
      response.json({
        account: toPublicAccount({ ...request.user, fullName }),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin-directory", async (_request, response, next) => {
    try {
      const entries = await adminDirectory
        .find({}, {
          projection: {
            _id: 0,
            displayName: 1,
            roleTitle: 1,
            department: 1,
            publicContact: 1,
          },
        })
        .sort({ displayName: 1 })
        .toArray();
      response.set("Cache-Control", "public, max-age=60");
      response.json({ directory: entries });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin-directory/me", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const profile = await adminDirectory.findOne(
        { userId: request.user._id },
        { projection: { _id: 0, displayName: 1, roleTitle: 1, department: 1, publicContact: 1 } },
      );
      response.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin-directory/me", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const profile = normalizeAdminDirectoryInput(request.body);
      const now = new Date();
      await adminDirectory.updateOne(
        { userId: request.user._id },
        {
          $set: { ...profile, updatedAt: now },
          $setOnInsert: { userId: request.user._id, createdAt: now },
        },
        { upsert: true },
      );
      response.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof InputError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error("API request failed.", error);
    response.status(500).json({ error: "The server could not complete the request." });
  });

  return app;
}
