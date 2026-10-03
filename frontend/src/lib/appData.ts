import { createContext, useContext } from 'react'
import type { Health, Organization } from '../api/types'

export interface AppData {
  org: Organization | null
  health: Health | null
  setOrg: (org: Organization) => void
  reloadOrg: () => Promise<void>
}

export const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('AppDataContext missing')
  return value
}

export function useOrg() {
  const { org, setOrg, reloadOrg } = useAppData()
  return { org, setOrg, reloadOrg }
}

export function useRequiredOrg(): Organization {
  const { org } = useAppData()
  if (!org) throw new Error('organization not loaded')
  return org
}
