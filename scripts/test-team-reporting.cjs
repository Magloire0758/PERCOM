// Synthetic contracts and real document generation; no remote database.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const ts = require('typescript')
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, f)
const { TEAM_METRICS, checkTeamReport, teamModel } = require('../lib/team-reporting.ts')
const { renderAgentExcel, renderAgentPdf } = require('../lib/agent-export-render.tsx')
const ExcelJS = require('exceljs')
const id = '11111111-1111-4111-8111-111111111111', member = '22222222-2222-4222-8222-222222222222'
const zero = Object.fromEntries(TEAM_METRICS.map(([k]) => [k, 0]))
const report = { ok: true, equipe: { id, nom: 'Équipe démonstration', agence: 'Agence test' }, periode: { debut: '2026-09-01', fin: '2026-09-02' }, statuts: ['validee'], chef_inclus: true,
  synthese: { ...zero, nb_membres: 2, nb_membres_actifs: 1, nb_fiches: 2, total_smart: 1500, total_caisse: 1400, total_manquant: 200, total_surplus: 100, total_regularise: 75, total_restant: 150, total_surplus_restant: 75 },
  par_membre: [{ agent_id: id, nom: 'Chef test', prenom: 'Compte', role: 'chef', est_chef: true, actif: true, nb_fiches: 1, total_smart: 1000, total_manquant_restant: 150 }, { agent_id: member, nom: 'Suspendu test', prenom: 'Compte', role: 'agent', est_chef: false, actif: false, nb_fiches: 1, total_smart: 500, total_manquant_restant: 0 }],
  par_jour: [{ date: '2026-09-01', nb_fiches: 2, smart: 1500, caisse: 1400, manquant: 200, surplus: 100, commission: 0, comptes_dat: 0, adhesions: 0 }],
  details_reactivations: [{ date: '2026-09-01', membre: 'Compte Suspendu test', n_client: 'SYNTHETIC', nom_prenom: '=1+1', produit: 'Test', mise: 50, nouvelle_mise: 75, montant_cotise: 150, reactif: true, commentaire: 'Donnée synthétique' }], details_augmentations: [], details_assurances: [] }
async function main() {
  checkTeamReport(report)
  assert.throws(() => checkTeamReport({ ...report, synthese: { ...report.synthese, total_smart: 1000 } }), /diverg/)
  assert.throws(() => checkTeamReport({ ...report, par_membre: [report.par_membre[0]] }), /diverg/)
  assert.throws(() => checkTeamReport({ ...report, synthese: { ...report.synthese, nb_membres_actifs: 2 } }), /Effectif/)
  const model = teamModel(report), buffer = await renderAgentExcel(model)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer)
  assert.deepEqual(wb.worksheets.map(s => s.name), ['Synthèse', 'Par membre', 'Par jour', 'Réactivations', 'Augmentations', 'Assurances'])
  assert.equal(wb.getWorksheet('Par membre').getCell('C8').value, 'Inactif / suspendu')
  assert.equal(wb.getWorksheet('Réactivations').getCell('D7').value, '=1+1')
  assert.equal(wb.getWorksheet('Par jour').getCell('C7').value, 1500)
  const out = '.next/lot6-validation'; fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(report))
  fs.writeFileSync(path.join(out, 'equipe.xlsx'), Buffer.from(buffer))
  const pdf = await renderAgentPdf(model); assert.equal(pdf.subarray(0, 4).toString(), '%PDF'); fs.writeFileSync(path.join(out, 'equipe.pdf'), pdf)
  checkTeamReport({ ...report, synthese: zero, par_membre: [], par_jour: [], details_reactivations: [] })
  const source = fs.readFileSync('app/dashboard/agent/fiche/page.tsx', 'utf8')
  assert.equal(source.match(/router.push\(agent\?\.role === 'chef' \? '\/dashboard\/chef' : '\/dashboard\/agent'\)/g).length, 3)
  console.log('PASS: team member/day totals, suspended contribution preserved, separate remaining gaps, empty report, six XLSX sheets, PDF generated, 3 role-aware returns.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
