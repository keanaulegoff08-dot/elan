// Mois compact de la barre latérale : tous les jours et les numéros de semaine, sans débordement.
import { ymd, addDays, monday, isoWeek, MOIS, cap } from './dates.js';

export function miniCal(ref = new Date(), marques = {}){
  const y = ref.getFullYear(), m = ref.getMonth(), auj = ymd(new Date());
  let d = monday(new Date(y, m, 1));
  const fin = new Date(y, m + 1, 0);
  let rows = '';
  while(d <= fin){
    let cells = `<span class="mc-w">${isoWeek(d)}</span>`;
    for(let i = 0; i < 7; i++){
      const j = addDays(d, i), k = ymd(j), hors = j.getMonth() !== m;
      cells += `<button class="mc-d ${hors?'hors':''} ${k===auj?'auj':''}" data-jour="${k}" ${hors?'tabindex="-1"':''} aria-label="${j.getDate()} ${MOIS[j.getMonth()]}">${j.getDate()}${marques[k]?`<i style="--c:${marques[k]}"></i>`:''}</button>`;
    }
    rows += `<div class="mc-r">${cells}</div>`;
    d = addDays(d, 7);
  }
  return `<div class="minical" aria-label="${cap(MOIS[m])} ${y}">
    <div class="mc-t">${cap(MOIS[m])} <span>${y}</span></div>
    <div class="mc-r mc-h"><span class="mc-w">S</span>${['L','M','M','J','V','S','D'].map(l => `<span>${l}</span>`).join('')}</div>${rows}</div>`;
}
