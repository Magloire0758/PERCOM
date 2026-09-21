// Boundary tests with a simulated Supabase client; never contacts the remote database.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const fixture = JSON.parse(fs.readFileSync('.next/lot5-validation/fixture.json', 'utf8'))
const owner = '11111111-1111-4111-8111-111111111111'
let authenticated = true, active = true, role = 'agent', rpcFailure = false, calls = [], clientOptions
const originalLoad = Module._load
Module._load = function(name, parent, isMain) {
  if (name === '@supabase/supabase-js') return { createClient: (url, key, options) => {
    clientOptions = { url, key, options }
    return {
      auth: { getUser: async token => { assert.equal(token, 'test-session'); return { data: { user: authenticated ? { id: owner } : null }, error: null } } },
      from: () => { const query = { select: () => query, eq: () => query, single: async () => ({ data: { id: owner, role, actif: active, statut: active ? 'actif' : 'suspendu' }, error: null }) }; return query },
      rpc: async (name, args) => { calls.push({ name, args }); return { data: rpcFailure ? { ok: false, erreur: 'internal SQL must not leak' } : name === 'rapport_intervalle' ? fixture.report : name === 'rapport_equipe' ? JSON.parse(fs.readFileSync('.next/lot6-validation/fixture.json', 'utf8')) : name === 'rapport_agence' ? JSON.parse(fs.readFileSync('.next/lot7-validation/fixture.json', 'utf8')) : null, error: null } },
    }
  } }
  return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, isMain)
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-never-be-used'
const { POST } = require('../app/api/agent/exports/route.ts')
async function main() {
  const input = { type: 'intervalle', format: 'xlsx', periode: { debut: '2026-09-01', fin: '2026-09-02' }, statuts: ['validee'], agentId: 'untrusted-target' }
  const request = (body = input, token = true) => new Request('http://localhost/api/agent/exports', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer test-session' } : {}) }, body: JSON.stringify(body) })
  assert.equal((await POST(request(input, false))).status, 401)
  authenticated = false; assert.equal((await POST(request())).status, 401); authenticated = true
  active = false; assert.equal((await POST(request())).status, 403); active = true
  role = 'dg'; assert.equal((await POST(request())).status, 403); role = 'agent'
  for (const statuts of [[], [null], ['inconnu']]) assert.equal((await POST(request({ ...input, statuts }))).status, 400)
  assert.equal((await POST(request({ ...input, periode: { debut: '2026-09-03', fin: '2026-09-01' } }))).status, 400)
  assert.equal((await POST(request({ ...input, periode: { debut: '2024-01-01', fin: '2026-09-01' } }))).status, 400)
  assert.equal(calls.length, 0)
  const ok = await POST(request())
  assert.equal(ok.status, 200)
  assert.match(ok.headers.get('Cache-Control'), /no-store/)
  assert.match(ok.headers.get('Content-Type'), /spreadsheetml/)
  assert.equal(calls[0].args.p_agent_id, owner)
  assert.equal(clientOptions.key, 'public-test-key')
  assert.equal(clientOptions.options.global.headers.Authorization, 'Bearer test-session')
  assert.equal(clientOptions.options.auth.persistSession, false)
  assert.ok((await ok.arrayBuffer()).byteLength > 100)
  role = 'chef'
  const member = '22222222-2222-4222-8222-222222222222'
  assert.equal((await POST(request({ ...input, agentId: member }))).status, 200)
  assert.equal(calls.at(-1).args.p_agent_id, member)
  assert.equal((await POST(request({ ...input, agentId: 'invalid' }))).status, 400)
  role = 'agent'
  assert.equal((await POST(request({ ...input, type: 'equipe', inclureChef: true }))).status, 403)
  role = 'chef'
  const team = await POST(request({ ...input, type: 'equipe', agentId: undefined, equipeId: 'ignored-untrusted-team', inclureChef: true }))
  assert.equal(team.status, 200)
  assert.equal(calls.at(-1).name, 'rapport_equipe')
  assert.equal(calls.at(-1).args.p_equipe_id, undefined)
  assert.equal((await POST(request({ ...input, type: 'equipe', agentId: undefined, inclureChef: null }))).status, 400)
  role = 'responsable'
  assert.equal((await POST(request({ ...input, type: 'equipe', agentId: undefined, inclureChef: true }))).status, 400)
  assert.equal((await POST(request({ ...input, type: 'equipe', agentId: undefined, equipeId: member, inclureChef: true }))).status, 200)
  assert.equal(calls.at(-1).args.p_equipe_id, member)
  assert.equal((await POST(request({ ...input, agentId: member }))).status, 200)
  assert.equal(calls.at(-1).args.p_agent_id, member)
  assert.equal((await POST(request({ ...input, type: 'agence', agentId: undefined, agenceId: 'untrusted' }))).status, 200)
  assert.equal(calls.at(-1).name, 'rapport_agence')
  assert.equal(calls.at(-1).args.p_agence_id, undefined)
  role = 'agent'
  assert.equal((await POST(request({ ...input, type: 'agence' }))).status, 403)
  role = 'responsable'
  rpcFailure = true
  assert.equal((await POST(request({ ...input, type: 'equipe', equipeId: member, agentId: undefined, inclureChef: true }))).status, 422)
  const denied = await POST(request({ ...input, agentId: member })); assert.equal(denied.status, 422)
  assert.ok(!(await denied.text()).includes('internal SQL'))
  console.log('PASS: route 401/403/400, rôle actif, statuts, dates, limite période, identité issue de session, JWT transmis, aucune service_role, XLSX 200/no-store, échec RPC sans fuite SQL.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
