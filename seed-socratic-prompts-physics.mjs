/**
 * seed-socratic-prompts-physics.mjs
 *
 * Adds socraticPrompt for physics (light/mirror/lens) concept steps.
 * Run AFTER seed-socratic-prompts.mjs:
 *   node seed-socratic-prompts-physics.mjs
 */

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const PROMPTS_BY_LABEL = {
  // ── Mirror / Lens formula steps ──────────────────────────────────────────
  'Mirror formula':
    'You have an object placed in front of a mirror. Three distances are involved: where the object is, where the image forms, and where the mirror\'s focus is. All three are measured from the mirror\'s pole. Before you pick the formula — which of these three distances is unknown in this problem?',

  'Focus and centre of curvature':
    'The mirror is curved like the inside of a spoon. Parallel rays hitting it all meet at one point. That point is the focus. The centre of curvature is the centre of the sphere this mirror is a part of. What is the relationship between the focal length and the radius of curvature — are they the same, or is one double the other?',

  'What is magnification?':
    'Magnification tells you how the image compares to the object. If the magnification is 2, the image is twice the size of the object. If it\'s −1, the image is the same size but flipped. In this problem, what does the sign of magnification tell you about the image — is it upright or inverted?',

  'Lens formula':
    'A lens bends light to form an image. The lens formula connects three distances: object distance (u), image distance (v), and focal length (f) — all measured from the optical centre. Before substituting numbers — is this a converging (convex) lens or a diverging (concave) lens? How does that affect the sign of f?',

  'Power of a lens':
    'Power of a lens is just how strongly it bends light. A short focal length means strong bending — high power. The unit is dioptre (D). Before calculating — if someone is far-sighted, do they need a converging or diverging lens? What sign will its power have?',

  'Refractive index formula':
    'Light slows down when it enters a denser medium. The refractive index tells you by how much. It\'s always ≥ 1 for any real material. In this problem, light is moving from one medium to another. Which medium is denser — the one it\'s coming from, or the one it\'s going into? How can you tell from the given speeds?',

  'Snell\'s Law':
    'When light crosses from one medium to another, it bends. Snell\'s Law relates the angles to the refractive indices. The angles are always measured from the normal (a line perpendicular to the surface), not from the surface itself. In this problem — which angle is given and which is unknown?',

  'Critical angle formula':
    'Total internal reflection happens when light tries to escape from a denser medium at too steep an angle. The critical angle is the boundary — beyond it, no light escapes. It only exists when going from denser to rarer medium. In this problem, which direction is the light travelling, and what does that tell you about whether TIR is even possible?',

  'Rearrange n = c/v':
    'The refractive index n = c/v, where c is the speed of light in vacuum and v is the speed in the medium. If n is large, v is small — the medium slows light more. In this problem, you know n and c. Which quantity are you solving for — v, or something derived from it?',

  // ── LM (Light / Mirror) labelled steps ───────────────────────────────────
  'LM1 — Step 1 of 4: Identify the Formula':
    'This problem involves a mirror. Three quantities appear in the mirror formula: object distance (u), image distance (v), and focal length (f). Read the problem carefully — which two are given, and which one are you finding?',

  'LM1 — Step 2 of 4: Apply Sign Convention':
    'In mirror problems, distances in front of the mirror are negative and distances behind are positive (New Cartesian convention). The object is always in front — so u is always negative. Now look at the image: is it real (in front) or virtual (behind the mirror)? That decides the sign of v.',

  'LM2 — Step 1 of 4: Identify the Formula':
    'This problem involves a mirror. Three quantities appear in the mirror formula: object distance (u), image distance (v), and focal length (f). Read the problem carefully — which two are given, and which one are you finding?',

  'LM2 — Step 2 of 4: Apply Sign Convention':
    'In mirror problems, distances in front of the mirror are negative and distances behind are positive (New Cartesian convention). The object is always in front — so u is always negative. Now look at the image: is it real (in front) or virtual (behind the mirror)? That decides the sign of v.',

  'LM3 — Step 1 of 4: Identify the Formula':
    'This problem involves a mirror. Three quantities appear in the mirror formula: object distance (u), image distance (v), and focal length (f). Read the problem carefully — which two are given, and which one are you finding?',

  'LM3 — Step 2 of 4: Apply Sign Convention':
    'In mirror problems, distances in front of the mirror are negative and distances behind are positive (New Cartesian convention). The object is always in front — so u is always negative. Now look at the image: is it real (in front) or virtual (behind the mirror)? That decides the sign of v.',

  'LM4 — Step 1 of 4: Identify the Relationship':
    'This problem connects focal length and radius of curvature. They both describe the same curved mirror — one is exactly half the other. Before you write the formula, which one is given in the problem and which one are you finding?',

  'LM4 — Step 2 of 4: Identify the Given Value':
    'You have either the focal length or the radius of curvature. The relationship is simple: R = 2f. Think about this — if the radius doubles, does the focal length double too, or does it stay the same? Which one appears in the problem as a number?',

  'LM5 — Step 1 of 4: Identify the Formula':
    'This problem involves a mirror and asks about magnification. Magnification m = −v/u. It tells you the size ratio (|m|) and orientation (sign of m). Before substituting: is the image described as upright or inverted? Erect or real? What does that tell you about the sign of m?',

  'LM5 — Step 2 of 4: Apply Sign Convention':
    'For a mirror: object distance u is always negative (object in front). If the image is real and in front of the mirror, v is also negative — and m = −v/u will be negative (inverted image). If the image is virtual (behind the mirror), v is positive and m is positive (upright). Which case does this problem describe?',

  // ── Major segment / alternate triangle types ─────────────────────────────
  'Triangle type at 90°':
    'The central angle here is 90°. The triangle formed by the two radii and the chord has two equal sides (both are radii) and a 90° angle between them. What kind of right triangle has two equal legs? Once you know that, do you need the Pythagoras theorem or a direct area formula?',

  'What is a major segment?':
    'A chord divides a circle into two regions. The major segment is the LARGER one — the bigger piece, not the crescent. Picture it: it includes more than half the circle. If the minor segment area = sector area − triangle area, what does the major segment area equal in terms of the full circle and the minor segment?',
}

async function main() {
  const conceptSteps = await p.solveStep.findMany({
    where: { stepType: 'concept', socraticPrompt: null },
    select: { id: true, stepLabel: true },
  })

  console.log(`Found ${conceptSteps.length} concept steps still missing socraticPrompt.`)

  let updated = 0, skipped = 0

  for (const step of conceptSteps) {
    const prompt = PROMPTS_BY_LABEL[step.stepLabel]
    if (!prompt) {
      console.log(`  ⚠️  No prompt for: "${step.stepLabel}"`)
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

  console.log(`\nDone. Updated: ${updated}  Still missing: ${skipped}`)
}

main().catch(console.error).finally(() => p.$disconnect())
