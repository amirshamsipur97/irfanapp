import type { Metadata } from 'next'
import Link from 'next/link'
import { DM_Sans, Inter } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-dm' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'irfanapp — The Operations Brain of irfaninvest.com',
  description:
    'Analytics, lead pipeline, AI voice agent and marketing intelligence for irfaninvest.com — GA4, Google Ads, Supabase, n8n and Vapi in one dashboard.',
}

/* ── Design tokens — lifted from the Figma file (Irfan invest / 651-21412) ──
   bg #0d0e0c · surface #1f201d / #282b27 · line #3c403a
   text #e0e3dd · muted #a2a89e / #838b7f / #656b61
   accent #55a938 · accent-dark #3a7326 · accent-light #a6dc94            */
const C = {
  bg: '#0d0e0c', surface: '#1f201d', surface2: '#282b27', line: '#3c403a',
  text: '#e0e3dd', mut: '#a2a89e', mut2: '#838b7f', dim: '#656b61',
  green: '#55a938', greenD: '#3a7326', greenL: '#a6dc94',
}

const STACK = ['Next.js 16', 'React 19', 'Tailwind 4', 'Supabase', 'n8n', 'Vapi', 'Twilio', 'Claude AI', 'GA4', 'Google Ads', 'Recharts']

const FEATURES = [
  {
    icon: '▤',
    title: 'Marketing Analytics',
    body: 'GA4 traffic, Google Ads spend and campaign performance unified in one view — synced from n8n every 30 minutes.',
  },
  {
    icon: '⟳',
    title: 'Lead Pipeline',
    body: 'Website forms and the AI chat flow straight into Supabase and Google Sheets, deduplicated and scored automatically.',
  },
  {
    icon: '☎',
    title: 'AI Voice Agent',
    body: '"Sam" calls every new lead within 2 minutes via Vapi + Twilio, books consultations and records full transcripts.',
  },
  {
    icon: '✦',
    title: 'AI Insights',
    body: 'Claude analyses every call and lead: buyer persona, sentiment, objections and a recommended closing strategy — 17 signals per conversation.',
  },
]

const SPOTLIGHT = [
  {
    tag: 'Architecture',
    title: 'Server-rendered Next.js — no database keys ever reach the browser',
    body: 'All Supabase access lives in 28 API routes. The public site and this dashboard share one database, cleanly separated.',
  },
  {
    tag: 'Automation',
    title: 'Two live n8n workflows keep every number fresh',
    body: 'A 30-minute pipeline syncs GA4, Ads, forms and AI conversations; a 2-minute watcher auto-calls brand-new leads.',
  },
  {
    tag: 'Security',
    title: 'Password gate, HMAC sessions and row-level security',
    body: 'Every page and data API sits behind an httpOnly signed cookie; Supabase RLS blocks anonymous access to content tables.',
  },
  {
    tag: 'Voice AI',
    title: 'From hang-up to insight in under a minute',
    body: 'Vapi posts the end-of-call report to n8n, which writes the transcript, psychology profile and call record to two report sheets and this dashboard.',
  },
]

const FAQ = [
  {
    q: 'How do leads flow through the system?',
    a: 'A visitor submits a form on irfaninvest.com → a Supabase edge function stores the lead and mirrors it to Google Sheets → n8n picks it up, and the dashboard shows it within 30 minutes (voice-eligible leads are called within 2).',
  },
  {
    q: 'Which AI models power it?',
    a: 'Claude (Anthropic) runs the voice agent "Sam", the post-call psychology analysis and the AI Insights tab. GPT-4o-mini handles lead qualification inside n8n.',
  },
  {
    q: 'What happens after a phone call ends?',
    a: 'Vapi sends the end-of-call report to n8n: the lead status updates in the dashboard, the call record lands in the report-after-call sheet, and the transcript plus 17-field buyer-psychology profile lands in the conversation sheet.',
  },
  {
    q: 'How is the dashboard secured?',
    a: 'A shared password issues a 30-day HMAC-signed httpOnly cookie; the Next.js proxy gates every page and data API. Machines (n8n) authenticate with a separate header secret. Supabase RLS protects the shared tables.',
  },
  {
    q: 'How is it integrated with irfaninvest.com?',
    a: 'Same Supabase project, same Peyda brand font, same lead schema. The site writes leads; this app reads, scores, calls and reports on them — nothing is duplicated.',
  },
  {
    q: 'How fresh is the data?',
    a: 'GA4, Google Ads, form leads and AI conversations sync every 30 minutes. New-lead auto-calling runs every 2 minutes. A public /api/health probe reports database latency live.',
  },
]

/* Hero collage tiles — same 3-column geometry as the Figma photo grid,
   filled with the product's own data-material instead of stock photos. */
