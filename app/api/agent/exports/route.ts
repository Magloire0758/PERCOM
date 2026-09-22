import { validNetworkSections, selectNetworkSections } from '@/lib/network-export-sections'
import { networkModel, networkArgs, validNetworkFilters, NO_ATTACHMENT, type NetworkNames, type NetworkReport } from '@/lib/network-reporting'
import { teamModel, type TeamReport } from '@/lib/team-reporting'
import { agencyModel, type AgencyReport } from '@/lib/agency-reporting'
import { createClient } from '@supabase/supabase-js'
import { assertRpc, checkReport, METRICS, STATUTS, todayLome, validPeriod, type Comparison, type DailyReport, type IntervalReport, type Objectives, type Regularity, type Statut } from '@/lib/agent-reporting'
import { dailyModel, intervalModel, type ExportModel } from '@/lib/agent-export-model'
import { renderAgentExcel, renderAgentPdf } from '@/lib/agent-export-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization' }
function fail(error: string, status: number) { return Response.json({ error }, { status, headers }) }

export async function POST(request: Request) {
  try { return await exportRequest(request) }
  catch { return fail('Service temporairement indisponible. Réessayez.', 503) }
}

async function exportRequest(request: Request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return fail('Session requise.', 401)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fail('Configuration serveur indisponible.', 503)
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: auth, error: authError } = await client.auth.getUser(token)
  if (authError || !auth.user) return fail('Session expirée. Reconnectez-vous.', 401)
  const { data: agent, error: agentError } = await client.from('agents').select('id, role, actif, statut').eq('user_id', auth.user.id).single()
  if (agentError || !agent || !['agent', 'chef', 'responsable', 'dg'].includes(agent.role) || agent.actif !== true || agent.statut !== 'actif') return fail('Compte actif autorisé requis.', 403)
  let body
  try { body = await request.json() } catch { return fail('Requête invalide.', 400) }
  if (!body || !['pdf', 'xlsx'].includes(body.format) || !['fiche', 'intervalle', 'statistiques', 'equipe', 'agence', 'reseau'].includes(body.type)) return fail('Format ou rapport invalide.', 400)
  if (body.type === 'equipe' && !['chef', 'responsable', 'dg'].includes(agent.role)) return fail('Compte chef ou responsable requis.', 403)
  if (body.type === 'agence' && !['responsable', 'dg'].includes(agent.role)) return fail('Compte responsable requis.', 403)
  if (body.type === 'reseau' && agent.role !== 'dg') return fail('Compte direction requis.', 403)
  if (body.sections !== undefined && (body.type !== 'reseau' || !validNetworkSections(body.sections))) return fail('Choisissez au moins une section valide, sans doublon.', 400)
  // An agent always exports self; a chef may choose a target, authorized by each RPC.
  const target = ['chef', 'responsable', 'dg'].includes(agent.role) && body.agentId !== undefined ? body.agentId : agent.id
  if (typeof target !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target)) return fail('Identifiant membre invalide.', 400)
  try {
    let model: ExportModel
    let suffix: string
    if (body.type === 'fiche') {
      if (typeof body.ficheId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.ficheId)) return fail('Identifiant de fiche invalide.', 400)
      const result = await client.rpc('rapport_fiche_journaliere', { p_fiche_id: body.ficheId })
      const report = assertRpc<DailyReport>(result.data, result.error)
      model = dailyModel(report); suffix = report.entete.date
    } else {
      const p = body.periode
      if (!p || !validPeriod(p) || (Date.parse(p.fin) - Date.parse(p.debut)) / 86400000 >= 366) return fail('Choisissez une période valide de 366 jours maximum.', 400)
      if (!Array.isArray(body.statuts) || !body.statuts.length || body.statuts.length > 3 || !body.statuts.every((s: unknown) => typeof s === 'string' && STATUTS.includes(s as Statut))) return fail('Statuts invalides.', 400)
      if (body.type === 'reseau') {
        if (!validNetworkFilters(body.filtres)) return fail('Périmètre réseau invalide.', 400)
        const result = await client.rpc('rapport_reseau', { p_date_debut: p.debut, p_date_fin: p.fin, p_statuts: [...new Set(body.statuts)], ...networkArgs(body.filtres) })
        const report = assertRpc<NetworkReport>(result.data, result.error)
        // Names are resolved with the same authenticated client, never accepted from the body.
        // The report can legitimately have no activity for an existing selected target.
        const names: NetworkNames = {}
        const lookups = [
          ['agence','agences','nom',body.filtres.agenceId],
          ['equipe','equipes','nom',body.filtres.equipeId],
          ['membre','agents','prenom,nom',body.filtres.membreId],
        ] as const
        await Promise.all(lookups.map(async ([kind,table,fields,id]) => {
          if (!id || id === NO_ATTACHMENT) return
          const lookup = await client.from(table).select(fields).eq('id',id).maybeSingle()
          if (lookup.error) throw new Error('Périmètre indisponible.')
          const row = lookup.data as { nom?: string; prenom?: string } | null
          if (row?.nom) names[kind] = kind === 'membre' ? [row.prenom,row.nom].filter(Boolean).join(' ') : row.nom
        }))
        model = selectNetworkSections(networkModel(report,names),body.sections)
      } else if (body.type === 'agence') {
        if (agent.role === 'dg' && (typeof body.agenceId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.agenceId))) return fail('Agence requise.', 400)
        // Agency is derived by the RPC from the authenticated RA, never from the body.
        const result = await client.rpc('rapport_agence', { ...(agent.role === 'dg' ? { p_agence_id: body.agenceId } : {}), p_date_debut: p.debut, p_date_fin: p.fin, p_statuts: [...new Set(body.statuts)] })
        model = agencyModel(assertRpc<AgencyReport>(result.data, result.error))
      } else if (body.type === 'equipe') {
        if (typeof body.inclureChef !== 'boolean') return fail('Périmètre équipe invalide.', 400)
        if (['responsable', 'dg'].includes(agent.role) && (typeof body.equipeId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.equipeId))) return fail('Équipe requise.', 400)
        const result = await client.rpc('rapport_equipe', { ...(['responsable', 'dg'].includes(agent.role) ? { p_equipe_id: body.equipeId } : {}), p_date_debut: p.debut, p_date_fin: p.fin, p_statuts: [...new Set(body.statuts)], p_inclure_chef: body.inclureChef })
        model = teamModel(assertRpc<TeamReport>(result.data, result.error))
      } else {
        const args = { p_agent_id: target, p_date_debut: p.debut, p_date_fin: p.fin }
        const filtered = { ...args, p_statuts: [...new Set(body.statuts)] }
        const result = await client.rpc('rapport_intervalle', filtered)
        const report = assertRpc<IntervalReport>(result.data, result.error)
        checkReport(report)
        if (body.type === 'statistiques') {
          const [c, r, o] = await Promise.all([client.rpc('agent_comparaison', filtered), client.rpc('agent_regularite', args), client.rpc('agent_objectifs_avec_progression', { p_agent_id: target, p_date: todayLome() })])
          const comparison = assertRpc<Comparison>(c.data, c.error)
          for (const [metric] of METRICS) if (Number(comparison.actuel[metric]) !== Number(report.totaux[metric])) throw new Error('Les données ont changé. Actualisez avant de réexporter.')
          model = intervalModel(report, { comparison, regularity: assertRpc<Regularity>(r.data, r.error), objectives: assertRpc<Objectives>(o.data, o.error) })
        } else model = intervalModel(report)
      }
      suffix = `${p.debut}_${p.fin}`
    }
    const buffer = body.format === 'pdf' ? await renderAgentPdf(model) : await renderAgentExcel(model)
    return new Response(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': body.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="percom-${body.type}-${suffix}.${body.format}"` } })
  } catch {
    // Never forward internal SQL errors or return a partial report as a successful file.
    return fail('Export impossible : accès refusé, données modifiées ou service indisponible. Actualisez puis réessayez.', 422)
  }
}
