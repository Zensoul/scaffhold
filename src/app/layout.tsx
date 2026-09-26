import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth/auth-provider'
import { AppHeader } from '@/components/shell/app-header'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Scaffhold',
    template: '%s | Scaffhold',
  },
  description: 'Adaptive CBSE Class 10 math and physics practice, scaffolded to each student.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deliberately NOT capping maximumScale or disabling user-scalable --
  // blocking pinch-zoom is an accessibility anti-pattern for low-vision
  // users, even on a mobile-optimized layout.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AppHeader />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}