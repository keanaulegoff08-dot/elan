// Les cinq domaines de vie et leurs couleurs vives (les tâches, elles, gardent des couleurs douces).
import { S } from './store.js';
import { sod } from './dates.js';

export const DOMAINES = [
  { id:'personnel',     nom:'Personnel',     c:'#7C4DFF' },
  { id:'financier',     nom:'Financier',     c:'#00B37A' },
  { id:'professionnel', nom:'Professionnel', c:'#1677FF' },
  { id:'social',        nom:'Social',        c:'#FF3D71' },
  { id:'sportif',       nom:'Sportif',       c:'#FF7A00' },
];
export const domaine = id => DOMAINES.find(d => d.id === id) || DOMAINES[0];

// Progression d'un rêve : étapes cochées et tâches liées ; à défaut, pourcentage saisi à la main.
export function progression(r){
  const taches = (r.taskIds || []).map(id => S.tasks.find(t => t.id === id)).filter(t => t && !t.dropped);
  const total = (r.steps || []).length + taches.length;
  if(!total) return { pct: Math.max(0, Math.min(100, r.manualPct || 0)), faits: 0, total: 0, manuel: true };
  const faits = r.steps.filter(s => s.done).length + taches.filter(t => t.done).length;
  return { pct: Math.round(faits / total * 100), faits, total, manuel: false };
}
// Jours restants avant une date 'AAAA-MM-JJ' (négatif si passée).
export function joursAvant(jour){
  if(!jour) return null;
  const [y, m, d] = jour.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - sod(new Date())) / 864e5);
}
export const dansTexte = n => n === null ? 'Sans échéance' : n < 0 ? `Échéance passée de ${-n} j` : n === 0 ? "C'est aujourd'hui" : n === 1 ? 'Demain' : n < 60 ? `Dans ${n} jours` : n < 730 ? `Dans ${Math.round(n / 30.4)} mois` : `Dans ${(n / 365).toFixed(1).replace('.', ',')} ans`;
export const revesActifs = () => S.dreams.filter(r => !r.achievedAt);
export const revesProches = n => revesActifs().filter(r => r.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, n);

// Trajectoire d'un rêve : un arc en pointillé, la partie parcourue en couleur, un point lumineux là où tu en es.
export function arcVol(pct, c){
  const P0 = [10, 50], P1 = [150, -22], P2 = [290, 50], N = 48, pts = [], L = [0];
  for(let i = 0; i <= N; i++){ const t = i / N, u = 1 - t; pts.push([u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]]); }
  for(let i = 1; i <= N; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const p = Math.max(0, Math.min(100, pct || 0)), cible = L[N] * p / 100;
  let i = 1; while(i < N && L[i] < cible) i++;
  const k = L[i] === L[i - 1] ? 0 : (cible - L[i - 1]) / (L[i] - L[i - 1]);
  const x = (pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k).toFixed(1), y = (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k).toFixed(1);
  const d = `M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`;
  return `<span class="vol"><svg viewBox="0 0 300 58" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="0.1 6" stroke-linecap="round" opacity=".55"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" pathLength="100" stroke-dasharray="${p} 100"/>
    <circle cx="${P2[0]}" cy="${P2[1]}" r="4.5" fill="none" stroke="${c}" stroke-width="1.6" opacity="${p >= 100 ? 1 : .5}"/>
    <circle cx="${x}" cy="${y}" r="9" fill="${c}" opacity=".18"/><circle cx="${x}" cy="${y}" r="4.6" fill="${c}" stroke="var(--plein)" stroke-width="2"/>
  </svg></span>`;
}
