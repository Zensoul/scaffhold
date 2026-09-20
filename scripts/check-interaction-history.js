// Usage: node scripts/check-interaction-history.js <studentProfileId> <problemId>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const studentId = process.argv[2]
const problemId = process.argv[3]

if (!studentId || !problemId) {
  console.error('Usage: node scripts/check-interaction-history.js <studentProfileId> <problemId>')
  process.exit(1)
}

async function main() {
  const interactions = await prisma.sessionInteraction.findMany({
    where: { studentId, problemId },
    include: { annotation: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${interactions.length} interactions for this student/problem:`)
  for (const i of interactions) {
    console.log('---')
    console.log('Annotation:', i.annotation?.annotationText ?? '(none)')
    console.log('isCorrect:', i.isCorrect)
    console.log('Response:', i.studentResponse)
    console.log('Created:', i.createdAt)
  }

  const missesByAnnotation = {}
  for (const i of interactions) {
    if (i.isCorrect === false && i.annotationId) {
      missesByAnnotation[i.annotationId] = (missesByAnnotation[i.annotationId] || 0) + 1
    }
  }
  console.log('=== Miss counts per annotation ===')
  console.log(missesByAnnotation)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())