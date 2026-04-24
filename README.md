PoolSightAI
===========

AI-powered construction intelligence platform for Calimingo Pools. Combines progress billing, LA permitting tools, and automated contract ingestion.

Deployed at: https://poolsight-ai.vercel.app

---

Stack
-----

- Framework: Next.js 14 (App Router, TypeScript)
- Database: Neon Postgres via Drizzle ORM
- AI: Anthropic Claude (vision + text), OpenAI Whisper (transcription)
- UI: React 18, Tailwind CSS, Framer Motion, react-leaflet
- Deployment: Vercel

---

Features
--------

### Progress Billing (Live Demo)

Upload 1–5 construction site photos from Trello. Claude Vision analyzes each image and returns a structured billing reconciliation report:

- Normalized sections: POOL & SPA, WALLS/VENEER, CONCRETE, LANDSCAPE, UTILITIES
- Per-row fields: line item, current %, suggested %, status, notes
- Status badges: Advance / Hold / Verify / OK
- PM Update context field (voice note or text)
- Client-side image optimization before sending to Claude

### Projects — Contract Management

Parse signed build contracts received from ProDBX/DBX via email. Extracts all line items, categories, addendums, and billing progress into a structured DB-backed project.

- Drag-and-drop line item reordering
- Inline progress % editing with auto-save
- Invoice tracking per line item
- Excel/spreadsheet export

### LA Permitting Tools (`/permits`)

Six AI-assisted tools for construction permitting in Los Angeles:

1. **LA Zoning Lookup** — queries ZIMAS for zoning code, setbacks, height limits, lot coverage. Displays geocoded parcel on an interactive map (react-leaflet). Shows Lightbox owner info and SODA permit history. Icon badges indicate data source (AI-estimated, LAMC-verified, Lightbox, SODA).
2. **Drawing Analyzer** — analyzes construction drawings
3. **Lot Coverage Calculator** — computes coverage against LA zoning limits
4. **Document Checklist Generator** — LADBS-specific document checklists
5. **PDF Assembler** — packages permit submission PDFs
6. **Redline Response Drafter** — drafts responses to LA plan check comments

---

Webhooks
--------

### `POST /api/webhooks/contract-email`

Triggered by Zapier when a `"Build Contract Signed"` email arrives at `billing@calimingo.com`. Parses the raw EML (base64), extracts order items and customer info, and upserts a project into the database.

### `POST /api/webhooks/contract-addendum`

Triggered by Zapier when a `"Build Addendum to Contract Signed"` email arrives. Handles three cases:

| Scenario | Behavior |
|----------|----------|
| Order not yet in system + original contract link present | Full parse (original + addendums) → create project |
| Order not yet in system + no original contract link | `422` — cannot bootstrap without original |
| Order already exists | Append only new addendums; existing line items and billing progress are never modified |

Both endpoints use `WEBHOOK_SECRET` for auth and log every run to the `webhook_logs` table.

See `report.md` for full behavior documentation and Zapier setup instructions.

---

Getting Started
---------------

### Prerequisites

- Node.js 18+
- npm
- Anthropic API key

### Install

```bash
npm install
```

### Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...

# Postgres (Neon recommended)
DATABASE_URL=postgresql://user:password@host/dbname

# Webhook auth (shared between contract-email and contract-addendum)
WEBHOOK_SECRET=your-secret-here

# Lightbox RE API (trial key)
LIGHTBOX_API_KEY=your-key-here
```

`.env.local` is git-ignored and never committed.

### Dev server

```bash
npm run dev
```

Default port: **3045** (set in `package.json`). Open `http://localhost:3045`.

### Database

Neon (serverless Postgres) is recommended.

```bash
npm run db:generate   # generate migration files from schema changes
npm run db:push       # push schema to database (dev)
```

To see the resolved local DB URL:

```bash
npm run db:url
```

### Tests

```bash
npm test
```

Runs Vitest. Current coverage: 42 tests across contract merger logic and EML parsing.

---

Deployment
----------

1. Connect GitHub repo to Vercel
2. Framework preset: **Next.js**
3. Set environment variables in Vercel dashboard:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` or `NEON_DATABASE_URL`
   - `WEBHOOK_SECRET`
   - `LIGHTBOX_API_KEY`
4. Build command: `npm run build` (default)

---

Security
--------

- No secrets in source code — all via environment variables
- Webhook endpoints use `crypto.timingSafeEqual` for constant-time secret comparison
- `.env*` files are git-ignored
- Anthropic key read server-side only (`/api/analyze`)
