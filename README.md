PoolSightAI – Construction Progress Intelligence & Billing Demo
==============================================================

Overview
--------

PoolSightAI is a Next.js (App Router) demo that shows how AI can turn raw construction site photos into a structured, billing‑ready reconciliation report. It is designed as an executive presentation plus a live “Weekly Billing Reconciliation” prototype for pool construction projects.

The app is optimized for:

* Clear stakeholder storytelling (Presentation tab).
* A concrete implementation roadmap (Project Plan tab).
* A working AI demo flow, with image upload, analysis, and sectioned billing tables (Live Demo tab).
* Token‑aware cost modeling (Cost Calculator tab).

Stack
-----

* Framework: Next.js (App Router, TypeScript ready)
* UI: React + Tailwind CSS, Framer Motion for presentation transitions
* AI: Anthropic Claude (vision) via server‑side `/api/analyze` route
* IDE / DX: Cursor AI IDE (recommended), Headless UI
* Deployment: Vercel‑ready
* Future storage: Neon Postgres (for Phase 3+ contextual memory)

Getting Started
---------------

### 1. Prerequisites

* Node.js 18+ (or the version Vercel recommends for your Next.js major)
* npm (or pnpm / yarn, if you adapt commands)
* An Anthropic API key with access to Claude vision models

### 2. Install dependencies

From the project root:

```bash
npm install
```

### 3. Environment variables

This project never hard‑codes secrets in the codebase. Configuration is done via environment variables.

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...

# Optional – for /projects (contract parsing, AI analysis, report entries)
# Use DATABASE_URL or NEON_DATABASE_URL
DATABASE_URL=postgresql://user:password@host/dbname
# NEON_DATABASE_URL=postgresql://user:password@neon-host/dbname
```

Notes:

* `.env.local` is **git‑ignored** and should never be committed.
* The Live Demo calls Anthropic only from the server, via the `/api/analyze` route, so your key is never exposed to the browser.

### 4. Run the dev server

```bash
npm run dev
```

By default this binds to `localhost` (see `package.json`), which also avoids some network interface quirks.

Open `http://localhost:3000` to view the app.

### 5. Local database setup (for /projects)

The **Projects** feature (contract parsing, line-item selection, AI analysis, saved report entries) requires a Postgres database. The app uses **Neon** (serverless Postgres) and **Drizzle ORM**.

#### Option A: Neon (recommended)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string from the Neon dashboard (e.g. `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. In `.env.local`, set either:
   ```bash
   DATABASE_URL=postgresql://...
   ```
   or
   ```bash
   NEON_DATABASE_URL=postgresql://...
   ```
4. Apply the schema to your database:
   ```bash
   npm run db:push
   ```
   Or generate and run migrations:
   ```bash
   npm run db:generate
   npx drizzle-kit migrate
   ```

#### Option B: Local Postgres (auto-detected when not on Vercel)

When running locally (not on Vercel), the app **auto-detects** and uses a default local URL if `DATABASE_URL` and `NEON_DATABASE_URL` are unset: `postgresql://<your-username>@localhost/calimingopoolsight`. So you can skip setting `.env.local` for the database when using local Postgres.

1. Install and start Postgres (e.g. via Homebrew: `brew install postgresql@16 && brew services start postgresql@16`, or Docker).
2. Create a database: `createdb calimingopoolsight` (or any name).
3. Optionally set in `.env.local` to override the default (e.g. different port or user):
   ```bash
   DATABASE_URL=postgresql://localhost/calimingopoolsight
   ```
   (Adjust user/password if needed, e.g. `postgresql://user:password@localhost:5432/calimingopoolsight`.)
4. Run `npm run db:push` (or generate + migrate as above). Drizzle Kit loads `.env.local` and uses the same auto-default when no URL is set.
5. To see the resolved local Postgres URL (e.g. for a GUI client like TablePlus or pgAdmin), run `npm run db:url`. When you start the app with `npm run dev`, the URL is also logged once in the terminal (password redacted).

#### Verify

- With a valid `DATABASE_URL` or `NEON_DATABASE_URL`, open `http://localhost:3000/projects` to use the Projects flow.
- If the database is not configured, the app will log a warning and project API routes will fail when called.

Key Features
------------

### Presentation tab

* Executive narrative that explains:
  * The problem (manual reporting, missed billing, invisible risk).
  * Why AI is now viable (cost, maturity, safety).
  * Model options across Anthropic and OpenAI, including:
    * Per‑100‑image cost ranges.
    * One‑time fees (e.g. domain).
    * Hosting options (Vercel tiers, Neon Postgres).
    * Optional dev/maintenance tools (Cursor, Copilot, Sentry, analytics).
* Animated using Framer Motion:
  * Slide‑in transitions when navigating.
  * Staggered entrance for bullets, roadmap phases, and “Additionally” opportunities.

### Project Plan tab

