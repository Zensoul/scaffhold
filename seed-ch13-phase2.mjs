/**
 * seed-ch13-phase2.mjs
 *
 * Guided-solve problems for:
 *   Ch 13 — Surface Areas and Volumes
 *   Phase 2 (BLOCKED — all Volume, after Phase 1 SA block)
 *
 * Gap 2: Renkl scaffold fading
 *   P2-A  hintLevel 2
 *   P2-B  hintLevel 1 (hint1 only)
 *
 * Problems:
 *   VOL-1  Juice glass = cylinder + cone base (Ex 13.2 Q1 style)
 *          Actually: solid in shape of cone surmounted on a hemisphere
 *          r = 3.5 cm, h_cone = 4 cm → Volume = πr²(h/3 + 2/3·r)? No —
 *          Let's use NCERT Ex 13.2 Q1: wooden article = cylinder − cone from each end
 *          Alternatively use Ex 13.2 Q2: solid cylinder with two cones
 *          BETTER: Ex 13.2 Q1 — A solid is in the shape of a cone standing on a
 *          hemisphere, with both their radii being equal to 1 cm and the height of
 *          the cone is equal to its radius. Find the volume.
 *          V = (1/3)πr²h + (2/3)πr³ = (1/3)πr²(h + 2r) = (1/3)π×1×1×(1+2) = π cm³ ≈ 3.14 cm³
 *
 *   VOL-2  Gulab jamun (cylinder + 2 hemispheres) — Ex 13.2 Q5
 *          Each gulab jamun = cylinder (d=5cm, h=?) + 2 hemispheres
 *          Diameter = 5 cm (r=2.5), length = 5 cm (cylinder h = 5−2×2.5 = 0? that's a sphere)
 *          NCERT Ex 13.2 Q5: A gulab jamun contains sugar syrup up to 30% of its volume.
 *          Find approximately how much syrup would be found in 45 gulab jamuns, each shaped
 *          like a cylinder with two hemispherical ends with length 5 cm and diameter 2.8 cm.
 *          r = 1.4 cm, total length = 5 cm → cyl h = 5 − 2×1.4 = 2.2 cm
 *          V_one = πr²h + (4/3)πr³ = πr²(h + 4r/3)
 *                = (22/7) × 1.96 × (2.2 + 4×1.4/3)
 *                = (22/7) × 1.96 × (2.2 + 1.867)
 *          Hmm. NCERT approach:
 *          V = πr²h + (4/3)πr³
 *            = (22/7)×1.4²×2.2 + (4/3)×(22/7)×1.4³
 *            = (22/7)×1.96×2.2 + (4/3)×(22/7)×2.744
 *            = (22/7)×[1.96×2.2 + (4/3)×2.744]
 *            = (22/7)×[4.312 + 3.659]
 *            = (22/7) × 7.971
 *            ≈ 25.05 cm³
 *          Syrup = 30% × 45 × 25.05 ≈ 338.18 cm³
 *          NCERT answer: 338.2 cm³  ✓
 *
 * Run from project root:
 *   node seed-ch13-phase2.mjs
 */

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const CHAPTER_ID   = '57df90d5-b606-4b09-8068-ed3d15760e70'
const SUBTOPIC_ID  = '457cbc6e-07ed-47ac-9eb5-b46c70ef44a7'  // spheres & hemispheres

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

// ── PROBLEM VOL-1: CONE ON HEMISPHERE ─────────────────────────────────────────
// A solid is in the shape of a cone standing on a hemisphere, with both their
// radii being equal to 1 cm and the height of the cone equal to its radius.
// Find the volume of the solid in terms of π. (Ex 13.2 Q1)
// r = 1 cm, h = 1 cm
// V = (1/3)πr²h + (2/3)πr³ = (π/3)(1 + 2) = π cm³

const VOL1_FORMULA_CARD = `Volume of solid = Volume of cone + Volume of hemisphere

  Volume of cone = (1/3)πr²h
  Volume of hemisphere = (2/3)πr³

  Combined: V = (1/3)πr²h + (2/3)πr³ = (πr²/3)(h + 2r)

  Here: r = 1 cm, h = 1 cm (cone height = radius)`

