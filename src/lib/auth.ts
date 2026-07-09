/**
 * Simple session auth for the dashboard.
 *
 * Model: one shared password (DASHBOARD_PASSWORD). A successful login sets an
 * httpOnly cookie whose value is HMAC-SHA256(AUTH_SECRET, SESSION_PAYLOAD).
 * The proxy (middleware) recomputes the HMAC per request and compares.
 * Rotating AUTH_SECRET or DASHBOARD_PASSWORD invalidates all sessions.
 *
 * Uses Web Crypto only, so it runs in both the Edge runtime (proxy) and Node.
 */

export const SESSION_COOKIE = 'dash_session'
const SESSION_PAYLOAD = 'irfanapp-dash-v1'

export async function expectedSessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(SESSION_PAYLOAD))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time-ish string comparison (both sides same length hex). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
