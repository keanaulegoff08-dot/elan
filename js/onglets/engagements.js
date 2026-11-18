// Onglet « Mes engagements » : une promesse à soi-même, tenue pendant une durée choisie
// (3 jours, 1 semaine, 2 semaines, un mois, ou un nombre de jours libre).
// Chaque jour est une escale sur la route : tenu, pas tenu, ou encore à dire.
//   S.commitments : [{ id, title, why, cat, start: 'AAAA-MM-JJ', days, log: { 'AAAA-MM-JJ': 'ok' | 'ko' }, createdAt, stoppedAt }]
import { I } from '../noyau/icones.js';
import { ymd, sod, addDays, dShort, dLong, JOURS, cap } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast, celebrer, dateLongue } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { playCheck } from '../noyau/sons.js';
import { catOf } from './taches.js';

const render = () => app.rendre();
export const DUREES = [[3, '3 jours'], [5, '5 jours'], [7, '1 semaine'], [10, '10 jours'], [14, '2 semaines'], [21, '3 semaines'], [30, '1 mois']];
const IDEES = [
  ['Me lever à 6 h tous les matins', 14, ''],
  ['Bien manger', 3, 'bienetre'],
  ['Aller à la salle chaque jour prévu', 7, 'sport'],
  ['Pas de téléphone au lit', 7, 'bienetre'],
  ['Deux heures de mémoire par jour', 10, 'etudes'],
];

/* ---------- outils ---------- */
const ecart = (a, b) => Math.round((sod(b) - sod(a)) / 864e5);
export const finDe = e => addDays(dateLongue(e.start), e.days - 1);
const nomDuree = n => (DUREES.find(d => d[0] === n) || [n, `${n} jours`])[1];
const couleur = e => { const c = catOf(e.cat); return c ? c.color : 'var(--accent)'; };
export function etat(e, auj = sod(new Date())){
  if(e.stoppedAt) return 'fini';
  const d0 = dateLongue(e.start), d1 = finDe(e);
  return auj < d0 ? 'avenir' : auj > d1 ? 'fini' : 'encours';
}
function bilan(e){
  const auj = ymd(new Date()); let ok = 0, ko = 0, passes = 0;
  for(let i = 0; i < e.days; i++){
    const k = ymd(addDays(dateLongue(e.start), i));
    if(k > auj) break;
    passes++;
    if(e.log[k] === 'ok') ok++; else if(e.log[k] === 'ko') ko++;
  }
  return { ok, ko, passes, pct: e.days ? Math.round(ok / e.days * 100) : 0 };
}
export const actifs = () => S.commitments.filter(e => etat(e) === 'encours');
// Engagements en cours dont la journée d'aujourd'hui n'est pas encore dite.
export const aValider = () => { const k = ymd(new Date()); return actifs().filter(e => !e.log[k]); };

/* ---------- la route ---------- */
function route(e, compacte = false){
  const auj = ymd(new Date()), d0 = dateLongue(e.start);
  let stops = '';
  for(let i = 0; i < e.days; i++){
    const j = addDays(d0, i), k = ymd(j), v = e.log[k];
    const cls = v === 'ok' ? 'ok' : v === 'ko' ? 'ko' : k > auj ? 'futur' : k === auj ? 'attente' : 'oubli';
    const dit = v === 'ok' ? 'tenu' : v === 'ko' ? 'pas tenu' : k > auj ? 'à venir' : 'pas encore dit';
    stops += `<button class="eng-stop ${cls} ${k === auj ? 'auj' : ''} ${k <= auj ? 'passe' : ''}" ${k > auj || compacte ? 'disabled' : ''} data-eng-j="${e.id}:${k}:cycle" title="${cap(dLong(j))} : ${dit}" aria-label="${cap(dLong(j))} : ${dit}"><i>${v === 'ok' ? I.check : v === 'ko' ? I.close : ''}</i></button>`;
  }
  const atteinte = ymd(finDe(e)) < auj || e.stoppedAt;
  return `<div class="eng-route ${compacte ? 'compacte' : e.days > 18 ? 'longue' : e.days > 11 ? 'moyenne' : ''}" style="--n:${e.days + 1}">${stops}<span class="eng-arrivee ${atteinte ? 'atteinte' : ''}" title="Arrivée le ${dLong(finDe(e))}">${I.drapeau}</span></div>`;
}

