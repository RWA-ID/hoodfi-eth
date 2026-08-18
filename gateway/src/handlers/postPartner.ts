import { type Env, envVar, envVarOptional } from '../env'

/**
 * Partner enquiry intake.
 *
 * The site is a static export on IPFS and Vercel, so there is no server to post a
 * form to — without this the "become a partner" link can only be a mailto:, which
 * publishes an address to scrapers and loses every enquiry that a phone's mail client
 * fails to open. This is the missing half: the browser posts JSON, the worker holds
 * the Resend credential and forwards one plain-text email.
 *
 * Deliberately one-directional. The endpoint is open to the internet, so mailing
 * anyone but the fixed notify address would make it an open relay: a stranger could
 * have Resend deliver attacker-written text from our own verified domain, and the
 * reputation damage would land on mail.onchain-id.id — which every other project's
 * mail goes through too. The submitter's confirmation is rendered on the page instead.
 *
 * Spam defence is a honeypot plus a minimum fill time plus hard field caps. There is
 * no durable per-IP limit because the worker has no KV or D1 binding; if this ever
 * gets found by a bot, that is the thing to add.
 */

/** The submitter's address goes in Reply-To, so a reply is one keystroke. */
const DEFAULT_FROM = 'HoodFi Names <partners@mail.onchain-id.id>'

/**
 * How long the form was open before it was sent, in ms.
 *
 * A DURATION measured entirely on the visitor's own clock, never a timestamp compared
 * against ours. The timestamp version of this check was broken in a way that only shows
 * up in production: it read `Date.now() - clientTimestamp`, so any skew between the two
 * clocks was indistinguishable from time spent filling the form. A device running a few
 * seconds fast had every submission rejected as "stale" — permanently, since the error
 * told them to reload and a reload does not fix a wrong clock. Phones drift; this is not
 * a rare configuration.
 *
 * A duration gives up nothing. A bot could always lie about an absolute timestamp just
 * as easily, so the check was never a security control — it only ever filtered scripts
 * that submit instantly without simulating a human at all.
 */
const MIN_FILL_MS = 3_000

/** And the far side: a tab left open overnight is not a fresh submission. */
const MAX_FILL_MS = 12 * 60 * 60 * 1000

/** Mirrors the toggle on the form. An unknown value is recorded as "other". */
const TOPICS = new Set(['integration', 'distribution', 'press', 'template', 'other'])

const LIMITS = {
  name: 80,
  email: 160,
  org: 100,
  website: 200,
  message: 2_000,
  /* Template submissions carry three extra identifiers. Capped like every other
     single-line field, and never trusted as addresses here — they are printed into an
     email a human reads before doing anything, and validating an address in a mail
     handler would only give a false sense that it had been checked on-chain. The form
     does that check against the registry, where it means something. */
  collection: 60,
  opensea: 200,
  payee: 60,
  cover: 300,
} as const

type Body = {
  name?: unknown
  email?: unknown
  org?: unknown
  website?: unknown
  topic?: unknown
  message?: unknown
  /** Template submissions only: the NFT contract, its OpenSea page, and who gets paid. */
  collection?: unknown
  opensea?: unknown
  payee?: unknown
  cover?: unknown
  /** Honeypot. A real browser never fills this — it is hidden and off the tab order. */
  hp?: unknown
  /** Milliseconds the form was open before submit, measured client-side. See MIN_FILL_MS. */
  t?: unknown
}

function fail(message: string, status: number): Response {
  return Response.json({ message }, { status })
}

/**
 * Trims and caps one field.
 *
 * The newline strip is load-bearing on the single-line fields: they are interpolated
 * into the subject and into `Reply-To`, and a value carrying a CR or LF is the classic
 * header-injection shape. Resend takes JSON rather than raw headers so it would almost
 * certainly be rejected there anyway — but "almost certainly" is not a control.
 */
function oneLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
}

function multiLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  // Normalise line endings but keep the paragraphs — this one is the actual message.
  return value.replace(/\r\n/g, '\n').trim().slice(0, max)
}

