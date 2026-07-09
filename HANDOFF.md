# 🚀 irfanapp — Session Handoff Document

**Last updated:** 2026-07-09
**Status:** Production deployed, live customer traffic, voice pipeline operational
**Purpose:** Complete context for a new Claude session to continue work seamlessly.

---

## 0. SESSION LOG 2026-07-01 → 07-09 (read this first — everything below §1 predates it)

### Voice call system — OPERATIONAL end-to-end ☎️
- **Number:** US +1 775 451 2951 (separate PAID Twilio account; the old trial account has zero numbers and caused the original "number not available"). Imported into Vapi, `phoneNumberId = ebc17de7-303b-4ec3-be6d-cd9feaa086ea`.
- **Assistant:** "Irfaninvest Ai agent" `69029075-4a30-4d17-90c6-b38d6298db6d` (persona "Sam", claude-haiku-4-5, prompt includes freehold/residency pitch). Ghost Vapi number +96876644000 (`f76c18da…`, assistant Riley) is deletable.
- **Vapi Private key** lives in the n8n `Create Vapi Outbound Call` node Authorization header (`9f285a71-…`). Old `dc022924-…` key is dead (401).
- **End-of-call loop:** assistant `server.url` → `https://analytics-test.app.n8n.cloud/webhook/vapi-call-ended-v2`, serverMessages=[end-of-call-report], analysisPlan.structuredDataPlan = **17 buyer-psychology fields** (interest_level, buyer_persona, sentiment, objections, lead_score, recommended_strategy, followup_message…). n8n `Extract Call Data` parses the NATIVE Vapi format (`body.message.analysis.structuredData.*`).
- **Result sheets (amiralishamsipur@gmail.com):** report-after-call `1rMoYJgr-WNCOHdpUz9wxhg2eYmpyXem-tnd-jopsJeE` (25 cols) + call-conversation `1eucOgVN35UUaycduYcUdHKeDdsrAwYOhob6ap6uBYts` (20 cols incl. psychology). Written by n8n nodes `Save Call Report Sheet` / `Save Psychology Sheet` using credential **"Google Sheets account 4" (`uThv0wq533tfO2eV`)** — accounts 1–2 are token-dead, 4/5/6 work.
- **Latency tuned** (user felt delay): startSpeakingPlan.waitSeconds 0.4→0.3, livekit waitFunction max 2000→**1100ms**, backoffSeconds 1→0.7. Baseline turn avg was ~3.6s. ⚠️ Transcriber is `flux-general-en` (ENGLISH-ONLY) — Persian/Arabic callers can't be transcribed; switching to a multilingual Deepgram model is an open decision.
- **Real customers already called:** Ifthakhar Eresh (+44), Essam Sakr (+971) on 07-07.

### n8n (account now PRO — free-plan quota exhaustion caused a 2-run outage 07-07 09:30–10:00)
- Main wf `M2Yct119lYGxAuGu` (30-min sync) — active, green. Legacy duplicate wf `GkEb3JMttD90NLHs` **deactivated** (was double-pulling GA4/Ads to a dead host).
- Auto-call watcher `GBgpcthXcl5MbwZw` — active, ~every 2-4 min, reads Form Property Database sheet, dedupes by Lead ID history, timezone-gated, max 5/run, sends `metadata.lead_id`.
- `Interested?` IF node fixed (loose validation single OR condition — old strict-boolean crashed every end-of-call). Legacy sheet/WhatsApp/update nodes set onError=continue.

### Lead pipeline — duplicate ROOT CAUSE fixed (07-07)
- `leads.dedup_key` column default = `gen_random_uuid()`; edge fn never set it → every site lead duplicated 30 min later by the n8n sync. **Fixed:** migration `merge_duplicate_leads_and_canonical_dedup_keys` (merged 23 dup pairs, 134→111 rows, normalized ALL phones to `+digits`) + **submit-form edge fn v8** computes the same canonical key (E:email → P:last-8-digits → C:lead_id), normalizes phone, UPSERTs on dedup_key. E2E verified (double-submit → same row id).
- `/api/leads/for-calling` rewritten: `since` param (new-leads-only), `e164_phone` normalization, test-row exclusion (`__*`,`zz*`,`*test*`,`*probe*`), null-quality allowed, attempts cap. n8n reads it with `x-webhook-secret`.

