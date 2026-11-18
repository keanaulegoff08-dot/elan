// Moteur des fonds illustrés : charge une illustration à la demande et la monte dans un conteneur.
import { CATALOGUE } from './catalogue.js';
import { S, mediaUrl } from '../noyau/store.js';

export const LARGEUR = 1600, HAUTEUR = 900;
// Bibliothèque complète : illustrations d'Élan + photos personnelles ajoutées dans Réglages, moins celles désactivées.
export const photosPerso = () => ((S.wallpapers && S.wallpapers.custom) || []).map(c => ({ id: 'perso-' + c.id, nom: c.nom || 'Ma photo', mois: c.mois && c.mois.length ? c.mois : [1,2,3,4,5,6,7,8,9,10,11,12], photo: c.rel, perso: c.id }));
export const tousLesFonds = () => [...CATALOGUE, ...photosPerso()];
export const fondsActifs = () => { const off = new Set((S.wallpapers && S.wallpapers.off) || []); return tousLesFonds().filter(f => !off.has(f.id)); };
export const fondParId = id => tousLesFonds().find(f => f.id === id);

// Traitement automatique d'une photo personnelle : plein cadre sans déformation, teinte harmonisée,
// dégradé de lisibilité, zoom très lent, brume légère.
function illustrationPhoto(fiche){
  const u = mediaUrl(fiche.photo).replace(/"/g, '%22');
  return { teinte: '#26323a', foyer: [.5, .5], couches: [
    { html: `<div class="fp-img" style="background-image:url(&quot;${u}&quot;)"></div>`, anim: 'zoom', dur: 90 },
    { html: '<div class="fp-teinte"></div><div class="fp-degrade"></div>' },
    { html: '<div class="fp-brume"></div>', anim: 'derive', dur: 80, x0: -60, x1: 60 },
  ] };
}

// La fenêtre masquée ou réduite met toutes les animations en pause.
const majPause = () => document.documentElement.classList.toggle('fonds-pause', document.hidden);
document.addEventListener('visibilitychange', majPause); majPause();

const ANIMS = ['derive', 'souffle', 'vogue', 'chute', 'traverse', 'zoom'];
const px = v => (typeof v === 'number' ? v + 'px' : v);

function cadrer(racine, scene, foyer){
  const W = racine.clientWidth, H = racine.clientHeight; if(!W || !H) return;
  const s = Math.max(W / LARGEUR, H / HAUTEUR);
  // Le foyer de l'illustration reste au plus près du centre du cadre, sans jamais découvrir un bord.
  const x = Math.min(0, Math.max(W - LARGEUR * s, W / 2 - foyer[0] * LARGEUR * s));
  const y = Math.min(0, Math.max(H - HAUTEUR * s, H / 2 - foyer[1] * HAUTEUR * s));
  scene.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
}

// Monte le fond `id` dans `conteneur` (qui doit être positionné). Renvoie l'élément, avec .demonter().
export async function monter(conteneur, id, { anim = true, foyer = null, fondu = 0 } = {}){
  const fiche = fondParId(id); if(!fiche) throw new Error('Fond inconnu : ' + id);
  const ill = fiche.photo ? illustrationPhoto(fiche) : (await fiche.charge()).default;
  const racine = document.createElement('div');
  racine.className = 'fond' + (anim ? '' : ' fige') + (fondu ? ' entre' : '');
  racine.dataset.fond = id;
  racine.style.setProperty('--fond-teinte', ill.teinte);
  if(fondu) racine.style.setProperty('--fondu', fondu + 's');
  const scene = document.createElement('div'); scene.className = 'fond-scene';
  let animees = 0;
  for(const c of ill.couches){
    const el = document.createElement('div');
    el.className = 'fond-c';
    if(c.anim && ANIMS.includes(c.anim) && animees < 3){
      animees++;
      el.classList.add('anim', 'a-' + c.anim);
      el.style.setProperty('--dur', Math.min(90, Math.max(40, c.dur || 60)) + 's'); // boucles de 40 à 90 s
      if(c.del) el.style.setProperty('--del', -Math.abs(c.del) + 's');
      for(const k of ['x0', 'x1', 'y0', 'y1']) if(c[k] !== undefined) el.style.setProperty('--' + k, px(c[k]));
      for(const k of ['o0', 'o1']) if(c[k] !== undefined) el.style.setProperty('--' + k, c[k]);
    }
    el.innerHTML = c.svg || c.html;
    scene.appendChild(el);
  }
  racine.appendChild(scene);
  conteneur.appendChild(racine);
  const f = foyer || ill.foyer || [0.5, 0.5];
  const ro = new ResizeObserver(() => cadrer(racine, scene, f));
  ro.observe(racine); cadrer(racine, scene, f);
  racine.demonter = () => { ro.disconnect(); racine.remove(); };
  if(fondu) requestAnimationFrame(() => requestAnimationFrame(() => racine.classList.remove('entre')));
  return racine;
}

// Remplace le fond courant d'un conteneur par un autre, en fondu lent.
export async function changer(conteneur, id, options = {}){
  const anciens = Array.from(conteneur.querySelectorAll(':scope > .fond'));
  const fondu = options.fondu ?? 3;
  const neuf = await monter(conteneur, id, { ...options, fondu: anciens.length ? fondu : 0 });
  anciens.forEach(a => { a.style.setProperty('--fondu', fondu + 's'); a.classList.add('sort'); setTimeout(() => a.demonter && a.demonter(), fondu * 1000 + 200); });
  return neuf;
}

// Vérification : fige toutes les couches à une fraction (0 à 1) de leur boucle.
export function figer(racine, fraction){
  racine.querySelectorAll('.fond-c.anim').forEach(el => {
    const dur = parseFloat(getComputedStyle(el).animationDuration) || 60;
    el.style.animationDelay = (-dur * fraction) + 's';
    el.style.animationPlayState = 'paused';
  });
}
