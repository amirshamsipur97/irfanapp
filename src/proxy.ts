import { NextRequest, NextResponse } from 'next/server'
import { expectedSessionToken, safeEqual, SESSION_COOKIE } from '@/lib/auth'

/**
 * Access control for the whole app (Next 16 proxy — the middleware successor).
 *
 * Public:
 *   /            — marketing landing (no data)
 *   /login       — password form
 *   /api/auth    — login/logout endpoint
 *   /api/webhook — n8n ingest endpoints (each verifies x-webhook-secret itself)
 *
 * Machine access (n8n reading data, e.g. /api/leads/for-calling):
 *   any request carrying the correct `x-webhook-secret` header passes.
 *
 * Everything else (dashboard pages + data APIs) requires the session cookie.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhook/')
  ) {
    return NextResponse.next()
  }

  // Machine-to-machine: n8n & friends with the shared webhook secret
  const machineSecret = req.headers.get('x-webhook-secret')
  if (machineSecret && process.env.WEBHOOK_SECRET && machineSecret === process.env.WEBHOOK_SECRET) {
    return NextResponse.next()
  }

  // Human session cookie
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (cookie) {
    try {
      const expected = await expectedSessionToken()
      if (safeEqual(cookie, expected)) return NextResponse.next()
    } catch {
      // AUTH_SECRET missing — fall through to deny
    }
  }

  // Deny: APIs get 401 JSON, pages get redirected to /login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const login = req.nextUrl.clone()
  login.pathname = '/login'
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except Next internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|ttf|otf|woff|woff2)$).*)'],
}
