// Page d'accueil : le hublot (tes souvenirs qui défilent en grand, une citation), l'invitation au bilan,
// les rêves les plus proches, les tâches du jour.
import { I } from '../noyau/icones.js';
import { sod, cap, dLong } from '../noyau/dates.js';
import { S, mediaUrl } from '../noyau/store.js';
import { esc } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { domaine, progression, joursAvant, dansTexte, revesProches, arcVol } from '../noyau/domaines.js';
import { tirerSouvenir, urlSouvenir, auHasard } from '../noyau/inspiration.js';
import { capCourant } from '../noyau/horizon.js';
import { monter } from '../fonds/moteur.js';
import { bilansEnAttente, ecarterBilans, nomJour } from './bilans.js';
import { taskRow, sortTasks, revueEnAttente, isStale } from './taches.js';
import { blocAccueil as engagementsDuJour } from './engagements.js';
import { encouragement } from './reves.js';

/* ---------- le hublot ----------
   Un seul élément, conservé d'un redessin à l'autre : les photos se succèdent en fondu, avec un zoom très lent.
   Durée de chaque photo : Réglages › Souvenirs (20, 25 ou 30 secondes). */
const H = { el: null, actif: false, lance: false, occupe: false, pause: false, minuteur: null, tours: 0, histo: [], pos: -1, citation: null, fond: null };
const duree = () => Math.max(20, Math.min(30, (S.settings.accueil && S.settings.accueil.chaque) || 25)) * 1000;
const $h = s => H.el.querySelector(s);

