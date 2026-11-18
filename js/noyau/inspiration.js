// Sources d'inspiration : souvenirs (photos converties), personnes, citations, rêves, repères.
// Les photos ne sont jamais toutes chargées : on ne garde que l'index, et une image à la fois.
import { S, mediaUrl } from './store.js';
import { revesActifs } from './domaines.js';

let index = null;
export async function indexSouvenirs(force = false){
  if(index && !force) return index;
  try{ index = window.desktop && window.desktop.souvenirsIndex ? await window.desktop.souvenirsIndex() : []; }catch(e){ index = []; }
  return index;
}
export const urlSouvenir = p => mediaUrl('souvenirs/' + p.f);
export async function albums(){
  const m = new Map();
  for(const p of await indexSouvenirs()) m.set(p.a, (m.get(p.a) || 0) + 1);
  return [...m].map(([nom, n]) => ({ nom, n })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
// Photos en service pour un usage : 'pomodoro' (albums activés) ou 'accueil' (albums choisis pour l'accueil).
export async function enService(usage){
  const off = new Set(S.souvenirs.albumsOff), retirees = new Set(S.souvenirs.photosOff), accueil = new Set(S.souvenirs.accueil);
  return (await indexSouvenirs()).filter(p => !retirees.has(p.e) && !off.has(p.a) && (!p.c || S.souvenirs.captures) && (usage !== 'accueil' || !accueil.size || accueil.has(p.a)));
}
// Tirage aléatoire sans répétition : une file mélangée, vidée photo par photo, refaite une fois épuisée.
const CLE = u => 'elan-file-souvenirs-' + u;
export async function tirerSouvenir(usage = 'pomodoro'){
  const dispo = await enService(usage); if(!dispo.length) return null;
  const parId = new Map(dispo.map(p => [p.e, p]));
  let file = [];
  try{ file = JSON.parse(localStorage.getItem(CLE(usage)) || '[]'); }catch(e){}
  file = file.filter(e => parId.has(e));
  if(!file.length){
    file = dispo.map(p => p.e);
    for(let i = file.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [file[i], file[j]] = [file[j], file[i]]; }
  }
  const e = file.pop();
  try{ localStorage.setItem(CLE(usage), JSON.stringify(file)); }catch(err){}
  return parId.get(e);
}
export const auHasard = t => t.length ? t[Math.floor(Math.random() * t.length)] : null;
export const reperesActifs = () => S.markers.filter(m => m.on !== false);
export const NOM_REPERE = { appui: "Point d'appui", vigilance: 'Point de vigilance' };

// Prochain élément inspirant, en alternant les types disponibles.
let tour = [];
export async function prochaineInspiration(){
  const types = [];
  if((await enService('pomodoro')).length) types.push('souvenir');
  if(S.people.length) types.push('personne');
  if(S.quotes.length) types.push('citation');
  if(revesActifs().length) types.push('reve');
  if(reperesActifs().length) types.push('repere');
  if(!types.length) return null;
  tour = tour.filter(t => types.includes(t));
  if(!tour.length) tour = types.slice().sort(() => Math.random() - .5);
  const type = tour.pop();
  if(type === 'souvenir'){ const p = await tirerSouvenir('pomodoro'); return p && { type, image: urlSouvenir(p), legende: p.a.split(' / ').pop() }; }
  if(type === 'personne'){ const p = auHasard(S.people); return { type, image: mediaUrl(p.rel), legende: p.name }; }
  if(type === 'citation'){ const q = auHasard(S.quotes); return { type, texte: q.text, auteur: q.author }; }
  if(type === 'reve') return { type, reve: auHasard(revesActifs()) };
  return { type, repere: auHasard(reperesActifs()) };
}
