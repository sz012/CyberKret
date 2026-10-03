import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'

export interface Resource<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => Promise<void>
  setData: (value: T) => void
}

interface Snapshot<T> {
  key: string | null
  data: T | undefined
  error: string | null
}

export function useResource<T>(loader: () => Promise<T>, key: string): Resource<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key: null, data: undefined, error: null })
  const [reloading, setReloading] = useState(false)
  const loaderRef = useRef(loader)
  const keyRef = useRef(key)

  useEffect(() => {
    loaderRef.current = loader
    keyRef.current = key
  })

  useEffect(() => {
    let alive = true
    loaderRef.current().then(
      (data) => {
        if (alive) setSnapshot({ key, data, error: null })
      },
      (caught: unknown) => {
        if (alive) setSnapshot({ key, data: undefined, error: errorMessage(caught) })
      },
    )
    return () => {
      alive = false
    }
  }, [key])

  const reload = useCallback(async () => {
    setReloading(true)
    try {
      const data = await loaderRef.current()
      setSnapshot({ key: keyRef.current, data, error: null })
    } catch (caught) {
      setSnapshot((previous) => ({ ...previous, key: keyRef.current, error: errorMessage(caught) }))
    } finally {
      setReloading(false)
    }
  }, [])

  const setData = useCallback((data: T) => {
    setSnapshot({ key: keyRef.current, data, error: null })
  }, [])

  const current = snapshot.key === key
  return {
    data: current ? snapshot.data : undefined,
    error: current ? snapshot.error : null,
    loading: !current || reloading,
    reload,
    setData,
  }
}
