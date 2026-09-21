const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const problemId = process.argv[2]

async function main() {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } } },
  })
  console.log(JSON.stringify(problem, null, 2))
}

main().finally(() => prisma.$disconnect())