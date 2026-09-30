import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return json({ ok: false, error: 'Configuration cron incomplète.' }, 503)
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'Non autorisé.' }, 401)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Configuration serveur incomplète.' }, 503)
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  const reference = new Date().toISOString().slice(0, 10)
  const { data, error } = await service.rpc('generer_objectifs_modeles_echeance', {
    p_reference: reference,
  })

  if (error) {
    console.error('Échec du renouvellement des modèles d’objectifs.', error.message)
    return json({ ok: false, error: 'Renouvellement indisponible.' }, 500)
  }

  const result = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : { ok: false, error: 'Réponse serveur invalide.' }
  return json(result, result.ok === true ? 200 : 500)
}
