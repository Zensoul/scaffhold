import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      annotations: {
        orderBy: { sequenceOrder: 'asc' },
      },
    },
  })

  if (!problem || !problem.isActive) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  return NextResponse.json({ problem })
}