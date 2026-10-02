/**
 * seed-ch13-phase3.mjs
 *
 * Guided-solve problems for:
 *   Ch 13 — Surface Areas and Volumes
 *   Phase 3 (BLOCKED — all Conversion / reshaping)
 *
 * Gap 2: Renkl scaffold fading
 *   P3-A  hintLevel 1 (hint1 only)
 *   P3-B  hintLevel 1
 *
 * Problems:
 *   CON-1  Cone melted → sphere  (Ex 13.3 Q1)
 *          Cone: r=1cm, h=2cm → V = (1/3)π×1×2 = 2π/3 cm³
 *          Sphere: (4/3)πR³ = 2π/3 → R³ = 1/2 → R = (1/2)^(1/3) cm
 *          NCERT answer: R = ∛(1/2) cm
 *          Actually NCERT Ex 13.3 Q1: A metallic sphere of radius 4.2 cm is melted
 *          and recast into the shape of a cylinder of radius 6 cm. Find the height.
 *          V_sphere = (4/3)π×4.2³ = (4/3)π×74.088 = 98.784π
 *          V_cyl = π×36×h → h = 98.784/36 = 2.744 cm ≈ 2.74 cm
 *          NCERT: h = 2.74 cm  ✓
 *
 *   CON-2  Well dug, earth spread as embankment — Ex 13.3 Q4
 *          Well: d=3m, h=14m → V_well = π×1.5²×14 = 31.5π m³
 *          Embankment: outer radius = 1.5+4 = 5.5m? No.
 *          NCERT: A well 3m in diameter is dug 14m deep. Earth is spread evenly to
 *          form an embankment 4m wide around the well. Find height of embankment.
 *          V_earth = π×1.5²×14 = π×2.25×14 = 31.5π m³
 *          Embankment: hollow cylinder. inner r = 1.5m, outer r = 1.5+4 = 5.5m, height h_e
 *          V_emb = π(R²−r²)h_e = π(5.5²−1.5²)h_e = π(30.25−2.25)h_e = 28πh_e
 *          31.5π = 28πh_e → h_e = 31.5/28 = 1.125 m ≈ 1.125 m
 *          NCERT answer: h = 1.125 m  ✓
 *
 * Run from project root:
 *   node seed-ch13-phase3.mjs
 */

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const CHAPTER_ID   = '57df90d5-b606-4b09-8068-ed3d15760e70'
const SUBTOPIC_ID  = 'a1964d97-76ce-43f1-821d-f0a4ffca8006'  // cylinders & cones

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

// ── PROBLEM CON-1: SPHERE → CYLINDER ─────────────────────────────────────────
// A metallic sphere of radius 4.2 cm is melted and recast into a cylinder of
// radius 6 cm. Find the height of the cylinder. (Ex 13.3 Q1)
// V_sphere = V_cylinder
// (4/3)π×4.2³ = π×6²×h
// (4/3)×74.088 = 36h
// h = (4 × 74.088) / (3 × 36) = 296.352 / 108 = 2.744 cm

const CON1_FORMULA_CARD = `Reshaping principle: Volume is conserved

  V_sphere = V_cylinder
  (4/3)πR³ = πr²h

  Solve for h:
    h = (4/3)R³ / r²  = 4R³ / (3r²)

  Here: R = 4.2 cm (sphere), r = 6 cm (cylinder)`

