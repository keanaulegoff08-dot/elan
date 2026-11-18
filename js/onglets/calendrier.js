// Onglet « Calendrier » : année, mois, semaine, jour ; événements ; rêves et tâches avec leurs couleurs ;
// chaque mois est introduit par un fond illustré de saison.
import { I } from '../noyau/icones.js';
import { pad, ymd, sod, addDays, monday, isoWeek, MOIS, JOURS, cap, dShort, hm } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast, dateLongue } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { domaine } from '../noyau/domaines.js';
import { changer, fondParId } from '../fonds/moteur.js';
import { fondDuMois } from '../fonds/tirage.js';
import { monter } from '../fonds/moteur.js';
import { LIEUX } from '../fonds/lieux.js';
import { catOf, ouvrirTache } from './taches.js';
import { grille, apresRendu, panneau, ouvrirModale, supprimer, toucheBloc, majMaintenant, suivreJour, couleurEv, titreEv, tacheDe, dansGrille, hauteur, ZOOMS, choisir, apresDessin, definirVue, astuceMois } from './agenda.js';

const ui = { vue: 'mois', date: sod(new Date()) };
const render = () => app.rendre();
let bandeau = null, fondMonte = null, animMontee = null;

export function entrer(p){ if(p && p.jour){ ui.date = dateLongue(p.jour); ui.vue = 'jour'; } }

/* ---------- ce qui tombe un jour donné ---------- */
// Renvoie { 'AAAA-MM-JJ': [ { type, id, titre, heure, c, fait } ] } pour une plage de dates.
export function elements(debut, fin){
  const out = {}, a = ymd(debut), b = ymd(fin);
  const mettre = (k, x) => { if(k >= a && k <= b) (out[k] = out[k] || []).push(x); };
  for(const r of S.dreams) if(r.deadline) mettre(r.deadline, { type: 'reve', id: r.id, titre: r.title, c: domaine(r.domain).c, fait: !!r.achievedAt, heure: '' });
  for(const ev of S.events){
    const d0 = ev.date, d1 = ev.end && ev.end > ev.date ? ev.end : ev.date;
    const t = tacheDe(ev), g = dansGrille(ev);
    for(let d = dateLongue(d0); ymd(d) <= d1; d = addDays(d, 1)) mettre(ymd(d), { type: 'evenement', id: ev.id, titre: titreEv(ev), heure: ev.allDay ? '' : (ev.time || ''), fin: ev.timeEnd || '', c: couleurEv(ev), fait: !!(t && t.done), grille: g });
  }
  for(const t of S.tasks){
    if(!t.deadline || t.dropped || (t.archived && !t.done)) continue;
    const d = new Date(t.deadline), c = catOf(t.cat);
    mettre(ymd(d), { type: 'tache', id: t.id, titre: t.title, heure: (d.getHours() === 23 && d.getMinutes() === 59) ? '' : hm(d), c: c ? c.color : 'var(--ink-3)', fait: t.done, urgent: t.urgent && !t.done });
  }
  const ordre = { reve: 0, evenement: 1, tache: 2 };
  for(const k in out) out[k].sort((x, y) => (x.heure || '').localeCompare(y.heure || '') || ordre[x.type] - ordre[y.type]);
  return out;
}
// Pastilles du mois compact de la barre latérale.
export function marques(ref = new Date()){
  const e = elements(new Date(ref.getFullYear(), ref.getMonth(), 1), new Date(ref.getFullYear(), ref.getMonth() + 1, 0)), m = {};
  for(const k in e){ const x = e[k].find(i => i.type === 'reve') || e[k].find(i => !i.fait); if(x) m[k] = x.c; }
  return m;
}
const puce = x => `<button class="cal-el ${x.type} ${x.fait ? 'fait' : ''} ${x.urgent ? 'urgent' : ''}" data-cal-el="${x.type}:${x.id}" style="--c:${x.c}" title="${esc(x.titre)}">${x.heure ? `<span class="tab">${x.heure}</span>` : ''}<span>${esc(x.titre)}</span></button>`;

