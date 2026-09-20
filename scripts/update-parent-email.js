// Usage: node scripts/update-parent-email.js <studentEmail> <newParentEmail>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const studentEmail = process.argv[2]
const newParentEmail = process.argv[3]

if (!studentEmail || !newParentEmail) {
  console.error('Usage: node scripts/update-parent-email.js <studentEmail> <newParentEmail>')
  process.exit(1)
}

async function main() {
  const studentUser = await prisma.user.findUnique({
    where: { email: studentEmail },
    include: { studentProfile: true },
  })

  if (!studentUser?.studentProfile?.parentId) {
    console.log('No parent linked to this student.')
    return
  }

  const updated = await prisma.user.update({
    where: { id: studentUser.studentProfile.parentId },
    data: { email: newParentEmail },
  })

  console.log('Updated parent email to:', updated.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())