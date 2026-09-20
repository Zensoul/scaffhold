// Usage: node scripts/create-scaffolding-level.js <studentProfileId> <chapterId>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const studentId = process.argv[2]
const chapterId = process.argv[3]

if (!studentId || !chapterId) {
  console.error('Usage: node scripts/create-scaffolding-level.js <studentProfileId> <chapterId>')
  process.exit(1)
}

async function main() {
  const existing = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId } },
  })

  if (existing) {
    console.log('ScaffoldingLevel already exists:', existing.id)
    return
  }

  const created = await prisma.scaffoldingLevel.create({
    data: {
      studentId,
      chapterId,
      currentLevel: 0,
    },
  })

  console.log('Created ScaffoldingLevel:', created.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())