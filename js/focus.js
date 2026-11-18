// Mode focus (Pomodoro) : minuteur dominant, sous-tâches, fond illustré tiré au hasard, éléments inspirants.
import { I } from './noyau/icones.js';
import { pad } from './noyau/dates.js';
import { S, save, uid } from './noyau/store.js';
import { $, esc, notify, toast } from './noyau/ui.js';
import { app } from './noyau/bus.js';
import { playChime } from './noyau/sons.js';
import { ui, catOf, renderDrawer, toggleDone, lienPropre } from './onglets/taches.js';
import { editeur as editeurNotes, monter as monterNotes, enregistrer as enregistrerNotes, action as actionNotes } from './notes.js';
import { JOURS, MOIS, ymd } from './noyau/dates.js';
import { changer } from './fonds/moteur.js';
import { fondAuHasard } from './fonds/tirage.js';
import { prochaineInspiration, NOM_REPERE } from './noyau/inspiration.js';
import { domaine, progression, joursAvant, dansTexte } from './noyau/domaines.js';
import { triable, deplacer } from './noyau/glisser.js';

const render = () => app.rendre();
// Durées proposées par les roulettes (et pour les sous-tâches) : de 5 en 5 minutes.
export const WORK_OPTS = Array.from({ length: 24 }, (_, i) => (i + 1) * 5), BREAK_OPTS = [5, 10, 15, 20, 25, 30];
export const F = { id:null, sub:null, work:25, brk:5, phase:'idle', run:false, endAt:0, left:25*6e4, total:25*6e4, sessStart:0, timer:null, veille:null, fond:null, fondAt:0 };
export const fmtMin = m => m >= 60 ? `${Math.floor(m/60)} h${m%60 ? ' '+pad(m%60) : ''}` : `${m} min`;
export const focusTotal = t => (t.sessions||[]).reduce((a,x) => a + x.min, 0);
export const focusOuvert = () => $('#focus').classList.contains('show');
const tache = () => S.tasks.find(x => x.id === F.id);
function fLeft(){ return F.run ? Math.max(0, F.endAt - Date.now()) : F.left; }
// Chiffres à largeur fixe : le minuteur ne tremble pas d'une seconde à l'autre.
const horloge = ms => `${pad(Math.floor(ms/6e4))}:${pad(Math.floor(ms/1e3)%60)}`;
const chiffres = txt => txt.split('').map(c => `<i${c === ':' ? ' class="sep"' : ''}>${c}</i>`).join('');

/* ---------- fond : tiré au hasard dans toute la bibliothèque, changé par un fondu lent. Aucune commande dans l'interface. ---------- */
function nouveauFond(){
  const P = S.settings.pomodoro, zone = $('#fFond'); if(!zone) return;
  if(!P.fonds){ zone.querySelectorAll('.fond').forEach(f => f.demonter && f.demonter()); F.fond = null; $('#focus').classList.remove('sur-fond'); return; }
  const id = fondAuHasard(F.fond); if(!id) return;
  F.fond = id; F.fondAt = Date.now();
  changer(zone, id, { anim: P.anim !== false, fondu: 3 }).then(() => $('#focus').classList.add('sur-fond')).catch(() => {});
}
/* ---------- éléments inspirants : quelques secondes visibles, plusieurs minutes absents ---------- */
const Insp = { visible:false, prochain:0, fin:0, charge:false };
function cacherInspiration(){ Insp.visible = false; const el = $('#fInsp'); if(el) el.classList.remove('vu'); }
async function montrerInspiration(){
  if(Insp.charge) return; Insp.charge = true;
  const x = await prochaineInspiration(), el = $('#fInsp'); Insp.charge = false;
  const P = S.settings.pomodoro;
  Insp.prochain = Date.now() + (P.apparition || 10) * 1e3 + (P.disparition || 3) * 6e4;
  if(!x || !el || F.phase !== 'work' || !F.run) return;
  let h = '';
  if(x.image) h = `<figure class="insp-photo"><img src="${x.image}" alt=""><figcaption>${esc(x.legende || '')}</figcaption></figure>`;
  else if(x.type === 'citation') h = `<blockquote class="insp-texte"><p>« ${esc(x.texte)} »</p>${x.auteur ? `<cite>${esc(x.auteur)}</cite>` : ''}</blockquote>`;
  else if(x.type === 'reve'){ const r = x.reve, d = domaine(r.domain), p = progression(r); h = `<div class="insp-texte reve" style="--d:${d.c}"><small>${d.nom} · mon rêve</small><p>${esc(r.title)}</p><span class="jauge-d"><i style="width:${p.pct}%"></i></span><cite>${p.pct} % · ${dansTexte(joursAvant(r.deadline)).toLowerCase()}</cite></div>`; }
  else h = `<div class="insp-texte rep ${x.repere.kind}"><small>${NOM_REPERE[x.repere.kind]}</small><p>${esc(x.repere.text)}</p></div>`;
  el.innerHTML = h;
  const voir = () => { if(F.phase !== 'work' || !F.run) return; Insp.visible = true; Insp.fin = Date.now() + (P.apparition || 10) * 1e3; el.classList.add('vu'); };
  const img = el.querySelector('img'); if(img){ img.onload = voir; img.onerror = () => {}; } else voir();
}
// Une seule horloge lente pour le fond et les inspirations.
function veiller(){
  if(!focusOuvert()) return;
  const P = S.settings.pomodoro, now = Date.now();
  if(P.fonds && F.fond && now - F.fondAt >= (P.chaque || 30) * 6e4) nouveauFond();
  if(Insp.visible && now >= Insp.fin) cacherInspiration();
  if(!Insp.visible && F.phase === 'work' && F.run && now >= Insp.prochain) montrerInspiration();
}

