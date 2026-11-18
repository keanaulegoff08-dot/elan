// Notes du mode focus : un petit document par tâche, du texte en couleurs et des croquis dessinés à la main.
//   tâche.focusNotes = { html, croquis: { id: [ { c, w, p: [[x, y], …] } ] } }
//   Les points et l'épaisseur d'un trait sont rapportés à la largeur du dessin : il garde sa forme à toutes les tailles.
import { I } from './noyau/icones.js';
import { S, save, uid } from './noyau/store.js';

export const COULEURS = [
  ['auto', 'Encre', ''], ['sarcelle', 'Sarcelle', '#2E9E9B'], ['bleu', 'Bleu', '#4C7BE0'], ['violet', 'Violet', '#8B6FE0'],
  ['rose', 'Rose', '#E0609A'], ['aube', 'Aube', '#F08A5D'], ['jaune', 'Ocre', '#D9A21B'], ['vert', 'Vert', '#3BAA6E'],
];
const RATIO = 0.56;                 // hauteur d'un dessin / largeur
const EPAISSEURS = [0.005, 0.011];  // fin, épais
const N = { tache: null, couleur: 'auto', epais: 0, gomme: false, minuterie: 0 };
const notesDe = t => (t.focusNotes = t.focusNotes || { html: '', croquis: {} });
const valeur = id => (COULEURS.find(c => c[0] === id) || COULEURS[0])[2];

export function editeur(){
  return `<div class="fn">
    <div class="fn-outils" role="toolbar" aria-label="Mise en forme des notes">
      <div class="fn-couleurs">${COULEURS.map(([id, nom, v]) => `<button class="fn-c ${N.couleur === id ? 'on' : ''}" data-fn-c="${id}" style="--k:${v || 'var(--ink)'}" title="${nom}" aria-label="Couleur ${nom}"></button>`).join('')}</div>
      <span class="fn-sep"></span>
      <button class="fn-b" data-fn-cmd="bold" title="Gras (⌘B)" aria-label="Gras"><b>G</b></button>
      <button class="fn-b" data-fn-cmd="titre" title="Titre" aria-label="Titre">T</button>
      <button class="fn-b" data-fn-cmd="insertUnorderedList" title="Liste à puces" aria-label="Liste à puces">${I.taches}</button>
      <span class="fn-sep"></span>
      <button class="fn-b fn-dessin" data-fn-dessin title="Ajouter un dessin" aria-label="Ajouter un dessin">${I.crayon}<span>Dessin</span></button>
    </div>
    <div class="fn-doc" id="fnDoc" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Notes" data-vide="Pose tes idées, ta réflexion, ton plan…"></div>
  </div>`;
}

/* ---------- monter le document d'une tâche ---------- */
export function monter(t){
  N.tache = t.id;
  const doc = document.getElementById('fnDoc'); if(!doc) return;
  doc.innerHTML = nettoyer(notesDe(t).html);
  doc.querySelectorAll('figure.croquis').forEach(hydrater);
  vide(doc);
  doc.addEventListener('input', () => { vide(doc); programmer(); });
  // On colle du texte brut : rien d'extérieur n'entre dans le document.
  doc.addEventListener('paste', e => { e.preventDefault(); e.stopPropagation(); const txt = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, txt); });
  doc.addEventListener('drop', e => e.preventDefault());
  doc.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ doc.blur(); }
    if(e.metaKey && e.key.toLowerCase() === 'b'){ e.preventDefault(); document.execCommand('bold'); }
    e.stopPropagation();
  });
  // Les boutons de la barre ne volent pas la sélection du texte.
  document.querySelector('.fn-outils').addEventListener('mousedown', e => { if(e.target.closest('button')) e.preventDefault(); });
}
const vide = doc => doc.classList.toggle('vide', !doc.textContent.trim() && !doc.querySelector('figure,li'));
const tacheCourante = () => S.tasks.find(x => x.id === N.tache);
function programmer(){ clearTimeout(N.minuterie); N.minuterie = setTimeout(enregistrer, 400); }
export function enregistrer(){
  clearTimeout(N.minuterie);
  const t = tacheCourante(), doc = document.getElementById('fnDoc'); if(!t || !doc) return;
  const n = notesDe(t), copie = doc.cloneNode(true), gardes = new Set();
  copie.querySelectorAll('figure.croquis').forEach(f => { f.innerHTML = ''; gardes.add(f.dataset.croquis); });
  n.html = copie.innerHTML.trim() === '<br>' ? '' : copie.innerHTML;
  for(const id of Object.keys(n.croquis)) if(!gardes.has(id)) delete n.croquis[id];
  save();
}
// Le document vient de l'éditeur lui-même ; on retire tout de même ce qui pourrait s'exécuter.
function nettoyer(html){
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body.firstChild;
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,img,svg,video,audio,form,input,button,textarea').forEach(x => x.remove());
  d.querySelectorAll('*').forEach(x => { for(const a of [...x.attributes]) if(/^on/i.test(a.name) || (a.name === 'href') || (a.name === 'src')) x.removeAttribute(a.name); });
  return d.innerHTML;
}

