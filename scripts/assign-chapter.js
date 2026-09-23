const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// One-off dev script: assigns every active Chapter to a given student,
// as the given teacher — stands in for a real teacher-assignment UI,
// which doesn't exist yet. Run with:
//   node --env-file=.env.local scripts/assign-chapter.js
async function main() {
  const studentUser = await prisma.user.findUnique({
    where: { email: 'zensoulcounselling@gmail.com' },
    include: { studentProfile: true },
  })

  if (!studentUser?.studentProfile) {
    throw new Error('Could not find a StudentProfile for that student user.')
  }

  const teacher = await prisma.user.findUnique({
    where: { email: 'priya@scaffhold.dev' },
  })

  if (!teacher) {
    throw new Error('Could not find the teacher user.')
  }

  const chapters = await prisma.chapter.findMany({ where: { isActive: true } })

  if (chapters.length === 0) {
    console.log('No active chapters found — nothing to assign.')
    return
  }

  for (const chapter of chapters) {
    await prisma.chapterAssignment.upsert({
      where: {
        studentId_chapterId: {
          studentId: studentUser.studentProfile.id,
          chapterId: chapter.id,
        },
      },
      update: {},
      create: {
        studentId: studentUser.studentProfile.id,
        chapterId: chapter.id,
        assignedBy: teacher.id,
      },
    })
    console.log(`Assigned: ${chapter.name}`)
  }

  console.log(`\nDone — ${chapters.length} chapter(s) assigned to ${studentUser.fullName}.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())