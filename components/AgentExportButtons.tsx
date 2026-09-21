'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ExportRequest } from '@/lib/agent-reporting'

type Target = ExportRequest extends infer T ? T extends ExportRequest ? Omit<T, 'format'> : never : never
export default function AgentExportButtons({ target, disabled = false }: { target: Target; disabled?: boolean }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function download(format: 'pdf' | 'xlsx') {
    setBusy(format); setError('')
    try {
      const { data, error: authError } = await supabase.auth.getSession()
      if (authError || !data.session) throw new Error('Reconnectez-vous pour exporter.')
      const response = await fetch('/api/agent/exports', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ ...target, format }) })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Export indisponible. Réessayez.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `percom.${format}`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Export impossible.') }
    finally { setBusy('') }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {(['pdf', 'xlsx'] as const).map(format => <button key={format} type="button" disabled={disabled || !!busy} onClick={() => download(format)} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy === format ? 'Préparation…' : format === 'pdf' ? 'Exporter PDF' : 'Exporter Excel'}</button>)}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
