// Onglet « Mes rêves » : cinq domaines de vie, progression par étapes, encouragements, célébrations.
import { I } from '../noyau/icones.js';
import { ymd, MOIS, cap } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast, notify, celebrer, autoGrandir, dateLongue } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { DOMAINES, domaine, progression, joursAvant, dansTexte, arcVol } from '../noyau/domaines.js';
import { triable, deplacer } from '../noyau/glisser.js';
import { ouvrirTache } from './taches.js';

const ui = { domaine: null, sel: null, nouveau: false };
const render = () => app.rendre();
const reve = id => S.dreams.find(r => r.id === id);
const dateFr = k => { const d = dateLongue(k); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };

export function entrer(p){ ui.sel = p && p.id ? p.id : null; ui.nouveau = !!(p && p.nouveau); }

// Message discret, adapté à l'état du rêve.
export function encouragement(r){
  const p = progression(r), j = joursAvant(r.deadline), suite = (r.steps || []).find(s => !s.done);
  if(r.achievedAt) return 'Atteint. Garde-le en mémoire : tu sais le faire.';
  if(j !== null && j < 0) return "L'échéance est passée. La reporter ou finir : les deux sont honorables.";
  if(p.total && p.faits === p.total) return 'Toutes les étapes sont franchies. Il ne reste qu’à le déclarer atteint.';
  if(j !== null && j <= 30) return `Échéance ${dansTexte(j).toLowerCase()}.${suite ? ` Prochaine étape : « ${suite.title} ».` : ''}`;
  if(!p.total && !p.pct) return 'Découpe-le en étapes : la première est toujours la plus petite.';
  if(p.pct >= 80) return 'Tu y es presque.';
  if(p.pct >= 50) return 'Plus de la moitié du chemin est derrière toi.';
  return suite ? `Prochaine étape : « ${suite.title} ».` : 'Un pas aujourd’hui suffit.';
}

