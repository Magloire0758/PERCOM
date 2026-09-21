// Browser recipe with isolated synthetic Supabase HTTP/websocket responses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
async function main(){
  const report=JSON.parse(fs.readFileSync('.next/lot7-validation/fixture.json','utf8')),team=JSON.parse(fs.readFileSync('.next/lot6-validation/fixture.json','utf8')),agent=JSON.parse(fs.readFileSync('.next/lot5-validation/fixture.json','utf8'))
  const config=fs.readFileSync('.env.local','utf8'),url=config.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?(https:\/\/[^\s"']+)/)?.[1];assert.ok(url)
  const ref=new URL(url).hostname.split('.')[0],id=report.agence.id,member=report.par_membre[1].agent_id
  const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}
  const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-signature'].join('.')
  const session={access_token:jwt,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}
  const browser=await chromium.launch({channel:'chrome',headless:true})
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}})
    await context.addCookies([{name:`sb-${ref}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'localhost',path:'/'}])
    await context.routeWebSocket('**/realtime/**',ws=>ws.onMessage(()=>{}))
    let decisions=0,writeFail=true,reportFail=false;const calls=[]
    const members=report.par_membre.map(m=>({...m,id:m.agent_id,statut:m.actif?'actif':'suspendu',telephone:'',email:'fixture@example.invalid'}))
    let rows=Array.from({length:23},(_,i)=>({fiche_id:`33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`,agent_id:member,nom:'Suspendu test',prenom:'Compte',membre_actif:false,date:'2026-09-01',anciennete_jours:20,statut:i<21?'en_attente':'a_corriger',smart:500,caisse:450,ecart:50,peut_traiter:true}))
    const goal={id:'44444444-4444-4444-8444-444444444444',titre:'Objectif septembre',type_cible:'agent',agent_id:member,equipe_id:null,agence_id:id,date_debut:'2026-09-01',date_fin:'2026-09-30',statut_objectif:'actif',cible_montant_smart:1000}
    await context.route(`${url}/**`,async route=>{
      const req=route.request(),u=new URL(req.url());let body=[],status=200
      if(u.pathname.includes('/auth/v1/'))body=user
      else if(u.pathname.includes('/rpc/')){
        const name=u.pathname.split('/').pop(),args=req.postDataJSON();calls.push({name,args})
        body={ok:true}
        if(name==='rapport_agence')body=reportFail?{ok:false,erreur:'Rapport temporairement indisponible'}:{...report,periode:{debut:args.p_date_debut,fin:args.p_date_fin},statuts:args.p_statuts}
        if(name==='classement_agence_membres'||name==='classement_equipe')body={ok:true,classement:report.par_membre.filter(m=>args.p_inclure_suspendus||m.actif).map((m,i)=>({...m,rang:i+1}))}
        if(name==='objectifs_collectifs')body={ok:true,objectifs:[{id:'collective',titre:'Cap de septembre',date_debut:'2026-09-01',date_fin:'2026-09-30',progressions:[{champ:'cible_montant_smart',libelle:'Montant SMART',cible:1000,realise:1500,pct:150,mesurable:true},{champ:'future',libelle:'Mesure future',cible:10,realise:null,pct:null,mesurable:false}]}]}
        if(name==='equipe_agregats')body={ok:true,totaux:team.synthese,par_membre:team.par_membre}
        if(name==='rapport_equipe')body={...team,periode:{debut:args.p_date_debut,fin:args.p_date_fin},statuts:args.p_statuts,chef_inclus:args.p_inclure_chef}
        const agentResponses={agent_agregats:agent.report.totaux,rapport_intervalle:agent.report,agent_comparaison:agent.comparison,agent_regularite:agent.regularity,agent_objectifs_avec_progression:agent.objectives}
        if(agentResponses[name])body=agentResponses[name]
        if(name==='agence_file_traitement'){
          const all=rows.filter(r=>!args.p_membre_id||r.agent_id===args.p_membre_id),filtered=all.filter(r=>(args.p_statuts||['en_attente','a_corriger']).includes(r.statut)),size=args.p_taille||20,page=args.p_page||1
          body={ok:true,page,taille:size,total_filtre:filtered.length,compteurs:{en_attente:all.filter(r=>r.statut==='en_attente').length,a_corriger:all.filter(r=>r.statut==='a_corriger').length,validees:all.filter(r=>r.statut==='validee').length},fiches:filtered.slice((page-1)*size,page*size)}
        }
        if(name==='rapport_fiche_journaliere'){const r=rows.find(r=>r.fiche_id===args.p_fiche_id);body={ok:true,entete:{agent:'Compte Suspendu test',agence:'Agence Démonstration',equipe:null,date:r.date,statut:r.statut},montants:{smart:500,caisse:450,ecart_initial:50,type_ecart:'manquant',regularise:20,restant:30,surplus_restant:0,commission:0},activite:{comptes_dat:0},reactivations:[],augmentations:[],assurances:[]}}
        if(name==='traiter_validation_fiche'){decisions++;await new Promise(r=>setTimeout(r,200));rows=rows.map(r=>r.fiche_id===args.p_fiche_id?{...r,statut:args.p_action==='valider'?'validee':'a_corriger'}:r);body={ok:true}}
      }else if(u.pathname.endsWith('/agents')){
        if(req.method()==='PATCH'){status=writeFail?403:200;body=writeFail?{message:'Refus simulé'}:{id}}
        else body=req.headers().accept?.includes('object')?{...members[0],id,role:'responsable',agence_id:id,actif:true,statut:'actif',agences:{nom:'Agence Démonstration'}}:members
      }else if(u.pathname.endsWith('/equipes'))body=[{id,nom:'Équipe Nord'},{id:'55555555-5555-4555-8555-555555555555',nom:'Équipe sans activité'}]
      else if(u.pathname.endsWith('/objectifs')){if(req.method()==='GET')body=[goal];else{status=writeFail?403:200;body=writeFail?{message:'Refus simulé'}:{id:goal.id}}}
      else if(u.pathname.endsWith('/fiches_journalieres'))body=[{id:rows[0].fiche_id,agent_id:member,date:'2026-09-01',statut_validation:'validee',montant_smart:100,montant_caisse:0,montant_regularise:70,agents:{nom:'Suspendu test',prenom:'Compte',agences:{nom:'Agence Démonstration'}}}]
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    })
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto((process.env.TEST_BASE_URL||'http://localhost:3000')+'/dashboard/responsable')
    await page.getByRole('heading',{name:'Une vue claire pour décider.'}).waitFor()
    await page.getByText('Non mesuré',{exact:true}).waitFor()
    await page.getByText('21 fiche(s) en attente',{exact:true}).waitFor()
    await page.screenshot({path:'.next/lot7-validation/ra-desktop.png',fullPage:true})
    const nav=page.getByRole('navigation',{name:'Navigation responsable'})
    await nav.getByRole('button',{name:'Fiches à traiter'}).click()
    await page.getByText('21 fiche(s) · Page 1 / 2',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Ouvrir la fiche'}).count(),20)
    await page.getByRole('button',{name:'Page suivante',exact:true}).click();await page.getByText('21 fiche(s) · Page 2 / 2',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Ouvrir la fiche'}).click()
    await page.getByRole('combobox',{name:'Action',exact:true}).selectOption('demander_correction')
    assert.equal(await page.getByRole('button',{name:'Confirmer la décision'}).isDisabled(),true)
    await page.getByRole('textbox',{name:'Commentaire'}).fill('Merci de vérifier la caisse.')
    await page.getByRole('button',{name:'Confirmer la décision'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(decisions,1)
    await nav.getByRole('button',{name:'Écarts & alertes'}).click();await page.getByText('30 F',{exact:true}).first().waitFor()
    await nav.getByRole('button',{name:'Objectifs',exact:true}).click();await page.getByRole('button',{name:'Modifier Objectif septembre'}).waitFor().catch(async e=>{await page.screenshot({path:'.next/lot7-validation/failure.png',fullPage:true}); console.log((await page.locator('main').innerText()).slice(0,2500)); console.log(errors); throw e})
    await page.getByRole('button',{name:'Modifier Objectif septembre'}).click();assert.equal(await page.getByLabel('Début',{exact:true}).inputValue(),'2026-09-01')
    await page.getByRole('button',{name:'Enregistrer l’objectif'}).click();await page.getByText('Objectif non enregistré. Vérifiez vos droits et réessayez.',{exact:true}).waitFor();await page.getByRole('button',{name:'Fermer',exact:true}).click()
    await page.getByRole('button',{name:'Mon profil',exact:true}).click();await page.getByRole('button',{name:'Enregistrer le profil'}).click();await page.getByText('Profil non enregistré. Vérifiez vos droits et réessayez.',{exact:true}).waitFor();assert.equal(await page.getByText('Profil enregistré.',{exact:true}).count(),0)
    writeFail=false;await page.getByRole('button',{name:'Enregistrer le profil'}).click();await page.getByText('Profil enregistré.',{exact:true}).waitFor()
    await nav.getByRole('button',{name:'Statistiques & rapports'}).click();await page.getByRole('heading',{name:'Tous les indicateurs'}).waitFor()
    await page.getByLabel('Périmètre du classement').selectOption('true');await page.getByRole('button',{name:/Compte Suspendu test/}).waitFor()
    assert.ok(calls.some(c=>c.name==='classement_agence_membres'&&c.args.p_inclure_suspendus===true))
    reportFail=true;await page.getByRole('button',{name:'Actualiser',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rapport temporairement indisponible'}).waitFor();assert.equal(await page.getByRole('button',{name:'Exporter PDF'}).isDisabled(),true)
    reportFail=false;await page.getByRole('button',{name:'Réessayer'}).click();await page.getByRole('heading',{name:'Tous les indicateurs'}).waitFor()
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Ouvrir le menu'}).click();await nav.getByRole('button',{name:'Vue d’ensemble'}).click();await page.getByRole('heading',{name:'Une vue claire pour décider.'}).waitFor();await page.getByText('Non mesuré',{exact:true}).waitFor()
    await page.screenshot({path:'.next/lot7-validation/ra-mobile.png',fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal document overflow')
    assert.deepEqual(errors,[])
    console.log('PASS RA browser: PC/mobile, queue 21+2, pagination, commentaire requis, décision, restant 30/100, période objectif conservée, refus mutations, profil succès, classement, erreur sans export, aucun débordement/hydratation.')
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
