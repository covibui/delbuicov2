'use client'
import Link from 'next/link'
import { useState } from 'react'
import { formatQty, quantityLabel, type ParsedIngredient } from '@/lib/ingredients'

export type RecipeBodyProps = {
  serves: number | null
  prep: string
  cook: string
  ready: string
  intro: string | null
  ingredients: ParsedIngredient[]
  equipment: string[]
  steps: string[]
  notes: string | null
  photo: string | null
  credit: string
  tags: { id: number; name: string }[]
  source: string | null
}

const SCALES: [number, string][] = [
  [0.5, '×½'],
  [1, '×1'],
  [2, '×2'],
]

/** Meta strip + ingredients / method / aside columns from the design's "Recipe" board. */
export function RecipeBody(p: RecipeBodyProps) {
  const [f, setF] = useState(1)
  const scalable = p.ingredients.some((i) => i.qty)
  return (
    <>
      <div className="phone-photo">
        {p.photo ? <img src={p.photo} alt="" /> : <span className="pattern-label">No photo yet</span>}
      </div>

      <div className="r-meta">
        <div>
          <div className="lbl">Serves</div>
          <div className="v">{p.serves ? formatQty(p.serves * f) : '—'}</div>
        </div>
        <div>
          <div className="lbl">Prep</div>
          <div className="v">{p.prep || '—'}</div>
        </div>
        <div>
          <div className="lbl">Cook</div>
          <div className="v">{p.cook || '—'}</div>
        </div>
        <div>
          <div className="lbl">Ready in</div>
          <div className="v">{p.ready || '—'}</div>
        </div>
      </div>

      <div className="r-cols">
        <section className="col col-ing" aria-labelledby="ing-title">
          {p.intro ? <p className="intro">{p.intro}</p> : null}
          <div className="ing-head">
            <h2 id="ing-title">Ingredients</h2>
            {scalable ? (
              <div className="scaler" role="group" aria-label="Scale the recipe">
                {SCALES.map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={f === v} onClick={() => setF(v)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="dbl" />
          {f !== 1 ? (
            <p className="scaled-note">Showing amounts {f === 2 ? 'doubled' : 'halved'}. Times stay the same.</p>
          ) : null}
          <ul className="ing-list">
            {p.ingredients.map((i, k) => (
              <li key={k}>
                <span className="ing-q">{quantityLabel(i, f)}</span>
                <span>
                  {i.item}
                  {i.note ? <span className="ing-sub">{i.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {p.ingredients.some((i) => i.note) || scalable ? (
            <p className="ing-foot">
              {p.ingredients.some((i) => i.note) ? 'Rose lines are substitutes. ' : ''}
              {scalable ? 'Lines without an amount don’t scale.' : ''}
            </p>
          ) : null}
          {p.equipment.length ? (
            <div className="equip">
              <div className="lbl">You’ll need</div>
              <ul>
                {p.equipment.map((e, k) => (
                  <li key={k}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="col col-method" aria-labelledby="method-title">
          <h2 id="method-title">Method</h2>
          <div className="dbl" />
          {p.steps.length ? (
            <ol className="steps">
              {p.steps.map((s, k) => (
                <li key={k}>
                  <span className="n">{k + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted-i">No steps written yet.</p>
          )}
          {p.notes ? (
            <div className="notes">
              <div className="lbl">Notes</div>
              <p>{p.notes}</p>
            </div>
          ) : null}
        </section>

        <aside className="col col-aside">
          <div className="aside-photo">
            {p.photo ? <img src={p.photo} alt="" /> : <span className="pattern-label">No photo yet</span>}
          </div>
          <div className="aside-facts">
            <div>
              <div className="lbl">Cook</div>
              <div>{p.credit}</div>
            </div>
            <div>
              <div className="lbl" style={{ marginBottom: 6 }}>
                Tags
              </div>
              {p.tags.length ? (
                <div className="chips">
                  {p.tags.map((t) => (
                    <Link key={t.id} className="chip" href={`/search?tag=${t.id}`}>
                      {t.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="muted-i">None yet</div>
              )}
            </div>
            <div>
              <div className="lbl">Source</div>
              {p.source ? (
                <a href={p.source} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                  {p.source.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              ) : (
                <div className="muted-i">Family recipe</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
