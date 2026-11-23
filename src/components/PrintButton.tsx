'use client'

export function PrintButton({ icon }: { icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()}>
      {icon}
      Print
    </button>
  )
}