/* ---------- barre d'outils ---------- */
const dansDoc = () => { const s = getSelection(), doc = document.getElementById('fnDoc'); return s.rangeCount && doc && doc.contains(s.anchorNode); };
export function action(x){
  const d = x.dataset;
  if(d.fnC){
    N.couleur = d.fnC;
    document.querySelectorAll('[data-fn-c]').forEach(b => b.classList.toggle('on', b.dataset.fnC === N.couleur));
    if(dansDoc()){ document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, valeur(N.couleur) || 'inherit'); programmer(); }
    return true;
  }
  if(d.fnCmd){
    const doc = document.getElementById('fnDoc'); if(!dansDoc()) doc.focus();
    if(d.fnCmd === 'titre'){ const bloc = document.queryCommandValue('formatBlock'); document.execCommand('formatBlock', false, /h3/i.test(bloc) ? 'div' : 'h3'); }
    else document.execCommand(d.fnCmd);
    programmer(); return true;
  }
  if(d.fnDessin !== undefined){ insererDessin(); return true; }
  if(d.cq){ outilCroquis(x); return true; }
  return false;
}
function insererDessin(){
  const doc = document.getElementById('fnDoc'), t = tacheCourante(); if(!doc || !t) return;
  const id = uid(); notesDe(t).croquis[id] = [];
  const html = `<figure class="croquis" contenteditable="false" data-croquis="${id}"></figure><div><br></div>`;
  if(dansDoc()) document.execCommand('insertHTML', false, html);
  else { doc.insertAdjacentHTML('beforeend', html); }
  const f = doc.querySelector(`figure[data-croquis="${id}"]`); if(f){ hydrater(f); f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  vide(doc); enregistrer();
}

/* ---------- croquis ---------- */
const observe = new ResizeObserver(entrees => entrees.forEach(e => dessiner(e.target.closest('figure'))));
function hydrater(f){
  f.setAttribute('contenteditable', 'false');
  f.innerHTML = `<canvas aria-label="Dessin"></canvas>
    <div class="cq-outils">
      <button data-cq="epais" class="${N.epais ? 'on' : ''}" title="Trait épais" aria-label="Trait épais"><i class="cq-trait"></i></button>
      <button data-cq="gomme" class="${N.gomme ? 'on' : ''}" title="Gomme" aria-label="Gomme"><i class="cq-gomme"></i></button>
      <button data-cq="annuler" title="Annuler le dernier trait" aria-label="Annuler le dernier trait">${I.gauche}</button>
      <button data-cq="suppr" title="Supprimer le dessin" aria-label="Supprimer le dessin">${I.trash}</button>
    </div>`;
  const cv = f.querySelector('canvas');
  cv.addEventListener('pointerdown', e => tracer(e, f, cv));
  observe.observe(cv);
  dessiner(f);
}
const traitsDe = f => { const t = tacheCourante(); return t ? (notesDe(t).croquis[f.dataset.croquis] = notesDe(t).croquis[f.dataset.croquis] || []) : []; };
function dessiner(f){
  if(!f || !f.isConnected) return;
  const cv = f.querySelector('canvas'), W = cv.clientWidth; if(!W) return;
  const H = Math.round(W * RATIO), r = devicePixelRatio || 1;
  if(cv.width !== Math.round(W * r)){ cv.width = Math.round(W * r); cv.height = Math.round(H * r); }
  const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
  const encre = getComputedStyle(f).color;
  for(const s of traitsDe(f)) trait(g, s, W, encre);
}
function trait(g, s, W, encre){
  g.strokeStyle = valeur(s.c) || encre; g.lineWidth = Math.max(1, s.w * W); g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  s.p.forEach(([x, y], i) => i ? g.lineTo(x * W, y * W) : g.moveTo(x * W, y * W));
  if(s.p.length === 1) g.lineTo(s.p[0][0] * W + .1, s.p[0][1] * W);
  g.stroke();
}
function tracer(e, f, cv){
  if(e.button !== 0) return;
  e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  const W = cv.clientWidth, r = cv.getBoundingClientRect(), pt = ev => [+((ev.clientX - r.left) / W).toFixed(4), +((ev.clientY - r.top) / W).toFixed(4)];
  const traits = traitsDe(f);
  if(N.gomme){
    const gommer = ev => { const [x, y] = pt(ev), n = traits.length; for(let i = traits.length - 1; i >= 0; i--) if(traits[i].p.some(([a, b]) => Math.hypot(a - x, b - y) < 0.025)) traits.splice(i, 1); if(traits.length !== n) dessiner(f); };
    gommer(e);
    const mv = ev => gommer(ev), up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); enregistrer(); };
    cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up);
    return;
  }
  const s = { c: N.couleur, w: EPAISSEURS[N.epais], p: [pt(e)] };
  traits.push(s);
  const g = cv.getContext('2d'), encre = getComputedStyle(f).color;
  trait(g, s, W, encre);
  const mv = ev => { const l = ev.getCoalescedEvents ? ev.getCoalescedEvents() : []; (l.length ? l : [ev]).forEach(c => s.p.push(pt(c))); trait(g, { ...s, p: s.p.slice(-3) }, W, encre); };
  const up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); dessiner(f); enregistrer(); };
  cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function outilCroquis(b){
  const f = b.closest('figure.croquis'); if(!f) return;
  const q = b.dataset.cq;
  if(q === 'epais'){ N.epais = N.epais ? 0 : 1; N.gomme = false; }
  else if(q === 'gomme') N.gomme = !N.gomme;
  else if(q === 'annuler'){ traitsDe(f).pop(); dessiner(f); enregistrer(); }
  else if(q === 'suppr'){
    if(b.dataset.confirme !== '1' && traitsDe(f).length){ b.dataset.confirme = '1'; b.classList.add('danger'); b.title = 'Cliquer encore pour supprimer'; setTimeout(() => { b.dataset.confirme = ''; b.classList.remove('danger'); }, 2500); return; }
    f.remove(); enregistrer(); vide(document.getElementById('fnDoc'));
  }
  document.querySelectorAll('[data-cq="epais"]').forEach(x => x.classList.toggle('on', !!N.epais));
  document.querySelectorAll('[data-cq="gomme"]').forEach(x => x.classList.toggle('on', N.gomme));
  document.querySelectorAll('figure.croquis').forEach(x => x.classList.toggle('gomme', N.gomme));
}