export function openFocus(id){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  clearInterval(F.timer); clearInterval(F.veille);
  if(S.settings.focusWork) F.work = S.settings.focusWork;
  if(S.settings.focusBreak) F.brk = S.settings.focusBreak;
  Object.assign(F, { id, sub:null, phase:'idle', run:false, total:F.work*6e4, left:F.work*6e4, fond:null });
  const suite = (t.subtasks||[]).find(s => !s.done); if(suite) viser(suite.id, false);
  const el = $('#focus');
  el.classList.remove('sur-fond');
  el.innerHTML = `<div class="f-fond" id="fFond" aria-hidden="true"></div><div class="f-voile" aria-hidden="true"></div>
    <div class="f-ui" id="fUi"><div class="f-col gauche" id="fGauche"></div><div class="f-centre" id="fCentre"></div><div class="f-col droite" id="fDroite"></div></div>
    <div class="f-dock" id="fDock"></div><aside class="f-insp" id="fInsp" aria-live="off"></aside>`;
  cacherInspiration();
  colonneDroite(t);
  renderFocus(); el.classList.add('show');
  nouveauFond(); // un fond est tiré au démarrage de chaque session
  F.veille = setInterval(veiller, 1000);
}
// Sous-tâche en cours : sa durée de travail devient celle du minuteur.
function viser(sid, redessiner = true){
  const t = tache(), s = t && t.subtasks.find(x => x.id === sid); if(!s) return;
  F.sub = sid;
  if(s.min && F.phase !== 'work'){ F.work = s.min; if(F.phase === 'idle' || F.phase === 'breakdone'){ F.total = F.left = F.work*6e4; } }
  if(redessiner) renderFocus();
}
function startPhase(phase){
  clearInterval(F.timer);
  F.phase = phase; F.total = (phase === 'work' ? F.work : F.brk) * 6e4; F.left = F.total;
  F.run = true; F.endAt = Date.now() + F.total;
  if(phase === 'work'){ F.sessStart = Date.now(); Insp.prochain = Date.now() + 45e3; } else cacherInspiration();
  F.timer = setInterval(focusTick, 250); renderFocus();
}
function togglePause(){
  if(F.run){ F.left = Math.max(0, F.endAt - Date.now()); F.run = false; clearInterval(F.timer); cacherInspiration(); }
  else { F.endAt = Date.now() + F.left; F.run = true; F.timer = setInterval(focusTick, 250); }
  renderFocus();
}
function logSession(min, partial){
  const t = tache(); if(!t || min < 1) return;
  (t.sessions = t.sessions || []).push({ min, at: new Date().toISOString(), partial: !!partial });
  save();
}
function workedMin(){ return Math.floor((F.total - fLeft())/6e4); }
function focusTick(){
  const left = fLeft();
  const el = $('#fTime'), txt = horloge(left); if(el && el.dataset.t !== txt){ el.dataset.t = txt; el.innerHTML = chiffres(txt); }
  const ring = $('#fRing'); if(ring){ const C = +ring.dataset.c; ring.setAttribute('stroke-dashoffset', C*(left/F.total)); }
  if(left <= 0){
    clearInterval(F.timer); F.run = false; F.left = 0; cacherInspiration();
    if(F.phase === 'work'){ logSession(F.work); F.phase = 'workdone'; playChime(); notify('Session terminée', `${fmtMin(F.work)} de travail. Pause de ${F.brk} min ?`); }
    else { F.phase = 'breakdone'; playChime(); notify('Pause terminée', 'On reprend le travail.'); }
    render(); renderFocus();
  }
}
export function closeFocus(){
  enregistrerNotes(); enregistrerDescription();
  if(F.phase === 'work') logSession(workedMin(), true);
  clearInterval(F.timer); clearInterval(F.veille); F.run = false; F.phase = 'idle';
  const el = $('#focus'); el.classList.remove('show');
  setTimeout(() => { if(!focusOuvert()){ el.querySelectorAll('.fond').forEach(f => f.demonter && f.demonter()); el.innerHTML = ''; } }, 600);
  render(); if(ui.selected) renderDrawer();
}
function sousTaches(t){
  const subs = t.subtasks || [];
  const durees = s => `<option value="">Durée</option>${WORK_OPTS.map(m => `<option value="${m}" ${s.min===m?'selected':''}>${fmtMin(m)}</option>`).join('')}`;
  return section('sous', subs.length ? `${subs.filter(s => s.done).length}/${subs.length}` : '', `
    <div class="subs" id="fSubs">${subs.map(s => `<div class="sub ${s.done?'done':''} ${F.sub===s.id?'vise':''}" data-sub-id="${s.id}">
      <button class="sub-grip" title="Glisser pour changer l'ordre" aria-label="Déplacer la sous-tâche (flèches haut et bas)">${I.grip}</button>
      <button class="check sm" data-fsub-check="${s.id}" aria-label="Cocher">${I.check}</button>
      <textarea class="sub-t" rows="1" data-fsub-t="${s.id}" aria-label="Sous-tâche">${esc(s.title)}</textarea>
      <select class="sub-min" data-fsub-min="${s.id}" aria-label="Durée de travail">${durees(s)}</select>
      <button class="icon-btn sm viser" data-fsub-viser="${s.id}" title="Travailler sur celle-ci" ${s.done?'disabled':''}>${I.focus}</button></div>`).join('')}</div>
    <form class="mini-add" id="fSubAdd" autocomplete="off">${I.plus}<input id="fSubInput" placeholder="Ajouter une sous-tâche…"></form>`);
}
export function renderFocus(){
  const t = tache(), zone = $('#fUi'); if(!t || !zone || !$('#fCentre')) return;
  const c = catOf(t.cat);
  const isBrk = F.phase === 'break';
  const left = fLeft();
  const shown = (F.phase === 'idle' || F.phase === 'breakdone') ? F.work*6e4 : F.phase === 'workdone' ? F.brk*6e4 : left;
  const R = 120, C = 2*Math.PI*R;
  const frac = (F.phase === 'work' || F.phase === 'break') ? left/F.total : 1;
  const phaseLbl = { idle:'Prêt', work: F.run ? 'Travail' : 'En pause', workdone:'Session terminée', break: F.run ? 'Pause' : 'Pause suspendue', breakdone:'Pause terminée' }[F.phase];
  const sess = t.sessions || [], tot = focusTotal(t);
  const workLocked = F.phase === 'work', brkLocked = F.phase === 'break';
  const vise = (t.subtasks||[]).find(s => s.id === F.sub && !s.done);
  let ctrls = '', msg = '';
  if(F.phase === 'idle' || F.phase === 'breakdone'){
    if(F.phase === 'breakdone') msg = `<div class="msg"><b>Pause terminée.</b>Choisis ta durée et on y retourne.</div>`;
    ctrls = `<button class="btn primary" data-act="f-start">${I.play}${sess.length ? 'Reprendre le travail' : 'Démarrer'} · ${fmtMin(F.work)}</button><button class="btn" data-act="f-done">${I.check}Tâche terminée</button><button class="btn ghost" data-act="f-close">Quitter</button>`;
  } else if(F.phase === 'work'){
    ctrls = `<button class="btn primary" data-act="f-toggle">${F.run ? I.pause+'Pause' : I.play+'Reprendre'}</button><button class="btn" data-act="f-done">${I.check}Tâche terminée</button><button class="btn ghost" data-act="f-close">Arrêter</button>`;
  } else if(F.phase === 'workdone'){
    msg = `<div class="msg"><b>${fmtMin(F.work)} de travail, bravo.</b>La tâche n'est pas finie ? Souffle un peu, puis relance une session.</div>`;
    ctrls = `<button class="btn primary" data-act="f-break">${I.play}Pause · ${F.brk} min</button><button class="btn" data-act="f-start">Reprendre sans pause · ${fmtMin(F.work)}</button><button class="btn" data-act="f-done">${I.check}Tâche terminée</button><button class="btn ghost" data-act="f-close">Quitter</button>`;
  } else if(F.phase === 'break'){
    ctrls = `<button class="btn primary" data-act="f-toggle">${F.run ? I.pause+'Suspendre' : I.play+'Continuer la pause'}</button><button class="btn" data-act="f-skip">Passer la pause</button><button class="btn ghost" data-act="f-close">Quitter</button>`;
  }
  $('#fCentre').innerHTML = `
      <div class="eyebrow">${c?esc(c.name)+' · ':''}Mode focus</div>
      <div class="ft">${esc(t.title)}</div>
      ${vise ? `<div class="f-vise">${I.focus}${esc(vise.title)}</div>` : ''}
      <div class="ring ${isBrk||F.phase==='workdone'?'brk':''}"><svg class="prog" viewBox="0 0 260 260"><circle cx="130" cy="130" r="${R}" fill="none" stroke="var(--f-rail,var(--line))" stroke-width="5"/><circle id="fRing" data-c="${C}" cx="130" cy="130" r="${R}" fill="none" stroke="${isBrk||F.phase==='workdone'?'var(--lav)':'var(--accent)'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*frac}" style="transition:stroke-dashoffset .25s linear"/></svg>
        <div class="inner"><div class="time" id="fTime" data-t="${horloge(shown)}" role="timer">${chiffres(horloge(shown))}</div><div class="phase">${phaseLbl}</div></div></div>
      ${msg}
      <div class="f-roues">${roue('work', 'Travail', WORK_OPTS, F.work, workLocked)}${roue('brk', 'Pause', BREAK_OPTS, F.brk, brkLocked)}</div>
      <div class="ctrls">${ctrls}</div>
      ${historique(t)}`;
  $('#fGauche').innerHTML = fichiers(t) + sousTaches(t);
  dock();
  monterRoues();
  zone.querySelectorAll('[data-fsub-t]').forEach(inp => {
    inp.addEventListener('change', () => { const s = t.subtasks.find(x => x.id === inp.dataset.fsubT), v = inp.value.replace(/\s*\n\s*/g, ' ').trim(); if(s && v){ s.title = v; save(); renderFocus(); } });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); } });
  });
  triable($('#fSubs'), { fin: (de, vers) => { deplacer(t.subtasks, de, vers); save(); renderFocus(); } });
  zone.querySelectorAll('[data-fsub-min]').forEach(sel => sel.addEventListener('change', () => { const s = t.subtasks.find(x => x.id === sel.dataset.fsubMin); if(s){ s.min = sel.value ? +sel.value : null; save(); if(F.sub === s.id) viser(s.id); else renderFocus(); } }));
}

