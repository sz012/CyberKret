import { useOutletContext } from 'react-router-dom'
import type { Org } from '../api/types'

export interface OrgCtx {
  org: Org | null
  reloadOrg: () => Promise<void>
}

export function useOrg() {
  return useOutletContext<OrgCtx>()
}
