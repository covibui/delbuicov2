'use client'
import { useState } from 'react'
import { formatQty, quantityLabel, type ParsedIngredient } from '@/lib/ingredients'

const SCALES = [
  { value: 0.5, label: '×½' },
  { value: 1, label: '×1' },
  { value: 2, label: '×2' },
  { value: 3, label: '×3' },
]

export function Ingredients({ items, servings }: { items: ParsedIngredient[]; servings?: number | null }) {
  const [scale, setScale] = useState(1)
  const scalable = items.some((i) => i.qty)
  return (
    <>
      <ul className="ing-list">
        {items.map((ing, i) => {
          const qty = quantityLabel(ing, scale)
          return (
            <li key={i} className="ing">
              <span className="ing__qty">{qty}</span>
              <span>
                {ing.item}
                {ing.note ? <span className="ing__note">{ing.note}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
      {scalable ? (
        <div className="scaler" role="group" aria-label="Scale the recipe">
          {SCALES.map((s) => (
            <button key={s.value} type="button" aria-pressed={scale === s.value} onClick={() => setScale(s.value)}>
              {s.label}
            </button>
          ))}
          {servings ? (
            <span className="scaler__note">serves {formatQty(servings * scale)}</span>
          ) : scale !== 1 ? (
            <span className="scaler__note">amounts {scale > 1 ? 'multiplied' : 'halved'}</span>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
