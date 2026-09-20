// Usage: node scripts/list-all-users.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['student', 'parent'] } },
    orderBy: { createdAt: 'desc' },
  })

  for (const u of users) {
    console.log('---')
    console.log('Name:', u.fullName)
    console.log('Role:', u.role)
    console.log('Email:', u.email)
    console.log('ID:', u.id)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())