function HeroTile({ label, value, bars }: { label: string; value: string; bars?: number[] }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
      style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <span className="text-[11px]" style={{ color: C.mut2 }}>{label}</span>
      <div>
        {bars && (
          <div className="flex items-end gap-1 h-4 mb-1.5">
            {bars.map((h, i) => (
              <span key={i} className="flex-1 rounded-sm"
                style={{ height: `${h}%`, background: i === bars.length - 1 ? C.green : C.greenD, opacity: i === bars.length - 1 ? 1 : 0.7 }} />
            ))}
          </div>
        )}
        <span className="font-bold text-xl" style={{ color: C.text, fontFamily: 'var(--font-dm)' }}>{value}</span>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className={`${dmSans.variable} ${inter.variable} min-h-screen`}
      style={{ background: C.bg, color: C.text, fontFamily: 'var(--font-inter)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(13,14,12,.85)', borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: C.green, color: C.bg }}>i</span>
            <span className="font-bold" style={{ fontFamily: 'var(--font-dm)' }}>irfanapp</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: C.mut }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/api/health" className="hidden sm:block text-sm hover:text-white transition-colors" style={{ color: C.mut }}>Status</a>
            <Link href="/dashboard" className="px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: C.green, color: C.bg, fontFamily: 'var(--font-dm)' }}>
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <h1 className="font-bold leading-[1.05] text-5xl md:text-7xl" style={{ fontFamily: 'var(--font-dm)', textWrap: 'balance' }}>
            The Operations<br />Brain of <span style={{ color: C.green }}>irfaninvest</span>
          </h1>
          <p className="mt-6 text-lg max-w-xl leading-relaxed" style={{ color: C.mut }}>
            Every visit, lead, ad dirham and phone call from irfaninvest.com — captured, analysed
            and acted on automatically. Marketing analytics, an AI voice agent and lead operations
            in one password-gated dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/dashboard" className="px-6 py-3.5 rounded-full font-bold text-sm"
              style={{ background: C.green, color: C.bg, fontFamily: 'var(--font-dm)' }}>
              Open the Dashboard
            </Link>
            <a href="#architecture" className="px-6 py-3.5 rounded-full font-bold text-sm transition-colors"
              style={{ border: `1px solid ${C.line}`, color: C.text, fontFamily: 'var(--font-dm)' }}>
              How it works
            </a>
          </div>
        </div>

        {/* collage — mirrors the Figma photo-grid geometry with live-data material */}
        <div className="grid grid-cols-3 gap-3 auto-rows-[100px]">
          <HeroTile label="Page views · 30d" value="449" bars={[35, 55, 40, 70, 62, 90]} />
          <div className="rounded-2xl flex items-center justify-center text-3xl row-span-2"
            style={{ background: `linear-gradient(160deg, ${C.greenD}, ${C.green})`, color: C.bg }}>☎</div>
          <HeroTile label="Users · 28d" value="4.7k" />
          <HeroTile label="Leads tracked" value="128" bars={[20, 35, 30, 55, 75, 100]} />
          <HeroTile label="Voice calls" value="10" />
          <HeroTile label="Sync cadence" value="30 min" />
          <div className="rounded-2xl p-4 col-span-2 flex items-center justify-between"
            style={{ background: C.surface2, border: `1px solid ${C.line}` }}>
            <div>
              <div className="text-[11px]" style={{ color: C.mut2 }}>Next lead call-back</div>
              <div className="font-bold text-lg" style={{ fontFamily: 'var(--font-dm)' }}>≤ 2 minutes</div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: C.greenL }} />
          </div>
        </div>
      </section>

      {/* ── Tech strip (logo band in the design) ────────────────────────── */}
      <section className="py-8" style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {STACK.map(t => (
            <span key={t} className="text-sm font-medium tracking-wide" style={{ color: C.dim, fontFamily: 'var(--font-dm)' }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── About + stats ────────────────────────────────────────────────── */}
      <section id="architecture" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: C.green }}>About the software</div>
        <h2 className="mt-3 font-bold text-4xl max-w-2xl leading-tight" style={{ fontFamily: 'var(--font-dm)', textWrap: 'balance' }}>
          One codebase, four systems, zero manual work
        </h2>
        <p className="mt-5 max-w-3xl leading-relaxed" style={{ color: C.mut }}>
          irfanapp is the server-rendered Next.js companion to irfaninvest.com. It ingests marketing
          data from Google, lead data from the website, and voice data from the AI call agent —
          then turns them into decisions: who to call, what to say, and which campaign is paying for itself.
        </p>
        <div className="mt-12 grid sm:grid-cols-3 gap-8">
          {[
            ['28', 'API endpoints — 12 of them n8n ingest webhooks'],
            ['11', 'live dashboard tabs, from Marketing to Voice'],
            ['2 min', 'from form submission to the first AI phone call'],
          ].map(([n, d]) => (
            <div key={n as string} style={{ borderTop: `2px solid ${C.greenD}` }} className="pt-4">
              <div className="font-bold text-5xl" style={{ fontFamily: 'var(--font-dm)', color: C.text }}>{n}</div>
              <div className="mt-2 text-sm leading-relaxed" style={{ color: C.mut2 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: C.green }}>Modules</div>
          <h2 className="mt-3 font-bold text-4xl mx-auto max-w-2xl leading-tight" style={{ fontFamily: 'var(--font-dm)', textWrap: 'balance' }}>
            Everything the sales floor needs, nothing it doesn&apos;t
          </h2>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(85,169,56,.12)', color: C.green, border: `1px solid rgba(85,169,56,.25)` }}>{f.icon}</div>
              <h3 className="mt-5 font-bold text-lg" style={{ fontFamily: 'var(--font-dm)' }}>{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.mut2 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Spotlight (blog cards in the design) ─────────────────────────── */}
      <section className="py-24" style={{ background: C.surface, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <div className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: C.green }}>Inside the stack</div>
            <h2 className="mt-3 font-bold text-4xl" style={{ fontFamily: 'var(--font-dm)' }}>In the spotlight</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPOTLIGHT.map(s => (
              <article key={s.tag} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                <div className="h-28" style={{ background: `linear-gradient(135deg, ${C.surface2}, ${C.greenD}55)` }} />
                <div className="p-5 flex-1 flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.green }}>{s.tag}</span>
                  <h3 className="mt-2 font-bold leading-snug" style={{ fontFamily: 'var(--font-dm)' }}>{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.mut2 }}>{s.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline CTA (experience section in the design) ─────────────── */}
      <section id="pipeline" className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="font-bold text-4xl leading-tight" style={{ fontFamily: 'var(--font-dm)', textWrap: 'balance' }}>
            From ad click to booked consultation — one pipeline
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              'Visitor clicks a Google Ad and submits a form on irfaninvest.com',
              'Edge function stores the lead in Supabase and mirrors it to Google Sheets',
              '"Sam" — the AI voice agent — calls within 2 minutes, in the caller\'s language',
              'Transcript, psychology profile and call record land in the dashboard and report sheets',
            ].map((t, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: C.mut }}>
                <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                  style={{ background: 'rgba(85,169,56,.15)', color: C.greenL }}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/dashboard" className="inline-block mt-9 px-6 py-3.5 rounded-full font-bold text-sm"
            style={{ background: C.green, color: C.bg, fontFamily: 'var(--font-dm)' }}>
            See it live
          </Link>
        </div>
        {/* flow panel — replaces the abstract image in the design */}
        <div className="rounded-3xl p-8" style={{ background: `linear-gradient(150deg, ${C.surface}, ${C.bg})`, border: `1px solid ${C.line}` }}>
          <div className="font-mono text-[13px] leading-[2.2]" dir="ltr" style={{ color: C.mut }}>
            <div>irfaninvest.com <span style={{ color: C.dim }}>· form / chat / call</span></div>
            <div style={{ color: C.greenD }}>│</div>
            <div><span style={{ color: C.text }}>Supabase</span> leads · call_attempts</div>
            <div style={{ color: C.greenD }}>│ ▲</div>
            <div><span style={{ color: C.text }}>n8n</span> <span style={{ color: C.dim }}>30-min sync · 2-min auto-call</span></div>
            <div style={{ color: C.greenD }}>│</div>
            <div><span style={{ color: C.text }}>Vapi</span> +1 775 451 2951 <span style={{ color: C.dim }}>· &quot;Sam&quot;</span></div>
            <div style={{ color: C.greenD }}>│</div>
            <div><span style={{ color: C.greenL }}>irfanapp</span> <span style={{ color: C.dim }}>/dashboard · 11 tabs</span></div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: C.green }}>FAQ</div>
        <h2 className="mt-3 font-bold text-4xl" style={{ fontFamily: 'var(--font-dm)' }}>Frequently asked questions</h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-9">
          {FAQ.map(f => (
            <div key={f.q}>
              <h3 className="font-bold leading-snug" style={{ fontFamily: 'var(--font-dm)' }}>{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.mut2 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: C.green, color: C.bg }}>i</span>
              <span className="font-bold" style={{ fontFamily: 'var(--font-dm)' }}>irfanapp</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: C.dim }}>
              Analytics &amp; lead-operations software for irfaninvest.com. v1.0.0 · password-protected.
            </p>
          </div>
          {[
            ['Product', [['Dashboard', '/dashboard'], ['Sign in', '/login'], ['System status', '/api/health']]],
            ['Integrations', [['irfaninvest.com', 'https://www.irfaninvest.com'], ['Supabase', 'https://supabase.com'], ['n8n', 'https://n8n.io'], ['Vapi', 'https://vapi.ai']]],
            ['Stack', [['Next.js 16', 'https://nextjs.org'], ['Claude AI', 'https://www.anthropic.com'], ['Recharts', 'https://recharts.org']]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.mut2 }}>{title as string}</div>
              <ul className="space-y-2.5 text-sm">
                {(links as [string, string][]).map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="transition-colors hover:text-white" style={{ color: C.mut }}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="py-5 text-center text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.dim }}>
          © 2026 irfaninvest · built with Next.js 16, Supabase, n8n, Vapi &amp; Claude
        </div>
      </footer>
    </div>
  )
}
