'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatMinutes } from '@/lib/ingredients'

export type ChapterRow = {
  slug: string
  title: string
  cook: string
  prep: number
  total: number
  serves: number | null
}

/** Recipe table with A–Z / Quickest sort and a cook filter (design: "Chapter" board). */
export function ChapterTable({ rows, chapterName }: { rows: ChapterRow[]; chapterName: string }) {
  const [sort, setSort] = useState<'az' | 'quick'>('az')
  const [cook, setCook] = useState('')
  const cooks = useMemo(() => [...new Set(rows.map((r) => r.cook))].sort(), [rows])
  const list = useMemo(() => {
    const l = rows.filter((r) => !cook || r.cook === cook)
    return [...l].sort(
      sort === 'quick'
        ? (a, b) => (a.total || Infinity) - (b.total || Infinity) || a.title.localeCompare(b.title)
        : (a, b) => a.title.localeCompare(b.title),
    )
  }, [rows, sort, cook])

  return (
    <>
      <div className="controls">
        <span className="lbl" style={{ marginRight: 4 }}>
          Sort
        </span>
        {(
          [
            ['az', 'A–Z'],
            ['quick', 'Quickest'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="toggle" aria-pressed={sort === k} onClick={() => setSort(k)}>
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {cooks.length > 1 ? (
          <>
            <label htmlFor="ch-cook" className="lbl">
              Cook
            </label>
            <select id="ch-cook" className="select" value={cook} onChange={(e) => setCook(e.target.value)}>
              <option value="">Everyone</option>
              {cooks.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className="table-head chap-grid">
        <span>Recipe</span>
        <span className="col-cook">Cook</span>
        <span className="col-prep">Prep</span>
        <span>Total</span>
        <span className="col-serves" style={{ textAlign: 'right' }}>
          Serves
        </span>
      </div>
      {list.map((r) => (
        <Link key={r.slug} href={`/recipes/${r.slug}`} className="table-row chap-grid">
          <span style={{ minWidth: 0 }}>
            <span className="t">{r.title}</span>
            <span className="only-phone s">
              {r.cook}
              {r.serves ? ` · Serves ${r.serves}` : ''}
            </span>
          </span>
          <span className="col-cook">{r.cook}</span>
          <span className="col-prep s">{formatMinutes(r.prep) || '—'}</span>
          <span className="s2">{formatMinutes(r.total) || '—'}</span>
          <span className="col-serves s" style={{ textAlign: 'right' }}>
            {r.serves ?? '—'}
          </span>
        </Link>
      ))}
      {rows.length > 0 && list.length === 0 ? (
        <p className="muted-i" style={{ margin: '18px 0 0' }}>
          No recipes from this cook in {chapterName}.
        </p>
      ) : null}
    </>
  )
}
