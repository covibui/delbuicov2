import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Tag } from '@/payload-types'
import {
  addedByName,
  canEdit,
  chapterOf,
  getChapters,
  getCurrentUser,
  getPayloadClient,
  mediaUrl,
  recipeNumber,
} from '@/lib/data'
import { formatMinutes, splitLines, toRoman, type ParsedIngredient } from '@/lib/ingredients'
import { Ingredients } from '@/components/Ingredients'
import { PrintButton } from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

async function getRecipe(slug: string) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'recipes',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })
  return docs[0] || null
}

export async function generateMetadata({ params }: Props) {
  const r = await getRecipe((await params).slug)
  return { title: r?.title || 'Recipe' }
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params
  const recipe = await getRecipe(slug)
  if (!recipe) notFound()

  const [user, number, chapters] = await Promise.all([getCurrentUser(), recipeNumber(recipe), getChapters()])
  const chapter = chapterOf(recipe)
  const by = addedByName(recipe)
  const steps = splitLines(recipe.stepsText)
  const equipment = splitLines(recipe.equipmentText)
  const photo = mediaUrl(recipe.photo, 'card')
  const tags = (recipe.tags || []).filter((t): t is Tag => typeof t === 'object')
  const items: ParsedIngredient[] = (recipe.ingredients || []).map((i) => ({
    raw: i.raw || '',
    qty: i.qty,
    qtyMax: i.qtyMax,
    unit: i.unit,
    altQty: i.altQty,
    altUnit: i.altUnit,
    item: i.item || i.raw || '',
    note: i.note,
  }))

  // previous / next within the chapter (alphabetical)
  const siblings = chapters.find((c) => c.id === chapter?.id)?.recipes?.docs || []
  const ids = siblings.map((s) => (typeof s === 'object' ? s.id : s))
  const pos = ids.indexOf(recipe.id)
  const payload = await getPayloadClient()
  const neighbourIds = [ids[pos - 1], ids[pos + 1]].filter(Boolean) as number[]
  const neighbours = neighbourIds.length
    ? (
        await payload.find({
          collection: 'recipes',
          where: { id: { in: neighbourIds } },
          select: { title: true, slug: true },
          depth: 0,
        })
      ).docs
    : []
  const prev = neighbours.find((n) => n.id === ids[pos - 1])
  const next = neighbours.find((n) => n.id === ids[pos + 1])

  const meta = [
    recipe.servings ? { label: 'Serves', value: String(recipe.servings) } : null,
    recipe.prepMinutes ? { label: 'Prep', value: formatMinutes(recipe.prepMinutes) } : null,
    recipe.cookMinutes ? { label: 'Cook', value: formatMinutes(recipe.cookMinutes) } : null,
    recipe.prepMinutes && recipe.cookMinutes
      ? { label: 'Total', value: formatMinutes(recipe.prepMinutes + recipe.cookMinutes) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <article>
      <div className="recipe-bar">
        {chapter ? (
          <Link href={`/chapters/${chapter.slug}`}>
            ← {toRoman(chapter.order)} · {chapter.title}
          </Link>
        ) : (
          <span />
        )}
        <span className="recipe-bar__num">{number}</span>
        <span className="recipe-bar__actions">
          <PrintButton />
          {canEdit(user, recipe) ? <Link href={`/add?edit=${recipe.id}`}>Edit</Link> : null}
        </span>
      </div>

      <header className="page-head">
        <div className="label label--rust">{chapter?.title}</div>
        <h1>{recipe.title}</h1>
        {by ? <div className="flourish">from {by}</div> : null}
      </header>

      {meta.length ? (
        <div className="meta-strip">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="label">{m.label}</div>
              <div className="meta-strip__value">{m.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="recipe-body">
        <section className="ingredients" aria-labelledby="ing-title">
          <h2 className="block-title" id="ing-title">
            Ingredients
          </h2>
          <div className="double-rule" />
          <Ingredients items={items} servings={recipe.servings} />
          {equipment.length ? (
            <div className="equipment">
              <h3 className="label">You'll need</h3>
              <ul>
                {equipment.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="steps" aria-labelledby="steps-title">
          {recipe.intro ? <p className="intro">{recipe.intro}</p> : null}
          <h2 className="block-title" id="steps-title">
            Method
          </h2>
          <div className="double-rule" />
          <ol>
            {steps.map((s, i) => (
              <li key={i}>
                <span className="step-text">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="margin">
          {recipe.notes ? (
            <div>
              <div className="label label--rust" style={{ marginBottom: 10 }}>
                In the margin
              </div>
              <div className="margin-note">{recipe.notes}</div>
            </div>
          ) : null}
          {photo ? (
            <img className="photo" src={photo} alt={recipe.title} />
          ) : (
            <div className="photo--placeholder" aria-hidden="true">
              {recipe.title}
            </div>
          )}
          {by ? (
            <div className="credit">
              <div className="label">Added by</div>
              <strong>{by}</strong>
            </div>
          ) : null}
          {tags.length ? (
            <div className="tag-list">
              {tags.map((t) => (
                <Link key={t.id} className="tag" href={`/search?tag=${t.id}`}>
                  {t.name}
                </Link>
              ))}
            </div>
          ) : null}
          {recipe.sourceUrl ? (
            <div className="source">
              <div className="label">Original</div>
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {recipe.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
              </a>
            </div>
          ) : null}
        </aside>
      </div>

      <nav className="recipe-foot" aria-label="More in this chapter">
        {prev ? <Link href={`/recipes/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/recipes/${next.slug}`}>{next.title} →</Link> : <span />}
      </nav>
    </article>
  )
}