app.clics.push((e) => {
  const tg = e.target.closest('[data-fwork],[data-fbrk],[data-act^="f-"],[data-fsub-check],[data-fsub-viser],[data-fplier],[data-fcacher],[data-fmontrer],[data-froue-v],[data-ffichier-suppr],[data-flien-suppr],[data-fn-c],[data-fn-cmd],[data-fn-dessin],[data-cq]'); if(!tg) return false;
  const d = tg.dataset;
  if(actionNotes(tg)) return true;
  if(d.fplier){ basculer('plie', d.fplier); const sec = tg.closest('.f-sec'); sec.classList.toggle('plie'); tg.setAttribute('aria-expanded', !sec.classList.contains('plie')); return true; }
  if(d.fcacher){ basculer('cache', d.fcacher); document.querySelectorAll(`[data-fsec="${d.fcacher}"]`).forEach(x => x.classList.add('cache')); dock(); return true; }
  if(d.fmontrer){ basculer('cache', d.fmontrer); document.querySelectorAll(`[data-fsec="${d.fmontrer}"]`).forEach(x => x.classList.remove('cache')); dock(); return true; }
  if(d.froueV){ const r = tg.closest('.roue'); r.scrollTo({ top: [...r.children].indexOf(tg) * PAS_ROUE, behavior: 'smooth' }); return true; }
  if(d.ffichierSuppr){ const t = tache(); if(t){ const f = t.files.find(x => x.id === d.ffichierSuppr); t.files = t.files.filter(x => x.id !== d.ffichierSuppr); save(); if(f && window.desktop) window.desktop.retirerPiece(f.rel); renderFocus(); toast('Fichier retiré de la tâche'); } return true; }
  if(d.flienSuppr){ const t = tache(); if(t){ t.links = t.links.filter(x => x.id !== d.flienSuppr); save(); renderFocus(); } return true; }
  if(d.fwork){ if(F.phase !== 'work'){ F.work = +d.fwork; S.settings.focusWork = F.work; save(); renderFocus(); } return true; }
  if(d.fbrk){ if(F.phase !== 'break'){ F.brk = +d.fbrk; S.settings.focusBreak = F.brk; save(); renderFocus(); } return true; }
  if(d.fsubViser){ viser(d.fsubViser); return true; }
  if(d.fsubCheck){
    const t = tache(), s = t && t.subtasks.find(x => x.id === d.fsubCheck); if(!s) return true;
    s.done = !s.done; save();
    if(s.done && F.sub === s.id){ const suite = t.subtasks.find(x => !x.done); F.sub = null; if(suite) viser(suite.id, false); }
    renderFocus(); return true;
  }
  switch(d.act){
    case 'f-start': startPhase('work'); break;
    case 'f-break': startPhase('break'); break;
    case 'f-skip': clearInterval(F.timer); F.run = false; F.phase = 'breakdone'; renderFocus(); break;
    case 'f-toggle': togglePause(); break;
    case 'f-done': { const id = F.id; closeFocus(); const t = S.tasks.find(x => x.id === id); if(t && !t.done) toggleDone(id); break; }
    case 'f-close': closeFocus(); break;
    case 'f-joindre': {
      const t = tache(); if(!t || !window.desktop) break;
      window.desktop.joindre('pieces/' + t.id).then(fs => {
        if(!fs.length) return;
        t.files = t.files || []; fs.forEach(f => t.files.push({ id: uid(), nom: f.nom, rel: f.rel, taille: f.taille }));
        save(); renderFocus(); toast(fs.length > 1 ? `${fs.length} fichiers joints` : 'Fichier joint');
      });
      break;
    }
    default: return false;
  }
  return true;
});
document.addEventListener('submit', e => {
  if(e.target.id === 'fLienAdd'){
    e.preventDefault(); const t = tache(), l = lienPropre($('#fLienInput').value); if(!t) return;
    if(!l){ toast("Ce lien n'est pas valide"); return; }
    (t.links = t.links || []).push(l); save(); renderFocus(); const i = $('#fLienInput'); if(i) i.focus();
    return;
  }
  if(e.target.id !== 'fSubAdd') return;
  e.preventDefault(); const t = tache(), v = $('#fSubInput').value.trim(); if(!t || !v) return;
  const s = { id: uid(), title: v, done: false, min: null }; t.subtasks.push(s); save();
  if(!F.sub) F.sub = s.id;
  renderFocus(); const i = $('#fSubInput'); if(i) i.focus();
});
// Vérification (outils/) : force l'apparition immédiate d'un élément inspirant.
export const _essaiInspiration = () => { Insp.prochain = 0; return montrerInspiration(); };

