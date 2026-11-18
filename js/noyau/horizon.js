// L'horizon : la destination du mois teinte toute l'application.
// Derrière les pages, son illustration devient un ciel de couleurs douces : elle est peinte une fois,
// en petit et floutée, dans une image fixe (aucun flou à recalculer ensuite, donc aucune charge pour le Mac) ;
// dans la barre latérale, la carte de cap la montre nette, avec ses coordonnées et l'heure qu'il y est.
import { I } from './icones.js';
import { S, mediaUrl } from './store.js';
import { esc } from './ui.js';
import { changer, fondParId } from '../fonds/moteur.js';
import { fondDuMois, fondAuHasard } from '../fonds/tirage.js';
import { LIEUX, coordonnees, heureLocale } from '../fonds/lieux.js';

let survol = null;        // destination choisie à la main pour cette session (sinon : celle du mois)
let monte = null, carte = null;

export const actif = () => S.settings.horizon !== false;
export function capCourant(){
  if(survol && fondParId(survol)) return survol;
  const d = new Date();
  return fondDuMois(d.getFullYear(), d.getMonth());
}
const fiche = id => { const f = id && fondParId(id); return f ? { id, nom: f.nom, perso: !!f.photo, ...(LIEUX[id] || {}) } : null; };
export const destination = () => fiche(capCourant());

function texteCap(){
  const d = destination(); if(!d) return '';
  const heure = d.tz ? heureLocale(d) : '';
  return `<small>${survol ? 'En survol' : 'Cap du mois'}</small><b>${esc(d.nom)}</b>${d.lat !== undefined ? `<span>${coordonnees(d)}${heure ? ` · ${heure} là-bas` : ''}</span>` : ''}`;
}
// Carte de cap : un seul élément, conservé d'un redessin à l'autre.
export function carteCap(){
  if(!carte){
    carte = document.createElement('div'); carte.className = 'cap';
    carte.innerHTML = `<div class="cap-vue" aria-hidden="true"></div><div class="cap-txt"></div><button class="cap-btn" data-cap="autre" title="Survoler une autre destination" aria-label="Survoler une autre destination">${I.cap}</button>`;
  }
  carte.querySelector('.cap-txt').innerHTML = texteCap();
  return carte;
}
// Peint l'illustration en 384×216, floutée et un peu saturée, et renvoie l'image (gardée en mémoire).
const ciels = new Map();
function imageSvg(svg){
  return new Promise((ok, ko) => {
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), img = new Image();
    img.onload = () => { URL.revokeObjectURL(u); ok(img); }; img.onerror = () => { URL.revokeObjectURL(u); ko(new Error('svg')); };
    img.src = u;
  });
}
async function peindre(id){
  if(ciels.has(id)) return ciels.get(id);
  const f = fondParId(id); let ciel = null;
  if(f && f.photo) ciel = { url: mediaUrl(f.photo), photo: true };   // photo personnelle : floutée par le navigateur
  else if(f){
    const ill = (await f.charge()).default, W = 384, H = 216;
    const a = document.createElement('canvas'); a.width = W; a.height = H;
    const x = a.getContext('2d'); x.fillStyle = ill.teinte || '#8fa6c4'; x.fillRect(0, 0, W, H);
    for(const c of ill.couches){ if(c.svg){ try{ x.drawImage(await imageSvg(c.svg), 0, 0, W, H); }catch(e){} } }
    const b = document.createElement('canvas'); b.width = W; b.height = H;
    const y = b.getContext('2d'); y.filter = 'blur(13px) saturate(1.4)'; y.drawImage(a, -26, -26, W + 52, H + 52);
    ciel = { url: b.toDataURL('image/jpeg', .9), photo: false };
  }
  ciels.set(id, ciel); return ciel;
}
async function poserCiel(zone, id){
  const scene = zone.querySelector('.horizon-scene'), ciel = await peindre(id); if(!ciel) return;
  const img = document.createElement('div'); img.className = 'horizon-img' + (ciel.photo ? ' photo' : '');
  img.style.backgroundImage = `url("${ciel.url.replace(/"/g, '%22')}")`;
  const anciennes = Array.from(scene.children);
  scene.appendChild(img);
  requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('vu')));
  anciennes.forEach(a => setTimeout(() => a.remove(), 2600));
}
export async function monterHorizon(){
  const zone = document.querySelector('#horizon'); if(!zone) return;
  const id = capCourant();
  zone.classList.toggle('sans', !actif() || !id);
  if(!id) return;
  if(monte === id) return;
  monte = id;
  try{
    if(actif()) await poserCiel(zone, id); else zone.querySelector('.horizon-scene').innerHTML = '';
    await changer(carteCap().querySelector('.cap-vue'), id, { anim: false, fondu: 1.2 });
  }catch(e){}
  carteCap();
}
export function rafraichirHorizon(){ monte = null; return monterHorizon(); }
export function autreCap(){
  survol = fondAuHasard(capCourant());
  return monterHorizon();
}
export const tictac = () => { if(carte) carte.querySelector('.cap-txt').innerHTML = texteCap(); };
