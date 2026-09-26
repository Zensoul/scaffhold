import { prisma } from '@/lib/db/prisma'
import { AnnotationType } from '@prisma/client'

type DraftAnnotation = {
  annotationType: AnnotationType
  annotationText: string
  hintText: string
  sequenceOrder: number
}

// Promotes an approved ProblemDraft into a live, servable Problem row plus
// its ProblemAnnotation rows. This is the ONLY path that creates a live
// Problem from generated content -- it requires the draft to already be
// status: 'approved' (set via the approve route, a deliberate human
// action), so a draft can never reach students without that review step.
//
// givens/impliedGivens on the live Problem are derived from the reviewed
// annotationsDraft entries (not re-generated), so the flat Problem fields
// and the ProblemAnnotation rows are built from the exact same
// human-approved source and can't drift apart.
export async function promoteDraft(params: {
  draftId: string
  reviewedBy: string
}): Promise<{ problemId: string }> {
  const { draftId, reviewedBy } = params

  const draft = await prisma.problemDraft.findUnique({ where: { id: draftId } })

  if (!draft) {
    throw new Error(`ProblemDraft ${draftId} not found`)
  }

  if (draft.status !== 'approved') {
    throw new Error(
      `ProblemDraft ${draftId} has status "${draft.status}", not "approved" -- approve it before promoting`
    )
  }

  if (draft.publishedProblemId) {
    throw new Error(`ProblemDraft ${draftId} was already promoted to Problem ${draft.publishedProblemId}`)
  }

  if (
    !draft.unknownAnnotation ||
    !draft.concreteRestatement ||
    !draft.conceptAnchor ||
    !draft.problemType ||
    draft.difficultyTier == null ||
    !draft.annotationsDraft
  ) {
    throw new Error(
      `ProblemDraft ${draftId} is missing required content -- cannot promote an incomplete draft`
    )
  }

  const annotations = draft.annotationsDraft as unknown as DraftAnnotation[]

  if (!Array.isArray(annotations) || annotations.length === 0) {
    throw new Error(`ProblemDraft ${draftId} has no annotations to promote`)
  }

  const givens = annotations
    .filter((a) => a.annotationType === 'given')
    .map((a) => a.annotationText)
  const impliedGivens = annotations
    .filter((a) => a.annotationType === 'implied_given')
    .map((a) => a.annotationText)

  if (givens.length === 0) {
    throw new Error(
      `ProblemDraft ${draftId} has no "given" annotations -- Problem.givens cannot be empty`
    )
  }

  const problem = await prisma.$transaction(async (tx) => {
    const created = await tx.problem.create({
      data: {
        chapterId: draft.chapterId,
        subtopicId: draft.subtopicId,
        rawText: draft.rawText,
        unknownAnnotation: draft.unknownAnnotation!,
        concreteRestatement: draft.concreteRestatement!,
        givens,
        impliedGivens,
        conceptAnchor: draft.conceptAnchor!,
        problemType: draft.problemType!,
        difficultyTier: draft.difficultyTier!,
        contentReviewedBy: reviewedBy,
        contentReviewedAt: new Date(),
      },
    })

    await tx.problemAnnotation.createMany({
      data: annotations.map((a) => ({
        problemId: created.id,
        annotationType: a.annotationType,
        annotationText: a.annotationText,
        hintText: a.hintText,
        sequenceOrder: a.sequenceOrder,
      })),
    })

    await tx.problemDraft.update({
      where: { id: draftId },
      data: { publishedProblemId: created.id },
    })

    return created
  })

  return { problemId: problem.id }
}