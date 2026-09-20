import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth-config'
import { prisma } from '@/lib/db/prisma'
import { AnnotationType } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params
  const session = await auth()

  if (!session?.user || session.user.role !== 'teacher') {
    return NextResponse.json({ error: 'Only a teacher can approve content' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { edits } = body as {
    edits?: {
      unknownAnnotation?: string
      concreteRestatement?: string
      conceptAnchor?: string
      problemType?: string
      difficultyTier?: number
      annotations?: Array<{
        annotationType: string
        annotationText: string
        hintText: string
        sequenceOrder: number
      }>
    }
  }

  const draft = await prisma.problemDraft.findUnique({ where: { id: draftId } })

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'This draft has already been approved' }, { status: 409 })
  }

  const finalUnknown = edits?.unknownAnnotation ?? draft.unknownAnnotation
  const finalRestatement = edits?.concreteRestatement ?? draft.concreteRestatement
  const finalConceptAnchor = edits?.conceptAnchor ?? draft.conceptAnchor
  const finalProblemType = edits?.problemType ?? draft.problemType
  const finalDifficultyTier = edits?.difficultyTier ?? draft.difficultyTier
  const finalAnnotations = edits?.annotations ?? (draft.annotationsDraft as any[])

  if (
    !finalUnknown ||
    !finalRestatement ||
    !finalConceptAnchor ||
    !finalProblemType ||
    !finalDifficultyTier ||
    !finalAnnotations ||
    finalAnnotations.length === 0
  ) {
    return NextResponse.json(
      { error: 'Cannot approve an incomplete draft — all fields must be filled in' },
      { status: 422 }
    )
  }

  const givens = finalAnnotations
    .filter((a) => a.annotationType === 'given')
    .map((a) => a.annotationText)
  const impliedGivens = finalAnnotations
    .filter((a) => a.annotationType === 'implied_given')
    .map((a) => a.annotationText)

  const result = await prisma.$transaction(async (tx) => {
    const problem = await tx.problem.create({
      data: {
        chapterId: draft.chapterId,
        source: 'NCERT',
        rawText: draft.rawText,
        unknownAnnotation: finalUnknown,
        concreteRestatement: finalRestatement,
        givens,
        impliedGivens,
        conceptAnchor: finalConceptAnchor,
        problemType: finalProblemType,
        difficultyTier: finalDifficultyTier,
        contentReviewedBy: session.user.id,
        contentReviewedAt: new Date(),
      },
    })

    await tx.problemAnnotation.createMany({
      data: finalAnnotations.map((a) => ({
        problemId: problem.id,
        annotationType: a.annotationType as AnnotationType,
        annotationText: a.annotationText,
        hintText: a.hintText,
        sequenceOrder: a.sequenceOrder,
      })),
    })

    await tx.problemDraft.update({
      where: { id: draftId },
      data: {
        status: 'approved',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        publishedProblemId: problem.id,
      },
    })

    return problem
  })

  return NextResponse.json({ problemId: result.id })
}