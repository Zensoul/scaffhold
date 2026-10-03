-- Correct a rounded frustum answer and replace an inconsistent semicircle
-- problem/guided flow with a fully specified overlap-lens question.

BEGIN;

UPDATE "problems"
SET
  "rawText" = 'A square has side 14 cm. Four equal semicircles are drawn inward, one on each side, using that side as the diameter. Find the total area of the four lens-shaped regions where adjacent semicircles overlap. (Use π = 22/7.)',
  "unknownAnnotation" = 'total area of the four lens-shaped overlap regions',
  "concreteRestatement" = 'Four inward semicircles, one per 14 cm side. Find the combined area of the four equal overlap lenses.',
  "givens" = '{"side":"14 cm","semicircleCount":4,"diameter":"14 cm","radius":"7 cm"}'::jsonb,
  "conceptAnchor" = 'One overlap lens = 2 × (90° sector area − right triangle area); total shaded area = 4 × one lens.'
WHERE "id" = '612256f9-ea99-4f23-882f-46a322c56f56';

UPDATE "solve_steps"
SET
  "stepLabel" = 'Step 1 of 6 — Find each semicircle radius',
  "prompt" = 'Four semicircles are drawn inward, one on each side of a square with side 14 cm. What is the radius of each semicircle?',
  "correctAnswer" = '7 cm',
  "hintText" = 'Each semicircle’s diameter is the full side of the square.',
  "hintText2" = 'Radius is half the diameter: 14 ÷ 2.',
  "hintText3" = 'Each radius is 7 cm.',
  "errorFeedback" = 'Each semicircle has diameter 14 cm, so its radius is 14 ÷ 2 = 7 cm.',
  "formulaCard" = 'diameter = 14 cm  →  radius = diameter ÷ 2',
  "selfExplainPrompt" = NULL,
  "selfExplainAnswer" = NULL,
  "followUpPrompt" = NULL,
  "followUpAnswer" = NULL,
  "followUpInputType" = NULL,
  "followUpTolerance" = NULL,
  "svgStage" = 0
WHERE "id" = 'e54c94ee-c63c-42fe-a8e5-0318b461e80e';

UPDATE "solve_step_options"
SET "optionText" = CASE "orderIndex"
      WHEN 0 THEN '7 cm'
      WHEN 1 THEN '14 cm'
      WHEN 2 THEN '3.5 cm'
      WHEN 3 THEN '28 cm'
    END,
    "isCorrect" = ("orderIndex" = 0)
WHERE "stepId" = 'e54c94ee-c63c-42fe-a8e5-0318b461e80e';

UPDATE "solve_steps"
SET "stepLabel" = 'Step 2 of 6 — Angle of one overlap sector',
    "prompt" = 'In each overlap lens, what is the angle of the sector at the centre of a semicircle?',
    "correctAnswer" = '90', "tolerance" = 0, "unit" = '°',
    "hintText" = 'The sector angle is at a corner of the square.',
    "hintText2" = 'Two sides meeting at a square corner are perpendicular.',
    "hintText3" = 'A square corner is 90°.',
    "formulaCard" = 'Each overlap uses a 90° sector',
    "errorFeedback" = 'Adjacent sides of a square meet at 90°, so the sector angle is 90°.',
    "workedExampleText" = 'The square corner is a right angle, so each sector angle is 90°.',
    "workedExampleSvgStage" = 1, "svgStage" = 1,
    "selfExplainPrompt" = NULL, "selfExplainAnswer" = NULL,
    "followUpPrompt" = NULL, "followUpAnswer" = NULL,
    "followUpInputType" = NULL, "followUpTolerance" = NULL,
    "prerequisiteSkill" = 'Recognising a right angle in a square',
    "prerequisiteExplanation" = 'Every interior angle of a square is a right angle measuring 90°.',
    "prerequisiteExample" = 'At any corner of a square, the two sides meet at 90°.',
    "prerequisiteCheckPrompt" = 'How many degrees are in a right angle?',
    "prerequisiteCheckAnswer" = '90', "prerequisiteCheckTolerance" = 0
WHERE "id" = '573e4a69-24c3-4004-bef5-085af9d547f9';

