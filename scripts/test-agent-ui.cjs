// Isolated browser test: all Supabase traffic is intercepted; no real account or data is used.
// PLAYWRIGHT_MODULE may point to the bundled Playwright installation.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
async function main() {
  const fixture = JSON.parse(fs.readFileSync('.next/lot5-validation/fixture.json', 'utf8'))
  const config = fs.readFileSync('.env.local', 'utf8')
  const url = config.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?(https:\/\/[^\s"']+)/)?.[1]
  assert.ok(url)
  const ref = new URL(url).hostname.split('.')[0]
  const id = '11111111-1111-4111-8111-111111111111'
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'synthetic-signature'].join('.')
  const session = { access_token: jwt, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } })
    await context.addCookies([{ name: `sb-${ref}-auth-token`, value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: 'localhost', path: '/' }])
    let fail = false
    const rpcCalls = []
    await context.route(`${url}/**`, async route => {
      const request = route.request(), u = new URL(request.url())
      let body = []
      if (u.pathname.includes('/auth/v1/')) body = user
      else if (u.pathname.includes('/rpc/')) {
        const name = u.pathname.split('/').pop()
        rpcCalls.push({ name, params: request.postDataJSON() })
        const responses = { agent_agregats: fixture.report.totaux, rapport_intervalle: fixture.report, agent_regularite: fixture.regularity, agent_objectifs_avec_progression: fixture.objectives, agent_comparaison: fixture.comparison, obtenir_classement_agence: { ok: true, classement: [{ agent_id: id, rang: 1, nom: 'Démonstration', prenom: 'Agent test', est_moi: true, total_smart: 1500 }] } }
        body = fail ? { ok: false, erreur: 'Échec synthétique : lecture indisponible.' } : responses[name] || { ok: false, erreur: 'RPC inconnue du test' }
      } else if (u.pathname.endsWith('/agents')) {
        const agent = { id, user_id: id, nom: 'Démonstration', prenom: 'Agent test', role: 'agent', actif: true, statut: 'actif', agence_id: id, agences: { nom: 'Agence test' }, equipes: { nom: 'Équipe test' } }
        body = request.headers().accept?.includes('object') ? agent : [agent]
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    const page = await context.newPage()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:3125/dashboard/agent')
    await page.getByRole('heading', { name: 'Mon bilan du mois' }).waitFor()
    await page.getByText('Objectif synthétique', { exact: true }).waitFor()
    assert.ok(await page.getByText('150 %', { exact: true }).isVisible())
    assert.ok(await page.getByRole('heading', { name: 'Classement de mon agence' }).isVisible())
    const out = path.resolve('.next/lot5-validation')
    await page.screenshot({ path: path.join(out, 'agent-home-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Stats', exact: false }).click()
    await page.getByRole('heading', { name: 'Rapport par journée' }).waitFor()
    assert.ok(await page.getByText('Comparaison à durée égale', { exact: true }).isVisible())
    await page.getByLabel('Données').selectOption('preview')
    await page.getByRole('heading', { name: 'Rapport par journée' }).waitFor()
    assert.ok(rpcCalls.some(c => c.name === 'rapport_intervalle' && c.params.p_statuts.length === 3))
    await page.screenshot({ path: path.join(out, 'agent-stats-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.screenshot({ path: path.join(out, 'agent-stats-desktop.png'), fullPage: true })
    fail = true
    await page.getByRole('button', { name: 'Actualiser', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Échec synthétique' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Rapport par journée' }).count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: accueil, objectifs >100 %, classement, statistiques, preview 3 statuts, état erreur sans anciens chiffres, aucun pageerror. Supabase entièrement simulé.')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
