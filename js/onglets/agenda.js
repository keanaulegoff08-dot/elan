// Agenda du calendrier (vues Semaine et Jour) : une grille horaire au pas de 5 minutes, comme un carnet de vol.
// On y dessine un créneau en glissant, on déplace ou on étire un bloc, on y dépose une tâche depuis le panneau « Mes tâches ».
// Les couleurs des événements sont celles des catégories de tâches.
//   événement : { id, title, date, end, time, timeEnd, allDay, notes, cat, taskId }
//   (une fin à minuit est rangée « 23:59 », lue comme 24:00)
import { I } from '../noyau/icones.js';
import { pad, ymd, sod, addDays, JOURS, MOIS_C, cap } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast, dateLongue } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { catOf, isStale, ouvrirTache, toggleDone } from './taches.js';

const render = () => app.rendre();
export const PAS = 5;
export const ZOOMS = [40, 56, 72, 96, 128, 168];   // hauteur d'une heure, en pixels
export const ag = { defile: null, recherche: '', cat: null };

/* ---------- minutes et heures ---------- */
const reglages = () => S.settings.calendrier;
export const hauteur = () => reglages().zoom || 72;
const pxMin = () => hauteur() / 60;
const borne = (v, a, b) => Math.min(b, Math.max(a, v));
const arrondir = m => Math.round(m / PAS) * PAS;
export const enMin = s => { if(!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const affiche = m => m >= 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const stocke = m => m >= 1440 ? '23:59' : affiche(m);
export const dureeTexte = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + pad(m % 60) : ''}`;
export function finMin(ev){
  const d = enMin(ev.time);
  if(!ev.timeEnd) return Math.min(1440, d + 60);
  const f = ev.timeEnd === '23:59' ? 1440 : enMin(ev.timeEnd);
  return f > d ? f : 1440;
}

/* ---------- événements ---------- */
export const tacheDe = ev => ev.taskId ? S.tasks.find(t => t.id === ev.taskId) : null;
export const titreEv = ev => { const t = tacheDe(ev); return ev.title || (t && t.title) || 'Sans titre'; };
export function couleurEv(ev){
  const t = tacheDe(ev), c = catOf(ev.cat || (t && t.cat));
  return c ? c.color : 'var(--accent)';
}
// Un événement entre dans la grille s'il a une heure et tient sur une journée.
export const dansGrille = ev => !ev.allDay && !!ev.time && (!ev.end || ev.end <= ev.date);
// Durée estimée d'une tâche : la somme de ses sous-tâches minutées, sinon 30 minutes.
export function estimation(t){
  const m = (t.subtasks || []).filter(s => !s.done).reduce((a, s) => a + (+s.min || 0), 0);
  return borne(arrondir(m || 30), 5, 240);
}
// Prochain créneau prévu pour une tâche (pour le panneau).
function prochainCreneau(t){
  const auj = ymd(new Date());
  const evs = S.events.filter(e => e.taskId === t.id && (e.end || e.date) >= auj).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  if(!evs.length) return '';
  const e = evs[0], d = dateLongue(e.date), jour = e.date === auj ? "aujourd'hui" : e.date === ymd(addDays(new Date(), 1)) ? 'demain' : `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()}`;
  return `${jour}${e.time && !e.allDay ? ' · ' + e.time : ''}`;
}

/* ---------- disposition des blocs qui se chevauchent ---------- */
function disposer(evs){
  const mini = 20 / pxMin();
  const items = evs.map(ev => { const d = enMin(ev.time), f = finMin(ev); return { ev, d, f, fv: Math.max(f, d + mini) }; }).sort((a, b) => a.d - b.d || b.f - a.f);
  const grappes = []; let g = [], finG = -1;
  for(const it of items){ if(g.length && it.d >= finG){ grappes.push(g); g = []; finG = -1; } g.push(it); finG = Math.max(finG, it.fv); }
  if(g.length) grappes.push(g);
  for(const gr of grappes){
    const cols = [];
    for(const it of gr){ let i = cols.findIndex(f => f <= it.d); if(i < 0){ i = cols.length; cols.push(0); } cols[i] = it.fv; it.col = i; }
    gr.forEach(it => { it.n = cols.length; });
  }
  return items;
}
function bloc(it){
  const ev = it.ev, t = tacheDe(ev), px = pxMin(), h = Math.max((it.f - it.d) * px, 18), titre = titreEv(ev);
  const forme = h < 36 ? 'court' : h < 50 ? 'moyen' : '';
  // Chevauchement : chaque bloc qui commence pendant un autre se décale vers la droite, en cascade.
  const decale = Math.min(it.col * 24, 60);
  return `<div class="ag-ev ${forme} ${t ? 'lie' : ''} ${t && t.done ? 'fait' : ''} ${choix.has(ev.id) ? 'choisi' : ''}" data-ag-ev="${ev.id}" tabindex="0" role="button"
    aria-label="${esc(titre)}, ${affiche(it.d)} à ${affiche(it.f)}" title="${esc(titre)} · ${affiche(it.d)} – ${affiche(it.f)}"
    style="--c:${couleurEv(ev)};top:${it.d * px}px;height:${h}px;left:${decale}%;width:calc(${100 - decale}% - 4px);z-index:${2 + it.col}">
    ${t ? `<button class="ag-coche" data-ag-coche="${t.id}" title="${t.done ? 'Remettre à faire' : 'Marquer la tâche comme faite'}" aria-label="${t.done ? 'Remettre à faire' : 'Marquer la tâche comme faite'}">${I.check}</button>` : ''}
    <span class="ag-ev-t">${esc(titre)}</span><span class="ag-ev-h tab">${affiche(it.d)} – ${affiche(it.f)}</span>
    <span class="ag-poignee" data-ag-poignee aria-hidden="true"></span></div>`;
}
const maintenantMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

/* ---------- la grille ---------- */
// jours : tableau de dates ; elements : fonction du calendrier ; puce : rendu d'un élément de journée.
export function grille(jours, elements, puce){
  const auj = ymd(new Date()), px = pxMin(), H = hauteur(), seul = jours.length === 1;
  const el = elements(jours[0], jours[jours.length - 1]);
  const tete = seul ? '' : `<div class="ag-tete"><div class="ag-gout"></div>${jours.map(j => { const k = ymd(j); return `<button class="ag-jt ${k === auj ? 'auj' : ''} ${j.getDay() % 6 === 0 ? 'we' : ''}" data-cal-ouvrir="${k}" title="Ouvrir ce jour"><span>${cap(JOURS[j.getDay()]).slice(0, 3)}.</span><b class="tab">${j.getDate()}</b></button>`; }).join('')}</div>`;
  const journee = `<div class="ag-journee"><div class="ag-gout"><span>journée</span></div>${jours.map(j => {
    const k = ymd(j), liste = (el[k] || []).filter(x => !(x.type === 'evenement' && x.grille)), max = seul ? 99 : 3;
    return `<div class="ag-jcell ${j.getDay() % 6 === 0 ? 'we' : ''}" data-ag-jour="${k}">${liste.slice(0, max).map(puce).join('')}${liste.length > max ? `<button class="cal-suite" data-cal-ouvrir="${k}">+ ${liste.length - max}</button>` : ''}</div>`;
  }).join('')}</div>`;
  let heures = '';
  for(let h = 1; h < 24; h++) heures += `<span class="ag-h tab" style="top:${h * H}px">${pad(h)}:00</span>`;
  const cols = jours.map(j => {
    const k = ymd(j), evs = S.events.filter(e => e.date === k && dansGrille(e));
    return `<div class="ag-col ${k === auj ? 'auj' : ''} ${j.getDay() % 6 === 0 ? 'we' : ''} ${k < auj ? 'passe' : ''}" data-ag-jour="${k}">${disposer(evs).map(bloc).join('')}${k === auj ? `<div class="ag-maint" style="top:${maintenantMin() * px}px" aria-hidden="true"></div>` : ''}</div>`;
  }).join('');
  const aujVu = jours.some(j => ymd(j) === auj);
  return `<div class="ag ${seul ? 'seul' : ''}" style="--h:${H}px;--n:${jours.length}">
    ${tete}${journee}
    <div class="ag-corps" id="agCorps"><div class="ag-grille" style="height:${24 * H}px">
      <div class="ag-heures">${heures}${aujVu ? `<span class="ag-maint-h tab" style="top:${maintenantMin() * px}px">${affiche(maintenantMin())}</span>` : ''}</div>${cols}
    </div></div>
    ${ASTUCE}
  </div>`;
}
// Après chaque dessin : hauteur ajustée à la fenêtre, défilement retrouvé.
export function apresRendu(jours){
  const corps = $('#agCorps'); if(!corps) return;
  ajuster();
  const px = pxMin();
  if(ag.defile === null){
    const voitAuj = jours.some(j => ymd(j) === ymd(new Date()));
    ag.defile = voitAuj ? Math.max(0, maintenantMin() - 120) : 7 * 60;
  }
  corps.scrollTop = ag.defile * px;
  corps.addEventListener('scroll', () => { ag.defile = corps.scrollTop / pxMin(); }, { passive: true });
}
function ajuster(){
  const corps = $('#agCorps'); if(!corps) return;
  const main = $('#main'), haut = corps.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  const astuce = corps.parentElement.querySelector('.ag-astuce');
  corps.style.height = Math.max(340, main.clientHeight - haut - (astuce ? astuce.offsetHeight : 0) - 34) + 'px';
}
addEventListener('resize', ajuster);
export function majMaintenant(){
  const m = maintenantMin(), px = pxMin();
  document.querySelectorAll('.ag-maint,.ag-maint-h').forEach(x => { x.style.top = m * px + 'px'; if(x.classList.contains('ag-maint-h')) x.textContent = affiche(m); });
}

/* ---------- pointeur ---------- */
let avale = false;   // après un glissé, le clic qui suit ne doit rien ouvrir
document.addEventListener('click', e => { if(avale){ e.stopPropagation(); e.preventDefault(); } }, true);
const avaler = () => { avale = true; setTimeout(() => { avale = false; }, 60); };

function suivre(e, bouge, fin){
  const x0 = e.clientX, y0 = e.clientY, corps = $('#agCorps');
  let dernier = e, actif = false, raf = 0;
  const defiler = () => {
    if(actif && corps && corps.isConnected){
      const r = corps.getBoundingClientRect(), y = dernier.clientY, x = dernier.clientX;
      let v = 0;
      if(x > r.left && x < r.right){ if(y < r.top + 36) v = -Math.ceil((r.top + 36 - y) / 3); else if(y > r.bottom - 36) v = Math.ceil((y - r.bottom + 36) / 3); }
      if(v){ const avant = corps.scrollTop; corps.scrollTop += v; if(corps.scrollTop !== avant) bouge(dernier, dernier.clientY - y0, dernier.clientX - x0); }
    }
    raf = requestAnimationFrame(defiler);
  };
  raf = requestAnimationFrame(defiler);
  const mv = ev => { dernier = ev; if(bouge(ev, ev.clientY - y0, ev.clientX - x0)) actif = true; };
  const up = ev => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    document.body.classList.remove('ag-glisse');
    fin(ev, actif, ev.type === 'pointercancel');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
const minuteSous = (col, y) => (y - col.getBoundingClientRect().top) / pxMin();
const colonneSous = x => Array.from(document.querySelectorAll('.ag-col')).find(c => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; });
const jourTexte = k => { const d = dateLongue(k); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS_C[d.getMonth()]}`; };