/* =========================================================
   Panneaux autour du minuteur : à gauche Fichiers et Sous-tâches, à droite Description et Notes,
   sous le minuteur l'Historique. Chacun se replie (clic sur son titre) ou se met de côté
   (il rejoint alors la petite barre en haut à droite, d'où on le fait revenir).
   ========================================================= */
const NOMS = { fichiers: 'Fichiers et liens', sous: 'Sous-tâches', desc: 'Description', notes: 'Notes', hist: 'Historique' };
const ICONES = { fichiers: 'clip', sous: 'sub', desc: 'note', notes: 'crayon', hist: 'historique' };
const reglagesUi = () => (S.settings.focusUi = Object.assign({ cache: [], plie: [] }, S.settings.focusUi || {}));
function basculer(quoi, id){ const U = reglagesUi(), l = U[quoi], i = l.indexOf(id); if(i >= 0) l.splice(i, 1); else l.push(id); save(); }
function section(id, compte, corps, classe = ''){
  const U = reglagesUi(), plie = U.plie.includes(id);
  return `<section class="f-panneau f-sec ${classe} ${plie ? 'plie' : ''} ${U.cache.includes(id) ? 'cache' : ''}" data-fsec="${id}">
    <header class="f-sec-h">
      <button class="f-sec-t" data-fplier="${id}" aria-expanded="${!plie}" title="Replier ou déplier">${I.chev}<span>${NOMS[id]}</span>${compte ? `<b class="tab">${compte}</b>` : ''}</button>
      <button class="icon-btn sm f-sec-x" data-fcacher="${id}" title="Mettre de côté" aria-label="Mettre de côté : ${NOMS[id]}">${I.ranger}</button>
    </header>
    <div class="f-sec-b">${corps}</div></section>`;
}
function dock(){
  const z = $('#fDock'); if(!z) return;
  const c = reglagesUi().cache.filter(id => NOMS[id]);
  z.innerHTML = c.length ? `<span>De côté</span>${c.map(id => `<button class="f-dock-b" data-fmontrer="${id}" title="Faire revenir">${I[ICONES[id]]}${NOMS[id]}</button>`).join('')}` : '';
  z.classList.toggle('vu', c.length > 0);
}
const poids = n => n < 1e6 ? `${Math.max(1, Math.round(n / 1e3))} Ko` : `${(n / 1e6).toFixed(1).replace('.', ',')} Mo`;
function fichiers(t){
  const fs = t.files || [], ls = t.links || [];
  return section('fichiers', fs.length + ls.length || '', `
    <div class="f-pieces">${fs.map(f => `<div class="piece"><button class="piece-o" data-fileopen="${esc(f.rel)}" title="Ouvrir">${I.fichier}<span>${esc(f.nom)}</span><small>${poids(f.taille || 0)}</small></button><button class="icon-btn sm" data-ffichier-suppr="${f.id}" title="Retirer" aria-label="Retirer ce fichier">${I.close}</button></div>`).join('')}
      ${ls.map(l => `<div class="piece"><a class="piece-o" href="${esc(l.url)}" target="_blank" rel="noreferrer" title="${esc(l.url)}">${I.lien}<span>${esc(l.label)}</span></a><button class="icon-btn sm" data-flien-suppr="${l.id}" title="Retirer" aria-label="Retirer ce lien">${I.close}</button></div>`).join('')}
      ${fs.length + ls.length ? '' : '<p class="f-vide">Les documents et les pages utiles à cette tâche, à portée de main.</p>'}</div>
    <div class="f-pieces-add">${window.desktop ? `<button class="btn" data-act="f-joindre">${I.clip}Joindre</button>` : ''}
      <form class="mini-add" id="fLienAdd" autocomplete="off">${I.lien}<input id="fLienInput" placeholder="Coller un lien…" aria-label="Nouveau lien"></form></div>`);
}
// Description (les notes de la tâche dans « Mes tâches ») et Notes : dessinées une seule fois, pour ne jamais perdre le curseur.
let minDesc = 0;
function colonneDroite(t){
  $('#fDroite').innerHTML = section('desc', '', `<textarea class="f-desc" id="fDesc" rows="2" placeholder="Détails, prochaine étape…" aria-label="Description de la tâche">${esc(t.notes || '')}</textarea>`)
    + section('notes', '', editeurNotes(), 'f-notes');
  const d = $('#fDesc');
  d.addEventListener('input', () => { clearTimeout(minDesc); minDesc = setTimeout(enregistrerDescription, 400); });
  monterNotes(t);
}
function enregistrerDescription(){ clearTimeout(minDesc); const t = tache(), d = $('#fDesc'); if(t && d && t.notes !== d.value){ t.notes = d.value; save(); } }

