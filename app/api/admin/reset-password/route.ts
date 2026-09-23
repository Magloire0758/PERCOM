import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const callerToken = typeof body.callerToken === 'string' ? body.callerToken : ''

    if (!agentId || !newPassword || !callerToken) {
      return NextResponse.json({ ok: false, error: 'Paramètres manquants.' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'Configuration serveur incomplète.' }, { status: 500 })
    }

    // Client admin (service role)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Vérifier que l'appelant est authentifié
    const { data: caller, error: callerErr } = await admin.auth.getUser(callerToken)
    if (callerErr || !caller?.user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 })
    }

    // 2. Vérifier que l'appelant est admin
    const { data: callerAgent, error: callerAgentError } = await admin
      .from('agents')
      .select('role, statut, actif')
      .eq('user_id', caller.user.id)
      .single()

    if (
      callerAgentError ||
      callerAgent?.role !== 'admin' ||
      callerAgent.statut !== 'actif' ||
      callerAgent.actif !== true
    ) {
      return NextResponse.json({ ok: false, error: 'Accès refusé (admin actif requis).' }, { status: 403 })
    }

    const target = await admin.from('agents').select('user_id,role').eq('id', agentId).single()
    if (target.error || !target.data?.user_id || !['agent','chef','responsable','dg'].includes(target.data.role)) {
      return NextResponse.json({ok:false,error:'Compte PERCOM cible invalide ou protégé.'},{status:403})
    }
    const userId = target.data.user_id

    // 3. Réinitialiser le mot de passe de l'utilisateur cible
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateErr) {
      return NextResponse.json({ ok: false, error: 'Réinitialisation impossible.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    void error
    const message = 'Réinitialisation impossible.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
