const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript')
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f)
const {consolidatedModel,validObjectiveSelection,OBJECTIVE_MEASURES}=require('../lib/consolidated-objectives.ts')
const id='11111111-1111-4111-8111-111111111111'
const report={ok:true,meta:{mesure:'cible_montant_smart',libelle_mesure:'SMART',date_debut:'2026-09-01',date_fin:'2026-09-29',statuts:['validee'],comptes:'actif',agence_id:null,periode_partielle:true},lignes_agent:[{n:1,agent_id:id,agence_id:null,agence_nom:'(Sans agence)',agent_nom:'Agent fictif',objectif:null,realise:50,taux:null,ecart:null,objectif_partiel:true,nb_commentaires:1,dernier_commentaire:'Observation de test',dernier_commentaire_date:'2026-09-02',dernier_commentaire_fiche_id:id}],sous_totaux:[{agence_id:null,agence_nom:'(Sans agence)',objectif_officiel:null,objectif_cumule_agents:null,realise:50,taux_officiel:null,taux_agents:null,objectif_source:'somme'}],total_general:{objectif_officiel:100,objectif_cumule_agents:80,realise:50,taux_officiel:50,taux_agents:62.5,objectif_source:'reseau'}}
const model=consolidatedModel(report)
assert.equal(OBJECTIVE_MEASURES.length,15)
assert.equal(validObjectiveSelection('cible_montant','actif',null),false)
assert.equal(validObjectiveSelection('cible_montant_smart','inconnu',null),false)
assert.equal(model.sections[2].rows[0].objectif,null)
assert.equal(model.sections[2].rows[0].taux,null)
assert.equal(model.sections[0].rows[0].taux_agents,62.5)
assert.equal(model.sections[1].rows[0].agence_nom,'(Sans agence)')
assert.ok(model.scope.some(s=>s.value.includes('sans proratisation')))
const zero=structuredClone(report);zero.lignes_agent[0].objectif=0
assert.equal(consolidatedModel(zero).sections[2].rows[0].objectif,0)
assert.throws(()=>consolidatedModel({...report,lignes_agent:null}))
const actualRender=require('../lib/agent-export-render.tsx')
let role='dg',active=true,denied=false,calls=[],receivedModel
const original=Module._load
Module._load=function(name,parent,isMain){
 if(name==='@supabase/supabase-js')return {createClient:(url,key,opts)=>{assert.equal(key,'public-test');assert.equal(opts.global.headers.Authorization,'Bearer test');return {auth:{getUser:async()=>({data:{user:{id}},error:null})},from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:{id,role,actif:active,statut:active?'actif':'suspendu'},error:null})};return q},rpc:async(name,args)=>{calls.push({name,args});return {data:denied?{ok:false,erreur:'internal secret'}:report,error:null}}}}}
 if(name==='@/lib/agent-export-render')return {renderAgentPdf:async m=>{receivedModel=m;return Buffer.from('%PDF-test')},renderAgentExcel:async m=>{receivedModel=m;return Buffer.from('xlsx-test')}}
 return original.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,isMain)
}
process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test';process.env.SUPABASE_SERVICE_ROLE_KEY='never-use'
const {POST}=require('../app/api/agent/exports/route.ts')
const body={type:'objectifs_consolides',format:'pdf',mesure:'cible_montant_smart',comptes:'actif',agenceId:null,periode:{debut:'2026-09-01',fin:'2026-09-29'},statuts:['validee']}
const request=(data=body,auth=true)=>new Request('http://localhost/api/agent/exports',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(data)})
async function main(){
 fs.mkdirSync('.next/lot13-validation',{recursive:true})
 const pdf=await actualRender.renderAgentPdf(model),xlsx=await actualRender.renderAgentExcel(model)
 assert.equal(pdf.subarray(0,4).toString(),'%PDF')
 fs.writeFileSync('.next/lot13-validation/report.pdf',pdf);fs.writeFileSync('.next/lot13-validation/report.xlsx',Buffer.from(xlsx))
 const workbook=new (require('exceljs').Workbook)();await workbook.xlsx.load(xlsx);assert.equal(workbook.worksheets.length,5)
 assert.ok(workbook.worksheets[0].getSheetValues().flat().includes(62.5))

 assert.equal((await POST(request(body,false))).status,401)
 for(const r of ['agent','chef']){role=r;assert.equal((await POST(request())).status,403)}
 role='dg';active=false;assert.equal((await POST(request())).status,403);active=true
 assert.equal((await POST(request({...body,mesure:'cible_montant'}))).status,400)
 assert.equal((await POST(request({...body,agenceId:'bad'}))).status,400)
 assert.equal((await POST(request({...body,statuts:[]}))).status,400)
 assert.equal(calls.length,0)
 for(const r of ['dg','admin','responsable'])for(const format of ['pdf','xlsx']){role=r;const response=await POST(request({...body,format,agenceId:id}));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(calls.at(-1).name,'rapport_objectifs_consolide');assert.equal(calls.at(-1).args.p_agence_id,id);assert.equal(receivedModel.sections[0].rows[0].taux_agents,62.5)}
 denied=true;const response=await POST(request());assert.equal(response.status,422);assert.ok(!(await response.text()).includes('internal secret'))
 console.log('Consolidated model and export authorization tests passed (mock RPC; no remote writes).')
}
main().catch(e=>{console.error(e);process.exitCode=1})