// Dessiner un créneau dans le vide
function creer(e, col){
  e.preventDefault();
  const m0 = borne(Math.floor(minuteSous(col, e.clientY) / PAS) * PAS, 0, 1435);
  let fant = null, a = m0, b = m0 + PAS;
  suivre(e, (p, dy) => {
    if(!fant && Math.abs(dy) < 4) return false;
    if(!fant){ fant = document.createElement('div'); fant.className = 'ag-ev fantome'; col.appendChild(fant); document.body.classList.add('ag-glisse'); }
    const m = borne(arrondir(minuteSous(col, p.clientY)), 0, 1440);
    a = Math.min(m0, m); b = Math.max(m0 + (m >= m0 ? PAS : 0), m); if(b - a < PAS) b = a + PAS;
    const px = pxMin();
    fant.style.top = a * px + 'px'; fant.style.height = (b - a) * px + 'px';
    fant.innerHTML = `<span class="ag-ev-t">Nouvel événement</span><span class="ag-ev-h tab">${affiche(a)} – ${affiche(b)} · ${dureeTexte(b - a)}</span>`;
    return true;
  }, (p, actif, annule) => {
    if(!fant){ if(!annule){ choix.clear(); viserJour(col.dataset.agJour); marquerChoix(); } return; }
    avaler();
    setTimeout(() => fant.remove(), 200);
    if(!annule) ouvrirModale({ date: col.dataset.agJour, time: stocke(a), timeEnd: stocke(b) });
  });
}
// Déplacer un bloc (d'un jour à l'autre aussi) ou l'étirer par le bas
function saisir(e, el, mode){
  const ev = S.events.find(x => x.id === el.dataset.agEv); if(!ev) return;
  e.preventDefault();
  const d0 = enMin(ev.time), f0 = finMin(ev), duree = f0 - d0, col0 = el.parentElement;
  const prise = minuteSous(col0, e.clientY) - d0;
  let cible = col0, d = d0, f = f0, place = false;
  suivre(e, (p, dy, dx) => {
    if(!place && Math.hypot(dx, dy) < 4) return false;
    if(!place){ place = true; el.classList.add('saisi', mode); document.body.classList.add('ag-glisse'); el.style.left = '0'; el.style.width = 'calc(100% - 4px)'; }
    if(mode === 'taille') f = borne(arrondir(minuteSous(col0, p.clientY)), d + PAS, 1440);
    else {
      const c = colonneSous(p.clientX);
      if(c && c !== cible){ cible = c; c.appendChild(el); }
      d = borne(arrondir(minuteSous(cible, p.clientY) - prise), 0, 1440 - duree); f = d + duree;
    }
    const px = pxMin();
    el.style.top = d * px + 'px'; el.style.height = Math.max((f - d) * px, 18) + 'px';
    el.classList.toggle('court', (f - d) * px < 36);
    el.querySelector('.ag-ev-h').textContent = `${affiche(d)} – ${affiche(f)} · ${dureeTexte(f - d)}`;
    return true;
  }, (p, actif, annule) => {
    if(!place) return;
    avaler();
    if(annule || (d === d0 && f === f0 && cible === col0)){ render(); return; }
    const avant = { date: ev.date, time: ev.time, timeEnd: ev.timeEnd };
    Object.assign(ev, { date: cible.dataset.agJour, time: stocke(d), timeEnd: stocke(f), allDay: false });
    save(); render();
    toast(mode === 'taille' ? `${titreEv(ev)} : ${dureeTexte(f - d)}` : `Déplacé ${ev.date === avant.date ? 'à' : `au ${jourTexte(ev.date)},`} ${affiche(d)}`, () => { Object.assign(ev, avant); save(); render(); });
  });
}
// Porter une tâche du panneau vers la grille (un créneau) ou vers une case de jour (toute la journée)
function porter(e, item){
  const t = S.tasks.find(x => x.id === item.dataset.agTache); if(!t) return;
  if(e.target.closest('button')) return;
  e.preventDefault();
  const duree = estimation(t), c = (catOf(t.cat) || {}).color || 'var(--accent)';
  let fant = null, apercu = null, col = null, jour = null, m = 0;
  const nettoyer = () => { document.querySelectorAll('.ag-vise').forEach(x => x.classList.remove('ag-vise')); };
  suivre(e, (p, dy, dx) => {
    if(!fant && Math.hypot(dx, dy) < 5) return false;
    if(!fant){
      fant = document.createElement('div'); fant.className = 'ag-porte'; fant.style.setProperty('--c', c);
      fant.innerHTML = `<span class="dot"></span>${esc(t.title)}<small>${dureeTexte(duree)}</small>`;
      document.body.appendChild(fant); document.body.classList.add('ag-glisse'); item.classList.add('porte');
    }
    fant.style.transform = `translate(${p.clientX + 14}px,${p.clientY + 10}px)`;
    const sous = document.elementFromPoint(p.clientX, p.clientY);
    nettoyer();
    col = sous && sous.closest('.ag-col');
    jour = !col && sous ? sous.closest('.ag-jcell,.cal-jour') : null;
    if(col){
      m = borne(arrondir(minuteSous(col, p.clientY) - Math.min(duree / 2, 15)), 0, 1440 - duree);
      if(!apercu){ apercu = document.createElement('div'); apercu.className = 'ag-ev apercu'; apercu.style.setProperty('--c', c); }
      if(apercu.parentElement !== col) col.appendChild(apercu);
      const px = pxMin();
      apercu.style.top = m * px + 'px'; apercu.style.height = Math.max(duree * px, 18) + 'px';
      apercu.classList.toggle('court', duree * px < 36);
      apercu.innerHTML = `<span class="ag-ev-t">${esc(t.title)}</span><span class="ag-ev-h tab">${affiche(m)} – ${affiche(m + duree)}</span>`;
      fant.classList.add('cache');
    } else {
      if(apercu) apercu.remove();
      fant.classList.remove('cache');
      if(jour) jour.classList.add('ag-vise');
    }
    return true;
  }, (p, actif, annule) => {
    nettoyer(); if(apercu) apercu.remove(); if(fant) fant.remove(); item.classList.remove('porte');
    if(!fant) return;
    avaler();
    if(annule) return;
    if(col) planifier(t, { date: col.dataset.agJour, time: stocke(m), timeEnd: stocke(m + duree), allDay: false });
    else if(jour) planifier(t, { date: jour.dataset.agJour || jour.dataset.calJour, time: '', timeEnd: '', allDay: true });
  });
}
export function planifier(t, o){
  const ev = { id: uid(), title: t.title, cat: t.cat || null, taskId: t.id, notes: '', end: null, ...o };
  S.events.push(ev); save(); render();
  const nom = t.title.length > 38 ? t.title.slice(0, 37) + '…' : t.title;
  toast(`« ${nom} » prévue ${ymd(new Date()) === ev.date ? "aujourd'hui" : 'le ' + jourTexte(ev.date)}${ev.allDay ? '' : ' à ' + ev.time}`, () => { const i = S.events.indexOf(ev); if(i >= 0) S.events.splice(i, 1); save(); render(); });
}

