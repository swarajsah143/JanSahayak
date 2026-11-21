import "dotenv/config";
import { MongoClient } from "mongodb";
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
const brevoApiKey = process.env.BREVO_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim();
const emailFromName = process.env.EMAIL_FROM_NAME?.trim() || "Jan Sahayak";
const emailTransport = brevoApiKey && emailFrom
  ? {
      async sendMail({ to, subject, text }) {
        const apiResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { name: emailFromName, email: emailFrom },
            to: [{ email: to }],
            subject,
            textContent: text,
          }),
        });
        const result = await apiResponse.json().catch(() => ({}));
        if (!apiResponse.ok) {
          throw new Error(`Brevo API ${apiResponse.status}: ${result.message || "Email request rejected."}`);
        }
        return result;
      },
    }
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
  console.warn("Email OTP is not configured. Set BREVO_API_KEY and EMAIL_FROM in the server environment.");
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
