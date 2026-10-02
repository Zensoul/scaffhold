/**
 * seed-ch13-phase1.mjs
 *
 * Guided-solve problems for:
 *   Ch 13 — Surface Areas and Volumes
 *   Phase 1 (BLOCKED — all Surface Area, then move to Phase 2 Volume)
 *
 * Gap 2: Renkl scaffold fading — hintLevel decreases across phase
 *   P1-A  hintLevel 3 (full scaffold)
 *   P1-B  hintLevel 2 (no hint3)
 *   P1-C  hintLevel 2 (no hint3)
 *
 * Problems:
 *   SA-1  Medicine capsule (cylinder + 2 hemispheres) — Ex 13.1 Q6
 *   SA-2  Decorative block (cube + hemisphere on top)  — Ex 13.1 Q2
 *   SA-3  Toy (cone + hemisphere)                      — Ex 13.1 Q3 (like)
 *
 * Subtopic: "Combinations involving spheres and hemispheres"
 *
 * Run from project root:
 *   node seed-ch13-phase1.mjs
 */

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const CHAPTER_ID   = '57df90d5-b606-4b09-8068-ed3d15760e70'
const SUBTOPIC_ID  = '457cbc6e-07ed-47ac-9eb5-b46c70ef44a7'  // spheres & hemispheres

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function getOrCreateProblem(data) {
  const existing = await p.problem.findFirst({ where: { sourceReference: data.sourceReference } })
  if (existing) {
    console.log(`  ⏭  Problem exists: ${data.sourceReference}  (${existing.id})`)
    return existing.id
  }
  const created = await p.problem.create({ data })
  console.log(`  ✅ Created problem: ${data.sourceReference}  (${created.id})`)
  return created.id
}

async function seedGuidedProblem(label, problemId, hintLevel, steps) {
  const existing = await p.guidedSolveProblem.findUnique({ where: { problemId } })
  if (existing) {
    console.log(`  ⏭  Already seeded: ${label} (${problemId})`)
    return
  }
  await p.guidedSolveProblem.create({
    data: {
      problemId,
      hintLevel,
      steps: {
        create: steps.map((step, i) => ({
          sequenceOrder:         i + 1,
          stepType:              step.stepType,
          stepLabel:             step.stepLabel,
          prompt:                step.prompt,
          inputType:             step.inputType,
          correctAnswer:         step.correctAnswer,
          tolerance:             step.tolerance ?? null,
          hintText:              step.hintText,
          hintText2:             step.hintText2 ?? null,
          hintText3:             step.hintText3 ?? null,
          errorFeedback:         step.errorFeedback,
          formulaCard:           step.formulaCard ?? null,
          svgStage:              step.svgStage,
          unit:                  step.unit ?? null,
          workedExampleText:     step.workedExampleText ?? null,
          workedExampleSvgStage: step.workedExampleSvgStage ?? null,
          selfExplainPrompt:     step.selfExplainPrompt ?? null,
          selfExplainAnswer:     step.selfExplainAnswer ?? null,
          followUpPrompt:        step.followUpPrompt ?? null,
          followUpAnswer:        step.followUpAnswer ?? null,
          followUpInputType:     step.followUpInputType ?? null,
          followUpTolerance:     step.followUpTolerance ?? null,
          prerequisiteSkill:        step.prerequisiteSkill ?? null,
          prerequisiteExplanation:  step.prerequisiteExplanation ?? null,
          prerequisiteExample:      step.prerequisiteExample ?? null,
          prerequisiteCheckPrompt:  step.prerequisiteCheckPrompt ?? null,
          prerequisiteCheckAnswer:  step.prerequisiteCheckAnswer ?? null,
          prerequisiteCheckTolerance: step.prerequisiteCheckTolerance ?? null,
          options: step.options
            ? { create: step.options.map((o, oi) => ({ optionText: o.text, isCorrect: o.correct, orderIndex: oi })) }
            : undefined,
        })),
      },
    },
  })
  console.log(`  ✅ Seeded ${steps.length} steps: ${label}  (hintLevel ${hintLevel})`)
}