* Phased rollout (P1–P7) with:
  * Context narrative per phase.
  * Key outcomes with visually aligned check badges.
  * Implementation items tagged by priority.
* Helps stakeholders see how to start small (P1) and expand toward full contextual intelligence and mobile/PWA.

### Live Demo tab

* Upload 1–5 construction site photos.
* Client-side image optimization:
  * Resize and JPEG recompress to keep requests under model size limits.
  * Display of before/after size and quality.
* Server-side analysis:
  * `/api/analyze` posts images to Anthropic Claude using a **fixed JSON schema** for billing reconciliation.
  * Includes optional **PM Update** text as additional context.
* Normalized model output:
  * Sections like POOL & SPA, WALLS/VENEER, CONCRETE, LANDSCAPE, UTILITIES.
  * Per‑row fields: `line_item`, `current_percent`, `suggested_percent`, `status`, `notes`.
  * Status badges: **Advance**, **Hold**, **Verify**, **OK** with accessible colors and fixed pill widths.
* Result UI:
  * Standardized column widths across all reconciliation tables for easy scanning.
  * AI image analysis summary and early warning checks (sequence risks, coverage gaps, over‑billing risks).
  * Key action items with priority chips (Immediate, This Week, Verify, Next Cycle).
* PM Update UX & WCAG:
  * Proper `label` + `aria-describedby`, visible focus states.
  * Clickable suggestion badges that auto‑append typical PM notes (tile pickup, debris removal, rough‑in complete, etc.).
  * Character count and keyboard‑friendly controls.

### Cost Calculator tab

* Models monthly AI costs based on:
  * Active projects
  * Images per submission
  * Submissions per week
  * Model choice (Claude Haiku / GPT‑4o mini)
* Shows:
  * Images/month, requests/month.
  * Estimated input/output tokens and costs.
  * Simple infra tiers and a section describing added considerations once contextual memory and Neon Postgres are introduced.

Security and Secrets
--------------------

* Secrets are **never** hard‑coded in code.
* `.env*` files are ignored via `.gitignore`:
  * `.env`
  * `.env.local`
  * `.env.*.local`
* The Anthropic key is only read on the server (`process.env.ANTHROPIC_API_KEY`) in `app/api/analyze/route.ts`.
* If you accidentally committed a key elsewhere, rotate it in your Anthropic dashboard.

Vercel Deployment
-----------------

The app is already optimized for Vercel:

1. Build:

   ```bash
   npm run build
   ```

2. On Vercel:

   * Connect this GitHub repo (`blastheart1/PoolSightAI`).
   * Framework preset: **Next.js**.
   * Environment variables:
     * `ANTHROPIC_API_KEY` – required.
     * `NEON_DATABASE_URL` – optional (for future contextual memory).

3. Routing:

   * Uses `app/` directory; no custom `next.config.js` required for the current feature set.
   * API route `/api/analyze` runs as a Node.js server function by design.

4. Favicon & tab label:

   * Favicon is served from `public/favicon.ico`.
   * Tab title is set to `PoolSightAI` via `app/layout.tsx` metadata.

Neon Postgres Readiness
-----------------------

While the current demo is stateless (per‑run only), the project is prepared for Neon Postgres in Phase 3+:

* `NEON_DATABASE_URL` placeholder is defined in `.env.example`.
* The roadmap explicitly calls for:
  * Persistent submission history.
  * Delta reports per project.
  * Cumulative billing ledger.
* When implementing, you would:
  * Add a Postgres client (e.g. `@neondatabase/serverless` or a standard pooled driver).
  * Create tables for:
    * Projects
    * Submissions
    * Phase/billing snapshots
    * Audit/approval history
  * Store the normalized reconciliation JSON per submission so each new run can compare against history.

Codebase Hygiene
----------------

* The old Vite/React `src/` scaffold and `index.html` are no longer needed for the Next.js app (and should not be committed if you want a clean repo).
* `.next` build artifacts and `node_modules` are git‑ignored.
* Only assets under `public/` that are actually used (e.g. `favicon.ico`) are kept.

Development Workflow (Recommended)
----------------------------------

* Use **Cursor AI IDE** for:
  * Refactoring prompts.
  * Safely evolving the Anthropic prompt + JSON schema.
  * Quickly iterating on UI and accessibility improvements.
* Use feature branches + pull requests against `main` when evolving:
  * The billing schema.
  * The Neon persistence layer.
  * The deployment configuration.

Running a Production Build Locally
----------------------------------

```bash
npm run build
npm start
```

Then open `http://localhost:3000`.

Contributing / Next Steps
-------------------------

Short‑term ideas:

* Wire Neon Postgres for Phase 3+ contextual memory.
* Add authentication for PM dashboards.
* Extend the demo to support multiple saved projects.

If you’re reviewing this as a stakeholder, the Live Demo tab is the best place to see how AI can materially reduce manual review time and tighten billing accuracy with very low incremental cost.  
