import Link from "next/link";

const features = [
  {
    title: "Analytics Dashboard",
    description: "GA4, Google Ads and Leads — unified, AI-analyzed in real time.",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 14l4-4 4 3 5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    accent: "from-purple-500 to-fuchsia-500",
  },
  {
    title: "Leads CRM",
    description: "Every inbound lead, scored, qualified and ready for the sales team.",
    href: "/leads-dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    accent: "from-cyan-400 to-sky-500",
  },
  {
    title: "Call Intelligence",
    description: "Vapi inbound & outbound activity, transcripts and follow-up priority.",
    href: "/dashboard?tab=calls",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    accent: "from-emerald-400 to-teal-500",
  },
];

const stats = [
  { label: "Markets", value: "Oman · UAE · UK · Qatar" },
  { label: "Properties", value: "ITC freehold zones" },
  { label: "Channels", value: "GA4 · Ads · Voice · CRM" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black"
              style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}
            >
              I
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-bold text-white tracking-tight">irfaninvest</span>
              <span className="text-purple-400 font-bold">.com</span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="md-btn-filled md-ripple text-xs"
            aria-label="Open dashboard"
          >
            Open Dashboard
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="md-anim-fade-up max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-white/60 mb-6">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            Live analytics · AI insights · Voice-enabled
          </div>

          <h1 className="font-bold tracking-tight text-white" style={{ fontSize: "var(--md-display-lg)", lineHeight: 1.05 }}>
            Luxury real estate,
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-300 bg-clip-text text-transparent">
              intelligently managed.
            </span>
          </h1>

          <p className="mt-6 text-white/60 max-w-xl" style={{ fontSize: "var(--md-body)", lineHeight: 1.65 }}>
            One unified control center for Oman&apos;s premium property market — every lead scored,
            every campaign analyzed, every call transcribed.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="md-btn-filled md-ripple">
              Launch Dashboard
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/leads-dashboard" className="md-btn-tonal md-ripple">
              View Leads CRM
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="md-card p-5 md-anim-fade-up"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-white/40">
                {s.label}
              </p>
              <p className="mt-2 text-white font-semibold" style={{ fontSize: "var(--md-title)" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-24">
        <h2
          className="font-bold tracking-tight text-center mb-10 md:mb-14 md-anim-fade-up"
          style={{ fontSize: "var(--md-display-md)", lineHeight: 1.15 }}
        >
          <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-300 bg-clip-text text-transparent">
            Connected services built for growth
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Link
              key={f.title}
              href={f.href}
              className="md-card md-ripple group relative p-6 md-anim-fade-up overflow-hidden"
              style={{ animationDelay: `${300 + i * 100}ms` }}
            >
              {/* Hover glow */}
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${f.accent}`}
                style={{ mixBlendMode: "overlay" }}
              />

              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${f.accent} shadow-lg mb-5`}
              >
                {f.icon}
              </div>

              <h3 className="font-semibold text-white mb-1.5" style={{ fontSize: "var(--md-title)" }}>
                {f.title}
              </h3>
              <p className="text-white/55" style={{ fontSize: "var(--md-body)", lineHeight: 1.55 }}>
                {f.description}
              </p>

              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 group-hover:text-white transition-colors">
                Open
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1">
                  <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© {new Date().getFullYear()} irfaninvest. Built for Oman&apos;s luxury market.</p>
          <p className="flex items-center gap-4">
            <Link href="/team" className="hover:text-white/70 transition-colors">Team</Link>
            <Link href="/categories" className="hover:text-white/70 transition-colors">Properties</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
