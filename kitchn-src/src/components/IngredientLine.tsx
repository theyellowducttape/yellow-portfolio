import { amountFor, nameFor } from '../lib/units'
import type { Ingredient, UnitSystem } from '../lib/types'

interface Props {
  ingredient: Ingredient
  system: UnitSystem
  scale: number
  /** Tapping the amount flips just this ingredient to the other unit system. */
  flipped: boolean
  onFlip: (id: string) => void
}

const other = (s: UnitSystem): UnitSystem => (s === 'us' ? 'metric' : 'us')

export function IngredientLine({ ingredient, system, scale, flipped, onFlip }: Props) {
  const amount = amountFor(ingredient, flipped ? other(system) : system, scale)
  const text = `${amount.estimate ? '≈' : ''}${amount.text}`

  return (
    <span className="ing">
      {amount.canSwitch ? (
        <button
          type="button"
          className="ing-amount is-switchable"
          onClick={() => onFlip(ingredient.id)}
          aria-label={`${text}. Show in ${amount.system === 'us' ? 'grams' : 'cups and spoons'}`}
        >
          {text}
        </button>
      ) : (
        text && <span className="ing-amount">{text}</span>
      )}{' '}
      <span className="ing-name">{nameFor(ingredient, scale)}</span>
      {ingredient.note && <span className="ing-note">, {ingredient.note}</span>}
      {ingredient.optional && <span className="ing-note"> (optional)</span>}
    </span>
  )
}
