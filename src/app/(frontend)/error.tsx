'use client'
import { useState } from 'react'
import { ErrorPage } from '@/components/ErrorPage'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [tries, setTries] = useState(0)
  return (
    <ErrorPage
      code="500"
      variant="server"
      retry={
        <button
          type="button"
          className="btn"
          onClick={() => {
            setTries((t) => t + 1)
            reset()
          }}
        >
          {tries === 0 ? 'Try again' : `Try again (${tries})`}
        </button>
      }
    />
  )
}
