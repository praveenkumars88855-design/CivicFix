# CivicFix

Hyperlocal infrastructure reporting with a React (Vite) frontend and a Node.js/Express API.

## Requirements

- Node.js 18 or later
- MongoDB, locally or through MongoDB Atlas

## Setup

Set `MONGO_URI` and a private `JWT_SECRET` in `server/.env`. **MongoDB must be running and reachable before starting the backend** (by default the connection is `mongodb://127.0.0.1:27017/civicfix`). If using MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string. For deployments, set `CLIENT_ORIGIN` to the frontend URL. Register an administrator with the optional `ADMIN_EMAIL` setting, or promote an existing account with the local admin command below. Optionally set `VITE_API_URL` in `client/.env` to change the API URL. Do not commit `.env` files.

Install dependencies in both project folders from the project root:

```cmd
cd /d E:\CivicFix\server
npm install
cd /d E:\CivicFix\client
npm install
```

Start MongoDB, then open two terminals. In the first terminal, start the backend:

```cmd
cd /d E:\CivicFix\server
npm run dev
```

In the second terminal, start the frontend:

```cmd
cd /d E:\CivicFix\client
npm run dev
```

Open `http://localhost:5173` in your browser. The API runs at `http://localhost:5000`; `/` and `/api/health` provide health checks. The backend requires a reachable MongoDB database before it starts.

## Create an administrator

Set `ADMIN_EMAIL` in `server/.env` before registering that address, or register the account first and promote it locally:

```sh
cd server
npm run admin:promote -- admin@example.com
```

The local command connects to MongoDB and changes only the requested existing account. Use the admin dashboard to promote citizen accounts to officer roles and manage reports.

## Features

- Password-hashed registration and JWT login with citizen, officer, and administrator roles
- Map-based issue reports with optional JPG, PNG, or WebP photos
- Citizen report history and status filters, resolution confirmation, and resolution review with optional new photo evidence
- Floating English/Tamil AI chat assistant for general visitors, with authenticated citizens able to check only their own reports and update history
- Configurable 15-day follow-up and 30-day escalation letter drafts for unresolved reports
- Private report photos served only to the report owner, assigned officer, or administrator
- Administrator issue queue, status updates, officer assignment, category totals, and user-role management
- Local keyword-based category and priority suggestions, plus nearby duplicate warnings

The initial issue triage is a local rules-based suggestion. The chat uses an AI provider through the backend, with a rule-based help mode when the provider is missing or unavailable. By default it uses Google Gemini: create a key at [Google AI Studio](https://aistudio.google.com/app/apikey), then add `AI_PROVIDER=gemini` and `GEMINI_API_KEY=your_key_here` to `server/.env`. Optionally set `GEMINI_MODEL`. To use OpenAI instead, set `AI_PROVIDER=openai`, add `OPENAI_API_KEY`, and optionally set `OPENAI_MODEL`. Restart the backend after changing these values. Do not put provider keys in `client/.env`, React code, or chat.

After explicit consent, the chat sends the visitor's message to the selected AI provider; an authenticated citizen may also send the selected report's title, description, category, department, status, location address, and update/follow-up history. It does not send a citizen's name, email, photo, or account identifier. The assistant explains this before sending. AI replies are not official decisions. For an eligible Tamil Nadu grievance, the assistant can point to CM Helpline 1100 and the [official portal](https://cmhelpline.tnega.org/portal/en/home); citizens must check whether their department/issue is eligible. It will not guess an authority for other regions. A visitor must sign in to retrieve report status or private complaint details.

Unresolved reports become eligible for an in-app follow-up after 15 days and an escalation draft after 30 days by default. Eligibility checks both actual report age and the time since the latest recorded status update, so recent progress prevents a premature recommendation. Override these settings with `FOLLOW_UP_DAYS` and `ESCALATION_DAYS` in `server/.env`; escalation must be later than follow-up. These are configurable product rules, not legal deadlines. The generated letter uses the real report ID, description, date, location, status, and recorded update/follow-up history. Citizens must review the draft and confirm before CivicFix records it. CivicFix does not submit it to a government authority. If the citizen has already filed through an official channel, an optional reference number can be recorded; that does not represent a CivicFix submission.

When a citizen says a resolved report is still unresolved, they can request review with a note and optional evidence photo. CivicFix changes the status to Reopened and appends the request to report history without erasing existing updates. Uploaded report photos are served through authenticated, report-scoped API routes. Location search and map tiles use OpenStreetMap services and require an internet connection. For production deployment, configure your own tile/geocoding providers and deployment-specific upload storage.

No additional packages are required for the assistant; the backend uses Node's built-in `fetch`.

## Stack

- React, Vite, React Router, Axios, and React Leaflet
- Node.js, Express, and Mongoose
- MongoDB
