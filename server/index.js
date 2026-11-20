import "dotenv/config";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";
import { createApp } from "./app.js";

const mongoUri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB_NAME?.trim();
const sessionSecretValue = process.env.SESSION_SECRET?.trim();
const sessionSecret = sessionSecretValue &&
  sessionSecretValue.length >= 32 &&
  !sessionSecretValue.includes("replace-this")
  ? sessionSecretValue
  : null;
const appOrigins = (process.env.APP_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const port = Number(process.env.PORT || 3001);
const smtpHost = process.env.SMTP_HOST?.trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPassword = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM?.trim();
const emailTransport = smtpHost &&
  Number.isInteger(smtpPort) &&
  smtpPort > 0 &&
  smtpPort <= 65535 &&
  smtpUser &&
  smtpPassword &&
  emailFrom
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: smtpUser, pass: smtpPassword },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    })
  : null;

let db = null;
let mongoClient = null;
const looksLikeConfiguredUri = mongoUri?.startsWith("mongodb") &&
  !mongoUri.includes("<") &&
  !mongoUri.includes("cluster0.example");

if (looksLikeConfiguredUri && sessionSecret) {
  try {
    mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    db = mongoClient.db(dbName || undefined);
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("adminDirectory").createIndex({ userId: 1 }, { unique: true }),
      db.collection("emailVerifications").createIndex({ email: 1 }, { unique: true }),
      db.collection("emailVerifications").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    console.info("Connected to MongoDB Atlas.");
  } catch (error) {
    console.error("Could not connect to MongoDB Atlas. Check MONGODB_URI and network access.", error.message);
    await mongoClient?.close();
    mongoClient = null;
    db = null;
  }
} else {
  console.warn("MongoDB Atlas is not configured. Set MONGODB_URI and SESSION_SECRET in .env.");
}

if (!emailTransport) {
  console.warn("Email OTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM in .env.");
}

const app = createApp({ db, sessionSecret, emailTransport, emailFrom, appOrigins });
const server = app.listen(port, () => {
  console.info(`Jan Sahayak API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await mongoClient?.close();
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
