'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/chapters', label: 'Chapters', match: (p: string) => p.startsWith('/chapters') },
  { href: '/search', label: 'Search', match: (p: string) => p.startsWith('/search') },
]

/** Pages with their own header (Quick Add) or none (sign in) skip the nav. */
const NO_NAV = ['/add', '/login']

export function Nav({ userName }: { userName: string | null }) {
  const pathname = usePathname() || '/'
  if (NO_NAV.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null
  const first = userName?.split(' ')[0] || ''
  return (
    <header className="nav">
      <Link href="/" className="brand">
        The DelBuiCo <i>Cookbook</i>
      </Link>
      <nav className="nav-links" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={l.match(pathname) ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      {userName ? (
        <>
          <Link href="/add" className="nav-add">
            <span className="nav-add-full">+ Add a recipe</span>
            <span className="nav-add-short">+ Add</span>
          </Link>
          <Link href="/account" className="nav-me" aria-label="Your account">
            <span className="avatar">{first.charAt(0).toUpperCase() || '?'}</span>
            <span className="nav-name">{first}</span>
          </Link>
        </>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="nav-signin">
          Sign in
        </Link>
      )}
    </header>
  )
}
