// Onglet privé : suivi jour par jour, façon post-it. Trait continu = jour réussi, pointillé = jour où j'ai cédé.
// Verrouillé par un code (haché avec un sel, jamais en clair) ; se reverrouille dès qu'on le quitte.
import { I } from '../noyau/icones.js';
import { ymd, addDays, sod, monday, isoWeek, dShort } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';

let ouvert = false, essais = 0, bloqueJusqua = 0, message = '';
const render = () => app.rendre();
const SEMAINES = 8;

export function quitter(){ ouvert = false; message = ''; }
export const verrouiller = () => { if(ouvert){ ouvert = false; if(app.onglet === 'addictions') render(); } };
document.addEventListener('visibilitychange', () => { if(document.hidden) verrouiller(); });

function porte(vue){
  const premier = !S.lock;
  vue.innerHTML = `<div class="porte"><div class="porte-carte">
    <span class="porte-ico">${I.verrou}</span>
    <h2>${premier ? 'Choisis ton code' : 'Onglet privé'}</h2>
    <p>${premier ? 'Ce code protège cet onglet. Il est haché avant d’être enregistré : personne ne peut le relire, toi non plus. Note-le.' : 'Saisis ton code pour afficher le contenu.'}</p>
    <form id="codeForm" autocomplete="off">
      <input type="password" class="inp code" id="code1" placeholder="Code" minlength="4" autocomplete="off" aria-label="Code">
      ${premier ? '<input type="password" class="inp code" id="code2" placeholder="Confirmer le code" minlength="4" autocomplete="off" aria-label="Confirmer le code">' : ''}
      <button class="btn primary">${premier ? 'Définir le code' : 'Déverrouiller'}</button>
    </form>
    <p class="porte-msg" role="alert">${esc(message)}</p></div></div>`;
  setTimeout(() => $('#code1') && $('#code1').focus(), 40);
}

