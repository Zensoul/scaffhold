'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GuidedDiagram } from '@/components/guided-diagram'
import { CheckCircle, XCircle, Lightbulb, BookOpen, ArrowRight, FileText, HelpCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepOption = { id: string; optionText: string; orderIndex: number }

type GuidedStep = {
  stepId: string
  sequenceOrder: number
  stepType: 'concept' | 'substitution' | 'computation'
  stepLabel: string
  prompt: string
  inputType: 'mcq' | 'numeric'
  svgStage: number
  options: StepOption[]
  formulaCard: string | null
  hintText: string | null
  hintText2: string | null
  hintText3: string | null
  hintWasRephrased: boolean
  errorFeedback: string | null
  workedExample: { text: string; svgStage: number } | null
  selfExplain: { prompt: string; answer: string; followUp: { prompt: string; answer: string; inputType: string; tolerance: number } | null } | null
  errorType: 'formula' | 'substitution' | 'arithmetic' | null
  attemptCount: number
  totalSteps: number
  answeredSoFar: number
}

type ProblemInfo = {
  rawText: string
  concreteRestatement: string | null
  givens: string[]
  impliedGivens: string[]
  unknownAnnotation: string
  diagramConfig: { r: number; theta: number; isMajorSegment?: boolean; problemType?: 'sector' | 'arc' | 'segment' | 'combination' }
}

type GetResponse =
  | { problemComplete: true; totalSteps: number; answeredSoFar: number; problem: ProblemInfo }
  | { problemComplete: false; totalSteps: number; answeredSoFar: number; problem: ProblemInfo; step: GuidedStep }

type PostResponse =
  | { isCorrect: true }
  | {
      isCorrect: false
      errorFeedback: string
      errorType: 'formula' | 'substitution' | 'arithmetic' | null
      hintText: string | null
      hintText2: string | null
      hintText3: string | null
      workedExample: { text: string; svgStage: number } | null
      selfExplain: { prompt: string; answer: string; followUp: { prompt: string; answer: string; inputType: string; tolerance: number } | null } | null
      attemptCount: number
    }

// ─── Step-type badge colours ──────────────────────────────────────────────────

const STEP_TYPE_COLOR: Record<string, string> = {
  concept: 'bg-purple-100 text-purple-800 border-purple-200',
  substitution: 'bg-blue-100 text-blue-800 border-blue-200',
  computation: 'bg-green-100 text-green-800 border-green-200',
}
const STEP_TYPE_LABEL: Record<string, string> = {
  concept: 'Which formula?',
  substitution: 'Fill in values',
  computation: 'Calculate',
}
const STEP_TYPE_EXPLANATION: Record<string, string> = {
  concept: 'Identify the right approach before calculating anything.',
  substitution: 'Plug the known values into the formula.',
  computation: 'Work out the number — use a calculator if needed.',
}

// ─── Adaptive error nudge messages ───────────────────────────────────────────

const ERROR_TYPE_NUDGE: Record<string, string> = {
  formula: 'Double-check which formula you\'re using — the numbers suggest a wrong operation.',
  substitution: 'Check the values you substituted — something may have been swapped or missed.',
  arithmetic: 'The approach looks right! Check your arithmetic — a small slip somewhere.',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuidedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const problemId = params.id as string
  const sessionId = searchParams.get('sessionId') ?? ''

  const [data, setData] = useState<GetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showProblem, setShowProblem] = useState(true)

  // Input state
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [numericAnswer, setNumericAnswer] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Feedback state (shown after a wrong answer, cleared on next GET)
  const [feedback, setFeedback] = useState<{
    errorFeedback: string
    errorType: 'formula' | 'substitution' | 'arithmetic' | null
    hintText: string | null
    hintText2: string | null
    hintText3: string | null
    workedExample: { text: string; svgStage: number } | null
    selfExplain: { prompt: string; answer: string; followUp: { prompt: string; answer: string; inputType: string; tolerance: number } | null } | null
    attemptCount: number
  } | null>(null)

  // Self-explain self-assessment state (Yes / Somewhat / No)
  const [selfExplainResult, setSelfExplainResult] = useState<'Yes' | 'Somewhat' | 'No' | null>(null)
  // Self-explain text input + model answer reveal
  const [selfExplainText, setSelfExplainText] = useState<string>('')
  const [selfExplainSubmitted, setSelfExplainSubmitted] = useState<boolean>(false)
  const [followUpAnswer, setFollowUpAnswer] = useState<string>('')
  const [followUpResult, setFollowUpResult] = useState<'correct' | 'wrong' | null>(null)

  // ── Comprehension phase — before any solve steps ─────────────────────────
  // 'givens' → student reviews each given; 'unknown' → confirms what to find; 'solving' → normal steps
  const [comprehensionPhase, setComprehensionPhase] = useState<'givens' | 'unknown' | 'solving'>('givens')
  const [givenIndex, setGivenIndex] = useState(0)

  // Confidence gate — concept steps require student to self-assess before attempting
  const [confidenceGatePassed, setConfidenceGatePassed] = useState<boolean>(true)
  const [confidenceUnsure, setConfidenceUnsure] = useState<boolean>(false)

  // Diagram stage — updated from step or worked example
  const [diagramStage, setDiagramStage] = useState(0)
  const [showWorkedExamplePanel, setShowWorkedExamplePanel] = useState(false)
  const workedExampleRef = useRef<HTMLDivElement>(null)
  const [correctFlash, setCorrectFlash] = useState(false)

  // ── Fetch current step ─────────────────────────────────────────────────────
  async function fetchStep() {
    setLoading(true)
    setFeedback(null)
    setSelectedOption('')
    setNumericAnswer('')
    setShowWorkedExamplePanel(false)
    setSelfExplainResult(null)
    setSelfExplainText('')
    setSelfExplainSubmitted(false)
    setFollowUpAnswer('')
    setFollowUpResult(null)
    setConfidenceGatePassed(true)  // will be overridden after fetch for concept steps
    setConfidenceUnsure(false)
    // Note: comprehension phase only resets on first load (givenIndex/comprehensionPhase
    // are intentionally persistent so revisiting a step doesn't replay comprehension)
    try {
      const res = await fetch(`/api/problems/${problemId}/guided?sessionId=${sessionId}`)
      if (!res.ok) throw new Error(await res.text())
      const rawJson: GetResponse = await res.json()
      // Shuffle MCQ options (deterministic per step so re-fetch gives same order)
      let json = rawJson
      if (!rawJson.problemComplete && rawJson.step?.options?.length) {
        const narrowed = rawJson as Extract<GetResponse, { problemComplete: false }>
        const seed = narrowed.step.prompt.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
        const arr = [...narrowed.step.options]
        // Seeded Fisher-Yates — lcg avoids integer overflow
        let rng = seed
        for (let i = arr.length - 1; i > 0; i--) {
          rng = (rng * 1664525 + 1013904223) & 0x7fffffff
          const j = rng % (i + 1)
          ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
        json = { ...narrowed, step: { ...narrowed.step, options: arr } }
      }
      setData(json)
      if (!json.problemComplete) {
        setDiagramStage(json.step.svgStage)
        // Concept steps start behind the confidence gate; all others pass immediately
        const isConcept = json.step.stepType === 'concept'
        setConfidenceGatePassed(!isConcept)
        setConfidenceUnsure(false)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStep() }, [problemId, sessionId])

  // Focus numeric input when step loads
  useEffect(() => {
    if (!loading && data && !data.problemComplete && data.step.inputType === 'numeric') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [loading, data])

  // ── Submit answer ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting || !data || data.problemComplete) return
    const step = (data as { problemComplete: false; step: GuidedStep }).step
    const answer = step.inputType === 'mcq' ? selectedOption : numericAnswer.trim()
    if (!answer) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/problems/${problemId}/guided`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stepId: step.stepId, answer }),
      })
      const json: PostResponse = await res.json()

      if (json.isCorrect) {
        setCorrectFlash(true)
        setTimeout(() => {
          setCorrectFlash(false)
          fetchStep()
        }, 900)
      } else {
        setFeedback({
          errorFeedback: json.errorFeedback,
          errorType: json.errorType,
          hintText: json.hintText,
          hintText2: json.hintText2,
          hintText3: json.hintText3,
          workedExample: json.workedExample,
          selfExplain: json.selfExplain,
          attemptCount: json.attemptCount,
        })
        if (json.workedExample) {
          setDiagramStage(json.workedExample.svgStage)
        }
        setSelfExplainResult(null)
        setSelectedOption('')
        setNumericAnswer('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Self-explain check ─────────────────────────────────────────────────────

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground text-sm">Loading step…</div>
      </div>
    )
  }

  if (!data) return null

  // ── Problem complete ───────────────────────────────────────────────────────
  if (data.problemComplete) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-10 text-center">
        <GuidedDiagram stage={7} problemComplete={true} className="max-w-xs" config={data.problem.diagramConfig} />
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Problem solved!</h2>
          <p className="text-muted-foreground">
            You worked through all {data.totalSteps} steps. Well done.
          </p>
          {data.problem.concreteRestatement && (
            <p className="mt-3 text-sm text-muted-foreground italic max-w-sm mx-auto">
              {data.problem.concreteRestatement}
            </p>
          )}
        </div>
        <Button onClick={() => window.location.href = '/student-dashboard'} variant="outline">
          Back to problems
        </Button>
      </div>
    )
  }

  const step = data.step

  // ── Comprehension phase ────────────────────────────────────────────────────
  // Shown before any solve steps — helps student identify givens and unknown
  const allGivens = [...(data.problem.givens ?? []), ...(data.problem.impliedGivens ?? [])]

  if (comprehensionPhase !== 'solving') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 py-10">
        <div className="w-full max-w-xl space-y-6">

          {/* Problem statement */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Problem</p>
            <p className="text-sm text-gray-800 leading-relaxed">{data.problem.rawText}</p>
            {data.problem.concreteRestatement && (
              <p className="text-xs text-gray-500 italic mt-1">{data.problem.concreteRestatement}</p>
            )}
          </div>

          {/* Phase: Givens */}
          {comprehensionPhase === 'givens' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-lg">📋</span>
                <h2 className="text-base font-semibold text-blue-900">What information do you have?</h2>
              </div>
              <p className="text-xs text-blue-600">
                Read each piece of given information and confirm you understand it before moving on.
              </p>

              {/* Progress dots */}
              <div className="flex gap-1.5">
                {allGivens.map((_, i) => (
                  <div
                    key={i}
                    className={`w-5 h-1.5 rounded-full transition-colors ${
                      i < givenIndex ? 'bg-blue-500' : i === givenIndex ? 'bg-blue-700' : 'bg-blue-200'
                    }`}
                  />
                ))}
              </div>

              {allGivens.length > 0 ? (
                <div className="rounded-lg border border-blue-300 bg-white px-4 py-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">
                    Given {givenIndex + 1} of {allGivens.length}
                  </p>
                  <p className="text-sm text-gray-800 font-medium">{allGivens[givenIndex]}</p>
                  <button
                    onClick={() => {
                      if (givenIndex < allGivens.length - 1) {
                        setGivenIndex(i => i + 1)
                      } else {
                        setComprehensionPhase('unknown')
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                  >
                    {givenIndex < allGivens.length - 1 ? 'Got it — next' : 'I have all the information'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setComprehensionPhase('unknown')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Phase: Unknown */}
          {comprehensionPhase === 'unknown' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 text-lg">🎯</span>
                <h2 className="text-base font-semibold text-amber-900">What do you need to find?</h2>
              </div>
              <p className="text-xs text-amber-600">
                Before solving, be clear about what the question is asking for.
              </p>
              <div className="rounded-lg border border-amber-300 bg-white px-4 py-4 space-y-3">
                <p className="text-sm text-gray-800 font-medium">{data.problem.unknownAnnotation}</p>
                <button
                  onClick={() => setComprehensionPhase('solving')}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  I know what to find — let&#39;s solve
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Skip link */}
          <button
            onClick={() => { setComprehensionPhase('solving') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 block text-center"
          >
            Skip understanding check
          </button>
        </div>
      </div>
    )
  }

  // Determine which worked example and self-explain to show
  // (from GET response for concept steps, from feedback for others)
  const activeWorkedExample = feedback?.workedExample ?? step.workedExample
  const activeSelfExplain = feedback?.selfExplain ?? step.selfExplain

  // Active hint levels — merge GET (persisted) with POST (fresh feedback)
  const activeHint1 = feedback?.hintText ?? step.hintText
  const activeHint2 = feedback?.hintText2 ?? step.hintText2
  const activeHint3 = feedback?.hintText3 ?? step.hintText3

  // Formula card from GET response
  const formulaCard = step.formulaCard

  // ── Active step ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-64px)]">

      {/* ── Left: SVG diagram + formula card ── */}
      <div className="lg:w-1/2 bg-white border-r flex flex-col items-start p-6 gap-4">
        {/* Progress pills */}
        <div className="w-full flex gap-1.5 flex-wrap justify-center">
          {Array.from({ length: data.totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-6 h-2 rounded-full transition-colors ${
                i < data.answeredSoFar
                  ? 'bg-green-500'
                  : i === data.answeredSoFar
                  ? 'bg-primary'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="w-full text-xs text-muted-foreground text-center">
          Step {step.sequenceOrder} of {data.totalSteps}
        </p>

        {/* Formula card — always visible when present */}
        {formulaCard && (
          <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-0.5">Formula</p>
              <p className="text-sm font-mono text-indigo-900">{formulaCard}</p>
            </div>
          </div>
        )}

        {/* Problem statement (collapsible) */}
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
          <button
            onClick={() => setShowProblem((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Problem</span>
            <span className="ml-auto text-gray-400 text-xs">{showProblem ? '▲' : '▼'}</span>
          </button>
          {showProblem && (
            <div className="px-4 pb-3 space-y-1.5">
              <p className="text-sm text-gray-800 font-medium leading-snug">{data.problem.rawText}</p>
              {data.problem.concreteRestatement && (
                <p className="text-xs text-gray-500 italic leading-snug">{data.problem.concreteRestatement}</p>
              )}
            </div>
          )}
        </div>

        {/* Diagram */}
        <div
          className={`w-full transition-all duration-300 ${
            correctFlash ? 'ring-4 ring-green-400 rounded-xl' : ''
          }`}
        >
          <GuidedDiagram
            stage={
              showWorkedExamplePanel && activeWorkedExample
                ? activeWorkedExample.svgStage
                : diagramStage
            }
            problemComplete={false}
            config={data.problem.diagramConfig}
          />
        </div>
      </div>

      {/* ── Right: Step card ── */}
      <div className="lg:w-1/2 flex flex-col">

        {/* Step header */}
        <div className="border-b px-6 py-4 bg-white flex items-start gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`text-xs font-medium px-2 py-0.5 shrink-0 ${STEP_TYPE_COLOR[step.stepType] ?? ''}`}
              >
                {STEP_TYPE_LABEL[step.stepType]}
              </Badge>
              <span className="text-sm font-semibold text-foreground">{step.stepLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">{STEP_TYPE_EXPLANATION[step.stepType]}</p>
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Prompt */}
          <p className="text-base text-foreground leading-relaxed">{step.prompt}</p>

          {/* Feedback from previous wrong attempt */}
          {feedback && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-red-700">{feedback.errorFeedback}</p>
                {feedback.errorType && (
                  <p className="text-xs text-red-500 italic">{ERROR_TYPE_NUDGE[feedback.errorType]}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Confidence gate — concept steps only ────────────────────── */}
          {!confidenceGatePassed && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-600 shrink-0" />
                <p className="text-sm font-semibold text-purple-800">
                  Before you answer — how confident are you about the formula / approach here?
                </p>
              </div>
              {!confidenceUnsure ? (
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    onClick={() => setConfidenceGatePassed(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Confident — let me try
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConfidenceUnsure(true)
                      if (activeWorkedExample) {
                        setShowWorkedExamplePanel(true)
                        setTimeout(() => workedExampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                      }
                    }}
                    className="border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    Not sure — show me
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show formula card inline if no worked example exists for this step */}
                  {!activeWorkedExample && formulaCard && (
                    <div className="rounded-md bg-white border border-purple-200 px-3 py-2">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Key formula</p>
                      <p className="text-sm text-purple-900 font-mono">{formulaCard}</p>
                    </div>
                  )}
                  {!activeWorkedExample && !formulaCard && activeHint1 && (
                    <div className="rounded-md bg-white border border-purple-200 px-3 py-2">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Hint</p>
                      <p className="text-sm text-purple-900">{activeHint1}</p>
                    </div>
                  )}
                  {!activeWorkedExample && !formulaCard && !activeHint1 && (
                    <p className="text-xs text-purple-600">
                      Re-read the question carefully, then click Ready when you feel set.
                    </p>
                  )}
                  {activeWorkedExample && (
                    <p className="text-xs text-purple-600">
                      The worked example below is open. Review it, then click Ready when you feel set.
                    </p>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setConfidenceGatePassed(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Ready — let me try now
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* MCQ options */}
          {confidenceGatePassed && step.inputType === 'mcq' && (
            <div className="space-y-2">
              {step.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.optionText)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selectedOption === opt.optionText
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  {opt.optionText}
                </button>
              ))}
            </div>
          )}

          {/* Numeric input */}
          {confidenceGatePassed && step.inputType === 'numeric' && (
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                type="number"
                step="any"
                placeholder="Enter your answer…"
                value={numericAnswer}
                onChange={(e) => setNumericAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="max-w-[220px]"
              />
              <span className="text-sm text-muted-foreground self-center">cm²</span>
            </div>
          )}

          {/* ── 3-level progressive hints ────────────────────────────────── */}
          {activeHint1 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-yellow-800">{activeHint1}</p>
                {activeHint2 && (
                  <p className="text-sm text-yellow-700 border-t border-yellow-200 pt-2">{activeHint2}</p>
                )}
                {activeHint3 && (
                  <p className="text-sm text-yellow-600 border-t border-yellow-200 pt-2 font-medium">{activeHint3}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Worked example (fading for concept; unlocked after 3 wrong for others) ── */}
          {activeWorkedExample && (
            <div ref={workedExampleRef} className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
              <button
                onClick={() => setShowWorkedExamplePanel((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-100 transition-colors"
              >
                <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-blue-800">
                  {showWorkedExamplePanel ? 'Hide worked example' : 'See a worked example'}
                </span>
                <span className="ml-auto text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
                  Different problem
                </span>
              </button>
              {showWorkedExamplePanel && (
                <div className="px-4 pb-4">
                  <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {activeWorkedExample.text}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── Self-explain MCQ (shown after worked example) ─────────────── */}
          {activeSelfExplain && showWorkedExamplePanel && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-600 shrink-0" />
                <p className="text-sm font-semibold text-purple-800">Reflect:</p>
              </div>
              <p className="text-sm text-purple-700">{activeSelfExplain.prompt}</p>

              {/* Phase 1: student writes explanation before seeing model answer */}
              {!selfExplainSubmitted ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                    rows={3}
                    placeholder="Write your explanation here (at least 8 words)…"
                    value={selfExplainText}
                    onChange={e => setSelfExplainText(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => setSelfExplainSubmitted(true)}
                    disabled={selfExplainText.trim().split(/\s+/).filter(Boolean).length < 8}
                    className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40"
                  >
                    See model answer
                  </Button>
                  {(() => {
                    const wc = selfExplainText.trim().split(/\s+/).filter(Boolean).length
                    const remaining = Math.max(0, 8 - wc)
                    if (remaining === 0) return null
                    return (
                      <p className="text-xs text-purple-400">
                        {remaining} more word{remaining === 1 ? '' : 's'} needed
                      </p>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Student's own explanation */}
                  <div className="rounded-md border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-900">
                    <span className="font-semibold text-purple-600 block mb-1">Your explanation:</span>
                    {selfExplainText}
                  </div>

                  {/* Model answer now revealed */}
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    <span className="font-semibold text-blue-700 block mb-1">Model answer:</span>
                    {activeSelfExplain.answer}
                  </div>

                  <p className="text-xs text-purple-600 font-medium">How well does your explanation match?</p>
                  {selfExplainResult === null ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelfExplainResult('Yes')} className="border-green-300 text-green-700 hover:bg-green-50">Yes</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelfExplainResult('Somewhat')} className="border-amber-300 text-amber-700 hover:bg-amber-50">Somewhat</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelfExplainResult('No')} className="border-red-300 text-red-700 hover:bg-red-50">No</Button>
                    </div>
                  ) : selfExplainResult === 'Yes' ? (
                    <div className="rounded-md px-3 py-2 text-sm bg-green-50 border border-green-200 text-green-800">
                      ✓ Solid understanding.
                    </div>
                  ) : (
                    /* Somewhat / No — show follow-up question */
                    <div className="space-y-3">
                      <div className={`rounded-md px-3 py-2 text-sm ${selfExplainResult === 'Somewhat' ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                        {selfExplainResult === 'Somewhat' ? "👍 Good effort — let’s do one quick check." : "📖 Let’s reinforce this with one more question."}
                      </div>
                      {activeSelfExplain?.followUp && followUpResult === null && (
                        <div className="rounded-md border border-purple-200 bg-white px-3 py-3 space-y-2">
                          <p className="text-sm font-medium text-purple-800">{activeSelfExplain.followUp.prompt}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                              placeholder="Your answer…"
                              value={followUpAnswer}
                              onChange={e => setFollowUpAnswer(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && followUpAnswer.trim()) {
                                  const correct = activeSelfExplain.followUp!
                                  const tol = correct.tolerance ?? 0
                                  const studentNum = parseFloat(followUpAnswer.trim())
                                  const correctNum = parseFloat(correct.answer)
                                  const isCorrect = !isNaN(studentNum) && !isNaN(correctNum)
                                    ? Math.abs(studentNum - correctNum) <= tol
                                    : followUpAnswer.trim().toLowerCase() === correct.answer.toLowerCase()
                                  setFollowUpResult(isCorrect ? 'correct' : 'wrong')
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const correct = activeSelfExplain.followUp!
                                const tol = correct.tolerance ?? 0
                                const studentNum = parseFloat(followUpAnswer.trim())
                                const correctNum = parseFloat(correct.answer)
                                const isCorrect = !isNaN(studentNum) && !isNaN(correctNum)
                                  ? Math.abs(studentNum - correctNum) <= tol
                                  : followUpAnswer.trim().toLowerCase() === correct.answer.toLowerCase()
                                setFollowUpResult(isCorrect ? 'correct' : 'wrong')
                              }}
                              disabled={!followUpAnswer.trim()}
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >Check</Button>
                          </div>
                        </div>
                      )}
                      {followUpResult === 'correct' && (
                        <div className="rounded-md px-3 py-2 text-sm bg-green-50 border border-green-200 text-green-800">
                          ✓ Correct — concept confirmed.
                        </div>
                      )}
                      {followUpResult === 'wrong' && (
                        <div className="rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-800">
                          Not quite. The answer is <strong>{activeSelfExplain?.followUp?.answer}</strong>. Review the model answer above before continuing.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="border-t px-6 py-4 bg-white">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              correctFlash ||
              !confidenceGatePassed ||
              (step.inputType === 'mcq' ? !selectedOption : !numericAnswer.trim())
            }
            className="w-full sm:w-auto"
          >
            {correctFlash ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Correct!
              </>
            ) : submitting ? (
              'Checking…'
            ) : (
              <>
                Submit
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
