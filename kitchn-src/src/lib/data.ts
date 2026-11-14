import { useEffect, useState } from 'react'
import { BASE } from './router'
import type { Recipe, RecipeSummary } from './types'

const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`${BASE}data/${path}`).then((res) => {
      if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `HTTP ${res.status}`)
      return res.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

export type Loadable<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; notFound: boolean }

function useLoad<T>(path: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    load<T>(path).then(
      (data) => live && setState({ status: 'ready', data }),
      (e: Error) => live && setState({ status: 'error', notFound: e.message === 'not-found' }),
    )
    return () => {
      live = false
    }
  }, [path])
  return state
}

export const useRecipeIndex = () => useLoad<RecipeSummary[]>('index.json')
export const useRecipe = (id: string) => useLoad<Recipe>(`recipes/${id}.json`)