/**
 * Good enough to catch a typo, deliberately not an RFC 5322 parser.
 *
 * The address is only ever used as a Reply-To that a human reads before using. A
 * stricter regex rejects real addresses, and the cost of a bad one here is a bounced
 * reply, not a security failure.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value)
}

/** Renders the enquiry as plain text. No HTML part, so there is nothing to escape. */
function composeEmail(fields: {
  name: string
  email: string
  org: string
  website: string
  topic: string
  message: string
  country: string
  collection: string
  opensea: string
  payee: string
  cover: string
}): string {
  const rows: [string, string][] = [
    ['From', `${fields.name} <${fields.email}>`],
    ['Organisation', fields.org || '—'],
    ['Website', fields.website || '—'],
    ['Topic', fields.topic],
    ['Country', fields.country || '—'],
  ]
  // Only on a template submission, so an ordinary enquiry does not gain three empty rows.
  if (fields.topic === 'template') {
    rows.push(
      ['Collection', fields.collection || '—'],
      ['OpenSea', fields.opensea || '—'],
      ['Payee', fields.payee || '—'],
      ['Cover art', fields.cover || '—'],
    )
  }
  const header = rows.map(([key, value]) => `${key.padEnd(13)}${value}`).join('\n')
  return `${header}\n\n${'-'.repeat(56)}\n\n${fields.message}\n`
}

export async function postPartner(request: Request, env: Env) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail('Expected a JSON body', 400)
  }

  // Honeypot first: a bot that filled it gets a 200 and no email. Telling it that it
  // failed is free tuning information for whoever wrote it.
  if (oneLine(body.hp, 64) !== '') {
    return Response.json({ ok: true })
  }

  // Both ends are people often enough to be worth distinct wording — "reload the page"
  // is useless advice to someone who simply typed faster than the floor.
  const openFor = typeof body.t === 'number' && Number.isFinite(body.t) ? body.t : -1
  if (openFor < MIN_FILL_MS) {
    return fail('That came through faster than we can accept — send it once more.', 400)
  }
  if (openFor > MAX_FILL_MS) {
    return fail('This form went stale — reload the page and send it again.', 400)
  }

  const name = oneLine(body.name, LIMITS.name)
  const email = oneLine(body.email, LIMITS.email)
  const org = oneLine(body.org, LIMITS.org)
  const website = oneLine(body.website, LIMITS.website)
  const message = multiLine(body.message, LIMITS.message)
  const rawTopic = oneLine(body.topic, 16).toLowerCase()
  const topic = TOPICS.has(rawTopic) ? rawTopic : 'other'
  const collection = oneLine(body.collection, LIMITS.collection)
  const opensea = oneLine(body.opensea, LIMITS.opensea)
  const payee = oneLine(body.payee, LIMITS.payee)
  const cover = oneLine(body.cover, LIMITS.cover)

  if (!name) return fail('Tell us who you are.', 400)
  if (!looksLikeEmail(email)) return fail('That email address looks wrong.', 400)
  if (message.length < 10) return fail('Add a line or two about what you have in mind.', 400)

  const apiKey = envVarOptional('RESEND_API_KEY', env)
  if (!apiKey) {
    // Unset credential is our fault, not the sender's — and silently dropping the
    // enquiry while showing a success screen would be the worst of both.
    console.error('partner: RESEND_API_KEY is not set; enquiry dropped')
    return fail('Our mail service is misconfigured. Please try again shortly.', 503)
  }

  const to = envVar('PARTNER_NOTIFY_TO', env)
  const from = envVarOptional('PARTNER_FROM', env) ?? DEFAULT_FROM

  // A template submission needs a subject that says so — these go into a review queue
  // with a different shape of work behind them than a general enquiry.
  const label = topic === 'template' ? 'template submission' : 'partner enquiry'
  const subject = org
    ? `HoodFi ${label} — ${name} (${org})`
    : `HoodFi ${label} — ${name}`

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        // So the reply goes to the person who wrote in, not into our own inbox.
        reply_to: email,
        subject,
        text: composeEmail({
          name,
          email,
          org,
          website,
          topic,
          message,
          // Cloudflare's own geo header. No IP is read or stored.
          country: request.headers.get('cf-ipcountry') ?? '',
          collection,
          opensea,
          payee,
          cover,
        }),
      }),
    })
  } catch (error) {
    console.error('partner: resend request failed', error)
    return fail('We could not send that just now. Please try again.', 502)
  }

  if (!response.ok) {
    // Logged, never returned: an upstream error body is exactly the kind of string
    // that ends up carrying a credential or an internal address into a browser.
    console.error('partner: resend rejected', response.status, await response.text())
    return fail('We could not send that just now. Please try again.', 502)
  }

  return Response.json({ ok: true })
}
