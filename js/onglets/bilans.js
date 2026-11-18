// Onglet « Bilans journaliers » : ce qui était bien, ce qui ne l'était pas, ce qui peut être amélioré.
// Texte dans elan-data.json ; photos et fichiers sous media/bilans/<date>/.
import { I } from '../noyau/icones.js';
import { ymd, addDays, sod, MOIS, JOURS, cap } from '../noyau/dates.js';
import { S, save, uid, mediaUrl } from '../noyau/store.js';
import { $, esc, toast, autoGrandir, dateLongue } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { NOM_REPERE } from '../noyau/inspiration.js';

const ui = { date: null };
const render = () => app.rendre();
const PARTIES = [
  { k: 'good', titre: 'Ce qui était bien', aide: 'Les réussites, les bons moments, ce dont tu es fier.', repere: 'appui', ton: 'bien' },
  { k: 'bad',  titre: "Ce qui n'était pas bien", aide: 'Sans jugement : ce qui a pesé, ce qui a dérapé.', repere: 'vigilance', ton: 'mal' },
  { k: 'next', titre: 'Ce que je peux améliorer', aide: 'Pour demain ou pour la suite : une action concrète.', repere: null, ton: 'suite' },
];
const vide = b => !b || (!(b.good || '').trim() && !(b.bad || '').trim() && !(b.next || '').trim() && !(b.files || []).length);
export const aBilan = k => !vide(S.reviews[k]);
const titreJour = k => { const d = dateLongue(k); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
export const nomJour = k => { const auj = ymd(new Date()); return k === auj ? "aujourd'hui" : k === ymd(addDays(new Date(), -1)) ? 'hier' : titreJour(k); };

// Journées récentes (trois au plus) sans bilan et non écartées, la plus récente d'abord.
export function bilansEnAttente(){
  const out = [], depuis = S.settings.bilansDepuis || ymd(new Date());
  for(let i = 1; i <= 3; i++){ const k = ymd(addDays(sod(new Date()), -i)); if(k >= depuis && !aBilan(k) && !S.skipReviews[k]) out.push(k); }
  return out;
}
export function ecarterBilans(){ bilansEnAttente().forEach(k => { S.skipReviews[k] = true; }); save(); }
export function entrer(p){ ui.date = (p && p.date) || bilansEnAttente()[0] || ymd(new Date()); }

function historique(){
  const jours = Object.keys(S.reviews).filter(aBilan).sort().reverse(), groupes = [];
  for(const k of jours){ const g = k.slice(0, 7); let x = groupes[groupes.length - 1]; if(!x || x.g !== g){ x = { g, jours: [] }; groupes.push(x); } x.jours.push(k); }
  const attente = bilansEnAttente();
  return `<aside class="bil-histo">
    <label class="etiq">Consulter une date<input type="date" class="inp" id="bilDate" value="${ui.date}" max="${ymd(new Date())}"></label>
    ${attente.length ? `<div class="bil-groupe"><h4>En attente</h4>${attente.map(k => `<button data-bil="${k}" class="attente ${k === ui.date ? 'on' : ''}">${cap(nomJour(k))}</button>`).join('')}</div>` : ''}
    ${groupes.map(g => { const [y, m] = g.g.split('-').map(Number); return `<div class="bil-groupe"><h4>${cap(MOIS[m - 1])} ${y}</h4>${g.jours.map(k => `<button data-bil="${k}" class="${k === ui.date ? 'on' : ''}">${cap(titreJour(k))}</button>`).join('')}</div>`; }).join('') || '<p class="note">Tes bilans apparaîtront ici, jour après jour.</p>'}
  </aside>`;
}
export function rendre(vue){
  if(!ui.date) entrer();
  const k = ui.date, b = S.reviews[k] || {}, d = dateLongue(k);
  const reperes = S.markers.filter(m => m.date === k);
  const images = (b.files || []).filter(f => f.img), autres = (b.files || []).filter(f => !f.img);
  vue.innerHTML = `<div class="bil">
    <div class="bil-page">
      <div class="head"><div><div class="eyebrow">Bilan ${k === ymd(new Date()) ? "d'aujourd'hui" : k === ymd(addDays(new Date(), -1)) ? "d'hier" : 'du'}</div><h1><em>${cap(JOURS[d.getDay()])} ${d.getDate()}</em> ${MOIS[d.getMonth()]}</h1></div><span class="bil-etat" id="bilEtat">${aBilan(k) ? 'Enregistré' : ''}</span></div>
      ${PARTIES.map(p => `<section class="bil-partie ${p.ton}">
        <h3>${p.titre}</h3>
        <textarea class="bil-texte" data-bil-champ="${p.k}" rows="2" placeholder="${p.aide}">${esc(b[p.k] || '')}</textarea>
        ${p.repere ? `<div class="bil-reperes">${reperes.filter(m => m.kind === p.repere).map(m => `<span class="repere ${m.kind}">${esc(m.text)}<button data-bil-repere-del="${m.id}" title="Retirer">${I.close}</button></span>`).join('')}
          <form class="mini-add repere-add" data-kind="${p.repere}" autocomplete="off">${I.plus}<input placeholder="En faire un ${NOM_REPERE[p.repere].toLowerCase()} : un élément marquant à garder en tête…"></form></div>` : ''}
      </section>`).join('')}
      <section class="bil-partie pieces-bil"><h3>Photos et fichiers</h3>
        ${images.length ? `<div class="bil-photos">${images.map(f => `<figure><img src="${mediaUrl(f.rel)}" alt="" loading="lazy"><button class="icon-btn sm" data-bil-file-del="${f.id}" title="Retirer">${I.close}</button></figure>`).join('')}</div>` : ''}
        <div class="pieces">${autres.map(f => `<div class="piece"><button class="piece-o" data-fileopen="${esc(f.rel)}">${I.fichier}<span>${esc(f.nom)}</span></button><button class="icon-btn sm" data-bil-file-del="${f.id}" title="Retirer">${I.close}</button></div>`).join('')}</div>
        ${window.desktop ? `<div class="ligne"><button class="btn" data-bil-act="photos">${I.plus}Ajouter des photos</button><button class="btn" data-bil-act="fichiers">${I.clip}Joindre un fichier</button></div>` : ''}
      </section>
    </div>${historique()}</div>`;
  vue.querySelectorAll('.bil-texte').forEach(ta => {
    autoGrandir(ta);
    ta.addEventListener('input', () => {
      autoGrandir(ta);
      const cur = S.reviews[k] || (S.reviews[k] = { good: '', bad: '', next: '', files: [], at: new Date().toISOString() });
      cur[ta.dataset.bilChamp] = ta.value; cur.maj = new Date().toISOString();
      if(vide(cur)) delete S.reviews[k];
      save(); $('#bilEtat').textContent = aBilan(k) ? 'Enregistré' : '';
    });
  });
  $('#bilDate').addEventListener('change', e => { if(e.target.value){ ui.date = e.target.value; render(); } });
}
const bilan = () => S.reviews[ui.date] || (S.reviews[ui.date] = { good: '', bad: '', next: '', files: [], at: new Date().toISOString() });

app.clics.push((e) => {
  const tg = e.target.closest('[data-bil],[data-bil-act],[data-bil-file-del],[data-bil-repere-del]'); if(!tg) return false;
  const d = tg.dataset;
  if(d.bil){ ui.date = d.bil; $('#main').scrollTop = 0; render(); return true; }
  if(d.bilRepereDel){ S.markers = S.markers.filter(m => m.id !== d.bilRepereDel); save(); render(); return true; }
  if(d.bilFileDel){ const b = S.reviews[ui.date]; if(b){ const f = b.files.find(x => x.id === d.bilFileDel); b.files = b.files.filter(x => x.id !== d.bilFileDel); if(f && window.desktop) window.desktop.retirerPiece(f.rel); if(vide(b)) delete S.reviews[ui.date]; save(); render(); } return true; }
  if(d.bilAct && window.desktop){
    const jour = ui.date, photos = d.bilAct === 'photos';
    (photos ? window.desktop.importerImages('bilans/' + jour) : window.desktop.joindre('bilans/' + jour)).then(fs => {
      if(!fs.length) return;
      const b = S.reviews[jour] || (S.reviews[jour] = { good: '', bad: '', next: '', files: [], at: new Date().toISOString() });
      fs.forEach(f => { if(!b.files.some(x => x.rel === f.rel)) b.files.push({ id: uid(), nom: f.nom, rel: f.rel, taille: f.taille || 0, img: photos }); });
      save(); render(); toast(fs.length > 1 ? `${fs.length} éléments ajoutés` : 'Ajouté au bilan');
    });
    return true;
  }
  return false;
});
document.addEventListener('submit', e => {
  const f = e.target.closest('.repere-add'); if(!f) return;
  e.preventDefault(); const inp = f.querySelector('input'), v = inp.value.trim(); if(!v) return;
  bilan(); S.markers.push({ id: uid(), text: v, kind: f.dataset.kind, date: ui.date, on: true }); save(); render();
  toast(`${NOM_REPERE[f.dataset.kind]} ajouté à tes repères`);
});
