import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Health } from '../api/types'

export function useHealth() {
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => api.health().then((x) => alive && setH(x)).catch(() => alive && setH(null))
    load()
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return h
}
