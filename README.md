# Jan Sahayak

A responsive, interactive welfare-scheme discovery and application assistant with MongoDB Atlas-backed account authentication.

## Requirements

- Node.js 20.19 or newer
- A MongoDB Atlas cluster

## Configure MongoDB Atlas

1. Copy the server environment template:

   ```bash
   cp .env.example .env
   ```

   If `.env` already contains your Atlas URI and session secret, do not overwrite it; add only any missing settings.

2. In MongoDB Atlas, create a database user, allow your development IP under **Network Access**, then choose **Connect → Drivers** and copy the connection string into `MONGODB_URI` in `.env`. Replace the username, password, and cluster host with your Atlas values; URL-encode special characters in the password. Set `MONGODB_DB_NAME` to the database name you want.
3. Generate a private session-signing secret and put it in `SESSION_SECRET`:

   ```bash
   openssl rand -base64 48
   ```

4. Keep `.env` private. Never add the MongoDB URI or session secret to frontend code, a `VITE_` variable, source control, or a public screenshot.

The `.env.example` contains placeholders only. Authentication stays disabled until valid Atlas settings are supplied.

## Configure email OTP

Account creation sends a six-digit verification code through Brevo's transactional email HTTP API. Create a Brevo account, generate an API key, and register and verify the sender address you want to use. Set these values in the server-side `.env` file and in the Render API service's environment:

- `BREVO_API_KEY` (keep it private and only set it on the API server)
- `EMAIL_FROM` (a sender address registered and verified in Brevo)
- `EMAIL_FROM_NAME` (optional; defaults to `Jan Sahayak`)

Registration returns as soon as the OTP request is saved; email delivery continues in the API background, and the signup page checks delivery status so failures can be retried. Brevo's API is called over HTTPS, so it works on Render Free where outbound SMTP ports are blocked. Brevo's Free plan currently includes 300 email sends per day. A static Vercel deployment only serves the frontend and does not run `server/index.js`. Set the Vercel `VITE_API_URL` to the deployed API origin, and deploy/restart the API after changing server code or environment variables. Codes expire after 10 minutes, can be resent after 60 seconds, and allow five verification attempts. The API stores only a keyed code hash in MongoDB while verification is pending; it does not store the plain code. Check Brevo's transactional email logs if the API accepts a message but it doesn't arrive.

## Run locally

```bash
npm install
npm run dev
```

This starts the API on `http://localhost:3001` and the Vite website on `http://localhost:5173`. Vite proxies `/api` requests to the backend. The API connects to Atlas, creates the required indexes, and reports connection/configuration errors in its terminal.

Run tests and create the frontend production build:

```bash
npm test
npm run build
```

## Authentication and administrator setup

- Registration sends an email OTP and creates the account only after successful verification. Sign-in uses the Node/Express API. Passwords are hashed with bcrypt; authentication uses a signed, HTTP-only cookie. The browser never receives the database URI, Brevo API key, or password hash.
- New accounts always receive the `user` role. To make the first admin, register and sign in normally, then use Atlas **Data Explorer** to find that record in `jan_sahayak.users` and change only its `role` field to `admin`. The API reads the role from MongoDB on protected requests; public registration cannot assign it.
- Admins can publish a display name, title, department, and optional public contact under **Admin details**. Only those fields appear in the public directory.
- Account email and display name are stored in MongoDB. Welfare profile details, including income, disability, household information, and location, remain in the current page session.
- Scheme edits in the current admin dashboard remain browser-local; they are not shared through MongoDB.

For production, serve the frontend and API on the same site, or proxy `/api` to the API while preserving same-origin requests. Set `APP_ORIGINS` to the exact frontend origin(s), use HTTPS, set `NODE_ENV=production`, and use a strong unique `SESSION_SECRET`. Do not expose MongoDB Atlas to all IP addresses; restrict network access to the application server.

## API routes

- `GET /api/health` — reports whether Atlas and email delivery are configured.
- `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/resend-otp`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/auth/profile` — updates the account display name only.
- `GET /api/admin-directory` — returns explicitly published public contact fields.
- `GET /api/admin-directory/me`, `PUT /api/admin-directory/me` — admin-only directory editing.

## What's included

- Responsive React + Vite app shell with a sidebar, overview, and filterable scheme dashboard across eight welfare categories.
- Scheme cards with category, department, benefit/deadline summaries, eligibility and document notes, official portal links, and application guidance.
- Optional household profile form, search, saved schemes, language selector, and explainer dialog.
- English, Kannada, and Hindi interface and scheme summaries, plain-language explanations, and Kannada text-to-speech in scheme details.
- A draggable, keyboard-accessible Scheme Assistant that answers from local scheme records without claiming official eligibility.
- Nearby CSC and government-office search by manually entered city, district, or PIN code.
- In-app reminders for exact catalog deadline dates, incomplete document checklists, and relevant local catalog changes.
- MongoDB Atlas-backed account registration/login, protected user/admin roles, and a public administrator directory.
- Admin-only dashboard with browser-local scheme add/edit/delete and clearly marked placeholders for unconnected management features.
- Framer Motion transitions, animated hero illustration, dark navy theme, purple/cyan accents, mobile layout, and reduced-motion support.

Scheme descriptions and eligibility notes are illustrative. Verify current requirements with the relevant government department. The chatbot, nearby-centre search, scheme catalog, notifications, and eligibility explanations are informational and are not connected to a live government database.

## Project structure

```text
.
├── .env.example
├── package.json
├── server/
│   ├── app.js
│   ├── app.test.js
│   ├── email-verification.js
│   ├── email-verification.test.js
│   ├── index.js
│   ├── validation.js
│   └── validation.test.js
└── src/
    ├── api.js
    ├── App.jsx
    ├── AdminDirectory.jsx
    └── ...
```