UPDATE "solve_steps"
SET "stepLabel" = 'Step 3 of 6 — Area of one 90° sector',
    "prompt" = 'Find the area of one 90° sector with radius 7 cm. Use π = 22/7.',
    "correctAnswer" = '38.5', "tolerance" = 0, "unit" = 'cm²',
    "hintText" = 'A 90° sector is one quarter of a circle.',
    "hintText2" = 'Sector area = (90/360) × (22/7) × 7².',
    "hintText3" = 'A quarter of 154 cm² is 38.5 cm².',
    "formulaCard" = 'sector area = (θ/360) × πr²',
    "errorFeedback" = '(90/360) × (22/7) × 49 = 154/4 = 38.5 cm².',
    "workedExampleText" = '(90/360) × (22/7) × 7² = 154/4 = 38.5 cm².',
    "workedExampleSvgStage" = 1, "svgStage" = 1,
    "prerequisiteSkill" = 'Using the sector area formula',
    "prerequisiteExplanation" = 'A sector is a fraction θ/360 of a full circle, so its area is (θ/360) × πr².',
    "prerequisiteExample" = 'A 90° sector is one quarter of the full circle area.',
    "prerequisiteCheckPrompt" = 'A 90° sector is what fraction of a full circle?',
    "prerequisiteCheckAnswer" = '0.25', "prerequisiteCheckTolerance" = 0
WHERE "id" = '3c7aea15-278f-4be1-a0f6-3729015f5a70';

UPDATE "solve_steps"
SET "stepLabel" = 'Step 4 of 6 — Area of the right triangle',
    "prompt" = 'The triangle inside one overlap lens has perpendicular sides 7 cm and 7 cm. Find its area.',
    "correctAnswer" = '24.5', "tolerance" = 0, "unit" = 'cm²',
    "hintText" = 'Area of a right triangle = (base × height) ÷ 2.',
    "hintText2" = 'Use 7 cm for both sides: (7 × 7) ÷ 2.',
    "hintText3" = '49 ÷ 2 = 24.5 cm².',
    "formulaCard" = 'right triangle area = ½ × base × height',
    "errorFeedback" = '½ × 7 × 7 = 24.5 cm².',
    "workedExampleText" = 'Triangle area = ½ × 7 × 7 = 24.5 cm².',
    "workedExampleSvgStage" = 1, "svgStage" = 1,
    "prerequisiteSkill" = 'Finding the area of a right triangle',
    "prerequisiteExplanation" = 'For a right triangle, multiply its perpendicular side lengths and divide by 2.',
    "prerequisiteExample" = 'A right triangle with perpendicular sides 3 cm and 4 cm has area 3 × 4 ÷ 2 = 6 cm².',
    "prerequisiteCheckPrompt" = 'A right triangle has perpendicular sides 6 cm and 4 cm. What is its area?',
    "prerequisiteCheckAnswer" = '12', "prerequisiteCheckTolerance" = 0
WHERE "id" = '725bead6-f18f-46b7-9109-b73a6638f48a';

UPDATE "solve_steps"
SET "stepLabel" = 'Step 5 of 6 — Area of one overlap lens',
    "prompt" = 'One lens is made from two 90° sectors minus two identical right triangles. Find its area.',
    "correctAnswer" = '28', "tolerance" = 0, "unit" = 'cm²',
    "hintText" = 'Subtract one triangle’s area from one sector’s area, then double.',
    "hintText2" = '2 × (38.5 − 24.5) = ?',
    "hintText3" = '2 × 14 = 28 cm².',
    "formulaCard" = 'one lens = 2 × (90° sector − right triangle)',
    "errorFeedback" = 'One lens = 2 × (38.5 − 24.5) = 28 cm².',
    "workedExampleText" = 'One lens = 2 × (sector − triangle) = 2 × (38.5 − 24.5) = 28 cm².',
    "workedExampleSvgStage" = 1, "svgStage" = 1,
    "selfExplainPrompt" = 'Why do we subtract two triangles from two sectors to find one lens?',
    "selfExplainAnswer" = 'Each sector contains one right triangle. Removing both triangles leaves the two curved pieces that form the lens.',
    "followUpPrompt" = 'If a sector has area 20 cm² and its right triangle has area 12 cm², what is the lens area?',
    "followUpAnswer" = '16', "followUpInputType" = 'numeric', "followUpTolerance" = 0,
    "prerequisiteSkill" = 'Subtracting a triangle area from a sector area',
    "prerequisiteExplanation" = 'A circular segment is the sector left after its triangle is removed.',
    "prerequisiteExample" = 'If the sector is 30 cm² and the triangle is 18 cm², the segment is 30 − 18 = 12 cm².',
    "prerequisiteCheckPrompt" = 'A sector has area 25 cm² and its triangle has area 17 cm². What is the segment area?',
    "prerequisiteCheckAnswer" = '8', "prerequisiteCheckTolerance" = 0
