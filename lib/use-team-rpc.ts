'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { assertRpc } from './agent-reporting'

// A changed query never displays the previous query's numbers. Late responses are ignored.
export function useTeamRpc<T>(name: string, args: Record<string, unknown>, enabled = true) {
  const key = JSON.stringify({ name, args, enabled })
  const sequence = useRef(0)
  const [state, setState] = useState<{ key: string; data: T | null; error: string; busy: boolean }>({ key: '', data: null, error: '', busy: true })
  const refresh = useCallback(async () => {
    const id = ++sequence.current
    const query = JSON.parse(key)
    if (!query.enabled) return
    setState({ key, data: null, error: '', busy: true })
    try {
      const result = await supabase.rpc(query.name, query.args)
      const data = assertRpc<T>(result.data, result.error)
      if (id === sequence.current) setState({ key, data, error: '', busy: false })
    } catch (e) {
      if (id === sequence.current) setState({ key, data: null, error: e instanceof Error ? e.message : 'Lecture impossible.', busy: false })
    }
  }, [key])
  const cancel = useCallback(() => { sequence.current++ }, [])
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = setInterval(visible, 60_000)
    window.addEventListener('focus', visible); window.addEventListener('online', visible)
    const channel = enabled ? supabase.channel(`team-${name}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiches_journalieres' }, visible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, visible).subscribe() : null
    return () => { cancel(); clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', visible); window.removeEventListener('online', visible); if (channel) void supabase.removeChannel(channel) }
  }, [cancel, enabled, name, refresh])
  // The query key is internal bookkeeping, never a React prop.
  const current = state.key === key && enabled
  return { data: current ? state.data : null, error: current ? state.error : '', busy: current ? state.busy : enabled, refresh }
}
