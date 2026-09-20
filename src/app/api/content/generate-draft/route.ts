import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth-config'
import { generateProblemDraft } from '@/lib/content/generate-problem-draft'

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'teacher') {
    return NextResponse.json({ error: 'Only a teacher can generate content drafts' }, { status: 403 })
  }

  const body = await request.json()
  const { chapterId, rawText } = body as { chapterId: string; rawText: string }

  if (!chapterId || !rawText) {
    return NextResponse.json({ error: 'chapterId and rawText are required' }, { status: 400 })
  }

  const result = await generateProblemDraft({ chapterId, rawText })

  return NextResponse.json(result)
}