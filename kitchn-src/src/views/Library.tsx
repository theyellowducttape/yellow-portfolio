import { useMemo } from 'react'
import { useRecipeIndex } from '../lib/data'
import { Link, recipePath, setParams, useLocation } from '../lib/router'
import { searchRecipes } from '../lib/search'

export function Library() {
  const index = useRecipeIndex()
  const { params } = useLocation()
  const query = params.get('q') ?? ''
  const results = useMemo(
    () => (index.status === 'ready' ? searchRecipes(index.data, query) : []),
    [index, query],
  )

  return (
    <main className="page library">
      <header className="library-head">
        <h1 className="wordmark">kitchn</h1>
        <p className="tagline">Recipes you can follow with flour on your hands.</p>
      </header>

      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="q" className="visually-hidden">
          Search recipes
        </label>
        <input
          id="q"
          type="search"
          placeholder="Search a dish or ingredient"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          // Replace, so each keystroke doesn't add a history entry.
          onChange={(e) => setParams({ q: e.target.value || null }, { replace: true })}
        />
      </form>

      {index.status === 'loading' && <p className="muted">Loading recipes…</p>}
      {index.status === 'error' && <p className="muted">Couldn't load recipes. Check your connection and refresh.</p>}

      {index.status === 'ready' && results.length > 0 && (
        <ul className="grid">
          {results.map((r) => (
            <li key={r.id}>
              <Link href={recipePath(r.id)} className="card">
                <h2>{r.title}</h2>
                <p className="card-meta">
                  {r.ingredientCount} ingredients · {r.stepCount} steps
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {index.status === 'ready' && results.length === 0 && (
        <div className="empty">
          <p>
            No recipe for <strong>“{query}”</strong> yet.
          </p>
          <p className="muted">Soon you'll be able to paste a recipe or a video link here and kitchn will turn it into steps.</p>
        </div>
      )}
    </main>
  )
}