document.addEventListener('pointerdown', e => {
  if(e.button !== 0 || app.onglet !== 'calendrier') return;
  const tache = e.target.closest('[data-ag-tache]'); if(tache){ porter(e, tache); return; }
  const col = e.target.closest('.ag-col'); if(!col || e.target.closest('.ag-coche')) return;
  const b = e.target.closest('[data-ag-ev]');
  if(b) saisir(e, b, e.target.closest('[data-ag-poignee]') ? 'taille' : 'deplacer');
  else creer(e, col);
});
// Double-clic dans le vide : un créneau de 30 minutes à cet endroit.
document.addEventListener('dblclick', e => {
  if(app.onglet !== 'calendrier') return;
  const b = e.target.closest('[data-ag-ev]'), el = e.target.closest('.cal-el.evenement');
  if(b || el){ if(e.target.closest('.ag-coche')) return; const ev = S.events.find(x => x.id === (b ? b.dataset.agEv : el.dataset.calEl.split(':')[1])); if(ev) ouvrirModale(ev); return; }
  const col = e.target.closest('.ag-col'); if(!col) return;
  const m = borne(Math.floor(minuteSous(col, e.clientY) / 15) * 15, 0, 1410);
  ouvrirModale({ date: col.dataset.agJour, time: stocke(m), timeEnd: stocke(m + 30) });
});
// Clavier sur un bloc : ↑ ↓ le déplacent de 5 minutes, ⇧ ↑ ↓ changent sa fin, Entrée l'ouvre, ⌫ le supprime.
export function toucheBloc(e){
  if((e.key === 'Backspace' || e.key === 'Delete') && choix.size > 1){ e.preventDefault(); supprimerChoix(); return true; }
  const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-ag-ev]');
  if(!el){ if((e.key === 'Backspace' || e.key === 'Delete') && choix.size){ e.preventDefault(); supprimerChoix(); return true; } return false; }
  const ev = S.events.find(x => x.id === el.dataset.agEv); if(!ev) return false;
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); ouvrirModale(ev); return true; }
  if(e.key === 'Backspace' || e.key === 'Delete'){ e.preventDefault(); supprimer(ev.id); return true; }
  if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
  e.preventDefault();
  const s = e.key === 'ArrowUp' ? -PAS : PAS, d = enMin(ev.time), f = finMin(ev);
  if(e.shiftKey){ ev.timeEnd = stocke(borne(f + s, d + PAS, 1440)); }
  else { const n = borne(d + s, 0, 1440 - (f - d)); ev.time = stocke(n); ev.timeEnd = stocke(n + f - d); }
  save(); render();
  const r = document.querySelector(`[data-ag-ev="${ev.id}"]`); if(r) r.focus();
  return true;
}
export function supprimer(id){
  const i = S.events.findIndex(x => x.id === id); if(i < 0) return;
  const ev = S.events.splice(i, 1)[0]; save(); $('#modal').classList.remove('show'); render();
  toast('Événement supprimé', () => { S.events.splice(i, 0, ev); save(); render(); });
}

