// Usage: node scripts/find-student-profile.js <email>
// Looks up a StudentProfile by the linked User's email.

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const email = process.argv[2]

if (!email) {
  console.error('Usage: node scripts/find-student-profile.js <email>')
  process.exit(1)
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  })

  if (!user) {
    console.log(`No user found with email: ${email}`)
    return
  }

  console.log('User ID:', user.id)
  console.log('Full name:', user.fullName)
  console.log('Role:', user.role)

  if (!user.studentProfile) {
    console.log('No StudentProfile linked to this user.')
    return
  }

  console.log('StudentProfile ID:', user.studentProfile.id)
  console.log('Grade:', user.studentProfile.grade)
  console.log('dpdpConsentGiven:', user.studentProfile.dpdpConsentGiven)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())