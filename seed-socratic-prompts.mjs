/**
 * seed-socratic-prompts.mjs
 *
 * Populates socraticPrompt on all concept-type SolveSteps.
 * Safe to re-run: only updates rows where socraticPrompt IS NULL.
 *
 * Run from scaffhold root:
 *   node seed-socratic-prompts.mjs
 */

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

// Map from stepLabel → socraticPrompt
// These are targeted think-first questions that surface the WHY before
// the student sees the MCQ choices.
const PROMPTS_BY_LABEL = {
  // ── Phase 1: Sector / Arc ────────────────────────────────────────────────
  'What is a sector?':
    'Look at the shape described in this problem. Is the shaded region the WHOLE circle, or only part of it? If it\'s only part — what two things decide how big that part is?',

  'Arc length formula':
    'The arc is the curved edge around the sector. If you doubled the angle (kept the radius the same), what would happen to the arc length? Does that help you think about what the formula must look like?',

  // ── Phase 2: Minor Segment ───────────────────────────────────────────────
  'What is a minor segment?':
    'A chord cuts the circle into two regions. Picture that in your head. The shaded region is between the chord and the arc — not the full slice. If you knew the full "pizza slice" area and the triangle area inside it, how would you find just the crescent-shaped part?',

  'Triangle type at 60°':
    'The two radii of the circle are both equal. The angle between them is 60°. So you have a triangle with two equal sides and an angle of 60° between them. Draw it mentally — what does that triangle look like? Is it possible that all three angles are the same?',

  // ── Phase 3: Combination problems ───────────────────────────────────────
  'Identify the shapes':
    'Read the problem again. It mentions a square and a circle together. Which shape is inside which? Does the circle fit snugly, or does it stick out? Knowing that will tell you the radius.',

  'Corner quarter-circles':
    'Picture a square. Put a circle at each corner, with its centre AT the corner. What angle does each corner of a square have? What fraction of a full circle would sit inside that corner?',

  'Square inscribed in circle':
    'The square fits perfectly inside the circle — all four corners touch the circle. Imagine the diagonal of the square. Where does it start and end? Does it pass through the centre of the circle?',

  'Sector at a corner':
    'The horse is tied at a corner of the field with a rope. Stand at that corner and imagine swinging a rope in front of you. The walls of the field block your swing. How many degrees can you actually swing before the wall stops you? That angle — what fraction of a full circle is it?',

  'Semicircle perimeter':
    'Trace your finger around one semicircle. You follow the curved part — that\'s the arc. Then what? Does your finger stop in mid-air, or does it continue along the straight edge back to where it started? What is the name of that straight edge?',

  'Semicircles on each side':
    'Four semicircles, one on each side of a square. If you had two semicircles, that would be one full circle. So four semicircles = how many full circles? Does the diameter of each semicircle depend on the side of the square?',
}

async function main() {
  // Fetch all concept steps
  const conceptSteps = await p.solveStep.findMany({
    where: { stepType: 'concept', socraticPrompt: null },
    select: { id: true, stepLabel: true },
  })

  console.log(`Found ${conceptSteps.length} concept steps with no socraticPrompt.`)

  let updated = 0
  let skipped = 0

  for (const step of conceptSteps) {
    const prompt = PROMPTS_BY_LABEL[step.stepLabel]
    if (!prompt) {
      console.log(`  ⚠️  No prompt for label: "${step.stepLabel}" — skipping`)
      skipped++
      continue
    }
    await p.solveStep.update({
      where: { id: step.id },
      data: { socraticPrompt: prompt },
    })
    console.log(`  ✅ "${step.stepLabel}"`)
    updated++
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (no mapping): ${skipped}`)
}

main().catch(console.error).finally(() => p.$disconnect())

// ─── PATCH: run this separately to add physics prompts ───────────────────────
// node -e "import('./seed-socratic-prompts.mjs').then(m => m.patchPhysics())"
