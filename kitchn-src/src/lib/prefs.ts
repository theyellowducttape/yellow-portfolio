import { useCallback, useState } from 'react'
import type { UnitSystem } from './types'

const KEY = 'kitchn:units'

function read(): UnitSystem | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'us' || v === 'metric' ? v : null
  } catch {
    return null
  }
}

/**
 * The user's unit system, saved on this device. Until they choose,
 * each recipe shows the units it was written in.
 */
export function useUnitSystem(fallback: UnitSystem): [UnitSystem, (s: UnitSystem) => void] {
  const [chosen, setChosen] = useState<UnitSystem | null>(read)
  const set = useCallback((s: UnitSystem) => {
    setChosen(s)
    try {
      localStorage.setItem(KEY, s)
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
  }, [])
  return [chosen ?? fallback, set]
}
