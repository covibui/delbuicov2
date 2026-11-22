import React from 'react'
import Link from 'next/link'
import '@fontsource/libre-bodoni/400.css'
import '@fontsource/libre-bodoni/400-italic.css'
import '@fontsource/libre-bodoni/600.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import './styles.css'
import { getCurrentUser } from '@/lib/data'

export const metadata = {
  title: { default: 'The DelBuiCo Cookbook', template: '%s · DelBuiCo Cookbook' },
  description: 'Family recipes from the Del Buico kitchen.',
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#FBF8F1' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <html lang="en">
      <body>
        <div className="book">
          <header className="masthead">
            <Link href="/" className="masthead__brand">
              <span className="masthead__mark">DelBuiCo</span>
              <span className="masthead__sub">Family cookbook</span>
            </Link>
            <nav className="masthead__nav" aria-label="Main">
              <Link href="/chapters">Contents</Link>
              <Link href="/search">Search</Link>
              {user ? (
                <>
                  <Link href="/add" className="masthead__cta">
                    + Add a recipe
                  </Link>
                  <Link href="/account" className="masthead__user" title="Your account">
                    {user.name?.split(' ')[0] || 'Account'}
                  </Link>
                </>
              ) : (
                <Link href="/login">Log in</Link>
              )}
            </nav>
          </header>
          <main>{children}</main>
          <footer className="colophon">
            <span>The DelBuiCo Cookbook</span>
            <span className="colophon__dot">·</span>
            <span>Del Buico Kitchen</span>
            {user?.role === 'admin' ? (
              <>
                <span className="colophon__dot">·</span>
                <a href="/admin">Admin</a>
              </>
            ) : null}
          </footer>
        </div>
      </body>
    </html>
  )
}