/* ---------- cartes ---------- */
function carte(e){
  const st = etat(e), c = couleur(e), cat = catOf(e.cat), auj = sod(new Date()), k = ymd(auj), b = bilan(e);
  const jour = ecart(dateLongue(e.start), auj) + 1, reste = ecart(auj, finDe(e));
  const entete = st === 'avenir'
    ? `Commence ${ecart(auj, dateLongue(e.start)) === 1 ? 'demain' : 'le ' + dLong(dateLongue(e.start))}`
    : `Jour ${jour} sur ${e.days}`;
  const quand = `Du ${dShort(dateLongue(e.start))} au ${dShort(finDe(e))}${st === 'encours' ? ` · ${reste === 0 ? 'dernier jour aujourd’hui' : reste === 1 ? 'arrivée demain' : `arrivée dans ${reste} jours`}` : ''}`;
  const aujourdhui = st === 'encours' ? `<div class="eng-auj"><span>Aujourd'hui, ${JOURS[auj.getDay()]}</span>
      <button class="choix ok ${e.log[k] === 'ok' ? 'on' : ''}" data-eng-j="${e.id}:${k}:ok">${I.check}Tenu</button>
      <button class="choix ko ${e.log[k] === 'ko' ? 'on' : ''}" data-eng-j="${e.id}:${k}:ko">Pas tenu</button></div>` : '';
  return `<article class="eng ${st}" style="--c:${c}">
    <header class="eng-h"><span class="eng-cat">${cat ? esc(cat.name) : 'Engagement'} · ${nomDuree(e.days)}</span><span class="eng-jour tab">${entete}</span>
      <button class="icon-btn sm" data-eng="modifier:${e.id}" title="Modifier l'engagement" aria-label="Modifier l'engagement">${I.crayon}</button></header>
    <h3 class="eng-t">${esc(e.title)}</h3>
    ${e.why ? `<p class="eng-why">${esc(e.why)}</p>` : ''}
    ${route(e)}
    <div class="eng-bas"><span>${quand}</span>${st === 'encours' ? `<span class="eng-score"><b class="tab">${b.ok}</b> tenu${b.ok > 1 ? 's' : ''} sur ${b.passes}</span>` : ''}</div>
    ${aujourdhui}
  </article>`;
}
function carteFinie(e){
  const b = bilan(e), c = couleur(e), complet = b.ok === e.days;
  return `<article class="eng fini ${complet ? 'tenu' : ''}" style="--c:${c}">
    <div class="eng-fini-g">
      <h3 class="eng-t">${esc(e.title)}</h3>
      <span class="eng-quand">${nomDuree(e.days)} · du ${dShort(dateLongue(e.start))} au ${dShort(finDe(e))}${e.stoppedAt ? ` · arrêté le ${dShort(new Date(e.stoppedAt))}` : ''}</span>
      ${route(e, true)}
    </div>
    <div class="eng-fini-d">
      ${complet ? `<span class="eng-badge">${I.drapeau}Promesse tenue</span>` : `<span class="eng-res"><b class="tab">${b.ok}</b> jour${b.ok > 1 ? 's' : ''} tenu${b.ok > 1 ? 's' : ''} sur ${e.days}</span>`}
      <div class="ligne"><button class="btn" data-eng="relancer:${e.id}">Recommencer</button><button class="icon-btn sm" data-eng="modifier:${e.id}" title="Modifier" aria-label="Modifier">${I.crayon}</button></div>
    </div>
  </article>`;
}