function carte(r){
  const d = domaine(r.domain), p = progression(r), j = joursAvant(r.deadline);
  return `<button class="reve ${r.achievedAt ? 'atteint' : ''}" data-reve="${r.id}" style="--d:${d.c}">
    <span class="reve-dom">${d.nom}</span>
    <span class="reve-t">${esc(r.title)}</span>
    ${r.desc ? `<span class="reve-desc">${esc(r.desc)}</span>` : ''}
    ${arcVol(r.achievedAt ? 100 : p.pct, d.c)}
    <span class="reve-bas"><span class="reve-ech ${j !== null && j < 0 && !r.achievedAt ? 'passe' : ''}">${r.achievedAt ? 'Atteint' : dansTexte(j)}</span><b class="tab">${p.pct} %</b></span>
  </button>`;
}
function formulaire(){
  return `<form class="carte reve-form" id="reveForm" autocomplete="off">
    <input class="titre-champ" id="rvTitre" placeholder="Mon rêve…" aria-label="Titre du rêve">
    <div class="dom-pick">${DOMAINES.map((d, i) => `<label style="--d:${d.c}"><input type="radio" name="dom" value="${d.id}" ${(ui.domaine ? ui.domaine === d.id : i === 0) ? 'checked' : ''}><span>${d.nom}</span></label>`).join('')}</div>
    <textarea class="inp" id="rvDesc" rows="2" placeholder="Pourquoi il compte, à quoi ressemblera le jour où il sera atteint…"></textarea>
    <div class="ligne"><label class="etiq">Échéance<input type="date" class="inp" id="rvDate" min="${ymd(new Date())}"></label><span class="pousse"></span><button type="button" class="btn ghost" data-ract="annuler">Annuler</button><button class="btn fort">Créer ce rêve</button></div>
  </form>`;
}
function liste(vue){
  const tous = S.dreams.filter(r => !ui.domaine || r.domain === ui.domaine);
  const actifs = tous.filter(r => !r.achievedAt).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const atteints = tous.filter(r => r.achievedAt);
  vue.innerHTML = `
    <div class="head"><div><div class="eyebrow">Cinq domaines de vie</div><h1>Mes <em>rêves</em></h1></div>
      ${ui.nouveau ? '' : `<button class="btn fort" data-ract="nouveau">${I.plus}Nouveau rêve</button>`}</div>
    <div class="filters dom-filtres"><button class="chip ${!ui.domaine ? 'on' : ''}" data-rdom="">Tous</button>${DOMAINES.map(d => `<button class="chip dom ${ui.domaine === d.id ? 'on' : ''}" data-rdom="${d.id}" style="--d:${d.c}"><span class="dot"></span>${d.nom}<span class="ct tab">${S.dreams.filter(r => r.domain === d.id && !r.achievedAt).length || ''}</span></button>`).join('')}</div>
    ${ui.nouveau ? formulaire() : ''}
    ${actifs.length ? `<div class="reves">${actifs.map(carte).join('')}</div>` : (ui.nouveau ? '' : `<div class="empty"><b>${S.dreams.length ? 'Aucun rêve dans ce domaine.' : 'Écris ton premier rêve.'}</b>Un titre, une échéance, puis quelques étapes : c'est tout ce qu'il faut pour commencer.</div>`)}
    ${atteints.length ? `<div class="sec-h" style="margin-top:36px"><h2>Atteints</h2><span class="n">${atteints.length}</span></div><div class="reves">${atteints.map(carte).join('')}</div>` : ''}`;
  if(ui.nouveau) setTimeout(() => $('#rvTitre') && $('#rvTitre').focus(), 30);
}
function anneau(pct, c){
  const R = 52, C = 2 * Math.PI * R;
  return `<div class="anneau" style="--d:${c}"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--line)" stroke-width="4"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 60 60)"/></svg><b class="tab">${pct}<small>%</small></b></div>`;
}
function detail(vue, r){
  const d = domaine(r.domain), p = progression(r), j = joursAvant(r.deadline);
  const liees = (r.taskIds || []).map(id => S.tasks.find(t => t.id === id)).filter(Boolean);
  const libres = S.tasks.filter(t => !t.archived && !t.done && !(r.taskIds || []).includes(t.id));
  const tout = p.total > 0 && p.faits === p.total && !r.achievedAt;
  vue.innerHTML = `
    <button class="retour" data-ract="retour">${I.gauche}Mes rêves</button>
    <div class="reve-detail" style="--d:${d.c}">
      <div class="reve-tete">
        <div class="reve-tete-g">
          <div class="dom-pick compact">${DOMAINES.map(x => `<button class="${x.id === r.domain ? 'on' : ''}" data-rset-dom="${x.id}" style="--d:${x.c}">${x.nom}</button>`).join('')}</div>
          <textarea class="titre-champ grand" id="rdTitre" rows="1" aria-label="Titre">${esc(r.title)}</textarea>
          <p class="reve-mot">${esc(encouragement(r))}</p>
        </div>
        ${anneau(p.pct, d.c)}
      </div>
      ${tout ? `<div class="bandeau fort"><p><b>Toutes les étapes sont franchies.</b><small>Ce rêve est-il atteint ?</small></p><button class="btn fort" data-ract="atteint">Oui, il est atteint</button></div>` : ''}
      <div class="grille-2">
        <div class="carte"><h4>Échéance</h4><input type="date" class="inp" id="rdDate" value="${r.deadline || ''}"><p class="note">${r.deadline ? `${dansTexte(j)} · ${dateFr(r.deadline)}` : 'Une date rend le rêve concret.'}</p></div>
        <div class="carte"><h4>Description</h4><textarea class="inp" id="rdDesc" rows="3" placeholder="Pourquoi il compte…">${esc(r.desc || '')}</textarea></div>
      </div>
      <div class="carte"><h4>Étapes${r.steps.length ? ` · ${r.steps.filter(s => s.done).length}/${r.steps.length}` : ''}</h4>
        <div class="subs" id="rdEtapes">${r.steps.map(s => `<div class="sub ${s.done ? 'done' : ''}" data-sub-id="${s.id}"><button class="sub-grip" title="Glisser pour changer l'ordre" aria-label="Déplacer l'étape (flèches haut et bas)">${I.grip}</button><button class="check sm" data-rstep="${s.id}" aria-label="Étape">${I.check}</button><textarea class="sub-t" rows="1" data-rstep-t="${s.id}" aria-label="Étape">${esc(s.title)}</textarea><span class="note">${s.done && s.doneAt ? 'le ' + new Date(s.doneAt).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : ''}</span><button class="icon-btn sm" data-rstep-del="${s.id}" title="Retirer">${I.close}</button></div>`).join('')}</div>
        <form class="mini-add" id="etapeAdd" autocomplete="off">${I.plus}<input id="etapeInput" placeholder="Ajouter une étape…"></form>
      </div>
      <div class="carte"><h4>Tâches liées</h4>
        <div class="pieces">${liees.map(t => `<div class="piece"><button class="piece-o ${t.done ? 'fait' : ''}" data-rtask="${t.id}">${I.taches}<span>${esc(t.title)}</span><small>${t.done ? 'faite' : 'à faire'}</small></button><button class="icon-btn sm" data-rtask-del="${t.id}" title="Délier">${I.close}</button></div>`).join('')}</div>
        ${libres.length ? `<select class="inp" id="rdLier"><option value="">Lier une tâche existante…</option>${libres.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>` : '<p class="note">Aucune tâche ouverte à lier.</p>'}
      </div>
      ${p.manuel ? `<div class="carte"><h4>Progression estimée · <span class="tab" id="rdPctV">${p.pct} %</span></h4><input type="range" min="0" max="100" step="5" value="${p.pct}" id="rdPct" style="--d:${d.c}"><p class="note">Sans étape ni tâche liée, tu règles la progression à la main.</p></div>` : ''}
      <div class="ligne bas">${r.achievedAt ? `<button class="btn" data-ract="rouvrir">Rouvrir ce rêve</button>` : (tout ? '' : `<button class="btn" data-ract="atteint">${I.check}Marquer comme atteint</button>`)}<span class="pousse"></span><button class="btn ghost danger" data-ract="supprimer">${I.trash}Supprimer</button></div>
    </div>`;
  const ti = $('#rdTitre'); autoGrandir(ti);
  ti.addEventListener('input', () => { autoGrandir(ti); r.title = ti.value.replace(/\n/g, ' '); save(); });
  $('#rdDesc').addEventListener('input', e => { r.desc = e.target.value; save(); });
  $('#rdDate').addEventListener('change', e => { r.deadline = e.target.value || null; r.rappels = []; save(); render(); });
  const lier = $('#rdLier'); if(lier) lier.addEventListener('change', () => { if(lier.value){ r.taskIds.push(lier.value); save(); render(); } });
  const pct = $('#rdPct'); if(pct){ pct.addEventListener('input', () => { r.manualPct = +pct.value; $('#rdPctV').textContent = pct.value + ' %'; save(); }); pct.addEventListener('change', render); }
  vue.querySelectorAll('[data-rstep-t]').forEach(inp => {
    inp.addEventListener('change', () => { const s = r.steps.find(x => x.id === inp.dataset.rstepT), v = inp.value.replace(/\s*\n\s*/g, ' ').trim(); if(s && v){ s.title = v; inp.value = v; save(); } });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); } });
  });
  triable($('#rdEtapes'), { fin: (de, vers) => { deplacer(r.steps, de, vers); save(); render(); } });
}
export function rendre(vue){
  const r = ui.sel && reve(ui.sel);
  if(r) detail(vue, r); else { ui.sel = null; liste(vue); }
}