// ── PROBLEM SA-1: MEDICINE CAPSULE ────────────────────────────────────────────
// A medicine capsule is in the shape of a cylinder with two hemispheres stuck to
// each of its ends. Diameter = 5 mm, length of cylindrical part = 14 mm.
// Find total SA. (Ex 13.1 Q6)
// r = 2.5 mm, h_cyl = 14 mm
// TSA = 2πrh + 2 × 2πr² = 2πr(h + 2r) = 2π × 2.5 × (14 + 5) = 2π × 2.5 × 19
//     = 2 × (22/7) × 2.5 × 19 = 298.57... ≈ 298.57 mm²  (exact: 2200/7 ≈ 314.28? let's compute)
// 2 × (22/7) × 2.5 × 19 = (44/7) × 47.5 = 2090/7 = 298.571... mm²
// NCERT answer: 220 mm²  — let's verify:
// TSA = curved SA of cylinder + 2 × curved SA of hemisphere
//     = 2πrh + 2 × 2πr²  = 2πr(h + 2r)
// h = 14 mm (cylindrical part only), r = 2.5 mm
// = 2 × (22/7) × 2.5 × (14 + 2×2.5)
// = 2 × (22/7) × 2.5 × 19
// = (44/7) × 47.5  = 2090/7 ≈ 298.57 mm²
// NCERT gives 220 mm² — check: 2 × (22/7) × 2.5 × 14 = 220. That's only cylinder curved SA.
// Re-check NCERT Ex 13.1 Q6: diameter 5mm, length of ENTIRE capsule = 14mm
// So cylindrical part h = 14 − 2×2.5 = 14 − 5 = 9 mm
// TSA = 2πrh + 2 × 2πr² = 2πr(h + 2r) = 2 × (22/7) × 2.5 × (9 + 5)
//     = 2 × (22/7) × 2.5 × 14 = 2 × (22/7) × 35 = 220 mm²  ✓

const SA1_FORMULA_CARD = `TSA of capsule = Curved SA of cylinder + 2 × Curved SA of hemisphere

  Curved SA of cylinder = 2πrh
  Curved SA of hemisphere = 2πr²

  Combined: TSA = 2πrh + 4πr² = 2πr(h + 2r)

  Here:
    r = 2.5 mm (half of diameter 5 mm)
    Total length = 14 mm → cylindrical part h = 14 − 2r = 14 − 5 = 9 mm`

