/**
 * Ingredient line parsing and scaling.
 *
 * One ingredient per line, e.g.
 *   "1 1/2 pounds beef soup meat"
 *   "2 cups ricotta, drained (or cottage cheese)"
 *   "salt to taste"
 *   "1/2 cup sugar | or honey"        ← text after "|" is a note / substitute
 *
 * Parsing is best-effort: anything we can't read as a quantity stays in `item`,
 * and the original line is always kept in `raw`, so nothing is ever lost.
 */

export type ParsedIngredient = {
  raw: string
  qty?: number | null
  qtyMax?: number | null
  unit?: string | null
  /** second measurement on the same line: "50 g / 1/4 cup sugar" */
  altQty?: number | null
  altUnit?: string | null
  item: string
  note?: string | null
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
}

// Canonical unit → accepted spellings. Order matters only for display.
const UNITS: Record<string, string[]> = {
  tsp: ['tsp', 'tsp.', 'tsps', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tbsp.', 'tbsps', 'tbs', 'tbs.', 'tbls', 'tbl', 'tbl.', 'tablespoon', 'tablespoons', 'T'],
  cup: ['cup', 'cups', 'c', 'c.'],
  'fl oz': ['fl oz', 'fl. oz.', 'fluid ounce', 'fluid ounces'],
  oz: ['oz', 'oz.', 'ounce', 'ounces'],
  lb: ['lb', 'lb.', 'lbs', 'lbs.', 'pound', 'pounds'],
  g: ['g', 'g.', 'gram', 'grams', 'gr', 'grs', 'gramos'],
  kg: ['kg', 'kilogram', 'kilograms'],
  ml: ['ml', 'mL', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  L: ['l', 'L', 'liter', 'liters', 'litre', 'litres'],
  pint: ['pint', 'pints', 'pt'],
  quart: ['quart', 'quarts', 'qt'],
  gallon: ['gallon', 'gallons', 'gal'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans', 'tin', 'tins'],
  package: ['package', 'packages', 'pkg', 'packet', 'packets'],
  stick: ['stick', 'sticks'],
  bunch: ['bunch', 'bunches'],
  head: ['head', 'heads'],
  slice: ['slice', 'slices'],
  sprig: ['sprig', 'sprigs'],
  piece: ['piece', 'pieces'],
  inch: ['inch', 'inches', 'in.'],
  // Spanish (kept as written, so Spanish recipes still read naturally)
  taza: ['taza', 'tazas'],
  cucharada: ['cucharada', 'cucharadas'],
  cucharadita: ['cucharadita', 'cucharaditas'],
}

const UNIT_LOOKUP = new Map<string, string>()
for (const [canonical, spellings] of Object.entries(UNITS)) {
  for (const s of spellings) UNIT_LOOKUP.set(s, canonical)
}
// Single-letter "t"/"T"/"c" are case-sensitive and only accepted when exact.
const CASE_SENSITIVE = new Set(['t', 'T', 'c', 'l', 'L'])

/** Removes soft hyphens, odd whitespace and stray spaces. */
export function cleanText(s: string): string {
  return s
    .replace(/­/g, '') // soft hyphen
    .replace(/[   ]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Reads one number token: "2", "1.5", "1/2", "½", "1½". Returns undefined if not a number. */
function readNumber(token: string): number | undefined {
  if (!token) return undefined
  // "1½"
  const mixedUnicode = token.match(/^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/)
  if (mixedUnicode) return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]]
  if (token in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[token]
  const frac = token.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[2]) === 0 ? undefined : Number(frac[1]) / Number(frac[2])
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token)
  if (/^\.\d+$/.test(token)) return Number(token)
  return undefined
}

/**
 * Reads a leading quantity: "1 1/2", "2-3", "2 to 3", "½".
 * Returns the quantity and the rest of the string.
 */
function readQuantity(s: string): { qty?: number; qtyMax?: number; rest: string } {
  // Put a space between a number and a glued unit: "500g" → "500 g", "2tbsp" → "2 tbsp"
  s = s.replace(/^(\d+(?:[./]\d+)?)([a-zA-Z]{1,12})\b/, '$1 $2')
  // Separate a unicode fraction glued to text: "½cup" → "½ cup"
  s = s.replace(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?=\S)/, '$1 ')

  const tokens = s.split(' ')
  let i = 0
  let qty: number | undefined
  const first = readNumber(tokens[0])
  if (first === undefined) return { rest: s }
  qty = first
  i = 1
  // mixed number "1 1/2" or "1 ½"
  const second = tokens[1]
  if (second && (/^\d+\/\d+$/.test(second) || second in UNICODE_FRACTIONS) && Number.isInteger(first)) {
    qty += readNumber(second) as number
    i = 2
  }
  // ranges "2-3", "2 - 3", "2 to 3"
  let qtyMax: number | undefined
  const joined = tokens.slice(0, i).join(' ')
  const rangeInline = joined.match(/^(\S+)[-–](\S+)$/)
  if (rangeInline) {
    const a = readNumber(rangeInline[1])
    const b = readNumber(rangeInline[2])
    if (a !== undefined && b !== undefined) {
      qty = a
      qtyMax = b
    }
  } else if ((tokens[i] === '-' || tokens[i] === '–' || tokens[i] === 'to') && tokens[i + 1]) {
    const b = readNumber(tokens[i + 1])
    if (b !== undefined) {
      qtyMax = b
      i += 2
    }
  }
  return { qty, qtyMax, rest: tokens.slice(i).join(' ') }
}

function readRangeToken(s: string): { qty?: number; qtyMax?: number; rest: string } {
  // handle "2-3 cups" where the token itself is a range
  const m = s.match(/^(\d+(?:\/\d+)?|[½⅓⅔¼¾⅛])\s*[-–]\s*(\d+(?:\/\d+)?|[½⅓⅔¼¾⅛])\b\s*(.*)$/)
  if (m) {
    const a = readNumber(m[1])
    const b = readNumber(m[2])
    if (a !== undefined && b !== undefined) return { qty: a, qtyMax: b, rest: m[3] }
  }
  return readQuantity(s)
}

function readUnit(s: string): { unit?: string; rest: string } {
  // try two-word units first ("fl oz", "fluid ounces")
  const words = s.split(' ')
  for (const n of [2, 1]) {
    if (words.length < n) continue
    const candidate = words.slice(0, n).join(' ')
    const stripped = candidate.replace(/[,/]$/, '')
    const exact = UNIT_LOOKUP.get(stripped)
    if (exact && (!CASE_SENSITIVE.has(stripped) || n === 1)) {
      // single-letter units only if followed by more text (avoid eating "L" in "L-shaped")
      if (stripped.length === 1 && words.length === 1) continue
      return { unit: exact, rest: words.slice(n).join(' ') }
    }
    if (!CASE_SENSITIVE.has(stripped)) {
      const lower = UNIT_LOOKUP.get(stripped.toLowerCase())
      if (lower && stripped.length > 1) return { unit: lower, rest: words.slice(n).join(' ') }
    }
  }
  return { rest: s }
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = cleanText(line.replace(/^\s*[-*•·]\s*/, '')) // drop list bullets
  if (!raw) return null

  let main = raw
  let note: string | undefined
  // "|" separates a note/substitute
  const pipe = main.indexOf('|')
  if (pipe >= 0) {
    note = cleanText(main.slice(pipe + 1))
    main = cleanText(main.slice(0, pipe))
  }

  // "5 g/ 2 tsp" → "5 g / 2 tsp" (a slash between two measurements)
  main = main.replace(/([a-zA-Z.])\/\s*(?=\d|[½⅓⅔¼¾⅛])/g, '$1 / ')
  const q = readRangeToken(main)
  let rest = q.rest
  let unit: string | undefined
  let altQty: number | undefined
  let altUnit: string | undefined
  if (q.qty !== undefined) {
    // "(14 oz) can tomatoes" — keep a size note in parentheses with the item
    const u = readUnit(rest)
    unit = u.unit
    rest = u.rest
    // "of" after unit: "2 cups of flour"
    if (unit) rest = rest.replace(/^of\s+/i, '')
    // second measurement: "50 g/ 1/4 cup sugar", "5 g / 2 tsp yeast"
    if (unit) {
      const altMatch = rest.match(/^\/\s*(.*)$/)
      const altSource = altMatch ? altMatch[1] : null
      if (altSource !== null) {
        const aq = readRangeToken(altSource)
        if (aq.qty !== undefined) {
          const au = readUnit(aq.rest)
          if (au.unit) {
            altQty = aq.qty
            altUnit = au.unit
            rest = au.rest
          }
        }
      }
    }
  }

  return {
    raw: pipe >= 0 ? `${main} | ${note}` : raw,
    qty: q.qty ?? null,
    qtyMax: q.qtyMax ?? null,
    unit: unit ?? null,
    altQty: altQty ?? null,
    altUnit: altUnit ?? null,
    item: cleanText(rest) || main,
    note: note || null,
  }
}

export function parseIngredientsText(text: string | null | undefined): ParsedIngredient[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map(parseIngredientLine)
    .filter((x): x is ParsedIngredient => x !== null)
}

/** Splits a text box into non-empty lines (steps, equipment). */
export function splitLines(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((l) => cleanText(l.replace(/^\s*(?:\d+[.)]|[-*•·])\s+/, '')))
    .filter(Boolean)
}

