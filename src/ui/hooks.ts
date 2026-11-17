// Small React hooks shared by tabs.
import { useEffect, useState } from 'react'
import { loadCatalog, loadTleIndex, type CatalogEntry, type TleGroupId, type TleIndex } from '../data/tle'

export function useTleIndex(): TleIndex | null {
  const [index, setIndex] = useState<TleIndex | null>(null)
  useEffect(() => {
    loadTleIndex()
      .then(setIndex)
      .catch(() => setIndex({ fetchedAt: null, groups: {} }))
  }, [])
  return index
}

export interface CatalogState {
  entries: CatalogEntry[]
  loading: boolean
  error: string | null
}

export function useCatalog(groups: readonly TleGroupId[]): CatalogState {
  const key = [...groups].sort().join(',')
  // `key` records which request the stored result belongs to; a mismatch means "loading".
  const [state, setState] = useState<{ key: string | null; entries: CatalogEntry[]; error: string | null }>({
    key: null,
    entries: [],
    error: null,
  })
  useEffect(() => {
    let cancelled = false
    loadCatalog(key ? (key.split(',') as TleGroupId[]) : [])
      .then((entries) => !cancelled && setState({ key, entries, error: null }))
      .catch((e: unknown) => !cancelled && setState((s) => ({ key, entries: s.entries, error: String(e) })))
    return () => {
      cancelled = true
    }
  }, [key])
  return { entries: state.entries, loading: state.key !== key, error: state.key === key ? state.error : null }
}
