import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

export const BASE = import.meta.env.BASE_URL // "/kitchn/"

export type Route = { name: 'library' } | { name: 'recipe'; id: string } | { name: 'notfound' }

export function parseRoute(pathname: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '')
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'library' }
  if (parts[0] === 'r' && parts[1] && parts.length === 2) return { name: 'recipe', id: parts[1] }
  return { name: 'notfound' }
}

export const recipePath = (id: string) => `${BASE}r/${id}/`

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
window.addEventListener('popstate', notify)

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const snapshot = () => location.pathname + location.search

/** Re-renders when the path or query changes. */
export function useLocation() {
  useSyncExternalStore(subscribe, snapshot)
  return { route: parseRoute(location.pathname), params: new URLSearchParams(location.search) }
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === snapshot()) return
  if (replace) history.replaceState(null, '', to)
  else {
    history.pushState(null, '', to)
    window.scrollTo(0, 0)
  }
  notify()
}

/** Updates query parameters on the current page. Null removes one. */
export function setParams(changes: Record<string, string | null>, opts?: { replace?: boolean }) {
  const params = new URLSearchParams(location.search)
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) params.delete(k)
    else params.set(k, v)
  }
  const q = params.toString()
  navigate(location.pathname + (q ? `?${q}` : ''), opts)
}

/** An anchor that navigates in-app but still works with cmd-click and middle-click. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...rest} />
}