/* ---------- panneau « Mes tâches » ---------- */
const GROUPES = [['day', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['quarter', 'Ce trimestre'], ['main', 'Liste principale']];
const ouvertes = () => S.tasks.filter(t => !t.archived && !t.done && !t.dropped && !isStale(t));
function listeTaches(){
  const q = ag.recherche.trim().toLowerCase();
  const toutes = ouvertes().filter(t => (!ag.cat || t.cat === ag.cat) && (!q || t.title.toLowerCase().includes(q)));
  if(!toutes.length) return `<p class="ag-p-vide">${ouvertes().length ? 'Aucune tâche ne correspond.' : 'Aucune tâche en cours. Ajoute-en dans « Mes tâches ».'}</p>`;
  return GROUPES.map(([id, nom]) => {
    const l = toutes.filter(t => t.list === id).sort((a, b) => (b.urgent - a.urgent) || (a.deadline || '9').localeCompare(b.deadline || '9'));
    if(!l.length) return '';
    return `<div class="ag-groupe"><h5>${nom}<span class="tab">${l.length}</span></h5>${l.map(t => {
      const c = catOf(t.cat), quand = prochainCreneau(t);
      return `<div class="ag-tache" data-ag-tache="${t.id}" tabindex="0" role="button" style="--c:${c ? c.color : 'var(--ink-3)'}" title="Glisse dans l'agenda pour la planifier, ou appuie sur Entrée">
        <span class="ag-tache-grip" aria-hidden="true">${I.grip}</span>
        <span class="ag-tache-c"><span class="ag-tache-t">${t.urgent ? `<i class="ag-urg">${I.bolt}</i>` : ''}${esc(t.title)}</span>
        <small><span class="dot"></span>${c ? esc(c.name) : 'Sans catégorie'} · ${dureeTexte(estimation(t))}${quand ? ` · <b>prévue ${quand}</b>` : ''}</small></span></div>`;
    }).join('')}</div>`;
  }).join('');
}
export function panneau(){
  const cats = S.categories.filter(c => ouvertes().some(t => t.cat === c.id));
  return `<aside class="ag-panneau" aria-label="Mes tâches">
    <div class="ag-p-tete"><h3>Mes tâches</h3><span class="tab">${ouvertes().length}</span><button class="icon-btn sm" data-ag-panneau title="Fermer le panneau" aria-label="Fermer le panneau">${I.close}</button></div>
    <input class="inp ag-p-cherche" id="agCherche" type="search" placeholder="Chercher une tâche" value="${esc(ag.recherche)}" aria-label="Chercher une tâche">
    ${cats.length > 1 ? `<div class="ag-p-cats"><button class="chip ${!ag.cat ? 'on' : ''}" data-ag-cat="">Toutes</button>${cats.map(c => `<button class="chip ${ag.cat === c.id ? 'on' : ''}" data-ag-cat="${c.id}" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</button>`).join('')}</div>` : ''}
    <div class="ag-p-liste" id="agListe">${listeTaches()}</div>
    <p class="ag-p-astuce">Glisse une tâche sur une heure pour lui réserver un créneau, ou sur une journée.</p>
  </aside>`;
}
document.addEventListener('input', e => { if(e.target.id === 'agCherche'){ ag.recherche = e.target.value; const l = $('#agListe'); if(l) l.innerHTML = listeTaches(); } });
document.addEventListener('keydown', e => {
  const it = e.target.closest && e.target.closest('[data-ag-tache]');
  if(it && e.key === 'Enter'){ e.preventDefault(); proposer(it.dataset.agTache); }
});
// Planifier au clavier : la modale s'ouvre sur le jour affiché, à l'heure ronde qui suit.
let jourAffiche = () => new Date();
export const suivreJour = f => { jourAffiche = f; };
function proposer(id){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  const j = jourAffiche(), auj = ymd(j) === ymd(new Date()), m = auj ? borne(Math.ceil((maintenantMin() + 5) / 30) * 30, 0, 1440 - estimation(t)) : 9 * 60;
  ouvrirModale({ date: ymd(j), time: stocke(m), timeEnd: stocke(m + estimation(t)), taskId: t.id, cat: t.cat, title: t.title });
}

app.clics.push(e => {
  const x = e.target.closest('[data-ag-coche],[data-ag-ev],[data-ag-tache],[data-ag-panneau],[data-ag-zoom],[data-ag-cat],[data-evf],[data-evf-duree],[data-evf-cat]');
  if(!x) return false;
  const d = x.dataset;
  if(d.agCoche){ toggleDone(d.agCoche); return true; }
  if(d.agEv){ choisir(d.agEv, e.shiftKey || e.metaKey); x.focus({ preventScroll: true }); return true; }
  if(d.agTache){ ouvrirTache(d.agTache); return true; }
  if(d.agPanneau !== undefined){ reglages().panneau = !reglages().panneau; save(); render(); return true; }
  if(d.agZoom){
    const i = ZOOMS.indexOf(hauteur()), n = borne((i < 0 ? 2 : i) + +d.agZoom, 0, ZOOMS.length - 1);
    reglages().zoom = ZOOMS[n]; save(); render(); return true;
  }
  if(d.agCat !== undefined){ ag.cat = d.agCat || null; render(); return true; }
  if(d.evf || d.evfDuree || d.evfCat !== undefined){ actionForm(x); return true; }
  return false;
});

/* ---------- la fenêtre d'un événement ---------- */
const RAPIDES = [15, 30, 45, 60, 90, 120];
let br = null, edition = null;
export function ouvrirModale(ev){
  edition = ev.id && S.events.some(x => x.id === ev.id) ? ev.id : null;
  const t = ev.taskId ? S.tasks.find(x => x.id === ev.taskId) : null;
  const n = new Date(), prochaine = Math.min(23 * 60, (n.getHours() + 1) * 60);
  const sansHeure = edition ? (ev.allDay || !ev.time) : !!ev.allDay;
  const debut = ev.time ? enMin(ev.time) : (ev.date === ymd(n) ? prochaine : 9 * 60);
  br = {
    title: ev.title || (t ? t.title : ''), date: ev.date || ymd(n), end: ev.end || '', allDay: sansHeure,
    debut, duree: ev.time ? finMin(ev) - debut : 60, cat: ev.cat || (t && t.cat) || '', taskId: ev.taskId || '', notes: ev.notes || '',
  };
  dessiner(); $('#modal').classList.add('show');
  setTimeout(() => { const i = $('#evTitre'); if(i && !i.value) i.focus(); }, 60);
}
function optionsTaches(){
  const liste = ouvertes(), lie = br.taskId && S.tasks.find(t => t.id === br.taskId);
  if(lie && !liste.includes(lie)) liste.unshift(lie);
  return GROUPES.map(([id, nom]) => { const l = liste.filter(t => t.list === id); return l.length ? `<optgroup label="${nom}">${l.map(t => `<option value="${t.id}" ${t.id === br.taskId ? 'selected' : ''}>${esc(t.title.length > 70 ? t.title.slice(0, 69) + '…' : t.title)}</option>`).join('')}</optgroup>` : ''; }).join('');
}
function dessiner(){
  const fin = Math.min(1440, br.debut + br.duree);
  $('#modalBox').innerHTML = `<form id="evForm" autocomplete="off" novalidate>
    <div class="modal-h"><div class="eyebrow">${edition ? "Modifier l'événement" : 'Nouvel événement'}</div>
      <h3><input class="titre-champ" id="evTitre" value="${esc(br.title)}" placeholder="Titre de l'événement"></h3></div>
    <div class="modal-b ev-corps">
      <div class="ev-quand">
        <input type="date" class="inp" id="evDate" value="${br.date}" aria-label="Date">
        ${br.allDay ? '' : `<input type="time" class="inp" id="evH" step="300" value="${stocke(br.debut)}" aria-label="Début"><span class="ev-fleche">→</span><input type="time" class="inp" id="evHF" step="300" value="${stocke(fin)}" aria-label="Fin">`}
        <button type="button" class="chip ${br.allDay ? 'on' : ''}" data-evf="journee">Toute la journée</button>
      </div>
      ${br.allDay ? `<label class="etiq ev-jusqua">Jusqu'au (facultatif)<input type="date" class="inp" id="evFin" value="${br.end}" min="${br.date}"></label>` : `
      <div class="ev-duree">
        <div class="ev-pas"><button type="button" data-evf="moins" aria-label="5 minutes de moins">−</button><b id="evDuree" class="tab">${dureeTexte(br.duree)}</b><button type="button" data-evf="plus" aria-label="5 minutes de plus">+</button></div>
        <div class="ev-rapides">${RAPIDES.map(m => `<button type="button" class="chip ${br.duree === m ? 'on' : ''}" data-evf-duree="${m}">${dureeTexte(m)}</button>`).join('')}</div>
      </div>`}
      <div class="field"><label>Catégorie</label><div class="cat-pick">${S.categories.map(c => `<button type="button" class="chip ${br.cat === c.id ? 'on' : ''}" data-evf-cat="${c.id}" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</button>`).join('')}<button type="button" class="chip ${!br.cat ? 'on' : ''}" data-evf-cat="">Aucune</button></div></div>
      <label class="etiq">Tâche liée (facultatif)<select class="inp" id="evTache"><option value="">Aucune</option>${optionsTaches()}</select></label>
      <label class="etiq">Notes<textarea class="inp" id="evNotes" rows="2">${esc(br.notes)}</textarea></label>
    </div>
    <div class="modal-f">${edition ? `<button type="button" class="btn ghost danger" data-cal-suppr="${edition}">${I.trash}Supprimer</button>` : ''}<span class="pousse"></span><button type="button" class="btn ghost" data-cal-fermer>Annuler</button><button class="btn primary">${edition ? 'Enregistrer' : 'Ajouter'}</button></div>
  </form>`;
  const on = (id, ev, f) => { const x = $('#' + id); if(x) x.addEventListener(ev, f); };
  on('evTitre', 'input', e => { br.title = e.target.value; });
  on('evNotes', 'input', e => { br.notes = e.target.value; });
  on('evDate', 'change', e => { if(e.target.value){ br.date = e.target.value; if(br.end && br.end < br.date) br.end = ''; } });
  on('evFin', 'change', e => { br.end = e.target.value; });
  on('evH', 'change', e => { const m = enMin(e.target.value); if(m === null) return; br.debut = borne(arrondir(m), 0, 1435); br.duree = Math.min(br.duree, 1440 - br.debut); majHeures(); });
  on('evHF', 'change', e => { let m = enMin(e.target.value); if(m === null) return; if(e.target.value === '00:00' || e.target.value === '23:59') m = 1440; br.duree = borne(arrondir(m) - br.debut, PAS, 1440 - br.debut); majHeures(); });
  on('evTache', 'change', e => {
    const avant = S.tasks.find(t => t.id === br.taskId), t = S.tasks.find(x => x.id === e.target.value);
    br.taskId = e.target.value;
    if(t && (!br.title.trim() || (avant && br.title === avant.title))) br.title = t.title;
    if(t && t.cat && !br.cat) br.cat = t.cat;
    if(t && !edition && br.duree === 60) br.duree = estimation(t);
    dessiner();
  });
}
function majHeures(){
  const h = $('#evH'), f = $('#evHF'), d = $('#evDuree');
  if(h) h.value = stocke(br.debut);
  if(f) f.value = stocke(Math.min(1440, br.debut + br.duree));
  if(d) d.textContent = dureeTexte(br.duree);
  document.querySelectorAll('[data-evf-duree]').forEach(c => c.classList.toggle('on', +c.dataset.evfDuree === br.duree));
}
function actionForm(x){
  const d = x.dataset;
  if(d.evfDuree){ br.duree = Math.min(+d.evfDuree, 1440 - br.debut); majHeures(); return; }
  if(d.evfCat !== undefined){ br.cat = d.evfCat; document.querySelectorAll('[data-evf-cat]').forEach(c => c.classList.toggle('on', c.dataset.evfCat === br.cat)); return; }
  if(d.evf === 'plus'){ br.duree = Math.min(br.duree + PAS, 1440 - br.debut); majHeures(); }
  else if(d.evf === 'moins'){ br.duree = Math.max(PAS, br.duree - PAS); majHeures(); }
  else if(d.evf === 'journee'){ br.allDay = !br.allDay; dessiner(); }
}
document.addEventListener('submit', e => {
  if(e.target.id !== 'evForm') return;
  e.preventDefault();
  const t = br.taskId && S.tasks.find(x => x.id === br.taskId);
  const titre = br.title.trim() || (t ? t.title : '');
  if(!titre){ $('#evTitre').focus(); return; }
  const donnees = {
    title: titre, date: br.date, end: br.allDay && br.end > br.date ? br.end : null,
    time: br.allDay ? '' : stocke(br.debut), timeEnd: br.allDay ? '' : stocke(Math.min(1440, br.debut + br.duree)),
    allDay: br.allDay, notes: br.notes, cat: br.cat || null, taskId: br.taskId || null,
  };
  if(edition) Object.assign(S.events.find(x => x.id === edition), donnees);
  else S.events.push({ id: uid(), ...donnees });
  save(); $('#modal').classList.remove('show'); render();
  if(!edition) toast(`Ajouté ${donnees.date === ymd(new Date()) ? "aujourd'hui" : 'le ' + jourTexte(donnees.date)}${donnees.allDay ? '' : ' à ' + donnees.time}`);
});

/* ---------- sélection, copier, couper, coller ----------
   Clic : choisir un événement (⇧ ou ⌘ clic pour en ajouter). Double-clic : l'ouvrir.
   ⌘C copie, ⌘X coupe, ⌘V colle au jour visé, à la même heure. Après un collage, le jour visé avance d'autant :
   copier le réveil de lundi puis taper ⌘V six fois le pose sur toute la semaine. ⌘A choisit tout ce qui est affiché
   (un jour, une semaine, un mois), pour le recoller ailleurs. */
const ASTUCE = `<p class="ag-astuce">Glisse pour réserver un créneau (pas de 5 min) · clic pour choisir, double-clic pour ouvrir · <kbd>⌘C</kbd> <kbd>⌘X</kbd> <kbd>⌘V</kbd> copier, couper, coller · <kbd>⌘A</kbd> tout choisir</p>`;
export const astuceMois = () => `<p class="ag-astuce">Clic pour choisir un événement, double-clic pour l'ouvrir · clic sur un jour pour le viser · <kbd>⌘C</kbd> <kbd>⌘X</kbd> <kbd>⌘V</kbd> copier, couper, coller · <kbd>⌘A</kbd> tout le mois</p>`;
export const choix = new Set();
let presse = null, cible = null, etendueChoix = 0, geste = 0;
let vueAffichee = () => null;               // { debut, fin } en AAAA-MM-JJ, fourni par le calendrier
export const definirVue = f => { vueAffichee = f; };
const ecartJours = (a, b) => Math.round((dateLongue(b) - dateLongue(a)) / 864e5);
const decaler = (k, n) => ymd(addDays(dateLongue(k), n));
export function viserJour(k){ cible = k; marquerCible(); }
function marquerCible(){
  document.querySelectorAll('.ag-cible').forEach(x => x.classList.remove('ag-cible'));
  if(!cible) return;
  document.querySelectorAll(`.ag-col[data-ag-jour="${cible}"],.ag-jcell[data-ag-jour="${cible}"],.ag-jt[data-cal-ouvrir="${cible}"],.cal-jour[data-cal-jour="${cible}"]`).forEach(x => x.classList.add('ag-cible'));
}
export function marquerChoix(){
  for(const id of [...choix]) if(!S.events.some(e => e.id === id)) choix.delete(id);
  document.querySelectorAll('[data-ag-ev]').forEach(x => x.classList.toggle('choisi', choix.has(x.dataset.agEv)));
  document.querySelectorAll('.cal-el.evenement').forEach(x => x.classList.toggle('choisi', choix.has(x.dataset.calEl.split(':')[1])));
}
export const apresDessin = () => { marquerChoix(); marquerCible(); };
export function choisir(id, ajouter){
  etendueChoix = 0;
  if(!ajouter) choix.clear();
  if(ajouter && choix.has(id)) choix.delete(id); else choix.add(id);
  marquerChoix();
}
function toutChoisir(){
  const v = vueAffichee(); if(!v) return false;
  const ids = S.events.filter(e => e.date <= v.fin && (e.end && e.end > e.date ? e.end : e.date) >= v.debut).map(e => e.id);
  choix.clear(); ids.forEach(id => choix.add(id));
  etendueChoix = ecartJours(v.debut, v.fin) + 1;
  marquerChoix();
  toast(ids.length ? `${ids.length} événement${ids.length > 1 ? 's' : ''} choisi${ids.length > 1 ? 's' : ''}. ⌘C pour copier.` : 'Aucun événement ici.');
  return true;
}
const nombre = n => `${n} événement${n > 1 ? 's' : ''}`;
function copier(couper){
  const evs = S.events.filter(e => choix.has(e.id)); if(!evs.length) return false;
  const base = evs.map(e => e.date).sort()[0];
  const fin = evs.map(e => e.end && e.end > e.date ? e.end : e.date).sort().pop();
  const v = vueAffichee();
  // ⌘A sur une vue : on recolle au même endroit de la vue suivante (semaine suivante, mois suivant…)
  const debutVue = etendueChoix && v ? v.debut : base;
  presse = { evs: evs.map(e => ({ ...e })), base: debutVue, etendue: etendueChoix || ecartJours(base, fin) + 1 };
  if(couper){
    const retires = evs.map(e => [S.events.indexOf(e), e]);
    S.events = S.events.filter(e => !choix.has(e.id)); choix.clear(); save();
    cible = presse.base; render();
    toast(`${nombre(evs.length)} coupé${evs.length > 1 ? 's' : ''}. Choisis un jour puis ⌘V.`, () => { retires.forEach(([i, e]) => S.events.splice(i, 0, e)); save(); render(); });
  } else {
    cible = decaler(presse.base, presse.etendue); marquerCible();
    toast(`${nombre(evs.length)} copié${evs.length > 1 ? 's' : ''} · ⌘V colle ${jourCourt(cible)}, ou clique d'abord un autre jour`);
  }
  return true;
}
const jourCourt = k => k === ymd(new Date()) ? "aujourd'hui" : k === ymd(addDays(new Date(), 1)) ? 'demain' : 'le ' + jourTexte(k);
function coller(){
  if(!presse) return false;
  const k = cible || ymd(new Date()), dec = ecartJours(presse.base, k);
  const nouveaux = presse.evs.map(e => ({ ...e, id: uid(), date: decaler(e.date, dec), end: e.end && e.end > e.date ? decaler(e.end, dec) : null }));
  S.events.push(...nouveaux); save();
  choix.clear(); nouveaux.forEach(e => choix.add(e.id)); etendueChoix = 0;
  cible = decaler(k, presse.etendue);
  render();
  const n = nouveaux.length, quand = presse.etendue === 1 ? jourCourt(k) : `à partir du ${jourTexte(k)}`;
  toast(`${nombre(n)} collé${n > 1 ? 's' : ''} ${quand} · ⌘V encore : ${jourCourt(cible)}`, () => { S.events = S.events.filter(e => !nouveaux.includes(e)); cible = k; save(); render(); });
  return true;
}
function supprimerChoix(){
  const evs = S.events.filter(e => choix.has(e.id)); if(!evs.length) return;
  const retires = evs.map(e => [S.events.indexOf(e), e]);
  S.events = S.events.filter(e => !choix.has(e.id)); choix.clear(); save(); render();
  toast(`${nombre(evs.length)} supprimé${evs.length > 1 ? 's' : ''}`, () => { retires.forEach(([i, e]) => S.events.splice(i, 0, e)); save(); render(); });
}
// On écrit quelque part : les raccourcis gardent leur sens habituel (copier du texte).
const ecrit = () => {
  const a = document.activeElement;
  return $('#modal').classList.contains('show') || $('#focus').classList.contains('show') || (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) || (getSelection && String(getSelection()).length > 0);
};
document.addEventListener('keydown', e => {
  if(app.onglet !== 'calendrier' || ecrit()) return;
  if(e.key === 'Escape' && (choix.size || cible) && !document.querySelector('#drawer.open')){ choix.clear(); cible = null; marquerChoix(); marquerCible(); return; }
  if(!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  const k = e.key.toLowerCase();
  const fait = k === 'c' ? copier(false) : k === 'x' ? copier(true) : k === 'v' ? coller() : k === 'a' ? toutChoisir() : false;
  if(fait){ e.preventDefault(); e.stopPropagation(); geste = Date.now(); }
}, true);
// Les mêmes gestes passent aussi par le menu Édition de macOS : on ne les traite qu'une fois.
for(const type of ['copy', 'cut', 'paste']) document.addEventListener(type, e => {
  if(app.onglet !== 'calendrier' || ecrit()) return;
  if(Date.now() - geste < 500){ e.preventDefault(); return; }
  const fait = type === 'copy' ? copier(false) : type === 'cut' ? copier(true) : coller();
  if(fait){ e.preventDefault(); geste = Date.now(); }
});
// Clic dans une case vide (mois, ligne « journée ») : on vise ce jour.
app.clics.push(e => {
  if(app.onglet !== 'calendrier' || e.target.closest('button,a,input,[data-ag-ev]')) return false;
  const j = e.target.closest('.cal-jour,.ag-jcell'); if(!j) return false;
  choix.clear(); marquerChoix(); viserJour(j.dataset.calJour || j.dataset.agJour);
  return true;
});