async function seedVOL1() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.2-Q1',
    rawText:            'A solid is in the shape of a cone standing on a hemisphere with both their radii being equal to 1 cm and the height of the cone is equal to its radius. Find the volume of the solid in terms of π.',
    unknownAnnotation:  'total volume of the solid in terms of π',
    concreteRestatement:'Cone (r = 1 cm, h = 1 cm) on hemisphere (r = 1 cm). Find total volume.',
    givens:             { r: '1 cm', coneH: '1 cm' },
    impliedGivens:      ['answer to be left in terms of pi'],
    conceptAnchor:      'V = (1/3)*pi*r^2*h + (2/3)*pi*r^3',
    problemType:        'hemisphere-cone',
    difficultyTier:     2,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('VOL-1 Cone on Hemisphere', problemId, 2, [
    // Step 1 — Concept (MCQ): which formula?
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Set up the volume formula',
      prompt:      'The solid = cone + hemisphere. Both have r = 1 cm, cone height h = 1 cm. Which formula gives the total volume?',
      inputType:   'mcq',
      correctAnswer: 'B',
      hintText:    'Add the two volumes separately. Cone: (1/3)πr²h. Hemisphere: (2/3)πr³.',
      hintText2:   'V = (1/3)πr²h + (2/3)πr³. Factor out (πr²/3): V = (πr²/3)(h + 2r).',
      hintText3:   null,
      errorFeedback: 'V = volume of cone + volume of hemisphere = (1/3)πr²h + (2/3)πr³.',
      formulaCard: VOL1_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: '(1/3)πr²h + (4/3)πr³  (full sphere instead of hemisphere)', correct: false },
        { text: '(1/3)πr²h + (2/3)πr³', correct: true },
        { text: 'πr²h + (2/3)πr³  (full cylinder instead of cone)', correct: false },
        { text: '(1/3)πr²(h + r)  (treating both as a single cone)', correct: false },
      ],
      workedExampleText:   'V = (1/3)πr²h + (2/3)πr³\nThis can be written as (πr²/3)(h + 2r), which is easier to evaluate when r is known.',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Why is the hemisphere volume (2/3)πr³ and not (4/3)πr³?',
      selfExplainAnswer:   '(4/3)πr³ is the volume of a full sphere. A hemisphere is exactly half a sphere, so its volume is (2/3)πr³.',
    },
    // Step 2 — Substitution (MCQ)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Substitute r = 1, h = 1',
      prompt:      'Substituting r = 1 cm and h = 1 cm into V = (1/3)πr²h + (2/3)πr³, which gives the correct simplified form?',
      inputType:   'mcq',
      correctAnswer: 'C',
      hintText:    'r = 1, h = 1: (1/3)π(1)²(1) + (2/3)π(1)³ = π/3 + 2π/3.',
      hintText2:   'π/3 + 2π/3 = 3π/3 = π.',
      hintText3:   null,
      errorFeedback: '(1/3)π×1×1 + (2/3)π×1 = π/3 + 2π/3 = π.',
      formulaCard: VOL1_FORMULA_CARD,
      svgStage:    1,
      unit:        null,
      options: [
        { text: '(1/3)π + (4/3)π = 5π/3', correct: false },
        { text: '(1/3)π + (2/3)π = π/3', correct: false },
        { text: '(1/3)π + (2/3)π = 3π/3 = π', correct: true },
        { text: '(2/3)π + (2/3)π = 4π/3', correct: false },
      ],
      workedExampleText:   'V = (1/3)π(1)²(1) + (2/3)π(1)³\n= π/3 + 2π/3\n= 3π/3\n= π cm³',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'π/3 + 2π/3 = π. Write the same step using a common denominator to make the addition clear.',
      selfExplainAnswer:   'π/3 + 2π/3 = (1+2)π/3 = 3π/3 = π. Both fractions already share denominator 3, so just add the numerators.',
    },
    // Step 3 — Computation: numeric value
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Numerical value',
      prompt:      'V = π cm³. Using π = 22/7, calculate the numerical value in cm³.',
      inputType:   'numeric',
      correctAnswer: '3.14',
      tolerance:   0.02,
      hintText:    'π ≈ 3.14159. Using 22/7: V = 22/7 ≈ 3.14 cm³.',
      hintText2:   '22 ÷ 7 = 3.142857… ≈ 3.14 cm³.',
      hintText3:   null,
      errorFeedback: 'V = π = 22/7 ≈ 3.14 cm³.',
      formulaCard: VOL1_FORMULA_CARD,
      svgStage:    1,
      unit:        'cm³',
      workedExampleText:   'V = π cm³ ≈ 3.14 cm³  (using π ≈ 3.14)\nOr exact: V = 22/7 ≈ 3.143 cm³.',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'The answer in terms of π (V = π cm³) is exact. Why might we prefer leaving it as π rather than converting to 3.14?',
      selfExplainAnswer:   'Leaving it as π is exact — no rounding error. 3.14 is approximate. In problems asking for the answer "in terms of π", we leave it as π to avoid losing precision.',
    },
  ])
}

