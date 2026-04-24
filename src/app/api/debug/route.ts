import { NextRequest, NextResponse } from 'next/server'

// Temporary debug endpoint - shows exactly what n8n is sending
export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('DEBUG body:', JSON.stringify(body).slice(0, 1000))
  return NextResponse.json({
    received: true,
    type: Array.isArray(body) ? 'array' : typeof body,
    keys: typeof body === 'object' ? Object.keys(body) : [],
    firstItem: Array.isArray(body) ? body[0] : body,
    count: Array.isArray(body) ? body.length : (body?.data?.length ?? 1),
  })
}