async function seedSA1() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.1-Q6',
    rawText:            'A medicine capsule is in the shape of a cylinder with two hemispheres stuck to each of its ends. The length of the entire capsule is 14 mm and the diameter of the capsule is 5 mm. Find its surface area.',
    unknownAnnotation:  'total surface area of the capsule',
    concreteRestatement:'The capsule = cylinder (h = 9 mm, r = 2.5 mm) + two hemispheres (r = 2.5 mm). Find total SA.',
    givens:             { totalLength: '14 mm', diameter: '5 mm', r: '2.5 mm', cylindricalH: '9 mm' },
    impliedGivens:      ['hemispheres cap the cylinder — no flat circular ends exposed'],
    conceptAnchor:      'TSA of capsule = 2πr(h + 2r)',
    problemType:        'cylinder-hemispheres',
    difficultyTier:     2,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('SA-1 Medicine Capsule', problemId, 3, [
    // Step 1 — Concept (MCQ): which surfaces contribute to TSA?
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Identify the surfaces',
      prompt:      'The capsule has a cylinder in the middle and a hemisphere on each end. Which surfaces together make up the total surface area?',
      inputType:   'mcq',
      correctAnswer: 'B',
      hintText:    'Think about what you can actually see on the outside — the flat circular ends of the cylinder are hidden inside the hemispheres.',
      hintText2:   'The hemispheres sit flush with the cylinder ends, so the circular faces (πr²) are NOT exposed.',
      hintText3:   'TSA = curved SA of cylinder + curved SA of both hemispheres. No flat circles.',
      errorFeedback: 'The flat circular ends of the cylinder are sealed by the hemispheres — they don\'t contribute to the outer surface.',
      formulaCard: SA1_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'Curved SA of cylinder + 2 flat circles (πr² each) + 2 curved hemispheres', correct: false },
        { text: 'Curved SA of cylinder + 2 curved hemispheres (no flat circles)', correct: true },
        { text: 'Total SA of cylinder (including two circles) + 2 curved hemispheres', correct: false },
        { text: 'Only the curved SA of cylinder — hemispheres are internal', correct: false },
      ],
      workedExampleText:   'The hemispheres cap the cylinder. Their flat base covers the cylinder\'s circular end — that circle is sandwiched between them. So the outer surface = curved cylinder + 2 hemisphere curved surfaces. No flat discs.',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'In your own words: why do we NOT include the flat circular ends (πr² each) in the total surface area of this capsule?',
      selfExplainAnswer:   'Because the hemispheres are stuck to the ends — the flat circles are hidden inside the joint and not part of the outer surface.',
    },
    // Step 2 — Substitution (MCQ): plug r and h into TSA = 2πr(h + 2r)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Substitute values',
      prompt:      'Given r = 2.5 mm and h = 9 mm (cylindrical part), which expression correctly substitutes into TSA = 2πr(h + 2r)?',
      inputType:   'mcq',
      correctAnswer: 'C',
      hintText:    'h is the length of the cylindrical part only: total length − 2r = 14 − 5 = 9 mm.',
      hintText2:   'TSA = 2π × r × (h + 2r). Plug in r = 2.5, h = 9 → (h + 2r) = 9 + 5 = 14.',
      hintText3:   'TSA = 2 × (22/7) × 2.5 × (9 + 5) = 2 × (22/7) × 2.5 × 14.',
      errorFeedback: 'Check: h is the cylindrical part only (9 mm, not 14 mm). Also (h + 2r) = 9 + 5 = 14.',
      formulaCard: SA1_FORMULA_CARD,
      svgStage:    1,
      unit:        null,
      options: [
        { text: '2 × (22/7) × 2.5 × (14 + 5)', correct: false },
        { text: '2 × (22/7) × 2.5 × (14 + 2.5)', correct: false },
        { text: '2 × (22/7) × 2.5 × (9 + 5)', correct: true },
        { text: '2 × (22/7) × 5 × (9 + 5)', correct: false },
      ],
      workedExampleText:   'r = 2.5 mm. Cylindrical h = total length − 2r = 14 − 5 = 9 mm.\nTSA = 2πr(h + 2r) = 2 × (22/7) × 2.5 × (9 + 5) = 2 × (22/7) × 2.5 × 14.',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'Why is h = 9 mm and not 14 mm when substituting into the cylinder formula?',
      selfExplainAnswer:   'Because 14 mm is the total capsule length. The two hemispheres each take up r = 2.5 mm from each end, so the cylinder\'s own length is 14 − 2×2.5 = 9 mm.',
    },
    // Step 3 — Computation (numeric): calculate 2 × (22/7) × 2.5 × 14
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Calculate',
      prompt:      'Calculate: 2 × (22/7) × 2.5 × 14. What is the total surface area in mm²?',
      inputType:   'numeric',
      correctAnswer: '220',
      tolerance:   0.5,
      hintText:    'Work left to right: 2 × (22/7) = 44/7. Then 44/7 × 2.5 = 110/7. Then 110/7 × 14 = 1540/7 = 220.',
      hintText2:   '44/7 × 2.5 = 44 × 2.5 / 7 = 110/7. Then 110/7 × 14 = 110 × 2 = 220.',
      hintText3:   'Answer: 220 mm².',
      errorFeedback: 'Try: 44/7 × 35 = 44 × 5 = 220. (2.5 × 14 = 35)',
      formulaCard: SA1_FORMULA_CARD,
      svgStage:    1,
      unit:        'mm²',
      workedExampleText:   'TSA = 2 × (22/7) × 2.5 × 14\n= (44/7) × 35\n= 44 × 5\n= 220 mm²',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'The key simplification was 2.5 × 14 = 35, which cancelled the 7 in the denominator. Explain how that made the arithmetic clean.',
      selfExplainAnswer:   '35 ÷ 7 = 5, so (44/7) × 35 = 44 × 5 = 220. The 7 cancels because 35 = 5 × 7.',
    },
  ])
}

// ── PROBLEM SA-2: DECORATIVE BLOCK ───────────────────────────────────────────
// A decorative block is made of two solids: a cube and a hemisphere.
// The base of the block is a cube with edge 5 cm. The hemisphere fixed on top
// has diameter 4.2 cm. Find the total surface area of the block.
// (Ex 13.1 Q2)
// TSA = 6a² − πr² + 2πr²  = 6a² + πr²
// a = 5, r = 2.1
// = 6×25 + (22/7)×2.1² = 150 + (22/7)×4.41 = 150 + 13.86 = 163.86 cm²
// NCERT: 163.86 cm²  ✓

