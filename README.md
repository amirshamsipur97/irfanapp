# irfanapp — irfaninvest.com Analytics & Lead Operations Dashboard

Internal dashboard for [irfaninvest.com](https://www.irfaninvest.com): GA4 traffic, Google Ads,
website form leads, AI chat conversations, and Vapi voice-call operations — in one place.

**Production:** https://irfanapp.vercel.app (password-gated)

## Architecture

```
irfaninvest.com (forms/chat/calls)      Google (GA4 · Ads)
        │                                     │
        ▼                                     │  every 30 min
Supabase (leads, call_attempts, …)  ◄───  n8n  ───  Google Sheets
        ▲                                     │
        │  end-of-call report                 ▼  POST /api/webhook/* (x-webhook-secret)
Vapi voice agent  ─────────────────►  this app  ──►  /dashboard (password)
```

- **This app** is server-rendered Next.js 16; all Supabase access happens in API routes (no DB keys in the browser).
- **n8n** pushes analytics + lead data into `/api/webhook/*` and reads the calling queue from `/api/leads/for-calling`, authenticating with the `x-webhook-secret` header.
- **Vapi** posts end-of-call reports (transcript + buyer-psychology analysis) to n8n, which writes to Supabase, two Google result-sheets, and this dashboard.

## Auth model

| Who | How |
|---|---|
| Humans | `/login` shared password (`DASHBOARD_PASSWORD`) → HMAC httpOnly cookie (30d). Gate lives in `src/proxy.ts` and covers all pages **and** data APIs. |
| Machines (n8n) | `x-webhook-secret` header, checked in the proxy and per-route. |
| Public | `/` landing, `/login`, `/api/health`, `/api/auth`, `/api/webhook/*` (each webhook verifies the secret itself). |

## Environment

Copy `.env.example` → `.env.local`. Production values live in Vercel.
`SUPABASE_SERVICE_ROLE_KEY` is preferred (required once RLS phase 2 is applied); the anon key is only a fallback.

## Develop & deploy

```bash
npm run dev          # local, http://localhost:3000
vercel deploy --prod --yes   # production (Vercel Pro, server-side build)
```

Health probe: `GET /api/health` (public, no data).

## Fonts

Peyda (the irfaninvest.com brand Persian face) is bundled in `public/fonts` — Latin text renders
in Geist, Persian/Arabic falls through to Peyda automatically; `[dir="rtl"]`/`.font-peyda` force it.

## Known debt (tracked in the standards audit)

1. RLS phase 2 (sensitive tables) — pending `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
2. Hardcoded keys inside n8n workflow nodes (Vapi, Anthropic) — migrate to n8n credentials + rotate.
3. `dashboard/page.tsx` (~2 900 lines) + `typescript.ignoreBuildErrors` — refactor & re-enable type checking.
4. No automated tests / CI / error tracking yet.
