/**
 * A recipe is a tree: ingredients are the leaves, operations combine them,
 * and the last operation is the root. Both views are derived from this:
 * the overview table (columns = depth in the tree) and the step-by-step view
 * (operations in order).
 */

export type UnitSystem = 'us' | 'metric'

export interface Measure {
  amount: number
  /** e.g. "cup", "tsp", "g", "ml". Empty string for plain counts. */
  unit: string
}

export interface Ingredient {
  id: string
  name: string
  /** Plural name for counts, e.g. "eggs". */
  plural?: string
  /** Cups and spoons. */
  us?: Measure
  /** Grams or millilitres. */
  metric?: Measure
  /** Things that don't convert, like eggs or garlic cloves. */
  count?: Measure
  /** Used when there's no number, e.g. "to taste". */
  amountText?: string
  /** Shown after the name, e.g. "packed". */
  note?: string
  /** Which value is a standard conversion rather than what the cook wrote. It's shown with ≈. */
  estimate?: UnitSystem
  optional?: boolean
  /** Key of a line drawing in components/Illustration.tsx. Falls back to a bowl. */
  illustration?: string
}

export interface Operation {
  id: string
  /** Short label for the overview table, e.g. "mix". */
  label: string
  /** Full instruction for the step-by-step view. */
  text: string
  /** Ingredient ids or earlier operation ids. Each is used exactly once. */
  inputs: string[]
  /** Seconds. */
  timer?: number
}

/** Things outside the tree, like preheating the oven. Shown as full-width rows at the top of the overview. */
export interface SetupStep {
  id: string
  text: string
  /** Operation id this step follows in the step-by-step view. Omit to put it first. */
  after?: string
}

export interface Recipe {
  id: string
  title: string
  description?: string
  tags: string[]
  /** How the recipe was originally written; the default unit system until the user picks one. */
  writtenIn: UnitSystem
  yield?: string
  ingredients: Ingredient[]
  setup?: SetupStep[]
  operations: Operation[]
}

/** The lightweight entry in data/index.json used by the library and search. */
export interface RecipeSummary {
  id: string
  title: string
  description?: string
  tags: string[]
  ingredientNames: string[]
  ingredientCount: number
  stepCount: number
}
