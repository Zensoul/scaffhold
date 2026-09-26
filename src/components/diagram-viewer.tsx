'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DiagramStage {
  stageIndex: number
  videoUrl: string | null
  label: string
}

interface DiagramViewerProps {
  /** Single video URL (legacy / single-stage diagrams) */
  videoUrl?: string | null
  /** Multi-stage diagrams — takes priority over videoUrl when present */
  stages?: DiagramStage[] | null
}

/**
 * DiagramViewer
 *
 * For single-stage diagrams: renders the video in a loop (original behaviour).
 * For multi-stage diagrams: shows stage 0, with a "Next →" button to advance
 * through stages one at a time — gated reveal so the student sees only what
 * they've progressed to.
 */
export function DiagramViewer({ videoUrl, stages }: DiagramViewerProps) {
  const [currentStage, setCurrentStage] = useState(0)

  // --- Multi-stage path ---
  if (stages && stages.length > 0) {
    const validStages = stages.filter((s) => s.videoUrl)
    if (validStages.length === 0) return null

    const stage = validStages[currentStage] ?? validStages[0]
    const isLast = currentStage >= validStages.length - 1

    return (
      <div className="mb-6 overflow-hidden rounded-lg bg-black min-h-[260px]">
        {/* Stage progress dots */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="text-xs text-gray-400 font-medium">{stage.label}</span>
          <div className="flex gap-1.5">
            {validStages.map((s, i) => (
              <div
                key={s.stageIndex}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i <= currentStage ? 'bg-blue-400' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Video */}
        <video
          key={stage.videoUrl!}
          src={stage.videoUrl!}
          autoPlay
          loop
          muted
          playsInline
          className="w-full"
        />

        {/* Next button */}
        {!isLast && (
          <div className="flex justify-end px-3 py-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCurrentStage((s) => Math.min(s + 1, validStages.length - 1))}
              className="gap-1 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // --- Single-stage / legacy path ---
  if (!videoUrl) return null

  return (
    <div className="mb-6 overflow-hidden rounded-lg bg-black min-h-[260px]">
      <video src={videoUrl} autoPlay loop muted playsInline className="w-full" />
    </div>
  )
}
