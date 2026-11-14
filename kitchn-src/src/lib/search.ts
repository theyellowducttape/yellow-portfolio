import type { RecipeSummary } from './types'

const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ')

/**
 * Every word in the query must appear somewhere in the recipe.
 * Title matches rank first, then tags, then ingredients.
 */
export function searchRecipes(recipes: RecipeSummary[], query: string): RecipeSummary[] {
  const words = normalise(query).split(/\s+/).filter(Boolean)
  if (!words.length) return recipes

  const scored: { r: RecipeSummary; score: number }[] = []
  for (const r of recipes) {
    const title = normalise(r.title)
    const tags = normalise(r.tags.join(' '))
    const ingredients = normalise(r.ingredientNames.join(' '))
    let score = 0
    let all = true
    for (const w of words) {
      if (title.includes(w)) score += 3
      else if (tags.includes(w)) score += 2
      else if (ingredients.includes(w)) score += 1
      else {
        all = false
        break
      }
    }
    if (all) scored.push({ r, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.r)
}
