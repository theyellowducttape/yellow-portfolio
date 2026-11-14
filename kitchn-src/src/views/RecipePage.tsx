import { useCallback, useEffect, useState } from 'react'
import { Controls } from '../components/Controls'
import { OverviewTable } from '../components/OverviewTable'
import { StepView } from '../components/StepView'
import { useRecipe } from '../lib/data'
import { useUnitSystem } from '../lib/prefs'
import { BASE, Link, setParams, useLocation } from '../lib/router'
import type { Recipe } from '../lib/types'
import { NotFound } from './NotFound'

export function RecipePage({ id }: { id: string }) {
  const recipe = useRecipe(id)
  if (recipe.status === 'loading') return <main className="page"><p className="muted">Loading…</p></main>
  if (recipe.status === 'error') {
    return recipe.notFound ? <NotFound /> : (
      <main className="page"><p className="muted">Couldn't load this recipe. Check your connection and refresh.</p></main>
    )
  }
  return <RecipeContent recipe={recipe.data} />
}

function RecipeContent({ recipe }: { recipe: Recipe }) {
  const { params } = useLocation()
  const view = params.get('view') === 'steps' ? 'steps' : 'overview'
  const step = Math.max(0, Number(params.get('step') ?? '1') - 1) || 0

  const [system, setSystem] = useUnitSystem(recipe.writtenIn)
  const [scale, setScale] = useState(1)
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    document.title = `${recipe.title} · kitchn`
  }, [recipe.title])

  // Picking a unit system resets any single-ingredient flips.
  const chooseSystem = useCallback(
    (s: typeof system) => {
      setSystem(s)
      setFlipped(new Set())
    },
    [setSystem],
  )
  const flip = useCallback((ingId: string) => {
    setFlipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(ingId)) next.add(ingId)
      return next
    })
  }, [])

  const shared = { recipe, system, scale, flipped, onFlip: flip }

  return (
    <main className={`page recipe is-${view}`}>
      <header className="recipe-head">
        <Link href={BASE} className="back" aria-label="Back to recipes">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="muted">{recipe.description}</p>}
      </header>

      <div className="tabs" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'overview'}
          onClick={() => setParams({ view: null, step: null })}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'steps'}
          onClick={() => setParams({ view: 'steps', step: String(step + 1) })}
        >
          Step by step
        </button>
      </div>

      <Controls system={system} onSystem={chooseSystem} scale={scale} onScale={setScale} />

      {view === 'overview' ? (
        <>
          <OverviewTable {...shared} />
          <p className="hint muted">Tap an amount to switch just that ingredient between cups and grams. ≈ marks a standard conversion.</p>
          <button type="button" className="cta" onClick={() => setParams({ view: 'steps', step: '1' })}>
            Start cooking
          </button>
        </>
      ) : (
        <StepView
          {...shared}
          index={step}
          onIndex={(n) => setParams({ step: String(n + 1) }, { replace: true })}
          onDone={() => setParams({ view: null, step: null })}
        />
      )}
    </main>
  )
}
