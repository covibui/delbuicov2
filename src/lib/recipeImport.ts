/**
 * Turning outside recipes into Quick Add drafts.
 *
 * - fromJsonLd(): reads schema.org/Recipe structured data (what most recipe
 *   sites publish for Google).
 * - fromPastedText(): best-effort split of a pasted recipe into title,
 *   ingredients and steps.
 *
 * Both return the same shape the Quick Add form uses. The person reviews it
 * before saving, so "close enough" is the goal.
 */
import { cleanText, isoDurationToMinutes } from './ingredients'

export type RecipeDraft = {
  title: string
  ingredientsText: string
  stepsText: string
  servings?: number
  prepMinutes?: number
  cookMinutes?: number
  intro?: string
  sourceUrl?: string
  imageUrl?: string
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))

const stripTags = (s: string) => cleanText(decodeEntities(String(s).replace(/<[^>]*>/g, ' ')))

function isRecipeNode(node: any): boolean {
  if (!node || typeof node !== 'object') return false
  const t = node['@type']
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))
}

function findRecipe(data: any): any | undefined {
  if (!data) return undefined
  if (Array.isArray(data)) {
    for (const d of data) {
      const r = findRecipe(d)
      if (r) return r
    }
    return undefined
  }
  if (typeof data !== 'object') return undefined
  if (isRecipeNode(data)) return data
  if (data['@graph']) return findRecipe(data['@graph'])
  if (data.mainEntity) return findRecipe(data.mainEntity)
  return undefined
}

function instructionsToLines(ins: any): string[] {
  if (!ins) return []
  if (typeof ins === 'string') {
    return ins
      .split(/\r?\n|(?<=\.)\s{2,}/)
      .map(stripTags)
      .filter(Boolean)
  }
  if (Array.isArray(ins)) return ins.flatMap(instructionsToLines)
  if (typeof ins === 'object') {
    if (ins['@type'] === 'HowToSection' || ins.itemListElement) {
      return instructionsToLines(ins.itemListElement)
    }
    if (ins.text) return [stripTags(ins.text)]
    if (ins.name) return [stripTags(ins.name)]
  }
  return []
}

function firstNumber(v: any): number | undefined {
  const s = Array.isArray(v) ? v.map(String).join(' ') : String(v ?? '')
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : undefined
}

function imageUrl(img: any): string | undefined {
  if (!img) return undefined
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return imageUrl(img[0])
  if (typeof img === 'object') return img.url || img.contentUrl
  return undefined
}

/** Finds every <script type="application/ld+json"> block in an HTML page. */
export function extractJsonLdBlocks(html: string): any[] {
  const out: any[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const body = m[1].trim()
    try {
      out.push(JSON.parse(body))
    } catch {
      // some sites put invalid control chars in JSON-LD; try a light clean
      try {
        out.push(JSON.parse(body.replace(/[\u0000-\u001F]+/g, ' ')))
      } catch {
        /* skip */
      }
    }
  }
  return out
}

export function fromJsonLd(html: string, sourceUrl?: string): RecipeDraft | null {
  const recipe = findRecipe(extractJsonLdBlocks(html))
  if (!recipe) return null
  const ingredients: string[] = (recipe.recipeIngredient || recipe.ingredients || [])
    .map((x: any) => stripTags(x))
    .filter(Boolean)
  const steps = instructionsToLines(recipe.recipeInstructions)
  return {
    title: stripTags(recipe.name || ''),
    ingredientsText: ingredients.join('\n'),
    stepsText: steps.join('\n'),
    servings: firstNumber(recipe.recipeYield),
    prepMinutes: isoDurationToMinutes(recipe.prepTime),
    cookMinutes: isoDurationToMinutes(recipe.cookTime),
    intro: recipe.description ? stripTags(recipe.description) : undefined,
    sourceUrl,
    imageUrl: imageUrl(recipe.image),
  }
}

/** Fallback for pages without structured data: at least grab the title. */
export function titleFromHtml(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og) return stripTags(og[1])
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return t ? stripTags(t[1]).split(/\s[|–-]\s/)[0] : ''
}

// ---------- pasted text ----------

const INGREDIENT_HEADER = /^(ingredients?|ingrédients|what you('|’)ll need|you will need)\s*:?$/i
const STEPS_HEADER = /^(instructions?|directions?|method|preparation|steps?|how to make( it)?)\s*:?$/i
const NOTES_HEADER = /^(notes?|tips?|recipe notes?)\s*:?$/i
const LOOKS_LIKE_INGREDIENT = /^\s*(?:[-*•·]\s*)?(?:\d|[½⅓⅔¼¾⅛]|a\s|an\s|one\s|pinch|dash|salt|pepper)/i

export function fromPastedText(text: string): RecipeDraft {
  const lines = text.split(/\r?\n/).map((l) => cleanText(l))
  const nonEmpty = lines.filter(Boolean)
  const draft: RecipeDraft = { title: '', ingredientsText: '', stepsText: '' }
  if (!nonEmpty.length) return draft

  const iIdx = lines.findIndex((l) => INGREDIENT_HEADER.test(l))
  const sIdx = lines.findIndex((l) => STEPS_HEADER.test(l))

  let ingredients: string[] = []
  let steps: string[] = []
  let notes: string[] = []

  if (iIdx >= 0 && sIdx >= 0) {
    const before = lines
      .slice(0, Math.min(iIdx, sIdx))
      .filter(Boolean)
      .filter((l) => !/^(serves|servings|yield|prep|cook|total)( time)?\s*:?\s*\d/i.test(l))
    draft.title = before[0] || ''
    const intro = before.slice(1).join(' ')
    if (intro) draft.intro = intro
    const ingEnd = sIdx > iIdx ? sIdx : lines.length
    ingredients = lines.slice(iIdx + 1, ingEnd).filter(Boolean)
    let stepsBlock = lines.slice(sIdx + 1, sIdx > iIdx ? lines.length : iIdx)
    const nIdx = stepsBlock.findIndex((l) => NOTES_HEADER.test(l))
    if (nIdx >= 0) {
      notes = stepsBlock.slice(nIdx + 1).filter(Boolean)
      stepsBlock = stepsBlock.slice(0, nIdx)
    }
    steps = stepsBlock.filter(Boolean)
  } else {
    // No headers: title = first line; quantity-looking lines are ingredients,
    // longer sentences after them are steps.
    draft.title = nonEmpty[0]
    let phase: 'ing' | 'steps' = 'ing'
    for (const l of nonEmpty.slice(1)) {
      if (phase === 'ing' && (LOOKS_LIKE_INGREDIENT.test(l) || (l.length < 45 && !/[.!?]$/.test(l)))) {
        ingredients.push(l)
      } else {
        phase = 'steps'
        steps.push(l)
      }
    }
  }

  draft.ingredientsText = ingredients
    .map((l) => l.replace(/^\s*[-*•·▢□☐]\s*/, ''))
    .join('\n')
  draft.stepsText = steps
    .map((l) => l.replace(/^\s*(?:step\s*)?\d+[.):]?\s+/i, ''))
    .join('\n')
  if (notes.length) draft.intro = [draft.intro, ...notes].filter(Boolean).join('\n')

  // "Serves 4" / "Yield: 6 servings" anywhere in the text
  const serves = text.match(/(?:serves|servings|yield)\s*:?\s*(\d+)/i)
  if (serves) draft.servings = Number(serves[1])
  return draft
}