/* ---------- vues ---------- */
// Vue Année : douze cartes, une par mois. Chacune montre sa destination, sa grille de jours,
// les rêves fixés, les événements et les tâches datées encore à faire.
const AN_MAX = 5;
function vueAnnee(){
  const y = ui.date.getFullYear(), now = new Date(), auj = ymd(now), moisAuj = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const el = elements(new Date(y, 0, 1), new Date(y, 11, 31));
  const pluriel = (n, mot) => `<b class="tab">${n}</b> ${mot}${n > 1 ? 's' : ''}`;
  let cartes = '';
  for(let m = 0; m < 12; m++){
    const cle = `${y}-${pad(m + 1)}`, nbJours = new Date(y, m + 1, 0).getDate();
    const idF = fondDuMois(y, m), fiche = idF && fondParId(idF), lieu = fiche ? ((LIEUX[idF] && LIEUX[idF].lieu) || fiche.nom) : '';
    let grille = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span>${l}</span>`).join('') + '<i class="an-j vide"></i>'.repeat((new Date(y, m, 1).getDay() + 6) % 7);
    const tout = [];
    for(let j = 1; j <= nbJours; j++){
      const k = `${cle}-${pad(j)}`, liste = el[k] || [];
      liste.forEach(x => tout.push({ ...x, j }));
      const reve = liste.find(x => x.type === 'reve' && !x.fait), marque = reve || liste.find(x => !x.fait);
      grille += `<button class="an-j ${k === auj ? 'auj' : ''} ${reve ? 'reve' : marque ? 'el' : ''}" data-cal-ouvrir="${k}" ${marque ? `style="--c:${marque.c}"` : ''} ${marque ? `title="${esc(marque.titre)}"` : ''}>${j}</button>`;
    }
    // un événement de plusieurs jours ne compte qu'une fois, à son premier jour
    const vus = new Set(), uniques = tout.filter(x => { const c = x.type + ':' + x.id; if(vus.has(c)) return false; vus.add(c); return true; });
    const reves = uniques.filter(x => x.type === 'reve'), evs = uniques.filter(x => x.type === 'evenement'), taches = uniques.filter(x => x.type === 'tache');
    const ouvertes = taches.filter(x => !x.fait), faites = taches.length - ouvertes.length;
    const visibles = [...reves, ...[...evs, ...ouvertes].sort((a, b) => a.j - b.j)], montres = visibles.slice(0, AN_MAX);
    const ligne = x => `<button class="cal-el ${x.type} ${x.fait ? 'fait' : ''} ${x.urgent ? 'urgent' : ''}" data-cal-el="${x.type}:${x.id}" style="--c:${x.c}" title="${esc(x.titre)}"><span class="tab">${x.j}</span><span>${esc(x.titre)}</span></button>`;
    const pied = [reves.length && `<span class="r">${pluriel(reves.length, 'rêve')}</span>`, ouvertes.length && `<span>${pluriel(ouvertes.length, 'tâche')} à faire</span>`, evs.length && `<span>${pluriel(evs.length, 'événement')}</span>`, faites && `<span>${pluriel(faites, 'faite')}</span>`].filter(Boolean).join('');
    cartes += `<article class="an-mois ${cle === moisAuj ? 'auj' : cle < moisAuj ? 'passe' : ''}">
      <button class="an-tete" data-cal-mois="${cle}" title="Ouvrir ${MOIS[m]} ${y}"><span class="an-vignette" ${idF ? `data-an-fond="${idF}"` : ''} aria-hidden="true"></span><span class="an-nom">${cap(MOIS[m])}</span><span class="an-lieu">${esc(lieu)}</span></button>
      <div class="an-cal">${grille}</div>
      <div class="an-liste">${montres.map(ligne).join('')}${visibles.length > AN_MAX ? `<button class="cal-suite" data-cal-mois="${cle}">+ ${visibles.length - AN_MAX} autre${visibles.length - AN_MAX > 1 ? 's' : ''}</button>` : ''}${visibles.length ? '' : '<span class="an-rien">Rien de fixé pour ce mois.</span>'}</div>
      ${pied ? `<div class="an-pied">${pied}</div>` : ''}
    </article>`;
  }
  return `<div class="cal-grille annee">${cartes}</div>`;
}
// Les douze vignettes sont montées une à une, puis gardées en mémoire d'un redessin à l'autre.
const vignettes = new Map();
async function monterVignettes(){
  for(const zone of document.querySelectorAll('.an-vignette[data-an-fond]')){
    if(!zone.isConnected) return;
    const id = zone.dataset.anFond, cle = zone.closest('.an-tete').dataset.calMois + ':' + id;
    let v = vignettes.get(cle);
    if(v){ zone.appendChild(v); continue; }
    try{ v = await monter(zone, id, { anim: false }); vignettes.set(cle, v); }catch(e){}
    await new Promise(r => requestAnimationFrame(r));
  }
}
function vueMois(){
  const y = ui.date.getFullYear(), m = ui.date.getMonth(), auj = ymd(new Date());
  const d0 = monday(new Date(y, m, 1)), fin = new Date(y, m + 1, 0);
  const el = elements(d0, addDays(monday(fin), 6));
  let rows = '';
  for(let d = d0; d <= fin; d = addDays(d, 7)){
    let c = `<div class="cal-sem tab">${isoWeek(d)}</div>`;
    for(let i = 0; i < 7; i++){
      const j = addDays(d, i), k = ymd(j), liste = el[k] || [], hors = j.getMonth() !== m;
      c += `<div class="cal-jour ${hors ? 'hors' : ''} ${k === auj ? 'auj' : ''} ${i > 4 ? 'we' : ''}" data-cal-jour="${k}">
        <div class="cal-n"><b class="tab">${j.getDate()}</b><button class="cal-plus" data-cal-nouveau="${k}" title="Nouvel événement">${I.plus}</button></div>
        ${liste.slice(0, 3).map(puce).join('')}${liste.length > 3 ? `<button class="cal-suite" data-cal-ouvrir="${k}">+ ${liste.length - 3}</button>` : ''}</div>`;
    }
    rows += `<div class="cal-rang">${c}</div>`;
  }
  return `<div class="cal-grille mois"><div class="cal-rang tete"><div class="cal-sem">S</div>${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(n => `<div>${n}</div>`).join('')}</div>${rows}</div>${astuceMois()}`;
}
// Semaine et Jour : la grille horaire de l'agenda (agenda.js).
const joursAffiches = () => ui.vue === 'jour' ? [ui.date] : Array.from({ length: 7 }, (_, i) => addDays(monday(ui.date), i));
definirVue(() => {
  if(ui.vue === 'mois'){ const y = ui.date.getFullYear(), m = ui.date.getMonth(); return { debut: ymd(new Date(y, m, 1)), fin: ymd(new Date(y, m + 1, 0)) }; }
  if(ui.vue === 'annee') return null;
  const j = joursAffiches(); return { debut: ymd(j[0]), fin: ymd(j[j.length - 1]) };
});
suivreJour(() => ui.vue === 'jour' ? ui.date : (ymd(monday(new Date())) === ymd(monday(ui.date)) ? new Date() : monday(ui.date)));

export function rendre(vue){
  const y = ui.date.getFullYear(), m = ui.date.getMonth();
  const s0 = monday(ui.date), s1 = addDays(s0, 6);
  const maintenant = new Date();
  const agenda = ui.vue === 'semaine' || ui.vue === 'jour', avecPanneau = ui.vue !== 'annee' && !!S.settings.calendrier.panneau;
  const unite = { annee: 'Année', mois: 'Mois', semaine: 'Semaine', jour: 'Jour' }[ui.vue];
  const precedent = `${unite} précédent${ui.vue === 'annee' || ui.vue === 'semaine' ? 'e' : ''} (←)`, suivant = `${unite} suivant${ui.vue === 'annee' || ui.vue === 'semaine' ? 'e' : ''} (→)`;
  const titre = ui.vue === 'annee' ? `${y}` : ui.vue === 'mois' ? `<em>${cap(MOIS[m])}</em> ${y}` : ui.vue === 'semaine' ? `<em>Semaine ${isoWeek(ui.date)}</em> · ${dShort(s0)} → ${dShort(s1)}` : `<em>${cap(JOURS[ui.date.getDay()])} ${ui.date.getDate()}</em> ${MOIS[m]} ${y}`;
  // En vue Année, le bandeau montre la destination du mois en cours (ou de janvier pour une autre année).
  const idFond = ui.vue === 'annee' ? fondDuMois(y, y === maintenant.getFullYear() ? maintenant.getMonth() : 0) : fondDuMois(y, m), fiche = idFond && fondParId(idFond);
  vue.innerHTML = `
    <div class="cal ${ui.vue}">
      <div id="calFente"></div>
      <div class="cal-tete">
        <div><div class="cal-lieu">${ui.vue === 'annee' ? "L'année en douze escales" : fiche ? esc(fiche.nom) : ''}</div><h1>${titre}</h1></div>
        <div class="cal-outils">
          <div class="pilule fleches"><button data-cal-pas="-1" aria-label="${precedent}" title="${precedent}">${I.gauche}</button><button data-cal-pas="1" aria-label="${suivant}" title="${suivant}">${I.chev}</button></div>
          <div class="pilule seg-v">${[['annee', 'Année'], ['mois', 'Mois'], ['semaine', 'Semaine'], ['jour', 'Jour']].map(([v, l]) => `<button data-cal-vue="${v}" class="${ui.vue === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${agenda ? `<div class="pilule zoom"><button data-ag-zoom="-1" aria-label="Resserrer les heures" title="Resserrer les heures" ${hauteur() <= ZOOMS[0] ? 'disabled' : ''}>−</button><button data-ag-zoom="1" aria-label="Espacer les heures" title="Espacer les heures" ${hauteur() >= ZOOMS[ZOOMS.length - 1] ? 'disabled' : ''}>+</button></div>` : ''}
          ${ui.vue !== 'annee' ? `<button class="pilule seul ${avecPanneau ? 'on' : ''}" data-ag-panneau aria-pressed="${avecPanneau}">${I.taches}Mes tâches</button>` : ''}
          <button class="pilule seul ${agenda && avecPanneau ? 'rond' : ''}" data-cal-nouveau="${ymd(ui.vue === 'jour' ? ui.date : new Date())}" title="Nouvel événement" aria-label="Nouvel événement">${I.plus}<span>Événement</span></button>
        </div>
      </div>
      <div class="cal-zone ${avecPanneau ? 'avec-panneau' : ''}">
        <div class="verre">${ui.vue === 'annee' ? vueAnnee() : ui.vue === 'mois' ? vueMois() : grille(joursAffiches(), elements, puce)}</div>
        ${avecPanneau ? panneau() : ''}
      </div>
    </div>`;
  // Le bandeau illustré survit aux redessins : il n'est remonté que si le mois (donc le fond) change.
  if(!bandeau){ bandeau = document.createElement('div'); bandeau.className = 'cal-bandeau'; bandeau.setAttribute('aria-hidden', 'true'); }
  $('#calFente').replaceWith(bandeau);
  const anim = S.settings.calendrier.anim !== false;
  if(idFond && (fondMonte !== idFond || animMontee !== anim)){
    fondMonte = idFond; animMontee = anim;
    changer(bandeau, idFond, { anim, fondu: 1.2 }).catch(() => {});
  }
  if(agenda) apresRendu(joursAffiches());
  apresDessin();
  if(ui.vue === 'annee'){
    monterVignettes();
    // À l'ouverture de l'année en cours, le mois du jour vient se placer à l'écran.
    // (après le redessin général, qui remet le défilement à sa place)
    if(ui.centrer){ ui.centrer = false; requestAnimationFrame(() => { const m = vue.querySelector('.an-mois.auj'), main = $('#main'); if(m) main.scrollTop = Math.max(0, m.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - (main.clientHeight - m.offsetHeight) / 2); }); }
  }
}
export function quitter(){ /* le bandeau reste en mémoire : pas de rechargement au retour */ }
export const oublierFond = () => { fondMonte = null; };

/* ---------- événements ---------- */
const fermer = () => $('#modal').classList.remove('show');
export function rafraichir(){ if(ui.vue === 'semaine' || ui.vue === 'jour'){ if(!document.querySelector('.ag-col.auj') && joursAffiches().some(j => ymd(j) === ymd(new Date()))) render(); else majMaintenant(); } }

function deplacer(pas){
  const d = new Date(ui.date);
  if(ui.vue === 'annee') d.setFullYear(d.getFullYear() + pas, d.getMonth(), 1); else if(ui.vue === 'mois') d.setMonth(d.getMonth() + pas, 1); else d.setDate(d.getDate() + pas * (ui.vue === 'semaine' ? 7 : 1));
  ui.date = sod(d); render();
}
export function touche(e){
  if(toucheBloc(e)) return true;
  if(e.key === 'ArrowLeft'){ deplacer(-1); return true; }
  if(e.key === 'ArrowRight'){ deplacer(1); return true; }
  const v = { a: 'annee', m: 'mois', s: 'semaine', j: 'jour' }[e.key.toLowerCase()]; if(v === 'annee' && ui.vue !== 'annee') ui.centrer = true; if(v){ ui.vue = v; render(); return true; }
  if(e.key.toLowerCase() === 't'){ ui.date = sod(new Date()); render(); return true; }
  return false;
}
app.clics.push((e) => {
  const tg = e.target.closest('[data-cal-pas],[data-cal-auj],[data-cal-vue],[data-cal-mois],[data-cal-nouveau],[data-cal-ouvrir],[data-cal-el],[data-cal-suppr],[data-cal-fermer]'); if(!tg) return false;
  const d = tg.dataset;
  if(d.calPas){ deplacer(+d.calPas); return true; }
  if(d.calAuj !== undefined){ ui.date = sod(new Date()); render(); return true; }
  if(d.calVue){ ui.centrer = d.calVue === 'annee' && ui.vue !== 'annee'; ui.vue = d.calVue; render(); return true; }
  if(d.calMois){ const [a, mo] = d.calMois.split('-').map(Number); ui.date = new Date(a, mo - 1, 1); ui.vue = 'mois'; $('#main').scrollTop = 0; render(); return true; }
  if(d.calNouveau){ ouvrirModale({ date: d.calNouveau }); return true; }
  if(d.calOuvrir){ ui.date = dateLongue(d.calOuvrir); ui.vue = 'jour'; if(app.onglet !== 'calendrier') app.aller('calendrier'); else render(); return true; }
  if(d.calEl){
    const [type, id] = d.calEl.split(':');
    if(type === 'tache') ouvrirTache(id);
    else if(type === 'reve') app.aller('reves', { id });
    else { choisir(id, e.shiftKey || e.metaKey); tg.focus({ preventScroll: true }); }
    return true;
  }
  if(d.calSuppr){ supprimer(d.calSuppr); return true; }
  if(d.calFermer !== undefined){ fermer(); return true; }
  return false;
});
