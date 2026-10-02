'use client'
import type { JSX } from 'react'

/**
 * GuidedDiagram — SVG component for the circle-geometry guided solve mode.
 *
 * Supports four problem types via `config.problemType`:
 *   'segment'     — 8 stages (0–7): segment problems (default)
 *   'sector'      — 4 stages (0–3): sector area problems
 *   'arc'         — 3 stages (0–2): arc length problems
 *   'combination' — 4 stages (0–3): compound figure problems
 *
 * Stage maps
 * ──────────
 * SEGMENT (default, 8 stages):
 *  0 — Full circle + chord + segment shaded gold (overview)
 *  1 — Sector highlighted, angle arc labeled θ, radii labeled r
 *  2 — Sector + formula bar "(θ/360) × π × r² = ?"
 *  3 — Triangle, right-angle box at O (only if 90°), both radii labeled r
 *  4 — Triangle + formula label with sin formula
 *  5 — Triangle + substituted values
 *  6 — Split view: sector minus triangle → segment
 *  7 — Gold segment highlighted; answer shown only after problemComplete
 *
 * SECTOR (4 stages):
 *  0 — Full circle + overview label
 *  1 — Sector highlighted, angle arc labeled θ, radii labeled r
 *  2 — Sector + formula bar "Sector area = (θ/360) × π × r²"
 *  3 — Gold sector highlighted; answer shown only after problemComplete
 *
 * ARC (3 stages):
 *  0 — Full circle with arc highlighted in gold
 *  1 — Arc with angle arc labeled θ, radius labeled r
 *  2 — Arc + formula bar "Arc length = (θ/360) × 2πr"
 *
 * COMBINATION (4 stages):
 *  0 — Generic circle overview
 *  1 — Circle + inner shape (square/triangle) overlay
 *  2 — Split: shape minus inner → shaded region
 *  3 — Final shaded region highlighted
 */

interface DiagramConfig {
  r: number                    // radius in cm
  theta: number                // central angle in degrees
  answerCm2?: string           // final answer label
  isMajorSegment?: boolean     // true for major-segment problems
  problemType?: 'sector' | 'arc' | 'segment' | 'combination' | 'circles-in-square' | 'mirror' | 'lens' | 'cylinder-hemispheres' | 'hemisphere-cone' | 'cube-hemisphere' | 'cylinder-base-hemisphere' | 'frustum' | 'frustum-cylinder' | 'none'
}

interface GuidedDiagramProps {
  stage: number
  problemComplete?: boolean
  className?: string
  config?: DiagramConfig
}

// ── SVG geometry constants ─────────────────────────────────────────────────────

const CX = 200
const CY = 185
const R  = 130

const DEFAULT_CONFIG: DiagramConfig = {
  r: 15,
  theta: 90,
  answerCm2: '64.13 cm²',
  isMajorSegment: false,
  problemType: 'segment',
}

const GOLD   = '#F59E0B'
const ORANGE = '#F97316'
const BLUE   = '#3B82F6'
const GREY   = '#6B7280'

// ── Geometry helpers ───────────────────────────────────────────────────────────

