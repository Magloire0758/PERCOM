import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ROLES_AUTORISES = ['agent', 'chef', 'responsable', 'dg'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    const prenom = typeof body.prenom === 'string' ? body.prenom.trim() : ''
    const telephone = typeof body.telephone === 'string' ? body.telephone.trim() : ''
    const role = typeof body.role === 'string' ? body.role : ''
    const agenceId = typeof body.agence_id === 'string' && body.agence_id ? body.agence_id : null
    const equipeId = typeof body.equipe_id === 'string' && body.equipe_id ? body.equipe_id : null
    const callerToken = typeof body.callerToken === 'string' ? body.callerToken : ''

    if (!email || !password || !nom || !prenom || !callerToken) {
      return NextResponse.json({ ok: false, error: 'Paramètres manquants.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Mot de passe : minimum 8 caractères.' }, { status: 400 })
    }
    if (!ROLES_AUTORISES.includes(role as (typeof ROLES_AUTORISES)[number])) {
      return NextResponse.json(
        { ok: false, error: 'Rôle invalide ou non autorisé (admin exclu).' },
        { status: 400 },
      )
    }
    if (equipeId && !['agent','chef'].includes(role)) return NextResponse.json({ok:false,error:'Un rôle de gestion ne peut pas être membre d’une équipe.'},{status:400})
    if (equipeId && !agenceId) {
      return NextResponse.json(
        { ok: false, error: "Une agence doit être choisie avant l'équipe." },
        { status: 400 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'Configuration serveur incomplète.' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: callerData, error: authError } = await admin.auth.getUser(callerToken)
    if (authError || !callerData.user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 })
    }

    const { data: callerAgent, error: callerError } = await admin
      .from('agents')
      .select('role, statut, actif')
      .eq('user_id', callerData.user.id)
      .single()

    if (
      callerError ||
      !callerAgent ||
      callerAgent.role !== 'admin' ||
      callerAgent.actif !== true ||
      callerAgent.statut !== 'actif'
    ) {
      return NextResponse.json({ ok: false, error: 'Accès refusé (admin actif requis).' }, { status: 403 })
    }

    if (agenceId) {
      const { data: agence, error: agenceError } = await admin
        .from('agences')
        .select('id')
        .eq('id', agenceId)
        .single()
      if (agenceError || !agence) {
        return NextResponse.json({ ok: false, error: 'Agence invalide.' }, { status: 400 })
      }
    }

    if (equipeId) {
      const { data: equipe, error: equipeError } = await admin
        .from('equipes')
        .select('id, agence_id')
        .eq('id', equipeId)
        .single()
      if (equipeError || !equipe || (agenceId && equipe.agence_id !== agenceId)) {
        return NextResponse.json({ ok: false, error: "Équipe invalide pour l'agence choisie." }, { status: 400 })
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      return NextResponse.json(
        { ok: false, error: 'Création du compte impossible. Vérifiez les informations saisies.' },
        { status: 400 },
      )
    }

    const { error: insertError } = await admin.from('agents').insert({
      user_id: created.user.id,
      email,
      nom,
      prenom,
      telephone: telephone || null,
      role,
      agence_id: agenceId,
      equipe_id: equipeId,
      statut: 'actif',
      actif: true,
    })

    if (insertError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id)
      if (cleanupError) console.error('create-user: échec de compensation Auth', cleanupError.message)
      return NextResponse.json(
        { ok: false, error: cleanupError ? 'Profil non créé. Une intervention administrateur est nécessaire pour terminer le nettoyage du compte.' : 'Profil non créé. La création du compte a été annulée.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, userId: created.user.id }, { status: 201 })
  } catch (error: unknown) {
    void error
    const message = 'Création du compte impossible.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