WHERE "id" = 'bb3a5d5a-6c67-4f5c-90d4-2ce24fa959f1';

INSERT INTO "solve_steps" (
  "id", "guidedSolveProblemId", "sequenceOrder", "stepType", "stepLabel",
  "prompt", "inputType", "correctAnswer", "tolerance", "hintText", "hintText2",
  "hintText3", "errorFeedback", "formulaCard", "svgStage", "unit",
  "workedExampleText", "workedExampleSvgStage"
) VALUES (
  '42c256f0-7320-4e9c-a560-cfeb48e59f65', 'fa129db2-aede-42eb-a143-2eb097d9eec4', 6,
  'computation', 'Step 6 of 6 — Total shaded area',
  'There are four equal overlap lenses. Find their total area.',
  'numeric', '112', 0,
  'Multiply the area of one lens by 4.', '4 × 28 = ?',
  'The total shaded area is 112 cm².', '4 × 28 = 112 cm².',
  'total shaded area = 4 × area of one lens', 1, 'cm²',
  'Four congruent lenses: 4 × 28 = 112 cm².', 1
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "solve_steps"
SET "correctAnswer" = '10459.43', "tolerance" = 0.02,
    "hintText2" = '(22/7 × 16/3) = 352/21. V = 352/21 × 624 = 219648/21 = 73216/7 ≈ 10459.43 cm³.',
    "errorFeedback" = '400+64+160=624. V = (22/7)(16/3)(624) = 219648/21 = 73216/7 ≈ 10459.43 cm³.',
    "workedExampleText" = 'r₁²+r₂²+r₁r₂ = 400+64+(20×8) = 624\nV = (22/7) × (16/3) × 624\n= (22 × 16 × 624) / 21\n= 219648 / 21 = 73216 / 7\n≈ 10459.43 cm³',
    "selfExplainPrompt" = 'The bucket volume is about 10459.43 cm³. How many litres is that? (1 L = 1000 cm³)',
    "selfExplainAnswer" = '10459.43 cm³ ÷ 1000 ≈ 10.46 litres.'
WHERE "id" = '6d16f7b8-4cd6-4e84-bf81-2fad8e6abda3';

UPDATE "solve_steps"
SET "selfExplainPrompt" = 'The bucket volume is about 10459.43 cm³. How many litres is that? (1 L = 1000 cm³)',
    "selfExplainAnswer" = '10459.43 cm³ ÷ 1000 ≈ 10.46 litres.'
WHERE "id" = 'cb1a4193-2adc-46a5-8031-8fa9cf9670e6';

UPDATE "problem_annotations"
SET "annotationText" = 'Each side of the square measures 14 cm.',
    "hintText" = 'Each semicircle uses one full side of the square as its diameter, so its radius is half of 14 cm.'
WHERE "id" = '9f92db93-8cf7-4cd8-b859-1ffb2d32e445';

UPDATE "problem_annotations"
SET "annotationText" = 'Four semicircles are drawn inward, one on each side of the square.',
    "hintText" = 'Adjacent semicircles overlap to form the four lens-shaped regions whose areas are requested.'
WHERE "id" = 'b08fcf3c-efe2-4224-8b78-0272f6ac41e1';

UPDATE "problem_annotations"
SET "annotationText" = 'Each semicircle has diameter 14 cm and radius 7 cm.',
    "hintText" = 'The diameter equals the side length of the square; the radius is half the diameter.'
WHERE "id" = 'b0298414-2fcd-4f4c-879e-eb495cbc31ca';

UPDATE "problem_annotations"
SET "annotationText" = 'The total area of the four lens-shaped overlap regions.',
    "hintText" = 'Find one lens by subtracting two right triangles from two 90° sectors, then multiply by 4.'
WHERE "id" = 'd23c4af4-f07b-49e2-8f86-eec5d7afde2f';

UPDATE "problem_annotations"
SET "annotationText" = 'One overlap lens = 2 × (90° sector area − right triangle area); total shaded area = 4 × one lens.',
    "hintText" = 'A 90° sector has area 38.5 cm²; the right triangle has area 24.5 cm². One lens is 28 cm², so all four total 112 cm².'
WHERE "id" = '9a8721bf-def8-43ef-a776-26ab50f8a229';

COMMIT;