// ── PROBLEM VOL-2: GULAB JAMUN ────────────────────────────────────────────────
// 45 gulab jamuns, each shaped like cylinder + 2 hemispheres.
// Length = 5 cm, diameter = 2.8 cm → r = 1.4 cm
// Cylindrical h = 5 − 2×1.4 = 2.2 cm
// V_one = πr²h + (4/3)πr³
//       = (22/7)×1.96×2.2 + (4/3)×(22/7)×2.744
//       = (22/7)[1.96×2.2 + (4/3)×2.744]
//       = (22/7)[4.312 + 3.6587]
//       = (22/7) × 7.9707
//       ≈ 25.05 cm³
// Sugar syrup = 30% × 45 × 25.05 = 0.3 × 45 × 25.05 = 338.18 ≈ 338.2 cm³

const VOL2_FORMULA_CARD = `Each gulab jamun = cylinder + 2 hemispheres (= cylinder + 1 full sphere)

  Volume of cylinder = πr²h
  Volume of sphere = (4/3)πr³  [two hemispheres = one sphere]

  V_one = πr²h + (4/3)πr³

  Here:
    r = 1.4 cm, cylindrical h = 5 − 2×1.4 = 2.2 cm

  Sugar syrup = 30% of total volume of 45 pieces
              = 0.30 × 45 × V_one`

