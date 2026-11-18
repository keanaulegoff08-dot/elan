// Onglet « Mes tâches » : listes, échéances, tiroir de détail, revue de fin de période, progression.
import { I } from '../noyau/icones.js';
import { pad, ymd, sod, eod, addDays, monday, cap, dShort, dLong, hm, toLocalInput, period, periodFromKey, fmtLeft } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast, notify } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { playCheck } from '../noyau/sons.js';
import { openFocus, focusTotal, fmtMin, WORK_OPTS } from '../focus.js';
import { triable, deplacer } from '../noyau/glisser.js';

const render = () => app.rendre();

export const LISTS = [
  { id:'main',    label:'Liste principale', short:'Principale', icon:'stack'   },
  { id:'quarter', label:'Trimestre',        short:'Trimestre',  icon:'quarter' },
  { id:'month',   label:'Mois',             short:'Mois',       icon:'month'   },
  { id:'week',    label:'Semaine',          short:'Semaine',    icon:'week'    },
  { id:'day',     label:"Aujourd'hui",      short:'Jour',       icon:'day'     },
];
export const LIST_BY = Object.fromEntries(LISTS.map(l => [l.id,l]));
export const PERIODIC = ['day','week','month','quarter'];

export function newTask(p){
  const now = new Date();
  const t = Object.assign({ id: uid(), title:'', notes:'', cat:null, list:'main', period:null, deadline:null,
    urgent:false, done:false, completedAt:null, createdAt: now.toISOString(), archived:false, dropped:false, postponed:0, example:false, subtasks:[], links:[], files:[] }, p);
  if(PERIODIC.includes(t.list) && !t.period){ const P = period(t.list, now); t.period = P.key; if(!t.deadline) t.deadline = P.end.toISOString(); }
  return t;
}

export const ui = { view:'main', cat:null, selected:null, showDone:{}, addUrgent:false, range:30 };

export const catOf = id => S.categories.find(c => c.id === id);
export const visible = t => !t.archived;

export function isStale(t){
  if(!PERIODIC.includes(t.list) || t.archived) return false;
  return t.period < period(t.list).key;
}
export function openIn(list){ return S.tasks.filter(t => visible(t) && t.list === list && !t.done && !isStale(t)); }

