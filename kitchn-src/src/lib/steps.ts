import type { Ingredient, Recipe } from './types'

export interface Step {
  key: string
  text: string
  /** Raw ingredients that first appear in this step. These get the line illustration. */
  adds: Ingredient[]
  timer?: number
}

/** Operations in order, with setup steps slotted in after the operation they follow. */
export function stepsFor(recipe: Recipe): Step[] {
  const ingredients = new Map(recipe.ingredients.map((i) => [i.id, i]))
  const setup = recipe.setup ?? []
  const steps: Step[] = setup.filter((s) => !s.after).map((s) => ({ key: s.id, text: s.text, adds: [] }))

  for (const op of recipe.operations) {
    steps.push({
      key: op.id,
      text: op.text,
      adds: op.inputs.map((id) => ingredients.get(id)).filter((i): i is Ingredient => Boolean(i)),
      timer: op.timer,
    })
    for (const s of setup) if (s.after === op.id) steps.push({ key: s.id, text: s.text, adds: [] })
  }
  return steps
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}
