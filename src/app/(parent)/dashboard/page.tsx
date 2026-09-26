import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth-config'
import { prisma } from '@/lib/db/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataControls } from '@/components/parent/data-controls'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function masteryTone(pct: number): 'success' | 'warning' | 'secondary' {
  if (pct >= 70) return 'success'
  if (pct >= 35) return 'warning'
  return 'secondary'
}

export default async function ParentDashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'parent') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-foreground">This page is only available to parent accounts.</p>
      </div>
    )
  }

  const children = await prisma.studentProfile.findMany({
    where: { parentId: session.user.id },
    include: {
      user: true,
      scaffoldingLevels: {
        include: {
          chapter: { include: { subject: true } },
        },
      },
    },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your children</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track progress and manage each child&apos;s account.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/invite-student">+ Add child</Link>
        </Button>
      </div>

      {children.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="font-medium text-foreground">You haven&apos;t added a child yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Send an invite to get your child set up on Scaffhold.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/invite-student">Add a child</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {children.map((child) => {
          const levels = child.scaffoldingLevels
          const avgMasteryPct =
            levels.length > 0
              ? Math.round(
                  (levels.reduce((sum, l) => sum + Number(l.currentLevel), 0) / levels.length) * 100
                )
              : 0
          const totalAttempted = levels.reduce((sum, l) => sum + l.problemsAttempted, 0)
          const totalClean = levels.reduce((sum, l) => sum + l.problemsClean, 0)

          return (
            <Card key={child.id}>
              <CardContent className="py-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>{initials(child.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{child.user.fullName}</h2>
                      <p className="text-xs text-muted-foreground">Grade {child.grade}</p>
                    </div>
                  </div>
                  <Badge variant={child.dpdpConsentGiven ? 'success' : 'warning'} className="text-[0.65rem]">
                    {child.dpdpConsentGiven ? 'Consent confirmed' : 'Consent pending'}
                  </Badge>
                </div>

                {levels.length > 0 && (
                  <div className="mb-4 rounded-lg border bg-secondary/30 px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">Overall mastery</span>
                      <span className="font-semibold text-foreground">{avgMasteryPct}%</span>
                    </div>
                    <Progress value={avgMasteryPct} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {totalClean}/{totalAttempted} problems correct across {levels.length}{' '}
                      {levels.length === 1 ? 'chapter' : 'chapters'}
                    </p>
                  </div>
                )}

                {levels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chapters started yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {levels.map((sl) => {
                      const pct = Math.round(Number(sl.currentLevel) * 100)
                      return (
                        <div key={sl.id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {sl.chapter.subject.name} — {sl.chapter.name}
                            </span>
                            <span className="font-medium text-foreground">
                              {sl.problemsClean}/{sl.problemsAttempted}
                            </span>
                          </div>
                          <Progress
                            value={pct}
                            className="h-1.5"
                            indicatorClassName={
                              pct >= 70 ? 'bg-success' : pct >= 35 ? 'bg-warning' : undefined
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                <Separator className="my-4" />
                <DataControls studentProfileId={child.id} childName={child.user.fullName} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
