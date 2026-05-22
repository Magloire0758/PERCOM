import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      email, password, nom, prenom,
      telephone, role, agence_id, equipe_id
    } = await request.json()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const { error: agentError } = await supabaseAdmin
      .from('agents')
      .insert({
        user_id: authData.user.id,
        email,
        nom,
        prenom,
        telephone: telephone || null,
        role,
        agence_id: agence_id || null,
        equipe_id: equipe_id || null,
        statut: 'actif',
        actif: true,
      })

    if (agentError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: agentError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user_id: authData.user.id })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}