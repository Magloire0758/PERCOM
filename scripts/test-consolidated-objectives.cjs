const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript')
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f)
const {consolidatedModel,validObjectiveSelection,OBJECTIVE_MEASURES,objectivePeriod,objectiveStorage,objectiveValues,storedObjectivePeriod}=require('../lib/consolidated-objectives.ts')
assert.deepEqual(objectiveValues({cible_montant_smart:'',cible_commissions:'0',cible_adhesions:'2'}),{cible_montant_smart:null,cible_commissions:0,cible_adhesions:2})
assert.throws(()=>objectiveValues({cible_adhesions:'1.5'}))
assert.throws(()=>objectiveValues({cible_commissions:'Infinity'}))
assert.equal(objectiveStorage('annuel','2026-09-29').mois,1)
assert.equal(objectiveStorage('journalier','2026-09-29').jour_date,'2026-09-29')
assert.equal(objectiveStorage('mensuel','2026-09-29').jour_date,null)
assert.deepEqual(storedObjectivePeriod({type_periodicite:'annuel',mois:9,annee:2026,date_debut:'2026-09-01',date_fin:'2026-09-30'}),{debut:'2026-01-01',fin:'2026-12-31'})
const id='11111111-1111-4111-8111-111111111111'
const report={ok:true,meta:{contrat_version:2,niveau:'agent',periodicite:'mensuel',mesure:'cible_montant_smart',libelle_mesure:'SMART',date_debut:'2026-09-01',date_fin:'2026-09-30',date_arrete:'2026-09-29',statuts:['validee'],comptes:'tous',agence_id:null,agence_nom:null,objectifs_incomplets:false},lignes:[{n:1,id,agence_id:null,agence_nom:'(Sans agence)',agent_nom:'Agent fictif',objectif:100,objectif_statut:'defini',realise:50,taux:50,ecart:50,ecart_caisse_manquant:10,ecart_caisse_surplus:0,regularise:5,dernier_commentaire:'Observation de test',dernier_commentaire_date:'2026-09-02',dernier_commentaire_fiche_id:id}],total:{objectif:100,realise:50,taux:50,ecart:50,ecart_caisse_manquant:10,ecart_caisse_surplus:0,regularise:5}}
const model=consolidatedModel(report)
assert.equal(OBJECTIVE_MEASURES.length,15)
assert.deepEqual(objectivePeriod('mensuel','2024-02-12'),{debut:'2024-02-01',fin:'2024-02-29'})
assert.deepEqual(objectivePeriod('annuel','2026-09-29'),{debut:'2026-01-01',fin:'2026-12-31'})
assert.deepEqual(objectivePeriod('journalier','2026-09-29'),{debut:'2026-09-29',fin:'2026-09-29'})
assert.equal(objectivePeriod('mensuel','2026-02-31'),null)
assert.equal(validObjectiveSelection('cible_montant','tous',null),false)
assert.equal(model.sections.length,1)
assert.equal(model.sections[0].columns.length,9)
assert.equal(model.sections[0].rows.at(-1).n,'Total')
for(const niveau of ['agent','agence','global'])for(const [mesure] of OBJECTIVE_MEASURES){
 const copy=structuredClone(report);copy.meta.niveau=niveau;copy.meta.mesure=mesure
 const cols=consolidatedModel(copy).sections[0].columns.map(c=>c.key)
 assert.equal(cols.includes('autres_ecarts'),niveau==='agent'&&mesure==='cible_montant_smart')
 assert.equal(cols.includes('regularisation_commentaire'),niveau==='agent'&&mesure==='cible_montant_smart')
 assert.equal(cols.filter(c=>c.includes('taux')).length,1)
}
const missing=structuredClone(report);missing.meta.objectifs_incomplets=true;missing.lignes[0].objectif=null;missing.lignes[0].taux=null;missing.lignes[0].ecart=null;missing.total.taux=null;missing.total.ecart=null
assert.equal(consolidatedModel(missing).sections[0].rows[0].objectif,'Non défini')
assert.equal(consolidatedModel(missing).sections[0].rows.at(-1).taux,null)
const zero=structuredClone(report);zero.lignes[0].objectif=0;zero.lignes[0].taux=null
assert.equal(consolidatedModel(zero).sections[0].rows[0].objectif,0)
assert.throws(()=>consolidatedModel({...report,lignes:null}))
assert.throws(()=>consolidatedModel({...report,meta:{...report.meta,contrat_version:1}}))
const noGoals=structuredClone(report);noGoals.meta.objectifs_incomplets=true;noGoals.total={objectif:null,realise:50,taux:null,ecart:null}
assert.equal(consolidatedModel(noGoals).sections[0].rows.at(-1).objectif,'Non défini')
const zeroTotal=structuredClone(report);zeroTotal.total={objectif:0,realise:50,taux:null,ecart:-50}
assert.equal(consolidatedModel(zeroTotal).sections[0].rows.at(-1).ecart,-50)
assert.equal(consolidatedModel(missing).sections[0].rows.at(-1).objectif,100)
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
const body={type:'objectifs_consolides',format:'pdf',mesure:'cible_montant_smart',comptes:'tous',agenceId:null,niveau:'agent',periodicite:'mensuel',dateReference:'2026-09-01',statuts:['validee']}
const request=(data=body,auth=true)=>new Request('http://localhost/api/agent/exports',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(data)})
async function main(){
 fs.mkdirSync('.next/lot14-validation',{recursive:true})
 const pdf=await actualRender.renderAgentPdf(model),xlsx=await actualRender.renderAgentExcel(model)
 assert.equal(pdf.subarray(0,4).toString(),'%PDF')
 fs.writeFileSync('.next/lot14-validation/report.pdf',pdf);fs.writeFileSync('.next/lot14-validation/report.xlsx',Buffer.from(xlsx))
 const workbook=new (require('exceljs').Workbook)();await workbook.xlsx.load(xlsx);assert.equal(workbook.worksheets.length,1)
 assert.ok(workbook.worksheets[0].getSheetValues().flat().includes(50))

 assert.equal((await POST(request(body,false))).status,401)
 for(const r of ['agent','chef']){role=r;assert.equal((await POST(request())).status,403)}
 role='dg';active=false;assert.equal((await POST(request())).status,403);active=true
 assert.equal((await POST(request({...body,mesure:'cible_montant'}))).status,400)
 assert.equal((await POST(request({...body,agenceId:'bad'}))).status,400)
 assert.equal((await POST(request({...body,statuts:[]}))).status,400)
 assert.equal((await POST(request({...body,niveau:'global',agenceId:id}))).status,400)
 assert.equal((await POST(request({...body,niveau:'agence',comptes:'actif'}))).status,400)
 assert.equal((await POST(request({...body,periodicite:'trimestriel'}))).status,400)
 role='responsable';assert.equal((await POST(request({...body,niveau:'global'}))).status,403);role='dg'
 assert.equal(calls.length,0)
 for(const r of ['dg','admin','responsable'])for(const format of ['pdf','xlsx']){role=r;const response=await POST(request({...body,format,agenceId:id}));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(calls.at(-1).name,'rapport_objectifs_periode');assert.equal(calls.at(-1).args.p_agence_id,id);assert.equal(receivedModel.sections[0].rows[0].taux,50)}
 denied=true;const response=await POST(request());assert.equal(response.status,422);assert.ok(!(await response.text()).includes('internal secret'))
 console.log('Consolidated model and export authorization tests passed (mock RPC; no remote writes).')
}
main().catch(e=>{console.error(e);process.exitCode=1})
