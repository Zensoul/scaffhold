// Usage: node scripts/check-recent-sessions.js <studentProfileId>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const studentId = process.argv[2]

if (!studentId) {
  console.error('Usage: node scripts/check-recent-sessions.js <studentProfileId>')
  process.exit(1)
}

async function main() {
  const sessions = await prisma.session.findMany({
    where: { studentId },
    orderBy: { startedAt: 'desc' },
    take: 5,
  })

  for (const s of sessions) {
    console.log('---')
    console.log('ID:', s.id)
    console.log('Started:', s.startedAt)
    console.log('Ended:', s.endedAt)
    console.log('EndReason:', s.endReason)
    console.log('problemsAttempted:', s.problemsAttempted)
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findFirst({
    where: { studentId },
  })
  console.log('=== Current ScaffoldingLevel ===')
  console.log('currentLevel:', scaffoldingLevel?.currentLevel.toString())
  console.log('consecutiveFailures:', scaffoldingLevel?.consecutiveFailures)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())