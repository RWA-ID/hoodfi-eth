/**
 * The share card for a Links page, as satori markup.
 *
 * Import-free for the same reason as nameCardHtml.ts: satori's flexbox subset can only be
 * checked by rendering, and a module with no renderer dependency can be built in plain
 * Node. The same satori rules apply here — every container with more than one child
 * declares display:flex, `space-between` is replaced by a grown spacer, and the Offset
 * preset's hard shadow is a second rectangle behind the button rather than box-shadow.
 *
 * The card is drawn in the page's own look — mode, accent, button preset, shape and
 * display face — so what unfurls in a feed is recognisably the page it links to, not a
 * HoodFi advert. The tables below mirror builder/lib/templates/links.ts and have to be
 * kept in step with it by hand; values that miss the table fall back to the defaults.
 */

export const WIDTH = 1200
export const HEIGHT = 630

export const ACCENTS: Record<string, { hex: string; on: string; ink: string; dark: string }> = {
  lime: { hex: '#c6f702', on: '#0b0e08', ink: '#4a5a18', dark: '#c6f702' },
  orange: { hex: '#ff6b1a', on: '#0b0e08', ink: '#b8430a', dark: '#ff7d38' },
  blue: { hex: '#2f6bff', on: '#ffffff', ink: '#2456d6', dark: '#7098ff' },
  purple: { hex: '#9a6bff', on: '#0b0e08', ink: '#6a3fe0', dark: '#b394ff' },
  bronze: { hex: '#c08a54', on: '#0b0e08', ink: '#8a5a2b', dark: '#d9a56f' },
  silver: { hex: '#c7cad0', on: '#0b0e08', ink: '#565b63', dark: '#d3d6db' },
}

const MODES = {
  dark: {
    bg: '#0c0d0b',
    surface: '#1a1b18',
    fg: '#f1f1ea',
    dim: 'rgba(241,241,234,0.7)',
    faint: 'rgba(241,241,234,0.5)',
    line: 'rgba(241,241,234,0.16)',
    glass: 'rgba(241,241,234,0.07)',
  },
  light: {
    bg: '#f3f3ee',
    surface: '#ffffff',
    fg: '#0b0e08',
    dim: 'rgba(11,14,8,0.68)',
    faint: 'rgba(11,14,8,0.52)',
    line: 'rgba(11,14,8,0.14)',
    glass: 'rgba(255,255,255,0.6)',
  },
} as const

/** Display face per font id: the Google family, the weight the page sets it at, a size factor. */
export const FACES: Record<string, { family: string; weight: 400 | 700 | 800; scale: number }> = {
  archivo: { family: 'Archivo', weight: 800, scale: 1 },
  grotesk: { family: 'Space Grotesk', weight: 700, scale: 1 },
  dmsans: { family: 'DM Sans', weight: 700, scale: 1 },
  serif: { family: 'Instrument Serif', weight: 400, scale: 1.3 },
  mono: { family: 'JetBrains Mono', weight: 700, scale: 0.85 },
  syne: { family: 'Syne', weight: 800, scale: 1 },
}

const PRESETS = ['fill', 'outline', 'glass', 'brutal', 'accent', 'minimal'] as const
const SHAPES = { square: 0, rounded: 16, pill: 999 } as const

/** What a Links page publishes about itself, validated. See parseCardData in getSiteCard. */
export type CardData = {
  path: string
  title: string
  bio: string
  /** Already inlined as a data: URI, or empty for the initial. */
  avatar: string
  /** Its pixel size, so it can be cropped rather than stretched. Absent means square. */
  avatarSize?: { w: number; h: number }
  buttons: { title: string; featured: boolean }[]
  look: {
    mode: keyof typeof MODES
    accent: string
    font: string
    preset: (typeof PRESETS)[number]
    shape: keyof typeof SHAPES
    bg: string
  }
}