app.clics.push((e) => {
  const tg = e.target.closest('[data-reve],[data-rdom],[data-ract],[data-rset-dom],[data-rstep],[data-rstep-del],[data-rtask],[data-rtask-del]'); if(!tg) return false;
  const d = tg.dataset, r = reve(ui.sel);
  if(d.reve){ app.aller('reves', { id: d.reve }); return true; }
  if(d.rdom !== undefined){ ui.domaine = d.rdom || null; render(); return true; }
  if(d.rsetDom && r){ r.domain = d.rsetDom; save(); render(); return true; }
  if(d.rstep && r){
    const s = r.steps.find(x => x.id === d.rstep); if(!s) return true;
    s.done = !s.done; s.doneAt = s.done ? new Date().toISOString() : null; save();
    if(s.done){ const b = tg.getBoundingClientRect(); celebrer(b.left + b.width / 2, b.top + b.height / 2, domaine(r.domain).c); const p = progression(r); toast(`Étape franchie · ${p.faits} sur ${p.total}`); }
    render(); return true;
  }
  if(d.rstepDel && r){ r.steps = r.steps.filter(x => x.id !== d.rstepDel); save(); render(); return true; }
  if(d.rtask){ ouvrirTache(d.rtask); return true; }
  if(d.rtaskDel && r){ r.taskIds = r.taskIds.filter(x => x !== d.rtaskDel); save(); render(); return true; }
  switch(d.ract){
    case 'nouveau': ui.nouveau = true; render(); break;
    case 'annuler': ui.nouveau = false; render(); break;
    case 'retour': ui.sel = null; render(); break;
    case 'atteint': if(r){ r.achievedAt = new Date().toISOString(); save(); celebrer(innerWidth / 2, innerHeight / 3, domaine(r.domain).c); toast('Rêve atteint. Bravo.'); render(); } break;
    case 'rouvrir': if(r){ r.achievedAt = null; save(); render(); } break;
    case 'supprimer': if(r){
      if(d.confirm !== '1'){ d.confirm = '1'; tg.lastChild.textContent = 'Confirmer la suppression'; break; }
      const i = S.dreams.indexOf(r); S.dreams.splice(i, 1); ui.sel = null; save(); render();
      toast('Rêve supprimé', () => { S.dreams.splice(i, 0, r); save(); render(); });
    } break;
    default: return false;
  }
  return true;
});
document.addEventListener('submit', e => {
  if(e.target.id === 'reveForm'){
    e.preventDefault(); const t = $('#rvTitre').value.trim(); if(!t){ $('#rvTitre').focus(); return; }
    const r = { id: uid(), title: t, desc: $('#rvDesc').value.trim(), domain: e.target.querySelector('input[name=dom]:checked').value, deadline: $('#rvDate').value || null, steps: [], taskIds: [], manualPct: 0, createdAt: new Date().toISOString(), achievedAt: null, rappels: [] };
    S.dreams.push(r); save(); ui.nouveau = false; app.aller('reves', { id: r.id });
  }
  if(e.target.id === 'etapeAdd'){
    e.preventDefault(); const r = reve(ui.sel), v = $('#etapeInput').value.trim(); if(!r || !v) return;
    r.steps.push({ id: uid(), title: v, done: false, doneAt: null }); save(); render(); const i = $('#etapeInput'); if(i) i.focus();
  }
});

// Rappels d'échéance : une notification à 30 jours, 7 jours, la veille et le jour même.
export function verifierRappels(){
  let ch = false;
  for(const r of S.dreams){
    if(r.achievedAt || !r.deadline) continue;
    const j = joursAvant(r.deadline); if(j < 0) continue;
    r.rappels = r.rappels || [];
    const seuil = [0, 1, 7, 30].find(s => j <= s);
    if(seuil !== undefined && !r.rappels.includes(seuil)){
      [0, 1, 7, 30].filter(s => s >= seuil).forEach(s => { if(!r.rappels.includes(s)) r.rappels.push(s); }); ch = true;
      if(S.settings.notify) notify(`${domaine(r.domain).nom} · ${dansTexte(j).toLowerCase()}`, r.title);
    }
  }
  if(ch) save();
}
