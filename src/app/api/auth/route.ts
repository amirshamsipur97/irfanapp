import { NextRequest, NextResponse } from 'next/server'
import { expectedSessionToken, safeEqual, SESSION_COOKIE } from '@/lib/auth'

const THIRTY_DAYS = 60 * 60 * 24 * 30

/** POST /api/auth — body {password}. Sets the session cookie on success. */
export async function POST(req: NextRequest) {
  const configured = process.env.DASHBOARD_PASSWORD
  if (!configured) {
    return NextResponse.json({ error: 'Auth is not configured (DASHBOARD_PASSWORD missing)' }, { status: 500 })
  }

  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Pad comparison target to avoid trivially leaking length via safeEqual short-circuit.
  if (password.length !== configured.length || !safeEqual(password, configured)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const token = await expectedSessionToken()
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  })
  return res
}

/** DELETE /api/auth — logout. */
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
