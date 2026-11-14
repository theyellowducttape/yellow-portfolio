import type { Ingredient, Operation, Recipe, SetupStep } from './types'

export type Cell =
  | { kind: 'setup'; key: string; setup: SetupStep; row: number; col: number; rowSpan: number; colSpan: number }
  | { kind: 'ingredient'; key: string; ingredient: Ingredient; row: number; col: number; rowSpan: number; colSpan: number }
  | { kind: 'op'; key: string; op: Operation; row: number; col: number; rowSpan: number; colSpan: number }
  | { kind: 'blank'; key: string; row: number; col: number; rowSpan: number; colSpan: number }

export interface OverviewLayout {
  cells: Cell[]
  /** Total columns, including the ingredient column. */
  cols: number
  rows: number
}

interface Placed {
  rowStart: number
  rowEnd: number
  col: number
}

/**
 * Lays out the Cooking for Engineers table. Ingredients go in column 0, in the
 * order the tree visits them, so every operation spans a contiguous block of rows.
 * An operation's column is one more than its deepest input. Inputs that sit in
 * shallower columns stretch to meet their parent: operations widen, and
 * ingredients get a blank filler so the ingredient column stays one width.
 * Grid rows and columns are 0-based here; the renderer adds 1 for CSS grid.
 */
export function layoutOverview(recipe: Recipe): OverviewLayout {
  const ingredients = new Map(recipe.ingredients.map((i) => [i.id, i]))
  const ops = new Map(recipe.operations.map((o) => [o.id, o]))
  const placed = new Map<string, Placed>()
  const setup = recipe.setup ?? []
  let nextRow = setup.length

  const place = (id: string): Placed => {
    const ing = ingredients.get(id)
    if (ing) {
      const p = { rowStart: nextRow, rowEnd: nextRow, col: 0 }
      nextRow += 1
      placed.set(id, p)
      return p
    }
    const op = ops.get(id)!
    const children = op.inputs.map(place)
    const p = {
      rowStart: Math.min(...children.map((c) => c.rowStart)),
      rowEnd: Math.max(...children.map((c) => c.rowEnd)),
      col: Math.max(...children.map((c) => c.col)) + 1,
    }
    placed.set(id, p)
    return p
  }

  const root = recipe.operations[recipe.operations.length - 1]
  const rootPlaced = place(root.id)
  const cols = rootPlaced.col + 1
  const cells: Cell[] = []

  setup.forEach((s, i) => {
    cells.push({ kind: 'setup', key: s.id, setup: s, row: i, col: 0, rowSpan: 1, colSpan: cols })
  })

  // Emit cells top-down so each node knows its parent's column.
  const emit = (id: string, parentCol: number) => {
    const p = placed.get(id)!
    const rowSpan = p.rowEnd - p.rowStart + 1
    const ing = ingredients.get(id)
    if (ing) {
      cells.push({ kind: 'ingredient', key: id, ingredient: ing, row: p.rowStart, col: 0, rowSpan, colSpan: 1 })
      if (parentCol > 1) {
        cells.push({ kind: 'blank', key: `${id}~`, row: p.rowStart, col: 1, rowSpan, colSpan: parentCol - 1 })
      }
      return
    }
    const op = ops.get(id)!
    cells.push({ kind: 'op', key: id, op, row: p.rowStart, col: p.col, rowSpan, colSpan: parentCol - p.col })
    for (const input of op.inputs) emit(input, p.col)
  }
  emit(root.id, rootPlaced.col + 1)

  return { cells, cols, rows: nextRow }
}
