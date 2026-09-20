import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth-config'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentProfileId: string }> }
) {
  const { studentProfileId } = await params
  const session = await auth()

  if (!session?.user || session.user.role !== 'parent') {
    return NextResponse.json({ error: 'Only a logged-in parent can request an export' }, { status: 403 })
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
  })

  if (!studentProfile || studentProfile.parentId !== session.user.id) {
    return NextResponse.json(
      { error: 'You are not the linked parent for this student' },
      { status: 403 }
    )
  }

  const [user, scaffoldingLevels, sessions, interactions, scaffoldingHistory, flaggedContent] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: studentProfile.userId },
        select: {
          fullName: true,
          email: true,
          phoneE164: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.scaffoldingLevel.findMany({
        where: { studentId: studentProfileId },
        include: { chapter: { include: { subject: true } } },
      }),
      prisma.session.findMany({
        where: { studentId: studentProfileId },
      }),
      prisma.sessionInteraction.findMany({
        where: { studentId: studentProfileId },
      }),
      prisma.scaffoldingHistory.findMany({
        where: { studentId: studentProfileId },
      }),
      prisma.flaggedContent.findMany({
        where: { studentId: studentProfileId },
        select: {
          category: true,
          createdAt: true,
          notifiedParentAt: true,
          rawText: true,
        },
      }),
    ])

  const exportData = {
    exportGeneratedAt: new Date().toISOString(),
    student: {
      profile: {
        grade: studentProfile.grade,
        board: studentProfile.board,
        enrollmentDate: studentProfile.enrollmentDate,
        dpdpConsentGiven: studentProfile.dpdpConsentGiven,
        dpdpConsentAt: studentProfile.dpdpConsentAt,
        dpdpConsentVersion: studentProfile.dpdpConsentVersion,
      },
      account: user,
    },
    scaffoldingLevels: scaffoldingLevels.map((sl) => ({
      subject: sl.chapter.subject.name,
      chapter: sl.chapter.name,
      currentLevel: sl.currentLevel,
      problemsAttempted: sl.problemsAttempted,
      problemsClean: sl.problemsClean,
    })),
    sessions: sessions.map((s) => ({
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      endReason: s.endReason,
      problemsAttempted: s.problemsAttempted,
      sessionEndStatement: s.sessionEndStatement,
    })),
    interactions: interactions.map((i) => ({
      createdAt: i.createdAt,
      interactionType: i.interactionType,
      studentResponse: i.studentResponse,
      isCorrect: i.isCorrect,
    })),
    scaffoldingHistory,
    flaggedContentEvents: flaggedContent,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="scaffhold-data-export-${studentProfileId}.json"`,
    },
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentProfileId: string }> }
) {
  const { studentProfileId } = await params
  const session = await auth()

  if (!session?.user || session.user.role !== 'parent') {
    return NextResponse.json({ error: 'Only a logged-in parent can request deletion' }, { status: 403 })
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
  })

  if (!studentProfile || studentProfile.parentId !== session.user.id) {
    return NextResponse.json(
      { error: 'You are not the linked parent for this student' },
      { status: 403 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionInteraction.deleteMany({ where: { studentId: studentProfileId } })
    await tx.scaffoldingHistory.deleteMany({ where: { studentId: studentProfileId } })

    const studentSessions = await tx.session.findMany({
      where: { studentId: studentProfileId },
      select: { id: true },
    })
    const sessionIds = studentSessions.map((s) => s.id)

    await tx.aiCall.deleteMany({ where: { sessionId: { in: sessionIds } } })
    await tx.teacherObservation.deleteMany({ where: { studentId: studentProfile.userId } })
    // ParentSummary references User directly on both studentId and
    // parentId. The weekly-summary feature was never built (Tier 2,
    // unbuilt), so this should always be zero rows today — kept here
    // defensively so deletion doesn't silently break the moment that
    // feature ships and starts writing real rows.
    await tx.parentSummary.deleteMany({ where: { studentId: studentProfile.userId } })
    await tx.session.deleteMany({ where: { studentId: studentProfileId } })

    await tx.scaffoldingLevel.deleteMany({ where: { studentId: studentProfileId } })
    await tx.studentInvite.deleteMany({ where: { studentProfileId } })

    await tx.account.deleteMany({ where: { userId: studentProfile.userId } })
    await tx.session_NextAuth.deleteMany({ where: { userId: studentProfile.userId } })

    await tx.studentProfile.delete({ where: { id: studentProfileId } })
    await tx.user.delete({ where: { id: studentProfile.userId } })
  })

  return NextResponse.json({ deleted: true })
}