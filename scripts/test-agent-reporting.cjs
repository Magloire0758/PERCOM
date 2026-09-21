// Synthetic fixtures only. Run: node scripts/test-agent-reporting.cjs
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  module._compile(output, filename)
}
const { METRICS, validDate, validPeriod, assertRpc, checkReport } = require('../lib/agent-reporting.ts')
const { dailyModel, intervalModel } = require('../lib/agent-export-model.ts')
const { renderAgentExcel, renderAgentPdf } = require('../lib/agent-export-render.tsx')
const ExcelJS = require('exceljs')

async function main() {
  assert.equal(validDate('2024-02-29'), true)
  assert.equal(validDate('2026-02-29'), false)
  assert.equal(validPeriod({ debut: '2026-09-20', fin: '2026-09-01' }), false)
  assert.throws(() => assertRpc({ ok: false, erreur: 'Refus' }, null), /Refus/)
  assert.throws(() => assertRpc({ ok: true }, { message: 'Réseau' }), /Réseau/)
  assert.throws(() => assertRpc(null, null), /invalide/)
  const totals = { ok: true, par_statut: { validee: 2, en_attente: 1 }, ...Object.fromEntries(METRICS.map(([key]) => [key, 0])) }
  const zero = { smart: 0, caisse: 0, commission: 0, manquant: 0, surplus: 0, regularise: 0, restant: 0, surplus_restant: 0, comptes_dat: 0, clients: 0, adhesions: 0, lyde_cash: 0, reactivations_effectives: 0, reactivations_montant: 0, augmentations_nb: 0, augmentations_hausse: 0, assurances_nb: 0, assurances_montant: 0, depot_pe: 0, depot_dat: 0, depot_dav: 0 }
  const report = { ok: true, agent: { nom: 'Démonstration', prenom: 'Agent test' }, periode: { debut: '2026-09-01', fin: '2026-09-02' }, statuts: ['validee'], jours_renseignes: 2, lignes: [
    { ...zero, date: '2026-09-01', statut: 'validee', smart: 1000, caisse: 800, manquant: 200, regularise: 50, restant: 150 },
    { ...zero, date: '2026-09-02', statut: 'validee', smart: 500, caisse: 700, surplus: 200, regularise: 75, surplus_restant: 125 },
  ], details_reactivations: [{ date: '2026-09-01', n_client: '0001', nom_prenom: '=1+1', produit: 'DAT', mise: 500, nouvelle_mise: 700, montant_cotise: 0, reactif: false, commentaire: 'Dossier non réactivé' }], details_augmentations: [], details_assurances: [], totaux: { ...totals, nb_fiches: 2, total_smart: 1500, total_caisse: 1500, total_manquant: 200, total_surplus: 200, total_regularise: 125, total_restant: 150, total_surplus_restant: 125, reactivations_dossiers: 1 } }
  checkReport(report)
  assert.throws(() => checkReport({ ...report, totaux: { ...report.totaux, total_restant: 275 } }), /diverg/)
  assert.throws(() => checkReport({ ...report, lignes: [report.lignes[0], { ...report.lignes[1], date: '2026-09-01' }] }), /journalier/)
  const empty = { ...report, lignes: [], jours_renseignes: 0, details_reactivations: [], totaux: { ...totals, par_statut: {} } }
  checkReport(empty)
  const model = intervalModel(report)
  const excel = await renderAgentExcel(model)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(excel)
  assert.deepEqual(workbook.worksheets.map(s => s.name), ['Synthèse', 'Détail journalier', 'Réactivations', 'Augmentations', 'Assurances'])
  const sheet = workbook.getWorksheet('Détail journalier')
  assert.equal(sheet.getCell('H7').value, 150)
  assert.equal(sheet.getCell('I8').value, 125)
  assert.equal(sheet.getCell('C7').type, ExcelJS.ValueType.Number)
  assert.equal(workbook.getWorksheet('Réactivations').getCell('C7').value, '=1+1')
  assert.equal(workbook.getWorksheet('Réactivations').getCell('C7').type, ExcelJS.ValueType.String)
  const daily = dailyModel({ ok: true, entete: { agent: 'Agent test', agence: 'Agence test', equipe: 'Équipe test', zone: 'Zone test', date: '2026-09-01', statut: 'en_attente', heure_soumission: null, valideur: null, commentaire_chef: null }, montants: { smart: 500, caisse: 700, ecart_initial: -200, type_ecart: 'surplus', regularise: 75, restant: 0, surplus_restant: 125, commission: 10 }, activite: { comptes_dat: 0, comptes_actives: 0, clients_parcourus: 0, adhesions: 0, lyde_cash: 0, depot_pe: 0, depot_dat: 0, depot_dav: 0 }, reactivations: [], augmentations: [], assurances: [], observations: 'Données synthétiques de recette.' })
  assert.match(daily.status, /BROUILLON/)
  const stats = intervalModel(report, { comparison: { periode_precedente: { debut: '2026-08-30', fin: '2026-08-31' }, variations: { total_smart: { actuel: 1500, precedent: 0, delta: 1500, pct: null } } }, regularity: { jours_ouvres: 2, jours_renseignes: 2, pct: 100 }, objectives: { objectifs: [] } })
  const statsBook = new ExcelJS.Workbook(); await statsBook.xlsx.load(await renderAgentExcel(stats))
  assert.equal(statsBook.getWorksheet('Comparaison').getCell('F7').value, null)
  const out = path.resolve('.next/lot5-validation'); fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ report, regularity: { ok: true, jours_ouvres: 14, jours_renseignes: 2, pct: 14 }, objectives: { ok: true, objectifs: [{ id: 'objective-test', titre: 'Objectif synthétique', date_debut: '2026-09-01', date_fin: '2026-09-30', progressions: [{ champ: 'cible_montant_smart', libelle: 'SMART', cible: 1000, realise: 1500, pct: 150 }] }] }, comparison: { ok: true, actuel: report.totaux, precedent: totals, periode_actuelle: report.periode, periode_precedente: { debut: '2026-08-30', fin: '2026-08-31' }, variations: { total_smart: { actuel: 1500, precedent: 0, delta: 1500, pct: null } } } }))
  fs.writeFileSync(path.join(out, 'intervalle.xlsx'), Buffer.from(excel))
  fs.writeFileSync(path.join(out, 'statistiques.xlsx'), Buffer.from(await renderAgentExcel(stats)))
  fs.writeFileSync(path.join(out, 'journalier.xlsx'), Buffer.from(await renderAgentExcel(daily)))
  for (const [name, doc] of [['intervalle', model], ['journalier', daily], ['vide', intervalModel(empty)], ['statistiques', stats]]) {
    const pdf = await renderAgentPdf(doc)
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
    fs.writeFileSync(path.join(out, `${name}.pdf`), pdf)
  }
  const long = { ...model, sections: model.sections.map(s => s.title === 'Détail journalier' ? { ...s, rows: Array.from({ length: 75 }, (_, i) => ({ ...s.rows[i % 2] })) } : s) }
  fs.writeFileSync(path.join(out, 'pagination.pdf'), await renderAgentPdf(long))
  console.log('PASS: dates, erreurs RPC, manquant/surplus, cohérence, doublons, vide, Excel numérique, texte non formule, variation NULL, brouillon, 5 PDF et 3 XLSX générés.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