### Dashboard app hardening (this repo)
- **Auth:** `/login` page + `POST/DELETE /api/auth` + `src/proxy.ts` (Next 16 middleware) — HMAC httpOnly cookie `dash_session` (30d, AUTH_SECRET). Gates ALL pages + data APIs. Public: `/`, `/login`, `/api/auth`, `/api/health`, `/api/webhook/*`; machines pass with `x-webhook-secret`. **Dashboard password: `Irfan-Dash-f81d3c19`** (env DASHBOARD_PASSWORD; in Vercel prod + .env.local).
- Security headers in next.config; `.env.example`; package renamed my-app→irfanapp v1.0.0; README rewritten; `/api/health` public probe; Sign-out button; **Voice tab** wired to live `/api/calls` data (old "Awaiting Vapi credential" was a hardcoded placeholder); **Peyda fonts** bundled (`public/fonts`, Persian glyphs auto-render via font stack).
- `lib/supabase.ts` prefers `SUPABASE_SERVICE_ROLE_KEY` (anon fallback). **RLS phase 1 APPLIED** in Supabase (properties/projects/project_units/areas/developers = anon SELECT-only). **RLS phase 2 (leads/call_attempts/analytics_*) PREPARED but waiting for the user to provide the service_role key** → set in Vercel → apply → verify.
- Landing `/` = dark-green Figma landing (DataWise-style) with real product content.
- Standards audit artifact: https://claude.ai/code/artifact/2aa44215-0926-43e0-9fd9-2ff932e043c8

### Sister project — NexProp SaaS (SEPARATE repo `../propertyfinder`)
- Startup productization of this system. **Live at https://nexprop.io** (Vercel project `propertyfinder`, needs `--scope amirshamsipurs-projects`). Dark Figma redesign (669:23117): floating SideNav w/ orange CTA, metallic NeXPROP wordmark, exact SVG sphere bg (757:28319), 6 mono modules, logo grid, red NeX™ band, Capture/Qualify/Automate/Analyze/Scale tabs, dark pricing/comparison. Fonts: Google Sans Flex (local) + JetBrains Mono. `/login` = workspace picker → tenant "irfaninvest" → this dashboard's login. Master SaaS spec: `docs/SAAS-MASTER-PROMPT.md` (this repo).

### Google Ads (live campaign)
- "AE | EN | Oman Property & Investment | Search | P1" started 07-03, in bid-learning. Early: CTR ~12.5%. ⚠️ Conversion tracking broken ("Detected issues") — import GA4 `generate_lead` as a Key Event into Ads; add UTMs to final URLs (0 leads have UTM). Keyword expansion material: `../whitewill-landing/marketing/semrush/`.

### TOP TODOs for next session
1. RLS phase 2 — needs `SUPABASE_SERVICE_ROLE_KEY` from the user (Supabase → Settings → API Keys).
2. Google Ads conversion import (GA4 generate_lead) + UTM on final URLs — time-sensitive for bid learning.
3. WhatsApp confirmations still on Twilio sandbox (nodes onError=continue) — switch to SMS via +17754512951 or verify a real sender.
4. Vapi transcriber multilingual decision (fa/ar callers).
5. Debt: dashboard/page.tsx ~2900 lines + ignoreBuildErrors; no tests/CI/Sentry; n8n hardcoded keys → credentials + rotate; KPI "ADS CLICKS" sums REMOVED campaigns.

---

## 1. Project Overview

**irfanapp** = Analytics & CRM platform for **irfaninvest.com** — a luxury real estate investment consultancy in Muscat, Oman.

### Core Purpose
Unified control center that ingests data from every channel (GA4, Google Ads, web forms, AI chat, voice calls) and turns it into scored leads + AI-analyzed insights for the sales team.