// Historique : toutes les sessions de la tâche, jour par jour.
function historique(t){
  const sess = (t.sessions || []).slice().sort((a, b) => b.at.localeCompare(a.at)), tot = focusTotal(t);
  if(!sess.length) return '';
  const jours = new Map();
  for(const x of sess){ const k = ymd(new Date(x.at)); (jours.get(k) || jours.set(k, []).get(k)).push(x); }
  const auj = ymd(new Date()), hier = ymd(new Date(Date.now() - 864e5));
  const nomJour = k => { if(k === auj) return "Aujourd'hui"; if(k === hier) return 'Hier'; const d = new Date(k + 'T12:00'); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const corps = [...jours].map(([k, l]) => `<div class="fh-jour"><div class="fh-j"><span>${nomJour(k)}</span><b class="tab">${fmtMin(l.reduce((a, x) => a + x.min, 0))}</b></div>
    ${l.map(x => { const fin = new Date(x.at), deb = new Date(fin - x.min * 6e4); return `<div class="fh-l"><span class="tab">${hhmm(deb)} → ${hhmm(fin)}</span><b class="tab">${fmtMin(x.min)}</b>${x.partial ? '<small>interrompue</small>' : ''}</div>`; }).join('')}</div>`).join('');
  return section('hist', `${fmtMin(tot)} · ${sess.length} session${sess.length > 1 ? 's' : ''}`, `<div class="fh">${corps}</div>`, 'f-hist');
}

/* ---------- roulettes Travail et Pause ---------- */
const PAS_ROUE = 30;
function roue(id, nom, vals, v, verrou){
  return `<div class="roue-g ${verrou ? 'verrou' : ''}"><span>${nom}</span>
    <div class="roue" data-roue="${id}" tabindex="${verrou ? -1 : 0}" role="listbox" aria-label="Durée de ${nom.toLowerCase()}">${vals.map(m => `<div class="roue-v ${m === v ? 'on' : ''}" data-froue-v="${m}" role="option" aria-selected="${m === v}">${fmtMin(m)}</div>`).join('')}</div></div>`;
}
function monterRoues(){
  document.querySelectorAll('.roue').forEach(r => {
    const vals = [...r.children].map(x => +x.dataset.froueV), cle = r.dataset.roue, v = F[cle];
    r.scrollTop = Math.max(0, vals.indexOf(v)) * PAS_ROUE;
    let minu = 0;
    const lu = () => Math.min(vals.length - 1, Math.max(0, Math.round(r.scrollTop / PAS_ROUE)));
    r.addEventListener('scroll', () => {
      const i = lu(); [...r.children].forEach((x, j) => { x.classList.toggle('on', j === i); x.setAttribute('aria-selected', j === i); });
      clearTimeout(minu);
      minu = setTimeout(() => choisirDuree(cle, vals[lu()]), 160);
    }, { passive: true });
    r.addEventListener('keydown', e => {
      if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault(); e.stopPropagation();
      r.scrollTo({ top: (lu() + (e.key === 'ArrowDown' ? 1 : -1)) * PAS_ROUE, behavior: 'smooth' });
    });
  });
}
function choisirDuree(cle, m){
  if(F[cle] === m) return;
  if(cle === 'work'){ if(F.phase === 'work') return; F.work = m; S.settings.focusWork = m; if(F.phase === 'idle' || F.phase === 'breakdone'){ F.total = F.left = m * 6e4; } }
  else { if(F.phase === 'break') return; F.brk = m; S.settings.focusBreak = m; }
  save();
  const focusAvant = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.roue;
  renderFocus();
  if(focusAvant){ const r = document.querySelector(`.roue[data-roue="${focusAvant}"]`); if(r) r.focus({ preventScroll: true }); }
}
