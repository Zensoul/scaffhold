// Usage: node scripts/update-user-email.js <currentEmail> <newEmail>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const currentEmail = process.argv[2]
const newEmail = process.argv[3]

if (!currentEmail || !newEmail) {
  console.error('Usage: node scripts/update-user-email.js <currentEmail> <newEmail>')
  process.exit(1)
}

async function main() {
  const updated = await prisma.user.update({
    where: { email: currentEmail },
    data: { email: newEmail },
  })

  console.log(`Updated ${updated.fullName}'s email to:`, updated.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())