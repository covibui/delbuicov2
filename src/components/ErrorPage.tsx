import Link from 'next/link'

type Variant = 'not-found' | 'recipe-gone' | 'server' | 'forbidden'

const COPY: Record<Variant, { heading: string; body: string; foot: (code: string) => string }> = {
  'not-found': {
    heading: 'We couldn’t find that page',
    body: 'The link may be mistyped or out of date. Try searching for what you were after.',
    foot: (c) => `Error ${c}`,
  },
  'recipe-gone': {
    heading: 'This recipe is no longer in the book',
    body: 'Whoever added it may have taken it down, or it moved to a new link. Search for it by name or by an ingredient you remember.',
    foot: () => 'Saved this link a while ago? Recipes can be renamed or removed by the person who added them.',
  },
  server: {
    heading: 'Something went wrong on our end',
    body: 'The cookbook couldn’t load this page. Your recipes are safe. Wait a minute, then try again.',
    foot: (c) => `If it keeps happening, tell Bri the error number: ${c}.`,
  },
  forbidden: {
    heading: 'That page is for family members only',
    body: 'You may be signed out, or this account doesn’t have access. Sign in again, or ask Bri for an account.',
    foot: (c) => `Error ${c}`,
  },
}

/** Big-numeral error sheet from the design's "Error" board. */
export function ErrorPage({
  code,
  variant,
  retry,
}: {
  code: string
  variant: Variant
  /** Server errors get a "Try again" button (rendered by the client error boundary). */
  retry?: React.ReactNode
}) {
  const c = COPY[variant]
  const eyebrow = variant === 'recipe-gone' ? `Recipe removed · Error ${code}` : `Error ${code}`
  return (
    <main className="wrap">
      <div className="sheet err-sheet">
        <span aria-hidden="true" className="err-code">
          {code}
        </span>
        <span className="eyebrow" style={{ letterSpacing: '0.24em' }}>
          {eyebrow}
        </span>
        <h1>{c.heading}</h1>
        <p>{c.body}</p>
        <div className="rule" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {variant === 'server' ? retry : null}
          {variant === 'recipe-gone' ? (
            <>
              <Link className="btn" href="/search">
                Search for it
              </Link>
              <Link className="btn btn--ghost" href="/chapters">
                Browse chapters
              </Link>
            </>
          ) : null}
          {variant === 'not-found' ? (
            <Link className="btn" href="/search">
              Search the book
            </Link>
          ) : null}
          {variant === 'forbidden' ? (
            <Link className="btn" href="/login">
              Sign in
            </Link>
          ) : null}
          <Link className="btn btn--ghost" href="/">
            Back to the book
          </Link>
        </div>
        <p className="foot-note">{c.foot(code)}</p>
      </div>
    </main>
  )
}
