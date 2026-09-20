// Usage: node scripts/check-flagged-content.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const flagged = await prisma.flaggedContent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (flagged.length === 0) {
    console.log('No FlaggedContent rows found at all.')
    return
  }

  for (const f of flagged) {
    console.log('---')
    console.log('ID:', f.id)
    console.log('Student:', f.studentId)
    console.log('Category:', f.category)
    console.log('Raw text:', f.rawText)
    console.log('Created:', f.createdAt)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())