export function rendre(vue){
  const tous = S.commitments.slice().sort((a, b) => a.start.localeCompare(b.start));
  const enCours = tous.filter(e => etat(e) === 'encours'), aVenir = tous.filter(e => etat(e) === 'avenir');
  const finis = tous.filter(e => etat(e) === 'fini').sort((a, b) => ymd(finDe(b)).localeCompare(ymd(finDe(a))));
  const attente = aValider().length;
  vue.innerHTML = `
    <div class="head"><div><div class="eyebrow">Une promesse à toi-même, pour une durée choisie</div><h1>Mes engagements</h1></div>
      <button class="btn fort" data-eng="nouveau">${I.plus}Nouvel engagement</button></div>
    ${enCours.length ? `<p class="eng-resume">${enCours.length} engagement${enCours.length > 1 ? 's' : ''} en cours${attente ? ` · <b>${attente} à valider aujourd'hui</b>` : ' · tout est dit pour aujourd’hui'}</p>` : ''}
    ${enCours.length || aVenir.length ? `<div class="engs">${[...enCours, ...aVenir].map(carte).join('')}</div>` : `
      <div class="eng-vide">
        <b>Sur quoi veux-tu t'engager ?</b>
        <p>Choisis une action et une durée. Chaque jour, tu dis si tu as tenu ta promesse.</p>
        <div class="eng-idees">${IDEES.map(([t, n, c], i) => `<button class="chip" data-eng="idee:${i}" ${c && catOf(c) ? `style="--c:${catOf(c).color}"` : ''}>${esc(t)} · ${nomDuree(n)}</button>`).join('')}</div>
      </div>`}
    ${finis.length ? `<div class="sec-h" style="margin-top:40px"><h2>Arrivés</h2><span class="n tab">${finis.length}</span></div><div class="engs-finis">${finis.map(carteFinie).join('')}</div>` : ''}`;
}

