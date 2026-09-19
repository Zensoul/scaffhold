import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { fullName, email, password, role, grade } = body as {
    fullName: string
    email: string
    password: string
    role: 'student' | 'parent' | 'teacher'
    grade?: number // required only if role === 'student'
  }

  if (!fullName || !email || !password || !role) {
    return NextResponse.json(
      { error: 'fullName, email, password, and role are required' },
      { status: 400 }
    )
  }

  if (!['student', 'parent', 'teacher'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role === 'student' && !grade) {
    return NextResponse.json(
      { error: 'grade is required when signing up as a student' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Transaction: User and (for students) StudentProfile must both
  // succeed together — a User with role=student but no StudentProfile
  // would be a broken account, unable to use any part of the product
  // that reads studentId from StudentProfile (which is everything).
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: role as Role,
      },
    })

    let studentProfile = null

    if (role === 'student') {
      studentProfile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          grade: grade!,
          // dpdpConsentGiven defaults to false — real consent capture
          // (per the original architecture doc's Section 8) is a
          // separate, not-yet-built flow; signing up alone does not
          // constitute consent and this field must not be defaulted to
          // true just because an account was created.
        },
      })
    }

    return { user, studentProfile }
  })

  return NextResponse.json({
    userId: result.user.id,
    studentProfileId: result.studentProfile?.id ?? null,
  })
}