async function seedCON1() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.3-Q1',
    rawText:            'A metallic sphere of radius 4.2 cm is melted and recast in the shape of a cylinder of radius 6 cm. Find the height of the cylinder.',
    unknownAnnotation:  'height of the cylinder',
    concreteRestatement:'Sphere (R=4.2cm) melted into cylinder (r=6cm). Volume conserved. Find h.',
    givens:             { sphereR: '4.2 cm', cylinderR: '6 cm' },
    impliedGivens:      ['volume is conserved on reshaping'],
    conceptAnchor:      'Volume conserved: (4/3)*pi*R^3 = pi*r^2*h',
    problemType:        'none',
    difficultyTier:     2,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('CON-1 Sphere→Cylinder', problemId, 1, [
    // Step 1 — Concept (MCQ)
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Conservation equation',
      prompt:      'When a sphere is melted and recast as a cylinder, which equation correctly applies the volume conservation principle?',
      inputType:   'mcq',
      correctAnswer: 'C',
      hintText:    'Volume is conserved: V_sphere = V_cylinder. Write out both formulas and set them equal.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'V_sphere = V_cylinder. That gives (4/3)πR³ = πr²h.',
      formulaCard: CON1_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'SA_sphere = SA_cylinder  (surface areas are equal)', correct: false },
        { text: '(4/3)πR³ + πr²h = total volume', correct: false },
        { text: '(4/3)πR³ = πr²h  (volumes are equal)', correct: true },
        { text: '(2/3)πR³ = πr²h  (half-sphere = cylinder)', correct: false },
      ],
      workedExampleText:   'When material is reshaped without any gain or loss, volume is conserved.\n(4/3)πR³ = πr²h\nCancel π from both sides:\n(4/3)R³ = r²h\nh = 4R³/(3r²)',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Why does reshaping conserve volume but not surface area?',
      selfExplainAnswer:   'Volume measures the amount of material (atoms/mass), which doesn\'t change shape. Surface area measures the outer skin, which can increase or decrease depending on shape — a sphere has minimum SA for a given volume, while a very flat cylinder has much more SA.',
    },
    // Step 2 — Substitution (MCQ)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Substitute R = 4.2, r = 6',
      prompt:      'Using h = 4R³/(3r²), R = 4.2, r = 6. Which substitution is correct?',
      inputType:   'mcq',
      correctAnswer: 'B',
      hintText:    '4.2³ = 74.088. r² = 36. h = 4×74.088 / (3×36).',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'h = 4×4.2³ / (3×6²) = 4×74.088 / (3×36) = 296.352/108.',
      formulaCard: CON1_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'h = 4×4.2² / (3×6²)', correct: false },
        { text: 'h = 4×4.2³ / (3×6²)', correct: true },
        { text: 'h = 4×4.2³ / (3×6³)', correct: false },
        { text: 'h = (4/3)×4.2 / 6²', correct: false },
      ],
      workedExampleText:   'h = 4R³/(3r²)\n= 4 × 4.2³ / (3 × 36)\n= 4 × 74.088 / 108\n= 296.352 / 108',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Calculate 4.2³ step by step: first 4.2², then multiply by 4.2 again.',
      selfExplainAnswer:   '4.2² = 17.64. Then 17.64 × 4.2 = 74.088. So 4.2³ = 74.088.',
    },
    // Step 3 — Computation (numeric)
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Calculate h',
      prompt:      'Calculate h = 296.352 / 108. What is the height of the cylinder in cm?',
      inputType:   'numeric',
      correctAnswer: '2.74',
      tolerance:   0.02,
      hintText:    '296.352 ÷ 108 = 2.744. Round to 2.74 cm.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: '296.352 / 108 = 2.744 ≈ 2.74 cm.',
      formulaCard: CON1_FORMULA_CARD,
      svgStage:    0,
      unit:        'cm',
      workedExampleText:   'h = 296.352 / 108 = 2.744 cm ≈ 2.74 cm',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'The cylinder\'s radius (6 cm) is larger than the sphere\'s radius (4.2 cm), yet the cylinder is only 2.74 cm tall. Does this make sense? Explain using the idea of volume conservation.',
      selfExplainAnswer:   'Yes. The cylinder has a large base (radius 6 cm), so it needs less height to hold the same volume as the sphere. A wider base compensates with shorter height — the volume "spreads out" rather than going up.',
    },
  ])
}

// ── PROBLEM CON-2: WELL + EMBANKMENT ─────────────────────────────────────────
// A well 3 m in diameter and 14 m deep is dug. The earth taken out is spread
// evenly to form an embankment 4 m wide all around the well. Find height of embankment.
// (Ex 13.3 Q4)
// V_earth = π×1.5²×14 = 31.5π m³
// Embankment: hollow cylinder, inner r = 1.5m, outer r = 1.5+4 = 5.5m, height h
// V_emb = π(5.5²−1.5²)h = π×28h
// π×28h = 31.5π  →  h = 31.5/28 = 1.125 m

const CON2_FORMULA_CARD = `Volume of earth dug = Volume of hollow cylindrical embankment

  V_well = π×r²×H         (solid cylinder dug out)
  V_emb  = π(R²−r²)×h     (hollow cylinder, inner radius r, outer radius R)

  Set equal and solve for h:
    h = r²×H / (R²−r²)

  Here:
    r = 1.5 m (well radius), H = 14 m (depth)
    R = 1.5 + 4 = 5.5 m (outer radius of embankment)`