/* ---------- formulaire ---------- */
let edition = null, brouillon = null;
function ouvrirForm(e){
  edition = e && e.id ? e.id : null;
  brouillon = Object.assign({ title: '', why: '', cat: '', start: ymd(new Date()), days: 7 }, e || {});
  dessinerForm(); $('#modal').classList.add('show'); setTimeout(() => { const t = $('#engTitre'); if(t && !t.value) t.focus(); }, 60);
}
function dessinerForm(){
  const b = brouillon, d0 = dateLongue(b.start), d1 = addDays(d0, b.days - 1);
  const auj = ymd(new Date()), demain = ymd(addDays(new Date(), 1));
  const commence = edition && b.start <= auj;
  const autre = !DUREES.some(d => d[0] === b.days);
  $('#modalBox').innerHTML = `<form id="engForm" autocomplete="off">
    <div class="modal-h"><div class="eyebrow">${edition ? 'Modifier l’engagement' : 'Nouvel engagement'}</div>
      <h3><textarea class="titre-champ" id="engTitre" rows="1" placeholder="Je m'engage à…">${esc(b.title)}</textarea></h3></div>
    <div class="modal-b">
      <div class="field"><label>Pendant</label><div class="eng-durees">${DUREES.map(([n, l]) => `<button type="button" class="chip ${b.days === n ? 'on' : ''}" data-engf-duree="${n}">${l}</button>`).join('')}
        <label class="chip eng-autre ${autre ? 'on' : ''}"><input type="number" id="engJours" min="1" max="365" value="${autre ? b.days : ''}" placeholder="…" aria-label="Nombre de jours"> jours</label></div></div>
      <div class="field"><label>À partir de</label><div class="ligne">
        ${commence ? `<span class="note" style="margin:0">Commencé le ${dLong(d0)}</span>` : `
        <button type="button" class="chip ${b.start === auj ? 'on' : ''}" data-engf-debut="${auj}">Aujourd'hui</button>
        <button type="button" class="chip ${b.start === demain ? 'on' : ''}" data-engf-debut="${demain}">Demain</button>
        <input type="date" class="inp" id="engDebut" value="${b.start}" style="width:auto" aria-label="Date de début">`}</div>
        <p class="note eng-periode">Du ${dLong(d0)} au ${dLong(d1)}, soit ${b.days} jour${b.days > 1 ? 's' : ''}.</p></div>
      <div class="field"><label>Catégorie</label><div class="cat-pick">${S.categories.map(c => `<button type="button" class="chip ${b.cat === c.id ? 'on' : ''}" data-engf-cat="${c.id}" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</button>`).join('')}<button type="button" class="chip ${!b.cat ? 'on' : ''}" data-engf-cat="">Aucune</button></div></div>
      <label class="etiq">Pourquoi c'est important pour moi (facultatif)<textarea class="inp" id="engWhy" rows="2" placeholder="Ce que je gagne à tenir cette promesse">${esc(b.why)}</textarea></label>
    </div>
    <div class="modal-f">${edition ? `<button type="button" class="btn ghost danger" data-engf="supprimer">${I.trash}Supprimer</button>${etat(S.commitments.find(x => x.id === edition)) === 'encours' ? `<button type="button" class="btn ghost" data-engf="arreter">Arrêter</button>` : ''}` : ''}
      <span class="pousse"></span><button type="button" class="btn ghost" data-engf="annuler">Annuler</button><button class="btn primary">${edition ? 'Enregistrer' : 'Je m’engage'}</button></div>
  </form>`;
  const t = $('#engTitre'); t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
  t.addEventListener('input', () => { b.title = t.value; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
  t.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); $('#engForm').requestSubmit(); } });
  $('#engWhy').addEventListener('input', ev => { b.why = ev.target.value; });
  const nb = $('#engJours');
  nb.addEventListener('input', () => { const n = Math.round(+nb.value); if(n >= 1 && n <= 365){ b.days = n; majPeriode(); document.querySelectorAll('[data-engf-duree]').forEach(x => x.classList.remove('on')); nb.closest('.eng-autre').classList.add('on'); } });
  const deb = $('#engDebut'); if(deb) deb.addEventListener('change', () => { if(deb.value){ b.start = deb.value; dessinerForm(); } });
}
function majPeriode(){
  const b = brouillon, d0 = dateLongue(b.start), p = $('.eng-periode');
  if(p) p.textContent = `Du ${dLong(d0)} au ${dLong(addDays(d0, b.days - 1))}, soit ${b.days} jour${b.days > 1 ? 's' : ''}.`;
}
const fermer = () => $('#modal').classList.remove('show');

document.addEventListener('submit', ev => {
  if(ev.target.id !== 'engForm') return;
  ev.preventDefault();
  const b = brouillon, titre = (b.title || '').replace(/\s*\n\s*/g, ' ').trim();
  if(!titre){ $('#engTitre').focus(); return; }
  if(edition){
    const e = S.commitments.find(x => x.id === edition);
    Object.assign(e, { title: titre, why: b.why.trim(), cat: b.cat || null, days: b.days, start: b.start });
    toast('Engagement modifié');
  } else {
    S.commitments.push({ id: uid(), title: titre, why: b.why.trim(), cat: b.cat || null, start: b.start, days: b.days, log: {}, createdAt: new Date().toISOString(), stoppedAt: null });
    toast(`Engagement pris pour ${nomDuree(b.days)}`);
  }
  save(); fermer(); if(app.onglet !== 'engagements') app.aller('engagements'); else render();
});

