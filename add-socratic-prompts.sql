-- Populates socraticPrompt on concept-type SolveSteps
-- Safe to re-run: WHERE socraticPrompt IS NULL guard prevents overwrites

UPDATE solve_steps SET "socraticPrompt" = 'Look at the shape described in this problem. Is the shaded region the WHOLE circle, or only part of it? If it''s only part — what two things decide how big that part is?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'What is a sector?' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'The arc is the curved edge around the sector. If you doubled the angle (kept the radius the same), what would happen to the arc length? Does that help you think about what the formula must look like?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Arc length formula' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'A chord cuts the circle into two regions. Picture that in your head. The shaded region is between the chord and the arc — not the full slice. If you knew the full "pizza slice" area and the triangle area inside it, how would you find just the crescent-shaped part?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'What is a minor segment?' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'The two radii of the circle are both equal. The angle between them is 60°. So you have a triangle with two equal sides and an angle of 60° between them. Draw it mentally — what does that triangle look like? Is it possible that all three angles are the same?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Triangle type at 60°' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'Read the problem again. It mentions a square and a circle together. Which shape is inside which? Does the circle fit snugly, or does it stick out? Knowing that will tell you the radius.'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Identify the shapes' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'Picture a square. Put a circle at each corner, with its centre AT the corner. What angle does each corner of a square have? What fraction of a full circle would sit inside that corner?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Corner quarter-circles' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'The square fits perfectly inside the circle — all four corners touch the circle. Imagine the diagonal of the square. Where does it start and end? Does it pass through the centre of the circle?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Square inscribed in circle' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'The horse is tied at a corner of the field with a rope. Stand at that corner and imagine swinging a rope in front of you. The walls of the field block your swing. How many degrees can you actually swing before the wall stops you? That angle — what fraction of a full circle is it?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Sector at a corner' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'Trace your finger around one semicircle. You follow the curved part — that''s the arc. Then what? Does your finger stop in mid-air, or does it continue along the straight edge back to where it started? What is the name of that straight edge?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Semicircle perimeter' AND "socraticPrompt" IS NULL;

UPDATE solve_steps SET "socraticPrompt" = 'Four semicircles, one on each side of a square. If you had two semicircles, that would be one full circle. So four semicircles = how many full circles? Does the diameter of each semicircle depend on the side of the square?'
WHERE "stepType" = 'concept' AND "stepLabel" = 'Semicircles on each side' AND "socraticPrompt" IS NULL;
