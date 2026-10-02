const PHYSICS_KEY_LABELS: Record<string, string> = {
  r: 'radius', d: 'diameter', h: 'height', b: 'base', l: 'length',
  w: 'width', a: 'area', p: 'perimeter', v: 'volume', s: 'side',
  A: 'area', P: 'perimeter', V: 'volume',
}

export function toConceptPhrase(given: string): string {
  const physicsMatch = given.match(/^([a-zA-Z])\s*=\s*(.+)$/)
  if (physicsMatch) {
    const label = PHYSICS_KEY_LABELS[physicsMatch[1]] ?? physicsMatch[1]
    return `the ${label}`
  }
  const eqStrip = new RegExp(String.raw`\s*=\s*[\d°π/.,\s\w²³]*$`)
  const isStrip = new RegExp(String.raw`\s+\bis\b\s+[\d°π²³/.,][\d°π²³/.,\s\w]*$`, 'i')
  const numStrip = new RegExp(String.raw`\b\d+([.,]\d+)?\s*(cm²|cm|mm²|mm|m²|km|m|°|π|%)?\b`, 'g')
  const articleStrip = new RegExp(String.raw`^(the|a|an)\s+`, 'i')
  const punctStrip = new RegExp(String.raw`[,.:;!?]+$`)
  const spaceCollapse = new RegExp(String.raw`\s{2,}`, 'g')
  const s = given
    .replace(eqStrip, '')
    .replace(isStrip, '')
    .replace(numStrip, '')
    .replace(articleStrip, '')
    .replace(punctStrip, '')
    .replace(spaceCollapse, ' ')
    .trim()
    .toLowerCase()
  return s ? `the ${s}` : given.toLowerCase()
}

const WORD_RE = new RegExp(String.raw`\S+`, 'g')
export function wordCount(text: string): number {
  return (text.trim().match(WORD_RE) ?? []).length
}

export function isValidNumeric(value: string): boolean {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
}