const SA2_FORMULA_CARD = `TSA of decorative block = TSA of cube − base circle of hemisphere + curved SA of hemisphere

  TSA of cube = 6a²
  Curved SA of hemisphere = 2πr²
  The flat circular base of the hemisphere (πr²) replaces that patch on the cube's top face.

  Combined: TSA = 6a² − πr² + 2πr² = 6a² + πr²

  Here: a = 5 cm, r = 2.1 cm (half of 4.2 cm)`

async function seedSA2() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.1-Q2',
    rawText:            'A decorative block which is made of two solids — a cube and a hemisphere. The base of the block is a cube with side 5 cm, and the hemisphere fixed on the top has a diameter of 4.2 cm. Find the total surface area of the block.',
    unknownAnnotation:  'total surface area of the decorative block',
    concreteRestatement:'Cube (a = 5 cm) with a hemisphere (r = 2.1 cm) on top. The hemisphere\'s base circle is set into the cube\'s top face. Find TSA.',
    givens:             { cubeSide: '5 cm', hemisphereDiameter: '4.2 cm', r: '2.1 cm' },
    impliedGivens:      ['hemisphere base circle hidden inside cube top face'],
    conceptAnchor:      'TSA = 6a^2 + pi*r^2',
    problemType:        'cube-hemisphere',
    difficultyTier:     2,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('SA-2 Decorative Block', problemId, 2, [
    // Step 1 — Concept (MCQ)
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Identify the surfaces',
      prompt:      'The block = cube + hemisphere on top. The hemisphere\'s flat base sits inside the cube\'s top face. Which expression gives the total exposed surface area?',
      inputType:   'mcq',
      correctAnswer: 'C',
      hintText:    'The hemisphere covers a circular patch (πr²) on the cube\'s top. That patch is hidden. And the hemisphere\'s own flat base is also hidden. But the hemisphere\'s curved surface (2πr²) is exposed.',
      hintText2:   'Adjust: 6a² (full cube) − πr² (hidden patch on cube top) + 2πr² (curved hemisphere) = 6a² + πr².',
      hintText3:   null,
      errorFeedback: 'Key adjustment: subtract the hidden circular patch from the cube\'s top face, then add the hemisphere\'s curved surface.',
      formulaCard: SA2_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: '6a² + 2πr² (full cube plus full hemisphere curved SA)', correct: false },
        { text: '6a² − 2πr² + 2πr² (subtract and add hemisphere curved SA, net = 6a²)', correct: false },
        { text: '6a² − πr² + 2πr²  = 6a² + πr²', correct: true },
        { text: '5a² + πr² (remove one cube face entirely)', correct: false },
      ],
      workedExampleText:   'Full cube TSA = 6a². The hemisphere covers a circular patch (πr²) on the top face — that\'s not exposed. The hemisphere\'s curved surface (2πr²) is exposed.\nTSA = 6a² − πr² + 2πr² = 6a² + πr².',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Why do we subtract πr² from the cube\'s TSA before adding the hemisphere?',
      selfExplainAnswer:   'Because the hemisphere sits on the cube\'s top face. The circular patch it covers (πr²) is hidden — it\'s no longer part of the outer surface. So we subtract it from the cube\'s 6a².',
    },
    // Step 2 — Substitution (MCQ)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Substitute values',
      prompt:      'a = 5 cm, r = 2.1 cm. Which substitution into TSA = 6a² + πr² is correct?',
      inputType:   'mcq',
      correctAnswer: 'B',
      hintText:    'r = 4.2 ÷ 2 = 2.1 cm. Substitute: 6 × 5² + (22/7) × 2.1².',
      hintText2:   '6 × 25 + (22/7) × 4.41.',
      hintText3:   null,
      errorFeedback: 'r = 2.1 cm (half of diameter 4.2 cm). TSA = 6 × 5² + (22/7) × 2.1².',
      formulaCard: SA2_FORMULA_CARD,
      svgStage:    1,
      unit:        null,
      options: [
        { text: '6 × 5² + (22/7) × 4.2²', correct: false },
        { text: '6 × 5² + (22/7) × 2.1²', correct: true },
        { text: '6 × 5² − (22/7) × 2.1²', correct: false },
        { text: '5 × 5² + (22/7) × 2.1²', correct: false },
      ],
      workedExampleText:   'a = 5 cm, r = 2.1 cm.\nTSA = 6 × 25 + (22/7) × 4.41\n= 150 + (22/7) × 4.41.',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'Where does the 2.1² = 4.41 come from in the substitution?',
      selfExplainAnswer:   '2.1² = 2.1 × 2.1 = 4.41. This is r², the radius squared, which appears in the hemisphere curved SA formula 2πr².',
    },
    // Step 3 — Computation (numeric)
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Calculate',
      prompt:      'Calculate: 6 × 25 + (22/7) × 4.41. What is the total surface area in cm²?',
      inputType:   'numeric',
      correctAnswer: '163.86',
      tolerance:   0.1,
      hintText:    '(22/7) × 4.41: note 4.41 = 441/100. So (22 × 441) / (7 × 100) = (22 × 63) / 100 = 1386/100 = 13.86.',
      hintText2:   '150 + 13.86 = 163.86 cm².',
      hintText3:   null,
      errorFeedback: '6 × 25 = 150. Then (22/7) × 4.41 = 13.86. Sum = 163.86.',
      formulaCard: SA2_FORMULA_CARD,
      svgStage:    1,
      unit:        'cm²',
      workedExampleText:   'TSA = 6 × 25 + (22/7) × 4.41\n= 150 + (22 × 63)/100\n= 150 + 1386/100\n= 150 + 13.86\n= 163.86 cm²',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'How does 4.41 simplify nicely with 22/7? Trace the arithmetic step by step.',
      selfExplainAnswer:   '4.41 = 441/100. 441 ÷ 7 = 63. So (22/7) × (441/100) = 22 × 63 / 100 = 1386/100 = 13.86.',
    },
  ])
}

