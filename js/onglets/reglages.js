// Onglet « Réglages » : un groupe à la fois, pour que chaque écran garde une seule intention.
import { I } from '../noyau/icones.js';
import { MOIS, cap } from '../noyau/dates.js';
import { S, save, uid, SWATCHES, importer, mediaUrl } from '../noyau/store.js';
import { $, esc, toast } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { playCheck } from '../noyau/sons.js';
import { ui as uiTaches } from './taches.js';
import { albums, indexSouvenirs, urlSouvenir, NOM_REPERE } from '../noyau/inspiration.js';
import { tousLesFonds, fondParId } from '../fonds/moteur.js';
import { cleMois, tirerMois, fondDuMois } from '../fonds/tirage.js';
import { oublierFond } from './calendrier.js';
import { reglagesFinances } from './finances.js';
import { reglagesSync } from '../noyau/sync-ui.js';

const ui = { groupe: 'general', album: null, page: 0 };
let newCatColor = SWATCHES[10];
const render = () => app.rendre();
const inter = (on, attr, label) => `<button class="sw acc ${on ? 'on' : ''}" ${attr} aria-label="${label}" role="switch" aria-checked="${!!on}"></button>`;
const choix = (valeurs, courant, attr, fmt) => `<div class="seg">${valeurs.map(v => `<button ${attr}="${v}" class="${courant === v ? 'on' : ''}">${fmt(v)}</button>`).join('')}</div>`;
const duree = m => m < 60 ? `${m} min` : `${m / 60} h`;

export function appliquerTheme(){
  const th = S.settings.theme;
  if(th === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th);
}

/* ---------- groupes ---------- */
// Ajouter un groupe de réglages = une entrée ici.
const GROUPES = [
  { id:'general',     nom:'Général',      rendu: general },
  { id:'inspiration', nom:'Inspiration',  rendu: inspiration },
  { id:'souvenirs',   nom:'Souvenirs',    rendu: souvenirs, apres: remplirSouvenirs },
  { id:'calendrier',  nom:'Calendrier',   rendu: calendrier },
  { id:'pomodoro',    nom:'Pomodoro',     rendu: pomodoro },
  { id:'taches',      nom:'Catégories',   rendu: categories },
  { id:'finances',    nom:'Mes finances', rendu: reglagesFinances },
  { id:'synchro',     nom:'Synchro iPhone', rendu: reglagesSync },
  { id:'prive',       nom:'Code',         rendu: prive },
  { id:'donnees',     nom:'Données',      rendu: donnees },
];

