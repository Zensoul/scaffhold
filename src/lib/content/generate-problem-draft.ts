import OpenAI from 'openai'
import { prisma } from '@/lib/db/prisma'
import { AiCallType } from '@prisma/client'

const openai = new OpenAI()

const MODEL = 'gpt-4o'
const PROMPT_VERSION = 'annotation-draft-v8'

// Generates a DRAFT annotation set for a real NCERT problem, using your
// existing approved, human-reviewed problems as few-shot examples — per
// the original architecture doc's own recommendation. This function
// produces ONLY a draft (ProblemDraft row) — it can never create a
// live, servable Problem row directly. That structural separation is
// what makes the human-review gate real rather than a policy nobody
// enforces.
//
// v5: after 4 rounds of tuning against real output, the DB-sourced
// few-shot examples turned out to be part of the problem -- the only
// "approved" Polynomials example was itself too textbook-y, and the
// model kept copying its register even when told not to. v5 anchors
// on a HARDCODED, hand-written gold-standard example instead (below),
// so there's always at least one genuinely good example to imitate,
// regardless of what's in the DB yet. DB examples are now used only
// for topic-specific JSON granularity, explicitly marked as
// potentially imperfect.
//
// v6: live grading testing surfaced a structural bug v5 never caught --
// rule (5) told the model to make "unknown" annotations teach a
// STRATEGY ("try splitting -3x into two parts..."), and gradeAnswer()
// compares the student's free-text answer against that exact
// annotationText. A student who correctly answers with the actual
// ANSWER ("the other zero is -1/2") can never match text that only
// ever describes a method, no matter how right they are -- confirmed
// against real AiCall logs (gpt-4o-mini graded a correct "-1/2" as
// incorrect, high confidence, because the correctText it was given was
// a strategy sentence, not a stated answer). v6 splits this explicitly:
// "unknown" annotationText must STATE the actual target answer/value in
// a form gradeable against a student's stated conclusion; the solving
// STRATEGY moves to hintText instead, which was always shown
// separately and was never part of the graded comparison. The
// gold-standard example below is updated to match.
//
// v7: reviewing a v6 draft from a struggling-student's POV surfaced a
// depth gap the grading fix didn't touch -- the "unknown" hintText was
// naming a TECHNIQUE ("try splitting the middle term... then flip
// signs to solve for x") without ever walking through it mechanically.
// A student who does not already know that technique has nowhere to
// go from "flip signs" -- it assumes the exact skill the annotation is
// supposed to be teaching. v7 requires the unknown's hintText to show
// the actual arithmetic/algebra steps in order, the way a patient
// tutor would work it on paper, not just name the method and point at
// two numbers to try. The gold-standard example's unknown hint is
// rewritten to demonstrate this.
//
// v8: batch content-generation tonight surfaced a case v7's grading
// model doesn't fit -- PROOF-type problems (e.g. "prove root 5 is
// irrational"). For a numeric/algebraic problem, "unknown" annotationText
// can state one fixed final value ("the zeros are 5 and -2") and grade
// a student's answer against it directly. A proof has no single final
// value -- its "answer" is a chain of logical steps, so a v7 draft on
// a proof produced an "unknown" annotationText that just SUMMARIZED the
// logic ("both a and b are divisible by 5, so they're not coprime") --
// which is not something a student arrives at as one gradeable
// sentence the way "5 and -2" is. v8 adds rule (5d): for proof-type
// problems, the "unknown" annotation must isolate ONE SPECIFIC
// intermediate fact being established at that step, stated as
// concretely as a numeric answer would be (e.g. "a is divisible by 5"
// or "b must also be divisible by 5"), not a summary of the whole
// argument. If a proof has more than one such pivotal fact, split them
// across multiple sequenced "unknown"-type entries rather than
// compressing them into one summary sentence.
export async function generateProblemDraft(params: {
  chapterId: string
  subtopicId?: string
  rawText: string
}): Promise<{ draftId: string }> {
  const { chapterId, subtopicId, rawText } = params

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } })

  const examples = await prisma.problem.findMany({
    where: { chapterId, isActive: true },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } } },
    take: 2,
  })

  const noExamplesFound = examples.length === 0

  const deletedSubtopics = (chapter?.deletedSubtopics as string[] | null) ?? []
  const deletedTopicsWarning =
    deletedSubtopics.length > 0
      ? `\n\nIMPORTANT: The following subtopics have been REMOVED from the current CBSE syllabus ` +
        `(${chapter?.syllabusYear ?? 'current year'}) and must NEVER appear in this draft, even as a ` +
        `passing reference or an implied concept: ${deletedSubtopics.join(', ')}. If the input problem ` +
        `text relies on any of these, note this clearly rather than drafting a normal annotation set.`
      : ''

  const dbExampleText =
    examples.length > 0
      ? examples
          .map(
            (p, i) => `
DB example ${i + 1} (JSON shape/granularity reference ONLY -- its wording may still be too formal, do not copy the register):
Raw problem: "${p.rawText}"
Unknown: "${p.unknownAnnotation}"
Restatement: "${p.concreteRestatement}"
Concept anchor: "${p.conceptAnchor}"
Annotations:
${p.annotations
  .map((a) => `  - [${a.annotationType}] "${a.annotationText}" — hint: "${a.hintText}"`)
  .join('\n')}
`
          )
          .join('\n---\n')
      : ''

  // Hand-written gold-standard example, always included regardless of
  // what's in the DB. This is the actual voice/vocabulary/depth target.
  const goldStandardExample = `
GOLD-STANDARD EXAMPLE (this is the voice, vocabulary depth, and teaching quality to match every time):

Raw problem: "Find the zeros of the quadratic polynomial x² − 3x − 10 and verify the relationship between the zeros and the coefficients."

{
  "unknownAnnotation": "We need to find the two values of x that make this polynomial equal zero. These values are called the 'zeros' of the polynomial.",
  "concreteRestatement": "This polynomial is x² − 3x − 10. Find two x-values that make it equal 0 when you plug them in. Then check that those two values follow a simple rule based on the polynomial's numbers.",
  "conceptAnchor": "For any quadratic ax² + bx + c: sum of the zeros = -b/a, and product of the zeros = c/a. Here a=1, b=-3, c=-10, so sum should be 3 and product should be -10 -- once you find the zeros, add them and multiply them to check.",
  "problemType": "polynomial_zeros_verification",
  "difficultyTier": 1,
  "annotations": [
    { "annotationType": "given", "annotationText": "See the three numbers in x² − 3x − 10: 1, -3, and -10. In the standard form ax² + bx + c, these are a, b, and c.", "hintText": "Match each number to its letter -- a is with x², b is with x, c is alone.", "sequenceOrder": 1 },
    { "annotationType": "given", "annotationText": "A quadratic like this one usually has exactly two zeros (two x-values that make it 0).", "hintText": "Two answers are expected here, not one.", "sequenceOrder": 2 },
    { "annotationType": "unknown", "annotationText": "The two zeros of x² − 3x − 10 are 5 and -2.", "hintText": "Step 1: we need two numbers that multiply to -10 (that's c) and add to -3 (that's b). Try pairs: -5 and 2 -- check: -5 x 2 = -10 (yes), -5 + 2 = -3 (yes), those are the two numbers. Step 2: rewrite -3x using these two numbers: x^2 - 5x + 2x - 10. Step 3: group and factor: x(x-5) + 2(x-5) = (x-5)(x+2). Step 4: each bracket can be zero, so solve both: x-5=0 gives x=5, and x+2=0 gives x=-2. Those are your two zeros.", "sequenceOrder": 3 },
    { "annotationType": "concept_anchor", "annotationText": "Once you have your two zeros, add them -- you should get 3. Multiply them -- you should get -10. That's the sum = -b/a, product = c/a rule in action.", "hintText": "If your sum or product doesn't match, go back and recheck your factoring.", "sequenceOrder": 4 }
  ]
}

Notice in this gold-standard example: every sentence is short and direct. "a", "b", "c" are explained by matching them to the actual numbers, not assumed as known labels. The concept anchor doesn't just state the formula -- it plugs in the real numbers from THIS problem so the student sees it's not abstract. Critically: the "unknown" annotationText STATES the actual answer (5 and -2) -- a student's correctly-worded final answer must be gradeable against it -- while the SOLVING STRATEGY lives entirely in hintText, written as numbered mechanical STEPS a student can literally follow on paper (Step 1, Step 2, Step 3...), never as a technique named and left unexplained ("try splitting the middle term" with no walkthrough is not acceptable -- show the actual splitting, grouping, and factoring, one step at a time, like the example above). This is the bar every draft must hit.
`

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true
  let parsed: any = null

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You draft a comprehension-decoding annotation set for a CBSE Class 9-10 math/physics problem, ' +
            'for Indian students studying under the CBSE board. ' +
            'The audience is a real, possibly WEAKER student who is confused or intimidated by the problem ' +
            'as written -- not a topper. Write for the student who is struggling, not the average student. ' +
            'Your job is to make the problem genuinely easier to understand and to teach WHY, not just to ' +
            'reword the question. Study the gold-standard example below closely -- it shows exactly the ' +
            'voice, vocabulary level, and teaching depth every draft must match. ' +
            deletedTopicsWarning +
            '\n\n' +
            goldStandardExample +
            '\n\nRules:\n' +
            '(1) Short, direct sentences. First/second person ("we need to...", "find..."), not textbook ' +
            'third person passive voice ("the zeros must be determined").\n' +
            '(2) Do not assume a struggling student remembers standard labels like "a, b, c" or "the ' +
            'coefficient of x" without being told which number is which, THIS problem, concretely -- as ' +
            'the gold-standard example does. Never introduce a term (like "Vieta\'s formulas" -- NCERT ' +
            'calls this "the relationship between zeros and coefficients") the student was not taught.\n' +
            '(3) "concreteRestatement" must genuinely simplify the question into a concrete action the ' +
            'student can start doing, not a reworded version of the original sentence.\n' +
            '(4) "conceptAnchor" must state the rule AND apply it to the actual numbers in THIS problem ' +
            '(like the gold-standard example does: "here a=1, b=-3, c=-10, so..."), not just state the ' +
            'formula in the abstract. Use symbolic shorthand for formulas (-b/a), never a spelled-out run-on ' +
            'sentence version of the same formula -- shorthand is the clearer, more familiar form here.\n' +
            '(5) Every "given" annotation must teach something -- point out WHY a fact matters or how it ' +
            'connects to solving the problem, not just restate a number already visible in the problem text. ' +
            'A given that only repeats the problem adds nothing; rewrite it to explain or connect.\n' +
            '(5b) CRITICAL and different from givens: the "unknown" annotation\'s "annotationText" must ' +
            'STATE THE ACTUAL FINAL ANSWER or target value/expression for this specific problem (e.g. "The ' +
            'other zero is -1/2.", "The two zeros are 5 and -2.") -- never a strategy, a method, or a ' +
            'restatement of the question being asked. This field is compared directly against what the ' +
            'student types in to decide if they got it right, so if it does not contain the actual answer, ' +
            'a student who answers correctly can never be marked correct. The SOLVING STRATEGY (how to get ' +
            'there -- which numbers to try, which rule to apply) belongs entirely in "hintText" instead, ' +
            'never in "annotationText". Compute the real answer yourself from the problem\'s numbers before ' +
            'writing this field -- do not guess or leave it generic.\n' +
            '(5c) CRITICAL for the "unknown" annotation\'s "hintText": write it as an ordered, mechanical ' +
            'walkthrough ("Step 1: ...", "Step 2: ...") that a student who does NOT already know the ' +
            'technique could still follow with pencil and paper -- never name a method and stop ' +
            '("try splitting the middle term", "use the quadratic formula", "cross-multiply") without ' +
            'actually performing it on THIS problem\'s real numbers, step by step, through to the answer. ' +
            'Assume the student is weak on fundamentals: show the arithmetic, not just the name of the rule.\n' +
            '(5d) CRITICAL for PROOF-type problems specifically (e.g. "prove X is irrational", ' +
            '"prove this identity"): there is no single final numeric answer, so the "unknown" ' +
            'annotation must NOT be a summary of the overall logical argument. Instead, isolate ONE ' +
            'specific, concrete intermediate fact being established at that exact step -- stated as ' +
            'plainly and gradeably as a numeric answer would be (e.g. "a is divisible by 5.", not ' +
            '"this shows a and b share a common factor, proving the contradiction"). If proving the ' +
            'result requires establishing more than one such pivotal fact in sequence, create a ' +
            'separate sequenced "unknown" entry for each one rather than compressing them together. ' +
            'A student typing that one specific fact must be able to match this field exactly, the ' +
            'same way a numeric answer would be matched.\n' +
            '(6) Indian classroom voice: plain, encouraging, and direct, the way a CBSE tutor actually talks ' +
            '-- not American idiom, not childish analogies unrelated to the math (no "like a lunchbox"), ' +
            'and not needlessly dumbed-down vocabulary for its own sake. If a real Indian example (rupees, ' +
            'a familiar local scenario) would make a "given" clearer, you may use one, but never force one in.\n' +
            '(7) Be accurate and conservative about the MATH -- do not invent facts not present in the ' +
            'problem text, and never change the actual mathematical content. This is a DRAFT for human ' +
            'review, so precision matters even while the language stays simple.\n' +
            (dbExampleText
              ? 'Also shown below are DB examples from this same chapter for JSON granularity reference only ' +
                '-- their wording may still be too formal, follow the gold-standard voice above instead:\n' +
                dbExampleText
              : '') +
            '\nRespond ONLY with JSON in this shape: ' +
            '{"unknownAnnotation": string, "concreteRestatement": string, "conceptAnchor": string, ' +
            '"problemType": string (a short snake_case category), "difficultyTier": number (1-3), ' +
            '"annotations": [{"annotationType": "given"|"implied_given"|"unknown"|"concept_anchor", ' +
            '"annotationText": string, "hintText": string, "sequenceOrder": number}]}. ' +
            'CRITICAL: every single object in the annotations array, WITHOUT EXCEPTION — including the ' +
            'final concept_anchor entry — must include a numeric sequenceOrder field. Never omit it on ' +
            'any annotation, even the last one. Order annotations easiest-to-hardest: explicit givens ' +
            'first (sequenceOrder 1, 2, 3...), then implied givens, then the unknown, then concept_anchor ' +
            'last, with sequenceOrder continuing to increment for every entry.',
        },
        {
          role: 'user',
          content: `Draft the annotation set for this problem, matching the gold-standard example's voice and depth exactly:\n"${rawText}"`,
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

  // Defensive heuristic, not a hard block: rule (5d) tells the model to
  // split a proof's "unknown" annotations into isolated intermediate
  // facts rather than one compressed summary sentence, but LLM
  // instruction-following on this has observed run-to-run variance --
  // it worked for one proof draft tonight and reverted to a compressed
  // summary on another in the very next batch. Rather than trust the
  // prompt alone, flag any "unknown" annotationText that LOOKS like a
  // compressed multi-step summary (long, and strung together with
  // multiple clause connectors) so a human reviewer is pointed straight
  // at the risky field instead of having to re-derive the same v7/v8
  // grading-mismatch bug from scratch on every proof-type problem.
  const COMPRESSED_SUMMARY_CONNECTORS = [' and ', ' so ', ' which means', ' therefore', ' proving that', ' to get ']
  const suspectUnknownAnnotations = (parsed?.annotations ?? []).filter((a: any) => {
    if (a?.annotationType !== 'unknown' || typeof a.annotationText !== 'string') return false
    const text = a.annotationText as string
    const connectorHits = COMPRESSED_SUMMARY_CONNECTORS.filter((c) => text.toLowerCase().includes(c)).length
    return text.length > 110 && connectorHits >= 2
  })

  const compressedSummaryWarning =
    suspectUnknownAnnotations.length > 0
      ? `POSSIBLE RULE (5d) VIOLATION: ${suspectUnknownAnnotations.length} "unknown" annotation(s) read ` +
        `like a compressed multi-step summary rather than one isolated gradeable fact (long sentence, ` +
        `multiple clause connectors). For proof/explain-type problems this likely means a student's ` +
        `correct step-by-step answer won't match what's graded -- check whether this should be split ` +
        `into multiple sequenced "unknown" entries before approving.`
      : null

  const draft = await prisma.problemDraft.create({
    data: {
      chapterId,
      subtopicId: subtopicId ?? null,
      rawText,
      unknownAnnotation: parsed?.unknownAnnotation ?? null,
      concreteRestatement: parsed?.concreteRestatement ?? null,
      conceptAnchor: parsed?.conceptAnchor ?? null,
      problemType: parsed?.problemType ?? null,
      difficultyTier: parsed?.difficultyTier ?? null,
      annotationsDraft: parsed?.annotations ?? null,
      generatedByLLM: true,
      status: parsed ? 'pending_review' : 'needs_revision',
      reviewNotes: [
        noExamplesFound
          ? 'No approved example problems existed in this chapter yet — drafted from the gold-standard example only. Review extra carefully.'
          : null,
        compressedSummaryWarning,
      ]
        .filter(Boolean)
        .join(' ') || null,
    },
  })

  return { draftId: draft.id }
}