function getArcEndpoints(theta: number) {
  const startAngleRad = -Math.PI / 2
  const endAngleRad   = startAngleRad + (theta * Math.PI / 180)
  return {
    startX: CX + R * Math.cos(startAngleRad),
    startY: CY + R * Math.sin(startAngleRad),
    endX:   CX + R * Math.cos(endAngleRad),
    endY:   CY + R * Math.sin(endAngleRad),
    largeArc: theta > 180 ? 1 : 0,
  }
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CircleBase({ opacity = 1 }: { opacity?: number }) {
  return (
    <circle cx={CX} cy={CY} r={R} fill="none" stroke="#D1D5DB" strokeWidth={2} opacity={opacity} />
  )
}

function Chord({ theta }: { theta: number }) {
  const { startX, startY, endX, endY } = getArcEndpoints(theta)
  return <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#374151" strokeWidth={2} />
}

function Centre() {
  return <circle cx={CX} cy={CY} r={4} fill="#374151" />
}

function Segment({ theta, fill = GOLD, opacity = 1, majorSegment = false }: { theta: number; fill?: string; opacity?: number; majorSegment?: boolean }) {
  const { startX, startY, endX, endY, largeArc } = getArcEndpoints(theta)
  return (
    <path
      d={`M ${startX} ${startY} A ${R} ${R} 0 ${majorSegment ? 1 : largeArc} ${majorSegment ? 0 : 1} ${endX} ${endY} Z`}
      fill={fill}
      opacity={opacity}
    />
  )
}

function Sector({ theta, fill = ORANGE, opacity = 1 }: { theta: number; fill?: string; opacity?: number }) {
  const { startX, startY, endX, endY, largeArc } = getArcEndpoints(theta)
  return (
    <path
      d={`M ${CX} ${CY} L ${startX} ${startY} A ${R} ${R} 0 ${largeArc} 1 ${endX} ${endY} Z`}
      fill={fill}
      opacity={opacity}
    />
  )
}

function Triangle({ theta, fill = BLUE, opacity = 1 }: { theta: number; fill?: string; opacity?: number }) {
  const { startX, startY, endX, endY } = getArcEndpoints(theta)
  return (
    <polygon
      points={`${CX},${CY} ${startX},${startY} ${endX},${endY}`}
      fill={fill}
      opacity={opacity}
    />
  )
}

function RightAngleBox({ show }: { show: boolean }) {
  if (!show) return null
  const s = 14
  return (
    <polygon
      points={`${CX},${CY} ${CX},${CY - s} ${CX + s},${CY - s} ${CX + s},${CY}`}
      fill="none"
      stroke="#1E40AF"
      strokeWidth={2}
    />
  )
}

function AngleArc({ theta }: { theta: number }) {
  const r2 = 36
  const startAngleRad = -Math.PI / 2
  const endAngleRad   = startAngleRad + (theta * Math.PI / 180)
  const arcEndX = CX + r2 * Math.cos(endAngleRad)
  const arcEndY = CY + r2 * Math.sin(endAngleRad)
  const midAngle = startAngleRad + (theta * Math.PI / 360)
  const labelR = 52
  const labelX = CX + labelR * Math.cos(midAngle)
  const labelY = CY + labelR * Math.sin(midAngle)
  return (
    <>
      <path
        d={`M ${CX} ${CY - r2} A ${r2} ${r2} 0 ${theta > 180 ? 1 : 0} 1 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke={ORANGE}
        strokeWidth={2}
      />
      <text x={labelX} y={labelY} fontSize={13} fill={ORANGE} fontWeight="bold" textAnchor="middle">
        {theta}°
      </text>
    </>
  )
}

function RadiusLabel({ theta, r, side }: { theta: number; r: number; side: 'left' | 'right' }) {
  const { startX, startY, endX, endY } = getArcEndpoints(theta)
  const x2 = side === 'left' ? startX : endX
  const y2 = side === 'left' ? startY : endY
  const mx = (CX + x2) / 2
  const my = (CY + y2) / 2
  const dx = x2 - CX, dy = y2 - CY
  const len = Math.sqrt(dx * dx + dy * dy)
  const px = (-dy / len) * 18
  const py = (dx / len) * 18
  const sign = side === 'left' ? -1 : 1
  return (
    <>
      <line x1={CX} y1={CY} x2={x2} y2={y2} stroke={GREY} strokeWidth={2} strokeDasharray="5 3" />
      <text x={mx + sign * px} y={my + sign * py} fontSize={13} fill={GREY} textAnchor="middle">
        {r} cm
      </text>
    </>
  )
}

function FormulaBar({ text, color = '#1F2937' }: { text: string; color?: string }) {
  return (
    <>
      <rect x={20} y={334} width={360} height={36} rx={8} fill="#F3F4F6" />
      <text x={200} y={357} textAnchor="middle" fontSize={13} fontFamily="monospace" fill={color} fontWeight="bold">
        {text}
      </text>
    </>
  )
}

// ── Arc highlight (for arc-length problems) ───────────────────────────────────

function ArcHighlight({ theta }: { theta: number }) {
  const { startX, startY, endX, endY, largeArc } = getArcEndpoints(theta)
  return (
    <path
      d={`M ${startX} ${startY} A ${R} ${R} 0 ${largeArc} 1 ${endX} ${endY}`}
      fill="none"
      stroke={GOLD}
      strokeWidth={6}
      strokeLinecap="round"
    />
  )
}

// ── Stage renderers per problem type ──────────────────────────────────────────

type StageProps = {
  problemComplete?: boolean
  config: DiagramConfig
}

// ── SEGMENT stages (0–7) ──────────────────────────────────────────────────────

const segmentStages: Record<number, (props: StageProps) => JSX.Element> = {

  0: ({ config: { theta, isMajorSegment } }) => (
    <>
      <CircleBase />
      <Segment theta={theta} fill={GOLD} opacity={0.7} majorSegment={!!isMajorSegment} />
      <Chord theta={theta} />
      <Centre />
      <text x={CX} y={CY - 10} fontSize={12} fill="#92400E" fontWeight="bold" textAnchor="middle">
        segment
      </text>
    </>
  ),

  1: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={ORANGE} opacity={0.3} />
      <Chord theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <AngleArc theta={theta} />
      <Centre />
      <text x={CX - 10} y={CY + 20} fontSize={12} fill="#9A3412">O</text>
    </>
  ),

  2: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={ORANGE} opacity={0.4} />
      <Chord theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <AngleArc theta={theta} />
      <Centre />
      <FormulaBar text="Sector area = (θ/360) × π × r²" color={ORANGE} />
    </>
  ),

  3: ({ config: { theta, r } }) => (
    <>
      <CircleBase opacity={0.3} />
      <Triangle theta={theta} fill={BLUE} opacity={0.3} />
      <Chord theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <RightAngleBox show={theta === 90} />
      <Centre />
      <text x={CX - 10} y={CY + 20} fontSize={12} fill="#1E40AF">O</text>
    </>
  ),

  4: ({ config: { theta, r } }) => (
    <>
      <CircleBase opacity={0.3} />
      <Triangle theta={theta} fill={BLUE} opacity={0.35} />
      <Chord theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <RightAngleBox show={theta === 90} />
      <Centre />
      <FormulaBar text={`Area = ½ × ${r}² × sin(${theta}°)`} color={BLUE} />
    </>
  ),

  5: ({ config: { theta, r } }) => (
    <>
      <CircleBase opacity={0.3} />
      <Triangle theta={theta} fill={BLUE} opacity={0.35} />
      <Chord theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <RightAngleBox show={theta === 90} />
      <Centre />
      <FormulaBar text={`½ × ${r * r} × sin(${theta}°) = ?`} color={BLUE} />
    </>
  ),

  6: ({ config: { theta, isMajorSegment } }) => (
    <>
      <g transform="translate(-14, 107) scale(0.42)">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#D1D5DB" strokeWidth={2} opacity={0.5} />
        <Sector theta={theta} fill={ORANGE} opacity={0.6} />
        <Chord theta={theta} />
        <circle cx={CX} cy={CY} r={4} fill="#374151" />
      </g>
      <text x={70} y={122} fontSize={11} fill={ORANGE} fontWeight="bold" textAnchor="middle">Sector</text>

      <text x={135} y={192} fontSize={24} fill="#374151" textAnchor="middle" dominantBaseline="middle">&#x2212;</text>

      <g transform="translate(116, 107) scale(0.42)">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#D1D5DB" strokeWidth={2} opacity={0.3} />
        <Triangle theta={theta} fill={BLUE} opacity={0.6} />
        <Chord theta={theta} />
        <circle cx={CX} cy={CY} r={4} fill="#374151" />
      </g>
      <text x={200} y={122} fontSize={11} fill={BLUE} fontWeight="bold" textAnchor="middle">Triangle</text>

      <text x={265} y={192} fontSize={24} fill="#374151" textAnchor="middle" dominantBaseline="middle">=</text>

      <g transform="translate(246, 107) scale(0.42)">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#D1D5DB" strokeWidth={2} opacity={0.5} />
        <Segment theta={theta} fill={GOLD} opacity={0.75} majorSegment={!!isMajorSegment} />
        <Chord theta={theta} />
        <circle cx={CX} cy={CY} r={4} fill="#374151" />
      </g>
      <text x={330} y={122} fontSize={11} fill="#92400E" fontWeight="bold" textAnchor="middle">Segment</text>

      <text x={200} y={330} fontSize={12} fill="#6B7280" textAnchor="middle">{isMajorSegment ? 'Major segment = Circle − Minor segment' : 'Minor segment = Sector − Triangle'}</text>
    </>
  ),

  7: ({ problemComplete, config: { theta, answerCm2, isMajorSegment } }) => (
    <>
      <CircleBase />
      <Segment theta={theta} fill={GOLD} opacity={0.9} majorSegment={!!isMajorSegment} />
      <Chord theta={theta} />
      <Centre />
      {problemComplete && (
        <>
          <circle cx={CX} cy={CY + 24} r={16} fill="#10B981" />
          <text x={CX} y={CY + 30} textAnchor="middle" fontSize={18} fill="white" fontWeight="bold">✓</text>
          {answerCm2 && (
            <text x={CX} y={CY - R - 16} textAnchor="middle" fontSize={13} fill="#92400E" fontWeight="bold">
              Segment = {answerCm2}
            </text>
          )}
        </>
      )}
    </>
  ),
}

// ── SECTOR stages (0–3) ───────────────────────────────────────────────────────

const sectorStages: Record<number, (props: StageProps) => JSX.Element> = {

  // Stage 0: Full circle with sector shape overview
  0: ({ config: { theta } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={ORANGE} opacity={0.5} />
      <Centre />
      <text x={CX} y={CY + 30} fontSize={12} fill="#9A3412" fontWeight="bold" textAnchor="middle">
        sector
      </text>
    </>
  ),

  // Stage 1: Sector + angle arc + radii labels
  1: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={ORANGE} opacity={0.35} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <AngleArc theta={theta} />
      <Centre />
      <text x={CX - 10} y={CY + 20} fontSize={12} fill="#9A3412">O</text>
    </>
  ),

  // Stage 2: Sector + formula
  2: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={ORANGE} opacity={0.45} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <AngleArc theta={theta} />
      <Centre />
      <FormulaBar text="Sector area = (θ/360) × π × r²" color={ORANGE} />
    </>
  ),

  // Stage 3: Final gold sector; answer on completion
  3: ({ problemComplete, config: { theta, r, answerCm2 } }) => (
    <>
      <CircleBase />
      <Sector theta={theta} fill={GOLD} opacity={0.85} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <RadiusLabel theta={theta} r={r} side="right" />
      <Centre />
      {problemComplete && (
        <>
          <circle cx={CX} cy={CY + 24} r={16} fill="#10B981" />
          <text x={CX} y={CY + 30} textAnchor="middle" fontSize={18} fill="white" fontWeight="bold">✓</text>
          {answerCm2 && (
            <text x={CX} y={CY - R - 16} textAnchor="middle" fontSize={13} fill="#9A3412" fontWeight="bold">
              Sector = {answerCm2}
            </text>
          )}
        </>
      )}
    </>
  ),
}

// ── ARC stages (0–2) ──────────────────────────────────────────────────────────

const arcStages: Record<number, (props: StageProps) => JSX.Element> = {

  // Stage 0: Full circle with arc highlighted
  0: ({ config: { theta } }) => (
    <>
      <CircleBase />
      <ArcHighlight theta={theta} />
      <Centre />
      <text x={CX} y={CY + 30} fontSize={12} fill="#92400E" fontWeight="bold" textAnchor="middle">
        arc
      </text>
    </>
  ),

  // Stage 1: Arc + angle arc + radius label
  1: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <ArcHighlight theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <AngleArc theta={theta} />
      <Centre />
      <text x={CX - 10} y={CY + 20} fontSize={12} fill="#9A3412">O</text>
    </>
  ),

  // Stage 2: Arc + formula
  2: ({ config: { theta, r } }) => (
    <>
      <CircleBase />
      <ArcHighlight theta={theta} />
      <RadiusLabel theta={theta} r={r} side="left" />
      <AngleArc theta={theta} />
      <Centre />
      <FormulaBar text={`Arc length = (${theta}/360) × 2 × π × ${r}`} color={GOLD} />
    </>
  ),
}

// ── COMBINATION stages (0–3) ──────────────────────────────────────────────────

const combinationStages: Record<number, (props: StageProps) => JSX.Element> = {

  // Stage 0: Overview — full circle with inscribed square hint
  0: () => {
    const half = R * Math.cos(Math.PI / 4)
    return (
      <>
        <CircleBase />
        <rect
          x={CX - half} y={CY - half}
          width={half * 2} height={half * 2}
          fill={BLUE} opacity={0.15}
          stroke={BLUE} strokeWidth={1.5} strokeDasharray="6 3"
        />
        <Centre />
        <text x={CX} y={CY - half - 14} fontSize={12} fill="#1E40AF" fontWeight="bold" textAnchor="middle">
          compound figure
        </text>
      </>
    )
  },

  // Stage 1: Circle + square overlay, label each region
  1: ({ config: { r } }) => {
    const half = R * Math.cos(Math.PI / 4)
    return (
      <>
        <CircleBase />
        <rect
          x={CX - half} y={CY - half}
          width={half * 2} height={half * 2}
          fill={BLUE} opacity={0.25}
          stroke={BLUE} strokeWidth={2}
        />
        <Centre />
        <text x={CX + half + 18} y={CY} fontSize={11} fill={BLUE} fontWeight="bold" textAnchor="middle">
          r = {r}
        </text>
        <text x={CX} y={CY + 20} fontSize={11} fill="#1E40AF" textAnchor="middle">inner shape</text>
        <text x={CX} y={CY - R - 14} fontSize={11} fill={GREY} textAnchor="middle">outer shape</text>
      </>
    )
  },

  // Stage 2: Split diagram — outer minus inner = shaded region
  2: () => {
    const half = R * Math.cos(Math.PI / 4) * 0.42
    const cx1 = 70, cx2 = 200, cx3 = 330
    const cy = 185
    const r2 = R * 0.42
    return (
      <>
        {/* Panel 1: outer circle */}
        <circle cx={cx1} cy={cy} r={r2} fill={ORANGE} opacity={0.5} />
        <circle cx={cx1} cy={cy} r={r2} fill="none" stroke="#D1D5DB" strokeWidth={1.5} />
        <text x={cx1} y={cy - r2 - 8} fontSize={11} fill={ORANGE} fontWeight="bold" textAnchor="middle">Outer</text>

        <text x={135} y={cy + 4} fontSize={24} fill="#374151" textAnchor="middle" dominantBaseline="middle">&#x2212;</text>

        {/* Panel 2: inner square */}
        <rect x={cx2 - half} y={cy - half} width={half * 2} height={half * 2} fill={BLUE} opacity={0.5} />
        <text x={cx2} y={cy - half - 8} fontSize={11} fill={BLUE} fontWeight="bold" textAnchor="middle">Inner</text>

        <text x={265} y={cy + 4} fontSize={24} fill="#374151" textAnchor="middle" dominantBaseline="middle">=</text>

        {/* Panel 3: shaded region */}
        <circle cx={cx3} cy={cy} r={r2} fill={GOLD} opacity={0.6} />
        <rect x={cx3 - half} y={cy - half} width={half * 2} height={half * 2} fill="white" opacity={0.7} />
        <text x={cx3} y={cy - r2 - 8} fontSize={11} fill="#92400E" fontWeight="bold" textAnchor="middle">Region</text>

        <text x={200} y={330} fontSize={12} fill={GREY} textAnchor="middle">Region = Outer − Inner</text>
      </>
    )
  },

  // Stage 3: Gold shaded region + completion check
  3: ({ problemComplete, config: { answerCm2 } }) => {
    const half = R * Math.cos(Math.PI / 4)
    return (
      <>
        <CircleBase />
        <circle cx={CX} cy={CY} r={R} fill={GOLD} opacity={0.55} />
        <rect
          x={CX - half} y={CY - half}
          width={half * 2} height={half * 2}
          fill="white" opacity={0.75}
        />
        <Centre />
        {problemComplete && (
          <>
            <circle cx={CX} cy={CY + 24} r={16} fill="#10B981" />
            <text x={CX} y={CY + 30} textAnchor="middle" fontSize={18} fill="white" fontWeight="bold">✓</text>
            {answerCm2 && (
              <text x={CX} y={CY - R - 16} textAnchor="middle" fontSize={13} fill="#92400E" fontWeight="bold">
                Area = {answerCm2}
              </text>
            )}
          </>
        )}
      </>
    )
  },
}


// ── Mirror Stage Maps ──────────────────────────────────────────────────────
// Stage 0 — concave mirror outline + principal axis + labels (C, F, P)
// Stage 1 — object arrow placed on left of mirror, u label shown
// Stage 2 — two rays drawn from object tip to mirror (parallel + through C)
// Stage 3 — reflected rays converge; image arrow formed; v/f labels
// Stage 4 — formula bar: 1/v + 1/u = 1/f with values substituted

const RED  = '#EF4444'
const GREEN = '#10B981'
const GRAY = '#6B7280'
const DARK = '#1E293B'

const mirrorStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config }) => (
    <g>
      {/* Mirror arc — concave (opens right) */}
      <path d="M 320 80 Q 260 190 320 300" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Principal axis */}
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      {/* Pole P */}
      <circle cx="320" cy="190" r="4" fill={BLUE}/>
      <text x="328" y="186" fontSize="13" fill={BLUE} fontWeight="bold">P</text>
      {/* Focal point F  ~half radius from pole */}
      <circle cx="230" cy="190" r="4" fill={GOLD}/>
      <text x="220" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F</text>
      {/* Centre of curvature C */}
      <circle cx="140" cy="190" r="4" fill={GREEN}/>
      <text x="128" y="182" fontSize="13" fill={GREEN} fontWeight="bold">C</text>
      {/* Labels */}
      <text x="160" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Concave mirror — principal axis, F and C marked</text>
    </g>
  ),
  1: ({ config }) => (
    <g>
      {/* Mirror arc */}
      <path d="M 320 80 Q 260 190 320 300" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Principal axis */}
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="320" cy="190" r="4" fill={BLUE}/><text x="328" y="186" fontSize="13" fill={BLUE} fontWeight="bold">P</text>
      <circle cx="230" cy="190" r="4" fill={GOLD}/><text x="220" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F</text>
      <circle cx="140" cy="190" r="4" fill={GREEN}/><text x="128" y="182" fontSize="13" fill={GREEN} fontWeight="bold">C</text>
      {/* Object arrow */}
      <line x1="60" y1="190" x2="60" y2="110" stroke={RED} strokeWidth="2.5"/>
      <polygon points="60,102 55,118 65,118" fill={RED}/>
      <text x="42" y="200" fontSize="12" fill={RED} fontWeight="bold">O</text>
      {/* u label — object distance */}
      <line x1="60" y1="210" x2="320" y2="210" stroke={RED} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="185" y="225" fontSize="12" fill={RED} textAnchor="middle">u</text>
      <text x="160" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Object placed at distance u from pole</text>
    </g>
  ),
  2: ({ config }) => (
    <g>
      {/* Mirror arc */}
      <path d="M 320 80 Q 260 190 320 300" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="320" cy="190" r="4" fill={BLUE}/><text x="328" y="186" fontSize="13" fill={BLUE} fontWeight="bold">P</text>
      <circle cx="230" cy="190" r="4" fill={GOLD}/><text x="220" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F</text>
      <circle cx="140" cy="190" r="4" fill={GREEN}/><text x="128" y="182" fontSize="13" fill={GREEN} fontWeight="bold">C</text>
      {/* Object */}
      <line x1="60" y1="190" x2="60" y2="110" stroke={RED} strokeWidth="2.5"/>
      <polygon points="60,102 55,118 65,118" fill={RED}/>
      <text x="42" y="200" fontSize="12" fill={RED} fontWeight="bold">O</text>
      {/* Ray 1: parallel to axis → reflects through F */}
      <line x1="60" y1="110" x2="315" y2="110" stroke={GOLD} strokeWidth="1.5" strokeDasharray="none"/>
      <line x1="315" y1="110" x2="230" y2="190" stroke={GOLD} strokeWidth="1.5"/>
      {/* Ray 2: through C → reflects back on itself */}
      <line x1="60" y1="110" x2="140" y2="190" stroke={GREEN} strokeWidth="1.5"/>
      <line x1="140" y1="190" x2="60" y2="110" stroke={GREEN} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6"/>
      <text x="160" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Ray 1 (parallel→F) · Ray 2 (through C)</text>
    </g>
  ),
  3: ({ config }) => (
    <g>
      {/* Mirror arc */}
      <path d="M 320 80 Q 260 190 320 300" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="320" cy="190" r="4" fill={BLUE}/><text x="328" y="186" fontSize="13" fill={BLUE} fontWeight="bold">P</text>
      <circle cx="230" cy="190" r="4" fill={GOLD}/><text x="220" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F</text>
      <circle cx="140" cy="190" r="4" fill={GREEN}/><text x="128" y="182" fontSize="13" fill={GREEN} fontWeight="bold">C</text>
      {/* Object */}
      <line x1="60" y1="190" x2="60" y2="110" stroke={RED} strokeWidth="2"/>
      <polygon points="60,102 55,118 65,118" fill={RED}/>
      <text x="42" y="200" fontSize="12" fill={RED} fontWeight="bold">O</text>
      {/* Image arrow — real, inverted, between F and C */}
      <line x1="185" y1="190" x2="185" y2="240" stroke={GOLD} strokeWidth="2.5"/>
      <polygon points="185,248 180,232 190,232" fill={GOLD}/>
      <text x="192" y="256" fontSize="12" fill={GOLD} fontWeight="bold">I</text>
      {/* v label */}
      <line x1="185" y1="265" x2="320" y2="265" stroke={GOLD} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="252" y="278" fontSize="12" fill={GOLD} textAnchor="middle">v</text>
      {/* u label */}
      <line x1="60" y1="275" x2="320" y2="275" stroke={RED} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="190" y="290" fontSize="12" fill={RED} textAnchor="middle">u</text>
      {/* f label */}
      <line x1="230" y1="300" x2="320" y2="300" stroke={GREEN} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="275" y="313" fontSize="12" fill={GREEN} textAnchor="middle">f</text>
      <text x="160" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Image formed — u, v, f distances marked</text>
    </g>
  ),
  4: ({ config }) => (
    <g>
      {/* Mirror arc — faded */}
      <path d="M 320 80 Q 260 190 320 300" stroke={BLUE} strokeWidth="3" fill="none" opacity="0.35"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1" strokeDasharray="6,4" opacity="0.4"/>
      <circle cx="230" cy="190" r="4" fill={GOLD} opacity="0.5"/><text x="220" y="182" fontSize="13" fill={GOLD} opacity="0.5" fontWeight="bold">F</text>
      {/* Formula box */}
      <rect x="50" y="80" width="280" height="200" rx="10" fill="white" stroke={BLUE} strokeWidth="1.5" opacity="0.97"/>
      <text x="190" y="110" fontSize="14" fill={BLUE} fontWeight="bold" textAnchor="middle">Mirror Formula</text>
      <text x="190" y="145" fontSize="18" fill={DARK} textAnchor="middle" fontFamily="serif">1/v + 1/u = 1/f</text>
      <line x1="70" y1="158" x2="310" y2="158" stroke={GRAY} strokeWidth="1"/>
      <text x="190" y="185" fontSize="13" fill={GRAY} textAnchor="middle">Substitute values:</text>
      <text x="190" y="215" fontSize="15" fill={DARK} textAnchor="middle" fontFamily="serif">1/v + 1/u = 1/f</text>
      <text x="190" y="245" fontSize="12" fill={GRAY} textAnchor="middle">(use sign convention: distances measured from P)</text>
      <text x="160" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Apply mirror formula with sign convention</text>
    </g>
  ),
}

// ── Lens Stage Maps ────────────────────────────────────────────────────────
// Stage 0 — convex lens outline + principal axis + F₁ F₂ optical centre O
// Stage 1 — object arrow placed, u label
// Stage 2 — two refraction rays drawn (parallel→F₂, through O straight)
// Stage 3 — image formed, v label, nature noted
// Stage 4 — formula bar: 1/v − 1/u = 1/f

const lensStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: () => (
    <g>
      {/* Convex lens — two arcs */}
      <path d="M 190 80 Q 230 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <path d="M 190 80 Q 150 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      {/* Principal axis */}
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      {/* Optical centre */}
      <circle cx="190" cy="190" r="4" fill={BLUE}/>
      <text x="196" y="186" fontSize="13" fill={BLUE} fontWeight="bold">O</text>
      {/* F₁ left */}
      <circle cx="110" cy="190" r="4" fill={GOLD}/>
      <text x="96" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₁</text>
      {/* F₂ right */}
      <circle cx="270" cy="190" r="4" fill={GOLD}/>
      <text x="276" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₂</text>
      <text x="190" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Convex lens — optical centre O and focal points F₁, F₂</text>
    </g>
  ),
  1: () => (
    <g>
      <path d="M 190 80 Q 230 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <path d="M 190 80 Q 150 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="190" cy="190" r="4" fill={BLUE}/><text x="196" y="186" fontSize="13" fill={BLUE} fontWeight="bold">O</text>
      <circle cx="110" cy="190" r="4" fill={GOLD}/><text x="96" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₁</text>
      <circle cx="270" cy="190" r="4" fill={GOLD}/><text x="276" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₂</text>
      {/* Object */}
      <line x1="55" y1="190" x2="55" y2="120" stroke={RED} strokeWidth="2.5"/>
      <polygon points="55,112 50,128 60,128" fill={RED}/>
      <text x="38" y="200" fontSize="12" fill={RED} fontWeight="bold">O</text>
      {/* u label */}
      <line x1="55" y1="215" x2="190" y2="215" stroke={RED} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="120" y="230" fontSize="12" fill={RED} textAnchor="middle">u</text>
      <text x="190" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Object at distance u from optical centre</text>
    </g>
  ),
  2: () => (
    <g>
      <path d="M 190 80 Q 230 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <path d="M 190 80 Q 150 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="190" cy="190" r="4" fill={BLUE}/>
      <circle cx="270" cy="190" r="4" fill={GOLD}/><text x="276" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₂</text>
      {/* Object */}
      <line x1="55" y1="190" x2="55" y2="120" stroke={RED} strokeWidth="2"/>
      <polygon points="55,112 50,128 60,128" fill={RED}/>
      {/* Ray 1: parallel → refracts through F₂ */}
      <line x1="55" y1="120" x2="190" y2="120" stroke={GOLD} strokeWidth="1.5"/>
      <line x1="190" y1="120" x2="270" y2="190" stroke={GOLD} strokeWidth="1.5"/>
      <line x1="270" y1="190" x2="340" y2="240" stroke={GOLD} strokeWidth="1.5" strokeDasharray="5,3"/>
      {/* Ray 2: through optical centre — straight */}
      <line x1="55" y1="120" x2="340" y2="230" stroke={GREEN} strokeWidth="1.5"/>
      <text x="190" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Ray 1 (parallel→F₂) · Ray 2 (through O, undeviated)</text>
    </g>
  ),
  3: () => (
    <g>
      <path d="M 190 80 Q 230 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <path d="M 190 80 Q 150 190 190 300" stroke={BLUE} strokeWidth="3.5" fill="none"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1.5" strokeDasharray="6,4"/>
      <circle cx="190" cy="190" r="4" fill={BLUE}/>
      <circle cx="270" cy="190" r="4" fill={GOLD}/><text x="276" y="182" fontSize="13" fill={GOLD} fontWeight="bold">F₂</text>
      {/* Object */}
      <line x1="55" y1="190" x2="55" y2="120" stroke={RED} strokeWidth="2"/>
      <polygon points="55,112 50,128 60,128" fill={RED}/>
      <text x="38" y="200" fontSize="12" fill={RED} fontWeight="bold">O</text>
      {/* Image arrow — real, inverted, beyond F₂ */}
      <line x1="315" y1="190" x2="315" y2="245" stroke={GOLD} strokeWidth="2.5"/>
      <polygon points="315,253 310,237 320,237" fill={GOLD}/>
      <text x="322" y="260" fontSize="12" fill={GOLD} fontWeight="bold">I</text>
      {/* v label */}
      <line x1="190" y1="270" x2="315" y2="270" stroke={GOLD} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="252" y="283" fontSize="12" fill={GOLD} textAnchor="middle">v</text>
      {/* u label */}
      <line x1="55" y1="280" x2="190" y2="280" stroke={RED} strokeWidth="1" strokeDasharray="4,3"/>
      <text x="122" y="293" fontSize="12" fill={RED} textAnchor="middle">u</text>
      <text x="190" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Image formed — u and v distances marked</text>
    </g>
  ),
  4: () => (
    <g>
      <path d="M 190 80 Q 230 190 190 300" stroke={BLUE} strokeWidth="3" fill="none" opacity="0.3"/>
      <path d="M 190 80 Q 150 190 190 300" stroke={BLUE} strokeWidth="3" fill="none" opacity="0.3"/>
      <line x1="40" y1="190" x2="370" y2="190" stroke={GRAY} strokeWidth="1" strokeDasharray="6,4" opacity="0.35"/>
      {/* Formula box */}
      <rect x="50" y="75" width="290" height="210" rx="10" fill="white" stroke={BLUE} strokeWidth="1.5" opacity="0.97"/>
      <text x="195" y="108" fontSize="14" fill={BLUE} fontWeight="bold" textAnchor="middle">Lens Formula</text>
      <text x="195" y="148" fontSize="18" fill={DARK} textAnchor="middle" fontFamily="serif">1/v − 1/u = 1/f</text>
      <line x1="70" y1="162" x2="320" y2="162" stroke={GRAY} strokeWidth="1"/>
      <text x="195" y="188" fontSize="13" fill={GRAY} textAnchor="middle">Magnification:</text>
      <text x="195" y="215" fontSize="16" fill={DARK} textAnchor="middle" fontFamily="serif">m = v/u = h′/h</text>
      <line x1="70" y1="228" x2="320" y2="228" stroke={GRAY} strokeWidth="1"/>
      <text x="195" y="252" fontSize="13" fill={GRAY} textAnchor="middle">Power: P = 1/f (f in metres, P in dioptres)</text>
      <text x="190" y="340" fontSize="12" fill={GRAY} textAnchor="middle">Apply lens formula with sign convention</text>
    </g>
  ),
}

// ── Component ─────────────────────────────────────────────────────────────────


// ── CIRCLES-IN-SQUARE stages (0–3) ───────────────────────────────────────────
// Problem: square of side 2r, four circles each radius r fitting into each corner.
// Each circle touches two adjacent sides; each contributes a quarter-circle inside the square.
// Shaded region = square area − 4 × (1/4)πr² = square area − πr²

const circlesInSquareStages: Record<number, (props: StageProps) => JSX.Element> = {

  // Stage 0: Overview — square with four quarter-circles at corners
  0: ({ config: { r } }) => {
    const S = 160   // square half-side in SVG units
    const sx = CX - S, sy = CY - S
    const qr = S    // quarter-circle radius = square side = 2*S... wait, r==half-side
    // square side = 2r, quarter-circle radius = r = S
    return (
      <>
        {/* Square */}
        <rect x={sx} y={sy} width={S * 2} height={S * 2} fill="none" stroke="#D1D5DB" strokeWidth={2} />
        {/* Four quarter-circles at each corner, filled gold */}
        {/* top-left corner: arc sweeps right and down */}
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 0 ${sx} ${sy + S}`} fill={GOLD} opacity={0.45} />
        {/* top-right corner */}
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy}`} fill={GOLD} opacity={0.45} />
        {/* bottom-right corner */}
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 0 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.45} />
        {/* bottom-left corner */}
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.45} />
        <text x={CX} y={CY} fontSize={11} fill="#92400E" textAnchor="middle" dominantBaseline="middle">shaded = ?</text>
        <text x={CX} y={sy - 14} fontSize={12} fill="#1E40AF" fontWeight="bold" textAnchor="middle">
          square side = {r * 2} cm, r = {r} cm
        </text>
      </>
    )
  },

  // Stage 1: Label the square side and one quarter-circle radius
  1: ({ config: { r } }) => {
    const S = 160
    const sx = CX - S, sy = CY - S
    return (
      <>
        <rect x={sx} y={sy} width={S * 2} height={S * 2} fill={BLUE} opacity={0.08} stroke={BLUE} strokeWidth={2} />
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 0 ${sx} ${sy + S}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 0 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.55} />
        {/* side label */}
        <line x1={sx} y1={sy + S * 2 + 18} x2={sx + S * 2} y2={sy + S * 2 + 18} stroke={BLUE} strokeWidth={1.5} />
        <text x={CX} y={sy + S * 2 + 32} fontSize={11} fill={BLUE} textAnchor="middle">side = {r * 2} cm</text>
        {/* radius label on top-left quarter-circle */}
        <line x1={sx} y1={sy + S} x2={sx + S} y2={sy} stroke={ORANGE} strokeWidth={1.5} strokeDasharray="5 3" />
        <text x={sx + 40} y={sy + 40} fontSize={11} fill={ORANGE} fontWeight="bold">r = {r} cm</text>
        <text x={CX} y={sy - 14} fontSize={11} fill={GREY} textAnchor="middle">4 quarter-circles (one per corner)</text>
      </>
    )
  },

  // Stage 2: Formula — Area = side² − πr²
  2: ({ config: { r } }) => {
    const S = 160
    const sx = CX - S, sy = CY - S
    return (
      <>
        <rect x={sx} y={sy} width={S * 2} height={S * 2} fill={BLUE} opacity={0.08} stroke="#D1D5DB" strokeWidth={1.5} />
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 0 ${sx} ${sy + S}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 0 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.4} />
        {/* formula box */}
        <rect x={60} y={290} width={280} height={60} rx={8} fill="#FEF3C7" stroke={GOLD} strokeWidth={1.5} />
        <text x={200} y={314} fontSize={12} fill="#92400E" textAnchor="middle" fontWeight="bold">
          Shaded = side² − π r²
        </text>
        <text x={200} y={334} fontSize={11} fill="#92400E" textAnchor="middle">
          = ({r * 2})² − (22/7)×{r}² = ?
        </text>
      </>
    )
  },

  // Stage 3: Final answer
  3: ({ problemComplete, config: { r, answerCm2 } }) => {
    const S = 160
    const sx = CX - S, sy = CY - S
    // unshaded corners = white, everything else = gold (square − circles)
    return (
      <>
        <rect x={sx} y={sy} width={S * 2} height={S * 2} fill={GOLD} opacity={0.5} stroke="#D1D5DB" strokeWidth={1.5} />
        {/* white out the four quarter-circles to reveal the unshaded petal shapes */}
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 0 ${sx} ${sy + S}`} fill="white" opacity={0.85} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy}`} fill="white" opacity={0.85} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 0 ${sx + S * 2} ${sy + S}`} fill="white" opacity={0.85} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 0 ${sx + S} ${sy + S * 2}`} fill="white" opacity={0.85} />
        {problemComplete && (
          <>
            <circle cx={CX} cy={CY} r={18} fill="#10B981" />
            <text x={CX} y={CY + 6} textAnchor="middle" fontSize={18} fill="white" fontWeight="bold">✓</text>
            {answerCm2 && (
              <text x={CX} y={sy - 14} textAnchor="middle" fontSize={13} fill="#92400E" fontWeight="bold">
                Area = {answerCm2}
              </text>
            )}
          </>
        )}
      </>
    )
  },
}


// ─── Chapter 13: Surface Areas & Volumes diagrams ────────────────────────────

// Cylinder with two hemispheres (medicine capsule / gulab jamun)
const cylinderHemispheresStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      <ellipse cx="200" cy="120" rx="60" ry="20" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
      <ellipse cx="200" cy="260" rx="60" ry="20" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
      <rect x="140" y="120" width="120" height="140" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2" />
      <path d="M140 120 Q110 120 110 150 Q110 100 140 120" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M260 120 Q290 120 290 150 Q290 100 260 120" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M140 260 Q110 260 110 230 Q110 280 140 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M260 260 Q290 260 290 230 Q290 280 260 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      {/* Hemisphere left */}
      <path d="M140 190 Q110 190 110 190" fill="none" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="200" y="195" textAnchor="middle" fontSize="12" fill="#0c4a6e">Cylinder</text>
      <text x="100" y="155" textAnchor="middle" fontSize="11" fill="#0369a1">Hemisphere</text>
      <text x="100" y="240" textAnchor="middle" fontSize="11" fill="#0369a1">Hemisphere</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <ellipse cx="200" cy="120" rx="60" ry="20" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
      <ellipse cx="200" cy="260" rx="60" ry="20" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
      <rect x="140" y="120" width="120" height="140" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2" />
      <path d="M140 120 Q110 120 110 150 Q110 100 140 120" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M260 120 Q290 120 290 150 Q290 100 260 120" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M140 260 Q110 260 110 230 Q110 280 140 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <path d="M260 260 Q290 260 290 230 Q290 280 260 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      {/* radius annotation */}
      <line x1="200" y1="120" x2="260" y2="120" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="230" y="112" fontSize="13" fill="#dc2626" fontWeight="bold">r = {r ?? 'r'}</text>
    </g>
  ),
}

// Hemisphere + cone (toy / ice cream)
const hemisphereConeStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      {/* Hemisphere base */}
      <ellipse cx="200" cy="220" rx="80" ry="28" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
      <path d="M120 220 Q120 150 200 150 Q280 150 280 220" fill="#fef9ee" stroke="#d97706" strokeWidth="2"/>
      {/* Cone on top */}
      <polygon points="200,60 120,220 280,220" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      <text x="200" y="200" textAnchor="middle" fontSize="12" fill="#92400e">Hemisphere</text>
      <text x="200" y="145" textAnchor="middle" fontSize="12" fill="#92400e">Cone</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <ellipse cx="200" cy="220" rx="80" ry="28" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
      <path d="M120 220 Q120 150 200 150 Q280 150 280 220" fill="#fef9ee" stroke="#d97706" strokeWidth="2"/>
      <polygon points="200,60 120,220 280,220" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      <line x1="200" y1="220" x2="280" y2="220" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="240" y="215" fontSize="13" fill="#dc2626" fontWeight="bold">r = {r ?? 'r'}</text>
    </g>
  ),
}

// Cube with hemisphere on top (decorative block)
const cubeHemisphereStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      {/* Cube */}
      <rect x="130" y="170" width="140" height="140" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2"/>
      <polygon points="130,170 170,130 310,130 270,170" fill="#dcfce7" stroke="#16a34a" strokeWidth="2"/>
      <polygon points="270,170 310,130 310,270 270,310" fill="#bbf7d0" stroke="#16a34a" strokeWidth="2"/>
      {/* Hemisphere */}
      <ellipse cx="200" cy="170" rx="50" ry="17" fill="#d1fae5" stroke="#16a34a" strokeWidth="2"/>
      <path d="M150 170 Q150 110 200 110 Q250 110 250 170" fill="#a7f3d0" stroke="#16a34a" strokeWidth="2"/>
      <text x="200" y="250" textAnchor="middle" fontSize="12" fill="#14532d">Cube</text>
      <text x="200" y="105" textAnchor="middle" fontSize="12" fill="#14532d">Hemisphere</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <rect x="130" y="170" width="140" height="140" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2"/>
      <polygon points="130,170 170,130 310,130 270,170" fill="#dcfce7" stroke="#16a34a" strokeWidth="2"/>
      <polygon points="270,170 310,130 310,270 270,310" fill="#bbf7d0" stroke="#16a34a" strokeWidth="2"/>
      <ellipse cx="200" cy="170" rx="50" ry="17" fill="#d1fae5" stroke="#16a34a" strokeWidth="2"/>
      <path d="M150 170 Q150 110 200 110 Q250 110 250 170" fill="#a7f3d0" stroke="#16a34a" strokeWidth="2"/>
      <line x1="200" y1="170" x2="250" y2="170" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="225" y="165" fontSize="13" fill="#dc2626" fontWeight="bold">r = {r ?? 'r'}</text>
    </g>
  ),
}

// Frustum of a cone (drinking glass / bucket shape)
const frustumStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      {/* Frustum body */}
      <polygon points="150,80 250,80 290,310 110,310" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="80" rx="50" ry="16" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="310" rx="90" ry="28" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      <text x="200" y="200" textAnchor="middle" fontSize="12" fill="#4c1d95">Frustum of cone</text>
      {/* Label r1, r2, h */}
      <text x="155" y="74" fontSize="11" fill="#5b21b6">r₁</text>
      <text x="295" y="315" fontSize="11" fill="#5b21b6">r₂</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <polygon points="150,80 250,80 290,310 110,310" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="80" rx="50" ry="16" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="310" rx="90" ry="28" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      {/* Height annotation */}
      <line x1="105" y1="80" x2="105" y2="310" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="88" y="200" fontSize="13" fill="#dc2626" fontWeight="bold">h</text>
      {/* r1 top */}
      <line x1="200" y1="80" x2="250" y2="80" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="222" y="72" fontSize="12" fill="#2563eb" fontWeight="bold">r₁</text>
      {/* r2 bottom */}
      <line x1="200" y1="310" x2="290" y2="310" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="242" y="328" fontSize="12" fill="#16a34a" fontWeight="bold">r₂</text>
    </g>
  ),
}

// Frustum + cylinder (metal bucket with handle)
const frustumCylinderStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      {/* Cylinder at top */}
      <rect x="150" y="60" width="100" height="60" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2"/>
      <ellipse cx="200" cy="60" rx="50" ry="16" fill="#fef08a" stroke="#ca8a04" strokeWidth="2"/>
      <ellipse cx="200" cy="120" rx="50" ry="16" fill="#fef08a" stroke="#ca8a04" strokeWidth="2"/>
      {/* Frustum below */}
      <polygon points="150,120 250,120 290,310 110,310" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="310" rx="90" ry="28" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      <text x="200" y="90" textAnchor="middle" fontSize="11" fill="#78350f">Cylinder</text>
      <text x="200" y="230" textAnchor="middle" fontSize="11" fill="#4c1d95">Frustum</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <rect x="150" y="60" width="100" height="60" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2"/>
      <ellipse cx="200" cy="60" rx="50" ry="16" fill="#fef08a" stroke="#ca8a04" strokeWidth="2"/>
      <ellipse cx="200" cy="120" rx="50" ry="16" fill="#fef08a" stroke="#ca8a04" strokeWidth="2"/>
      <polygon points="150,120 250,120 290,310 110,310" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2"/>
      <ellipse cx="200" cy="310" rx="90" ry="28" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2"/>
      {/* Slant height */}
      <line x1="250" y1="120" x2="290" y2="310" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="285" y="215" fontSize="12" fill="#dc2626" fontWeight="bold">l</text>
    </g>
  ),
}

// Cylinder with hemispherical base (juice glass / goblet)
const cylinderBaseHemisphereStages: Record<number, React.FC<{ r: number; theta?: number }>> = {
  0: () => (
    <g>
      {/* Cylinder body */}
      <rect x="150" y="100" width="100" height="160" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2"/>
      <ellipse cx="200" cy="100" rx="50" ry="16" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2"/>
      {/* Hemispherical bottom depression */}
      <path d="M150 260 Q150 310 200 310 Q250 310 250 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <text x="200" y="185" textAnchor="middle" fontSize="12" fill="#0c4a6e">Cylinder</text>
      <text x="200" y="325" textAnchor="middle" fontSize="11" fill="#0c4a6e">Hemispherical base</text>
    </g>
  ),
  1: ({ r }) => (
    <g>
      <rect x="150" y="100" width="100" height="160" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2"/>
      <ellipse cx="200" cy="100" rx="50" ry="16" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2"/>
      <path d="M150 260 Q150 310 200 310 Q250 310 250 260" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"/>
      <line x1="200" y1="260" x2="250" y2="260" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="228" y="256" fontSize="13" fill="#dc2626" fontWeight="bold">r = {r ?? 'r'}</text>
    </g>
  ),
}


export function GuidedDiagram({ stage, problemComplete = false, className = '', config }: GuidedDiagramProps) {
  const resolvedConfig = config ?? DEFAULT_CONFIG
  const problemType = resolvedConfig.problemType ?? 'segment'

  const stageMap =
    problemType === 'sector'                 ? sectorStages :
    problemType === 'arc'                    ? arcStages :
    problemType === 'combination'            ? combinationStages :
    problemType === 'circles-in-square'      ? circlesInSquareStages :
    problemType === 'mirror'                 ? mirrorStages :
    problemType === 'lens'                   ? lensStages :
    problemType === 'cylinder-hemispheres'   ? cylinderHemispheresStages :
    problemType === 'hemisphere-cone'        ? hemisphereConeStages :
    problemType === 'cube-hemisphere'        ? cubeHemisphereStages :
    problemType === 'cylinder-base-hemisphere' ? cylinderBaseHemisphereStages :
    problemType === 'frustum'                ? frustumStages :
    problemType === 'frustum-cylinder'       ? frustumCylinderStages :
    // 'none' or 'segment' — fall through to segment (segment handles unknown)
    segmentStages

  const maxStage = Object.keys(stageMap).length - 1
  const clampedStage = Math.max(0, Math.min(maxStage, Math.round(stage)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Renderer = (stageMap[clampedStage] ?? stageMap[0]) as React.FC<any>

  return (
    <svg
      viewBox="0 0 400 380"
      className={`w-full max-w-sm mx-auto select-none ${className}`}
      aria-label={`Diagram stage ${clampedStage}`}
      role="img"
    >
      <Renderer problemComplete={problemComplete} config={resolvedConfig} />
    </svg>
  )
}