export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function resolveLook(raw: Record<string, unknown> | undefined): CardData['look'] {
  const l = raw ?? {}
  return {
    mode: pick(l.mode, ['dark', 'light'] as const, 'dark'),
    accent: pick(l.accent, Object.keys(ACCENTS), 'lime'),
    font: pick(l.font, Object.keys(FACES), 'grotesk'),
    preset: pick(l.preset, PRESETS, 'brutal'),
    shape: pick(l.shape, ['square', 'rounded', 'pill'] as const, 'rounded'),
    bg: pick(l.bg, ['solid', 'glow', 'band', 'grid'], 'glow'),
  }
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Text for a text node. Not HTML-escaped: the renderer does not decode entities, so an
 * escaped quote draws as a literal `&quot;` (measured). The only characters that could
 * open markup are angle brackets, and those are swapped for their single-angle look-alikes
 * instead — a title with `<3` in it draws as `‹3`, never as a tag.
 */
function text(value: string): string {
  return value.replace(/</g, '‹').replace(/>/g, '›')
}

function truncate(value: string, max: number): string {
  const chars = [...value]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : value
}

const SPACER = '<div style="display:flex;flex-grow:1;"></div>'

/**
 * Title size from its length. Two lines are allowed, so the budget is two lines of the
 * right-hand column; a proportional face averages about 0.55em a character.
 */
function titleSize(title: string, scale: number): number {
  const n = Math.max([...title].length, 1)
  return Math.round(Math.min(84, Math.max(44, 1180 / n)) * scale)
}

/** One button, in the page's preset. Returns the button and, for Offset, its shadow. */
function button(d: CardData, b: { title: string; featured: boolean }): string {
  const m = MODES[d.look.mode]
  const a = ACCENTS[d.look.accent]
  const r = Math.min(SHAPES[d.look.shape], 36)
  const acText = d.look.mode === 'dark' ? a.dark : a.ink
  let bg: string = m.surface
  let fg: string = m.fg
  let border = `1px solid ${m.line}`
  let shadow = ''

  switch (d.look.preset) {
    case 'outline':
      bg = 'transparent'
      border = `2px solid ${m.fg}`
      break
    case 'glass':
      bg = m.glass
      break
    case 'brutal':
      border = `2px solid ${m.fg}`
      shadow = a.hex
      break
    case 'accent':
      bg = a.hex
      fg = a.on
      border = `1px solid ${a.hex}`
      break
  }
  if (b.featured) {
    if (d.look.preset === 'accent') {
      bg = m.fg
      fg = m.bg
      border = `1px solid ${m.fg}`
    } else if (d.look.preset === 'minimal') {
      fg = acText
    } else {
      bg = a.hex
      fg = a.on
      border = d.look.preset === 'brutal' ? `2px solid ${m.fg}` : `1px solid ${a.hex}`
      if (d.look.preset === 'brutal') shadow = m.fg
    }
  }

  const minimal = d.look.preset === 'minimal'
  const face = FACES[d.look.font]
  const box = minimal
    ? `border-bottom:1px solid ${m.line};border-radius:0;background:transparent;`
    : `border:${border};border-radius:${r}px;background:${bg};`
  const label = `<div style="display:flex;position:relative;width:100%;height:64px;align-items:center;padding:0 26px;${box}color:${fg};font-family:${face.family === 'Instrument Serif' ? 'DM Sans' : face.family};font-size:24px;font-weight:600;">
    <span style="display:flex;">${text(truncate(b.title, 38))}</span>${SPACER}<span style="display:flex;opacity:0.55;font-size:22px;">↗</span>
  </div>`
  if (!shadow || minimal) return `<div style="display:flex;width:100%;">${label}</div>`
  // Offset: an accent block 6px down and right, with the button laid over it.
  return `<div style="display:flex;position:relative;width:100%;height:64px;">
    <div style="display:flex;position:absolute;left:6px;top:6px;width:100%;height:64px;border-radius:${r}px;background:${shadow};"></div>
    ${label}
  </div>`
}

export function siteCardHtml(d: CardData): string {
  const m = MODES[d.look.mode]
  const a = ACCENTS[d.look.accent]
  const face = FACES[d.look.font]
  const acText = d.look.mode === 'dark' ? a.dark : a.ink
  const AV = 280
  const avRadius = { square: 0, rounded: 64, pill: AV / 2 }[d.look.shape]
  const dot = d.look.shape === 'pill' ? 'border-radius:6px;' : ''
  const title = truncate(d.title || d.path, 60)
  const size = titleSize(title, face.scale)

  // The page's ground, in the forms satori draws reliably: a solid fill, the accent band
  // across the top, or a soft accent wash in the top corner standing in for the glow.
  const ground =
    d.look.bg === 'band'
      ? `<div style="display:flex;position:absolute;left:0;top:0;width:${WIDTH}px;height:190px;background:${a.hex};"></div>`
      : d.look.bg === 'glow'
        ? `<div style="display:flex;position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;background-image:radial-gradient(circle at 22% 0%, ${hexA(a.hex, d.look.mode === 'dark' ? 0.34 : 0.45)} 0%, rgba(0,0,0,0) 60%);"></div>`
        : ''

  // Cropped by hand. satori ignores object-fit and stretches a non-square image to the box
  // it is given, and an avatar pasted from anywhere but our own gateway cannot be asked
  // for a square copy. So: scale it to cover, centre it, and clip it with the frame.
  const crop = (() => {
    const w = d.avatarSize?.w || AV
    const h = d.avatarSize?.h || AV
    const s = Math.max(AV / w, AV / h)
    const sw = Math.round(w * s)
    const sh = Math.round(h * s)
    return { sw, sh, left: Math.round((AV - sw) / 2), top: Math.round((AV - sh) / 2) }
  })()
  const avatar = d.avatar
    ? `<div style="display:flex;position:relative;width:${AV}px;height:${AV}px;overflow:hidden;border-radius:${avRadius}px;"><img src="${esc(d.avatar)}" width="${crop.sw}" height="${crop.sh}" style="position:absolute;left:${crop.left}px;top:${crop.top}px;width:${crop.sw}px;height:${crop.sh}px;" /></div>`
    : `<div style="display:flex;align-items:center;justify-content:center;width:${AV}px;height:${AV}px;border-radius:${avRadius}px;background:${a.hex};color:${a.on};font-family:${face.family};font-weight:${face.weight};font-size:130px;">${text(([...title][0] ?? '?').toUpperCase())}</div>`

  const buttons = d.buttons.slice(0, 2)

  return `<div style="display:flex;position:relative;width:${WIDTH}px;height:${HEIGHT}px;background:${m.bg};color:${m.fg};font-family:DM Sans;">
  ${ground}
  <div style="display:flex;position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;padding:72px 80px 56px;">
    <div style="display:flex;flex-direction:column;width:${AV + 12}px;padding-top:${d.look.bg === 'band' ? 40 : 18}px;">
      <div style="display:flex;position:relative;width:${AV + 12}px;height:${AV + 12}px;">
        <div style="display:flex;position:absolute;left:0;top:0;width:${AV + 12}px;height:${AV + 12}px;border-radius:${avRadius + 6}px;background:${m.bg};"></div>
        <div style="display:flex;position:absolute;left:6px;top:6px;width:${AV}px;height:${AV}px;">${avatar}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;flex-grow:1;margin-left:64px;${d.look.bg === 'band' ? 'padding-top:150px;' : 'padding-top:10px;'}">
      <div style="display:flex;align-items:center;font-family:IBM Plex Mono;font-size:22px;color:${d.look.bg === 'band' ? a.on : acText};${d.look.bg === 'band' ? 'position:absolute;top:72px;' : ''}">
        <div style="display:flex;width:12px;height:12px;background:${d.look.bg === 'band' ? a.on : a.hex};margin-right:12px;${dot}"></div>${text(d.path)}.hoodfi.eth
      </div>
      <div style="display:flex;margin-top:${d.look.bg === 'band' ? 0 : 18}px;font-family:${face.family};font-weight:${face.weight};font-size:${size}px;line-height:1.02;letter-spacing:-1px;">${text(title)}</div>
      ${d.bio ? `<div style="display:flex;margin-top:16px;font-size:26px;line-height:1.35;color:${m.dim};">${text(truncate(d.bio, 90))}</div>` : ''}
      ${SPACER}
      <div style="display:flex;flex-direction:column;width:100%;">
        ${buttons.map((b, i) => `<div style="display:flex;width:100%;${i ? 'margin-top:16px;' : ''}">${button(d, b)}</div>`).join('')}
      </div>
    </div>
  </div>
  <div style="display:flex;position:absolute;left:80px;bottom:24px;align-items:center;font-family:IBM Plex Mono;font-size:17px;color:${m.faint};">
    <div style="display:flex;width:9px;height:9px;background:${a.hex};margin-right:10px;${dot}"></div>made on HoodFi Sites
  </div>
</div>`
}

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}
