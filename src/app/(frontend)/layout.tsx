import React from 'react'
import '@fontsource/libre-bodoni/400.css'
import '@fontsource/libre-bodoni/400-italic.css'
import '@fontsource/libre-bodoni/500.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import './styles.css'
import { getCurrentUser } from '@/lib/data'
import { Nav } from '@/components/Nav'

export const metadata = {
  title: { default: 'The DelBuiCo Cookbook', template: '%s · The DelBuiCo Cookbook' },
  description: 'Family recipes from the Del Buico kitchen.',
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#F6F1E7' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <html lang="en">
      <body>
        <Nav userName={user?.name ?? null} />
        {children}
      </body>
    </html>
  )
}
