'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_SECTIONS, type NetworkSectionId } from '@/lib/network-export-sections'
import type { ExportRequest } from '@/lib/agent-reporting'

type Target = ExportRequest extends infer T ? T extends ExportRequest ? Omit<T, 'format'> : never : never
export default function AgentExportButtons({ target, disabled = false, completeReport = false, scopeSummary }: { target: Target; disabled?: boolean; completeReport?: boolean; scopeSummary?: {label:string;value:string}[] }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [open,setOpen]=useState(false)
  async function download(format: 'pdf' | 'xlsx', sections?: NetworkSectionId[]) {
    setBusy(format); setError('')
    try {
      const { data, error: authError } = await supabase.auth.getSession()
      if (authError || !data.session) throw new Error('Reconnectez-vous pour exporter.')
      const response = await fetch('/api/agent/exports', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ ...target, format, ...(sections?{sections}:{}) }) })
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
  if(completeReport && target.type==='reseau') return <>
    <button type="button" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={disabled} onClick={()=>{setError('');setOpen(true)}}>Exporter un rapport</button>
    {open && <ExportDialog busy={!!busy} error={error} disabled={disabled} scope={scopeSummary || []} close={()=>setOpen(false)} download={download}/>}
  </>
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {(['pdf', 'xlsx'] as const).map(format => <button key={format} type="button" disabled={disabled || !!busy} onClick={() => download(format)} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy === format ? 'Préparation…' : completeReport ? `Rapport complet · ${format === 'pdf' ? 'PDF' : 'Excel'}` : format === 'pdf' ? 'Exporter PDF' : 'Exporter Excel'}</button>)}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}

function ExportDialog({busy,error,disabled,scope,close,download}:{busy:boolean;error:string;disabled:boolean;scope:{label:string;value:string}[];close:()=>void;download:(format:'pdf'|'xlsx',sections?:NetworkSectionId[])=>Promise<void>}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [format,setFormat]=useState<'pdf'|'xlsx'>('pdf'),[custom,setCustom]=useState(false),[selected,setSelected]=useState<NetworkSectionId[]>(NETWORK_SECTIONS.map(([id])=>id))
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{trigger?.focus({preventScroll:true})}},[])
  return <dialog ref={dialog} aria-labelledby="export-dialog-title" onCancel={e=>{e.preventDefault();if(!busy)close()}} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex items-center justify-between gap-3"><h2 id="export-dialog-title" className="text-xl font-bold">Préparer le rapport</h2><button disabled={busy} onClick={close} className="rounded-lg border px-3 py-2 text-sm">Fermer</button></div>
    <fieldset disabled={busy} className="mt-5 space-y-5">
      <div className="rounded-xl bg-blue-50 p-4 text-xs leading-relaxed"><strong className="block mb-2">Périmètre conservé dans le document</strong>{scope.map(s=><p key={s.label}>{s.label} : {s.value}</p>)}</div>
      <label className="block text-sm font-semibold">Format<select aria-label="Format" value={format} onChange={e=>setFormat(e.target.value as 'pdf'|'xlsx')} className="mt-2 block w-full rounded-lg border p-2"><option value="pdf">PDF</option><option value="xlsx">Excel</option></select></label>
      <div className="flex flex-wrap gap-4 text-sm"><label><input type="radio" name="report-mode" checked={!custom} onChange={()=>setCustom(false)}/> Rapport complet</label><label><input type="radio" name="report-mode" checked={custom} onChange={()=>setCustom(true)}/> Rapport personnalisé</label></div>
      {custom && <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">{NETWORK_SECTIONS.map(([id,label])=><label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{label}</label>)}</div>}
      <p role="status" className="text-sm text-slate-600">{format==='pdf'?'PDF':'Excel'} · {custom?`${selected.length} section(s) sélectionnée(s)`:'8 sections · rapport complet'}. Les filtres et la date de génération sont toujours inclus. Les graphiques restent dans l’application.</p>
      {custom && selected.length===0 && <p className="text-sm text-amber-800">Sélectionnez au moins une section.</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={disabled || (custom && !selected.length)} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40" onClick={()=>void download(format,custom?selected:undefined)}>{busy?'Préparation…':'Télécharger le rapport'}</button>
    </fieldset>
  </dialog>
}