### Business Context
- **Company:** IrfanInvest — luxury RE in Oman (ITC freehold zones)
- **Projects:** Aida (Dar Global), Maison Shirdel, Hawana Salalah Amazi, Faysal Landing, Sara Landing, Mehdi Landing, Mohsen Landing, Floor Plane Oman
- **Buyer markets:** UAE, UK, Qatar, Saudi Arabia, India, Russia
- **Site is multilingual:** en / ru / ar / fa
- **Senior advisor:** Amir

---

## 2. Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16.2.4 · React 19 · TypeScript · Tailwind CSS · Material Design 3 tokens · Recharts |
| Hosting | Vercel (Pro) — auto-deploys via `vercel --prod` |
| Database | Supabase (PostgreSQL) — project id `owgvrxipqlusepozlujv` |
| Automation | n8n (self-hosted at `analytics-test.app.n8n.cloud`) |
| Voice AI | Vapi (Anthropic Claude Haiku 4.5) |
| Messaging | Twilio (WhatsApp Sandbox trial) |
| LLM | Anthropic Claude (Sonnet 4.6, Haiku 4.5) + OpenAI gpt-4o-mini |
| Analytics | GA4 Data API + Google Ads API |

---

## 3. Working Directory

```
/Users/amirshamsipur/Claude code/irfanapp/
```

**Git repo:** github.com/amirshamsipur97/irfanapp (main branch active)

### Key file structure
```
src/app/
├── page.tsx                           # Landing page
├── dashboard/page.tsx                 # Main dashboard (~2900 lines, 11 tabs)
├── leads-dashboard/page.tsx           # Standalone CRM
├── globals.css                        # Material Design 3 tokens
├── layout.tsx
└── api/
    ├── data/route.ts                  # GA4 + Ads GET for dashboard
    ├── realtime/route.ts              # Realtime traffic GET (with daily fallback)
    ├── leads/route.ts                 # Leads GET with filters
    ├── conversations/route.ts         # AI convos GET
    ├── analyze/route.ts               # Claude AI insights
    ├── ai/leads-ceo-report/route.ts  # CEO executive report
    ├── ai/score-leads/route.ts       # Retroactive lead scoring
    ├── leads/for-calling/route.ts    # Vapi outbound source
    └── webhook/
        ├── ga4/route.ts               # GA4 daily data ingest
        ├── ga4-realtime/route.ts      # GA4 realtime ingest
        ├── ads/route.ts               # Google Ads ingest
        ├── google-ads/route.ts        # (legacy alias)
        ├── form-leads/route.ts        # Website form ingest
        ├── leads/route.ts             # (user-modified — DO NOT REVERT)
        ├── ai-conversations/route.ts  # All AI chat sessions
        ├── ai-qualified-leads/route.ts # AI-scored high-intent leads
        ├── voice-leads/route.ts       # Vapi inbound calls
        ├── call-attempts/route.ts     # Outbound call log
        └── update-lead/route.ts       # Vapi call-ended updates
```

**Critical note:** `src/app/api/webhook/leads/route.ts` was **user-modified** — has advanced dedup logic (email → phone → content hash). **Never revert.**

---

## 4. Live URLs

### Primary
| Purpose | URL |
|---------|-----|
| 🌐 Website | https://irfaninvest.com |
| 🚀 Dashboard | https://irfanapp.vercel.app/dashboard |
| 📋 Leads CRM (standalone) | https://irfanapp.vercel.app/leads-dashboard |
| 🏠 Landing | https://irfanapp.vercel.app |

### Admin panels
| Service | URL |
|---------|-----|
| Vercel | https://vercel.com/amirshamsipurs-projects/irfanapp |
| Supabase | https://supabase.com/dashboard/project/owgvrxipqlusepozlujv |
| n8n workflow | https://analytics-test.app.n8n.cloud/workflow/M2Yct119lYGxAuGu |
| Vapi | https://dashboard.vapi.ai |
| Twilio | https://console.twilio.com |
| GitHub | https://github.com/amirshamsipur97/irfanapp |

---

## 5. All Webhook Endpoints