// ── PROBLEM SA-3: TOY (CONE + HEMISPHERE) ─────────────────────────────────────
// A toy is in the form of a cone of radius 3.5 cm mounted on a hemisphere of
// same radius. The total height of the toy is 15.5 cm. Find the total SA.
// (Ex 13.1 Q3)
// r = 3.5 cm, total h = 15.5 cm → cone height h_cone = 15.5 − 3.5 = 12 cm
// slant l = √(r² + h²) = √(12.25 + 144) = √156.25 = 12.5 cm
// TSA = πrl + 2πr² = πr(l + 2r) = (22/7) × 3.5 × (12.5 + 7)
//     = (22/7) × 3.5 × 19.5 = 11 × 19.5 = 214.5 cm²

const SA3_FORMULA_CARD = `TSA of toy = Curved SA of cone + Curved SA of hemisphere

  Curved SA of cone = πrl  where l = slant height = √(r² + h²)
  Curved SA of hemisphere = 2πr²

  Combined: TSA = πrl + 2πr² = πr(l + 2r)

  Here:
    r = 3.5 cm
    Total height = 15.5 cm → cone height h = 15.5 − 3.5 = 12 cm
    Slant l = √(3.5² + 12²) = √(12.25 + 144) = √156.25 = 12.5 cm`

