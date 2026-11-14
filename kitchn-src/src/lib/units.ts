import type { Ingredient, Measure, UnitSystem } from './types'

const FRACTIONS: Record<number, string> = {
  0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞',
}

/** 1.25 → "1¼". Cups and spoons round to the nearest eighth. */
function fraction(n: number): string {
  const eighths = Math.max(1, Math.round(n * 8))
  const whole = Math.floor(eighths / 8)
  const part = FRACTIONS[(eighths % 8) / 8] ?? ''
  return whole ? `${whole}${part}` : part
}

/** Grams and millilitres: finer when small, coarser when large. */
function metricNumber(n: number): string {
  const step = n < 10 ? 0.5 : n < 1000 ? 1 : 10
  const r = Math.max(step, Math.round(n / step) * step)
  return String(r)
}

function countNumber(n: number): string {
  const halves = Math.max(1, Math.round(n * 2))
  return halves % 2 ? fraction(halves / 2) : String(halves / 2)
}

export interface Amount {
  /** "½ cup", "100 g", "2", "to taste" */
  text: string
  /** Which system this is shown in, if the ingredient can switch. */
  system?: UnitSystem
  canSwitch: boolean
  estimate: boolean
}

const TSP_PER = { tsp: 1, tbsp: 3, cup: 48 } as const

/** After scaling, pick the spoon or cup a cook would reach for: 3 tsp → 1 tbsp, 2 tbsp → ⅛ cup stays tbsp. */
function friendlyUs(n: number, unit: string): [number, string] {
  if (!(unit in TSP_PER)) return [n, unit]
  const tsp = n * TSP_PER[unit as keyof typeof TSP_PER]
  if (tsp >= 12) return [tsp / 48, 'cup'] // ¼ cup and up
  if (tsp >= 3) return [tsp / 3, 'tbsp']
  return [tsp, 'tsp']
}

function formatMeasure(m: Measure, system: UnitSystem, scale: number): string {
  const n = m.amount * scale
  if (system === 'metric') return `${metricNumber(n)} ${m.unit}`
  // Keep the cook's own unit until the recipe is scaled.
  const [amount, unit] = scale === 1 ? [n, m.unit] : friendlyUs(n, m.unit)
  return `${fraction(amount)} ${unit === 'cup' && amount > 1 ? 'cups' : unit}`
}

/** The amount to show for an ingredient, given the user's unit choice and scale. */
export function amountFor(ing: Ingredient, system: UnitSystem, scale: number): Amount {
  if (ing.count) {
    return { text: countNumber(ing.count.amount * scale), canSwitch: false, estimate: false }
  }
  const canSwitch = Boolean(ing.us && ing.metric)
  const use: UnitSystem | undefined = ing[system] ? system : ing.us ? 'us' : ing.metric ? 'metric' : undefined
  if (!use) return { text: ing.amountText ?? '', canSwitch: false, estimate: false }
  return {
    text: formatMeasure(ing[use]!, use, scale),
    system: use,
    canSwitch,
    estimate: use === ing.estimate,
  }
}

/** "eggs" when there's more than one. */
export function nameFor(ing: Ingredient, scale: number): string {
  if (ing.count && ing.plural && ing.count.amount * scale > 1) return ing.plural
  return ing.name
}

export const SCALES = [0.5, 1, 1.5, 2, 3]

export function scaleLabel(s: number): string {
  return `×${s === 0.5 ? '½' : s === 1.5 ? '1½' : s}`
}
