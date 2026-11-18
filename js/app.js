// Point d'entrée : barre latérale, changement d'onglet, clavier, horloge.
import { I } from './noyau/icones.js';
import { ymd, cap, dLong } from './noyau/dates.js';
import { S, load, save, uid } from './noyau/store.js';
import { ymd as jour, addDays } from './noyau/dates.js';
import { marques } from './onglets/calendrier.js';
import { verifierRappels } from './onglets/reves.js';
import { $, esc } from './noyau/ui.js';
import { app } from './noyau/bus.js';
import { miniCal } from './noyau/minical.js';
import { ONGLETS } from './onglets.js';
import * as taches from './onglets/taches.js';
import { appliquerTheme } from './onglets/reglages.js';
import { focusOuvert, closeFocus } from './focus.js';
import { carteCap, monterHorizon, rafraichirHorizon, autreCap, tictac } from './noyau/horizon.js';
import * as sync from './noyau/sync.js';
import { surSauvegarde } from './noyau/store.js';

const onglet = id => ONGLETS.find(o => o.id === id) || ONGLETS[0];

function rendreBarre(){
  const bouton = o => `<button data-onglet="${o.id}" class="${app.onglet === o.id ? 'on' : ''}" ${app.onglet === o.id ? 'aria-current="page"' : ''}>${I[o.icone] || ''}<span class="${o.floute?'flou':''}" ${o.floute?'aria-label="Onglet privé"':''}>${esc(o.nom)}</span><kbd>⌘${ONGLETS.indexOf(o) + 1}</kbd></button>${o.minical ? miniCal(new Date(), marques()) : ''}`;
  const haut = ONGLETS.filter(o => !o.bas), bas = ONGLETS.filter(o => o.bas);
  $('#side').innerHTML = `
    <button class="brand" data-onglet="accueil" title="Accueil"><span class="brand-logo">${I.marque}</span><span><b>Élan</b><small>${cap(dLong(new Date()))}</small></span></button>
    <nav class="nav onglets" aria-label="Onglets">${haut.map(bouton).join('')}</nav>
    <div class="side-bas"><div id="capFente"></div><nav class="nav onglets" aria-label="Réglages">${bas.map(bouton).join('')}</nav></div>`;
  $('#capFente').replaceWith(carteCap());
}

function rendre(){
  rendreBarre();
  const o = onglet(app.onglet), vue = $('#view'), st = $('#main').scrollTop;
  vue.className = 'wrap' + (o.large ? ' large' : o.moyen ? ' moyen' : '');
  vue.dataset.page = o.id;
  o.module.rendre(vue);
  $('#main').scrollTop = st;
}
function aller(id, params = null){
  const avant = onglet(app.onglet), apres = onglet(id);
  if(avant !== apres && avant.module.quitter) avant.module.quitter();
  app.onglet = apres.id; app.params = params;
  if(apres.module.entrer) apres.module.entrer(params);
  $('#main').scrollTop = 0;
  rendre();
}
app.rendre = rendre; app.aller = aller; app.horizon = rafraichirHorizon;

/* ---------- barre latérale masquable (bouton à côté des feux, ou ⌃⌘S) ---------- */
function appliquerBarre(){
  const cachee = !!S.settings.barreMasquee, b = $('#barreBtn');
  $('#app').classList.toggle('sans-barre', cachee);
  document.documentElement.classList.toggle('sans-barre', cachee);
  if(b){ b.innerHTML = I.barre; const t = cachee ? 'Afficher la barre latérale' : 'Masquer la barre latérale'; b.setAttribute('aria-label', t); b.title = t + ' (⌃⌘S)'; b.setAttribute('aria-pressed', String(!cachee)); }
}
function basculerBarre(){ S.settings.barreMasquee = !S.settings.barreMasquee; save(); appliquerBarre(); }
$('#barreBtn').addEventListener('click', basculerBarre);

/* ---------- clics ---------- */
document.addEventListener('click', e => {
  const o = e.target.closest('[data-onglet]');
  if(o){ aller(o.dataset.onglet); return; }
  if(e.target.closest('[data-cap]')){ autreCap(); return; }
  const j = e.target.closest('[data-jour]');
  if(j && j.closest('.minical')){ if(!j.classList.contains('hors')) aller('calendrier', { jour: j.dataset.jour }); return; }
  for(const f of app.clics){ if(f(e)) return; }
});
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal' && !taches.revueOuverte()) $('#modal').classList.remove('show'); });

/* ---------- clavier ---------- */
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if(e.key === 'Escape'){
    if(focusOuvert()){ if(typing){ document.activeElement.blur(); return; } closeFocus(); return; }
    if($('#modal').classList.contains('show')){ if(!taches.revueOuverte()) $('#modal').classList.remove('show'); return; }
    if(taches.ui.selected){ taches.closeDrawer(); return; }
    if(typing) document.activeElement.blur();
    return;
  }
  if(e.metaKey && e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')){ e.preventDefault(); basculerBarre(); return; }
  if(e.metaKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)){
    const o = ONGLETS[+e.key - 1]; if(o){ e.preventDefault(); aller(o.id); } return;
  }
  if(typing || e.metaKey || e.ctrlKey || e.altKey || focusOuvert() || $('#modal').classList.contains('show')) return;
  const m = onglet(app.onglet).module; if(m.touche) m.touche(e);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => rendre());

/* ---------- démarrage ---------- */
if(window.desktop) document.documentElement.classList.add('desktop');
load();
// Premier lancement de la v2 : point de départ des bilans (hier) et quelques citations pour commencer.
if(!S.settings.bilansDepuis){
  S.settings.bilansDepuis = jour(addDays(new Date(), -1));
  if(!S.quotes.length) S.quotes.push(
    { id: uid(), text: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.", author: 'Sénèque' },
    { id: uid(), text: "Il n'y a pas de vent favorable pour celui qui ne sait pas où il va.", author: 'Sénèque' },
    { id: uid(), text: "Nous sommes ce que nous faisons de manière répétée. L'excellence n'est donc pas un acte, mais une habitude.", author: 'Will Durant, d\'après Aristote' },
    { id: uid(), text: 'Un voyage de mille lieues commence par un premier pas.', author: 'Lao Tseu' });
}
appliquerTheme(); appliquerBarre(); taches.housekeeping(); save();
surSauvegarde(() => sync.apresSauvegarde());
sync.demarrer(S, { sauvegarder: () => save(), redessiner: () => {
  appliquerTheme(); appliquerBarre();
  const occupe = $('#modal').classList.contains('show') || taches.ui.selected || focusOuvert() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
  if(!occupe) rendre();
} });
monterHorizon();
const dep = new URLSearchParams(location.search).get('onglet');
aller(dep && ONGLETS.some(o => o.id === dep) ? dep : 'accueil');

let lastDay = ymd(new Date());
setInterval(() => {
  const today = ymd(new Date());
  if(today !== lastDay){ lastDay = today; S.snooze = 0; rendreBarre(); monterHorizon(); }
  tictac();
  taches.checkDeadlines(); verifierRappels();
  const calme = !taches.ui.selected && !$('#modal').classList.contains('show') && !focusOuvert();
  const m = onglet(app.onglet).module;
  if(calme && m.rafraichir) m.rafraichir();
}, 60e3);
document.addEventListener('visibilitychange', () => { if(!document.hidden){ const m = onglet(app.onglet).module; if(m.rafraichir && !taches.ui.selected) m.rafraichir(); } });
taches.checkDeadlines(); verifierRappels();

// Version web (iPhone) : l'app reste disponible hors connexion.
if('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