async function seedVOL2() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.2-Q5',
    rawText:            'A gulab jamun contains sugar syrup up to about 30% of its volume. Find approximately how much syrup would be found in 45 gulab jamuns, each shaped like a cylinder with two hemispherical ends with length 5 cm and diameter 2.8 cm.',
    unknownAnnotation:  'total volume of sugar syrup in 45 gulab jamuns',
    concreteRestatement:'Each piece: cylinder (r=1.4cm, h=2.2cm) + 2 hemispheres (r=1.4cm). Find 30% × 45 × V_one.',
    givens:             { diameter: '2.8 cm', r: '1.4 cm', totalLength: '5 cm', cylindricalH: '2.2 cm', pieces: 45, syrupPercent: '30%' },
    impliedGivens:      ['two hemispheres = one full sphere'],
    conceptAnchor:      'V = pi*r^2*h + (4/3)*pi*r^3; syrup = 30% x 45 x V',
    problemType:        'cylinder-hemispheres',
    difficultyTier:     3,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('VOL-2 Gulab Jamun', problemId, 1, [
    // Step 1 — Concept (MCQ): volume of one piece
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Volume of one gulab jamun',
      prompt:      'Each gulab jamun = cylinder + 2 hemispheres. r = 1.4 cm, cylinder h = 2.2 cm. Which expression gives the volume of ONE piece?',
      inputType:   'mcq',
      correctAnswer: 'A',
      hintText:    'Two hemispheres = one full sphere. V = πr²h + (4/3)πr³.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'Two hemispheres of radius r together = one full sphere. So V = πr²h (cylinder) + (4/3)πr³ (sphere).',
      formulaCard: VOL2_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'πr²h + (4/3)πr³', correct: true },
        { text: 'πr²h + (2/3)πr³  (only one hemisphere)', correct: false },
        { text: 'πr²h + 2×(2/3)πr³  (written as two separate hemispheres — same value but non-simplified)', correct: false },
        { text: 'πr²h + (4/3)π(2r)³  (wrong radius for sphere)', correct: false },
      ],
      workedExampleText:   'V_one = πr²h + (4/3)πr³\nWith r = 1.4, h = 2.2:\n= (22/7)×1.96×2.2 + (4/3)×(22/7)×2.744\n= (22/7)[4.312 + 3.659]\n= (22/7) × 7.971\n≈ 25.05 cm³',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Two hemispheres were replaced with (4/3)πr³ in the formula. Prove this is correct: write out (2/3)πr³ + (2/3)πr³ and simplify.',
      selfExplainAnswer:   '(2/3)πr³ + (2/3)πr³ = (4/3)πr³. Each hemisphere is (2/3)πr³; two of them sum to (4/3)πr³, which is exactly the full sphere formula.',
    },
    // Step 2 — Substitution (numeric): V_one
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Volume of one piece (numerical)',
      prompt:      'Calculate V_one = (22/7)×1.96×2.2 + (4/3)×(22/7)×2.744. What is the volume of one gulab jamun in cm³?',
      inputType:   'numeric',
      correctAnswer: '25.05',
      tolerance:   0.15,
      hintText:    'Factor out (22/7): = (22/7) × [1.96×2.2 + (4/3)×2.744] = (22/7) × [4.312 + 3.659].',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: '(22/7)[4.312 + 3.659] = (22/7) × 7.971 = 22 × 1.139 ≈ 25.05 cm³.',
      formulaCard: VOL2_FORMULA_CARD,
      svgStage:    1,
      unit:        'cm³',
      workedExampleText:   'V_one = (22/7) × [1.96×2.2 + (4/3)×2.744]\n= (22/7) × [4.312 + 3.659]\n= (22/7) × 7.971\n≈ 25.05 cm³',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'Factoring out (22/7) made the computation cleaner. Explain why that step was valid and helpful.',
      selfExplainAnswer:   'Both terms had (22/7) as a factor — the cylinder term had (22/7)r²h and the sphere term had (4/3)(22/7)r³. Factoring it out meant you only divide by 7 once, reducing arithmetic error.',
    },
    // Step 3 — Computation (numeric): total syrup
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Total syrup for 45 pieces',
      prompt:      'V_one ≈ 25.05 cm³. Sugar syrup = 30% of volume. Find the total syrup volume in 45 gulab jamuns in cm³.',
      inputType:   'numeric',
      correctAnswer: '338.2',
      tolerance:   1.0,
      hintText:    'Syrup = 0.30 × 45 × 25.05.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: '0.30 × 45 = 13.5. Then 13.5 × 25.05 ≈ 338.2 cm³.',
      formulaCard: VOL2_FORMULA_CARD,
      svgStage:    1,
      unit:        'cm³',
      workedExampleText:   'Syrup = 30% × 45 × 25.05\n= 0.30 × 45 × 25.05\n= 13.5 × 25.05\n≈ 338.2 cm³',
      workedExampleSvgStage: 1,
      selfExplainPrompt:   'Walk through why the answer is 338 cm³ and not something like 3.38 or 3380. What does each multiplication step represent physically?',
      selfExplainAnswer:   '25.05 cm³ is volume of one piece. ×45 gives total volume of all pieces = 1127.25 cm³. ×0.30 extracts 30% of that total as syrup = 338.2 cm³.',
    },
  ])
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Ch 13 Phase 2: Volume block ──\n')
  await seedVOL1()
  await seedVOL2()
  console.log('\n✅ Phase 2 complete.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => p.$disconnect())
