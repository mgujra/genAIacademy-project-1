# IPO Tracker

IPO-centric investment research app with a background AI agent that monitors SEC filings, curates target IPO dates, evaluates prospectus risks, and tracks 6-month performance (offer, opening, and current prices).

> **Documentation:**
> - [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture, layers, data flows, and deployment topology
> - [APPLICATION.md](APPLICATION.md) — full user and operator guide, API reference, and secret-handling

## Features

- **IPO Directory** — Lists upcoming and past IPOs sourced from SEC EDGAR (S-1, F-1, 424B4, EFFECT)
- **Date Curator Agent** — Infers target IPO dates from SEC filings with confidence scores
- **Risk Analyzer Agent** — Evaluates prospectus Risk Factors with structured assessments
- **Performance Tracking** — Offer price, opening day price, current price, and return %
- **Background Jobs** — Inngest-powered sync every 6 hours (filings) and hourly (prices)
- **Optional Chat** — Ask questions about specific IPOs on the detail page

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn-style components
- PostgreSQL (Neon/Supabase) + Drizzle ORM
- Inngest (background jobs & agent orchestration)
- Vercel AI SDK + OpenAI (optional)
- SEC EDGAR API + Yahoo Finance / Polygon market data

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase, Neon, or local) |
| `SEC_USER_AGENT` | `"AppName you@email.com"` — required by SEC |

Optional:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Enables LLM date curation and risk analysis |
| `MARKET_DATA_PROVIDER` | `yahoo` (default) or `polygon` |
| `POLYGON_API_KEY` | Required when using Polygon |

### 3. Push database schema

```bash
npm run db:push
```

### 4. Seed IPO data from SEC

```bash
npm run seed
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For Inngest background jobs locally, run the Inngest dev server in a separate terminal:

```bash
npx inngest-cli@latest dev
```

## Deploy to Vercel

1. Push to GitHub and import the repo in [Vercel](https://vercel.com)
2. Add a PostgreSQL database ([Neon](https://neon.tech) or [Supabase](https://supabase.com))
3. Set environment variables from `.env.example`
4. Install [Inngest for Vercel](https://vercel.com/marketplace/inngest) from the marketplace
5. Deploy — Inngest auto-syncs functions from `/api/inngest`

### Health check

```
GET /api/health
```

Returns database status, last SEC sync, and configured integrations.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ipos` | GET | Paginated IPO list with filters |
| `/api/ipos/[cik]` | GET | IPO detail with agent outputs |
| `/api/ipos/[cik]/performance` | GET | 6-month price history |
| `/api/agent/analyze/[cik]` | POST | Trigger manual agent analysis |
| `/api/sync` | POST | Manual SEC filing sync |
| `/api/chat` | POST | Streaming IPO Q&A (requires OpenAI) |
| `/api/health` | GET | System health status |
| `/api/inngest` | * | Inngest function serve endpoint |

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `sec-filing-sync` | Every 6 hours | Discovers new SEC IPO filings |
| `ipo-date-curator` | On new S-1 | Curates target IPO date |
| `prospectus-risk-analyzer` | On filing update | Analyzes prospectus risks |
| `ipo-price-sync` | Hourly | Updates offer/open/current prices |

## Security & Secrets

**Safe to commit:** source code, `.env.example` (placeholders only), documentation.

**Never commit:** `.env`, `.env.local`, or any file containing real API keys, database passwords, or tokens. These are excluded by `.gitignore`.

Before pushing, verify:
```bash
git status                    # No .env files listed
git ls-files | grep '\.env'   # Only .env.example
```

Set real credentials in Vercel Environment Variables or a local `.env.local` file (not tracked by git).

## Disclaimer

This application aggregates publicly available SEC and market data for research purposes. It does not constitute investment advice. Market data may be delayed. Always verify information against official SEC filings.
