// ──────────────────────────────────────────────────────────────────────────
// New irfaninvest.com site map (the Vercel/React site that replaced the old
// Webflow site). Maps any GA4 page path → a section so analytics are grouped
// by the CURRENT site structure, and flags leftover legacy Webflow URLs.
//
// Canonical routes (whitewill-landing / sitemap.xml):
//   /                 Home
//   /buy              Buy — all projects
//   /buy/:slug        Projects (individual development, e.g. /buy/aida)
//   /maison-shirdel   Maison Shirdel (luxury)
//   /sell             Sell
//   /about            About
//
// Known legacy Webflow paths still appearing in 30-day history:
//   /our-team         → About (legacy)
//   /ru, /ru/*        → Home (legacy language path; new site is client-side i18n)
//   /omans, /omans/*  → Projects (legacy project pages)
// ──────────────────────────────────────────────────────────────────────────

export interface PageCategory {
  section: string
  label: string
  isLegacy: boolean
}

export const SITE_SECTIONS = [
  'Home', 'Buy', 'Projects', 'Maison Shirdel', 'Sell', 'About', 'Other', 'Legacy',
] as const

/** Strip origin/query/hash, lowercase, drop trailing slash. */
export function cleanPath(raw: string): string {
  let p = (raw || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].split('#')[0].toLowerCase()
  if (!p) p = '/'
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p
}

export function categorizePath(raw: string): PageCategory {
  const p = cleanPath(raw)

  // ── New site map ──
  if (p === '/') return { section: 'Home', label: 'Home', isLegacy: false }
  if (p === '/buy') return { section: 'Buy', label: 'Buy — all projects', isLegacy: false }
  if (p.startsWith('/buy/')) {
    const slug = p.slice(5).split('/')[0]
    const name = slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return { section: 'Projects', label: `Project — ${name}`, isLegacy: false }
  }
  if (p === '/maison-shirdel') return { section: 'Maison Shirdel', label: 'Maison Shirdel', isLegacy: false }
  if (p === '/sell') return { section: 'Sell', label: 'Sell', isLegacy: false }
  if (p === '/about') return { section: 'About', label: 'About', isLegacy: false }

  // ── Legacy Webflow paths (mapped to the nearest new section, flagged) ──
  if (p === '/our-team') return { section: 'About', label: 'Our Team (legacy)', isLegacy: true }
  if (p === '/ru' || p.startsWith('/ru/')) return { section: 'Home', label: 'Russian /ru (legacy)', isLegacy: true }
  if (p === '/omans' || p.startsWith('/omans')) return { section: 'Projects', label: `Legacy project (${p})`, isLegacy: true }

  return { section: 'Other', label: p, isLegacy: false }
}

/** True for paths that belong to the old Webflow site, not the new site map. */
export function isLegacyPath(raw: string): boolean {
  return categorizePath(raw).isLegacy
}
