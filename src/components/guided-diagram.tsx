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
  h?: number                   // problem-specific length or height
  answerCm2?: string           // final answer label
  isMajorSegment?: boolean     // true for major-segment problems
  problemType?: 'sector' | 'arc' | 'segment' | 'combination' | 'circle-in-square' | 'circles-in-square' | 'grazing-quarter' | 'semicircle' | 'semicircles-in-square' | 'mirror' | 'lens' | 'refraction' | 'cylinder-hemispheres' | 'hemisphere-cone' | 'cube-hemisphere' | 'cylinder-base-hemisphere' | 'frustum' | 'frustum-cylinder' | 'sphere-cylinder' | 'well-embankment' | 'none'
  r2?: number
  topRadius?: number
  bottomRadius?: number
  hemisphereRadius?: number
  cylinderRadius?: number
  side?: number
  f?: number
  u?: number
  v?: number
  isConvex?: boolean
  angleOfIncidence?: number
  angleOfRefraction?: number
  criticalAngle?: boolean
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

// Specific circular composites. Keep these separate from the inscribed-square
// diagram so each picture matches the wording of its problem.
const circleInSquareStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config: { r, side } }) => (
    <g>
      <rect x="90" y="75" width="220" height="220" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
      <circle
        cx="200" cy="185"
        r={side && r ? Math.min(110, 110 * (r / (side / 2))) : 110}
        fill="#dbeafe" fillOpacity="0.55" stroke="#2563eb" strokeWidth="2.5"
      />
      <line x1="90" y1="185" x2="310" y2="185" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x="200" y="318" textAnchor="middle" fontSize="12" fill="#334155">Square side = {side} cm · circle radius = {r} cm</text>
    </g>
  ),
}

const grazingQuarterStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config: { r, side } }) => {
    const square = 220
    const radius = side && r ? Math.min(square * 0.48, square * r / side) : 154
    const x = 90, y = 70
    return (
      <g>
        <rect x={x} y={y} width={square} height={square} fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
        <path d={`M ${x} ${y} L ${x + radius} ${y} A ${radius} ${radius} 0 0 1 ${x} ${y + radius} Z`} fill="#fbbf24" fillOpacity="0.42" stroke="#d97706" strokeWidth="2" />
        <circle cx={x} cy={y} r="5" fill="#7c2d12" />
        <line x1={x} y1={y} x2={x + radius} y2={y} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x={x + radius / 2} y={y - 8} textAnchor="middle" fontSize="12" fill="#b91c1c">rope = {r} m</text>
        <text x={x + square / 2} y={y + square + 22} textAnchor="middle" fontSize="12" fill="#334155">Square field — grazing is a quarter-circle</text>
      </g>
    )
  },
}

const semicircleStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config: { r } }) => {
    const radius = 100
    const cx = 200, cy = 190
    return (
      <g>
        <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z`} fill="#fef3c7" stroke="#d97706" strokeWidth="2.5" />
        <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} stroke="#334155" strokeWidth="2" />
        <text x={cx} y={cy - radius - 12} textAnchor="middle" fontSize="12" fill="#92400e">semicircular arc</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="12" fill="#334155">diameter = {2 * r} mm</text>
      </g>
    )
  },
}

const semicirclesInSquareStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config: { side } }) => <SemicircleOverlapDrawing side={side} showOverlap={false} />,
  1: ({ config: { side } }) => <SemicircleOverlapDrawing side={side} showOverlap />,
}

function SemicircleOverlapDrawing({ side, showOverlap }: { side?: number; showOverlap: boolean }) {
  const squareX = 80, squareY = 65, size = 240, radius = size / 2
  const lens = `M ${squareX} ${squareY} A ${radius} ${radius} 0 0 0 200 185 A ${radius} ${radius} 0 0 0 ${squareX} ${squareY} Z`
  return (
    <g>
      <rect x={squareX} y={squareY} width={size} height={size} fill="#fff" stroke="#475569" strokeWidth="2" />
      {showOverlap && [0, 90, 180, 270].map((angle) => (
        <path key={angle} d={lens} transform={`rotate(${angle} 200 185)`} fill="#fbbf24" fillOpacity="0.48" stroke="#d97706" strokeWidth="1" />
      ))}
      {/* Four inward semicircles, one on each full side of the square. */}
      <path d={`M ${squareX} ${squareY} A ${radius} ${radius} 0 0 0 ${squareX + size} ${squareY}`} fill="none" stroke="#d97706" strokeWidth="2.5" />
      <path d={`M ${squareX + size} ${squareY} A ${radius} ${radius} 0 0 0 ${squareX + size} ${squareY + size}`} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      <path d={`M ${squareX + size} ${squareY + size} A ${radius} ${radius} 0 0 0 ${squareX} ${squareY + size}`} fill="none" stroke="#d97706" strokeWidth="2.5" />
      <path d={`M ${squareX} ${squareY + size} A ${radius} ${radius} 0 0 0 ${squareX} ${squareY}`} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      <text x="200" y="332" textAnchor="middle" fontSize="11" fill="#334155">
        {showOverlap ? 'Four overlap lenses shaded' : 'One inward semicircle on each side'} · side = {side} cm
      </text>
    </g>
  )
}

const refractionStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config }) => {
    const angleI = config.angleOfIncidence ?? 35
    const angleR = config.angleOfRefraction ?? (rawRefractionEstimate(angleI))
    const length = 105
    const interfaceX = 200, interfaceY = 190
    const radI = angleI * Math.PI / 180, radR = angleR * Math.PI / 180
    if (config.criticalAngle) {
      const critical = 42 * Math.PI / 180
      return <g>
        <rect x="200" y="55" width="170" height="270" fill="#dbeafe" fillOpacity="0.45" />
        <line x1={interfaceX} y1="55" x2={interfaceX} y2="325" stroke="#475569" strokeWidth="2" />
        <line x1="60" y1={interfaceY} x2="360" y2={interfaceY} stroke="#94a3b8" strokeDasharray="5 4" />
        <line x1={interfaceX + length * Math.cos(critical)} y1={interfaceY + length * Math.sin(critical)} x2={interfaceX} y2={interfaceY} stroke="#dc2626" strokeWidth="2.5" />
        <line x1={interfaceX} y1={interfaceY} x2={interfaceX} y2="70" stroke="#2563eb" strokeWidth="2.5" />
        <text x="270" y="294" fontSize="12" fill="#334155">Optically denser medium</text>
        <text x="207" y="80" fontSize="12" fill="#1d4ed8">Refracted ray travels along boundary</text>
        <text x="228" y="178" fontSize="12" fill="#b91c1c">i = C</text>
        <text x="66" y="180" fontSize="11" fill="#64748b">Normal</text>
      </g>
    }
    return (
      <g>
        <rect x="200" y="55" width="170" height="270" fill="#dbeafe" fillOpacity="0.35" />
        <line x1={interfaceX} y1="55" x2={interfaceX} y2="325" stroke="#475569" strokeWidth="2" />
        <line x1="60" y1={interfaceY} x2="360" y2={interfaceY} stroke="#94a3b8" strokeDasharray="5 4" />
        <line x1={interfaceX - length * Math.cos(radI)} y1={interfaceY - length * Math.sin(radI)} x2={interfaceX} y2={interfaceY} stroke="#dc2626" strokeWidth="2.5" />
        <line x1={interfaceX} y1={interfaceY} x2={interfaceX + length * Math.cos(radR)} y2={interfaceY - length * Math.sin(radR)} stroke="#2563eb" strokeWidth="2.5" />
        <path d={`M ${interfaceX - 34} ${interfaceY} A 34 34 0 0 1 ${interfaceX - 34 * Math.cos(radI)} ${interfaceY - 34 * Math.sin(radI)}`} fill="none" stroke="#dc2626" strokeWidth="1.5" />
        <path d={`M ${interfaceX + 34} ${interfaceY} A 34 34 0 0 0 ${interfaceX + 34 * Math.cos(radR)} ${interfaceY - 34 * Math.sin(radR)}`} fill="none" stroke="#2563eb" strokeWidth="1.5" />
        <text x="115" y="105" fontSize="12" fill="#b91c1c">Incident ray · i = {config.angleOfIncidence !== undefined ? `${angleI}°` : 'i'}</text>
        <text x="282" y="105" fontSize="12" fill="#1d4ed8">Refracted ray · r = {config.angleOfRefraction !== undefined ? `${angleR}°` : 'r'}</text>
        <text x="282" y="300" fontSize="12" fill="#334155">Second medium</text>
        <text x="75" y="300" fontSize="12" fill="#334155">First medium</text>
        <text x="209" y="178" fontSize="11" fill="#64748b">normal</text>
      </g>
    )
  },
}

function rawRefractionEstimate(angle: number) {
  return angle === 30 ? 19.47 : angle === 45 ? 28 : Math.round(angle * 0.67)
}

const sphereCylinderStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config }) => {
    const sphereR = 50
    const cylinderR = Math.min(80, sphereR * (config.cylinderRadius ?? 6) / (config.r || 4.2))
    const cylinderH = (4 * Math.pow(config.r || 4.2, 3)) / (3 * Math.pow(config.cylinderRadius || 6, 2))
    const drawnH = Math.max(52, Math.min(140, cylinderH * 35))
    return (
      <g>
        <circle cx="95" cy="190" r={sphereR} fill="#bae6fd" stroke="#0284c7" strokeWidth="2" />
        <text x="95" y="276" textAnchor="middle" fontSize="12" fill="#0c4a6e">Sphere · r={config.r} cm</text>
        <path d="M 155 190 L 235 190" stroke="#64748b" strokeWidth="2" markerEnd="url(#guided-diagram-arrow)" />
        <rect x="270" y={190 - drawnH / 2} width={cylinderR} height={drawnH} fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2" />
        <ellipse cx={270 + cylinderR / 2} cy={190 - drawnH / 2} rx={cylinderR / 2} ry="12" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="2" />
        <ellipse cx={270 + cylinderR / 2} cy={190 + drawnH / 2} rx={cylinderR / 2} ry="12" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="2" />
        <text x="300" y="286" textAnchor="middle" fontSize="12" fill="#3730a3">Cylinder · r={config.cylinderRadius} cm</text>
        <text x="200" y="105" textAnchor="middle" fontSize="12" fill="#334155">Melted and recast · volume stays equal</text>
      </g>
    )
  },
}

const wellEmbankmentStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: ({ config }) => {
    const inner = 27
    const outer = Math.min(110, inner * ((config.r + (config.side ?? 4)) / (config.r || 1.5)))
    return (
      <g>
        <circle cx="200" cy="190" r={outer} fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
        <circle cx="200" cy="190" r={inner} fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
        <circle cx="200" cy="190" r="4" fill="#0f172a" />
        <line x1="200" y1="190" x2="200" y2={190 - inner} stroke="#0284c7" strokeWidth="2" />
        <line x1={200 + inner} y1="190" x2={200 + outer} y2="190" stroke="#d97706" strokeWidth="2" />
        <text x="200" y="54" textAnchor="middle" fontSize="12" fill="#334155">Top view · well and surrounding embankment</text>
        <text x="200" y="330" textAnchor="middle" fontSize="12" fill="#334155">Well depth = {config.h} m · embankment width = {config.side} m</text>
      </g>
    )
  },
}

// Unknown problem types should never inherit a circle-segment picture. Show a
// neutral placeholder until a matching diagram is authored for that problem.
const noDiagramStages: Record<number, (props: StageProps) => JSX.Element> = {
  0: () => <g>
    <rect x="55" y="115" width="290" height="130" rx="14" fill="#f8fafc" stroke="#cbd5e1" strokeDasharray="6 4" />
    <text x="200" y="175" textAnchor="middle" fontSize="15" fill="#475569">Diagram not available</text>
    <text x="200" y="202" textAnchor="middle" fontSize="11" fill="#64748b">This problem is shown without a diagram.</text>
  </g>,
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

function OpticsSketch({ kind, stage, config }: { kind: 'mirror' | 'lens'; stage: number; config: DiagramConfig }) {
  const mirror = kind === 'mirror'
  const convex = !!config.isConvex
  const deviceX = mirror ? convex ? 242 : 270 : 200
  const focalLength = Math.abs(config.f ?? 15)
  const u = config.u
  const givenV = config.v
  const derivedV = u && focalLength
    ? mirror
      ? convex ? focalLength * u / (focalLength + u) : (u === focalLength ? undefined : focalLength * u / (u - focalLength))
      : convex ? (u === focalLength ? undefined : focalLength * u / (u - focalLength)) : -focalLength * u / (focalLength + u)
    : undefined
  const v = givenV ?? derivedV
  const scaleLimit = mirror ? 210 : 145
  const scale = Math.min(mirror ? 3.6 : 3.1, scaleLimit / Math.max(focalLength * 2, u ?? 0, v ?? 0, 1))
  const direction = mirror && convex ? 1 : -1
  const focusX = mirror
    ? deviceX + direction * focalLength * scale
    : deviceX + (convex ? 1 : -1) * focalLength * scale
  const centreX = mirror ? deviceX + direction * 2 * focalLength * scale : deviceX + focalLength * scale
  const objectX = u ? deviceX - u * scale : undefined
  const imageX = v === undefined ? undefined : mirror
    ? deviceX + (convex ? Math.abs(v) : -v) * scale
    : deviceX + v * scale
  const imageHeight = u && v ? Math.min(76, 68 * Math.abs(v) / u) : 42
  const objectTipY = 120
  const imageTipY = mirror && convex ? 190 - imageHeight :
    u && v ? 190 + Math.sign(v) * imageHeight : 190 - imageHeight
  const objectLabel = mirror ? 'Object' : 'Object'
  const focusLabel = mirror ? 'F' : convex ? 'F₂' : 'F₁'
  const surfacePath = mirror
    ? convex ? 'M 270 80 Q 242 190 270 300' : 'M 270 80 Q 298 190 270 300'
    : convex ? 'M 190 80 Q 170 190 190 300 M 210 80 Q 230 190 210 300'
      : 'M 180 80 Q 195 190 180 300 M 220 80 Q 205 190 220 300'

  return (
    <g>
      <line x1="35" y1="190" x2="370" y2="190" stroke="#64748b" strokeWidth="1.4" strokeDasharray="6 4" />
      <path d={surfacePath} stroke="#2563eb" strokeWidth="4" fill="none" strokeLinecap="round" />
      <text x={deviceX} y="326" textAnchor="middle" fontSize="12" fill="#334155">
        {mirror ? `${convex ? 'Convex' : 'Concave'} mirror` : `${convex ? 'Convex' : 'Concave'} lens`}
      </text>
      <circle cx={deviceX} cy="190" r="4" fill="#2563eb" />
      <text x={deviceX + (mirror ? -11 : 7)} y="181" fontSize="11" fill="#2563eb" fontWeight="bold">{mirror ? 'P' : 'O'}</text>
      <circle cx={focusX} cy="190" r="4" fill="#f59e0b" />
      <text x={focusX} y="178" textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="bold">{focusLabel}</text>
      {mirror && !convex && <>
        <circle cx={centreX} cy="190" r="4" fill="#10b981" />
        <text x={centreX} y="178" textAnchor="middle" fontSize="11" fill="#059669" fontWeight="bold">C</text>
      </>}
      {!mirror && <>
        <circle cx={deviceX + focalLength * scale} cy="190" r="4" fill="#f59e0b" />
        <text x={deviceX + focalLength * scale} y="178" textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="bold">F₂</text>
      </>}
      {objectX !== undefined && <>
        <line x1={objectX} y1="190" x2={objectX} y2={objectTipY} stroke="#ef4444" strokeWidth="2.5" />
        <path d={`M ${objectX - 5} ${objectTipY + 8} L ${objectX} ${objectTipY} L ${objectX + 5} ${objectTipY + 8}`} fill="none" stroke="#ef4444" strokeWidth="2" />
        <text x={objectX} y="210" textAnchor="middle" fontSize="11" fill="#b91c1c">{objectLabel}{u ? ` · u=${u} cm` : ''}</text>
      </>}
      {stage >= 2 && objectX !== undefined && u !== undefined && (mirror || config.f !== undefined) && (() => {
        const hitX = deviceX
        const hitY = objectTipY
        const virtualImage = v !== undefined && v < 0 || mirror && convex
        const outgoingEndX = mirror
          ? (convex || virtualImage ? hitX - 60 : imageX ?? focusX)
          : (convex && !virtualImage ? imageX ?? 350 : 350)
        const slopeEndY = mirror
          ? convex ? hitY + (hitY - 190) * (hitX - outgoingEndX) / (focusX - hitX) : hitY + (190 - hitY) * (hitX - outgoingEndX) / (hitX - focusX)
          : convex ? hitY + (190 - hitY) * (outgoingEndX - hitX) / (focusX - hitX) : hitY + (hitY - 190) * (outgoingEndX - hitX) / (deviceX - focusX)
        return <g>
          <line x1={objectX} y1={objectTipY} x2={hitX} y2={hitY} stroke="#f59e0b" strokeWidth="1.8" />
          <line x1={hitX} y1={hitY} x2={outgoingEndX} y2={slopeEndY} stroke="#f59e0b" strokeWidth="1.8" />
          {((mirror && convex) || (!mirror && !convex)) && (
            <line x1={hitX} y1={hitY} x2={focusX} y2="190" stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="5 4" />
          )}
          {virtualImage && imageX !== undefined && (
            <line x1={hitX} y1={hitY} x2={imageX} y2={imageTipY} stroke="#f59e0b" strokeWidth="1.3" strokeDasharray="5 4" />
          )}
          {!mirror && <line x1={objectX} y1={objectTipY} x2={imageX ?? 350} y2={imageTipY} stroke="#10b981" strokeWidth="1.5" />}
          <text x="200" y="350" textAnchor="middle" fontSize="10" fill="#475569">Principal ray shown schematically · distances use the problem values</text>
        </g>
      })()}
      {stage >= 3 && imageX !== undefined && <>
        <line x1={imageX} y1="190" x2={imageX} y2={imageTipY} stroke="#7c3aed" strokeWidth="2.5" strokeDasharray={mirror && convex || !mirror && !convex ? '5 3' : undefined} />
        <path d={`M ${imageX - 5} ${imageTipY - Math.sign(imageTipY - 190) * 8} L ${imageX} ${imageTipY} L ${imageX + 5} ${imageTipY - Math.sign(imageTipY - 190) * 8}`} fill="none" stroke="#7c3aed" strokeWidth="2" />
        <text x={imageX} y={imageTipY + (imageTipY > 190 ? 18 : -8)} textAnchor="middle" fontSize="11" fill="#6d28d9">Image · v={v} cm</text>
      </>}
      {stage >= 4 && <>
        <rect x="70" y="55" width="260" height="55" rx="8" fill="#eff6ff" stroke="#93c5fd" />
        <text x="200" y="78" textAnchor="middle" fontSize="13" fill="#1e3a8a" fontWeight="bold">{mirror ? '1/f = 1/u + 1/v' : '1/f = 1/v − 1/u'}</text>
        <text x="200" y="98" textAnchor="middle" fontSize="11" fill="#334155">Apply the sign convention for the shown optical element.</text>
      </>}
    </g>
  )
}

const accurateMirrorStages: Record<number, (props: StageProps) => JSX.Element> = {
  ...mirrorStages,
  0: ({ config }) => <OpticsSketch kind="mirror" stage={0} config={config} />,
  1: ({ config }) => <OpticsSketch kind="mirror" stage={1} config={config} />,
  2: ({ config }) => <OpticsSketch kind="mirror" stage={2} config={config} />,
  3: ({ config }) => <OpticsSketch kind="mirror" stage={3} config={config} />,
  4: ({ config }) => <OpticsSketch kind="mirror" stage={4} config={config} />,
}

const accurateLensStages: Record<number, (props: StageProps) => JSX.Element> = {
  ...lensStages,
  0: ({ config }) => <OpticsSketch kind="lens" stage={0} config={config} />,
  1: ({ config }) => <OpticsSketch kind="lens" stage={1} config={config} />,
  2: ({ config }) => <OpticsSketch kind="lens" stage={2} config={config} />,
  3: ({ config }) => <OpticsSketch kind="lens" stage={3} config={config} />,
  4: ({ config }) => <OpticsSketch kind="lens" stage={4} config={config} />,
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
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 1 ${sx} ${sy + S}`} fill={GOLD} opacity={0.45} />
        {/* top-right corner */}
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy}`} fill={GOLD} opacity={0.45} />
        {/* bottom-right corner */}
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 1 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.45} />
        {/* bottom-left corner */}
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.45} />
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
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 1 ${sx} ${sy + S}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 1 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.55} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.55} />
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
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 1 ${sx} ${sy + S}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 1 ${sx + S * 2} ${sy + S}`} fill={GOLD} opacity={0.4} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy + S * 2}`} fill={GOLD} opacity={0.4} />
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
        <path d={`M ${sx + S} ${sy} A ${S} ${S} 0 0 1 ${sx} ${sy + S}`} fill="white" opacity={0.85} />
        <path d={`M ${sx + S * 2} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy}`} fill="white" opacity={0.85} />
        <path d={`M ${sx + S} ${sy + S * 2} A ${S} ${S} 0 0 1 ${sx + S * 2} ${sy + S}`} fill="white" opacity={0.85} />
        <path d={`M ${sx} ${sy + S} A ${S} ${S} 0 0 1 ${sx + S} ${sy + S * 2}`} fill="white" opacity={0.85} />
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
function CapsuleDrawing({ r, h, annotate = false }: { r: number; h?: number; annotate?: boolean }) {
  const radius = 54
  const middleLength = h && r > 0 ? Math.min(220, Math.max(70, (h / r) * radius)) : 150
  const top = 190 - middleLength / 2
  const bottom = 190 + middleLength / 2
  const left = 200 - radius
  const right = 200 + radius
  const outline = `M ${left} ${top} A ${radius} ${radius} 0 0 1 ${right} ${top} L ${right} ${bottom} A ${radius} ${radius} 0 0 1 ${left} ${bottom} Z`

  return (
    <g>
      {/* Side elevation: semicircular caps meet the cylinder at its full diameter. */}
      <path d={`M ${left} ${top} A ${radius} ${radius} 0 0 1 ${right} ${top} L ${left} ${top} Z`} fill="#bae6fd" />
      <rect x={left} y={top} width={radius * 2} height={middleLength} fill="#f0f9ff" />
      <path d={`M ${right} ${bottom} A ${radius} ${radius} 0 0 1 ${left} ${bottom} L ${right} ${bottom} Z`} fill="#bae6fd" />
      <path d={outline} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="200" y="190" textAnchor="middle" fontSize="12" fill="#0c4a6e">Cylinder</text>
      <text x="200" y={top - radius * 0.45} textAnchor="middle" fontSize="10" fill="#0369a1">Hemisphere</text>
      <text x="200" y={bottom + radius * 0.45} textAnchor="middle" fontSize="10" fill="#0369a1">Hemisphere</text>
      {annotate && (
        <g>
          <line x1="200" y1={top} x2={right} y2={top} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x="220" y={top - 7} fontSize="12" fill="#dc2626" fontWeight="bold">r = {r}</text>
          <line x1={left - 14} y1={top} x2={left - 14} y2={bottom} stroke="#7c3aed" strokeWidth="1.5" />
          <line x1={left - 18} y1={top} x2={left - 10} y2={top} stroke="#7c3aed" strokeWidth="1.5" />
          <line x1={left - 18} y1={bottom} x2={left - 10} y2={bottom} stroke="#7c3aed" strokeWidth="1.5" />
          <text x={left - 22} y="194" textAnchor="end" fontSize="12" fill="#6d28d9" fontWeight="bold">h = {h ?? 'h'}</text>
        </g>
      )}
    </g>
  )
}

const cylinderHemispheresStages: Record<number, React.FC<StageProps>> = {
  0: ({ config: { r, h } }) => <CapsuleDrawing r={r} h={h} />,
  1: ({ config: { r, h } }) => <CapsuleDrawing r={r} h={h} annotate />,
}

// Hemisphere + cone (toy / ice cream)
const hemisphereConeStages: Record<number, React.FC<StageProps>> = {
  0: ({ config }) => <HemisphereConeDrawing config={config} />,
  1: ({ config }) => <HemisphereConeDrawing config={config} annotate />,
}

function HemisphereConeDrawing({ config, annotate = false }: { config: DiagramConfig; annotate?: boolean }) {
  const radius = 72
  const coneHeight = config.h && config.r ? Math.min(140, Math.max(30, config.h / config.r * radius)) : 90
  const joinY = 190
  const apexY = joinY - coneHeight
  const bottomY = joinY + radius
  return (
    <g>
      {/* Cone sits above the hemisphere; their flat circular bases coincide. */}
      <polygon points={`200,${apexY} ${200 - radius},${joinY} ${200 + radius},${joinY}`} fill="#fde68a" stroke="#d97706" strokeWidth="2" />
      <path d={`M ${200 - radius} ${joinY} A ${radius} ${radius} 0 0 0 ${200 + radius} ${joinY} L ${200 - radius} ${joinY} Z`} fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
      <line x1={200 - radius} y1={joinY} x2={200 + radius} y2={joinY} stroke="#92400e" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="200" y={apexY + coneHeight * 0.52} textAnchor="middle" fontSize="12" fill="#92400e">Cone</text>
      <text x="200" y={joinY + radius * 0.58} textAnchor="middle" fontSize="11" fill="#92400e">Hemisphere</text>
      {annotate && <>
        <line x1="200" y1={joinY} x2={200 + radius} y2={joinY} stroke="#dc2626" strokeWidth="1.5" />
        <text x="220" y={joinY - 7} fontSize="12" fill="#dc2626" fontWeight="bold">r = {config.r} cm</text>
        <line x1="250" y1={apexY} x2="250" y2={joinY} stroke="#2563eb" strokeWidth="1.5" />
        <text x="258" y={(apexY + joinY) / 2} fontSize="12" fill="#1d4ed8">h = {config.h} cm</text>
      </>}
      <text x="200" y={bottomY + 24} textAnchor="middle" fontSize="10" fill="#475569">Side cross-section · cone and hemisphere share a circular base</text>
    </g>
  )
}

// Cube with hemisphere on top (decorative block)
const cubeHemisphereStages: Record<number, React.FC<StageProps>> = {
  0: ({ config }) => <CubeHemisphereDrawing config={config} />,
  1: ({ config }) => <CubeHemisphereDrawing config={config} annotate />,
}

function CubeHemisphereDrawing({ config, annotate = false }: { config: DiagramConfig; annotate?: boolean }) {
  const side = config.side ?? 5
  const radiusValue = config.hemisphereRadius ?? config.r ?? 2.1
  const sidePx = 180
  const radiusPx = sidePx * radiusValue / side
  const x = 200 - sidePx / 2
  const top = 178
  const bottom = top + sidePx
  return (
    <g>
      {/* Side elevation preserves the actual diameter-to-cube-side ratio. */}
      <rect x={x} y={top} width={sidePx} height={sidePx} fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
      <path d={`M ${200 - radiusPx} ${top} A ${radiusPx} ${radiusPx} 0 0 0 ${200 + radiusPx} ${top} L ${200 - radiusPx} ${top} Z`} fill="#a7f3d0" stroke="#16a34a" strokeWidth="2" />
      <line x1={x} y1={top} x2={x + sidePx} y2={top} stroke="#14532d" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="200" y="260" textAnchor="middle" fontSize="12" fill="#14532d">Cube</text>
      <text x="200" y={top - radiusPx * 0.48} textAnchor="middle" fontSize="11" fill="#14532d">Hemisphere</text>
      {annotate && <>
        <line x1={x} y1={bottom + 15} x2={x + sidePx} y2={bottom + 15} stroke="#2563eb" strokeWidth="1.5" />
        <text x="200" y={bottom + 32} textAnchor="middle" fontSize="11" fill="#1d4ed8">side = {side} cm</text>
        <line x1="200" y1={top} x2={200 + radiusPx} y2={top} stroke="#dc2626" strokeWidth="1.5" />
        <text x="210" y={top - 7} fontSize="11" fill="#b91c1c">r = {radiusValue} cm</text>
      </>}
    </g>
  )
}

// Frustum of a cone (drinking glass / bucket shape)
const frustumStages: Record<number, React.FC<StageProps>> = {
  0: ({ config }) => <FrustumDrawing config={config} />,
  1: ({ config }) => <FrustumDrawing config={config} annotate />,
}

function FrustumDrawing({ config, annotate = false }: { config: DiagramConfig; annotate?: boolean }) {
  const topValue = config.topRadius ?? 7
  const bottomValue = config.bottomRadius ?? config.r2 ?? 5
  const maxRadius = Math.max(topValue, bottomValue, 1)
  const scale = 105 / maxRadius
  const topRx = topValue * scale
  const bottomRx = bottomValue * scale
  const topY = 90, bottomY = 285, cyTop = 18, cyBottom = 24
  const h = config.h
  return (
    <g>
      <path d={`M ${200 - topRx} ${topY} L ${200 - bottomRx} ${bottomY} Q 200 ${bottomY + cyBottom} ${200 + bottomRx} ${bottomY} L ${200 + topRx} ${topY} Z`} fill="#ede9fe" stroke="#7c3aed" strokeWidth="2" />
      {/* Open top rim; closed bottom disk. Radii follow the problem's top/bottom values. */}
      <ellipse cx="200" cy={topY} rx={topRx} ry={cyTop} fill="#fff" stroke="#7c3aed" strokeWidth="2" />
      <path d={`M ${200 - bottomRx} ${bottomY} Q 200 ${bottomY + cyBottom} ${200 + bottomRx} ${bottomY}`} fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2" />
      <text x="200" y="188" textAnchor="middle" fontSize="12" fill="#4c1d95">Frustum</text>
      {annotate && <>
        <line x1="200" y1={topY} x2={200 + topRx} y2={topY} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x={200 + topRx / 2} y={topY - 7} textAnchor="middle" fontSize="11" fill="#1d4ed8">top r = {topValue} cm</text>
        <line x1="200" y1={bottomY} x2={200 + bottomRx} y2={bottomY} stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x={200 + bottomRx / 2} y={bottomY + 28} textAnchor="middle" fontSize="11" fill="#15803d">bottom r = {bottomValue} cm</text>
        {h && <>
          <line x1="75" y1={topY} x2="75" y2={bottomY} stroke="#dc2626" strokeWidth="1.5" />
          <text x="62" y="190" textAnchor="end" fontSize="11" fill="#b91c1c">h = {h} cm</text>
        </>}
      </>}
    </g>
  )
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
    problemType === 'circle-in-square'        ? circleInSquareStages :
    problemType === 'circles-in-square'      ? circlesInSquareStages :
    problemType === 'grazing-quarter'         ? grazingQuarterStages :
    problemType === 'semicircle'              ? semicircleStages :
    problemType === 'semicircles-in-square'   ? semicirclesInSquareStages :
    problemType === 'mirror'                 ? accurateMirrorStages :
    problemType === 'lens'                   ? accurateLensStages :
    problemType === 'refraction'              ? refractionStages :
    problemType === 'cylinder-hemispheres'   ? cylinderHemispheresStages :
    problemType === 'hemisphere-cone'        ? hemisphereConeStages :
    problemType === 'cube-hemisphere'        ? cubeHemisphereStages :
    problemType === 'cylinder-base-hemisphere' ? cylinderBaseHemisphereStages :
    problemType === 'frustum'                ? frustumStages :
    problemType === 'frustum-cylinder'       ? frustumCylinderStages :
    problemType === 'sphere-cylinder'         ? sphereCylinderStages :
    problemType === 'well-embankment'         ? wellEmbankmentStages :
    problemType === 'segment'             ? segmentStages :
    noDiagramStages

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
      <defs>
        <marker id="guided-diagram-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#64748b" />
        </marker>
      </defs>
      <Renderer problemComplete={problemComplete} config={resolvedConfig} />
    </svg>
  )
}