function construire(){
  const el = document.createElement('section'); el.className = 'hublot'; el.setAttribute('aria-label', 'Souvenirs');
  el.innerHTML = `<div class="hublot-vues" aria-hidden="true"></div>
    <div class="hublot-haut"><div class="eyebrow"></div><h1></h1></div>
    <blockquote class="hublot-citation"></blockquote>
    <div class="hublot-bas"><span class="hublot-lieu"></span><div class="hublot-cmd">
      <button data-hub="prec" title="Photo précédente" aria-label="Photo précédente">${I.gauche}</button>
      <button data-hub="pause" title="Mettre en pause" aria-label="Mettre en pause">${I.pause}</button>
      <button data-hub="suiv" title="Photo suivante" aria-label="Photo suivante">${I.chev}</button></div></div>
    <div class="hublot-fil" aria-hidden="true"><i></i></div>`;
  return el;
}
function salut(){
  const now = new Date(), h = now.getHours();
  const hello = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  $h('.hublot-haut .eyebrow').textContent = cap(dLong(now));
  $h('.hublot-haut h1').textContent = `${hello}${S.settings.name ? ', ' + S.settings.name : ''}.`;
}
function ecrireCitation(q){
  $h('.hublot-citation').innerHTML = q ? `<p>« ${esc(q.text)} »</p>${q.author ? `<cite>${esc(q.author)}</cite>` : ''}` : `<p>Ajoute tes citations et tes photos dans Réglages : elles t'accueilleront ici.</p>`;
}
function changerCitation(){
  if(S.quotes.length < 2 && H.citation) return;
  const autres = S.quotes.filter(q => !H.citation || q.id !== H.citation.id);
  H.citation = auHasard(autres.length ? autres : S.quotes);
  const bloc = $h('.hublot-citation');
  bloc.classList.add('change');
  setTimeout(() => { ecrireCitation(H.citation); bloc.classList.remove('change'); }, 900);
}
function relancerFil(){
  const fil = $h('.hublot-fil'); fil.style.setProperty('--dur', duree() / 1000 + 's'); fil.innerHTML = '<i></i>';
}
function retirer(vue){ vue.classList.add('sort'); setTimeout(() => { vue.querySelectorAll('.fond').forEach(f => f.demonter && f.demonter()); vue.remove(); }, 2000); }
function poser(vue, legende){
  const zone = $h('.hublot-vues'), anciennes = Array.from(zone.children);
  zone.appendChild(vue);
  requestAnimationFrame(() => requestAnimationFrame(() => vue.classList.remove('entre')));
  anciennes.forEach(retirer);
  $h('.hublot-lieu').textContent = legende || '';
}
// Une photo de famille le plus souvent ; une personne inspirante de temps en temps.
async function tirer(){
  const personne = auHasard(S.people), souvenir = await tirerSouvenir('accueil');
  if(personne && (!souvenir || Math.random() < .25)) return { url: mediaUrl(personne.rel), legende: personne.name };
  return souvenir ? { url: urlSouvenir(souvenir), legende: souvenir.a.split(' / ').pop() } : null;
}
function afficherPhoto(p){
  return new Promise(fini => {
    const img = new Image(); img.alt = ''; img.decoding = 'async';
    img.onload = () => {
      if(!H.el) return fini(false);
      const portrait = img.naturalHeight > img.naturalWidth * 1.15;
      const vue = document.createElement('div');
      vue.className = `vue entre${portrait ? ' portrait' : ''}${H.tours % 2 ? ' b' : ''}`;
      vue.style.setProperty('--dur', (duree() / 1000 + 4) + 's');
      if(portrait){ const f = document.createElement('div'); f.className = 'vue-fond'; f.style.backgroundImage = `url("${p.url.replace(/"/g, '%22')}")`; vue.appendChild(f); }
      vue.appendChild(img);
      H.fond = null; H.el.classList.remove('fixe');
      poser(vue, p.legende); fini(true);
    };
    img.onerror = () => fini(false);
    img.src = p.url;
  });
}
// Sans aucune photo : la destination du mois, nette, tient lieu de souvenir.
async function afficherDestination(){
  const id = capCourant(); if(!id || H.fond === id) return;
  const vue = document.createElement('div'); vue.className = 'vue entre';
  try{ await monter(vue, id, { anim: S.settings.calendrier.anim !== false }); }catch(e){ return; }
  H.fond = id; H.el.classList.add('fixe');
  poser(vue, '');
}
async function montrer(p){
  if(p && await afficherPhoto(p)) relancerFil(); else await afficherDestination();
}
async function avancer(){
  if(H.occupe || !H.el) return; H.occupe = true;
  let p = null;
  if(H.pos < H.histo.length - 1) p = H.histo[++H.pos];
  else { p = await tirer(); if(p){ H.histo.push(p); if(H.histo.length > 15) H.histo.shift(); H.pos = H.histo.length - 1; } }
  await montrer(p);
  if(H.tours && H.tours % 3 === 0) changerCitation();
  H.tours++; H.occupe = false; programmer();
}
async function reculer(){
  if(H.occupe || H.pos <= 0) return; H.occupe = true;
  await montrer(H.histo[--H.pos]);
  H.occupe = false; programmer();
}
function programmer(){
  clearTimeout(H.minuteur);
  if(!H.actif || H.pause || document.hidden) return;
  H.minuteur = setTimeout(avancer, duree());
}
function basculerPause(){
  H.pause = !H.pause; H.el.classList.toggle('pause', H.pause);
  const b = $h('[data-hub="pause"]'); b.innerHTML = H.pause ? I.play : I.pause;
  b.title = H.pause ? 'Reprendre le défilement' : 'Mettre en pause'; b.setAttribute('aria-label', b.title);
  if(!H.pause) relancerFil();
  programmer();
}
export function entrer(){ H.actif = true; if(H.lance){ relancerFil(); programmer(); } }
export function quitter(){ H.actif = false; clearTimeout(H.minuteur); }
document.addEventListener('visibilitychange', () => { if(H.lance && H.actif){ if(!document.hidden && !H.pause) relancerFil(); programmer(); } });
// Réglages : la durée ou les albums ont changé, le prochain passage en tient compte tout de suite.
export const _etat = H;

