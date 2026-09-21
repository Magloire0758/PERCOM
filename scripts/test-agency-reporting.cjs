const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript')
for (const ext of ['.ts','.tsx']) require.extensions[ext] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f)
const { agencyModel, checkAgencyReport, COLLECTIVE_METRICS, sixMonths } = require('../lib/agency-reporting.ts')
const { renderAgentExcel, renderAgentPdf } = require('../lib/agent-export-render.tsx')
async function main() {
  const team = JSON.parse(fs.readFileSync('.next/lot6-validation/fixture.json','utf8'))
  const report = { ...team, agence:{id:team.equipe.id,nom:'Agence Démonstration'}, synthese:{...team.synthese, ...Object.fromEntries(COLLECTIVE_METRICS.map(([k])=>[k,0])),nb_equipes:1,nb_sans_equipe:1},par_membre:team.par_membre.map((m,i)=>({...m,equipe_id:i?null:team.equipe.id})),par_equipe:[{equipe_id:team.equipe.id,equipe_nom:'Équipe Nord',nb_fiches:1,total_smart:1000,total_restant:150},{equipe_id:null,equipe_nom:'Sans équipe',nb_fiches:1,total_smart:500,total_restant:0}] }
  report.synthese.total_reactivations_effectives=1;report.synthese.total_reactivations_montant=150
  checkAgencyReport(report)
  assert.deepEqual(sixMonths('2026-03-31').map(m=>m.key),['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03'])
  assert.throws(()=>checkAgencyReport({...report,par_equipe:[]}))
  assert.throws(()=>checkAgencyReport({...report,synthese:{...report.synthese,total_depot_dat:null}}))
  const model=agencyModel(report), out='.next/lot7-validation'; fs.mkdirSync(out,{recursive:true})
  fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(report))
  fs.writeFileSync(path.join(out,'agence.pdf'),await renderAgentPdf(model)); const excel=await renderAgentExcel(model);fs.writeFileSync(path.join(out,'agence.xlsx'),excel)
  const ExcelJS=require('exceljs'), workbook=new ExcelJS.Workbook();await workbook.xlsx.load(excel)
  assert.equal(workbook.worksheets.length,7)
  assert.equal(model.sections[0].rows.find(r=>r.label==='Réactivations effectives').value,1)
  console.log('PASS agence: ventilation, mesure absente refusée, 31 du mois, 7 feuilles Excel, PDF et synthèse Lot 7.1.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