/* ---------- valider un jour ---------- */
function dire(id, k, quoi, bouton){
  const e = S.commitments.find(x => x.id === id); if(!e) return;
  const avant = e.log[k];
  const v = quoi === 'cycle' ? (!avant ? 'ok' : avant === 'ok' ? 'ko' : null) : (avant === quoi ? null : quoi);
  if(v) e.log[k] = v; else delete e.log[k];
  save();
  if(v === 'ok'){
    playCheck(false);
    const b = bilan(e), dernier = k === ymd(finDe(e));
    if(bouton){ const r = bouton.getBoundingClientRect(); celebrer(r.left + r.width / 2, r.top + r.height / 2, couleur(e).startsWith('var') ? '#2E9E9B' : couleur(e)); }
    if(dernier && b.ok === e.days) toast(`Promesse tenue jusqu'au bout : ${e.days} jours sur ${e.days}. Bravo.`);
  } else if(v === 'ko' && quoi !== 'cycle') toast('Noté. Demain est une nouvelle escale.');
  render();
}

app.clics.push((ev) => {
  const j = ev.target.closest('[data-eng-j]');
  if(j){ const [id, k, quoi] = j.dataset.engJ.split(':'); dire(id, k, quoi, j); return true; }
  const f = ev.target.closest('[data-engf-duree],[data-engf-debut],[data-engf-cat],[data-engf]');
  if(f){
    const d = f.dataset, b = brouillon;
    if(d.engfDuree){ b.days = +d.engfDuree; dessinerForm(); }
    else if(d.engfDebut){ b.start = d.engfDebut; dessinerForm(); }
    else if(d.engfCat !== undefined){ b.cat = d.engfCat; dessinerForm(); }
    else if(d.engf === 'annuler') fermer();
    else if(d.engf === 'arreter'){ const e = S.commitments.find(x => x.id === edition); e.stoppedAt = new Date().toISOString(); save(); fermer(); render(); toast('Engagement arrêté', () => { e.stoppedAt = null; save(); render(); }); }
    else if(d.engf === 'supprimer'){
      if(f.dataset.confirm !== '1'){ f.dataset.confirm = '1'; f.lastChild.textContent = 'Confirmer la suppression'; return true; }
      const i = S.commitments.findIndex(x => x.id === edition), e = S.commitments.splice(i, 1)[0];
      save(); fermer(); render(); toast('Engagement supprimé', () => { S.commitments.splice(i, 0, e); save(); render(); });
    }
    return true;
  }
  const a = ev.target.closest('[data-eng]'); if(!a) return false;
  const [quoi, id] = a.dataset.eng.split(':');
  if(quoi === 'nouveau') ouvrirForm(null);
  else if(quoi === 'idee'){ const [t, n, c] = IDEES[+id]; ouvrirForm({ title: t, days: n, cat: catOf(c) ? c : '' }); }
  else if(quoi === 'modifier') ouvrirForm(S.commitments.find(x => x.id === id));
  else if(quoi === 'relancer'){ const e = S.commitments.find(x => x.id === id); ouvrirForm({ title: e.title, why: e.why, cat: e.cat || '', days: e.days }); }
  else return false;
  return true;
});

/* ---------- sur l'accueil ---------- */
export function blocAccueil(){
  const liste = actifs(); if(!liste.length) return '';
  const k = ymd(new Date()), restants = liste.filter(e => !e.log[k]).length;
  return `<section class="eng-accueil"><div class="sec-h"><h2>Mes engagements du jour</h2><span class="n">${restants ? `${restants} à valider` : 'tout est dit'}</span><button class="r" data-onglet="engagements">Tout voir</button></div>
    <div class="eng-liste">${liste.map(e => { const jour = ecart(dateLongue(e.start), new Date()) + 1; return `<div class="eng-mini" style="--c:${couleur(e)}">
      <span class="dot"></span><p><b>${esc(e.title)}</b><small>Jour ${jour} sur ${e.days}</small></p>
      <button class="choix ok ${e.log[k] === 'ok' ? 'on' : ''}" data-eng-j="${e.id}:${k}:ok">${I.check}Tenu</button>
      <button class="choix ko ${e.log[k] === 'ko' ? 'on' : ''}" data-eng-j="${e.id}:${k}:ko">Pas tenu</button></div>`; }).join('')}</div></section>`;
}