All accept `POST` with header `x-webhook-secret: irfan_secret_2024`.
All return `{ success: true, source, total_records }` (or 401 on wrong secret).
All handle empty payload gracefully with `total_records: 0`.

| Endpoint | Purpose |
|----------|---------|
| `/api/webhook/ga4` | GA4 daily analytics from n8n |
| `/api/webhook/ga4-realtime` | GA4 Realtime API snapshot (currently disabled) |
| `/api/webhook/ads` | Google Ads campaigns (canonical) |
| `/api/webhook/google-ads` | (legacy alias for ads) |
| `/api/webhook/form-leads` | Website form submissions |
| `/api/webhook/ai-conversations` | Every AI chat session (not merged with leads) |
| `/api/webhook/ai-qualified-leads` | Only AI convos with buying intent |
| `/api/webhook/leads` | (user-managed dedup logic) |
| `/api/webhook/voice-leads` | Vapi inbound call data |
| `/api/webhook/call-attempts` | Outbound call attempt log |
| `/api/webhook/update-lead` | Post-call lead status update |

---

## 6. Vercel Environment Variables

Already set in production:
```
NEXT_PUBLIC_SUPABASE_URL     # Public
SUPABASE_ANON_KEY            # Encrypted
ANTHROPIC_API_KEY            # Encrypted (Claude access)
WEBHOOK_SECRET               # = irfan_secret_2024
```

---

## 7. Supabase Database Schema

**Project:** `owgvrxipqlusepozlujv`

### Analytics tables
| Table | Purpose |
|-------|---------|
| `analytics_ga4` | 132+ rows (daily GA4 by date/country/city/page) |
| `analytics_ga4_realtime` | Snapshot table (currently empty, realtime disabled) |
| `google_ads_campaign_data` | 15+ campaigns with clicks/impressions/cost |

### Lead & conversation tables
| Table | Rows | Purpose |
|-------|------|---------|
| `leads` | 89 | Combined form + AI-qualified leads (with `source_sheet` field) |
| `ai_conversations` | 27 | Every AI chat session (unique `conversation_id`) |
| `analytics_ga4_realtime` | 0 | Realtime traffic snapshots |

### Key lead source_sheet values
- `form_property_db` — website form leads
- `ai_qualified_leads` — high-intent AI conversations converted
- `vapi_inbound_call` — voice inbound
- `vapi_outbound_campaign` — voice outbound

---

## 8. n8n Workflow — Master Reference

**Workflow ID:** `M2Yct119lYGxAuGu`
**Name:** `irfaninvest — Analytics + Leads + Vapi + Realtime`
**Status:** Active, 57 nodes, 4 triggers
**MCP Access:** Enabled

### Branch 1 — Every 30 Minutes (schedule)
```
Every 30 Minutes → Fetch GA4 Data → Aggregate → Send GA4 to Dashboard
                → Fetch Google Ads → Aggregate → Send Ads to Dashboard
                → Fetch Form Property DB → Normalize → Aggregate → Send Form Leads to Dashboard
                → Fetch AI Chat Conversations → Normalize → AI Qualification (gpt-4o-mini)
                    → Combine → Aggregate → Send AI Conversations to Dashboard
                    → Filter Qualified → Aggregate → Send Qualified AI Leads to Dashboard
```

### Branch 2 — Every 2 Minutes (Realtime) — DISABLED
GA4 Realtime API branch is currently disabled because HTTP node can't use `googleAnalyticsOAuth2` credential type. Dashboard falls back to daily data via `mode: 'fallback_daily'` in `/api/realtime`.

### Branch 3 — Vapi Inbound Webhook
```
Webhook (vapi-inbound-v2) → Normalize Inbound Voice Lead → AI Qualify Voice Lead
    → Check Calendar → Slot Available? →
        TRUE:  Create Appointment (Inbound) → Merge Results
        FALSE: Find Alternative Slots → Merge Results
    → Prepare Inbound Lead → Send Inbound to Dashboard
    → WhatsApp Confirmation (Inbound)
    → Prepare Inbound Row → Save Inbound to Client Sheet   ← NEW
```