function general(){
  return `<section class="set-sec"><h4>Général</h4>
    <div class="set-line"><span>Prénom affiché</span><input class="inp" id="setName" value="${esc(S.settings.name)}" style="max-width:200px"></div>
    <div class="set-line"><span>Thème</span>${choix(['auto', 'light', 'dark'], S.settings.theme, 'data-theme-set', v => ({ auto: 'Automatique', light: 'Clair', dark: 'Sombre' })[v])}</div>
    <div class="set-line"><span>Teinter l'arrière-plan avec la destination du mois</span>${inter(S.settings.horizon !== false, 'data-set="horizon"', 'Destination en arrière-plan')}</div>
    <div class="set-line"><span>Son quand je coche une tâche</span>${inter(S.settings.sound !== false, 'data-act="toggle-sound"', 'Son')}</div>
    <div class="set-line"><span>Rappels (échéance d'une tâche dans 1 h, échéance d'un rêve)</span>${inter(S.settings.notify, 'data-act="toggle-notify"', 'Notifications')}</div>
  </section>
  <p class="set-note">Raccourcis : ⌘1 à ⌘9 onglets · ⌃⌘S barre latérale · Mes tâches : N nouvelle tâche, 1 à 5 listes, P progression · Calendrier : ← → naviguer, A M S J vues, T aujourd'hui · Échap fermer</p>`;
}
function inspiration(){
  return `<section class="set-sec"><h4>Personnes inspirantes</h4>
    <div class="personnes">${S.people.map(p => `<figure><img src="${mediaUrl(p.rel)}" alt="" loading="lazy"><input class="inp" value="${esc(p.name)}" data-pers-nom="${p.id}" placeholder="Prénom"><button class="icon-btn sm" data-pers-del="${p.id}" title="Retirer">${I.close}</button></figure>`).join('')}</div>
    ${window.desktop ? `<button class="btn" data-set="pers-add">${I.plus}Ajouter des photos</button>` : ''}
    <p class="set-note">Elles apparaissent sur l'accueil et pendant le Pomodoro, avec leur prénom.</p></section>
  <section class="set-sec"><h4>Citations</h4>
    ${S.quotes.map(q => `<div class="ligne-liste"><p>« ${esc(q.text)} »<small>${esc(q.author || '')}</small></p><button class="icon-btn sm" data-cit-del="${q.id}" title="Supprimer">${I.close}</button></div>`).join('')}
    <form class="form-ligne" id="citForm" autocomplete="off"><input class="inp" id="citTexte" placeholder="La citation…"><input class="inp" id="citAuteur" placeholder="De qui ?" style="max-width:180px"><button class="btn">${I.plus}Ajouter</button></form></section>
  <section class="set-sec"><h4>Repères issus de mes bilans</h4>
    ${['appui', 'vigilance'].map(k => { const l = S.markers.filter(m => m.kind === k); return `<h5 class="${k}">${NOM_REPERE[k]}${l.length > 1 ? (k === 'appui' ? ' — ce qui me porte' : ' — ce qui me fait glisser') : ''}</h5>
      ${l.map(m => `<div class="ligne-liste ${m.on === false ? 'off' : ''}"><p>${esc(m.text)}<small>${m.date ? 'bilan du ' + m.date.split('-').reverse().join('/') : 'ajouté à la main'}</small></p>${inter(m.on !== false, `data-rep-on="${m.id}"`, 'Afficher pendant le Pomodoro')}<button class="icon-btn sm" data-rep-del="${m.id}" title="Supprimer">${I.close}</button></div>`).join('') || '<p class="set-note">Aucun pour le moment. Ils se créent depuis un bilan, ou ci-dessous.</p>'}`; }).join('')}
    <form class="form-ligne" id="repForm" autocomplete="off"><input class="inp" id="repTexte" placeholder="Un élément marquant qui me rappelle qui je suis…"><select class="inp" id="repType" style="max-width:190px"><option value="appui">Point d'appui</option><option value="vigilance">Point de vigilance</option></select><button class="btn">${I.plus}Ajouter</button></form>
    <p class="set-note">L'interrupteur choisit s'il apparaît pendant le Pomodoro.</p></section>`;
}
function souvenirs(){
  return `<section class="set-sec"><h4>Sur la page d'accueil</h4>
    <div class="set-line"><span>Changer de photo toutes les</span>${choix([20, 25, 30], S.settings.accueil.chaque, 'data-acc-chaque', v => v + ' s')}</div>
    <p class="set-note">Tes souvenirs défilent en grand sur l'accueil, en fondu. Les boutons du hublot permettent de revenir en arrière, d'avancer ou de mettre en pause.</p></section>
  <section class="set-sec"><h4>Albums de souvenirs</h4><div id="souvAlbums"><p class="set-note">Lecture de la bibliothèque…</p></div>
    ${window.desktop ? `<div class="ligne" style="margin-top:12px"><button class="btn" data-set="souv-fichiers">${I.plus}Ajouter des photos</button><button class="btn" data-set="souv-dossier">${I.plus}Ajouter un dossier</button><span class="set-note" id="souvSuivi"></span></div>` : ''}
    <p class="set-note">Les photos ajoutées reçoivent le même traitement : dédoublonnage, 1920 px au plus, JPEG qualité 80, orientation corrigée. Les vidéos sont ignorées. Tes originaux ne sont jamais modifiés.</p></section>
  <section class="set-sec" id="souvPhotos" hidden></section>`;
}
async function remplirSouvenirs(){
  const zone = $('#souvAlbums'); if(!zone) return;
  const liste = await albums(), off = new Set(S.souvenirs.albumsOff), acc = new Set(S.souvenirs.accueil);
  if(!$('#souvAlbums')) return;
  const total = liste.reduce((a, x) => a + x.n, 0);
  zone.innerHTML = liste.length ? `<div class="alb tete"><span>${total} photos · ${liste.length} albums</span><span>Pomodoro</span><span>Accueil</span><span></span></div>` + liste.map(a => `<div class="alb ${ui.album === a.nom ? 'on' : ''}"><span><b>${esc(a.nom)}</b><small class="tab">${a.n} photo${a.n > 1 ? 's' : ''}</small></span>${inter(!off.has(a.nom), `data-alb-pomo="${esc(a.nom)}"`, 'Défilement du Pomodoro')}${inter(acc.has(a.nom), `data-alb-acc="${esc(a.nom)}"`, "Page d'accueil")}<button class="btn ghost" data-alb-voir="${esc(a.nom)}">${ui.album === a.nom ? 'Fermer' : 'Voir'}</button></div>`).join('')
    + `<p class="set-note">${acc.size ? "L'accueil pioche dans les albums cochés « Accueil »." : "Aucun album n'est réservé à l'accueil : il pioche dans tous les albums du Pomodoro. Coche tes albums de famille pour le limiter."}</p>`
    : '<p class="set-note">Aucune photo pour le moment.</p>';
  const captures = (await indexSouvenirs()).filter(p => p.c).length;
  if(captures && $('#souvAlbums')) $('#souvAlbums').insertAdjacentHTML('beforeend', `<div class="set-line"><span>Captures d'écran de téléphone (${captures}) dans le défilement</span>${inter(!!S.souvenirs.captures, 'data-set="souv-captures"', "Inclure les captures d'écran")}</div><p class="set-note">Ce sont des PNG très allongés, reconnus automatiquement. Ils sont convertis comme les autres photos, mais écartés de l'accueil et du Pomodoro tant que cet interrupteur est éteint.</p>`);
  const ph = $('#souvPhotos');
  if(ui.album && ph){
    const PAR = 24, toutes = (await indexSouvenirs()).filter(p => p.a === ui.album), pages = Math.ceil(toutes.length / PAR), retirees = new Set(S.souvenirs.photosOff);
    ui.page = Math.min(ui.page, Math.max(0, pages - 1));
    ph.hidden = false;
    ph.innerHTML = `<h4>${esc(ui.album)} · page ${ui.page + 1}/${pages || 1}</h4>
      <div class="vignettes">${toutes.slice(ui.page * PAR, ui.page * PAR + PAR).map(p => `<button class="${retirees.has(p.e) ? 'off' : ''}" data-photo="${p.e}" title="${retirees.has(p.e) ? 'Remettre dans le défilement' : 'Retirer du défilement'}"><img src="${urlSouvenir(p)}" alt="" loading="lazy" decoding="async"><span>${retirees.has(p.e) ? 'Retirée' : 'Retirer'}</span></button>`).join('')}</div>
      <div class="ligne"><button class="btn ghost" data-set="page-" ${ui.page ? '' : 'disabled'}>${I.gauche}Précédentes</button><span class="pousse"></span><button class="btn ghost" data-set="page+" ${ui.page < pages - 1 ? '' : 'disabled'}>Suivantes${I.chev}</button></div>
      <p class="set-note">Une photo retirée reste sur ton disque : elle sort seulement du défilement.</p>`;
  }
}
function calendrier(){
  const now = new Date(), W = S.wallpapers, fonds = tousLesFonds();
  let lignes = '';
  for(let i = 0; i < 12; i++){
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1), y = d.getFullYear(), m = d.getMonth(), cle = cleMois(y, m);
    const fixe = W.pins[cle], tire = W.draws[cle] && fondParId(W.draws[cle]);
    const saison = fonds.filter(f => f.mois.includes(m + 1)), hors = fonds.filter(f => !f.mois.includes(m + 1));
    lignes += `<div class="mois-ligne"><span><b>${cap(MOIS[m])}</b> ${y}</span>
      <select class="inp" data-pin="${cle}"><option value="">Tirage de saison${tire ? ` · ${esc(tire.nom)}` : ''}</option><optgroup label="De saison">${saison.map(f => `<option value="${f.id}" ${fixe === f.id ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</optgroup><optgroup label="Hors saison">${hors.map(f => `<option value="${f.id}" ${fixe === f.id ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</optgroup></select>
      <button class="btn ghost" data-tirage="${y}:${m}" ${fixe ? 'disabled' : ''}>Nouveau tirage</button></div>`;
  }
  const perso = W.custom || [];
  return `<section class="set-sec"><h4>Fonds du calendrier</h4>
    <div class="set-line"><span>Animer les fonds</span>${inter(S.settings.calendrier.anim !== false, 'data-set="cal-anim"', 'Animer les fonds du calendrier')}</div>
    ${lignes}
    <p class="set-note">Chaque mois reçoit un fond de saison tiré au hasard et mémorisé, jamais le même deux mois de suite. Tu peux en fixer un, ou demander un nouveau tirage.</p></section>
  <section class="set-sec"><h4>Mes photos de fond</h4>
    <div class="personnes larges">${perso.map(c => `<figure><img src="${mediaUrl(c.rel)}" alt="" loading="lazy"><input class="inp" value="${esc(c.nom || '')}" data-perso-nom="${c.id}" placeholder="Nom du lieu"><button class="icon-btn sm" data-perso-del="${c.id}" title="Retirer">${I.close}</button></figure>`).join('')}</div>
    ${window.desktop ? `<button class="btn" data-set="perso-add">${I.plus}Ajouter une photo de fond</button>` : ''}
    <p class="set-note">Traitement automatique : plein cadre sans déformation, teinte harmonisée, dégradé de lisibilité, zoom très lent, brume légère. Elles rejoignent la bibliothèque du calendrier et du Pomodoro.</p></section>`;
}
function pomodoro(){
  const P = S.settings.pomodoro;
  return `<section class="set-sec"><h4>Fonds d'écran du Pomodoro</h4>
    <div class="set-line"><span>Afficher un fond illustré</span>${inter(P.fonds, 'data-set="pomo-fonds"', 'Fonds du Pomodoro')}</div>
    <div class="set-line"><span>Animer les fonds</span>${inter(P.anim !== false, 'data-set="pomo-anim"', 'Animer les fonds du Pomodoro')}</div>
    <div class="set-line"><span>Durée de chaque fond</span>${choix([5, 10, 30, 60, 120, 240, 360], P.chaque, 'data-pomo-chaque', duree)}</div>
    <p class="set-note">Le fond est tiré au hasard dans toute la bibliothèque (${tousLesFonds().length} fonds), sans tenir compte de la saison, puis change par un fondu lent.</p></section>
  <section class="set-sec"><h4>Éléments inspirants</h4>
    <div class="set-line"><span>Durée d'apparition</span>${choix([5, 10, 15, 20, 30], P.apparition, 'data-pomo-app', v => v + ' s')}</div>
    <div class="set-line"><span>Durée de disparition</span>${choix([3, 4, 5, 10, 15, 20], P.disparition, 'data-pomo-dis', v => v + ' min')}</div>
    <p class="set-note">Souvenirs, personnes inspirantes, citations, rêves et repères apparaissent pendant le travail, puis s'effacent.</p></section>`;
}
function categories(){
  return `<section class="set-sec"><h4>Catégories de tâches</h4>
    ${S.categories.map(c => `<div class="cat-row"><input type="color" value="${c.color}" data-catcolor="${c.id}" aria-label="Couleur"><input type="text" class="inp" value="${esc(c.name)}" data-catname="${c.id}"><button class="icon-btn" data-catdel="${c.id}" title="Supprimer">${I.trash}</button></div>`).join('')}
    <div class="cat-row" style="margin-top:8px"><input type="text" class="inp" id="newCatName" placeholder="Nouvelle catégorie…"><button class="btn" data-act="add-cat">${I.plus}Ajouter</button></div>
    <div class="swatches" style="margin-top:6px">${SWATCHES.map(s => `<button style="--c:${s}" data-swatch="${s}" class="${s === newCatColor ? 'on' : ''}" aria-label="Couleur ${s}"></button>`).join('')}</div>
    <p class="set-note">Couleurs douces pour les tâches ; les couleurs vives sont réservées aux rêves.</p></section>`;
}
function prive(){
  return `<section class="set-sec"><h4>Code de l'onglet <span class="flou">Addictions</span></h4>
    ${S.lock ? `<form class="form-col" id="codeChange" autocomplete="off"><input type="password" class="inp" id="ccAncien" placeholder="Code actuel"><input type="password" class="inp" id="ccNouveau" placeholder="Nouveau code (4 caractères au minimum)"><input type="password" class="inp" id="ccConfirme" placeholder="Confirmer le nouveau code"><button class="btn">Changer le code</button></form>`
      : '<p class="set-note">Le code se définit au premier accès à l\'onglet.</p>'}
    <p class="set-note">Le code est stocké haché (scrypt) avec un sel, jamais en clair. Il verrouille l'affichage de l'onglet ; le contenu du suivi reste, lui, dans ton fichier de données et tes sauvegardes.</p></section>`;
}
function donnees(){
  const infos = window.desktop && window.desktop.infos ? window.desktop.infos() : null;
  return `<section class="set-sec"><h4>Données</h4>
    <div class="set-line"><span>Sauvegarde de toutes mes données</span><span style="display:flex;gap:6px"><button class="btn" data-act="export">Exporter</button><label class="btn" style="cursor:pointer">Importer<input type="file" id="importFile" accept="application/json" hidden></label></span></div>
    ${S.tasks.some(t => t.example) ? `<div class="set-line"><span>Tâches d'exemple</span><button class="btn ghost danger" data-act="clear-examples">Effacer les exemples</button></div>` : ''}
    <p class="set-note">Une sauvegarde automatique est faite chaque jour (14 conservées), ainsi qu'avant chaque import. L'export contient les textes ; les photos et fichiers restent dans le dossier <code>media</code>.${infos ? `<br>Dossier des données : <code>${esc(infos.dossier)}</code> · version ${esc(infos.version)}` : ''}</p></section>`;
}

export function entrer(p){ if(p && p.groupe) ui.groupe = p.groupe; }
export function rendre(vue){
  const g = GROUPES.find(x => x.id === ui.groupe) || GROUPES[0];
  vue.innerHTML = `
    <div class="head"><div><div class="eyebrow">Réglages</div><h1>Mon <em>espace</em></h1></div></div>
    <div class="sous-nav" style="margin-top:26px">${GROUPES.map(x => `<button data-groupe="${x.id}" class="${x.id === g.id ? 'on' : ''}">${x.nom}</button>`).join('')}</div>
    <div class="reglages">${g.rendu()}</div>`;
  if(g.apres) g.apres();
  const nom = $('#setName'); if(nom) nom.addEventListener('input', e => { S.settings.name = e.target.value.trim(); save(); });
  const imp = $('#importFile'); if(imp) imp.addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => { try{ importer(rd.result); appliquerTheme(); render(); toast('Sauvegarde importée'); }catch(err){ toast("Ce fichier n'est pas une sauvegarde Élan valide"); } };
    rd.readAsText(f);
  });
}

const bascule = (liste, v) => { const i = liste.indexOf(v); if(i >= 0) liste.splice(i, 1); else liste.push(v); };
app.clics.push((e) => {
  const tg = e.target.closest('[data-groupe],[data-set],[data-theme-set],[data-swatch],[data-catdel],[data-act],[data-pers-del],[data-cit-del],[data-rep-on],[data-rep-del],[data-alb-pomo],[data-alb-acc],[data-alb-voir],[data-photo],[data-tirage],[data-perso-del],[data-pomo-chaque],[data-pomo-app],[data-pomo-dis],[data-acc-chaque]'); if(!tg) return false;
  const d = tg.dataset, P = S.settings.pomodoro, bureau = window.desktop;
  if(d.groupe){ ui.groupe = d.groupe; ui.album = null; $('#main').scrollTop = 0; render(); return true; }
  if(d.themeSet){ S.settings.theme = d.themeSet; appliquerTheme(); save(); render(); return true; }
  if(d.swatch){ newCatColor = d.swatch; document.querySelectorAll('[data-swatch]').forEach(b => b.classList.toggle('on', b.dataset.swatch === newCatColor)); return true; }
  if(d.catdel){
    const c = S.categories.find(x => x.id === d.catdel); if(!c) return true;
    if(d.confirm !== '1'){ d.confirm = '1'; tg.style.color = 'var(--urgent)'; tg.title = 'Cliquer encore pour supprimer'; toast(`Clique encore pour supprimer « ${c.name} »`); return true; }
    S.categories = S.categories.filter(x => x.id !== d.catdel); S.tasks.forEach(t => { if(t.cat === d.catdel) t.cat = null; }); if(uiTaches.cat === d.catdel) uiTaches.cat = null; save(); render(); return true;
  }
  if(d.persDel){ const p = S.people.find(x => x.id === d.persDel); S.people = S.people.filter(x => x.id !== d.persDel); if(p && bureau) bureau.retirerPiece(p.rel); save(); render(); return true; }
  if(d.citDel){ S.quotes = S.quotes.filter(x => x.id !== d.citDel); save(); render(); return true; }
  if(d.repOn){ const m = S.markers.find(x => x.id === d.repOn); if(m){ m.on = m.on === false; save(); render(); } return true; }
  if(d.repDel){ S.markers = S.markers.filter(x => x.id !== d.repDel); save(); render(); return true; }
  if(d.albPomo !== undefined){ bascule(S.souvenirs.albumsOff, d.albPomo); save(); remplirSouvenirs(); return true; }
  if(d.albAcc !== undefined){ bascule(S.souvenirs.accueil, d.albAcc); save(); remplirSouvenirs(); return true; }
  if(d.albVoir !== undefined){ ui.album = ui.album === d.albVoir ? null : d.albVoir; ui.page = 0; const ph = $('#souvPhotos'); if(ph && !ui.album) ph.hidden = true; remplirSouvenirs(); return true; }
  if(d.photo){ bascule(S.souvenirs.photosOff, d.photo); save(); remplirSouvenirs(); return true; }
  if(d.tirage){ const [y, m] = d.tirage.split(':').map(Number); tirerMois(y, m, { force: true }); oublierFond(); app.horizon(); render(); toast('Nouveau tirage fait'); return true; }
  if(d.persoDel){ const c = S.wallpapers.custom.find(x => x.id === d.persoDel); S.wallpapers.custom = S.wallpapers.custom.filter(x => x.id !== d.persoDel); for(const k of ['pins', 'draws']) for(const m in S.wallpapers[k]) if(S.wallpapers[k][m] === 'perso-' + d.persoDel) delete S.wallpapers[k][m]; if(c && bureau) bureau.retirerPiece(c.rel); oublierFond(); save(); render(); return true; }
  if(d.pomoChaque){ P.chaque = +d.pomoChaque; save(); render(); return true; }
  if(d.accChaque){ S.settings.accueil.chaque = +d.accChaque; save(); render(); return true; }
  if(d.pomoApp){ P.apparition = +d.pomoApp; save(); render(); return true; }
  if(d.pomoDis){ P.disparition = +d.pomoDis; save(); render(); return true; }
  switch(d.set){
    case 'horizon': S.settings.horizon = S.settings.horizon === false; save(); app.horizon(); render(); return true;
    case 'cal-anim': S.settings.calendrier.anim = S.settings.calendrier.anim === false; save(); render(); return true;
    case 'pomo-fonds': P.fonds = !P.fonds; save(); render(); return true;
    case 'pomo-anim': P.anim = P.anim === false; save(); render(); return true;
    case 'souv-captures': S.souvenirs.captures = !S.souvenirs.captures; save(); remplirSouvenirs(); return true;
    case 'page-': ui.page = Math.max(0, ui.page - 1); remplirSouvenirs(); return true;
    case 'page+': ui.page++; remplirSouvenirs(); return true;
    case 'pers-add': bureau.importerImages('personnes').then(fs => { fs.forEach(f => { if(!S.people.some(p => p.rel === f.rel)) S.people.push({ id: uid(), name: '', rel: f.rel }); }); if(fs.length){ save(); render(); toast('Ajoute leur prénom sous chaque photo'); } }); return true;
    case 'perso-add': bureau.importerImages('fonds').then(fs => { fs.forEach(f => { if(!S.wallpapers.custom.some(c => c.rel === f.rel)) S.wallpapers.custom.push({ id: uid(), nom: f.nom.replace(/\.[^.]+$/, ''), rel: f.rel, mois: [] }); }); if(fs.length){ save(); render(); toast(fs.length > 1 ? `${fs.length} fonds ajoutés` : 'Fond ajouté à la bibliothèque'); } }); return true;
    case 'souv-fichiers': case 'souv-dossier': {
      const suivi = $('#souvSuivi'); if(suivi) suivi.textContent = 'Traitement en cours…';
      bureau.souvenirsAjouter(d.set === 'souv-dossier' ? 'dossier' : 'fichiers').then(async b => {
        if(!b){ if($('#souvSuivi')) $('#souvSuivi').textContent = ''; return; }
        await indexSouvenirs(true); render();
        toast(`${b.retenues} photo${b.retenues > 1 ? 's' : ''} ajoutée${b.retenues > 1 ? 's' : ''}${b.doublons + b.deja ? ` · ${b.doublons + b.deja} déjà présentes` : ''}${b.petites ? ` · ${b.petites} trop petites` : ''}`);
      });
      return true;
    }
  }
  switch(d.act){
    case 'toggle-sound': S.settings.sound = S.settings.sound === false; tg.classList.toggle('on', S.settings.sound); save(); if(S.settings.sound) playCheck(false); break;
    case 'toggle-notify': S.settings.notify = !S.settings.notify; tg.classList.toggle('on', S.settings.notify); save(); break;
    case 'add-cat': {
      const n = $('#newCatName').value.trim(); if(!n){ $('#newCatName').focus(); break; }
      S.categories.push({ id: 'c' + uid(), name: n, color: newCatColor }); save(); render(); toast(`Catégorie « ${n} » créée`); break;
    }
    case 'export': {
      const str = JSON.stringify(S, null, 2);
      if(bureau && bureau.exportData){ bureau.exportData(str); break; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([str], { type: 'application/json' })); a.download = 'elan-sauvegarde.json'; a.click();
      break;
    }
    default: return false;
  }
  return true;
});
if(window.desktop && window.desktop.surSuiviSouvenirs) window.desktop.surSuiviSouvenirs(b => { const s = $('#souvSuivi'); if(s) s.textContent = `Traitement : ${b.vus}/${b.total}`; });
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if(d.catcolor){ const c = S.categories.find(x => x.id === d.catcolor); if(c){ c.color = t.value; save(); } }
  if(d.catname){ const c = S.categories.find(x => x.id === d.catname); if(c && t.value.trim()){ c.name = t.value.trim(); save(); } }
  if(d.persNom){ const p = S.people.find(x => x.id === d.persNom); if(p){ p.name = t.value.trim(); save(); } }
  if(d.persoNom){ const c = S.wallpapers.custom.find(x => x.id === d.persoNom); if(c){ c.nom = t.value.trim(); save(); } }
  if(d.pin !== undefined && t.tagName === 'SELECT'){ if(t.value) S.wallpapers.pins[d.pin] = t.value; else delete S.wallpapers.pins[d.pin]; oublierFond(); save(); app.horizon(); app.rendre(); }
});
document.addEventListener('submit', async e => {
  const id = e.target.id;
  if(id === 'citForm'){ e.preventDefault(); const v = $('#citTexte').value.trim(); if(!v) return; S.quotes.push({ id: uid(), text: v.replace(/^[«"\s]+|[»"\s]+$/g, ''), author: $('#citAuteur').value.trim() }); save(); render(); }
  if(id === 'repForm'){ e.preventDefault(); const v = $('#repTexte').value.trim(); if(!v) return; S.markers.push({ id: uid(), text: v, kind: $('#repType').value, date: null, on: true }); save(); render(); }
  if(id === 'codeChange'){
    e.preventDefault(); const bureau = window.desktop; if(!bureau) return;
    const n = $('#ccNouveau').value;
    if(n.length < 4){ toast('Quatre caractères au minimum'); return; }
    if(n !== $('#ccConfirme').value){ toast('Les deux nouveaux codes ne sont pas identiques'); return; }
    if(!(await bureau.verifierCode($('#ccAncien').value, S.lock))){ toast('Le code actuel est incorrect'); return; }
    S.lock = await bureau.hacherCode(n); save(); render(); toast('Code changé');
  }
});
