/**
 * Read the funnel out of Analytics Engine.
 *
 * There is no dashboard for this. Analytics Engine is a write-only store with a SQL
 * API bolted on — the Cloudflare UI lists that the dataset exists and nothing more, so
 * without a script like this the data is real but effectively invisible.
 *
 * Needs a token with Account Analytics: Read, which is not the same credential as the
 * one wrangler deploys with:
 *
 *   CF_ANALYTICS_TOKEN=… bun scripts/analytics.ts          # last 24h
 *   CF_ANALYTICS_TOKEN=… bun scripts/analytics.ts 168      # last week
 *
 * It also reads ~/.hoodfi-cf-token so the token never has to sit in shell history.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ACCOUNT_ID = 'c4958515e14a5e797c8c6e0818fb5b1c'
const DATASET = 'HoodFi_Names'
const HOURS = Number(process.argv[2] ?? 24)

function token(): string {
  if (process.env.CF_ANALYTICS_TOKEN) return process.env.CF_ANALYTICS_TOKEN
  try {
    const file = readFileSync(join(homedir(), '.hoodfi-cf-token'), 'utf8')
    const match = file.match(/^CF_ANALYTICS_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    // fall through to the error below
  }
  console.error('No CF_ANALYTICS_TOKEN (env or ~/.hoodfi-cf-token).')
  console.error('Create one at https://dash.cloudflare.com/profile/api-tokens')
  console.error('with Account → Account Analytics → Read.')
  process.exit(1)
}

async function query(sql: string): Promise<Record<string, string>[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`,
    { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: sql }
  )
  const text = await res.text()
  if (!res.ok) {
    console.error(`Query failed (${res.status}): ${text.slice(0, 300)}`)
    process.exit(1)
  }
  return JSON.parse(text).data ?? []
}

const window = `timestamp > NOW() - INTERVAL '${HOURS}' HOUR`

// blob1..blob6 are positional — the order is set in src/handlers/postEvent.ts and the
// names only exist here. Change one and this file has to move with it.
const events = await query(
  `SELECT blob1 AS event, count() AS n FROM ${DATASET}
   WHERE ${window} GROUP BY event ORDER BY n DESC`
)
const paths = await query(
  `SELECT blob2 AS path, count() AS n FROM ${DATASET}
   WHERE ${window} AND blob1 = 'page_view' GROUP BY path ORDER BY n DESC LIMIT 15`
)
const countries = await query(
  `SELECT blob6 AS country, count() AS n FROM ${DATASET}
   WHERE ${window} GROUP BY country ORDER BY n DESC LIMIT 10`
)
// Counted client-side: Analytics Engine's SQL has no uniq()/count(DISTINCT), so the
// distinct sessions come back as rows and the length is the answer.
const sessions = await query(
  `SELECT index1 AS session FROM ${DATASET} WHERE ${window} GROUP BY session`
)

function table(title: string, rows: Record<string, string>[], key: string) {
  console.log(`\n${title}`)
  if (rows.length === 0) {
    console.log('  (nothing)')
    return
  }
  const width = Math.max(...rows.map((r) => (r[key] || '—').length))
  for (const row of rows) {
    console.log(`  ${(row[key] || '—').padEnd(width)}  ${String(row.n).padStart(6)}`)
  }
}

console.log(`hoodfi funnel — last ${HOURS}h`)
console.log(`sessions: ${sessions.length}`)
table('events', events, 'event')
table('page views by path', paths, 'path')
table('countries', countries, 'country')
