'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NavLink = { href: string; label: string }

const NAV_BY_ROLE: Record<'student' | 'teacher' | 'parent', NavLink[]> = {
  student: [{ href: '/student-dashboard', label: 'My chapters' }],
  teacher: [{ href: '/teacher-dashboard', label: 'Students' }],
  parent: [{ href: '/dashboard', label: 'Overview' }],
}

const ROLE_LABEL: Record<'student' | 'teacher' | 'parent', string> = {
  student: 'Student',
  teacher: 'Teacher',
  parent: 'Parent',
}

function initials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function AppHeader() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  const role = session?.user?.role
  const navLinks = role ? NAV_BY_ROLE[role] : []
  const homeHref = role ? NAV_BY_ROLE[role][0]?.href ?? '/' : '/'

  // Hide the app chrome entirely on auth pages -- a logged-out visitor
  // on /login or /register shouldn't see a half-populated header with
  // no nav links and no user menu.
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/register') ||
    pathname === '/consent-required'

  if (isAuthPage) return null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              S
            </span>
            <span className="text-[0.95rem]">Scaffhold</span>
          </Link>

          {status === 'authenticated' && navLinks.length > 0 && (
            <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
              {navLinks.map((link) => {
                const active = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {status === 'authenticated' && session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-8">
                  <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {navLinks.length > 0 && (
                <div className="sm:hidden">
                  {navLinks.map((link) => {
                    const active = pathname === link.href || pathname.startsWith(link.href + '/')
                    return (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href} aria-current={active ? 'page' : undefined}>
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                </div>
              )}
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {session.user.name ?? 'Account'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {role ? ROLE_LABEL[role] : ''}
                    {session.user.email ? ` · ${session.user.email}` : ''}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => signOut({ callbackUrl: '/login' })}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : status === 'unauthenticated' ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        ) : (
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        )}
      </div>
    </header>
  )
}
