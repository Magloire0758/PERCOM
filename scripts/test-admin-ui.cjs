// Synthetic, isolated browser recipe. No requests are sent to the live Supabase project.
const fs=require('node:fs'),assert=require('node:assert/strict')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
async function main(){
 const config=fs.readFileSync('.env.local','utf8'),url=config.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?(https:\/\/[^\s"']+)/)?.[1];assert.ok(url)
 const ref=new URL(url).hostname.split('.')[0],id='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',team='33333333-3333-4333-8333-333333333333'
 const user={id,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}
 const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.')
 const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}
 const person={id:member,nom:'Exemple',prenom:'Agent',role:'chef',actif:true,statut:'actif',agence_id:id,equipe_id:team,agence_nom:'Agence Test',equipe_nom:'Équipe Test'}
 const calls=[],errors=[],objectiveWrites=[];let fail=true,goals=[]
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:`sb-${ref}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'localhost',path:'/'}])
 await context.routeWebSocket('**/realtime/**',ws=>ws.onMessage(()=>{}))
 await context.route(`${url}/**`,async route=>{const req=route.request(),u=new URL(req.url());let body=[]
 if(u.pathname.includes('/auth/v1/'))body=user
 else if(u.pathname.includes('/rpc/')){const name=u.pathname.split('/').pop(),args=req.postDataJSON();calls.push({name,args});body={ok:true}
 if(['objectifs_collectifs','agent_objectifs_avec_progression'].includes(name))body={ok:true,objectifs:[]}
 if(name==='rapport_reseau')body={ok:false,erreur:'Rapport synthétique indisponible'}
 if(name==='admin_synthese')body={ok:true,totaux:{nb_agents_collecte:21,nb_actifs:22,nb_agences_actives:1,nb_equipes:1},anomalies:{equipes_sans_referent:1},effectifs_par_role:[{role:'chef',total:21,actifs:21,non_actifs:0}]}
 if(name==='admin_annuaire_utilisateurs')body={ok:true,total_filtre:21,utilisateurs:[{...person,nom:args.p_page===2?'Page Deux':'Exemple'}]}
 if(name==='admin_annuaire_equipes')body={ok:true,total_filtre:1,equipes:[{id:team,nom:'Équipe Test',agence_id:id,agence_nom:'Agence Test',chef_id:member,chef_nom:'Agent Exemple',nb_chefs:2,nb_membres:21,nb_zones:0}]}
 if(name==='admin_annuaire_agences')body={ok:true,total_filtre:1,agences:[{id,nom:'Agence Test',actif:true}]}
 if(name==='admin_annuaire_zones')body={ok:true,total_filtre:0,zones:[]}
 if(name==='admin_journal')body={ok:true,total_filtre:1,evenements:[{id,operation:'definir_chef',acteur_email:'synthetic@example.invalid',date_op:'2026-09-23T08:00:00Z',cible_type:'equipe',ancienne_valeur:{chef_id:null},nouvelle_valeur:{chef_id:member}}]}
 if(name==='admin_anomalies_rattachement')body={ok:true,total_filtre:1,elements:[{equipe_id:team,nom:'Équipe Test',agence_id:id}]}
 if(name==='admin_editer_agent')body=fail?{ok:false,erreur:'Refus SQL simulé'}:{ok:true}
 }else if(u.pathname.endsWith('/agents'))body=req.headers().accept?.includes('object')?{id,prenom:'Admin',nom:'Test',telephone:'',role:'admin',actif:true,statut:'actif'}:[person]
 else if(u.pathname.endsWith('/agences'))body=[{id,nom:'Agence Test',actif:true}]
 else if(u.pathname.endsWith('/equipes'))body=[{id:team,nom:'Équipe Test',agence_id:id}]
 else if(u.pathname.endsWith('/objectifs')){if(req.method()==='GET')body=goals;else{const payload=req.postDataJSON();objectiveWrites.push(payload);goals=[{id:'44444444-4444-4444-8444-444444444444',...payload}];body={id:goals[0].id}}}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto((process.env.TEST_BASE_URL||'http://localhost:3003')+'/dashboard/admin')
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Administration'}).click()
 await page.getByRole('heading',{name:'Qualité des rattachements'}).waitFor()
 await page.screenshot({path:'.next/admin-desktop.png',fullPage:true})
 const nav=page.getByRole('navigation',{name:'Administration',exact:true})
 await nav.getByRole('button',{name:'Utilisateurs',exact:true}).click();await page.getByText('Exemple',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Suivant',exact:true}).click();await page.getByText('Page Deux',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='admin_annuaire_utilisateurs').at(-1).args.p_page,2)
 await page.getByRole('button',{name:'Ouvrir',exact:true}).click();await page.getByRole('button',{name:'Enregistrer l’identité'}).click();await page.getByText('Refus SQL simulé',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),1)
 fail=false;await page.getByRole('button',{name:'Enregistrer l’identité'}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
 await nav.getByRole('button',{name:'Journal',exact:true}).click();await page.getByText('definir_chef',{exact:true}).last().waitFor();await page.getByRole('button',{name:'Ouvrir',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape')
 await nav.getByRole('button',{name:'Droits',exact:true}).click();await page.getByRole('heading',{name:'Droits fixes par rôle'}).waitFor();assert.equal(await page.getByRole('checkbox').count(),0)
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Objectifs',exact:true}).click()
 await page.getByRole('button',{name:'Nouvel objectif'}).click();const goalDialog=page.getByRole('dialog')
 await goalDialog.getByLabel('Titre',{exact:true}).fill('Objectif synthétique')
 await goalDialog.getByLabel('Périmètre',{exact:true}).selectOption('agent');await goalDialog.getByRole('combobox',{name:/^Cible/}).selectOption(member)
 await goalDialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await goalDialog.waitFor({state:'hidden'})
 assert.equal(objectiveWrites.at(-1).type_cible,'agent');assert.equal(objectiveWrites.at(-1).agent_id,member);assert.equal(objectiveWrites.at(-1).equipe_id,null)
 await page.getByRole('button',{name:'Modifier',exact:true}).click();await goalDialog.getByLabel('Périmètre',{exact:true}).selectOption('equipe');await goalDialog.getByRole('combobox',{name:/^Cible/}).selectOption(team)
 await goalDialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await goalDialog.waitFor({state:'hidden'});assert.equal(objectiveWrites.at(-1).type_cible,'equipe');assert.equal(objectiveWrites.at(-1).equipe_id,team);assert.equal(objectiveWrites.at(-1).agent_id,null)
 await page.getByRole('button',{name:'Dupliquer',exact:true}).click();await goalDialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await goalDialog.waitFor({state:'hidden'});assert.ok(!('id' in objectiveWrites.at(-1)))
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Administration',exact:true}).click()
 await page.setViewportSize({width:390,height:844});await nav.getByRole('button',{name:'Utilisateurs',exact:true}).click();await page.getByRole('button',{name:'Ouvrir',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().width<=window.innerWidth));await page.screenshot({path:'.next/admin-mobile.png'});await page.keyboard.press('Escape')
 assert.deepEqual(errors,[]);console.log('PASS Admin UI: synthèse, pagination serveur, refus SQL sans faux succès, succès confirmé, journal, droits fixes, tiroir clavier/mobile.')
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
