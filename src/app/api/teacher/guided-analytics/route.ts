import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Returns guided-solve attempt stats for all students on this teacher's roster.
// Shape per step:
//   stepLabel, problemId, problemTitle
//   avgAttempts, failRate (% of attempts that were wrong), uniqueStudents
//   perStudent: [{ studentName, attempts, solved, firstAttemptCorrect }]
export async function GET(request: Request) {
  const teacherId = await getCurrentTeacherId()

  // Get all student IDs on this teacher's roster
  const students = await prisma.studentProfile.findMany({
    where: { teacherId, isActive: true },
    select: { id: true, user: { select: { fullName: true } } },
  })

  if (students.length === 0) {
    return NextResponse.json({ steps: [] })
  }

  const studentIds = students.map((s) => s.id)
  const nameById = Object.fromEntries(students.map((s) => [s.id, s.user.fullName]))

  // Fetch all attempts for these students, including step info
  const attempts = await prisma.solveAttempt.findMany({
    where: { studentId: { in: studentIds } },
    select: {
      id: true,
      stepId: true,
      studentId: true,
      isCorrect: true,
      createdAt: true,
      step: {
        select: {
          id: true,
          stepLabel: true,
          sequenceOrder: true,
          guidedSolveProblem: {
            select: {
              problemId: true,
              problem: { select: { rawText: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by stepId
  const byStep = new Map<string, typeof attempts>()
  for (const a of attempts) {
    const arr = byStep.get(a.stepId) ?? []
    arr.push(a)
    byStep.set(a.stepId, arr)
  }

  // Build per-step stats, sorted by fail rate desc (most troubled first)
  const steps = Array.from(byStep.entries()).map(([stepId, stepAttempts]) => {
    const step = stepAttempts[0].step
    const totalAttempts = stepAttempts.length
    const wrongAttempts = stepAttempts.filter((a) => !a.isCorrect).length
    const failRate = totalAttempts > 0 ? Math.round((wrongAttempts / totalAttempts) * 100) : 0

    // Per-student breakdown
    const byStudent = new Map<string, typeof stepAttempts>()
    for (const a of stepAttempts) {
      const arr = byStudent.get(a.studentId) ?? []
      arr.push(a)
      byStudent.set(a.studentId, arr)
    }

    const perStudent = Array.from(byStudent.entries()).map(([studentId, studentAttempts]) => {
      const solved = studentAttempts.some((a) => a.isCorrect)
      const firstAttemptCorrect = studentAttempts[0]?.isCorrect ?? false
      return {
        studentName: nameById[studentId] ?? 'Unknown',
        attempts: studentAttempts.length,
        solved,
        firstAttemptCorrect,
      }
    })

    const uniqueStudents = perStudent.length
    const avgAttempts = uniqueStudents > 0
      ? Math.round((totalAttempts / uniqueStudents) * 10) / 10
      : 0

    return {
      stepId,
      stepLabel: step.stepLabel,
      sequenceOrder: step.sequenceOrder,
      problemId: step.guidedSolveProblem.problemId,
      problemTitle: step.guidedSolveProblem.problem.rawText,
      uniqueStudents,
      avgAttempts,
      failRate,
      perStudent,
    }
  })

  // Sort: highest fail rate first
  steps.sort((a, b) => b.failRate - a.failRate || b.avgAttempts - a.avgAttempts)

  return NextResponse.json({ steps })
}
