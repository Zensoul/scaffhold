// Usage: node scripts/set-scaffolding-level.js <studentProfileId> <chapterId> <level>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const studentId = process.argv[2]
const chapterId = process.argv[3]
const level = parseFloat(process.argv[4])

if (!studentId || !chapterId || isNaN(level)) {
  console.error('Usage: node scripts/set-scaffolding-level.js <studentProfileId> <chapterId> <level>')
  process.exit(1)
}

async function main() {
  const result = await prisma.scaffoldingLevel.upsert({
    where: { studentId_chapterId: { studentId, chapterId } },
    update: { currentLevel: level, consecutiveFailures: 0 },
    create: { studentId, chapterId, currentLevel: level },
  })

  console.log('ScaffoldingLevel set:', result.id, 'currentLevel:', result.currentLevel.toString())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())