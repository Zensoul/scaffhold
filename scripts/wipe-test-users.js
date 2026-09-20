// Usage: node scripts/wipe-test-users.js
// Deletes all Users with role student or parent, and everything that
// depends on them, while PRESERVING the Chapter/Subject/Problem/
// ProblemAnnotation content seeded earlier — no need to reseed content
// after running this.

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Deleting dependent records first (foreign key order matters)...')

  await prisma.sessionInteraction.deleteMany({})
  await prisma.scaffoldingHistory.deleteMany({})
  await prisma.aiCall.deleteMany({})
  await prisma.flaggedContent.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.scaffoldingLevel.deleteMany({})
  await prisma.studentInvite.deleteMany({})
  await prisma.parentSummary.deleteMany({})
  await prisma.teacherObservation.deleteMany({})

  console.log('Deleting StudentProfiles...')
  await prisma.studentProfile.deleteMany({})

  console.log('Deleting Accounts and auth sessions...')
  await prisma.account.deleteMany({})
  await prisma.session_NextAuth.deleteMany({})

  console.log('Deleting student/parent Users (keeping teacher accounts)...')
  const result = await prisma.user.deleteMany({
    where: { role: { in: ['student', 'parent'] } },
  })

  console.log(`Deleted ${result.count} student/parent users.`)
  console.log('Chapters, subjects, problems, and annotations are UNTOUCHED.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())