### Branch 4 — Vapi Outbound Campaign (manual)
```
Run Outbound Campaign → Fetch Conversations for Calling → Filter Valid Phones (TIMEZONE!)
    → Prioritize Hot Leads → Create Vapi Outbound Call → Save Call Attempt
```

### Branch 5 — Vapi Call Ended Webhook
```
Webhook (vapi-call-ended-v2) → Extract Call Data → Interested? →
    TRUE:  Create Appointment (Outbound) → Update Lead (Interested) → WhatsApp (Outbound)
           → Prepare Interested Row → Save Interested to Client Sheet   ← NEW
    FALSE: Update Lead (Not Interested)
           → Prepare Not Interested Row → Save Not Interested to Client Sheet   ← NEW
```

### n8n Credentials
| Credential | ID | Type | Used by |
|-----------|-----|------|---------|
| Google Analytics account 3 | `5NUOznwuRsqtdQXF` | `googleAnalyticsOAuth2Api` | Fetch GA4 Data |
| Google Ads account | `o0W4T0PxocTZuW3N` | `googleAdsOAuth2Api` | Fetch Google Ads |
| Google Sheets account | `cJSsSNhyRDc1s6sR` | `googleSheetsOAuth2Api` | Fetch Form DB, AI Chat, Conversations for Calling (READ only — WRITE fails!) |
| **Google Sheets account 4** | `uThv0wq533tfO2eV` | `googleSheetsOAuth2Api` | **3 Save nodes (WRITE)** — the ONE that works for append! |
| Google Calendar | Auto | `googleCalendarOAuth2Api` | Check + Create appointments |
| OpenAI | Auto | `openAiApi` | OpenAI Model (gpt-4o-mini) |
| Twilio account | `WU2PKO6CuOMpLrfC` | `twilioApi` | Both WhatsApp nodes (⚠ needs Account SID + Auth Token in UI) |

### Important lessons learned
1. **Google Sheets `account` (no number)** → OAuth has READ scope, WRITE **fails** with "Unable to sign without access token"
2. **Google Sheets `account 4`** → WRITE works. Use this for any `append` operation.
3. **HTTP Request node** can't use `googleAnalyticsOAuth2` credential directly. Use predefined credential or hardcoded bearer.
4. **`autoFix: true` on Output Parser** requires OpenAI Model connected to the parser itself (not just the agent).
5. **Trial Twilio** = only US numbers, only verified recipients — production needs upgrade.

---

## 9. Google Sheets Reference

### Sheet inventory
| Name | ID | Role |
|------|-----|------|
| **Vapi call** | `1Ew-8XgvAcMJB6HgGDuKVLJl__hHOMRZQwpxqk0si2Sw` | 🟢 Destination — Vapi conversation logs (30 columns) |
| **Form Property Database** | `1z3iSemlEHMAolB0sTLbM3SD3Zd3ySzNPM7J93tIEN-I` | 📝 Source — website form leads |
| **Ai Agent Data** | `?` (user has, unknown ID) | 🔵 Should be source for Fetch Conversations for Calling |
| **AI Agent Conversations** (old) | `1OJoKaIltqb3lLRIXx7vRqSMzf-QTfCA4Ibz3gTwjzhU` | ⚠ Fetch Conversations for Calling still points here — needs update to `Ai Agent Data` |

### Vapi call sheet column headers (30 columns, tab-separated)
```
timestamp	conversation_id	direction	source	country_code	phone	full_name	language	email	property_interest	budget	preferred_location	intent	urgency	qualified	lead_score	call_duration_sec	recording_url	summary	user_message	ai_response	full_transcript	next_action	sales_status	timezone	local_hour	buyer_persona	confidence_level	recommended_strategy	followup_message
```

**Owner:** `amiralishamsipur@gmail.com`
**Sharing:** Restricted (not "anyone with link")

---

## 10. Vapi Configuration

### API Key (PUBLIC KEY — needs rotation!)
```
(redacted — see Vapi Dashboard → API Keys)
```
Hardcoded in `Create Vapi Outbound Call` node's Authorization header (`Bearer <key>`).

