import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useLocation } from './lib/router'
import { Library } from './views/Library'
import { NotFound } from './views/NotFound'
import { RecipePage } from './views/RecipePage'
import './styles.css'

function App() {
  const { route } = useLocation()

  useEffect(() => {
    if (route.name !== 'recipe') document.title = 'kitchn'
  }, [route.name])

  switch (route.name) {
    case 'library':
      return <Library />
    case 'recipe':
      return <RecipePage key={route.id} id={route.id} />
    default:
      return <NotFound />
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
