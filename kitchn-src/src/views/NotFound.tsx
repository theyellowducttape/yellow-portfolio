import { BASE, Link } from '../lib/router'

export function NotFound() {
  return (
    <main className="page">
      <h1>Nothing cooking here</h1>
      <p className="muted">This recipe doesn't exist, or it moved.</p>
      <Link href={BASE} className="cta">
        Back to recipes
      </Link>
    </main>
  )
}