// ---------- formatting ----------

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

/** 1.5 → "1½", 0.333 → "⅓", 2.2 → "2.2" */
export function formatQty(n: number): string {
  if (!isFinite(n) || n <= 0) return ''
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  if (frac < 0.02) return String(whole)
  if (frac > 0.98) return String(whole + 1)
  for (const [v, sym] of NICE_FRACTIONS) {
    if (Math.abs(frac - v) < 0.03) return (whole ? String(whole) : '') + sym
  }
  // not a friendly fraction: one decimal for small numbers, round for big
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}

const PLURAL_UNITS = new Set([
  'cup', 'pint', 'quart', 'gallon', 'pinch', 'dash', 'clove', 'can', 'package', 'stick',
  'bunch', 'head', 'slice', 'sprig', 'piece', 'inch', 'taza', 'cucharada', 'cucharadita',
])

export function formatUnit(unit: string | null | undefined, qty: number | null | undefined): string {
  if (!unit) return ''
  if (PLURAL_UNITS.has(unit) && qty !== undefined && qty !== null && qty > 1) {
    if (unit === 'pinch' || unit === 'dash' || unit === 'bunch') return unit + 'es'
    if (unit === 'inch') return 'inches'
    return unit + 's'
  }
  return unit
}

/** The quantity column text for an ingredient, scaled. "" if there's no quantity. */
export function quantityLabel(ing: ParsedIngredient, scale = 1): string {
  if (ing.qty === null || ing.qty === undefined) return ''
  const a = formatQty(ing.qty * scale)
  const b = ing.qtyMax ? formatQty(ing.qtyMax * scale) : ''
  const q = b ? `${a}–${b}` : a
  const u = formatUnit(ing.unit, ing.qtyMax ?? ing.qty * scale)
  const main = u ? `${q} ${u}` : q
  if (ing.altQty && ing.altUnit) {
    const alt = `${formatQty(ing.altQty * scale)} ${formatUnit(ing.altUnit, ing.altQty * scale)}`
    return `${main} / ${alt}`
  }
  return main
}

/** Minutes → "45 min", "1 h 30 min", "3 days 2 h" */
export function formatMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return ''
  if (min < 60) return `${min} min`
  if (min < 1440) {
    const h = Math.floor(min / 60)
    const r = min % 60
    return `${h} h${r ? ` ${r} min` : ''}`
  }
  const d = Math.floor(min / 1440)
  const hh = Math.round((min % 1440) / 60)
  return `${d} ${d === 1 ? 'day' : 'days'}${hh ? ` ${hh} h` : ''}`
}

/** ISO 8601 duration (PT1H30M, P1DT2H) → minutes */
export function isoDurationToMinutes(iso: string | null | undefined): number | undefined {
  if (!iso || typeof iso !== 'string') return undefined
  const m = iso.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (!m) return undefined
  const [, d, h, mi, s] = m
  const total = Number(d || 0) * 1440 + Number(h || 0) * 60 + Number(mi || 0) + Number(s || 0) / 60
  return total > 0 ? Math.round(total) : undefined
}

// ---------- numerals ----------

export function toRoman(n: number): string {
  if (!n || n < 1) return ''
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [v, s] of map) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

export function slugify(s: string): string {
  return cleanText(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
