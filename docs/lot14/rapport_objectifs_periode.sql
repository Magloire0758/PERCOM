-- ARCHIVE : proposition non déployée, remplacée par les Lots 14B/15 fournis par PADES. NE PAS EXÉCUTER.
-- PERCOM Lot 14 — PROPOSITION à revoir/recetter sur PERCOM avant publication frontend.
-- Lecture seulement. Ne change ni les droits d'écriture ni les triggers d'unicité.
-- Dépend du Lot 13.2 migré : utilisé uniquement pour les réalisés et écarts.
-- Les objectifs/taux du Lot 13.2 ne sont jamais repris.
create or replace function public.rapport_objectifs_periode(
 p_mesure text, p_niveau text, p_periodicite text, p_date_reference date,
 p_agence_id uuid default null, p_statuts text[] default array['validee'],
 p_comptes text default 'tous'
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
 moi public.agents; debut date; fin date; arrete date; maintenant date;
 base jsonb; source jsonb; ligne jsonb; lignes jsonb := '[]'::jsonb; total jsonb;
 cible uuid; valeur numeric; realise numeric; nb integer; rang integer := 0;
 scope uuid; manque integer := 0;
begin
 moi := public._agent_courant();
 if moi.id is null or moi.role is null or moi.role not in ('admin','dg','responsable') then
   return jsonb_build_object('ok',false,'erreur','Accès réservé à la gestion active.');
 end if;
 if p_niveau is null or p_niveau not in ('agent','agence','reseau') or p_periodicite is null
   or p_periodicite not in ('journalier','mensuel','annuel') or p_date_reference is null
   or extract(year from p_date_reference) not between 1900 and 9999 then
   return jsonb_build_object('ok',false,'erreur','Niveau ou période invalide.');
 end if;
 if p_niveau='reseau' and (moi.role='responsable' or p_agence_id is not null) then
   return jsonb_build_object('ok',false,'erreur','Rapport société réservé au réseau complet.');
 end if;
 if p_comptes is null or p_comptes not in ('actif','inactif','tous') or (p_niveau<>'agent' and p_comptes<>'tous') then
   return jsonb_build_object('ok',false,'erreur','Les rapports collectifs incluent tous les comptes.');
 end if;
 if moi.role='responsable' and (moi.agence_id is null or (p_agence_id is not null and p_agence_id<>moi.agence_id)) then
   return jsonb_build_object('ok',false,'erreur','Accès limité à votre agence.');
 end if;
 scope := case when moi.role='responsable' then moi.agence_id else p_agence_id end;
 if scope is not null and not exists(select 1 from public.agences where id=scope) then
   return jsonb_build_object('ok',false,'erreur','Agence introuvable.');
 end if;
 maintenant := (current_timestamp at time zone 'Africa/Lome')::date;
 debut := case p_periodicite when 'journalier' then p_date_reference when 'mensuel' then date_trunc('month',p_date_reference)::date else date_trunc('year',p_date_reference)::date end;
 fin := case p_periodicite when 'journalier' then debut when 'mensuel' then (debut+interval '1 month - 1 day')::date else (debut+interval '1 year - 1 day')::date end;
 arrete := case when debut>maintenant then null else least(fin,maintenant) end;
 base := public.rapport_objectifs_consolide(p_mesure,debut,coalesce(arrete,debut),scope,p_statuts,p_comptes);
 if (base->>'ok')::boolean is not true then return base; end if;
 source := case p_niveau when 'agent' then base->'lignes_agent' when 'agence' then base->'sous_totaux' else jsonb_build_array(base->'total_general') end;
 for ligne in select x from jsonb_array_elements(source) x loop
   rang := rang+1;
   cible := case p_niveau when 'agent' then (ligne->>'agent_id')::uuid when 'agence' then (ligne->>'agence_id')::uuid else null end;
   -- Exact periodicity and exact calendar bounds. Legacy monthly-only compatibility.
   select count(*),sum(v) into nb,valeur from (
     select case when p_mesure='cible_montant_smart' then coalesce((to_jsonb(o)->>'cible_montant_smart')::numeric,(to_jsonb(o)->>'cible_montant')::numeric)
       else (to_jsonb(o)->>p_mesure)::numeric end v
     from public.objectifs o
     where o.type_cible::text=p_niveau and o.statut_objectif::text='actif'
       and ((p_niveau='agent' and o.agent_id=cible) or (p_niveau='agence' and o.agence_id=cible)
         or (p_niveau='reseau' and o.agent_id is null and o.equipe_id is null and o.agence_id is null and o.zone_id is null))
       and ((o.type_periodicite::text=p_periodicite and o.date_debut=debut and o.date_fin=fin)
         or (p_periodicite='mensuel' and coalesce(o.type_periodicite::text,'mensuel')='mensuel'
           and o.date_debut is null and o.date_fin is null and o.mois=extract(month from debut) and o.annee=extract(year from debut)))
   ) q where v is not null;
   if nb<>1 then valeur:=null; manque:=manque+1; end if;
   realise := case when arrete is null then 0 else (ligne->>'realise')::numeric end;
   -- Multiple targets are reported as a conflict, never added or chosen arbitrarily.
   ligne := jsonb_build_object('n',rang,'id',cible,'agence_id',case when p_niveau='agent' then (ligne->>'agence_id')::uuid else cible end,
     'agence_nom',case when p_niveau='reseau' then 'Société' else ligne->>'agence_nom' end,
     'agent_nom',case when p_niveau='agent' then ligne->>'agent_nom' else null end,
     'objectif',valeur,'objectif_statut',case when nb=0 then 'absent' when nb>1 then 'conflit' else 'defini' end,
     'realise',realise,'taux',case when valeur>0 then round(realise/valeur*100,2) else null end,
     'ecart',case when valeur is null then null else valeur-realise end)
     || case when p_niveau='agent' and p_mesure='cible_montant_smart' then jsonb_build_object(
       'ecart_caisse_manquant',case when arrete is null then 0 else (ligne->>'ecart_caisse_manquant')::numeric end,
       'ecart_caisse_surplus',case when arrete is null then 0 else (ligne->>'ecart_caisse_surplus')::numeric end,
       'regularise',case when arrete is null then 0 else (ligne->>'regularise')::numeric end,
       'dernier_commentaire',case when arrete is null then null else ligne->>'dernier_commentaire' end,
       'dernier_commentaire_date',case when arrete is null then null else ligne->>'dernier_commentaire_date' end,
       'dernier_commentaire_fiche_id',case when arrete is null then null else ligne->>'dernier_commentaire_fiche_id' end
     ) else '{}'::jsonb end;
   lignes := lignes || jsonb_build_array(ligne);
 end loop;
 select jsonb_build_object('objectif',sum((l->>'objectif')::numeric),'realise',coalesce(sum((l->>'realise')::numeric),0),
   'taux',case when manque=0 and sum((l->>'objectif')::numeric)>0 then round(sum((l->>'realise')::numeric)/sum((l->>'objectif')::numeric)*100,2) else null end,
   'ecart',case when manque=0 then sum((l->>'objectif')::numeric)-sum((l->>'realise')::numeric) else null end)
   || case when p_niveau='agent' and p_mesure='cible_montant_smart' then jsonb_build_object(
     'ecart_caisse_manquant',coalesce(sum((l->>'ecart_caisse_manquant')::numeric),0),
     'ecart_caisse_surplus',coalesce(sum((l->>'ecart_caisse_surplus')::numeric),0),
     'regularise',coalesce(sum((l->>'regularise')::numeric),0)) else '{}'::jsonb end
 into total from jsonb_array_elements(lignes) l;
 return jsonb_build_object('ok',true,'meta',jsonb_build_object('contrat_version',2,'niveau',p_niveau,'periodicite',p_periodicite,
   'mesure',p_mesure,'libelle_mesure',base->'meta'->>'libelle_mesure',
   'date_debut',debut,'date_fin',fin,'date_arrete',arrete,'statuts',to_jsonb(p_statuts),'comptes',p_comptes,
   'agence_id',scope,'agence_nom',(select nom from public.agences where id=scope),'objectifs_incomplets',manque>0),
   'lignes',lignes,'total',total);
exception when others then
 return jsonb_build_object('ok',false,'erreur','Rapport indisponible. Vérifiez les objectifs et réessayez.');
end;
$fn$;
revoke execute on function public.rapport_objectifs_periode(text,text,text,date,uuid,text[],text) from public,anon;
grant execute on function public.rapport_objectifs_periode(text,text,text,date,uuid,text[],text) to authenticated;
