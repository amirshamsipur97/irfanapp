import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'ga4-data.json')

export interface GA4Row {
  date: string
  country: string
  city: string
  pageLocation: string
  active28DayUsers: number
  checkouts: number
  pageViews: number
}

export interface GA4Store {
  lastUpdated: string
  rows: GA4Row[]
}

export function readData(): GA4Store {
  if (!fs.existsSync(DATA_FILE)) {
    return { lastUpdated: '', rows: [] }
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  return JSON.parse(raw)
}

export function writeData(rows: GA4Row[]): void {
  const store: GA4Store = {
    lastUpdated: new Date().toISOString(),
    rows,
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2))
}
