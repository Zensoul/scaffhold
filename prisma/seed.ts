import { PrismaClient, Role, Board, SubjectName, Language } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.warn('Seeding database...')

  // Users
  const teacher = await prisma.user.create({
    data: {
      role: Role.teacher,
      fullName: 'Priya Sharma',
      email: 'priya@scaffhold.dev',
      passwordHash: 'placeholder',
      preferredLanguage: Language.EN,
    },
  })

  const parent = await prisma.user.create({
    data: {
      role: Role.parent,
      fullName: 'Rajesh Kumar',
      phoneE164: '+919876543210',
      preferredLanguage: Language.EN,
    },
  })

  const studentUser = await prisma.user.create({
    data: {
      role: Role.student,
      fullName: 'Arjun Kumar',
      phoneE164: '+919876543211',
      preferredLanguage: Language.EN,
    },
  })

  // Student profile
  const studentProfile = await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      grade: 10,
      board: Board.CBSE,
      schoolName: 'Delhi Public School',
      teacherId: teacher.id,
      parentId: parent.id,
      dpdpConsentGiven: true,
      dpdpConsentAt: new Date(),
      dpdpConsentVersion: 'v1.0',
    },
  })

  // Subject
  const mathSubject = await prisma.subject.create({
    data: {
      name: SubjectName.math,
      grade: 10,
      board: Board.CBSE,
    },
  })

  // Chapter
  const chapter = await prisma.chapter.create({
    data: {
      subjectId: mathSubject.id,
      name: 'Quadratic Equations',
      sequenceNumber: 4,
    },
  })

  // ---------------------------------------------------------------------
  // Problems
  //
  // Problem.givens / Problem.impliedGivens (Json) are kept as DERIVED
  // CACHES for fast display of "all givens at a glance" (e.g. rendering
  // the full Mode 1 worked example without joining ProblemAnnotation).
  // Source of truth for per-piece tracking is ProblemAnnotation, below —
  // that's what SessionInteraction.annotationId points at, and it's what
  // lets scaffolding-level tracking distinguish "weak on implied givens"
  // from "weak on explicit givens" for a given student/chapter.
  //
  // Removal order in Mode 2 fade (first hidden -> last hidden) follows
  // ProblemAnnotation.sequenceOrder ascending: explicit givens fade first
  // (easiest, most visible), implied_given next (requires inference),
  // unknown last (hardest — this IS the 90-day success metric).
  // concept_anchor is authored last of all and excluded from the fade
  // loop by application logic (shown as a fixed label, never hidden) —
  // this is a convention enforced in code, not a schema-level flag.
  // ---------------------------------------------------------------------

  const problem1 = await prisma.problem.create({
    data: {
      chapterId: chapter.id,
      source: 'NCERT',
      sourceReference: 'Class 10 Math Chapter 4 Exercise 4.3 Q1',
      rawText:
        'A train travels 360 km at a uniform speed. If the speed had been 5 km/h more, it would have taken 1 hour less for the same journey. Find the speed of the train.',
      unknownAnnotation: 'the original speed of the train in km/h',
      concreteRestatement:
        'Imagine the train is moving. Every hour it covers some fixed distance. We want to know: how many kilometres does it cover in exactly one hour?',
      givens: [
        'Total distance = 360 km',
        'Speed is uniform throughout the journey',
        'If speed increases by 5 km/h, time reduces by 1 hour',
      ],
      impliedGivens: [
        'Time = Distance ÷ Speed (this relationship connects the givens)',
      ],
      conceptAnchor:
        'When speed changes, time for the same distance also changes — these two quantities are connected by a fixed distance.',
      problemType: 'rate_time_distance',
      difficultyTier: 2,
      contentReviewedBy: teacher.id,
      contentReviewedAt: new Date(),
    },
  })

  await prisma.problemAnnotation.createMany({
    data: [
      {
        problemId: problem1.id,
        annotationType: 'given',
        annotationText: 'Total distance = 360 km',
        hintText: 'Look for the fixed distance the train covers — it does not change in this problem.',
        sequenceOrder: 1,
      },
      {
        problemId: problem1.id,
        annotationType: 'given',
        annotationText: 'Speed is uniform throughout the journey',
        hintText: 'The train does not speed up or slow down partway — one constant speed the whole trip.',
        sequenceOrder: 2,
      },
      {
        problemId: problem1.id,
        annotationType: 'given',
        annotationText: 'If speed increases by 5 km/h, time reduces by 1 hour',
        hintText: 'This links a hypothetical faster speed to a hypothetical shorter time — for the same 360 km.',
        sequenceOrder: 3,
      },
      {
        problemId: problem1.id,
        annotationType: 'implied_given',
        annotationText: 'Time = Distance ÷ Speed (this relationship connects the givens)',
        hintText: 'You are not told this formula directly — you need to bring it in yourself to connect speed, time, and distance.',
        sequenceOrder: 4,
      },
      {
        problemId: problem1.id,
        annotationType: 'unknown',
        annotationText: 'the original speed of the train in km/h',
        hintText: 'The question asks you to "find the speed" — that is the value you are solving for.',
        sequenceOrder: 5,
      },
      {
        problemId: problem1.id,
        annotationType: 'concept_anchor',
        annotationText:
          'When speed changes, time for the same distance also changes — these two quantities are connected by a fixed distance.',
        hintText: 'This is a rate-time-distance problem: distance stays fixed while speed and time trade off against each other.',
        sequenceOrder: 6,
      },
    ],
  })

  const problem2 = await prisma.problem.create({
    data: {
      chapterId: chapter.id,
      source: 'NCERT',
      sourceReference: 'Class 10 Math Chapter 4 Exercise 4.3 Q3',
      rawText:
        'Find two consecutive positive integers, sum of whose squares is 365.',
      unknownAnnotation: 'two consecutive positive integers',
      concreteRestatement:
        'We are looking for two whole numbers that sit next to each other on a number line — like 4 and 5, or 12 and 13. We want to find which pair, when you square both and add them, gives exactly 365.',
      givens: [
        'The two integers are consecutive (differ by exactly 1)',
        'Both integers are positive',
        'The sum of their squares equals 365',
      ],
      impliedGivens: [
        'If the first integer is n, the next consecutive integer is n + 1',
      ],
      conceptAnchor:
        'Consecutive integers are whole numbers that follow each other in order with a difference of exactly 1.',
      problemType: 'consecutive_integers',
      difficultyTier: 1,
      contentReviewedBy: teacher.id,
      contentReviewedAt: new Date(),
    },
  })

  await prisma.problemAnnotation.createMany({
    data: [
      {
        problemId: problem2.id,
        annotationType: 'given',
        annotationText: 'The two integers are consecutive (differ by exactly 1)',
        hintText: 'Consecutive means "one right after the other" — like 7 and 8.',
        sequenceOrder: 1,
      },
      {
        problemId: problem2.id,
        annotationType: 'given',
        annotationText: 'Both integers are positive',
        hintText: 'Neither number can be zero or negative.',
        sequenceOrder: 2,
      },
      {
        problemId: problem2.id,
        annotationType: 'given',
        annotationText: 'The sum of their squares equals 365',
        hintText: 'Square each integer, then add the two squares together — that total is 365.',
        sequenceOrder: 3,
      },
      {
        problemId: problem2.id,
        annotationType: 'implied_given',
        annotationText: 'If the first integer is n, the next consecutive integer is n + 1',
        hintText: 'This is not stated directly — you need to represent "consecutive" algebraically yourself.',
        sequenceOrder: 4,
      },
      {
        problemId: problem2.id,
        annotationType: 'unknown',
        annotationText: 'two consecutive positive integers',
        hintText: 'The question asks you to "find" these two numbers — that is what you are solving for.',
        sequenceOrder: 5,
      },
      {
        problemId: problem2.id,
        annotationType: 'concept_anchor',
        annotationText:
          'Consecutive integers are whole numbers that follow each other in order with a difference of exactly 1.',
        hintText: 'Whenever you see "consecutive," represent the numbers as n and n + 1.',
        sequenceOrder: 6,
      },
    ],
  })

  const problem3 = await prisma.problem.create({
    data: {
      chapterId: chapter.id,
      source: 'NCERT',
      sourceReference: 'Class 10 Math Chapter 4 Exercise 4.3 Q4',
      rawText:
        'The altitude of a right triangle is 7 cm less than its base. If the hypotenuse is 13 cm, find the other two sides.',
      unknownAnnotation: 'the length of the base and the altitude of the triangle',
      concreteRestatement:
        'Picture a right triangle. We know the longest side is 13 cm. We want to find the lengths of the other two sides — the base (bottom) and the altitude (height).',
      givens: [
        'The triangle is a right triangle',
        'Altitude is 7 cm less than the base',
        'Hypotenuse = 13 cm',
      ],
      impliedGivens: [
        'base² + altitude² = hypotenuse² (Pythagoras theorem)',
      ],
      conceptAnchor:
        'In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
      problemType: 'geometry_right_triangle',
      difficultyTier: 1,
      contentReviewedBy: teacher.id,
      contentReviewedAt: new Date(),
    },
  })

  await prisma.problemAnnotation.createMany({
    data: [
      {
        problemId: problem3.id,
        annotationType: 'given',
        annotationText: 'The triangle is a right triangle',
        hintText: 'One of the three angles is exactly 90 degrees.',
        sequenceOrder: 1,
      },
      {
        problemId: problem3.id,
        annotationType: 'given',
        annotationText: 'Altitude is 7 cm less than the base',
        hintText: 'If the base is some length, the altitude is that length minus 7.',
        sequenceOrder: 2,
      },
      {
        problemId: problem3.id,
        annotationType: 'given',
        annotationText: 'Hypotenuse = 13 cm',
        hintText: 'The hypotenuse is the longest side, opposite the right angle.',
        sequenceOrder: 3,
      },
      {
        problemId: problem3.id,
        annotationType: 'implied_given',
        annotationText: 'base² + altitude² = hypotenuse² (Pythagoras theorem)',
        hintText: 'This formula is not written in the problem — you need to recall it because you were told it is a right triangle.',
        sequenceOrder: 4,
      },
      {
        problemId: problem3.id,
        annotationType: 'unknown',
        annotationText: 'the length of the base and the altitude of the triangle',
        hintText: 'The question asks you to "find the other two sides" — those are the values you are solving for.',
        sequenceOrder: 5,
      },
      {
        problemId: problem3.id,
        annotationType: 'concept_anchor',
        annotationText:
          'In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
        hintText: 'Whenever you see a right triangle with a known hypotenuse, reach for the Pythagoras theorem.',
        sequenceOrder: 6,
      },
    ],
  })

  // Scaffolding level for student
  await prisma.scaffoldingLevel.create({
    data: {
      studentId: studentProfile.id,
      chapterId: chapter.id,
      currentLevel: 0.2,
      problemsAttempted: 3,
      problemsClean: 1,
      consecutiveClean: 0,
      consecutiveFailures: 1,
    },
  })

  // Session
  const session = await prisma.session.create({
    data: {
      studentId: studentProfile.id,
      chapterId: chapter.id,
      startedAt: new Date(Date.now() - 20 * 60 * 1000),
      endedAt: new Date(),
      endReason: 'completed',
      problemsPresented: 2,
      problemsAttempted: 2,
      scaffoldingLevelStart: 0.1,
      scaffoldingLevelEnd: 0.2,
      sessionEndStatement:
        'You correctly identified what 1 problem was asking today. That is progress — come back tomorrow.',
    },
  })

  // Session interactions
  await prisma.sessionInteraction.createMany({
    data: [
      {
        sessionId: session.id,
        studentId: studentUser.id,
        problemId: problem1.id,
        interactionType: 'annotation_presented',
        scaffoldingLevelAt: 0.1,
        timeOnStepMs: 4200,
      },
      {
        sessionId: session.id,
        studentId: studentUser.id,
        problemId: problem1.id,
        interactionType: 'annotation_incorrect',
        studentResponse: 'the distance the train travels',
        isCorrect: false,
        scaffoldingLevelAt: 0.1,
        timeOnStepMs: 12000,
      },
      {
        sessionId: session.id,
        studentId: studentUser.id,
        problemId: problem1.id,
        interactionType: 'annotation_correct',
        studentResponse: 'the original speed of the train in km/h',
        isCorrect: true,
        scaffoldingLevelAt: 0.15,
        timeOnStepMs: 8500,
      },
      {
        sessionId: session.id,
        studentId: studentUser.id,
        problemId: problem2.id,
        interactionType: 'annotation_correct',
        studentResponse: 'two consecutive positive integers',
        isCorrect: true,
        scaffoldingLevelAt: 0.2,
        timeOnStepMs: 6200,
      },
    ],
  })

  // Scaffolding history
  await prisma.scaffoldingHistory.createMany({
    data: [
      {
        studentId: studentProfile.id,
        chapterId: chapter.id,
        sessionId: session.id,
        levelBefore: 0.1,
        levelAfter: 0.15,
        delta: 0.05,
        reason: 'correct_answer',
      },
      {
        studentId: studentProfile.id,
        chapterId: chapter.id,
        sessionId: session.id,
        levelBefore: 0.15,
        levelAfter: 0.2,
        delta: 0.05,
        reason: 'correct_answer',
      },
    ],
  })

  console.warn('Seed complete.')
  console.warn(`Teacher: ${teacher.id}`)
  console.warn(`Parent: ${parent.id}`)
  console.warn(`Student user: ${studentUser.id}`)
  console.warn(`Student profile: ${studentProfile.id}`)
  console.warn(`Chapter: ${chapter.id}`)
  console.warn(`Problem 1: ${problem1.id}`)
  console.warn(`Problem 2: ${problem2.id}`)
  console.warn(`Problem 3: ${problem3.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })