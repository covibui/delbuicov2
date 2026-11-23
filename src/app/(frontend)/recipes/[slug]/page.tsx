import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  bylineOf,
  canEdit,
  chapterOf,
  creditOf,
  getAllRecipes,
  getCurrentUser,
  getPayloadClient,
  mediaUrl,
  romanOf,
  tagsOf,
  totalMinutes,
} from '@/lib/data'
import { formatMinutes, splitLines, type ParsedIngredient } from '@/lib/ingredients'
import { RecipeBody } from '@/components/RecipeBody'
import { PrintButton } from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

async function getRecipe(slug: string) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'recipes', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return docs[0] || null
}

export async function generateMetadata({ params }: Props) {
  const r = await getRecipe((await params).slug)
  return { title: r?.title || 'Recipe not found' }
}

const PrintIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />
  </svg>
)

export default async function RecipePage({ params }: Props) {
  const { slug } = await params
  const recipe = await getRecipe(slug)
  if (!recipe) notFound()

  const [user, all] = await Promise.all([getCurrentUser(), getAllRecipes()])
  const chapter = chapterOf(recipe)
  const roman = romanOf(chapter)
  const credit = creditOf(recipe)
  const byline = bylineOf(recipe)
  const steps = splitLines(recipe.stepsText).filter((s) => !/^\(no steps written yet\)$|^\(none listed\)$/i.test(s))
  const items: ParsedIngredient[] = (recipe.ingredients || [])
    .filter((i) => !/^\(none listed\)$/i.test(i.raw || ''))
    .map((i) => ({
      raw: i.raw || '',
      qty: i.qty,
      qtyMax: i.qtyMax,
      unit: i.unit,
      altQty: i.altQty,
      altUnit: i.altUnit,
      item: i.item || i.raw || '',
      note: i.note,
    }))
  const photo = mediaUrl(recipe.photo, 'card')
  const total = totalMinutes(recipe)

  // previous / next within the chapter, A–Z
  const siblings = all.filter((r) => chapterOf(r)?.id === chapter?.id)
  const pos = siblings.findIndex((r) => r.id === recipe.id)
  const prev = pos > 0 ? siblings[pos - 1] : null
  const next = pos >= 0 && pos < siblings.length - 1 ? siblings[pos + 1] : null

  return (
    <main className="wrap">
      <article className="sheet">
        <span aria-hidden="true" className="ribbon screen-only" />

        <div className="topbar screen-only">
          {chapter ? <Link href={`/chapters/${chapter.slug}`}>← {chapter.title}</Link> : <Link href="/chapters">← Contents</Link>}
          <span className="topbar-actions">
            <PrintButton icon={<PrintIcon />} />
            {canEdit(user, recipe) ? <Link href={`/add?edit=${recipe.id}`}>Edit</Link> : null}
          </span>
        </div>

        <header className="r-title screen-only">
          <div className="eyebrow">
            Chapter {roman} · {chapter?.title}
          </div>
          <h1 className="t-recipe">{recipe.title}</h1>
          <p className="by">{byline}</p>
        </header>

        <div className="screen-only">
          <RecipeBody
            serves={recipe.servings ?? null}
            prep={formatMinutes(recipe.prepMinutes)}
            cook={formatMinutes(recipe.cookMinutes)}
            ready={formatMinutes(total)}
            intro={recipe.intro || null}
            ingredients={items}
            equipment={splitLines(recipe.equipmentText)}
            steps={steps}
            notes={recipe.notes || null}
            photo={photo}
            credit={credit}
            tags={tagsOf(recipe).map((t) => ({ id: t.id, name: t.name }))}
            source={recipe.sourceUrl || null}
          />
        </div>

        <nav className="r-foot screen-only" aria-label="More in this chapter">
          {prev ? (
            <Link className="prev" href={`/recipes/${prev.slug}`}>
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          <span className="folio hide-phone">— {roman.toLowerCase()} —</span>
          {next ? <Link href={`/recipes/${next.slug}`}>{next.title} →</Link> : <span />}
        </nav>

        {/* Print layout (design: "Print" board). Hidden on screen. */}
        <div className="print-sheet" aria-hidden="true">
          <div className="p-top">
            <span>The DelBuiCo Cookbook</span>
            <span>
              Chapter {roman} · {chapter?.title}
            </span>
          </div>
          <div>
            <h1>{recipe.title}</h1>
            <p className="p-by">
              {[
                byline,
                recipe.servings ? `Serves ${recipe.servings}` : '',
                recipe.prepMinutes ? `Prep ${formatMinutes(recipe.prepMinutes)}` : '',
                recipe.cookMinutes ? `Cook ${formatMinutes(recipe.cookMinutes)}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="p-cols">
            <div>
              <div className="p-h">Ingredients</div>
              <ul>
                {items.map((i, k) => (
                  <li key={k}>
                    {i.raw.split(' | ')[0]}
                    {i.note ? <i> ({i.note})</i> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="p-h">Method</div>
              <ol>
                {steps.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ol>
              {recipe.notes ? (
                <p style={{ marginTop: 14, fontStyle: 'italic' }}>
                  <b style={{ fontStyle: 'normal' }}>Notes: </b>
                  {recipe.notes}
                </p>
              ) : null}
            </div>
          </div>
          <div className="p-bot">
            <span>Printed from the family cookbook</span>
            <span>{credit === 'Family recipe' ? 'Family recipe' : credit}</span>
          </div>
        </div>
      </article>
    </main>
  )
}