/* ---------- le reste de la page ---------- */
function tachesDuJour(){
  const fin = sod(new Date()).getTime() + 864e5;
  return sortTasks(S.tasks.filter(t => !t.archived && !t.done && !isStale(t) && (t.list === 'day' || t.urgent || (t.deadline && +new Date(t.deadline) < fin)))).slice(0, 6);
}
function suite(){
  const attente = bilansEnAttente(), revue = revueEnAttente(), reves = revesProches(3), taches = tachesDuJour();
  const invitation = attente.length ? `<div class="invite"><span class="invite-ico">${I.bilan}</span><p><b>${attente.length > 1 ? `Faire le bilan des ${attente.length} dernières journées ?` : `Faire le bilan d'${nomJour(attente[0]) === 'hier' ? 'hier' : nomJour(attente[0])} ?`}</b><small>Trois questions, deux minutes : ce qui était bien, ce qui ne l'était pas, ce qui peut être amélioré.</small></p><button class="btn ghost" data-acc="bilan-non">Pas cette fois</button><button class="btn primary" data-acc="bilan-oui">Faire le bilan</button></div>` : '';
  const periode = revue ? `<div class="invite douce"><span class="invite-ico">${I.spark}</span><p><b>Une période vient de se terminer.</b><small>${revue} tâche${revue > 1 ? 's' : ''} à ranger avant de repartir.</small></p><button class="btn" data-acc="revue">Faire le point</button></div>` : '';
  return `${invitation}${periode}${engagementsDuJour()}
    <div class="acc-colonnes">
      <section><div class="sec-h"><h2>Mes rêves les plus proches</h2><button class="r" data-onglet="reves">Tout voir</button></div>
        ${reves.length ? reves.map(r => { const d = domaine(r.domain), p = progression(r); return `<button class="reve-ligne" data-reve="${r.id}" style="--d:${d.c}"><span class="reve-dom">${d.nom}</span><span class="pct tab">${p.pct} %</span><b>${esc(r.title)}</b>${arcVol(p.pct, d.c)}<small>${dansTexte(joursAvant(r.deadline))} · ${esc(encouragement(r))}</small></button>`; }).join('')
          : `<div class="empty petit"><b>Aucun rêve daté.</b><button class="btn" data-acc="reve">${I.plus}Écrire un rêve</button></div>`}
      </section>
      <section><div class="sec-h"><h2>Aujourd'hui</h2><button class="r" data-onglet="taches">Toutes mes tâches</button></div>
        ${taches.length ? `<div class="tasks">${taches.map(t => taskRow(t, { showList: true })).join('')}</div>` : `<div class="empty petit"><b>Rien d'urgent aujourd'hui.</b>Profite, ou avance sur un rêve.</div>`}
        ${taches.length ? `<button class="btn fort action" data-focus="${taches[0].id}">${I.play}Passer à l'action · ${esc(taches[0].title.length > 34 ? taches[0].title.slice(0, 33) + '…' : taches[0].title)}</button>` : ''}
      </section>
    </div>`;
}
export function rendre(vue){
  if(!H.el){ H.el = construire(); H.citation = auHasard(S.quotes); ecrireCitation(H.citation); }
  salut();
  // Le hublot reste en place tant qu'on est sur l'accueil : seul le bas de la page est redessiné.
  if(H.el.parentElement !== vue || !vue.querySelector('#accSuite')){ vue.innerHTML = '<div id="accSuite"></div>'; vue.prepend(H.el); }
  vue.querySelector('#accSuite').innerHTML = suite();
  if(!H.lance){ H.lance = true; H.actif = true; avancer(); }
}
app.clics.push((e) => {
  const hub = e.target.closest('[data-hub]');
  if(hub && H.el){
    if(hub.dataset.hub === 'pause') basculerPause();
    else if(hub.dataset.hub === 'prec') reculer();
    else { clearTimeout(H.minuteur); avancer(); }
    return true;
  }
  const tg = e.target.closest('[data-acc]'); if(!tg) return false;
  switch(tg.dataset.acc){
    case 'bilan-oui': app.aller('bilans', { date: bilansEnAttente()[0] }); break;
    case 'bilan-non': ecarterBilans(); app.rendre(); break; // l'invitation est annulée, sans culpabilité
    case 'revue': app.aller('taches'); setTimeout(() => { const b = document.querySelector('[data-act="review-open"]'); if(b) b.click(); }, 80); break;
    case 'reve': app.aller('reves', { nouveau: true }); break;
    default: return false;
  }
  return true;
});