async function seedSA3() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.1-Q3',
    rawText:            'A toy is in the form of a cone of radius 3.5 cm mounted on a hemisphere of same radius. The total height of the toy is 15.5 cm. Find the total surface area of the toy.',
    unknownAnnotation:  'total surface area of the toy',
    concreteRestatement:'Cone (r = 3.5 cm, h = 12 cm, l = 12.5 cm) on top of hemisphere (r = 3.5 cm). Find TSA.',
    givens:             { r: '3.5 cm', totalHeight: '15.5 cm', coneH: '12 cm', slantL: '12.5 cm' },
    impliedGivens:      ['cone height = total height minus r'],
    conceptAnchor:      'TSA = pi*r*(l + 2r), l = sqrt(r^2 + h^2)',
    problemType:        'hemisphere-cone',
    difficultyTier:     3,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('SA-3 Toy Cone+Hemisphere', problemId, 2, [
    // Step 1 — Concept: find slant height (MCQ)
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Find the slant height',
      prompt:      'The cone\'s total height is needed before finding TSA. The toy is 15.5 cm tall and r = 3.5 cm. Which is the correct slant height l?',
      inputType:   'mcq',
      correctAnswer: 'D',
      hintText:    'Cone height = total height − radius of hemisphere = 15.5 − 3.5 = 12 cm. Then l = √(r² + h²).',
      hintText2:   'l = √(3.5² + 12²) = √(12.25 + 144) = √156.25.',
      hintText3:   null,
      errorFeedback: 'h_cone = 15.5 − 3.5 = 12 cm (hemisphere takes up r = 3.5 cm of total height). l = √(12.25 + 144) = √156.25 = 12.5 cm.',
      formulaCard: SA3_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'l = √(3.5² + 15.5²) = √(12.25 + 240.25) = √252.5 ≈ 15.9 cm', correct: false },
        { text: 'l = √(3.5² + 12²) = √(12.25 + 144) = √156.25 = 12.25 cm', correct: false },
        { text: 'l = √(3.5² + 15.5²) = √252.5 ≈ 15.9 cm', correct: false },
        { text: 'l = √(3.5² + 12²) = √156.25 = 12.5 cm', correct: true },
      ],
      workedExampleText:   'Cone height h = 15.5 − 3.5 = 12 cm (the hemisphere\'s radius takes up the bottom 3.5 cm).\nl = √(r² + h²) = √(12.25 + 144) = √156.25 = 12.5 cm.',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Why is the cone\'s height 12 cm and not 15.5 cm when calculating the slant?',
      selfExplainAnswer:   'The total toy height is 15.5 cm, but the hemisphere occupies the bottom 3.5 cm (its radius). The cone only accounts for 15.5 − 3.5 = 12 cm.',
    },
    // Step 2 — Substitution (MCQ)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Substitute into TSA formula',
      prompt:      'r = 3.5 cm, l = 12.5 cm. Which substitution into TSA = πr(l + 2r) is correct?',
      inputType:   'mcq',
      correctAnswer: 'A',
      hintText:    'TSA = πr(l + 2r). l + 2r = 12.5 + 7 = 19.5.',
      hintText2:   'TSA = (22/7) × 3.5 × 19.5.',
      hintText3:   null,
      errorFeedback: 'TSA = πr(l + 2r) = (22/7) × 3.5 × (12.5 + 2×3.5) = (22/7) × 3.5 × 19.5.',
      formulaCard: SA3_FORMULA_CARD,
      svgStage:    1,
      unit:        null,
      options: [
        { text: '(22/7) × 3.5 × (12.5 + 7)', correct: true },
        { text: '(22/7) × 3.5 × (12.5 + 3.5)', correct: false },
        { text: '(22/7) × 3.5 × (15.5 + 7)', correct: false },
        { text: '(22/7) × 7 × (12.5 + 7)', correct: false },
      ],
      workedExampleText:   'TSA = πr(l + 2r)\n= (22/7) × 3.5 × (12.5 + 2×3.5)\n= (22/7) × 3.5 × 19.5.',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'In TSA = πr(l + 2r), where does the "2r" come from?',
      selfExplainAnswer:   'The curved SA of a hemisphere is 2πr². When you factor out πr, you get πr(2r) = 2πr². So the "2r" is the hemisphere\'s curved surface contribution after factoring.',
    },
    // Step 3 — Computation (numeric)
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Calculate',
      prompt:      'Calculate: (22/7) × 3.5 × 19.5. What is the total surface area in cm²?',
      inputType:   'numeric',
      correctAnswer: '214.5',
      tolerance:   0.5,
      hintText:    '(22/7) × 3.5 = 22 × 0.5 = 11. Then 11 × 19.5 = 214.5.',
      hintText2:   '3.5 ÷ 7 = 0.5, so (22/7) × 3.5 = 22 × 0.5 = 11. Then 11 × 19.5 = 214.5.',
      hintText3:   null,
      errorFeedback: '(22/7) × 3.5 simplifies to 11 (since 3.5/7 = 0.5). Then 11 × 19.5 = 214.5.',
      formulaCard: SA3_FORMULA_CARD,
      svgStage:    1,
      unit:        'cm²',
      workedExampleText:   'TSA = (22/7) × 3.5 × 19.5\n= 11 × 19.5       [since (22/7) × 3.5 = 22 × 0.5 = 11]\n= 214.5 cm²',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'The computation became 11 × 19.5. How did (22/7) × 3.5 simplify to 11?',
      selfExplainAnswer:   '3.5 = 7/2, so (22/7) × (7/2) = 22/2 = 11. The 7s cancel.',
    },
  ])
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Ch 13 Phase 1: Surface Area block ──\n')
  await seedSA1()
  await seedSA2()
  await seedSA3()
  console.log('\n✅ Phase 1 complete.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => p.$disconnect())
