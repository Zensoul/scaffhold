import OpenAI from 'openai'
import { prisma } from '@/lib/db/prisma'
import { AiCallType } from '@prisma/client'

const openai = new OpenAI()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'annotation-draft-v1'

// Generates a DRAFT annotation set for a real NCERT problem, using your
// existing approved, human-reviewed problems as few-shot examples — per
// the original architecture doc's own recommendation. This function
// produces ONLY a draft (ProblemDraft row) — it can never create a
// live, servable Problem row directly. That structural separation is
// what makes the human-review gate real rather than a policy nobody
// enforces.
export async function generateProblemDraft(params: {
  chapterId: string
  rawText: string
}): Promise<{ draftId: string }> {
  const { chapterId, rawText } = params

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } })

  const examples = await prisma.problem.findMany({
    where: { chapterId, isActive: true },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } } },
    take: 3,
  })

  const deletedSubtopics = (chapter?.deletedSubtopics as string[] | null) ?? []
  const deletedTopicsWarning =
    deletedSubtopics.length > 0
      ? `\n\nIMPORTANT: The following subtopics have been REMOVED from the current CBSE syllabus ` +
        `(${chapter?.syllabusYear ?? 'current year'}) and must NEVER appear in this draft, even as a ` +
        `passing reference or an implied concept: ${deletedSubtopics.join(', ')}. If the input problem ` +
        `text relies on any of these, note this clearly rather than drafting a normal annotation set.`
      : ''

  const exampleText = examples
    .map(
      (p, i) => `
Example ${i + 1}:
Raw problem: "${p.rawText}"
Unknown (what's being asked): "${p.unknownAnnotation}"
Plain-language restatement: "${p.concreteRestatement}"
Concept anchor: "${p.conceptAnchor}"
Problem type: "${p.problemType}"
Annotations (in fade order, easiest first):
${p.annotations
  .map((a) => `  - [${a.annotationType}] "${a.annotationText}" — hint: "${a.hintText}"`)
  .join('\n')}
`
    )
    .join('\n---\n')

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true
  let parsed: any = null

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You draft a comprehension-decoding annotation set for a CBSE Class 9-10 math/physics problem, ' +
            'matching the exact style, granularity, and structure of the examples given. ' +
            'This is a DRAFT for human review — be accurate and conservative, not creative. ' +
            'Do not invent facts not present in the problem text. ' +
            'Respond ONLY with JSON in this shape: ' +
            '{"unknownAnnotation": string, "concreteRestatement": string, "conceptAnchor": string, ' +
            '"problemType": string (a short snake_case category), "difficultyTier": number (1-3), ' +
            '"annotations": [{"annotationType": "given"|"implied_given"|"unknown"|"concept_anchor", ' +
            '"annotationText": string, "hintText": string, "sequenceOrder": number}]}. ' +
            'CRITICAL: every single object in the annotations array, WITHOUT EXCEPTION — including the ' +
            'final concept_anchor entry — must include a numeric sequenceOrder field. Never omit it on ' +
            'any annotation, even the last one. Order annotations easiest-to-hardest: explicit givens ' +
            'first (sequenceOrder 1, 2, 3...), then implied givens, then the unknown, then concept_anchor ' +
            'last, with sequenceOrder continuing to increment for every entry.' +
            deletedTopicsWarning,
        },
        {
          role: 'user',
          content:
            `Here are ${examples.length} approved examples from this same chapter, showing the exact style to match:\n\n` +
            `${exampleText}\n\n---\n\n` +
            `Now draft the same structure for this new problem:\n"${rawText}"`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (responseText) {
      parsed = JSON.parse(responseText)

      // Defensive check, not just a prompt instruction: if the LLM
      // omits sequenceOrder on any annotation (as it did during initial
      // testing tonight, on the last entry), fill it in based on array
      // position rather than silently letting a malformed draft through.
      // This still requires human review before publication — it just
      // means the reviewer sees a structurally complete draft, not one
      // missing a field that would break fade ordering downstream.
      if (Array.isArray(parsed?.annotations)) {
        parsed.annotations = parsed.annotations.map((a: any, index: number) => ({
          ...a,
          sequenceOrder: typeof a.sequenceOrder === 'number' ? a.sequenceOrder : index + 1,
        }))
      }
    }
  } catch (err) {
    console.error('generateProblemDraft LLM call failed:', err)
    wasUsed = false
  }

  const latencyMs = Date.now() - startedAt

  await prisma.aiCall.create({
    data: {
      callType: AiCallType.annotation_draft,
      studentId: null,
      problemId: null,
      modelUsed: MODEL,
      promptVersion: PROMPT_VERSION,
      inputTokens,
      outputTokens,
      latencyMs,
      responseText,
      wasUsed: wasUsed && parsed !== null,
    },
  })

  const draft = await prisma.problemDraft.create({
    data: {
      chapterId,
      rawText,
      unknownAnnotation: parsed?.unknownAnnotation ?? null,
      concreteRestatement: parsed?.concreteRestatement ?? null,
      conceptAnchor: parsed?.conceptAnchor ?? null,
      problemType: parsed?.problemType ?? null,
      difficultyTier: parsed?.difficultyTier ?? null,
      annotationsDraft: parsed?.annotations ?? null,
      generatedByLLM: true,
      status: parsed ? 'pending_review' : 'needs_revision',
    },
  })

  return { draftId: draft.id }
}