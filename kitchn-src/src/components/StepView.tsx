import { useEffect, useMemo, useRef } from 'react'
import { formatDuration, stepsFor } from '../lib/steps'
import type { Recipe, UnitSystem } from '../lib/types'
import { IngredientLine } from './IngredientLine'
import { Illustration } from './Illustration'

interface Props {
  recipe: Recipe
  system: UnitSystem
  scale: number
  flipped: Set<string>
  onFlip: (id: string) => void
  /** 0-based. */
  index: number
  onIndex: (i: number) => void
  onDone: () => void
}

const SWIPE_PX = 60

export function StepView({ recipe, system, scale, flipped, onFlip, index, onIndex, onDone }: Props) {
  const steps = useMemo(() => stepsFor(recipe), [recipe])
  const i = Math.min(Math.max(index, 0), steps.length - 1)
  const step = steps[i]
  const last = i === steps.length - 1
  const forward = useRef(true)

  const go = (to: number) => {
    forward.current = to > i
    onIndex(to)
  }
  const next = () => (last ? onDone() : go(i + 1))
  const back = () => i > 0 && go(i - 1)

  // Arrow keys, for laptops and tablets with keyboards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Horizontal swipe; vertical scrolling is left alone.
  const start = useRef<{ x: number; y: number } | null>(null)

  return (
    <section
      className="steps"
      aria-label="Step by step"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.clientX - s.x
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
          if (dx < 0) next()
          else back()
        }
      }}
    >
      <div className="progress" aria-hidden="true">
        {steps.map((s, n) => (
          <span key={s.key} className={n <= i ? 'is-done' : ''} />
        ))}
      </div>
      <p className="step-count">
        Step {i + 1} of {steps.length}
      </p>

      <article key={step.key} className={`step ${forward.current ? 'from-right' : 'from-left'}`} aria-live="polite">
        {step.adds.length > 0 && (
          <div className="illustrations">
            {step.adds.map((ing, n) => (
              <Illustration key={ing.id} name={ing.name} drawing={ing.illustration} order={n} />
            ))}
          </div>
        )}

        <p className="step-text">{step.text}</p>

        {step.adds.length > 0 && (
          <ul className="step-ingredients">
            {step.adds.map((ing) => (
              <li key={ing.id}>
                <IngredientLine
                  ingredient={ing}
                  system={system}
                  scale={scale}
                  flipped={flipped.has(ing.id)}
                  onFlip={onFlip}
                />
              </li>
            ))}
          </ul>
        )}

        {step.timer && <p className="timer">{formatDuration(step.timer)}</p>}
      </article>

      <nav className="step-nav">
        <button type="button" onClick={back} disabled={i === 0}>
          Back
        </button>
        <button type="button" className="is-primary" onClick={next}>
          {last ? 'Done' : 'Next'}
        </button>
      </nav>
    </section>
  )
}
