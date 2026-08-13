import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword, callerToken } = await req.json()

    if (!userId || !newPassword) {
      return NextResponse.json({ ok: false, error: 'Paramètres manquants.' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Client admin (service role)
    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Vérifier que l'appelant est authentifié
    const { data: caller, error: callerErr } = await admin.auth.getUser(callerToken)
    if (callerErr || !caller?.user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 })
    }

    // 2. Vérifier que l'appelant est admin
    const { data: callerAgent } = await admin
      .from('agents')
      .select('role')
      .eq('user_id', caller.user.id)
      .single()

    if (callerAgent?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Accès réservé aux administrateurs.' }, { status: 403 })
    }

    // 3. Réinitialiser le mot de passe de l'utilisateur cible
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}