async function seedCON2() {
  const problemId = await getOrCreateProblem({
    chapterId:          CHAPTER_ID,
    subtopicId:         SUBTOPIC_ID,
    source:             'NCERT',
    sourceReference:    'Ch13-Ex13.3-Q4',
    rawText:            'A well 3 m in diameter and 14 m deep is dug. The earth taken out is spread evenly to form an embankment 4 m wide all around the well. Find the height of the embankment.',
    unknownAnnotation:  'height of the embankment',
    concreteRestatement:'Well (r=1.5m, depth=14m) dug. Earth spread as hollow cylinder (inner r=1.5m, outer r=5.5m). Find height.',
    givens:             { wellDiameter: '3 m', wellDepth: '14 m', embankmentWidth: '4 m' },
    impliedGivens:      ['outer R = 1.5 + 4 = 5.5 m', 'R^2 - r^2 = 28 by difference of squares'],
    conceptAnchor:      'V_well = pi*(R^2 - r^2)*h_emb',
    problemType:        'none',
    difficultyTier:     3,
    requiresSketch:     false,
    isActive:           true,
  })

  await seedGuidedProblem('CON-2 Well + Embankment', problemId, 1, [
    // Step 1 — Concept (MCQ)
    {
      stepType:    'concept',
      stepLabel:   'Step 1 of 3 — Set up the volume equation',
      prompt:      'Earth from the well forms the embankment. The embankment is a hollow cylinder. Which equation sets this up correctly?',
      inputType:   'mcq',
      correctAnswer: 'B',
      hintText:    'V_well (solid cylinder) = V_embankment (hollow cylinder = π(R²−r²)h). Inner radius = 1.5m, outer radius = 1.5+4 = 5.5m.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'Embankment = hollow cylinder. V = π(R²−r²)h where R = 5.5m (outer), r = 1.5m (inner). Set equal to V_well = π(1.5²)(14).',
      formulaCard: CON2_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: 'π×1.5²×14 = π×5.5²×h  (treating embankment as solid)', correct: false },
        { text: 'π×1.5²×14 = π(5.5²−1.5²)×h  (hollow cylinder)', correct: true },
        { text: 'π×1.5²×14 = π×4²×h  (using width as radius)', correct: false },
        { text: 'π×3²×14 = π(5.5²−1.5²)×h  (using diameter instead of radius)', correct: false },
      ],
      workedExampleText:   'V_well = π×r²×H = π×2.25×14 = 31.5π m³\nEmbankment outer R = 1.5 + 4 = 5.5 m\nV_emb = π(R²−r²)h = π(30.25−2.25)h = 28πh\nSet equal: 31.5π = 28πh',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'Why is the outer radius of the embankment 5.5 m and not 4 m?',
      selfExplainAnswer:   'The embankment is 4 m WIDE, built around the outside of the well. The inner edge of the embankment starts at the well\'s radius (1.5 m), so the outer edge is at 1.5 + 4 = 5.5 m from the centre.',
    },
    // Step 2 — Substitution (MCQ)
    {
      stepType:    'substitution',
      stepLabel:   'Step 2 of 3 — Evaluate R²−r²',
      prompt:      'R = 5.5, r = 1.5. Which correctly computes (R²−r²)?',
      inputType:   'mcq',
      correctAnswer: 'C',
      hintText:    'Use difference of squares: R²−r² = (R+r)(R−r) = (5.5+1.5)(5.5−1.5) = 7×4.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'R²−r² = (R+r)(R−r) = 7 × 4 = 28. Or directly: 30.25 − 2.25 = 28.',
      formulaCard: CON2_FORMULA_CARD,
      svgStage:    0,
      unit:        null,
      options: [
        { text: '5.5² − 1.5² = 30.25 − 2.25 = 27', correct: false },
        { text: '(5.5+1.5)(5.5+1.5) = 7 × 7 = 49', correct: false },
        { text: '(5.5+1.5)(5.5−1.5) = 7 × 4 = 28', correct: true },
        { text: '5.5² − 1.5² = (5.5−1.5)² = 4² = 16', correct: false },
      ],
      workedExampleText:   'R²−r² = 5.5²−1.5² = (5.5+1.5)(5.5−1.5) = 7×4 = 28\nSo: 31.5π = 28πh\nh = 31.5/28',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'The difference of squares shortcut (R²−r²) = (R+r)(R−r) was used. Why is this shortcut useful here compared to computing 5.5² and 1.5² separately?',
      selfExplainAnswer:   'Computing (5.5+1.5)=7 and (5.5−1.5)=4 are both easy mental calculations. Their product 7×4=28 is immediate. Squaring 5.5 gives 30.25 — a decimal that\'s easy to subtract wrong. The factored form avoids that risk.',
    },
    // Step 3 — Computation (numeric)
    {
      stepType:    'computation',
      stepLabel:   'Step 3 of 3 — Calculate h',
      prompt:      'From 31.5π = 28πh, calculate h in metres.',
      inputType:   'numeric',
      correctAnswer: '1.125',
      tolerance:   0.01,
      hintText:    'h = 31.5 / 28. Divide: 31.5 ÷ 28 = 1.125.',
      hintText2:   null,
      hintText3:   null,
      errorFeedback: 'π cancels from both sides. h = 31.5/28 = 1.125 m.',
      formulaCard: CON2_FORMULA_CARD,
      svgStage:    0,
      unit:        'm',
      workedExampleText:   '31.5π = 28πh\nCancel π: 31.5 = 28h\nh = 31.5/28 = 1.125 m',
      workedExampleSvgStage: 0,
      selfExplainPrompt:   'The well is 14 m deep but the embankment is only 1.125 m tall. Why is the embankment so much shorter than the well depth?',
      selfExplainAnswer:   'The embankment covers a much larger area (ring from r=1.5m to R=5.5m, area = 28π m²) than the well opening (area = 2.25π m²). The same volume of earth spread over a larger area produces a thinner layer.',
    },
  ])
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Ch 13 Phase 3: Conversion/Reshaping block ──\n')
  await seedCON1()
  await seedCON2()
  console.log('\n✅ Phase 3 complete.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => p.$disconnect())
