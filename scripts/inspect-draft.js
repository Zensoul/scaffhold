const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const draftId = process.argv[2]

async function main() {
  const draft = await prisma.problemDraft.findUnique({ where: { id: draftId } })
  console.log(JSON.stringify(draft, null, 2))
}

main().finally(() => prisma.$disconnect())