export function sortTasks(arr){
  return arr.slice().sort((a,b) => {
    if(a.done !== b.done) return a.done ? 1 : -1;
    if(a.done) return new Date(b.completedAt) - new Date(a.completedAt);
    if(a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    const da = a.deadline ? +new Date(a.deadline) : Infinity, db = b.deadline ? +new Date(b.deadline) : Infinity;
    if(da !== db) return da - db;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

export function dueInfo(t){
  if(!t.deadline) return null;
  const now = Date.now(), dl = +new Date(t.deadline), cr = +new Date(t.createdAt);
  const left = dl - now, total = Math.max(dl - cr, 36e5);
  const used = Math.min(1, Math.max(0, 1 - left/total));
  let lvl = 'calm';
  if(left < 0) lvl = 'late';
  else if(left < 6*36e5 || left/total < .15) lvl = 'hot';
  else if(left/total < .4 || left < 48*36e5) lvl = 'warm';
  return { left, used, lvl, label: fmtLeft(left), date: new Date(dl) };
}
export function dueHTML(t){
  if(t.done){
    if(!t.completedAt) return '';
    const c = new Date(t.completedAt);
    return `<div class="due done"><span class="txt">Fait ${sod(c).getTime()===sod(new Date()).getTime() ? 'à '+hm(c) : 'le '+dShort(c)}</span></div>`;
  }
  const d = dueInfo(t); if(!d) return '';
  const title = `Échéance : ${dLong(d.date)} à ${hm(d.date)}`;
  return `<div class="due ${d.lvl}" title="${esc(title)}"><span class="txt tab">${I.clock}${esc(d.label)}</span><span class="track"><i style="width:${(d.used*100).toFixed(1)}%"></i></span></div>`;
}

export function taskRow(t, opts={}){
  const c = catOf(t.cat);
  const meta = [];
  if(t.urgent && !t.done) meta.push(`<span class="urgent-tag">${I.bolt}Urgent</span>`);
  if(c) meta.push(`<span class="m cat"><span class="dot" style="--c:${c.color}"></span>${esc(c.name)}</span>`);
  if(opts.showList) meta.push(`<span class="m lst">${LIST_BY[t.list].short}</span>`);
  if(t.notes && t.notes.trim()) meta.push(`<span class="m" title="Notes">${I.note}Notes</span>`);
  if(t.subtasks && t.subtasks.length) meta.push(`<span class="m" title="Sous-tâches">${I.sub}${t.subtasks.filter(x => x.done).length}/${t.subtasks.length}</span>`);
  if((t.files||[]).length + (t.links||[]).length) meta.push(`<span class="m" title="Fichiers et liens">${I.clip}${(t.files||[]).length + (t.links||[]).length}</span>`);
  if(focusTotal(t)) meta.push(`<span class="m" title="Temps de focus">${I.focus}${fmtMin(focusTotal(t))}</span>`);
  if(t.postponed) meta.push(`<span class="m">Reportée ${t.postponed}×</span>`);
  if(t.example) meta.push(`<span class="m ex">Exemple</span>`);
  return `<div class="task ${t.done?'done':''} ${ui.selected===t.id?'sel':''}" data-task="${t.id}" style="${c?`--c:${c.color}`:''}">
    <button class="check" data-check="${t.id}" aria-label="${t.done?'Décocher':'Cocher'} « ${esc(t.title)} »">${I.check}</button>
    <div class="t-body"><div class="t-title">${esc(t.title)}</div>${meta.length?`<div class="t-meta">${meta.join('')}</div>`:''}</div>
    <div class="t-right">${dueHTML(t)}</div>
  </div>`;
}
export function filterCat(arr){ return ui.cat ? arr.filter(t => t.cat === ui.cat) : arr; }

export function addBar(list){
  const opts = S.categories.map(c => `<option value="${c.id}" ${ui.cat===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const listSel = list === 'all' ? `<select id="addList" aria-label="Liste">${LISTS.map(l => `<option value="${l.id}" ${l.id==='main'?'selected':''}>${l.short}</option>`).join('')}</select>` : '';
  const ph = { all:'Ajouter une tâche…', main:'Ajouter à la liste principale…', day:"Ajouter pour aujourd'hui…", week:'Ajouter pour cette semaine…', month:'Ajouter pour ce mois-ci…', quarter:'Ajouter pour ce trimestre…' }[list];
  return `<form class="add" id="addForm" data-list="${list}" autocomplete="off">
    <svg class="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    <input id="addInput" placeholder="${ph}" aria-label="Nouvelle tâche">
    <span class="hint">#sport · ! urgent</span>
    <div class="add-opts">${listSel}<select id="addCat" aria-label="Catégorie"><option value="">Sans catégorie</option>${opts}</select>
      <button type="button" class="urg ${ui.addUrgent?'on':''}" id="addUrg" title="Marquer urgent">${I.bolt}</button></div>
  </form>`;
}
export function catFilters(){
  return `<div class="filters"><button class="chip ${!ui.cat?'on':''}" data-cat="">Toutes</button>${S.categories.map(c => `<button class="chip ${ui.cat===c.id?'on':''}" data-cat="${c.id}" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</button>`).join('')}</div>`;
}
export function examplesNote(){
  if(!S.tasks.some(t => t.example)) return '';
  return `<div class="examples-note"><span>Les tâches marquées « Exemple » montrent comment l'app fonctionne. Efface-les quand tu veux démarrer avec les tiennes.</span><button class="btn ghost" data-act="clear-examples">Effacer les exemples</button></div>`;
}
export function reboundCard(){
  const el = elan(); const s = el.series; if(s.length < 2) return '';
  const y = s[s.length-2];
  const todayDone = s[s.length-1].done;
  let msg = null;
  if(y.zero && !todayDone) msg = ['Hier a été un jour sans.','Une seule petite tâche suffit pour relancer la courbe. Commence par celle-ci.'];
  else if(el.zeroStreak >= 2) msg = [`${el.zeroStreak} jours sans d'affilée.`,'Pas de pression, juste un pas. Coche une tâche courte maintenant.'];
  if(!msg) return '';
  const pick = sortTasks(S.tasks.filter(t => visible(t) && !t.done && !isStale(t)))[0];
  return `<div class="rebound">${I.spark}<p><b>${msg[0]}</b><small>${msg[1]}${pick?` Suggestion : « ${esc(pick.title)} ».`:''}</small></p>${pick?`<button class="btn" data-focus="${pick.id}">${I.focus}Focus</button>`:''}</div>`;
}

export function renderMain(){
  const now = new Date(); const h = now.getHours();
  const hello = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const all = S.tasks.filter(t => visible(t) && !isStale(t));
  const open = all.filter(t => !t.done);
  const urg = open.filter(t => t.urgent).length, late = open.filter(t => (dueInfo(t)||{}).lvl === 'late').length;
  const doneToday = S.tasks.filter(t => t.done && t.completedAt && sod(new Date(t.completedAt)).getTime() === sod(now).getTime()).length;
  const pool = filterCat(all);
  const openL = sortTasks(pool.filter(t => !t.done)), doneL = sortTasks(pool.filter(t => t.done));
  const sd = ui.showDone.all;
  let body = `<section class="section"><div class="tasks">${openL.length ? openL.map(t => taskRow(t,{showList:true})).join('') : `<div class="empty"><b>${doneL.length?'Tout est fait.':'Aucune tâche.'}</b>${doneL.length?'Profite, ou ajoute la prochaine étape.':'Ajoute ta première tâche juste au-dessus.'}</div>`}</div>
    ${doneL.length ? `<button class="done-toggle ${sd?'open':''}" data-done-toggle="all">${I.chev}Terminées (${doneL.length})</button>${sd?`<div class="tasks">${doneL.map(t => taskRow(t,{showList:true})).join('')}</div>`:''}` : ''}</section>`;
  $('#view').innerHTML = `
    <div class="head"><div><div class="eyebrow">Liste principale · ${cap(dLong(now))}</div><h1>Mes <em>tâches</em></h1></div></div>
    <div class="summary">
      <span class="pill-stat"><span class="dot"></span><b class="tab">${open.length}</b> à faire</span>
      <span class="pill-stat u"><span class="dot"></span><b class="tab">${urg}</b> urgente${urg>1?'s':''}</span>
      <span class="pill-stat l"><span class="dot"></span><b class="tab">${late}</b> en retard</span>
      <span class="pill-stat"><span class="dot" style="--c:var(--lav)"></span><b class="tab">${doneToday}</b> faite${doneToday>1?'s':''} aujourd'hui</span>
    </div>
    ${reboundCard()}
    ${addBar('all')}
    ${catFilters()}
    ${body}
    ${examplesNote()}`;
}

export function listBlock(list){
  const arr = filterCat(S.tasks.filter(t => visible(t) && t.list === list && !isStale(t)));
  const open = sortTasks(arr.filter(t => !t.done)), done = sortTasks(arr.filter(t => t.done));
  const sd = ui.showDone[list];
  return `<section class="section"><div class="tasks">${open.length ? open.map(t => taskRow(t)).join('') : `<div class="empty"><b>${done.length?'Tout est coché.':'Liste vide.'}</b>${done.length?'Beau travail. La courbe te remercie.':'Ajoute ta première tâche juste au-dessus.'}</div>`}</div>
    ${done.length ? `<button class="done-toggle ${sd?'open':''}" data-done-toggle="${list}">${I.chev}Terminées (${done.length})</button>${sd?`<div class="tasks">${done.map(t => taskRow(t)).join('')}</div>`:''}` : ''}
  </section>`;
}

export function renderList(list){
  const now = new Date(); const P = period(list);
  const pct = P ? (now - P.start)/(P.end - P.start) : 0;
  const titles = { day:["Aujourd'hui", ''], week:['Cette', 'semaine'], month:['Ce', 'mois-ci'], quarter:['Ce', 'trimestre'] };
  const tt = titles[list];
  $('#view').innerHTML = `
    <div class="head"><div><div class="eyebrow">${P.sub}</div><h1>${list==='day'?`<em>Aujourd'hui</em>`:`${tt[0]} <em>${tt[1]}</em>`}</h1></div></div>
    <div class="period"><span class="l">${list==='day'?'Journée':'Période'} écoulée à <b class="tab">${Math.round(pct*100)} %</b></span><span class="r tab">Reste ${fmtLeft(P.end - now)}</span><div class="bar ${pct>.8?'late':''}"><i style="width:${(pct*100).toFixed(1)}%"></i></div></div>
    ${addBar(list)}
    ${catFilters()}
    ${listBlock(list)}`;
}

export let elanCache = null;
export function elan(){
  if(elanCache) return elanCache;
  const today = sod(new Date());
  const firstC = S.tasks.reduce((m,t) => Math.min(m, +sod(new Date(t.createdAt))), +today);
  const start = new Date(Math.max(firstC, +addDays(today,-179)));
  const days = [];
  const tasks = S.tasks.map(t => ({ ...t, _c:+new Date(t.createdAt), _d: t.completedAt ? +new Date(t.completedAt) : null, _dl: t.deadline ? +new Date(t.deadline) : null, _x: t.droppedAt ? +new Date(t.droppedAt) : null }));
  const posts = {}; S.log.forEach(l => { if(l.type==='postpone') posts[l.d] = (posts[l.d]||0)+1; });
  let cum = 0, el = 50;
  for(let d = new Date(start); d <= today; d = addDays(d,1)){
    const s = +d, e = s + 864e5, key = ymd(d), isToday = s === +today;
    let done = 0, w = 0, overdue = 0, openN = 0;
    for(const t of tasks){
      if(t._d !== null && t._d >= s && t._d < e && t.done){ done++; w += t.urgent ? 1.5 : 1; }
      const alive = t._c < e && !(t.done && t._d !== null && t._d < s) && !(t.dropped && t._x !== null && t._x < s);
      if(alive){ openN++; if(t._dl !== null && t._dl < s) overdue++; }
    }
    const zero = !isToday && done === 0 && openN > 0;
    const pts = w - Math.min(overdue,6)*0.25 - (posts[key]||0)*0.5 - (zero ? 1 : 0);
    cum += pts;
    const raw = Math.max(0, Math.min(100, 45 + w*14 - overdue*5 - (zero ? 35 : 0)));
    if(!isToday) el = el*0.72 + raw*0.28;
    else if(done > 0) el = Math.min(100, el + w*3);
    days.push({ date:new Date(d), key, done, w, overdue, zero, pts, cum: +cum.toFixed(2), elan: Math.round(el), today:isToday });
  }
  let streak = 0; for(let i = days.length-1; i >= 0; i--){ if(days[i].done > 0) streak++; else if(days[i].today) continue; else break; }
  let zeroStreak = 0; for(let i = days.length-2; i >= 0; i--){ if(days[i].zero) zeroStreak++; else break; }
  const now = days.length ? days[days.length-1].elan : 50;
  const word = now >= 80 ? 'En feu, garde ce rythme' : now >= 62 ? 'Bon rythme' : now >= 45 ? 'Ça ronronne' : now >= 28 ? 'Au ralenti' : 'À relancer, un petit pas suffit';
  elanCache = { series: days, now, word, streak, zeroStreak };
  return elanCache;
}

export function renderStats(){
  const el = elan(); const s = el.series;
  const last = n => s.slice(-n);
  const done7 = last(7).reduce((a,d) => a+d.done, 0), donePrev7 = s.slice(-14,-7).reduce((a,d) => a+d.done, 0);
  const zero30 = last(30).filter(d => d.zero).length;
  const delta = done7 - donePrev7;
  // catégories (30 j)
  const since = +addDays(sod(new Date()),-29);
  const byCat = {};
  S.tasks.forEach(t => { if(t.done && t.completedAt && +new Date(t.completedAt) >= since){ const k = t.cat || '_'; byCat[k] = (byCat[k]||0)+1; } });
  const catRows = Object.entries(byCat).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxC = Math.max(1, ...catRows.map(r => r[1]));
  // jour de la semaine le plus productif
  const wd = [0,0,0,0,0,0,0], wdn = [0,0,0,0,0,0,0];
  last(70).forEach(d => { const i = (d.date.getDay()+6)%7; wd[i] += d.done; wdn[i]++; });
  const wdAvg = wd.map((v,i) => wdn[i] ? v/wdn[i] : 0);
  const WD = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const best = wdAvg.indexOf(Math.max(...wdAvg)), worst = wdAvg.indexOf(Math.min(...wdAvg));
  const maxW = Math.max(.1, ...wdAvg);

  $('#view').innerHTML = `
    <div class="head"><div><div class="eyebrow">Suivi</div><h1>Ta <em>progression</em></h1><div class="head-sub">La courbe monte quand tu coches, descend quand une échéance passe ou qu'une journée file sans rien faire.</div></div></div>
    <div class="tiles">
      <div class="tile"><span>Élan actuel</span><b class="tab">${el.now}</b><small>${el.word}</small><div class="gauge"><i style="width:${el.now}%"></i></div></div>
      <div class="tile"><span>Série</span><b class="tab">${el.streak} j</b><small>jours productifs d'affilée</small></div>
      <div class="tile"><span>7 derniers jours</span><b class="tab">${done7}</b><small>${delta===0?'comme la semaine d’avant':delta>0?`+${delta} vs semaine d’avant`:`${delta} vs semaine d’avant`}</small></div>
      <div class="tile"><span>Jours sans</span><b class="tab">${zero30}</b><small>sur les 30 derniers jours</small></div>
    </div>
    <div class="chart-card" id="chartCard">
      <div class="top"><h3>Courbe d'élan<small>points cumulés</small></h3>
        <div class="seg">${[7,30,90].map(r => `<button data-range="${r}" class="${ui.range===r?'on':''}">${r} j</button>`).join('')}</div></div>
      <div id="chart"></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Élan cumulé</span><span><i style="background:var(--lav)"></i>Tâches faites par jour</span><span><i style="background:var(--urgent)"></i>Jour sans</span></div>
      <div class="tip" id="tip"></div>
    </div>
    <div class="insights">
      <div class="insight"><h4>Régularité · 15 semaines</h4>${heatHTML(s)}</div>
      <div class="insight"><h4>Où va ton énergie · 30 j</h4><div class="bars-h">${catRows.length ? catRows.map(([k,v]) => { const c = catOf(k); return `<div><span>${esc(c?c.name:'Sans catégorie')}</span><span><i style="--c:${c?c.color:'var(--ink-3)'};width:${v/maxC*100}%"></i></span><span class="tab">${v}</span></div>`; }).join('') : '<div class="empty">Coche des tâches pour voir la répartition.</div>'}</div></div>
      <div class="insight"><h4>Ta semaine type</h4><div class="bars-h">${WD.map((n,i) => `<div><span>${n}${i===best?' · meilleur':''}${i===worst&&i!==best?' · creux':''}</span><span><i style="--c:${i===worst&&i!==best?'var(--warm)':'var(--lav)'};width:${wdAvg[i]/maxW*100}%"></i></span><span class="tab">${wdAvg[i].toFixed(1)}</span></div>`).join('')}</div></div>
      <div class="insight"><h4>Comment la courbe est calculée</h4><div style="color:var(--ink-2);font-size:13px;line-height:1.6">+1 point par tâche cochée, +1,5 si elle était urgente.<br>−0,25 par tâche en retard, chaque jour (6 max).<br>−0,5 quand tu reportes une tâche à la période suivante.<br>−1 pour une journée passée sans rien cocher.<br>L'élan (0 à 100) suit ta forme récente : il réagit vite quand tu repars.</div></div>
    </div>
    ${historyHTML()}`;
  drawChart(s.slice(-ui.range));
}

export function historyHTML(){
  const all = S.tasks.filter(t => t.done && t.completedAt).sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
  const n = ui.histN || 30;
  const list = all.slice(0, n);
  const today = sod(new Date()), yest = addDays(today,-1);
  const groups = [];
  list.forEach(t => {
    const d = sod(new Date(t.completedAt));
    const lbl = +d === +today ? "Aujourd'hui" : +d === +yest ? 'Hier' : cap(dLong(d));
    let g = groups[groups.length-1];
    if(!g || g.key !== +d){ g = { key:+d, lbl, items:[] }; groups.push(g); }
    g.items.push(t);
  });
  const row = t => {
    const c = catOf(t.cat), at = new Date(t.completedAt), ft = focusTotal(t);
    return `<div class="hist-row" style="${c?`--c:${c.color}`:''}">
      <span class="hk">${I.check}</span>
      <span class="ht"><b>${esc(t.title)}</b><span class="t-meta">${t.urgent?`<span class="urgent-tag">${I.bolt}Urgent</span>`:''}${c?`<span class="m cat"><span class="dot" style="--c:${c.color}"></span>${esc(c.name)}</span>`:''}<span class="m lst">${LIST_BY[t.list].short}</span>${ft?`<span class="m">${I.focus}${fmtMin(ft)}</span>`:''}${t.postponed?`<span class="m">Reportée ${t.postponed}×</span>`:''}</span></span>
      <span class="hh tab">${hm(at)}</span></div>`;
  };
  return `<div class="chart-card hist" style="margin-top:16px">
    <div class="top"><h3>Dernières tâches terminées<small>${all.length} au total</small></h3></div>
    ${groups.length ? groups.map(g => `<div class="hist-day"><h4><span>${g.lbl}</span><span class="tab">${g.items.length} tâche${g.items.length>1?'s':''}</span></h4>${g.items.map(row).join('')}</div>`).join('') : '<div class="empty">Aucune tâche terminée pour l’instant. Coche ta première tâche et elle apparaîtra ici.</div>'}
    ${all.length > n ? `<button class="done-toggle" data-act="hist-more">${I.chev}Afficher plus (${all.length - n} restantes)</button>` : ''}
  </div>`;
}

export function heatHTML(s){
  const today = sod(new Date());
  const startMon = addDays(monday(today), -14*7);
  const map = Object.fromEntries(s.map(d => [d.key, d]));
  const max = Math.max(1, ...s.map(d => d.done));
  let cells = '';
  for(let d = new Date(startMon); d <= addDays(monday(today),6); d = addDays(d,1)){
    const r = map[ymd(d)];
    if(d > today){ cells += `<i class="f"></i>`; continue; }
    if(!r){ cells += `<i title="${dShort(d)}"></i>`; continue; }
    if(r.zero){ cells += `<i class="z" title="${dShort(d)} · jour sans"></i>`; continue; }
    const a = r.done ? 22 + (r.done/max)*70 : 0;
    cells += `<i title="${dShort(d)} · ${r.done} tâche${r.done>1?'s':''}" style="${a?`background:color-mix(in srgb,var(--accent) ${a.toFixed(0)}%,var(--sunk))`:''}"></i>`;
  }
  return `<div class="heat-wrap"><div class="heat-days"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div><div class="heat">${cells}</div></div>`;
}

export function niceStep(r){ const p = Math.pow(10, Math.floor(Math.log10(r||1))); const n = r/p; return (n<1.5?1:n<3?2:n<7?5:10)*p; }
export function drawChart(data){
  const host = $('#chart'); if(!host) return;
  if(!data.length){ host.innerHTML = '<div class="empty">Pas encore de données.</div>'; return; }
  const W = Math.max(320, host.clientWidth || 700), H = 250, L = 38, R = 14, T = 14, B = 70;
  const ch = H - T - B, bh = 34, bTop = H - 26 - bh;
  const vals = data.map(d => d.cum);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if(mx - mn < 4){ mx += 2; mn -= 2; }
  const step = niceStep((mx-mn)/4); mn = Math.floor(mn/step)*step; mx = Math.ceil(mx/step)*step;
  const n = data.length, x = i => L + (n===1 ? (W-L-R)/2 : i/(n-1)*(W-L-R));
  const y = v => T + (1-(v-mn)/(mx-mn))*ch;
  const maxDone = Math.max(1, ...data.map(d => d.done));
  let g = '';
  for(let v = mn; v <= mx + 1e-9; v += step){
    g += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="${v===0?'':'2 4'}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(1)}</text>`;
  }
  const pts = data.map((d,i) => [x(i), y(d.cum)]);
  // courbe lissée (Catmull-Rom → Bézier)
  let path = `M${pts[0][0]} ${pts[0][1]}`;
  for(let i = 0; i < pts.length-1; i++){
    const p0 = pts[i-1]||pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2]||p2;
    const c1 = [p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2 = [p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    path += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${path} L${pts[pts.length-1][0]} ${T+ch} L${pts[0][0]} ${T+ch}Z`;
  const bw = Math.max(2, Math.min(18, (W-L-R)/n*0.6));
  const bars = data.map((d,i) => d.done ? `<rect x="${(x(i)-bw/2).toFixed(1)}" y="${(bTop + bh - d.done/maxDone*bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(d.done/maxDone*bh).toFixed(1)}" rx="${Math.min(3,bw/2)}" fill="var(--lav)" opacity=".75"/>` : (d.zero ? `<rect x="${(x(i)-bw/2).toFixed(1)}" y="${bTop+bh-2}" width="${bw.toFixed(1)}" height="2" rx="1" fill="var(--urgent)" opacity=".6"/>` : '')).join('');
  const zeros = data.map((d,i) => d.zero ? `<circle cx="${x(i)}" cy="${y(d.cum)}" r="3.5" fill="var(--card)" stroke="var(--urgent)" stroke-width="2"/>` : '').join('');
  const lp = pts[pts.length-1];
  const every = Math.ceil(n/7);
  const xl = data.map((d,i) => (i % every === 0 || i === n-1) && !(i !== n-1 && n-1-i < every*0.6) ? `<text x="${x(i)}" y="${H-6}" text-anchor="middle">${d.today?"Auj.":dShort(d.date)}</text>` : '').join('');
  const hits = data.map((d,i) => `<rect data-i="${i}" x="${(x(i)-(W-L-R)/n/2).toFixed(1)}" y="${T}" width="${((W-L-R)/Math.max(1,n)).toFixed(1)}" height="${H-T-20}" fill="transparent"/>`).join('');
  host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Courbe d'élan">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${g}<path d="${area}" fill="url(#ga)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>
    ${zeros}<circle cx="${lp[0]}" cy="${lp[1]}" r="9" fill="var(--accent)" opacity=".18"/><circle cx="${lp[0]}" cy="${lp[1]}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>
    <line x1="${L}" x2="${W-R}" y1="${bTop+bh}" y2="${bTop+bh}" stroke="var(--line)"/>${bars}${xl}
    <line id="hov" x1="0" x2="0" y1="${T}" y2="${bTop+bh}" stroke="var(--ink-3)" stroke-dasharray="3 3" opacity="0"/>${hits}</svg>`;
  const tip = $('#tip'), card = $('#chartCard'), hov = host.querySelector('#hov');
  host.querySelectorAll('rect[data-i]').forEach(r => {
    r.addEventListener('mouseenter', () => {
      const i = +r.dataset.i, d = data[i];
      const svg = host.querySelector('svg').getBoundingClientRect(), cr = card.getBoundingClientRect();
      const sx = svg.width / W;
      hov.setAttribute('x1', x(i)); hov.setAttribute('x2', x(i)); hov.setAttribute('opacity', '.6');
      tip.innerHTML = `<b>${cap(dLong(d.date))}</b><br>${d.done} tâche${d.done>1?'s':''} faite${d.done>1?'s':''}${d.overdue?` · ${d.overdue} en retard`:''}${d.zero?'<br>Jour sans':''}<br>${d.pts>=0?'+':''}${d.pts.toFixed(2)} pts · élan ${d.elan}`;
      tip.style.left = (svg.left - cr.left + x(i)*sx) + 'px';
      tip.style.top = (svg.top - cr.top + y(d.cum)*sx - 6) + 'px';
      tip.classList.add('show');
    });
    r.addEventListener('mouseleave', () => { tip.classList.remove('show'); hov.setAttribute('opacity','0'); });
  });
}

export function rerenderKeepInput(){
  const inp = $('#addInput'); const v = inp ? inp.value : ''; const had = document.activeElement === inp;
  render();
  const n = $('#addInput'); if(n){ n.value = v; if(had) n.focus(); }
}

export function norm(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
export function addTask(form){
  const inp = $('#addInput'); let title = inp.value.trim(); if(!title) return;
  let urgent = ui.addUrgent, cat = $('#addCat').value || null;
  if(/(^|\s)!(\s|$)/.test(title) || /!$/.test(title)){ urgent = true; title = title.replace(/(^|\s)!(?=\s|$)/g,' ').replace(/!$/,'').trim(); }
  title = title.replace(/#([\p{L}\d&-]+)/gu, (m, w) => {
    const c = S.categories.find(c => norm(c.name).replace(/[^a-z0-9]/g,'').startsWith(norm(w).replace(/[^a-z0-9]/g,'')));
    if(c){ cat = c.id; return ''; } return m;
  }).replace(/\s{2,}/g,' ').trim();
  if(!title) return;
  let list = form.dataset.list; if(list === 'all') list = $('#addList').value;
  const t = newTask({ title, cat, urgent, list });
  S.tasks.push(t); ui.addUrgent = false; save();
  inp.value = '';
  render(); const n = $('#addInput'); if(n) n.focus();
  toast(`Ajoutée à ${list==='main'?'la liste principale':period(list).name.toLowerCase()}`);
}
export function toggleDone(id){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  const row = document.querySelector(`.task[data-task="${id}"]`);
  const finish = () => {
    t.done = !t.done; t.completedAt = t.done ? new Date().toISOString() : null; save(); render(); if(ui.selected === id) renderDrawer();
    if(t.done) toast('Bien joué. +' + (t.urgent ? '1,5' : '1') + ' sur ta courbe', () => { t.done = false; t.completedAt = null; save(); render(); });
  };
  if(!t.done) playCheck(t.urgent);
  if(!t.done && row && !matchMedia('(prefers-reduced-motion: reduce)').matches){ row.classList.add('checking'); setTimeout(finish, 420); }
  else finish();
}

/* ---------- tiroir ---------- */
export function openDrawer(id){ ui.selected = id; renderDrawer(); $('#drawer').classList.add('show'); $('#scrim').classList.add('show'); render(); setTimeout(() => { const ta = $('#drTitle'); if(ta && !ta.value) ta.focus(); }, 300); }
export function closeDrawer(){ ui.selected = null; $('#drawer').classList.remove('show'); $('#scrim').classList.remove('show'); render(); }
export function autoGrow(el){ el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
export function renderDrawer(){
  const t = S.tasks.find(x => x.id === ui.selected); if(!t){ return; }
  const c = catOf(t.cat);
  const P = PERIODIC.includes(t.list) ? period(t.list) : null;
  const created = new Date(t.createdAt);
  $('#drawer').innerHTML = `
    <div class="dr-top"><span class="eyebrow">${LIST_BY[t.list].label}${P?` · ${P.sub}`:''}</span><span class="sp"></span>
      <button class="icon-btn" data-act="close-drawer" title="Fermer (Échap)">${I.close}</button></div>
    <div class="dr-body">
      <div class="dr-title" style="${c?`--c:${c.color}`:''}"><button class="check" data-check="${t.id}" style="${t.done?`background:var(--c,var(--accent));border-color:var(--c,var(--accent))`:''}">${t.done?I.check.replace('<svg','<svg style="stroke-dashoffset:0"'):I.check}</button>
        <textarea id="drTitle" rows="1" placeholder="Nom de la tâche">${esc(t.title)}</textarea></div>
      <button class="toggle-urgent ${t.urgent?'on':''}" data-act="toggle-urgent">${I.bolt}<span><b>Urgent</b><small>À traiter en priorité, remonte en haut de tes listes</small></span><span class="sw"></span></button>${extrasHTML(t).sous}
      <div class="field"><label>Liste</label><div class="list-pick">${LISTS.map(l => `<button data-move="${l.id}" class="${t.list===l.id?'on':''}">${l.short}</button>`).join('')}</div></div>
      <div class="field"><label>Échéance${t.list==='main'?' (facultative)':''}</label>
        <div class="row"><input type="datetime-local" class="inp" id="drDeadline" value="${toLocalInput(t.deadline)}" style="flex:1;width:auto">${t.deadline?`<button class="btn ghost" data-act="clear-deadline">Retirer</button>`:''}</div>
        <div class="quick-dates"><button data-qd="today">Ce soir</button><button data-qd="tomorrow">Demain soir</button><button data-qd="week">Dimanche</button><button data-qd="month">Fin du mois</button><button data-qd="3h">Dans 3 h</button></div>
        ${t.deadline && !t.done ? `<div style="margin-top:10px">${dueHTML(t).replace('class="due','style="align-items:flex-start" class="due')}</div>`:''}</div>
      <div class="field"><label>Catégorie</label><div class="cat-pick">${S.categories.map(k => `<button class="chip ${t.cat===k.id?'on':''}" data-setcat="${k.id}" style="--c:${k.color}"><span class="dot"></span>${esc(k.name)}</button>`).join('')}<button class="chip ${!t.cat?'on':''}" data-setcat="">Aucune</button></div></div>
      <div class="field"><label>Notes</label><textarea class="inp notes" id="drNotes" placeholder="Détails, prochaine étape…">${esc(t.notes)}</textarea></div>
      ${extrasHTML(t).pieces}
    </div>
    ${!t.done?`<div class="dr-action"><button class="action-btn" data-focus="${t.id}"><span class="ai">${I.play}</span><span><b>Passer à l'action</b><small>${focusTotal(t)?`Déjà ${fmtMin(focusTotal(t))} de travail · lancer une nouvelle session`:'Lancer un minuteur de travail sur cette tâche'}</small></span>${I.arrow}</button></div>`:''}
    <div class="dr-foot"><span class="meta">Créée le ${dShort(created)} à ${hm(created)}${t.postponed?` · reportée ${t.postponed}×`:''}${focusTotal(t)?` · ${fmtMin(focusTotal(t))} de focus (${t.sessions.length} session${t.sessions.length>1?'s':''})`:''}</span><button class="btn ghost danger" data-act="delete">${I.trash}Supprimer</button></div>`;
  const ti = $('#drTitle'); autoGrow(ti);
  ti.addEventListener('input', () => { autoGrow(ti); t.title = ti.value.replace(/\n/g,' '); save(); rerenderKeepInput(); });
  ti.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); ti.blur(); } });
  $('#drNotes').addEventListener('input', e => { t.notes = e.target.value; save(); rerenderKeepInput(); });
  brancherExtras(t);
  $('#drDeadline').addEventListener('change', e => { t.deadline = e.target.value ? new Date(e.target.value).toISOString() : null; save(); render(); renderDrawer(); });
}

export function quickDate(kind){
  const now = new Date();
  if(kind==='today') return eod(now);
  if(kind==='tomorrow') return eod(addDays(now,1));
  if(kind==='week') return eod(addDays(monday(now),6));
  if(kind==='month') return eod(new Date(now.getFullYear(), now.getMonth()+1, 0));
  if(kind==='3h') return new Date(now.getTime()+3*36e5);
}
export function moveTask(t, list){
  if(t.list === list) return;
  const oldP = PERIODIC.includes(t.list) ? period(t.list) : null;
  const wasDefault = oldP && t.deadline && Math.abs(new Date(t.deadline) - oldP.end) < 6e4;
  t.list = list;
  if(PERIODIC.includes(list)){
    const P = period(list); t.period = P.key;
    if(!t.deadline || wasDefault) t.deadline = P.end.toISOString();
  } else { t.period = null; if(wasDefault) t.deadline = null; }
  save(); render(); renderDrawer();
  toast(`Déplacée vers ${list==='main'?'la liste principale':period(list).name.toLowerCase()}`);
}

/* ---------- revue de fin de période ---------- */
export let review = null;
export function checkReview(force){
  if(!force && Date.now() < (S.snooze||0)) return;
  if($('#modal').classList.contains('show')) return;
  const stale = S.tasks.filter(isStale);
  if(!stale.length) return;
  review = {};
  stale.forEach(t => { review[t.id] = { done: t.done, dest: 'report' }; });
  renderReview(); $('#modal').classList.add('show');
}
export function renderReview(){
  const stale = S.tasks.filter(t => review && review[t.id]);
  const groups = {};
  stale.forEach(t => { const k = t.list+'|'+t.period; (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).sort((a,b) => PERIODIC.indexOf(a.split('|')[0]) - PERIODIC.indexOf(b.split('|')[0]));
  const lbl = (list,key) => { const P = periodFromKey(list,key);
    return list==='day' ? `La journée de ${P.sub.toLowerCase()}` : list==='week' ? `La semaine ${P.sub.replace('Semaine ','')}` : list==='month' ? `Le mois de ${P.sub.toLowerCase()}` : `Le trimestre ${P.sub.split(' · ')[0]}`; };
  const destName = list => ({ day:"aujourd'hui", week:'cette semaine', month:'ce mois-ci', quarter:'ce trimestre' })[list];
  const intro = keys.length === 1 ? `${lbl(...keys[0].split('|'))} est terminée.` : `${keys.length} périodes viennent de se terminer.`;
  $('#modalBox').innerHTML = `
    <div class="modal-h"><div class="eyebrow">Revue de fin de période</div><h3>On fait le point ?</h3><p>${intro} Une tâche non cochée a peut-être quand même été faite. Dis-moi ce qu'il en est, je range le reste.</p></div>
    <div class="modal-b">${keys.map(k => { const [list,key] = k.split('|'); return `<div class="rv-group"><h4>${lbl(list,key)}</h4>${groups[k].map(t => { const r = review[t.id]; const c = catOf(t.cat); return `
      <div class="rv-item"><div class="tt"><b>${esc(t.title)}</b><small>${c?`<span class="dot" style="--c:${c.color}"></span>${esc(c.name)}`:''}${t.urgent?' · Urgent':''}</small></div>
        <div class="rv-seg"><button class="y ${r.done?'on':''}" data-rv="${t.id}" data-v="1">${I.check}Faite</button><button class="n ${!r.done?'on':''}" data-rv="${t.id}" data-v="0">Pas faite</button></div>
        ${!r.done?`<div class="rv-dest">Que faire ?<button data-rvd="${t.id}" data-v="report" class="${r.dest==='report'?'on':''}">Garder pour ${destName(list)}</button><button data-rvd="${t.id}" data-v="main" class="${r.dest==='main'?'on':''}">Liste principale</button><button data-rvd="${t.id}" data-v="drop" class="${r.dest==='drop'?'on':''}">Abandonner</button></div>`:''}
      </div>`; }).join('')}</div>`; }).join('')}</div>
    <div class="modal-f"><button class="btn ghost" data-act="review-later">Plus tard</button><button class="btn primary" data-act="review-ok">${I.check}Valider la revue</button></div>`;
}
export function applyReview(){
  const now = new Date(); let kept = 0, done = 0;
  S.tasks.forEach(t => {
    const r = review && review[t.id]; if(!r) return;
    const P = periodFromKey(t.list, t.period);
    if(r.done){
      done++;
      if(!t.done){ t.done = true; t.completedAt = new Date(Math.min(+now, +P.end)).toISOString(); }
      t.archived = true;
    } else {
      t.done = false; t.completedAt = null;
      if(r.dest === 'report'){
        kept++;
        const NP = period(t.list); t.period = NP.key; t.postponed = (t.postponed||0)+1;
        if(!t.deadline || Math.abs(new Date(t.deadline) - P.end) < 6e4 || new Date(t.deadline) < now) t.deadline = NP.end.toISOString();
        S.log.push({ d: ymd(P.end), type:'postpone' });
      } else if(r.dest === 'main'){
        kept++; t.list = 'main'; t.period = null; if(t.deadline && new Date(t.deadline) < now) t.deadline = null;
      } else { t.dropped = true; t.droppedAt = now.toISOString(); t.archived = true; }
    }
  });
  review = null; save(); $('#modal').classList.remove('show'); render();
  toast(`Revue faite : ${done} terminée${done>1?'s':''}, ${kept} gardée${kept>1?'s':''}`);
}

export function checkDeadlines(){
  if(!S.settings.notify) return;
  const now = Date.now(); let ch = false;
  S.tasks.forEach(t => {
    if(t.done || t.archived || !t.deadline || t.notified) return;
    const left = new Date(t.deadline) - now;
    if(left > 0 && left < 36e5){ t.notified = true; ch = true; notify(t.urgent ? 'Urgent · échéance dans moins d’1 h' : 'Échéance dans moins d’1 h', t.title); }
  });
  if(ch) save();
}

export function housekeeping(){
  const lim = Date.now() - 7*864e5;
  S.tasks.forEach(t => { if(t.list === 'main' && t.done && !t.archived && t.completedAt && +new Date(t.completedAt) < lim) t.archived = true; });
}

/* =========================================================
   Sous-tâches, fichiers et liens (tiroir)
   ========================================================= */
function extrasHTML(t){
  const subs = t.subtasks || [], faits = subs.filter(x => x.done).length, prevu = subs.reduce((a,x) => a + (x.min||0), 0);
  const durees = s => `<option value="">Durée</option>${WORK_OPTS.map(m => `<option value="${m}" ${s.min===m?'selected':''}>${fmtMin(m)}</option>`).join('')}`;
  const poids = n => n > 1048576 ? (n/1048576).toFixed(1).replace('.',',')+' Mo' : Math.max(1,Math.round(n/1024))+' ko';
  const sous = `
      <div class="field"><label>Sous-tâches${subs.length?` · ${faits}/${subs.length}`:''}${prevu?` · ${fmtMin(prevu)} prévues`:''}</label>
        <div class="subs" id="drSubs">${subs.map(s => `<div class="sub ${s.done?'done':''}" data-sub-id="${s.id}">
          <button class="sub-grip" title="Glisser pour changer l'ordre" aria-label="Déplacer la sous-tâche (flèches haut et bas)">${I.grip}</button>
          <button class="check sm" data-subcheck="${s.id}" aria-label="${s.done?'Décocher':'Cocher'} la sous-tâche">${I.check}</button>
          <textarea class="sub-t" rows="1" data-subtitle="${s.id}" aria-label="Sous-tâche">${esc(s.title)}</textarea>
          <select class="sub-min" data-submin="${s.id}" aria-label="Durée de travail">${durees(s)}</select>
          <button class="icon-btn sm" data-subdel="${s.id}" title="Retirer">${I.close}</button></div>`).join('')}</div>
        <form class="mini-add" id="subAdd" autocomplete="off">${I.plus}<input id="subInput" placeholder="Ajouter une sous-tâche…" aria-label="Nouvelle sous-tâche"></form></div>`;
  const pieces = `
      <div class="field"><label>Fichiers et liens</label>
        <div class="pieces">${(t.files||[]).map(f => `<div class="piece"><button class="piece-o" data-fileopen="${esc(f.rel)}" title="Ouvrir">${I.fichier}<span>${esc(f.nom)}</span><small>${poids(f.taille||0)}</small></button><button class="icon-btn sm" data-filedel="${f.id}" title="Retirer">${I.close}</button></div>`).join('')}
          ${(t.links||[]).map(l => `<div class="piece"><a class="piece-o" href="${esc(l.url)}" target="_blank" rel="noreferrer" title="${esc(l.url)}">${I.lien}<span>${esc(l.label)}</span></a><button class="icon-btn sm" data-linkdel="${l.id}" title="Retirer">${I.close}</button></div>`).join('')}</div>
        <div class="piece-add">${window.desktop?`<button class="btn" data-act="add-file">${I.clip}Joindre un fichier</button>`:''}
          <form class="mini-add" id="linkAdd" autocomplete="off">${I.lien}<input id="linkInput" placeholder="Coller un lien…" aria-label="Nouveau lien"></form></div></div>`;
  return { sous, pieces };
}
function brancherExtras(t){
  document.querySelectorAll('#drawer [data-subtitle]').forEach(inp => {
    inp.addEventListener('change', () => { const s = t.subtasks.find(x => x.id === inp.dataset.subtitle), v = inp.value.replace(/\s*\n\s*/g, ' ').trim(); if(s && v){ s.title = v; inp.value = v; save(); } });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); } });
  });
  document.querySelectorAll('#drawer [data-submin]').forEach(sel => {
    sel.addEventListener('change', () => { const s = t.subtasks.find(x => x.id === sel.dataset.submin); if(s){ s.min = sel.value ? +sel.value : null; save(); renderDrawer(); } });
  });
  // Glisser une sous-tâche par sa poignée change l'ordre.
  triable($('#drSubs'), { fin: (de, vers) => { deplacer(t.subtasks, de, vers); save(); render(); renderDrawer(); } });
}
export function lienPropre(txt){
  let v = txt.trim(); if(!v) return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try{
    const u = new URL(v);
    if(!/^(https?:|mailto:)$/.test(u.protocol)) return null;
    const label = u.protocol === 'mailto:' ? u.pathname : (u.hostname.replace(/^www\./,'') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/,'') : '')).slice(0,60);
    return { id: uid(), url: u.href, label };
  }catch(e){ return null; }
}
const courante = () => S.tasks.find(x => x.id === ui.selected);

/* =========================================================
   Sous-navigation des listes et bandeau de revue
   ========================================================= */
function sousNav(){
  const items = [...LISTS, { id:'stats', label:'Progression' }].map(l => {
    let n = '', hot = false;
    if(l.id !== 'stats'){
      const o = l.id === 'main' ? S.tasks.filter(t => visible(t) && !t.done && !isStale(t)) : openIn(l.id);
      n = o.length || ''; hot = o.some(t => t.urgent || (dueInfo(t)||{}).lvl === 'late');
    }
    return `<button data-nav="${l.id}" class="${ui.view===l.id?'on':''}">${l.label}${n!==''?`<span class="ct tab ${hot?'hot':''}">${n}</span>`:''}</button>`;
  }).join('');
  return `<div class="sous-nav" role="tablist" aria-label="Listes">${items}</div>${bandeauRevue()}`;
}
export function revueEnAttente(){ return S.tasks.filter(isStale).length; }
function bandeauRevue(){
  const n = revueEnAttente(); if(!n) return '';
  return `<div class="bandeau">${I.spark}<p><b>Une période vient de se terminer.</b><small>${n} tâche${n>1?'s':''} à ranger : faite${n>1?'s':''}, reportée${n>1?'s':''} ou abandonnée${n>1?'s':''}.</small></p><button class="btn" data-act="review-open">Faire le point</button></div>`;
}
export const revueOuverte = () => !!review;

/* =========================================================
   Interface de l'onglet
   ========================================================= */
export function rendre(){
  elanCache = null;
  if(ui.view === 'main') renderMain();
  else if(ui.view === 'stats') renderStats();
  else renderList(ui.view);
  $('#view').insertAdjacentHTML('afterbegin', sousNav());
}
export const rafraichir = rerenderKeepInput;
export function ouvrirTache(id){ openDrawer(id); }

export function touche(e){
  if(e.key === 'n' || e.key === 'N'){ e.preventDefault(); if(ui.view === 'stats'){ ui.view = 'main'; render(); } const i = $('#addInput'); if(i) i.focus(); return true; }
  const map = { '1':'main','2':'quarter','3':'month','4':'week','5':'day','p':'stats','P':'stats' };
  if(map[e.key]){ ui.view = map[e.key]; render(); return true; }
  return false;
}

app.clics.push((e) => {
  const tg = e.target.closest('[data-nav],[data-cat],[data-check],[data-focus],[data-task],[data-act],[data-done-toggle],[data-move],[data-setcat],[data-qd],[data-rv],[data-rvd],[data-range],[data-subcheck],[data-subdel],[data-fileopen],[data-filedel],[data-linkdel],#addUrg');
  if(!tg) return false;
  const d = tg.dataset;
  if(tg.id === 'addUrg'){ ui.addUrgent = !ui.addUrgent; tg.classList.toggle('on', ui.addUrgent); return true; }
  if(d.nav){ ui.view = d.nav; $('#main').scrollTop = 0; render(); return true; }
  if(d.cat !== undefined && !d.task){ ui.cat = d.cat ? (ui.cat === d.cat ? null : d.cat) : null; if(ui.view === 'stats') ui.view = 'main'; rerenderKeepInput(); return true; }
  if(d.check){ e.stopPropagation(); toggleDone(d.check); return true; }
  if(d.focus){ e.stopPropagation(); openFocus(d.focus); return true; }
  if(d.doneToggle){ ui.showDone[d.doneToggle] = !ui.showDone[d.doneToggle]; render(); return true; }
  if(d.range){ ui.range = +d.range; render(); return true; }
  if(d.move){ const t = courante(); if(t) moveTask(t, d.move); return true; }
  if(d.setcat !== undefined){ const t = courante(); if(t){ t.cat = d.setcat || null; save(); render(); renderDrawer(); } return true; }
  if(d.qd){ const t = courante(); if(t){ t.deadline = quickDate(d.qd).toISOString(); t.notified = false; save(); render(); renderDrawer(); } return true; }
  if(d.rv){ review[d.rv].done = d.v === '1'; renderReview(); return true; }
  if(d.rvd){ review[d.rvd].dest = d.v; renderReview(); return true; }
  if(d.subcheck){ const t = courante(), s = t && t.subtasks.find(x => x.id === d.subcheck); if(s){ s.done = !s.done; save(); render(); renderDrawer(); } return true; }
  if(d.subdel){ const t = courante(); if(t){ const i = t.subtasks.findIndex(x => x.id === d.subdel), s = t.subtasks[i]; if(i >= 0){ t.subtasks.splice(i,1); save(); render(); renderDrawer(); toast('Sous-tâche retirée', () => { t.subtasks.splice(i,0,s); save(); render(); if(ui.selected === t.id) renderDrawer(); }); } } return true; }
  if(d.fileopen){ if(window.desktop) window.desktop.ouvrirPiece(d.fileopen).then(ok => { if(!ok) toast('Fichier introuvable'); }); return true; }
  if(d.filedel){ const t = courante(); if(t){ const f = t.files.find(x => x.id === d.filedel); t.files = t.files.filter(x => x.id !== d.filedel); save(); if(f && window.desktop) window.desktop.retirerPiece(f.rel); render(); renderDrawer(); toast('Fichier retiré de la tâche'); } return true; }
  if(d.linkdel){ const t = courante(); if(t){ t.links = t.links.filter(x => x.id !== d.linkdel); save(); render(); renderDrawer(); } return true; }
  if(d.task){ openDrawer(d.task); return true; }
  switch(d.act){
    case 'close-drawer': closeDrawer(); break;
    case 'hist-more': ui.histN = (ui.histN || 30) + 30; render(); break;
    case 'toggle-urgent': { const t = courante(); if(t){ t.urgent = !t.urgent; save(); render(); renderDrawer(); } break; }
    case 'clear-deadline': { const t = courante(); if(t){ t.deadline = null; save(); render(); renderDrawer(); } break; }
    case 'delete': {
      const t = courante(); if(!t) break;
      const idx = S.tasks.indexOf(t); S.tasks.splice(idx,1); save(); closeDrawer();
      toast('Tâche supprimée', () => { S.tasks.splice(idx,0,t); save(); render(); });
      break;
    }
    case 'add-file': {
      const t = courante(); if(!t || !window.desktop) break;
      window.desktop.joindre('pieces/' + t.id).then(fs => {
        if(!fs.length) return;
        fs.forEach(f => t.files.push({ id: uid(), nom: f.nom, rel: f.rel, taille: f.taille }));
        save(); render(); if(ui.selected === t.id) renderDrawer();
        toast(fs.length > 1 ? `${fs.length} fichiers joints` : 'Fichier joint');
      });
      break;
    }
    case 'review-open': checkReview(true); break;
    case 'review-ok': applyReview(); break;
    case 'review-later': S.snooze = Date.now() + 3*36e5; save(); review = null; $('#modal').classList.remove('show'); break;
    case 'clear-examples': {
      if(tg.dataset.confirm !== '1'){ tg.dataset.confirm = '1'; tg.textContent = 'Confirmer : tout effacer ?'; break; }
      S.tasks = S.tasks.filter(t => !t.example); S.log = []; save(); if(review){ review = null; $('#modal').classList.remove('show'); } render(); toast('Exemples effacés. À toi de jouer.'); break;
    }
    default: return false;
  }
  return true;
});

document.addEventListener('submit', e => {
  const id = e.target.id;
  if(id === 'addForm'){ e.preventDefault(); addTask(e.target); }
  if(id === 'subAdd'){
    e.preventDefault(); const t = courante(), v = $('#subInput').value.trim(); if(!t || !v) return;
    t.subtasks.push({ id: uid(), title: v, done: false, min: null }); save(); render(); renderDrawer();
    const i = $('#subInput'); if(i) i.focus();
  }
  if(id === 'linkAdd'){
    e.preventDefault(); const t = courante(); if(!t) return;
    const l = lienPropre($('#linkInput').value);
    if(!l){ toast("Ce lien n'est pas valide"); return; }
    t.links.push(l); save(); render(); renderDrawer();
  }
});
$('#scrim').addEventListener('click', closeDrawer);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if(app.onglet === 'taches' && ui.view === 'stats') drawChart(elan().series.slice(-ui.range)); }, 120); });
