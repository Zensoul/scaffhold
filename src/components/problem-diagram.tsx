'use client'

import { useEffect, useState } from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRadius(givens: string[]): number {
  for (const g of givens) {
    const m = g.match(/radius.*?(\d+(?:\.\d+)?)\s*cm/i)
    if (m) return parseFloat(m[1])
  }
  return 6 // default
}

function parseAngle(givens: string[]): number {
  for (const g of givens) {
    const m = g.match(/(\d+(?:\.\d+)?)\s*°/)
    if (m) return parseFloat(m[1])
  }
  return 60
}

function parseSide(givens: string[]): number {
  for (const g of givens) {
    const m = g.match(/side.*?(\d+(?:\.\d+)?)\s*cm/i)
    if (m) return parseFloat(m[1])
  }
  return 14
}

// Convert polar to cartesian relative to a centre point
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// SVG arc path for a sector wedge
function sectorPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const s = polar(cx, cy, r, startAngle)
  const e = polar(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
}

// SVG arc path for segment (chord arc only, no centre)
function segmentPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const s = polar(cx, cy, r, startAngle)
  const e = polar(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
}

// Semicircle path (half circle on one side of a line segment)
function semicirclePath(x1: number, y1: number, x2: number, y2: number, inward: boolean): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const r = Math.hypot(x2 - x1, y2 - y1) / 2
  const sweep = inward ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`
}

const FADE_STYLE = (delay = 0): React.CSSProperties => ({
  animation: `svgFadeIn 0.6s ease ${delay}s both`,
})

const CSS_KEYFRAMES = `
@keyframes svgFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes svgDrawOn {
  from { stroke-dashoffset: 1000; }
  to   { stroke-dashoffset: 0; }
}
`

// ── Sub-diagrams ─────────────────────────────────────────────────────────────

const CX = 160
const CY = 138
const SVG_R = 90 // display radius in SVG units

function SectorDiagram({ angle, stage, isArcLength }: { angle: number; stage: number; isArcLength: boolean }) {
  const startAngle = 0   // top
  const endAngle = angle

  const s = polar(CX, CY, SVG_R, startAngle)
  const e = polar(CX, CY, SVG_R, endAngle)
  const midAngle = angle / 2
  const midLabel = polar(CX, CY, SVG_R * 0.55, midAngle)
  const arcLabel = polar(CX, CY, SVG_R + 14, midAngle)
  const rLabelPos = polar(CX, CY, SVG_R * 0.52, -50)

  const formula = isArcLength
    ? `L = (θ/360) × 2πr`
    : `Area = (θ/360) × πr²`

  return (
    <>
      {/* Stage 0: circle + centre + radius line */}
      <circle cx={CX} cy={CY} r={SVG_R} fill="none" stroke="#60a5fa" strokeWidth="1.8" />
      <circle cx={CX} cy={CY} r="3" fill="#ffffff" />
      <text x={CX + 5} y={CY - 5} fill="#ffffff" fontSize="11" fontFamily="sans-serif">O</text>
      {/* One radius line always visible */}
      <line x1={CX} y1={CY} x2={s.x} y2={s.y} stroke="#ffffff" strokeWidth="1.2" />
      <text x={rLabelPos.x} y={rLabelPos.y} fill="#94a3b8" fontSize="10" fontFamily="sans-serif" textAnchor="middle">r</text>

      {/* Stage 1: sector shaded + second radius + angle label */}
      {stage >= 1 && (
        <g style={FADE_STYLE(0)}>
          <path d={sectorPath(CX, CY, SVG_R, startAngle, endAngle)}
            fill="rgba(161,140,60,0.55)" stroke="#d4b44a" strokeWidth="1" />
          <line x1={CX} y1={CY} x2={e.x} y2={e.y} stroke="#ffffff" strokeWidth="1.2" />
          {/* Arc highlight */}
          <path
            d={`M ${s.x} ${s.y} A ${SVG_R} ${SVG_R} 0 ${angle > 180 ? 1 : 0} 1 ${e.x} ${e.y}`}
            fill="none" stroke="#d4b44a" strokeWidth="2.5"
          />
          {/* Angle label */}
          <text x={midLabel.x} y={midLabel.y} fill="#fbbf24" fontSize="11"
            fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">
            θ={angle}°
          </text>
          {isArcLength && (
            <text x={arcLabel.x} y={arcLabel.y} fill="#60a5fa" fontSize="9"
              fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">
              arc
            </text>
          )}
        </g>
      )}

      {/* Stage 2: formula */}
      {stage >= 2 && (
        <g style={FADE_STYLE(0.1)}>
          <rect x="40" y="246" width="240" height="24" rx="4" fill="rgba(0,0,0,0.6)" />
          <text x={CX} y="262" fill="#e2e8f0" fontSize="12" fontFamily="monospace"
            textAnchor="middle">{formula}</text>
        </g>
      )}
    </>
  )
}

function SegmentDiagram({ angle, stage, isMajor }: { angle: number; stage: number; isMajor: boolean }) {
  const startAngle = -angle / 2
  const endAngle = angle / 2

  const s = polar(CX, CY, SVG_R, startAngle)
  const e = polar(CX, CY, SVG_R, endAngle)

  const midMinorAngle = 0 // top centre of minor segment
  const midMinor = polar(CX, CY, SVG_R * 0.72, midMinorAngle)
  // centroid of triangle OAB (one-third of the way from O toward midpoint of chord)
  const triCentroid = { x: CX, y: CY + (((s.y + e.y) / 2) - CY) / 3 }

  return (
    <>
      {/* Always: circle + centre dot + O label */}
      <circle cx={CX} cy={CY} r={SVG_R} fill="none" stroke="#60a5fa" strokeWidth="1.8" />
      <circle cx={CX} cy={CY} r="3" fill="#ffffff" />
      <text x={CX + 6} y={CY + 4} fill="#ffffff" fontSize="11" fontFamily="sans-serif">O</text>

      {/* Always: chord (makes shape read as segment from stage 0) */}
      <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#f472b6" strokeWidth="1.5" strokeDasharray="4 2" />

      {/* Stage 1: sector highlighted — radii + sector fill + angle label
          Question being asked: "What is the sector area?" */}
      {stage >= 1 && (
        <g style={FADE_STYLE(0)}>
          {/* sector fill (orange) */}
          <path d={sectorPath(CX, CY, SVG_R, startAngle, endAngle)}
            fill="rgba(251,146,60,0.35)" stroke="#fb923c" strokeWidth="1.2" />
          {/* radii on top of fill */}
          <line x1={CX} y1={CY} x2={s.x} y2={s.y} stroke="#fb923c" strokeWidth="1.5" />
          <line x1={CX} y1={CY} x2={e.x} y2={e.y} stroke="#fb923c" strokeWidth="1.5" />
          {/* chord redrawn on top */}
          <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#f472b6" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* angle arc */}
          <path d={sectorPath(CX, CY, SVG_R * 0.28, startAngle, endAngle)}
            fill="rgba(251,146,60,0.25)" stroke="#fb923c" strokeWidth="0.8" />
          {/* angle label */}
          <text x={CX} y={CY - SVG_R * 0.28} fill="#fb923c" fontSize="10"
            fontFamily="sans-serif" textAnchor="middle">{angle}°</text>
          {/* sector label */}
          <text x={CX} y={CY - SVG_R * 0.55} fill="#fb923c" fontSize="9"
            fontFamily="sans-serif" textAnchor="middle">sector</text>
        </g>
      )}

      {/* Stage 2: triangle highlighted inside the sector — blue fill
          Question being asked: "What is the triangle area?" */}
      {stage >= 2 && (
        <g style={FADE_STYLE(0)}>
          {/* triangle fill (blue) — vertices: O, s, e */}
          <polygon
            points={`${CX},${CY} ${s.x},${s.y} ${e.x},${e.y}`}
            fill="rgba(96,165,250,0.35)" stroke="#60a5fa" strokeWidth="1.2"
          />
          {/* triangle label at centroid */}
          <text x={triCentroid.x} y={triCentroid.y + 4} fill="#60a5fa" fontSize="9"
            fontFamily="sans-serif" textAnchor="middle">triangle</text>
        </g>
      )}

      {/* Stage 3: segment highlighted (gold) + formula bar
          Question being asked: "What is the segment area?" */}
      {stage >= 3 && (
        <g style={FADE_STYLE(0)}>
          {/* segment fill (gold), drawn on top */}
          {!isMajor && (
            <path d={segmentPath(CX, CY, SVG_R, startAngle, endAngle)}
              fill="rgba(212,180,74,0.6)" stroke="#d4b44a" strokeWidth="1.5" />
          )}
          {isMajor && (
            <>
              <circle cx={CX} cy={CY} r={SVG_R} fill="rgba(212,180,74,0.35)" />
              <path d={sectorPath(CX, CY, SVG_R, startAngle, endAngle)}
                fill="#0a0a0a" stroke="none" />
              <circle cx={CX} cy={CY} r={SVG_R} fill="none" stroke="#60a5fa" strokeWidth="1.8" />
              <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#f472b6" strokeWidth="1.5" strokeDasharray="4 2" />
            </>
          )}
          {/* segment label */}
          <text x={midMinor.x} y={midMinor.y} fill="#d4b44a" fontSize="9"
            fontFamily="sans-serif" textAnchor="middle">segment</text>
          {/* formula bar */}
          <rect x="18" y="246" width="284" height="24" rx="4" fill="rgba(0,0,0,0.65)" />
          <text x={CX} y="262" fill="#e2e8f0" fontSize="10" fontFamily="monospace"
            textAnchor="middle">Segment = Sector − Triangle</text>
        </g>
      )}
    </>
  )
}

function SquareCircleDiagram({ side, stage }: { side: number; stage: number }) {
  const s = 110 // square half-size in SVG units
  const x0 = CX - s, y0 = CY - s, x1 = CX + s, y1 = CY + s
  const r = s // inscribed circle radius equals half of side

  return (
    <>
      {/* Stage 0: square */}
      <rect x={x0} y={y0} width={s * 2} height={s * 2}
        fill="none" stroke="#60a5fa" strokeWidth="1.8" />
      <text x={CX} y={y0 - 6} fill="#94a3b8" fontSize="10"
        fontFamily="sans-serif" textAnchor="middle">{side} cm</text>

      {/* Stage 1: inscribed circle */}
      {stage >= 1 && (
        <g style={FADE_STYLE(0)}>
          <circle cx={CX} cy={CY} r={r} fill="none" stroke="#f472b6" strokeWidth="1.5" />
        </g>
      )}

      {/* Stage 2: shade corners, formula */}
      {stage >= 2 && (
        <g style={FADE_STYLE(0.1)}>
          {/* corners shaded by clipping square minus circle */}
          <defs>
            <clipPath id="squareclip">
              <rect x={x0} y={y0} width={s * 2} height={s * 2} />
            </clipPath>
          </defs>
          <rect x={x0} y={y0} width={s * 2} height={s * 2}
            fill="rgba(161,140,60,0.45)" clipPath="url(#squareclip)" />
          <circle cx={CX} cy={CY} r={r} fill="#0a0a0a" />
          {/* redraw outlines */}
          <rect x={x0} y={y0} width={s * 2} height={s * 2}
            fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <circle cx={CX} cy={CY} r={r} fill="none" stroke="#f472b6" strokeWidth="1.5" />
          <rect x="30" y="246" width="260" height="24" rx="4" fill="rgba(0,0,0,0.6)" />
          <text x={CX} y="262" fill="#e2e8f0" fontSize="11" fontFamily="monospace"
            textAnchor="middle">Area = side² − πr²</text>
        </g>
      )}
    </>
  )
}

function SemicirclesDiagram({ side, stage }: { side: number; stage: number }) {
  const s = 80
  const x0 = CX - s, y0 = CY - s, x1 = CX + s, y1 = CY + s

  return (
    <>
      {/* Stage 0: square */}
      <rect x={x0} y={y0} width={s * 2} height={s * 2}
        fill="none" stroke="#60a5fa" strokeWidth="1.8" />
      <text x={CX} y={y0 - 6} fill="#94a3b8" fontSize="10"
        fontFamily="sans-serif" textAnchor="middle">{side} cm</text>

      {/* Stage 1: 4 semicircles */}
      {stage >= 1 && (
        <g style={FADE_STYLE(0)} fill="none" stroke="#f472b6" strokeWidth="1.5">
          {/* top */}
          <path d={semicirclePath(x0, y0, x1, y0, true)} />
          {/* bottom */}
          <path d={semicirclePath(x1, y1, x0, y1, true)} />
          {/* left */}
          <path d={semicirclePath(x0, y1, x0, y0, true)} />
          {/* right */}
          <path d={semicirclePath(x1, y0, x1, y1, true)} />
        </g>
      )}

      {/* Stage 2: shade petals, formula */}
      {stage >= 2 && (
        <g style={FADE_STYLE(0.1)}>
          <path d={semicirclePath(x0, y0, x1, y0, true)} fill="rgba(161,140,60,0.45)" />
          <path d={semicirclePath(x1, y1, x0, y1, true)} fill="rgba(161,140,60,0.45)" />
          <path d={semicirclePath(x0, y1, x0, y0, true)} fill="rgba(161,140,60,0.45)" />
          <path d={semicirclePath(x1, y0, x1, y1, true)} fill="rgba(161,140,60,0.45)" />
          {/* redraw outlines */}
          <rect x={x0} y={y0} width={s * 2} height={s * 2} fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <g fill="none" stroke="#f472b6" strokeWidth="1.5">
            <path d={semicirclePath(x0, y0, x1, y0, true)} />
            <path d={semicirclePath(x1, y1, x0, y1, true)} />
            <path d={semicirclePath(x0, y1, x0, y0, true)} />
            <path d={semicirclePath(x1, y0, x1, y1, true)} />
          </g>
          <rect x="18" y="246" width="284" height="24" rx="4" fill="rgba(0,0,0,0.6)" />
          <text x={CX} y="262" fill="#e2e8f0" fontSize="11" fontFamily="monospace"
            textAnchor="middle">Area = 4 × (½πr²) = 2πr²</text>
        </g>
      )}
    </>
  )
}

function PlaceholderDiagram() {
  return (
    <>
      <circle cx={CX} cy={CY} r={SVG_R} fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="6 3" />
      <text x={CX} y={CY + 4} fill="#6b7280" fontSize="13" fontFamily="sans-serif"
        textAnchor="middle" dominantBaseline="middle">Diagram</text>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

const SECTOR_TYPES = new Set([
  'circle_sector_area', 'circle_sector_area_calculation', 'sector_area_calculation',
])
const ARC_TYPES = new Set(['arc_length_calculation', 'arc_length_sector'])
const SEGMENT_TYPES = new Set(['circle_segment_area', 'circle_minor_segment_area'])
const MAJOR_SEGMENT_TYPES = new Set(['circle_major_segment_area'])

export function ProblemDiagram({
  problemType,
  givens,
  stage,
}: {
  problemType: string
  givens: string[]
  stage: number
}) {
  // stage=-1 means hidden (before first reveal)
  if (stage < 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 lg:min-h-[260px]">
        <p className="text-sm text-muted-foreground">Diagram appears as you reveal pieces</p>
      </div>
    )
  }

  // Clamp stage to 0-2
  const s = Math.max(0, Math.min(2, stage))

  let inner: React.ReactNode

  if (SECTOR_TYPES.has(problemType) || ARC_TYPES.has(problemType)) {
    const radius = parseRadius(givens)
    const angle = parseAngle(givens)
    inner = <SectorDiagram angle={angle} stage={s} isArcLength={ARC_TYPES.has(problemType)} />
  } else if (SEGMENT_TYPES.has(problemType)) {
    inner = <SegmentDiagram angle={parseAngle(givens)} stage={s} isMajor={false} />
  } else if (MAJOR_SEGMENT_TYPES.has(problemType)) {
    inner = <SegmentDiagram angle={parseAngle(givens)} stage={s} isMajor={true} />
  } else if (problemType === 'area_region_between_shapes') {
    inner = <SquareCircleDiagram side={parseSide(givens)} stage={s} />
  } else if (problemType === 'geometry_semicircles_shaded_area') {
    inner = <SemicirclesDiagram side={parseSide(givens)} stage={s} />
  } else {
    inner = <PlaceholderDiagram />
  }

  return (
    <div className="overflow-hidden rounded-lg bg-[#0a0a0a]">
      <style>{CSS_KEYFRAMES}</style>
      <svg
        viewBox="0 0 320 280"
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Problem diagram"
      >
        {inner}
      </svg>
    </div>
  )
}