### Anthropic Integration
✅ Connected in Vapi Settings → Integrations → Anthropic (uses user's Anthropic API key)

### Assistant
| Property | Value |
|----------|-------|
| Name | `Appointment Receptionist` |
| **Assistant ID** | `69029075-4a30-4d17-90c6-b38d6298db6d` |
| Model | Claude Haiku 4.5 (Anthropic) |
| Voice | 11labs turbo v2 5 (`dN8hviqdNrAsEcL57yFj`) |
| Transcriber | Deepgram Flux General English |
| Cost | ~$0.11/min |
| Latency | ~1400ms |
| First Message | Generic appointment scheduler (not IrfanInvest-tailored yet) |
| System Prompt | Generic — pending customization for IrfanInvest luxury RE context |

### Phone Number ID (in workflow)
`a9eb9305-d0ba-4384-8e9b-d38266282e0b` — **status unverified**, may not be provisioned.

### Assistant Overrides sent per call
```json
{
  "leadName": "$json.full_name",
  "propertyInterest": "$json.property_interest",
  "budget": "$json.budget",
  "country": "$json.country",
  "leadScore": "$json.lead_score"
}
```
Assistant can use `{{leadName}}`, `{{propertyInterest}}`, etc. in prompts.

---

## 11. Twilio Configuration

### Trial Account
- Account SID: `AC499...(redacted)`
- Auth Token: `(redacted — see Twilio Console)` **(EXPOSED IN TRANSCRIPT — ROTATE!)**
- Balance: $15.50 trial
- Restrictions: only verified numbers can send/receive

### WhatsApp `from` in workflow
```
whatsapp:+14155238886   # Twilio Sandbox
```
Clients must first send `join <keyword>` to `+14155238886` to receive messages.

---

## 12. Dashboard — 11 Tabs

| Tab | State variable | Data source |
|-----|----------------|-------------|
| 📊 Marketing (default) | `store` | `/api/data` — GA4 + Ads |
| Top Pages | `store.rows` | (same) |
| 🌍 Geography | `realtime` + `store.rows` | `/api/realtime` (with fallback mode) |
| 📢 Google Ads | `store.ads` | (same) |
| 📝 Form Leads | `leadsStore` filtered by `source_sheet=form_property_db` | `/api/leads` |
| 💬 AI Convos | `convos` | `/api/conversations` |
| ✦ Qualified AI | `leadsStore` filtered by `source_sheet=ai_qualified_leads` | `/api/leads` |
| 👥 Combined | `leadsStore` (all) + `convos` | `/api/leads` + `/api/conversations` |
| 📞 Calls | `callsStore` | `/api/leads/for-calling` |
| 🎙 Voice | (placeholder) | — |
| 🧠 AI Insights | `analysisResp` | `/api/analyze` (Claude Sonnet) |

### Key features
- Auto-refresh: `store` every 5 min, `realtime` every 30 sec
- Conversation Explorer with expand-to-drill-down (user message + AI response + summary)
- Server-side filter for AI explanation noise in `project_interest`
- Legacy vs new site tracking on Top Pages
- CEO AI Report button (Claude executive summary)

---

## 13. Recent State (Last Session)

### ✅ Completed
- Landing page redesigned (Material Design 3, hero + feature grid with gradient heading)
- Dashboard restructured to 11 tabs matching user's data segregation spec
- AI Conversations tab with drill-down + filter (Signal/Qualified/Contact/All) + sort
- Realtime section with 3-mode UI (`live`/`fallback_daily`/`empty`) + setup instructions
- All 5 webhook endpoints canonical response format
- 3 Save nodes added to n8n → Vapi call sheet
- Vapi Outbound switched from transient assistant to persistent assistantId `69029075-...`
- Vapi Anthropic integration set up
- Twilio credential attached to WhatsApp nodes (values still needed in UI)
- Filter Valid Phones now has 40+ country timezone map (11am–8pm local hour check)
- OpenAI Model → Voice Lead Parser connection added (fixed `A Model sub-node must be connected` error)
- GA4 Realtime branch disabled (was erroring every 2 min)

### ⚠️ Known Issues / TODO
1. **`Fetch Conversations for Calling`** still points to old `AI Agent Conversations` sheet (`1OJoKa...`) — user renamed to `Ai Agent Data`, needs new sheet ID.
2. **Vapi phone number `+968 76644000`** → "number not available" when calling. Likely not provisioned in Vapi Phone Numbers dashboard.
3. **Twilio Auth Token EXPOSED** in this transcript (`(redacted — see Twilio Console)`) — user should rotate.
4. **Vapi Public Key EXPOSED** — should rotate too.
5. **Vapi Assistant prompt is generic** — user needs to customize System Prompt for IrfanInvest context.
6. **WhatsApp Sandbox** requires manual opt-in per client.
7. **`AI Qualify Voice Lead`** — even after fixes, needs verification it works end-to-end.
8. **Realtime GA4 pipeline** disabled — for true realtime, would need Google Service Account JSON + direct Vercel polling.

---

## 14. Key Test Commands

### Test webhook endpoints
```bash
# GA4 + variants (all return 200 on empty)
for e in ga4 ads form-leads ai-conversations ai-qualified-leads ga4-realtime voice-leads; do
  curl -s -X POST "https://irfanapp.vercel.app/api/webhook/$e" \
    -H "x-webhook-secret: irfan_secret_2024" \
    -H "Content-Type: application/json" \
    -d '{"source":"test","data":[]}'
  echo ""
done
```

### Trigger Vapi Inbound webhook (simulates a call)
```bash
curl -X POST "https://analytics-test.app.n8n.cloud/webhook/vapi-inbound-v2" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test","phone":"+96877470912","country":"Oman","budget":"500K OMR","message":"Test"}'
```

### Deploy
```bash
cd "/Users/amirshamsipur/Claude code/irfanapp" && npx vercel@53.1.1 --prod
```

### Query Supabase
Use MCP tool `mcp__3aeaf905-3f19-4d51-814d-b57b6d913eb1__execute_sql` with project_id `owgvrxipqlusepozlujv`.

---

## 15. User Preferences (from feedback)

- **Language:** Bilingual — user writes in Persian, prefers responses in Persian
- **Deploy verification:** Don't auto-open Chrome/browser — user verifies on Safari themselves
- **UI style:** Material Design 3, dark theme, purple accents (`#7C3AED`, `#A855F7`)
- **Typography:** Use "irfanivest.com" gradient, no em-dashes in copy
- **No test comments in code**
- **Prefers small focused commits over batch changes**
- **Communication:** Terse, action-oriented; user hates verbose fluff

---

## 16. Suggested Next Session Priorities

**In order of impact:**

1. **Get `Ai Agent Data` sheet ID from user** and update `Fetch Conversations for Calling` node
2. **Customize Vapi Assistant System Prompt** for IrfanInvest (already drafted, just needs paste in Vapi UI)
3. **Verify Vapi phone number is provisioned** (`dashboard.vapi.ai/phone-numbers`)
4. **Ask user to rotate exposed keys** (Twilio + Vapi)
5. **Set up WhatsApp Sandbox** or upgrade Twilio
6. **Test end-to-end** a real Vapi call → sheet row + Supabase record
7. **Verify AI Qualify Voice Lead** works after the connection fixes
8. **Consider** adding Claude psychology analysis node (5 sheet columns: `buyer_persona`, `confidence_level`, `recommended_strategy`, `followup_message`)

---

## 17. Memory System Notes

User has an auto-memory system at `~/.claude/projects/-Users-amirshamsipur-Claude-code/memory/` — MEMORY.md contains index links. Recent memory files:
- `whitewill-*` (older sibling project)
- `irfaninvest-growth-stack.md`
- `kiosk-agency.md`

Update memory with irfanapp-specific facts if worth persisting beyond this handoff.

---

**End of handoff.** Any Claude session with this document + access to the Working Directory + MCP tools (n8n, Supabase, Vercel) can continue seamlessly.
