import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { layoutOverview } from '../lib/layout'
import type { Recipe, UnitSystem } from '../lib/types'
import { IngredientLine } from './IngredientLine'

interface Props {
  recipe: Recipe
  system: UnitSystem
  scale: number
  flipped: Set<string>
  onFlip: (id: string) => void
}

// Classic layout widths, in px. Keep in sync with .overview.is-wide in styles.css.
const WIDE_INGREDIENT = 176
const WIDE_STEP = 88

/**
 * The Cooking for Engineers table, drawn with CSS grid. Picks whichever layout fits the space:
 * - wide: every label horizontal, when each step column can get at least WIDE_STEP px
 * - compact: narrow step labels turn sideways (this is what fits a phone turned landscape)
 * If even compact doesn't fit (long recipes on a phone held upright), it scrolls sideways
 * with the ingredient column pinned.
 */
export function OverviewTable({ recipe, system, scale, flipped, onFlip }: Props) {
  const layout = useMemo(() => layoutOverview(recipe), [recipe])
  const scroller = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const needed = WIDE_INGREDIENT + (layout.cols - 1) * WIDE_STEP + layout.cols + 1 // + 1px grid lines
    const check = () => setWide(el.clientWidth >= needed)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout.cols])

  return (
    <div ref={scroller} className="overview-scroll" tabIndex={0} aria-label="Recipe overview">
      <div className={`overview ${wide ? 'is-wide' : 'is-compact'}`} style={{ ['--op-cols' as string]: layout.cols - 1 }}>
        {layout.cells.map((cell) => {
          const style = {
            gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
            gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
          }
          switch (cell.kind) {
            case 'setup':
              return (
                <div key={cell.key} className="cell cell-setup" style={style}>
                  <span>{cell.setup.text}</span>
                </div>
              )
            case 'ingredient':
              return (
                <div key={cell.key} className="cell cell-ingredient" style={style}>
                  <IngredientLine
                    ingredient={cell.ingredient}
                    system={system}
                    scale={scale}
                    flipped={flipped.has(cell.ingredient.id)}
                    onFlip={onFlip}
                  />
                </div>
              )
            case 'op':
              return (
                // In compact mode, narrow cells turn their label sideways.
                <div key={cell.key} className={`cell cell-op${cell.colSpan <= 2 ? ' is-narrow' : ''}`} style={style}>
                  <span>{cell.op.label}</span>
                </div>
              )
            case 'blank':
              return <div key={cell.key} className="cell" style={style} aria-hidden="true" />
          }
        })}
      </div>
    </div>
  )
}