function serie(h){ let n = 0; for(let d = sod(new Date()); ; d = addDays(d, -1)){ const v = h.days[ymd(d)]; if(v === 'ok') n++; else if(n === 0 && ymd(d) === ymd(new Date())) continue; else break; if(n > 3650) break; } return n; }
function feuille(h){
  const auj = sod(new Date()), kAuj = ymd(auj), debut = addDays(monday(auj), -(SEMAINES - 1) * 7);
  let rangs = '', pleines = 0;
  for(let s = 0; s < SEMAINES; s++){
    const lun = addDays(debut, s * 7); let traits = '', ok = 0;
    for(let i = 0; i < 7; i++){
      const j = addDays(lun, i), k = ymd(j), v = h.days[k], futur = j > auj;
      if(v === 'ok') ok++;
      traits += `<button class="trait ${futur ? 'futur' : v || 'vide'} ${k === kAuj ? 'auj' : ''}" data-add-jour="${h.id}:${k}" ${futur ? 'disabled' : ''} title="${dShort(j)}${v === 'ok' ? ' · réussi' : v === 'ko' ? ' · cédé' : ''}"><i></i></button>`;
    }
    if(ok === 7) pleines++;
    rangs += `<div class="sem ${ok === 7 ? 'pleine' : ''}"><span class="sem-n tab">S${isoWeek(lun)}</span><div class="traits">${traits}</div><span class="sem-c tab">${ok ? ok + '/7' : ''}</span></div>`;
  }
  const v = h.days[kAuj], n = serie(h);
  const semaine = [0, 1, 2, 3, 4, 5, 6].filter(i => h.days[ymd(addDays(monday(auj), i))] === 'ok').length;
  const fierte = semaine >= 3 ? `${semaine} traits continus cette semaine.` : n >= 2 ? `${n} jours d'affilée.` : 'Un trait continu à la fois.';
  return `<article class="postit">
    <header><h3>${esc(h.name)}</h3><button class="icon-btn sm" data-add-suppr="${h.id}" title="Ne plus suivre">${I.trash}</button></header>
    <div class="postit-auj"><span>Aujourd'hui</span><button class="choix ok ${v === 'ok' ? 'on' : ''}" data-add-auj="${h.id}:ok">Jour réussi</button><button class="choix ko ${v === 'ko' ? 'on' : ''}" data-add-auj="${h.id}:ko">J'ai cédé</button></div>
    <div class="sem tete"><span class="sem-n"></span><div class="traits">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span>${l}</span>`).join('')}</div><span class="sem-c"></span></div>
    ${rangs}
    <footer><b>${fierte}</b><span>Série en cours : <b class="tab">${n} j</b> · Semaines pleines : <b class="tab">${pleines}</b></span></footer>
  </article>`;
}
function contenu(vue){
  vue.innerHTML = `
    <div class="head"><div><div class="eyebrow">Privé · jour après jour</div><h1><span class="flou fort">Addictions</span></h1><div class="head-sub">Le moins de pointillés possible. Clique sur un jour passé pour le corriger.</div></div>
      <button class="btn" data-add-act="verrouiller">${I.verrou}Verrouiller</button></div>
    <div class="postits">${S.habits.map(feuille).join('')}
      <form class="postit ajout" id="habForm" autocomplete="off"><h3>Suivre autre chose</h3><input class="inp" id="habNom" placeholder="Ce dont je veux me libérer…"><button class="btn">${I.plus}Ajouter</button></form></div>`;
}
export function rendre(vue){ if(ouvert) contenu(vue); else porte(vue); }

app.clics.push((e) => {
  const tg = e.target.closest('[data-add-jour],[data-add-auj],[data-add-suppr],[data-add-act]'); if(!tg || !ouvert) return false;
  const d = tg.dataset;
  if(d.addJour){ const [id, k] = d.addJour.split(':'), h = S.habits.find(x => x.id === id); if(h){ const v = h.days[k]; if(!v) h.days[k] = 'ok'; else if(v === 'ok') h.days[k] = 'ko'; else delete h.days[k]; save(); render(); } return true; }
  if(d.addAuj){ const [id, v] = d.addAuj.split(':'), h = S.habits.find(x => x.id === id), k = ymd(new Date()); if(h){ if(h.days[k] === v) delete h.days[k]; else h.days[k] = v; save(); render(); } return true; }
  if(d.addSuppr){
    const i = S.habits.findIndex(x => x.id === d.addSuppr); if(i < 0) return true;
    if(d.confirm !== '1'){ d.confirm = '1'; tg.style.color = 'var(--urgent)'; toast('Clique encore pour arrêter ce suivi'); return true; }
    const h = S.habits.splice(i, 1)[0]; save(); render(); toast('Suivi arrêté', () => { S.habits.splice(i, 0, h); save(); render(); }); return true;
  }
  if(d.addAct === 'verrouiller'){ verrouiller(); return true; }
  return false;
});
document.addEventListener('submit', async e => {
  if(e.target.id === 'habForm' && ouvert){
    e.preventDefault(); const v = $('#habNom').value.trim(); if(!v) return;
    S.habits.push({ id: uid(), name: v, createdAt: new Date().toISOString(), days: {} }); save(); render();
  }
  if(e.target.id === 'codeForm'){
    e.preventDefault();
    const c = $('#code1').value, bureau = window.desktop;
    if(!bureau || !bureau.hacherCode){ message = "Le verrou n'est disponible que dans l'application."; render(); return; }
    if(Date.now() < bloqueJusqua){ message = `Trop d'essais. Réessaie dans ${Math.ceil((bloqueJusqua - Date.now()) / 1000)} s.`; render(); return; }
    if(!S.lock){
      if(c.length < 4){ message = 'Quatre caractères au minimum.'; render(); return; }
      if(c !== $('#code2').value){ message = 'Les deux codes ne sont pas identiques.'; render(); return; }
      S.lock = await bureau.hacherCode(c); save(); ouvert = true; message = ''; render(); return;
    }
    if(await bureau.verifierCode(c, S.lock)){ ouvert = true; essais = 0; message = ''; }
    else { essais++; message = 'Code incorrect.'; if(essais >= 5){ bloqueJusqua = Date.now() + 30e3; essais = 0; message = "Trop d'essais. Réessaie dans 30 s."; } }
    render();
  }
});
