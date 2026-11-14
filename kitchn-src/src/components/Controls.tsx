import { SCALES, scaleLabel } from '../lib/units'
import type { UnitSystem } from '../lib/types'

interface Props {
  system: UnitSystem
  onSystem: (s: UnitSystem) => void
  scale: number
  onScale: (s: number) => void
}

export function Controls({ system, onSystem, scale, onScale }: Props) {
  const i = SCALES.indexOf(scale)
  return (
    <div className="controls">
      <div className="segmented" role="radiogroup" aria-label="Units">
        {(
          [
            ['us', 'Cups & spoons'],
            ['metric', 'Grams & ml'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={system === value}
            className={system === value ? 'is-on' : ''}
            onClick={() => onSystem(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="stepper" aria-label="Scale recipe">
        <button type="button" onClick={() => onScale(SCALES[i - 1])} disabled={i <= 0} aria-label="Make less">
          −
        </button>
        <output aria-live="polite" aria-label={`Scaled ${scaleLabel(scale)}`}>
          {scaleLabel(scale)}
        </output>
        <button type="button" onClick={() => onScale(SCALES[i + 1])} disabled={i >= SCALES.length - 1} aria-label="Make more">
          +
        </button>
      </div>
    </div>
  )
}
