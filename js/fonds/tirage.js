// Tirage des fonds. Calendrier : au hasard parmi les fonds de saison, mémorisé par mois et par année,
// jamais le même deux mois de suite. Pomodoro : au hasard dans toute la bibliothèque.
import { S, save } from '../noyau/store.js';
import { fondsActifs, fondParId } from './moteur.js';

const pad = n => String(n).padStart(2, '0');
export const cleMois = (y, m) => `${y}-${pad(m + 1)}`; // m : 0 à 11
const voisin = (y, m, pas) => { const d = new Date(y, m + pas, 1); return cleMois(d.getFullYear(), d.getMonth()); };
const hasard = t => t[Math.floor(Math.random() * t.length)];

export function tirerMois(y, m, { force = false } = {}){
  const W = S.wallpapers, cle = cleMois(y, m);
  const avant = W.pins[voisin(y, m, -1)] || W.draws[voisin(y, m, -1)], apres = W.pins[voisin(y, m, 1)] || W.draws[voisin(y, m, 1)];
  const actifs = fondsActifs();
  let pool = actifs.filter(f => f.mois.includes(m + 1));
  if(!pool.length) pool = actifs;
  let choix = pool.filter(f => f.id !== avant && f.id !== apres);
  if(force) { const sans = choix.filter(f => f.id !== W.draws[cle]); if(sans.length) choix = sans; }
  if(!choix.length) choix = pool.filter(f => f.id !== avant);
  if(!choix.length) choix = pool;
  if(!choix.length) return null;
  W.draws[cle] = hasard(choix).id; save();
  return W.draws[cle];
}
// Fond d'un mois : celui fixé dans Réglages, sinon le tirage mémorisé, sinon un nouveau tirage.
export function fondDuMois(y, m){
  const W = S.wallpapers, cle = cleMois(y, m);
  if(W.pins[cle] && fondParId(W.pins[cle])) return W.pins[cle];
  if(W.draws[cle] && fondParId(W.draws[cle]) && !W.off.includes(W.draws[cle])) return W.draws[cle];
  return tirerMois(y, m);
}
export function fondAuHasard(sauf = null){
  const t = fondsActifs(), autres = t.filter(f => f.id !== sauf);
  return (autres.length ? hasard(autres) : t.length ? t[0] : null)?.id || null;
}
