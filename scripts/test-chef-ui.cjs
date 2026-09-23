// Isolated browser recipe: HTTP and websocket Supabase traffic are intercepted.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
async function main() {
  const fixture = JSON.parse(fs.readFileSync('.next/lot5-validation/fixture.json', 'utf8'))
  const team = JSON.parse(fs.readFileSync('.next/lot6-validation/fixture.json', 'utf8'))
  const config = fs.readFileSync('.env.local', 'utf8')
  const url = config.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?(https:\/\/[^\s"']+)/)?.[1]
  assert.ok(url)
  const ref = new URL(url).hostname.split('.')[0], id = team.par_membre[0].agent_id, member = team.par_membre[1].agent_id
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'synthetic-signature'].join('.')
  const session = { access_token: jwt, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addCookies([{ name: `sb-${ref}-auth-token`, value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: 'localhost', path: '/' }])
    await context.routeWebSocket('**/realtime/**', ws => ws.onMessage(() => {}))
    const calls = []; let decisions = 0, fail = false, delayMember = false
    let rows = Array.from({ length: 24 }, (_, i) => ({ fiche_id: `33333333-3333-4333-8333-${String(i + 1).padStart(12, '0')}`, agent_id: member, nom: 'Suspendu test', prenom: 'Compte', membre_actif: false, est_moi: false, date: '2026-08-01', anciennete_jours: 48, statut: i < 22 ? 'en_attente' : 'a_corriger', smart: 500, caisse: 450, ecart: 50, peut_traiter: true }))
    await context.route(`${url}/**`, async route => {
      const request = route.request(), u = new URL(request.url()); let body = []
      if (u.pathname.includes('/auth/v1/')) body = user
      else if (u.pathname.includes('/rpc/')) {
        const name = u.pathname.split('/').pop(), args = request.postDataJSON(); calls.push({ name, args })
        const responses = { agent_agregats: fixture.report.totaux, rapport_intervalle: fixture.report, agent_regularite: fixture.regularity, agent_objectifs_avec_progression: fixture.objectives, agent_comparaison: fixture.comparison, obtenir_classement_agence: { ok: true, classement: [{ agent_id: id, rang: 1, nom: 'Chef test', prenom: 'Compte', est_moi: true, total_smart: 1500 }] }, equipe_agregats: { ok: true, equipe_id: id, totaux: team.synthese, par_membre: team.par_membre }, rapport_equipe: { ...team, periode: { debut: args.p_date_debut, fin: args.p_date_fin }, chef_inclus: args.p_inclure_chef, statuts: args.p_statuts }, classement_equipe: { ok: true, classement: team.par_membre.map((m, i) => ({ ...m, rang: i + 1, est_moi: m.agent_id === id })) } }
        body = responses[name] || { ok: true }
        if (name === 'equipe_file_traitement') {
          let all = rows.filter(r => !args.p_membre_id || r.agent_id === args.p_membre_id)
          if (args.p_date_debut) all = all.filter(r => r.date >= args.p_date_debut)
          if (args.p_date_fin) all = all.filter(r => r.date <= args.p_date_fin)
          const filtered = all.filter(r => (args.p_statuts || ['en_attente', 'a_corriger']).includes(r.statut))
          const size = args.p_taille || 20, page = args.p_page || 1
          body = { ok: true, total_filtre: filtered.length, page, taille: size, compteurs: { en_attente: all.filter(r => r.statut === 'en_attente').length, a_corriger: all.filter(r => r.statut === 'a_corriger').length, validees: all.filter(r => r.statut === 'validee').length }, fiches: filtered.slice((page - 1) * size, page * size) }
          if (delayMember && args.p_membre_id) await new Promise(resolve => setTimeout(resolve, 500))
        }
        if (name === 'rapport_fiche_journaliere') {
          const row = rows.find(r => r.fiche_id === args.p_fiche_id)
          body = { ok: true, entete: { agent: 'Compte Suspendu test', agence: 'Agence test', equipe: 'Équipe test', zone: null, date: row.date, statut: row.statut, heure_soumission: null, valideur: null, commentaire_chef: null }, montants: { smart: 500, caisse: 450, ecart_initial: 50, type_ecart: 'manquant', regularise: 0, restant: 50, surplus_restant: 0, commission: 0 }, activite: { comptes_dat: 0 }, reactivations: [], augmentations: [], assurances: [], observations: 'Fiche synthétique' }
        }
        if (name === 'traiter_validation_fiche') { decisions++; await new Promise(resolve => setTimeout(resolve, 350)); rows = rows.map(r => r.fiche_id === args.p_fiche_id ? { ...r, statut: args.p_action === 'valider' ? 'validee' : 'a_corriger' } : r); body = { ok: true } }
        if (fail && name === 'rapport_equipe') body = { ok: false, erreur: 'Lecture équipe indisponible (test).' }
      } else if (u.pathname.endsWith('/agents')) {
        const agent = { id, user_id: id, nom: 'Chef test', prenom: 'Compte', role: 'chef', actif: true, statut: 'actif', equipe_id: id, agence_id: id, agences: { nom: 'Agence test' }, equipes: { id, nom: 'Équipe test' } }
        body = request.headers().accept?.includes('object') ? agent : [agent]
      } else if (u.pathname.endsWith('/fiches_journalieres')) body = u.searchParams.has('date') || u.searchParams.has('id') ? null : []
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
    const base = process.env.TEST_BASE_URL || 'http://localhost:3127'
    await page.goto(base + '/dashboard/chef')
    await page.getByRole('heading', { name: 'Mon bilan du mois' }).waitFor()
    await page.getByText('22 en attente · 2 à corriger', { exact: true }).waitFor()
    const out = '.next/lot6-validation'
    await page.screenshot({ path: path.join(out, 'chef-home-mobile.png'), fullPage: true })
    await page.getByRole('navigation', { name: 'Navigation chef' }).getByRole('button', { name: 'Équipe' }).click()
    await page.getByText('22 fiche(s) · Page 1 / 2', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Ouvrir la fiche' }).count(), 20)
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await page.getByText('22 fiche(s) · Page 2 / 2', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Ouvrir la fiche' }).count(), 2)
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).first().click()
    await page.getByRole('button', { name: 'Confirmer la décision' }).waitFor()
    await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('demander_correction')
    assert.equal(await page.getByRole('button', { name: 'Confirmer la décision' }).isDisabled(), true)
    await page.getByRole('textbox', { name: 'Commentaire' }).fill('Préciser le justificatif.')
    await page.getByRole('button', { name: 'Confirmer la décision' }).dblclick({ timeout: 5000 }).catch(() => {})
    await page.getByText('21 fiche(s) · Page 2 / 2', { exact: true }).waitFor()
    assert.equal(decisions, 1)
    await page.getByRole('button', { name: 'À corriger', exact: false }).click()
    await page.getByText('3 fiche(s) · Page 1 / 1', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).first().click()
    await page.getByRole('button', { name: 'Confirmer la décision' }).waitFor()
    assert.equal(await page.getByRole('option', { name: 'Demander une correction' }).count(), 0)
    await page.getByRole('button', { name: 'Fermer', exact: true }).click()
    delayMember = true
    await page.getByLabel('Membre', { exact: true }).selectOption(member)
    await page.getByLabel('Membre', { exact: true }).selectOption(id)
    await page.getByText('0 fiche(s) · Page 1 / 1', { exact: true }).waitFor()
    await page.waitForTimeout(700)
    assert.equal(await page.getByRole('button', { name: 'Ouvrir la fiche' }).count(), 0)
    await page.getByLabel('Membre', { exact: true }).selectOption('')
    await page.getByText('3 fiche(s) · Page 1 / 1', { exact: true }).waitFor()
    await page.screenshot({ path: path.join(out, 'chef-queue-mobile.png'), fullPage: true })
    await page.getByRole('navigation').getByRole('button', { name: 'Statistiques' }).click()
    assert.equal(await page.getByRole('button', { name: 'Performances de l’équipe', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Mes performances', exact: true }).click()
    await page.getByRole('heading', { name: 'Rapport par journée' }).waitFor()
    await page.getByRole('button', { name: 'Performances de l’équipe', exact: true }).click()
    await page.getByRole('heading', { name: 'Contributions par membre' }).waitFor()
    await page.getByLabel('Données équipe').selectOption('preview')
    await page.getByRole('heading', { name: 'Contributions par membre' }).waitFor()
    assert.ok(calls.some(c => c.name === 'rapport_equipe' && c.args.p_statuts.length === 3))
    await page.getByLabel('Inclure les chefs').uncheck()
    await page.getByRole('heading', { name: 'Contributions par membre' }).waitFor()
    assert.ok(calls.some(c => c.name === 'rapport_equipe' && c.args.p_inclure_chef === false))
    // Restore the full fixture scope before recording the visual evidence.
    await page.getByLabel('Inclure les chefs').check()
    await page.getByRole('heading', { name: 'Contributions par membre' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: path.join(out, 'chef-stats-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: path.join(out, 'chef-stats-desktop.png'), fullPage: true })
    await page.getByLabel('Membre', { exact: true }).selectOption(member)
    await page.getByRole('heading', { name: 'Rapport par journée' }).waitFor()
    assert.ok(calls.some(c => c.name === 'rapport_intervalle' && c.args.p_agent_id === member))
    await page.getByLabel('Membre', { exact: true }).selectOption('')
    fail = true; await page.getByRole('button', { name: 'Actualiser l’équipe' }).click()
    await page.getByRole('alert').filter({ hasText: 'Lecture équipe indisponible' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Contributions par membre' }).count(), 0)
    // Real shared form submission, simulated write, and return to the chef dashboard.
    await page.goto(base + '/dashboard/agent/fiche')
    await page.getByRole('button', { name: 'Soumettre ma fiche' }).click()
    await page.getByText('Fiche soumise !', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Retour au dashboard' }).click()
    await page.waitForURL('**/dashboard/chef')
    await page.getByRole('navigation', { name: 'Navigation chef' }).getByRole('button', { name: 'Équipe' }).waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS: chef home, 22/2 split, >20 pagination, suspended member, comment required, one mutation on double click, no repeat correction, stale response ignored, self/team/member stats, filters, errors without stale totals, mobile overflow, submission returns to chef. HTTP/WS fully simulated.')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
