import { NextResponse } from 'next/server'
import { readData } from '@/lib/storage'

export async function GET() {
  const store = readData()
  return NextResponse.json(store)
}
