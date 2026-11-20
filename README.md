# Jan Sahayak

A responsive, interactive starter for an AI-personalised government welfare scheme discovery and application assistant.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.
Run the unit tests with `npm test`.

## What's included

- Responsive React + Vite app shell with a sidebar, overview, and a filterable scheme dashboard across eight welfare categories.
- Scheme cards with category, department, benefit/deadline summaries, expandable eligibility and document notes, and official portal links.
- Scheme detail dialogs with overview, eligibility, an interactive document checklist, step-by-step online/offline application guidance, official portals, department contacts, and next steps after applying.
- Optional household profile form, search, saved schemes, language selector, and explainer dialog.
- Profile-match explanation cards that show which broad signals influenced each recommendation, with an explicit official-verification caveat.
- English, Kannada, and Hindi interface and scheme summaries, plain-language explanations, and Kannada text-to-speech in scheme details.
- A draggable, keyboard-accessible in-browser Scheme Assistant that answers common questions from the local scheme records, links to official sources, and avoids making eligibility decisions. The launcher starts in the bottom-right and the panel repositions to stay visible.
- Nearby CSC and government-office search by manually entered Indian city, district, or PIN code, with published contact details and OpenStreetMap directions.
- Registration/login and profile-management screens for name, date of birth, gender, location, income, occupation, social category, household details, and optional disability status.
- An in-app notification inbox for exact catalog deadline dates, started-but-incomplete document checklists, and relevant new or changed scheme records.
- A demo admin panel with browser-local scheme add/edit/delete and clearly marked placeholders for user management, eligibility rules, languages, analytics, and feedback.
- Framer Motion transitions, CSS illustration, mobile layout, and reduced-motion support.
- A parallax hero illustration with gently orbiting rings, breathing gradient sphere, floating leaves, particles, sparkles, and a motion-reduced static mode.
- Dark navy theme with refined purple, magenta, and cyan accents, crisp light text, softly glowing interactive cards, 3D hover effects, and an animated assistant.
- Sample schemes link to official portals. Scheme descriptions and eligibility notes are illustrative; confirm current requirements with the relevant department.

Registration, profile management, eligibility screening, chatbot responses, nearby-centre search, document checklist progress, and notifications are **prototype-only**. Notifications are in-app only while the page is open; there is no push, email, or SMS delivery. Deadline alerts require an exact `applicationDeadlineDate` (`YYYY-MM-DD`) in the local scheme record; the current illustrative catalog has no verified date-specific deadlines. Scheme changes are detected by comparing the catalog with a non-personal snapshot in browser storage, and are not live government updates. The app does not store profile details or checklist progress. The chatbot uses deterministic matching against the current local scheme catalog; it does not call an AI service or a live government database. The records are illustrative, not independently verified, and the assistant avoids confirming eligibility. Nearby-centre search asks for explicit consent and sends only the entered town, district, or PIN code to Photon and OpenStreetMap; it does not use GPS or save the query in this app. OpenStreetMap listings and contact details may be incomplete or out of date; use the linked official CSC locator to verify before travelling. Kannada and Hindi copy is simplified informational translation and should be reviewed by native speakers and confirmed with official scheme sources. Kannada speech depends on the voices available in the user's browser/device. Document suggestions are indicative and should be confirmed with the official scheme or local authority. The checker explains which broad profile signals influenced a recommendation and lists official checks, but does not confirm eligibility because verified scheme-specific rules are not connected. A location match is not claimed unless a scheme-specific location rule is configured. Do not enter real passwords or sensitive personal information.

The admin panel is a public demonstration, not a protected administrator account. Scheme edits are saved only in the current browser's `localStorage` and affect only that browser; clearing its site data resets the catalog. User accounts, eligibility-rule editing, translation editing, usage analytics, and feedback storage are not connected. Do not use this prototype to publish unverified scheme details or manage real citizen records.

## Project structure

```text
.
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.jsx
    ├── HeroIllustration.jsx
    ├── AdminDashboard.jsx
    ├── admin.css
    ├── admin-catalog.js
    ├── admin-catalog.test.js
    ├── chatbot.js
    ├── chatbot.test.js
    ├── chat-position.js
    ├── chat-position.test.js
    ├── service-centres.js
    ├── service-centres.test.js
    ├── data/
    │   ├── schemes.js
    │   └── schemes.test.js
    ├── eligibility.js
    ├── eligibility.test.js
    ├── localization.js
    ├── localization.test.js
    ├── notifications.js
    ├── notifications.test.js
    ├── main.jsx
    └── styles.css
```

The current profile matching is a front-end prototype and does not make an official eligibility decision. Before launch, connect to a secure authentication and data service, verified government scheme data, validate translations, and review privacy, accessibility, and application-submission requirements.
