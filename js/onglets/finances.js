// Onglet « Mes finances » : vue d'ensemble (passé et futur), ce mois-ci (enveloppes, bêtises), opérations (saisie, import de relevé),
// mon passé (bilans). Toutes les données vivent dans S.finances ; les calculs sont dans ../finances/.
import { I } from '../noyau/icones.js';
import { ymd, MOIS, MOIS_C, JOURS, cap } from '../noyau/dates.js';
import { S, save, uid } from '../noyau/store.js';
import { $, esc, toast } from '../noyau/ui.js';
import { app } from '../noyau/bus.js';
import { GROUPES, groupe, nomSous, estPrive, BUDGETS } from '../finances/taxonomie.js';
import { classer, cleMarchand } from '../finances/classement.js';
import { lireBNP, lireRevolut, fusionner } from '../finances/releves.js';
import * as C from '../finances/calculs.js';
import { financesParDefaut } from '../finances/defauts.js';

const ui = { section: 'ensemble', horizon: 5, filtre: 'tout', recherche: '', moisOps: 'tous', moisVu: null, moisPasse: 12, limite: 120, prive: false, survol: false };
const render = () => app.rendre();
const F = () => S.finances;
const auj = () => new Date();

/* ---------- formats ---------- */
const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const eur = (n, dec = false) => `${n < 0 ? '−' : ''}${(dec ? nf : nf0).format(Math.abs(n))} €`;
const eurS = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${nf.format(Math.abs(n))} €`;
const k = n => Math.abs(n) >= 1e6 ? `${nf0.format(n / 1e6)} M€` : Math.abs(n) >= 10000 ? `${nf0.format(n / 1000)} k€` : eur(n);
const nomMois = (m, court = false) => { const [y, mo] = m.split('-').map(Number); return `${(court ? MOIS_C : MOIS)[mo - 1]} ${y}`; };
const nomMoisCourt = m => MOIS_C[+m.slice(5) - 1];
const dateTxt = d => { const [y, m, j] = d.split('-').map(Number); const x = new Date(y, m - 1, j); return `${cap(JOURS[x.getDay()])} ${j} ${MOIS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`; };
const montantInput = s => { const n = parseFloat(String(s).replace(/\s|€/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

/* ---------- données ---------- */
export function assurer(){
  if(!S.finances || typeof S.finances !== 'object') S.finances = financesParDefaut();
  const d = financesParDefaut(), f = S.finances;
  for(const cle of Object.keys(d)) if(f[cle] === undefined) f[cle] = d[cle];
  f.reglages = Object.assign({}, d.reglages, f.reglages);
  for(const cle of ['budgets', 'noms', 'poches', 'projection']) f.reglages[cle] = Object.assign({}, d.reglages[cle], f.reglages[cle]);
  f.poches = Object.assign({}, d.poches, f.poches);
  return f;
}
let chargement = null;
async function chargerHistorique(){
  const f = F();
  if(f.historique || f.ops.length || chargement) return;
  chargement = import('../finances/historique.js').then(({ LIGNES, SOLDE }) => {
    if(!LIGNES.length){ f.historique = true; save(); render(); return; }
    f.ops = LIGNES.map(l => ({ id: uid(), date: l[0], lib: l[1], montant: l[2], compte: 'bnp', source: 'bnp', groupe: l[3], sous: l[4], banque: l[5], betise: l[6] ? true : null, verif: !!l[7], ...(l[8] ? { libBanque: l[8], attente: !!l[9] } : {}) }));
    f.soldes.bnp = { montant: SOLDE.montant, date: SOLDE.date };
    f.imports.push({ date: SOLDE.date, fichier: "Relevé d'opérations BNP", compte: 'bnp', lues: LIGNES.length, nouvelles: LIGNES.length, fusionnees: 0, doublons: 0, aVerifier: LIGNES.filter(l => l[7]).length });
    f.historique = true; save(); render();
  }).catch(() => { chargement = null; });
}
const visible = o => !estPrive(o.groupe, o.sous) || ui.prive;

/* ---------- petites briques ---------- */
const tag = (txt, cls = '') => `<span class="fin-tag ${cls}">${esc(txt)}</span>`;
const barre = pct => `<div class="fin-barre"><i style="width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%"></i></div>`;
const kpi = (sur, val, txt, cls = '') => `<div class="carte fin-kpi ${cls}"><div class="sur">${sur}</div><span class="mt">${val}</span>${txt ? `<p>${txt}</p>` : ''}</div>`;
const pasDeDonnees = () => `<div class="carte" style="text-align:center;padding:48px"><h2 class="titre-sec">Chargement de ton historique…</h2><p class="doux">Les 1 221 opérations de ton relevé BNP arrivent.</p></div>`;

function entete(){
  const sections = [['ensemble', "Vue d'ensemble"], ['mois', 'Ce mois-ci'], ['operations', 'Opérations'], ['passe', 'Mon passé']];
  const titres = { ensemble: 'Mon <i>cap</i> financier.', mois: `${cap(nomMois(moisVu()))}`, operations: 'Mes <i>opérations</i>', passe: 'Mon <i>passé</i>, sans filtre.' };
  return `<div class="head"><div><div class="eyebrow">${cap(JOURS[auj().getDay()])} ${auj().getDate()} ${MOIS[auj().getMonth()]} · Mes finances</div><h1>${titres[ui.section]}</h1></div>
    <div class="fin-nav"><div class="seg" role="tablist" aria-label="Sections">${sections.map(([id, nom]) => `<button role="tab" aria-selected="${ui.section === id}" class="${ui.section === id ? 'on' : ''}" data-fin="section:${id}">${nom}</button>`).join('')}</div>
      <button class="btn fort" data-fin="nouvelle">${I.plus}Nouvelle opération</button></div></div>`;
}
const moisVu = () => ui.moisVu || C.cleMois(auj());

export function rendre(vue){
  const f = assurer();
  if(!f.historique && !f.ops.length) chargerHistorique();
  const corps = !f.ops.length && !f.historique ? pasDeDonnees()
    : ui.section === 'mois' ? secMois() : ui.section === 'operations' ? secOperations() : ui.section === 'passe' ? secPasse() : secEnsemble();
  vue.innerHTML = `<div class="fin ${f.reglages.discret ? 'discret' : ''}">${entete()}${corps}</div>`;
  brancher();
}
export function quitter(){ ui.prive = false; }
export function rafraichir(){ if(!document.querySelector('.fin input:focus, .fin textarea:focus')) render(); }
export function entrer(params){ if(params && params.section) ui.section = params.section; }

/* =========================================================
   1. Vue d'ensemble
   ========================================================= */
function secEnsemble(){
  const f = F(), a = auj(), mCour = C.cleMois(a);
  const pat = C.patrimoine(f);
  const joursRest = C.joursDansMois(mCour) - a.getDate() + 1;
  const comptes = Object.values(f.soldes).reduce((s, x) => s + (x && x.montant || 0), 0);
  const parJour = comptes / Math.max(1, joursRest);
  const pl3 = C.moyenne(f, mCour, 3, b => C.depenseGroupe(b, 'plaisirs')), pl12 = C.moyenne(f, mCour, 12, b => C.depenseGroupe(b, 'plaisirs'));
  const derniers = C.moisConnus(f).filter(m => m < mCour).slice(-12);
  const sansAide = derniers.filter(m => C.bilanMois(f, m).soldeSansFamille >= 0);
  const kpis = `<section class="fin-grille" aria-label="Chiffres clés">
    ${kpi('Patrimoine net', eur(pat), `Comptes ${eur(comptes)} · LEP ${eur(f.poches.lep)} · PEA ${eur(f.poches.pea)}`)}
    ${kpi('Ce mois-ci, il reste', `${eur(parJour)} <small>/ jour</small>`, `${eur(comptes)} à tenir jusqu'au ${C.joursDansMois(mCour)} ${MOIS[a.getMonth()]}`)}
    ${kpi('Mes Plaisirs, moyenne 3 mois', eur(pl3), pl12 ? `<span class="${pl3 <= pl12 ? 'bon' : 'mal'}" style="font-weight:600">${pl3 <= pl12 ? '−' : '+'}${eur(Math.abs(pl12 - pl3))} par rapport à ta moyenne sur un an</span>` : '')}
    ${kpi('Mois sans aide familiale', `${sansAide.length} <small>sur ${derniers.length}</small>`, sansAide.length ? sansAide.map(nomMoisCourt).join(', ') : 'Pas encore')}
  </section>`;
  return kpis + carteTrajectoire() + `<div class="fin-deux">${cartePaliers()}${cartePoches()}</div>` + carteRegles();
}

function carteTrajectoire(){
  const f = F(), a = auj(), ans = ui.horizon;
  const passe = C.soldesPasses(f).map(p => ({ mois: p.mois, v: p.solde + C.totalPoches(f) * 0 }));
  const sc = { avant: C.projection(f, 'avant', a, ans), plan: C.projection(f, 'plan', a, ans), cible: C.projection(f, 'cible', a, ans) };
  const debut = passe.length ? passe[0].mois : C.cleMois(a), fin = sc.plan.length ? sc.plan[sc.plan.length - 1].mois : C.cleMois(a);
  const tous = [debut]; for(let m = debut; m < fin; m = C.moisSuivant(m)) tous.push(C.moisSuivant(m));
  const ix = new Map(tous.map((m, i) => [m, i])), N = Math.max(1, tous.length - 1);
  const pat = C.patrimoine(f), mAuj = C.cleMois(a);
  const valeurs = [...passe.map(p => p.v), pat, ...Object.values(sc).flat().map(p => p.patrimoine)];
  let ymin = Math.min(0, ...valeurs), ymax = Math.max(1000, ...valeurs);
  const pas = pasJoli((ymax - ymin) / 4); ymin = Math.floor(ymin / pas) * pas; ymax = Math.ceil(ymax / pas) * pas;
  const W = 1000, H = 300, X = i => (i / N * W).toFixed(1), Y = v => (H - (v - ymin) / (ymax - ymin) * H).toFixed(1);
  const chemin = pts => pts.length ? 'M' + pts.map(([m, v]) => `${X(ix.get(m) ?? 0)},${Y(v)}`).join(' L') : '';
  const debutFutur = [[mAuj, pat]];
  const traits = [
    ['avant', '#C4553F', '2', '2 5', "Si je continue comme avant"],
    ['cible', 'var(--lav)', '2.5', '7 5', 'Plan + business (cible)'],
    ['plan', 'var(--accent)', '3', '', 'Plan appliqué'],
  ];
  const lignes = traits.map(([s, c, w, d]) => `<path d="${chemin(debutFutur.concat(sc[s].map(p => [p.mois, p.patrimoine])))}" fill="none" stroke="${c}" stroke-width="${w}" ${d ? `stroke-dasharray="${d}"` : ''} vector-effect="non-scaling-stroke"/>`).join('');
  const reel = `<path d="${chemin(passe.map(p => [p.mois, p.v]).concat([[mAuj, pat]]))}" fill="none" stroke="var(--ink)" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  const grille = [0, 1, 2, 3, 4].map(i => { const v = ymin + (ymax - ymin) * i / 4; return `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 2 : 1}" vector-effect="non-scaling-stroke"/>`; }).join('');
  const xAuj = X(ix.get(mAuj) ?? 0);
  const coussin = C.dateCoussin(f, a);
  const etCoussin = coussin && coussin !== 'atteint' && ix.has(coussin) ? `<span class="fin-etiq lag" style="left:${(ix.get(coussin) / N * 100).toFixed(1)}%;top:${Math.max(30, +Y(f.reglages.poches.coussin) - 34)}px">Coussin ${eur(f.reglages.poches.coussin)} · ${nomMois(coussin, true)}</span>` : '';
  const annees = []; const pasAn = Math.max(1, Math.round(ans / 5));
  for(const m of tous) if(m.endsWith('-01') && (+m.slice(0, 4) - +tous[0].slice(0, 4)) % pasAn === 0) annees.push(m);
  const finVal = s => sc[s].length ? sc[s][sc[s].length - 1].patrimoine : pat;
  return `<section class="carte" aria-labelledby="t-traj">
    <div class="ligne" style="justify-content:space-between;align-items:flex-start"><div><div class="sur">D'où je viens, où je vais</div><h2 id="t-traj">Mon patrimoine, mois après mois</h2></div>
      <div class="seg" aria-label="Horizon">${[1, 5, 10, 20, 30].map(n => `<button class="${ans === n ? 'on' : ''}" data-fin="horizon:${n}" aria-pressed="${ans === n}">${n} an${n > 1 ? 's' : ''}</button>`).join('')}</div></div>
    <div class="fin-legende">
      <span><svg aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--ink)" stroke-width="3"/></svg>Ma réalité</span>
      ${traits.slice().reverse().map(([, c, w, d, nom]) => `<span><svg aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="${c}" stroke-width="${w}" ${d ? `stroke-dasharray="${d}"` : ''}/></svg>${nom}</span>`).join('')}
    </div>
    <div class="fin-courbe"><div class="axe" aria-hidden="true">${[4, 3, 2, 1, 0].map(i => `<span>${k(ymin + (ymax - ymin) * i / 4)}</span>`).join('')}</div>
      <div class="zone">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Patrimoine passé et projeté sur ${ans} ans : plan ${eur(finVal('plan'))}, cible ${eur(finVal('cible'))}, comme avant ${eur(finVal('avant'))}">
          <rect x="0" y="0" width="${xAuj}" height="${H}" fill="var(--sunk)" opacity=".55"/>${grille}
          <line x1="${xAuj}" x2="${xAuj}" y1="0" y2="${H}" stroke="var(--ink)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>
          ${lignes}${reel}
        </svg>
        <span class="fin-etiq auj" style="left:${(+xAuj / W * 100).toFixed(1)}%">Aujourd'hui</span>${etCoussin}
        <div class="abs" aria-hidden="true"><span>${nomMois(tous[0], true)}</span>${annees.filter(m => m !== tous[0]).map(m => `<span>${m.slice(0, 4)}</span>`).join('')}<span>${nomMois(fin, true)}</span></div>
      </div></div>
    <div class="fin-fins">
      <div><div class="doux">Dans ${ans} an${ans > 1 ? 's' : ''}, si j'applique le plan</div><span class="mt">${eur(finVal('plan'))}</span></div>
      <div><div class="doux">Avec mes paliers business</div><span class="mt">${eur(finVal('cible'))}</span></div>
      <div class="rouge"><div class="doux">Si je continue comme avant</div><span class="mt">${eur(finVal('avant'))}</span></div>
    </div>
  </section>`;
}
function pasJoli(x){ const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x)))); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p; }

function cartePaliers(){
  const f = F(), a = auj(), mCour = C.cleMois(a);
  const dernier = C.moisConnus(f).filter(m => m < mCour).slice(-1)[0];
  const revenuActuel = dernier ? (() => { const b = C.bilanMois(f, dernier); return b.entrees - b.famille; })() : 0;
  const positifs = C.moisPositifsDAffilee(f, a);
  let premierEnCours = true;
  const items = f.paliers.map((p, i) => {
    let pct = 0, detail = p.detail || '';
    if(p.type === 'stabiliser'){ pct = Math.min(1, positifs / 3); detail = `${Math.min(3, positifs)} mois sur 3 d'affilée`; }
    else if(p.type === 'coussin'){ pct = Math.min(1, (f.poches.lep || 0) / f.reglages.poches.coussin); detail = `LEP ${eur(f.poches.lep || 0)} sur ${eur(f.reglages.poches.coussin)}`; }
    else if(p.revenu){ pct = Math.min(1, Math.max(0, revenuActuel) / p.revenu); detail = `${p.detail ? p.detail + ' · ' : ''}${eur(revenuActuel)} gagnés en ${nomMoisCourt(dernier || mCour)}`; }
    const fait = pct >= 1, enCours = !fait && premierEnCours; if(enCours) premierEnCours = false;
    const reve = i === f.paliers.length - 1;
    return `<li><span class="n ${fait ? 'fait' : enCours ? 'en' : ''} ${reve && !fait ? 'reve' : ''}">${fait ? I.check.replace('<svg', '<svg width="14" height="14"') : i}</span>
      <div style="flex:1;min-width:0"><b>${esc(p.nom)}</b><div class="doux">${fait ? 'Atteint · ' : enCours ? 'En cours · ' : ''}${esc(detail)}${p.vise ? ` · visé ${nomMois(p.vise, true)}` : ''}</div>${enCours ? barre(pct) : ''}</div></li>`;
  }).join('');
  return `<section class="carte" aria-labelledby="t-pal"><div class="sur">Ma route vers ${eur(f.reglages.projection.reve)} par mois</div><h2 id="t-pal">Les paliers</h2><ol class="fin-paliers">${items}</ol>
    <p class="note">Les paliers et leurs dates se règlent dans Réglages › Mes finances.</p></section>`;
}

function cartePoches(){
  const f = F(), R = f.reglages;
  const mis = -f.ops.filter(o => (o.groupe === 'trading' || o.groupe === 'business') && o.montant < 0).reduce((a, o) => a + o.montant, 0);
  const recu = f.ops.filter(o => (o.groupe === 'entrees' && o.sous === 'business') || (o.groupe === 'trading' && o.montant > 0)).reduce((a, o) => a + o.montant, 0);
  return `<section class="carte" aria-labelledby="t-poches"><div class="sur">Où dort mon argent</div><h2 id="t-poches">Mes trois poches</h2>
    <div class="fin-poche"><div class="haut"><b>LEP · sécurité</b>${tag('Disponible tout de suite', 'lag')}</div>
      <div class="bas"><span class="mt">${eur(f.poches.lep)} <small class="doux">sur ${eur(R.poches.coussin)}</small></span><button class="btn ghost" data-fin="poche:lep">Mettre à jour</button></div>${barre(f.poches.lep / R.poches.coussin)}
      <p class="note">${R.poches.tauxLEP.toString().replace('.', ',')} % net · virement auto de ${eur(R.poches.virement)} le jour de paie</p></div>
    <div class="fin-poche"><div class="haut"><b>PEA · ma richesse</b>${tag('Souple après 5 ans', 'warm')}</div>
      <div class="bas"><span class="mt">${eur(f.poches.pea)}</span><button class="btn ghost" data-fin="poche:pea">Mettre à jour</button></div>
      <p class="note">ETF Monde · hypothèse ${R.projection.rendementPEA} %/an · démarre une fois le coussin plein</p></div>
    <div class="fin-poche"><div class="haut"><b>Poche Trading</b>${tag('Libre, plafonnée', 'lav')}</div>
      <div class="bas"><span class="mt">${eur(f.poches.trading)}</span><button class="btn ghost" data-fin="poche:trading">Mettre à jour</button></div>
      <p class="note">${R.poches.partTrading} % des revenus · business et trading : mis ${eur(mis)}, récupéré ${eur(recu)}</p></div>
  </section>`;
}

function carteRegles(){
  const f = F();
  return `<section class="carte" aria-labelledby="t-regles"><div class="ligne" style="justify-content:space-between;align-items:flex-end"><div><div class="sur">Mes règles du plan</div><h2 id="t-regles" style="margin-bottom:6px">Ce que je me suis promis</h2></div>
      <button class="btn" data-fin="section:mois">Voir mon mois${I.arrow}</button></div>
    <ol class="fin-regles">${f.reglesPlan.map((r, i) => `<li><span class="n">${i + 1}</span><p>${esc(r)}</p><button class="icon-btn" data-fin="regle-suppr:${i}" aria-label="Supprimer la règle ${i + 1}" title="Supprimer">${I.trash}</button></li>`).join('')}</ol>
    <form class="form-ligne" id="finRegleForm" autocomplete="off" style="margin-top:12px"><input class="inp" id="finRegle" placeholder="Nouvelle règle, ex. : pas de snack avant 18 h" aria-label="Nouvelle règle"><button class="btn primary">${I.plus}Ajouter</button></form>
  </section>`;
}

/* =========================================================
   2. Ce mois-ci
   ========================================================= */
function secMois(){
  const f = F(), a = auj(), m = moisVu(), enCours = m === C.cleMois(a);
  const b = C.bilanMois(f, m), env = C.enveloppes(f, m, a);
  const fixes = -(b.groupes.fixes || 0);
  const comptes = Object.values(f.soldes).reduce((s, x) => s + (x && x.montant || 0), 0);
  const joursRest = C.joursDansMois(m) - a.getDate() + 1;
  const connus = C.moisConnus(f), i = connus.indexOf(m);
  const nav = `<div class="ligne"><button class="icon-btn" data-fin="mois:${C.moisSuivant(m, -1)}" aria-label="Mois précédent" ${i <= 0 && i !== -1 ? 'disabled' : ''}>${I.gauche}</button>
    <b style="min-width:130px;text-align:center">${cap(nomMois(m))}</b><button class="icon-btn" data-fin="mois:${C.moisSuivant(m)}" aria-label="Mois suivant" ${enCours ? 'disabled' : ''}>${I.chev}</button>${!enCours ? `<button class="btn ghost" data-fin="mois:">Revenir à ce mois</button>` : ''}</div>`;
  const tete = `<section class="carte" style="display:flex;flex-direction:column;gap:14px">${nav}<div class="fin-grille">
    <div class="fin-kpi"><div class="sur">Entré</div><span class="mt">${eur(b.entrees)}</span><p>${b.famille ? `dont ${eur(b.famille)} de la famille` : (b.groupes.entrees ? 'mes revenus' : 'rien pour l’instant')}</p></div>
    <div class="fin-kpi"><div class="sur">Sorti</div><span class="mt">${eur(b.sorties)}</span><p>dont ${eur(fixes)} de fixes</p></div>
    ${enCours ? `<div class="fin-kpi"><div class="sur">Sur mes comptes</div><span class="mt">${eur(comptes)}</span><p>soit ${eur(comptes / Math.max(1, joursRest))} par jour d'ici le ${C.joursDansMois(m)}</p></div>`
      : `<div class="fin-kpi"><div class="sur">Solde du mois</div><span class="mt ${b.solde >= 0 ? 'bon' : 'mal'}">${eur(b.solde)}</span><p>sans la famille : ${eur(b.soldeSansFamille)}</p></div>`}
    <div class="carte fin-kpi encre"><div class="sur">Épargne ce mois</div><span class="mt">${eur(b.epargne)}</span><p>${b.epargne > 0 ? 'Bien joué.' : 'Le virement auto démarre avec le salaire'}</p></div>
  </div></section>`;
  const noms = { courses: 'Courses', plaisirs: 'Plaisirs', durables: 'Plaisirs durables', imprevus: 'Imprévus' };
  const enveloppesHtml = `<section class="fin-grille" aria-label="Mes enveloppes">${env.map(e => {
    const dep = e.depense > e.budget + 0.005;
    let msg;
    if(e.id === 'durables' && f.reglages.cagnotte !== false) msg = e.reste >= 0 ? `<span class="bon">Cagnotte : ${eur(e.reste)} de côté</span>` : `<span class="mal">Cagnotte à ${eur(e.reste)}</span>`;
    else if(dep) msg = `<span class="mal">${eur(e.depense - e.budget)} au-dessus${enCours ? ` · à ce rythme, ${eur(e.rythme)} fin ${MOIS[+m.slice(5) - 1]}` : ''}</span>`;
    else msg = `<span class="bon">Reste ${eur(e.reste)}${enCours && e.rythme > e.budget ? ` · attention au rythme (${eur(e.rythme)})` : ' · dans les clous'}</span>`;
    return `<div class="carte fin-env ${dep && e.id !== 'durables' ? 'depasse' : ''}" data-g="${e.id}"><h3>${noms[e.id]}<small>${e.id === 'durables' ? '+' : ''}${eur(f.reglages.budgets[e.id])}${e.id === 'durables' ? '/mois' : ''}</small></h3><span class="mt">${eur(e.depense)}</span>${barre(e.pct)}<p>${msg}</p></div>`;
  }).join('')}</section>`;
  return tete + enveloppesHtml + carteBetisesMois(b, m) + `<div class="fin-deux">${cartePlaisirs(m)}${carteDernieres(m)}</div>` + carteFixes(m);
}

function carteBetisesMois(b, m){
  const f = F(), moy = C.moyenne(f, C.cleMois(auj()), 12, x => x.betises), obj = f.reglages.objectifBetises;
  const n = C.opsDuMois(f, m).filter(o => o.betise === true).length;
  return `<section class="carte" aria-labelledby="t-bet" style="display:flex;flex-wrap:wrap;gap:22px;align-items:center">
    <div style="flex:1 1 300px;min-width:0"><div class="sur mal">Mes bêtises de ${MOIS[+m.slice(5) - 1]}</div>
      <h2 id="t-bet" style="margin:6px 0">${eur(b.betises)} marquées <span class="doux" style="font-family:var(--f-body)">· ${n} opération${n > 1 ? 's' : ''}</span></h2>
      <p class="doux" style="margin:0">${b.aTrier > 0 ? `Élan te propose ${eur(b.aTrier)} de plus à trier (snacks, Deliveroo, privé).` : 'Rien à trier. Tu décides de ce qui est une bêtise, opération par opération.'}${obj ? ` Objectif : ${eur(obj)} maximum.` : ''}</p></div>
    <div class="ligne" style="gap:12px"><div class="fin-fins" style="margin:0;grid-template-columns:1fr"><div class="rouge"><div class="doux">Ta moyenne sur 12 mois</div><span class="mt">${eur(moy)}</span></div></div>
      <button class="btn" data-fin="trier">Trier mes bêtises</button></div>
  </section>`;
}

function cartePlaisirs(m){
  const f = F(), ops = C.opsDuMois(f, m).filter(o => o.groupe === 'plaisirs');
  const sous = groupe('plaisirs').sous;
  let prives = 0, nbPrives = 0;
  const lignes = sous.map(([id, nom, prive]) => {
    const l = ops.filter(o => o.sous === id), t = -l.reduce((a, o) => a + o.montant, 0);
    if(!l.length) return '';
    if(prive && !ui.prive){ prives += t; nbPrives++; return ''; }
    const extra = id === 'deliveroo' ? tag(`jokers ${Math.min(l.length, F().reglages.jokers)} sur ${F().reglages.jokers}${l.length > F().reglages.jokers ? ` · ${l.length - F().reglages.jokers} en trop` : ''}`, l.length > F().reglages.jokers ? 'rouge' : 'lag') : tag(`${l.length} fois`);
    return `<div class="l"><span>${esc(nom)} ${extra}</span><b class="mt">${eur(t)}</b></div>`;
  }).join('');
  const prive = nbPrives ? `<div class="l prive-l"><span class="ligne">${I.verrou.replace('<svg', '<svg width="15" height="15"')}${nbPrives} ligne${nbPrives > 1 ? 's' : ''} privée${nbPrives > 1 ? 's' : ''}</span><b class="mt">${eur(prives)}</b></div>` : '';
  const top = sous.map(([id]) => [id, -ops.filter(o => o.sous === id && visible(o)).reduce((a, o) => a + o.montant, 0)]).sort((a, b) => b[1] - a[1])[0];
  const conseils = { snacks: 'Tes snacks sont la plus grosse fuite ce mois. Un en-cas dans le sac, et un petit budget en liquide pour la semaine.', deliveroo: 'Deliveroo mène ce mois. Garde 2 plats tout prêts au congélateur pour les soirs de flemme.', sorties: 'Les sorties mènent ce mois. Fixe un montant avant de sortir et laisse la carte à la maison.' };
  return `<section class="carte" aria-labelledby="t-pl"><div class="ligne" style="justify-content:space-between"><div><div class="sur">Dans mes Plaisirs</div><h2 id="t-pl" style="margin-bottom:4px">Où part le plaisir</h2></div>
    <button class="btn ghost" data-fin="prive">${ui.prive ? 'Masquer le privé' : 'Afficher le privé'}</button></div>
    <div class="fin-lignes">${lignes || '<p class="doux">Aucun plaisir ce mois-ci.</p>'}${prive}</div>
    ${top && top[1] > 0 && conseils[top[0]] ? `<div class="fin-conseil">${conseils[top[0]]}</div>` : ''}</section>`;
}

function carteDernieres(m){
  const ops = C.opsDuMois(F(), m).filter(o => o.groupe !== 'interne').slice(0, 7);
  return `<section class="carte" aria-labelledby="t-der"><div class="sur">Dernières opérations</div><h2 id="t-der" style="margin-bottom:6px">${m === C.cleMois(auj()) ? 'Ces derniers jours' : cap(nomMois(m))}</h2>
    ${ops.map(ligneOp).join('') || '<p class="doux">Aucune opération.</p>'}
    <button class="btn ghost" data-fin="section:operations" style="margin-top:10px">Toutes mes opérations${I.arrow}</button></section>`;
}

function carteFixes(m){
  const f = F(), ops = C.opsDuMois(f, m).filter(o => o.groupe === 'fixes');
  const total = f.reglages.fixes.reduce((a, x) => a + (+x.montant || 0), 0), passe = -ops.reduce((a, o) => a + o.montant, 0);
  const pris = new Set();
  const cartes = f.reglages.fixes.map(x => {
    const mot = x.nom.toLowerCase().split(' ')[0];
    const o = ops.find(o => !pris.has(o.id) && (cleMarchand(o.lib).includes(mot) || Math.abs(Math.abs(o.montant) - x.montant) < 1));
    if(o) pris.add(o.id);
    return `<div><div class="doux">${esc(x.nom)}</div><span class="mt">${eur(x.montant, true)}</span><small class="${o ? 'bon' : 'doux'}" style="font-weight:600">${o ? 'Payé' : 'À venir'}</small></div>`;
  }).join('');
  return `<section class="carte" aria-labelledby="t-fix"><div class="ligne" style="justify-content:space-between"><h2 id="t-fix" style="margin:0 0 12px;font-family:var(--f-body);font-size:16px;font-weight:600">Charges fixes</h2><span class="doux">${eur(total)} prévus · ${eur(passe)} passés</span></div>
    <div class="fin-fixes">${cartes}</div></section>`;
}

/* =========================================================
   3. Opérations
   ========================================================= */
const FILTRES = [['tout', 'Tout'], ['depenses', 'Dépenses'], ['gains', 'Gains'], ['plaisirs', 'Plaisirs'], ['betises', 'Bêtises'], ['atrier', 'À trier'], ['verif', 'À vérifier']];
function filtrer(){
  const f = F(), q = ui.recherche.trim().toLowerCase();
  const debut = f.reglages.debutMois || 1;
  return f.ops.filter(o => {
    if(ui.moisOps !== 'tous' && C.periode(o.date, debut) !== ui.moisOps) return false;
    const fl = ui.filtre;
    if(fl === 'depenses' && !(o.montant < 0 && o.groupe !== 'interne')) return false;
    if(fl === 'gains' && !(o.montant > 0 && o.groupe !== 'interne')) return false;
    if(fl === 'plaisirs' && !(o.groupe === 'plaisirs' || o.groupe === 'durables')) return false;
    if(fl === 'betises' && o.betise !== true) return false;
    if(fl === 'atrier' && !(o.aTrier && o.betise == null)) return false;
    if(fl === 'verif' && !o.verif) return false;
    if(q){
      if(estPrive(o.groupe, o.sous) && !ui.prive) return false;
      const txt = `${o.lib} ${o.libBanque || ''} ${groupe(o.groupe).nom} ${nomSous(o.groupe, o.sous)} ${nf.format(Math.abs(o.montant))} ${o.note || ''}`.toLowerCase();
      if(!txt.includes(q)) return false;
    }
    return true;
  });
}
function ligneOp(o){
  const cache = estPrive(o.groupe, o.sous) && !ui.prive;
  const g = groupe(o.groupe);
  const source = o.source === 'manuel' ? (o.rapproche ? 'Saisi par toi · retrouvé dans le relevé' : 'Saisi par toi') : (o.compte === 'revolut' ? 'Relevé Revolut' : 'Relevé BNP');
  const lib = cache ? 'Ligne privée' : o.lib;
  const initiale = cache ? '•' : (lib.replace(/^(CB|Virement (à|de)|Retrait)\s+/i, '').trim().charAt(0) || '?').toUpperCase();
  return `<div class="fin-op" data-g="${o.groupe}"><span class="ico" aria-hidden="true">${esc(initiale)}</span>
    <div class="corps"><b>${esc(lib)}</b><span>${tag(cache ? 'Plaisirs · privé' : `${g.nom} · ${nomSous(o.groupe, o.sous)}`, o.verif ? 'warm' : '')}${o.betise === true ? tag('Bêtise', 'rouge') : o.aTrier && o.betise == null ? tag('Bêtise ?', '') : ''}${o.verif ? tag('à vérifier', 'warm') : ''}<span>${source}</span></span></div>
    <b class="mt ${o.montant > 0 ? 'plus' : ''}">${eurS(o.montant)}</b>
    <button class="icon-btn ${o.betise === true ? 'on' : ''}" data-fin="betise:${o.id}" aria-pressed="${o.betise === true}" aria-label="${o.betise === true ? 'Retirer des bêtises' : 'Marquer comme bêtise'}" title="${o.betise === true ? 'Retirer des bêtises' : 'Marquer comme bêtise'}">${I.drapeau}</button>
    <button class="icon-btn" data-fin="modifier:${o.id}" aria-label="Modifier ${esc(lib)}" title="Modifier">${I.crayon}</button></div>`;
}
function secOperations(){
  const f = F(), liste = filtrer(), debut = f.reglages.debutMois || 1;
  const comptes = liste.filter(o => o.groupe !== 'interne');
  const entrees = comptes.filter(o => o.montant > 0).reduce((a, o) => a + o.montant, 0), sorties = comptes.filter(o => o.montant < 0).reduce((a, o) => a + o.montant, 0);
  const betises = comptes.filter(o => o.betise === true).reduce((a, o) => a + o.montant, 0);
  const jours = []; let courant = null;
  for(const o of liste.slice(0, ui.limite)){ if(!courant || courant.date !== o.date){ courant = { date: o.date, ops: [] }; jours.push(courant); } courant.ops.push(o); }
  const mois = C.moisConnus(f).slice().reverse();
  const nbVerif = f.ops.filter(o => o.verif).length, nbTrier = f.ops.filter(o => o.aTrier && o.betise == null).length;
  const dernierImport = f.imports[f.imports.length - 1];
  return `<div class="fin-ops">
    <section class="carte" aria-label="Liste des opérations">
      <div class="fin-outils"><input class="inp" type="search" id="finCherche" placeholder="Chercher : Deliveroo, Lidl, 20…" value="${esc(ui.recherche)}" aria-label="Chercher une opération">
        <select class="inp" id="finMoisOps" style="flex:0 0 170px" aria-label="Mois"><option value="tous">Tous les mois</option>${mois.map(m => `<option value="${m}" ${ui.moisOps === m ? 'selected' : ''}>${cap(nomMois(m))}</option>`).join('')}</select></div>
      <div class="fin-filtres" style="margin-top:12px">${FILTRES.map(([id, nom]) => `<button class="chip ${ui.filtre === id ? 'on' : ''}" data-fin="filtre:${id}" aria-pressed="${ui.filtre === id}">${nom}${id === 'verif' && nbVerif ? ` · ${nbVerif}` : id === 'atrier' && nbTrier ? ` · ${nbTrier}` : ''}</button>`).join('')}</div>
      <div class="fin-resume"><span>${liste.length} opération${liste.length > 1 ? 's' : ''}</span><span>Entrées <b class="mt bon">${eurS(entrees)}</b></span><span>Sorties <b class="mt">${eurS(sorties)}</b></span><span>Bêtises <b class="mt mal">${eurS(betises)}</b></span>
        <button class="btn ghost" data-fin="prive" style="margin-left:auto">${ui.prive ? 'Masquer le privé' : 'Afficher le privé'}</button></div>
      ${jours.map(j => `<div class="fin-jour"><header><span>${dateTxt(j.date)}</span><span class="mt">${eurS(j.ops.filter(o => o.groupe !== 'interne').reduce((a, o) => a + o.montant, 0))}</span></header>${j.ops.map(ligneOp).join('')}</div>`).join('') || '<p class="doux" style="margin-top:20px">Aucune opération ne correspond.</p>'}
      ${liste.length > ui.limite ? `<div style="text-align:center;margin-top:18px"><button class="btn" data-fin="plus">Voir les ${Math.min(200, liste.length - ui.limite)} suivantes</button></div>` : ''}
    </section>
    <aside>
      <section class="carte" aria-labelledby="t-imp"><div class="sur">Tu as oublié de tout saisir ?</div><h2 id="t-imp">Dépose ton relevé</h2>
        <label class="fin-depot ${ui.survol ? 'survol' : ''}" id="finDepot">${I.ranger}<b>Glisse ici ton PDF BNP ou ton CSV Revolut</b><span class="btn">Choisir un fichier</span>
          <input type="file" id="finFichier" accept=".pdf,.csv,application/pdf,text/csv" hidden></label>
        ${dernierImport ? `<div class="fin-imp"><b>Dernier import · ${esc(dernierImport.fichier)}</b>
          <div><span class="doux">Opérations lues</span><b class="mt">${dernierImport.lues}</b></div>
          <div><span class="doux">Nouvelles, rangées toutes seules</span><b class="mt">${dernierImport.nouvelles}</b></div>
          <div><span class="doux">Déjà saisies par toi, fusionnées</span><b class="mt">${dernierImport.fusionnees}</b></div>
          <div><span class="doux">Déjà connues, ignorées</span><b class="mt">${dernierImport.doublons}</b></div>
          <div><span class="tiede">À vérifier</span><b class="mt tiede">${dernierImport.aVerifier}</b></div></div>` : ''}
        <p class="note">Après chaque import, tout se recalcule : budgets du mois, bilans, graphique et paliers. Une opération que tu as déjà saisie n'est jamais comptée deux fois.</p>
      </section>
    </aside></div>`;
}

/* =========================================================
   4. Mon passé
   ========================================================= */
function secPasse(){
  const f = F(), mCour = C.cleMois(auj());
  const mois = C.moisConnus(f).filter(m => m < mCour).slice(-ui.moisPasse);
  if(!mois.length) return '<div class="carte"><p class="doux">Pas encore de mois complet.</p></div>';
  const B = mois.map(m => C.bilanMois(f, m));
  const somme = fn => B.reduce((a, b) => a + fn(b), 0);
  const moySF = somme(b => b.soldeSansFamille) / B.length, fam = somme(b => b.famille), entrees = somme(b => b.entrees);
  const pl = somme(b => C.depenseGroupe(b, 'plaisirs')) / B.length;
  const mis = -f.ops.filter(o => (o.groupe === 'trading' || o.groupe === 'business') && o.montant < 0).reduce((a, o) => a + o.montant, 0);
  const recu = f.ops.filter(o => (o.groupe === 'entrees' && o.sous === 'business') || (o.groupe === 'trading' && o.montant > 0)).reduce((a, o) => a + o.montant, 0);
  const kpis = `<section class="fin-grille">
    ${kpi('Sans la famille, par mois', `<span class="${moySF >= 0 ? 'bon' : 'mal'}">${eur(moySF)}</span>`, `en moyenne sur ${B.length} mois`)}
    ${kpi('La famille a comblé', eur(fam), entrees ? `${Math.round(fam / entrees * 100)} % de mes entrées` : '')}
    ${kpi('Plaisirs, par mois', eur(pl), `pour un budget de ${eur(f.reglages.budgets.plaisirs)}`)}
    ${kpi('Business et trading', eur(mis), `mis · ${eur(recu)} récupéré`)}
  </section>`;
  const maxSF = Math.max(1, ...B.map(b => Math.abs(b.soldeSansFamille)));
  const div = `<section class="carte" aria-labelledby="t-sf"><div class="ligne" style="justify-content:space-between;align-items:flex-start"><div><div class="sur">Mois par mois</div><h2 id="t-sf" style="margin-bottom:4px">Mon solde, sans l'aide de la famille</h2>
      <p class="doux" style="margin:0 0 16px">Au-dessus de la ligne, je me suis suffi à moi-même.</p></div>
      <div class="seg">${[6, 12, 24].map(n => `<button class="${ui.moisPasse === n ? 'on' : ''}" data-fin="passe:${n}">${n} mois</button>`).join('')}</div></div>
    <div class="fin-div" role="img" aria-label="Solde sans famille par mois">${B.map(b => { const h = Math.round(Math.abs(b.soldeSansFamille) / maxSF * 100); return `<div class="col" title="${cap(nomMois(b.mois))} : ${eur(b.soldeSansFamille)}"><div class="h">${b.soldeSansFamille >= 0 ? `<i style="height:${h}px"></i>` : ''}</div><div class="zero"></div><div class="b">${b.soldeSansFamille < 0 ? `<i style="height:${h}px"></i>` : ''}</div><small>${nomMoisCourt(b.mois)}</small></div>`; }).join('')}</div></section>`;
  const plMax = Math.max(f.reglages.budgets.plaisirs, ...B.map(b => C.depenseGroupe(b, 'plaisirs')));
  const H = 160, budgetY = Math.round(f.reglages.budgets.plaisirs / plMax * H);
  const debut3 = B.slice(0, 3).reduce((a, b) => a + C.depenseGroupe(b, 'plaisirs'), 0) / Math.min(3, B.length), fin3 = B.slice(-3).reduce((a, b) => a + C.depenseGroupe(b, 'plaisirs'), 0) / Math.min(3, B.length);
  const evol = debut3 ? Math.round((fin3 - debut3) / debut3 * 100) : 0;
  const tendance = `<section class="carte" aria-labelledby="t-tend"><div class="sur">Ma tendance</div><h2 id="t-tend" style="margin-bottom:4px">${evol <= 0 ? 'Mes Plaisirs baissent' : 'Mes Plaisirs montent'}</h2>
    <p class="doux" style="margin:0 0 18px">${eur(debut3)} par mois au début, ${eur(fin3)} sur les 3 derniers mois : ${evol <= 0 ? `${Math.abs(evol)} % de moins` : `${evol} % de plus`}.</p>
    <div class="fin-barres" style="height:${H + 20}px" role="img" aria-label="Plaisirs par mois">${B.map(b => { const v = C.depenseGroupe(b, 'plaisirs'); return `<div class="col" title="${cap(nomMois(b.mois))} : ${eur(v)}"><i style="height:${Math.round(v / plMax * H)}px;${v > f.reglages.budgets.plaisirs ? '' : 'background:var(--accent)'}"></i><small>${nomMoisCourt(b.mois).charAt(0).toUpperCase()}</small></div>`; }).join('')}
      <div class="seuil" style="bottom:${budgetY + 20}px"><span>budget ${eur(f.reglages.budgets.plaisirs)}</span></div></div></section>`;
  const tot = {}; for(const o of f.ops) if(o.montant < 0 && (o.groupe === 'plaisirs')){ const c = estPrive(o.groupe, o.sous) && !ui.prive ? 'privé' : o.sous; tot[c] = (tot[c] || 0) - o.montant; }
  const fuites = Object.entries(tot).sort((a, b) => b[1] - a[1]), fmax = fuites.length ? fuites[0][1] : 1, ftotal = fuites.reduce((a, x) => a + x[1], 0);
  const carteFuites = `<section class="carte" aria-labelledby="t-fu"><div class="sur">Depuis le début</div><h2 id="t-fu">Mes fuites, en vrai</h2>
    <div style="display:flex;flex-direction:column;gap:12px">${fuites.map(([c, v]) => `<div><div class="ligne" style="justify-content:space-between"><span>${c === 'privé' ? `${I.verrou.replace('<svg', '<svg width="14" height="14"')} Lignes privées` : esc(nomSous('plaisirs', c))}</span><b class="mt">${eur(v)}</b></div>${barre(v / fmax)}</div>`).join('')}</div>
    <div class="fin-conseil" style="background:var(--sunk);color:var(--ink)">Ensemble, ces fuites font <b>${eur(ftotal)}</b>.</div></section>`;
  const betMax = Math.max(1, ...B.map(b => b.betises));
  const totalBet = somme(b => b.betises), pire = B.slice().sort((a, b) => b.betises - a.betises)[0], mieux = B.slice().sort((a, b) => a.betises - b.betises)[0];
  const carteBet = `<section class="carte" aria-labelledby="t-bets" style="display:flex;flex-wrap:wrap;gap:26px;align-items:flex-end">
    <div style="flex:1 1 280px;min-width:0"><div class="sur mal">Mes bêtises</div><h2 id="t-bets" style="margin-bottom:6px">${eur(totalBet)} évitables en ${B.length} mois</h2>
      <p class="doux" style="margin:0">Pour l'historique, Élan a pré-rempli avec Deliveroo, snacks et lignes privées. Retire le drapeau sur ce qui n'en était pas une.</p>
      <div class="fin-fins" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="rouge"><div class="doux">Pire mois</div><span class="mt">${nomMoisCourt(pire.mois)} · ${eur(pire.betises)}</span></div><div><div class="doux">Meilleur mois</div><span class="mt">${nomMoisCourt(mieux.mois)} · ${eur(mieux.betises)}</span></div></div></div>
    <div class="fin-barres" style="flex:2 1 420px;min-width:0;height:170px" role="img" aria-label="Bêtises par mois">${B.map(b => `<div class="col" title="${cap(nomMois(b.mois))} : ${eur(b.betises)}"><i style="height:${Math.round(b.betises / betMax * 145)}px;background:var(--urgent)"></i><small>${nomMoisCourt(b.mois).charAt(0).toUpperCase()}</small></div>`).join('')}</div></section>`;
  const table = `<section class="carte" aria-labelledby="t-tab"><h2 id="t-tab">Le détail, mois par mois</h2><div class="fin-table"><table>
    <thead><tr><th scope="col">Mois</th><th scope="col">Entrées</th><th scope="col">dont famille</th><th scope="col">Plaisirs</th><th scope="col">Bêtises</th><th scope="col">Sorties</th><th scope="col">Solde</th><th scope="col">Sans famille</th></tr></thead>
    <tbody>${B.slice().reverse().map(b => `<tr><td><button class="btn ghost" style="padding:2px 6px" data-fin="voir-mois:${b.mois}">${cap(nomMois(b.mois))}</button></td><td>${eur(b.entrees)}</td><td>${eur(b.famille)}</td><td>${eur(C.depenseGroupe(b, 'plaisirs'))}</td><td class="mal">${eur(b.betises)}</td><td>${eur(b.sorties)}</td><td>${eur(b.solde)}</td><td class="${b.soldeSansFamille >= 0 ? 'bon' : 'mal'}" style="font-weight:600">${eur(b.soldeSansFamille)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return kpis + div + `<div class="fin-deux">${tendance}${carteFuites}</div>` + carteBet + table;
}

/* =========================================================
   Fenêtre « opération » (nouvelle ou modification)
   ========================================================= */
let brouillon = null;
function ouvrirOperation(o){
  const f = F();
  brouillon = o ? Object.assign({}, o, { _id: o.id, saisie: nf.format(Math.abs(o.montant)), sens: o.montant >= 0 ? '+' : '-', choisi: true })
    : { _id: null, sens: '-', saisie: '', lib: '', groupe: 'plaisirs', sous: 'snacks', date: ymd(auj()), compte: 'revolut', betise: null, note: '', choisi: false };
  dessinerOperation(); $('#modal').classList.add('show');
  setTimeout(() => { const m = $('#finMontant'); if(m && !o) m.focus(); }, 60);
}
function dessinerOperation(){
  const b = brouillon, groupes = GROUPES.filter(g => g.id !== 'interne' && (b.sens === '+' ? (g.sens !== '-' || g.id === b.groupe) : g.id !== 'entrees'));
  const g = groupe(b.groupe);
  $('#modalBox').innerHTML = `<form id="finOpForm" class="fin-form" autocomplete="off">
    <div class="modal-h"><div class="eyebrow">${b._id ? 'Modifier l’opération' : 'Nouvelle opération'}</div>
      <div class="seg" role="group" aria-label="Type" style="margin:12px 0 8px"><button type="button" class="${b.sens === '-' ? 'on' : ''}" data-finf="sens:-">Dépense</button><button type="button" class="${b.sens === '+' ? 'on' : ''}" data-finf="sens:+">Gain</button></div>
      <label class="etiq">Montant<input class="montant" id="finMontant" inputmode="decimal" placeholder="0,00 €" value="${esc(b.saisie)}"></label></div>
    <div class="modal-b">
      <label class="etiq">Quoi<input class="inp" id="finLib" value="${esc(b.lib)}" placeholder="${b.sens === '+' ? 'Vente Vinted, salaire…' : 'Boulangerie, Lidl, Deliveroo…'}"></label>
      <div class="field"><label>Catégorie</label><div class="cats">${groupes.map(x => `<button type="button" class="chip ${b.groupe === x.id ? 'on' : ''}" data-finf="groupe:${x.id}">${esc(x.nom)}</button>`).join('')}</div></div>
      <div class="field"><label>Précision</label><div class="cats">${g.sous.map(([id, nom]) => `<button type="button" class="chip ${b.sous === id ? 'on' : ''}" data-finf="sous:${id}">${esc(nom)}</button>`).join('')}</div></div>
      <div class="deux"><label class="etiq">Date<input type="date" class="inp" id="finDate" value="${b.date}"></label>
        <label class="etiq">Compte<select class="inp" id="finCompte">${[['revolut', 'Revolut'], ['bnp', 'BNP Paribas'], ['especes', 'Espèces']].map(([v, n]) => `<option value="${v}" ${b.compte === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      ${b.sens === '-' ? `<label class="fin-coche"><input type="checkbox" id="finBetise" ${b.betise === true ? 'checked' : ''}> C'est une bêtise (j'aurais pu l'éviter)</label>` : ''}
      <label class="etiq">Note (facultatif)<input class="inp" id="finNote" value="${esc(b.note || '')}"></label>
      ${b._id && b.source !== 'manuel' ? `<p class="note">Libellé de la banque : ${esc(b.libBanque || b.lib)}. Si tu changes la catégorie, Élan retiendra la règle pour « ${esc(cleMarchand(b.lib))} ».</p>` : !b._id ? `<p class="note">Au prochain relevé, Élan la retrouvera et ne la comptera pas deux fois.</p>` : ''}
    </div>
    <div class="modal-f">${b._id ? `<button type="button" class="btn ghost danger" data-finf="supprimer">${I.trash}Supprimer</button>` : ''}<span class="pousse"></span>
      <button type="button" class="btn ghost" data-finf="annuler">Annuler</button><button class="btn primary">${b._id ? 'Enregistrer' : 'Ajouter'}</button></div></form>`;
  const lib = $('#finLib');
  lib.addEventListener('input', () => {
    b.lib = lib.value;
    if(!b.choisi && !b._id && b.lib.length > 2){
      const c = classer({ lib: b.lib, montant: b.sens === '-' ? -1 : 1 }, F().reglages, F().regles);
      if(!c.verif && (c.groupe !== b.groupe || c.sous !== b.sous) && (b.sens === '+') === (c.groupe === 'entrees')){ b.groupe = c.groupe; b.sous = c.sous; garder(); dessinerOperation(); const l = $('#finLib'); l.focus(); l.setSelectionRange(l.value.length, l.value.length); }
    }
  });
  $('#finMontant').addEventListener('input', e => { b.saisie = e.target.value; });
}
function garder(){
  const b = brouillon; if(!b) return;
  const v = id => { const e = $('#' + id); return e ? e.value : undefined; };
  if(v('finMontant') !== undefined) b.saisie = v('finMontant');
  if(v('finLib') !== undefined) b.lib = v('finLib');
  if(v('finDate')) b.date = v('finDate');
  if(v('finCompte')) b.compte = v('finCompte');
  if(v('finNote') !== undefined) b.note = v('finNote');
  const bt = $('#finBetise'); if(bt) b.betise = bt.checked ? true : (b.betise === true ? false : b.betise);
}
const fermer = () => { $('#modal').classList.remove('show'); brouillon = null; };

document.addEventListener('submit', ev => {
  if(ev.target.id === 'finRegleForm'){
    ev.preventDefault(); const t = $('#finRegle').value.trim(); if(!t) return;
    F().reglesPlan.push(t); save(); render(); setTimeout(() => $('#finRegle') && $('#finRegle').focus(), 30); return;
  }
  if(ev.target.id === 'finPocheForm'){
    ev.preventDefault(); const n = montantInput($('#finPocheMontant').value); if(!Number.isFinite(n)) return;
    F().poches[ev.target.dataset.poche] = n; save(); fermer(); render(); toast('Poche mise à jour'); return;
  }
  if(ev.target.id === 'finCodeForm'){ ev.preventDefault(); verifierCode(); return; }
  if(ev.target.id !== 'finOpForm') return;
  ev.preventDefault(); garder();
  const b = brouillon, f = F(), n = montantInput(b.saisie);
  if(!Number.isFinite(n) || n === 0){ $('#finMontant').focus(); toast('Indique un montant'); return; }
  const montant = b.sens === '-' ? -Math.abs(n) : Math.abs(n);
  const lib = (b.lib || '').trim() || nomSous(b.groupe, b.sous);
  if(b._id){
    const o = f.ops.find(x => x.id === b._id); if(!o) return fermer();
    const change = o.groupe !== b.groupe || o.sous !== b.sous;
    Object.assign(o, { lib, montant, date: b.date, compte: b.compte, groupe: b.groupe, sous: b.sous, note: b.note, betise: b.sens === '-' ? b.betise : null, verif: false });
    if(o.betise != null) o.aTrier = false;
    if(change && o.source !== 'manuel'){
      const motif = cleMarchand(o.libBanque || o.lib);
      if(motif && motif.length > 2){
        f.regles = f.regles.filter(r => r.motif !== motif); f.regles.unshift({ motif, groupe: b.groupe, sous: b.sous });
        let n2 = 0; for(const x of f.ops) if(x.id !== o.id && x.source !== 'manuel' && cleMarchand(x.lib) === motif && (x.groupe !== b.groupe || x.sous !== b.sous)){ x.groupe = b.groupe; x.sous = b.sous; x.verif = false; n2++; }
        toast(n2 ? `Règle retenue · ${n2} autre${n2 > 1 ? 's' : ''} opération${n2 > 1 ? 's' : ''} reclassée${n2 > 1 ? 's' : ''}` : 'Règle retenue pour la suite');
      }
    } else toast('Opération modifiée');
  } else {
    f.ops.push({ id: uid(), date: b.date, lib, montant, compte: b.compte, source: 'manuel', groupe: b.groupe, sous: b.sous, betise: b.sens === '-' ? (b.betise === true ? true : null) : null, verif: false, note: b.note });
    f.ops.sort((a, c) => c.date.localeCompare(a.date));
    if(b.compte !== 'especes' && f.soldes[b.compte]) { /* le solde réel arrivera avec le prochain relevé */ }
    toast(`${b.sens === '-' ? 'Dépense' : 'Gain'} ajouté${b.sens === '-' ? 'e' : ''} : ${eurS(montant)}`);
    alerte80(b.groupe);
  }
  save(); fermer(); render();
});
function alerte80(g){
  const f = F(); if(!f.reglages.alerte80 || !BUDGETS.includes(g) || g === 'durables') return;
  const e = C.enveloppes(f, C.cleMois(auj()), auj()).find(x => x.id === g);
  if(e && e.budget > 0 && e.depense >= e.budget * 0.8) setTimeout(() => toast(`${groupe(g).nom} : ${Math.round(e.depense / e.budget * 100)} % de l'enveloppe du mois`), 2600);
}

/* ---------- lignes privées ---------- */
function basculerPrive(){
  if(ui.prive){ ui.prive = false; render(); return; }
  const f = F();
  if(f.reglages.privesProteges && S.lock && window.desktop && window.desktop.verifierCode){
    $('#modalBox').innerHTML = `<form id="finCodeForm" autocomplete="off"><div class="modal-h"><div class="eyebrow">Lignes privées</div><h3>Ton code</h3><p>Le même que celui de ton onglet privé.</p></div>
      <div class="modal-b"><input type="password" class="inp code" id="finCode" placeholder="Code" aria-label="Code"><p class="note" id="finCodeMsg" role="alert"></p></div>
      <div class="modal-f"><button type="button" class="btn ghost" data-finf="annuler">Annuler</button><button class="btn primary">Afficher</button></div></form>`;
    $('#modal').classList.add('show'); setTimeout(() => $('#finCode') && $('#finCode').focus(), 60); return;
  }
  ui.prive = true; render();
}
async function verifierCode(){
  const ok = await window.desktop.verifierCode($('#finCode').value, S.lock).catch(() => false);
  if(ok){ ui.prive = true; fermer(); render(); }
  else { const m = $('#finCodeMsg'); if(m) m.textContent = 'Ce n’est pas le bon code.'; }
}

/* ---------- import de relevé ---------- */
async function importer(fichier){
  const f = F(), nom = fichier.name || 'relevé';
  try{
    let lu, compte;
    if(/\.pdf$/i.test(nom) || fichier.type === 'application/pdf'){
      if(!(window.desktop && window.desktop.lirePdf)) throw new Error("La lecture des PDF se fait dans l'application Élan pour Mac.");
      toast('Lecture du relevé…');
      const r = await window.desktop.lirePdf(await fichier.arrayBuffer());
      if(!r || !r.ok) throw new Error(r && r.erreur || 'PDF illisible');
      lu = lireBNP(r.lignes); compte = 'bnp';
    } else {
      lu = lireRevolut(await fichier.text()); compte = 'revolut';
    }
    if(!lu.ops.length) throw new Error('Aucune opération trouvée dans ce fichier.');
    if(window.desktop && window.desktop.archiver) window.desktop.archiver('avant-import-releve');
    const bilan = fusionner(f, lu.ops, { compte, uid, fenetre: f.reglages.fenetre || 3 });
    if(typeof lu.solde === 'number' && lu.edition && (!f.soldes[compte] || lu.edition >= f.soldes[compte].date)) f.soldes[compte] = { montant: lu.solde, date: lu.edition };
    f.imports.push(Object.assign({ date: ymd(auj()), fichier: nom, compte }, { lues: bilan.lues, nouvelles: bilan.nouvelles, fusionnees: bilan.fusionnees, doublons: bilan.doublons, aVerifier: bilan.aVerifier }));
    save(); render(); montrerBilan(bilan, nom);
  }catch(err){ toast(String(err && err.message || err)); }
}
function montrerBilan(b, nom){
  $('#modalBox').innerHTML = `<div class="modal-h"><div class="eyebrow">Relevé importé</div><h3>${esc(nom)}</h3><p>Tout est recalculé : budgets, bilans, graphique et paliers.</p></div>
    <div class="modal-b fin-imp" style="font-size:15px">
      <div><span>Opérations lues</span><b class="mt">${b.lues}</b></div>
      <div><span>Nouvelles, rangées toutes seules</span><b class="mt">${b.nouvelles}</b></div>
      <div><span>Déjà saisies par toi, fusionnées</span><b class="mt">${b.fusionnees}</b></div>
      <div><span>Déjà connues, ignorées</span><b class="mt">${b.doublons}</b></div>
      <div><span class="tiede">À vérifier</span><b class="mt tiede">${b.aVerifier}</b></div></div>
    <div class="modal-f">${b.aVerifier ? `<button class="btn" data-finf="voir-verif">Voir les ${b.aVerifier} à vérifier</button>` : ''}<button class="btn primary" data-finf="annuler">Parfait</button></div>`;
  $('#modal').classList.add('show');
}

/* ---------- branchements ---------- */
function brancher(){
  const q = $('#finCherche');
  if(q) q.addEventListener('input', () => { ui.recherche = q.value; ui.limite = 120; const pos = q.selectionStart; render(); const n = $('#finCherche'); if(n){ n.focus(); n.setSelectionRange(pos, pos); } });
  const mo = $('#finMoisOps'); if(mo) mo.addEventListener('change', () => { ui.moisOps = mo.value; ui.limite = 120; render(); });
  const fi = $('#finFichier'); if(fi) fi.addEventListener('change', () => { if(fi.files[0]) importer(fi.files[0]); fi.value = ''; });
  const d = $('#finDepot');
  if(d){
    d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('survol'); });
    d.addEventListener('dragleave', () => d.classList.remove('survol'));
    d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('survol'); const x = e.dataTransfer.files[0]; if(x) importer(x); });
  }
}
// Un relevé glissé n'importe où sur l'onglet est accepté aussi.
document.addEventListener('dragover', e => { if(app.onglet === 'finances' && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => { if(app.onglet !== 'finances' || e.target.closest('#finDepot')) return; const x = e.dataTransfer && e.dataTransfer.files[0]; if(x && /\.(pdf|csv)$/i.test(x.name)){ e.preventDefault(); importer(x); } });

app.clics.push(ev => {
  const ff = ev.target.closest('[data-finf]');
  if(ff){
    const [quoi, val] = ff.dataset.finf.split(':');
    if(quoi === 'annuler'){ fermer(); return true; }
    if(quoi === 'voir-verif'){ fermer(); ui.section = 'operations'; ui.filtre = 'verif'; ui.moisOps = 'tous'; render(); return true; }
    if(!brouillon) return true;
    garder();
    if(quoi === 'sens'){ brouillon.sens = val; if(val === '+' && groupe(brouillon.groupe).sens === '-'){ brouillon.groupe = 'entrees'; brouillon.sous = 'ventes'; } if(val === '-' && brouillon.groupe === 'entrees'){ brouillon.groupe = 'plaisirs'; brouillon.sous = 'snacks'; } dessinerOperation(); }
    else if(quoi === 'groupe'){ brouillon.groupe = val; brouillon.sous = groupe(val).sous[0][0]; brouillon.choisi = true; dessinerOperation(); }
    else if(quoi === 'sous'){ brouillon.sous = val; brouillon.choisi = true; dessinerOperation(); }
    else if(quoi === 'supprimer'){
      if(ff.dataset.confirm !== '1'){ ff.dataset.confirm = '1'; ff.lastChild.textContent = 'Confirmer la suppression'; return true; }
      const f = F(), i = f.ops.findIndex(x => x.id === brouillon._id), o = f.ops.splice(i, 1)[0];
      save(); fermer(); render(); toast('Opération supprimée', () => { f.ops.splice(i, 0, o); save(); render(); });
    }
    return true;
  }
  const a = ev.target.closest('[data-fin]'); if(!a) return false;
  const [quoi, val] = a.dataset.fin.split(/:(.*)/s);
  const f = F();
  if(quoi === 'section'){ ui.section = val; document.querySelector('#main').scrollTop = 0; render(); }
  else if(quoi === 'nouvelle') ouvrirOperation(null);
  else if(quoi === 'modifier') ouvrirOperation(f.ops.find(o => o.id === val));
  else if(quoi === 'betise'){
    const o = f.ops.find(x => x.id === val); if(!o) return true;
    o.betise = o.betise === true ? false : true; o.aTrier = false; save(); render();
  }
  else if(quoi === 'horizon'){ ui.horizon = +val; render(); }
  else if(quoi === 'filtre'){ ui.filtre = val; ui.limite = 120; render(); }
  else if(quoi === 'plus'){ ui.limite += 200; render(); }
  else if(quoi === 'prive') basculerPrive();
  else if(quoi === 'mois'){ ui.moisVu = val || null; render(); }
  else if(quoi === 'voir-mois'){ ui.moisVu = val; ui.section = 'mois'; render(); }
  else if(quoi === 'passe'){ ui.moisPasse = +val; render(); }
  else if(quoi === 'trier'){ ui.section = 'operations'; ui.filtre = 'atrier'; ui.moisOps = 'tous'; render(); }
  else if(quoi === 'regle-suppr'){ const i = +val, r = f.reglesPlan.splice(i, 1)[0]; save(); render(); toast('Règle supprimée', () => { f.reglesPlan.splice(i, 0, r); save(); render(); }); }
  else if(quoi === 'poche'){
    const noms = { lep: 'LEP', pea: 'PEA', trading: 'Poche Trading' };
    $('#modalBox').innerHTML = `<form id="finPocheForm" data-poche="${val}" autocomplete="off"><div class="modal-h"><div class="eyebrow">Mettre à jour</div><h3>${noms[val]}</h3><p>Le montant que tu vois aujourd'hui dans ton appli bancaire.</p></div>
      <div class="modal-b"><input class="inp" id="finPocheMontant" inputmode="decimal" value="${nf.format(f.poches[val] || 0)}" aria-label="Montant"></div>
      <div class="modal-f"><button type="button" class="btn ghost" data-finf="annuler">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`;
    $('#modal').classList.add('show'); setTimeout(() => { const i = $('#finPocheMontant'); if(i){ i.focus(); i.select(); } }, 60);
  }
  else return false;
  return true;
});

export function touche(e){
  if(e.key === 'n' || e.key === 'N'){ e.preventDefault(); ouvrirOperation(null); }
  else if(/^[1-4]$/.test(e.key)){ ui.section = ['ensemble', 'mois', 'operations', 'passe'][+e.key - 1]; render(); }
}

/* =========================================================
   Réglages › Mes finances
   ========================================================= */
const champ = (chemin, val, type = 'nombre', court = true, label = '') => `<input class="inp ${court ? 'court' : ''}" data-fset="${chemin}" data-type="${type}" value="${esc(type === 'liste' ? (val || []).join(', ') : type === 'nombre' ? String(val ?? '').replace('.', ',') : (val ?? ''))}" ${label ? `aria-label="${esc(label)}"` : ''} ${type === 'mois' ? 'type="month"' : ''}>`;
const inter = (chemin, on, label) => `<button class="sw acc ${on ? 'on' : ''}" data-fset-sw="${chemin}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}"></button>`;
const ligne = (txt, ctrl, note = '') => `<div class="set-line"><span>${txt}${note ? `<br><small class="doux">${note}</small>` : ''}</span>${ctrl}</div>`;
export function reglagesFinances(){
  const f = assurer(), R = f.reglages;
  return `<div class="set-fin">
  <section class="set-sec"><h4>Mes revenus attendus</h4>
    ${ligne('Salaire net', champ('reglages.salaire', R.salaire, 'nombre', true, 'Salaire net'), 'Sert au plan et aux projections')}
    ${ligne('Salaire à partir de', champ('reglages.salaireDes', R.salaireDes, 'mois', true, 'Salaire à partir de'))}
    ${ligne('CAF', champ('reglages.caf', R.caf, 'nombre', true, 'CAF'))}
    ${ligne('Le mois commence le', champ('reglages.debutMois', R.debutMois, 'nombre', true, 'Jour de début du mois'), '1 pour un mois civil, ou ton jour de paie')}
  </section>
  <section class="set-sec"><h4>Mes charges fixes</h4>
    ${R.fixes.map((x, i) => `<div class="liste-l"><input class="inp" data-fset="reglages.fixes.${i}.nom" data-type="texte" value="${esc(x.nom)}" aria-label="Nom"><input class="inp court" data-fset="reglages.fixes.${i}.montant" data-type="nombre" value="${String(x.montant).replace('.', ',')}" aria-label="Montant de ${esc(x.nom)}"><button class="icon-btn sm" data-fsetact="fixe-suppr:${i}" title="Retirer" aria-label="Retirer ${esc(x.nom)}">${I.close}</button></div>`).join('')}
    <div class="set-line"><b>Total</b><b class="tab">${eur(R.fixes.reduce((a, x) => a + (+x.montant || 0), 0), true)}</b></div>
    <button class="btn" data-fsetact="fixe-ajout">${I.plus}Ajouter une charge fixe</button>
  </section>
  <section class="set-sec"><h4>Mes enveloppes du mois</h4>
    ${ligne('Courses', champ('reglages.budgets.courses', R.budgets.courses))}
    ${ligne('Plaisirs', champ('reglages.budgets.plaisirs', R.budgets.plaisirs))}
    ${ligne('Plaisirs durables', champ('reglages.budgets.durables', R.budgets.durables), 'Linge, livres, high-tech, maison, sport')}
    ${ligne('Cagnotte pour les Plaisirs durables', inter('reglages.cagnotte', R.cagnotte !== false, 'Cagnotte'), "Ce qui n'est pas dépensé s'accumule pour un gros achat")}
    ${ligne('Imprévus', champ('reglages.budgets.imprevus', R.budgets.imprevus))}
    ${ligne('Jokers Deliveroo par mois', champ('reglages.jokers', R.jokers))}
    ${ligne('Prévenir quand une enveloppe atteint 80 %', inter('reglages.alerte80', R.alerte80, 'Alerte à 80 %'))}
  </section>
  <section class="set-sec"><h4>Mes bêtises</h4>
    ${ligne('Proposer des bêtises à trier', inter('reglages.proposerBetises', R.proposerBetises, 'Proposer des bêtises'), 'Snacks, Deliveroo et lignes privées des nouveaux relevés')}
    ${ligne('Objectif : bêtises maximum par mois', champ('reglages.objectifBetises', R.objectifBetises))}
  </section>
  <section class="set-sec"><h4>Catégories et règles de classement</h4>
    ${ligne('Mes noms (virements entre mes comptes)', champ('reglages.noms.moi', R.noms.moi, 'liste', false))}
    ${ligne('Mon frère', champ('reglages.noms.frere', R.noms.frere, 'liste', false))}
    ${ligne('Ma famille', champ('reglages.noms.famille', R.noms.famille, 'liste', false), 'Leurs virements comptent comme aide familiale')}
    ${ligne('Retraits rangés dans le privé (€)', champ('reglages.retraitsPrives', R.retraitsPrives, 'liste', false))}
    <h4 style="margin-top:16px">Règles apprises de mes corrections</h4>
    ${f.regles.length ? f.regles.map((r, i) => `<div class="set-line"><span>« ${esc(r.motif)} »</span><span class="ligne">${tag(`${groupe(r.groupe).nom} · ${nomSous(r.groupe, r.sous)}`)}<button class="icon-btn sm" data-fsetact="regle-suppr:${i}" title="Oublier cette règle" aria-label="Oublier la règle ${esc(r.motif)}">${I.close}</button></span></div>`).join('') : '<p class="set-note">Aucune pour le moment. Quand tu changes la catégorie d’une opération du relevé, Élan retient la règle.</p>'}
  </section>
  <section class="set-sec"><h4>Épargne et poches</h4>
    ${ligne("Virement auto vers l'épargne", champ('reglages.poches.virement', R.poches.virement), 'Le jour de paie, avant tout le reste')}
    ${ligne('Coussin de sécurité (LEP)', champ('reglages.poches.coussin', R.poches.coussin))}
    ${ligne('Taux du LEP (%)', champ('reglages.poches.tauxLEP', R.poches.tauxLEP))}
    ${ligne('Poche Trading (% des revenus)', champ('reglages.poches.partTrading', R.poches.partTrading), 'Seulement une fois le coussin plein')}
    ${ligne('Pause après ce nombre de challenges ratés', champ('reglages.poches.pauseApres', R.poches.pauseApres))}
    ${ligne('LEP aujourd’hui', champ('poches.lep', f.poches.lep))}
    ${ligne('PEA aujourd’hui', champ('poches.pea', f.poches.pea))}
    ${ligne('Poche Trading aujourd’hui', champ('poches.trading', f.poches.trading))}
  </section>
  <section class="set-sec"><h4>Projection et objectifs</h4>
    ${ligne('Mon rêve : revenus par mois', champ('reglages.projection.reve', R.projection.reve))}
    ${ligne('Rendement du PEA (% par an, hypothèse)', champ('reglages.projection.rendementPEA', R.projection.rendementPEA))}
    ${ligne('Inflation (%)', champ('reglages.projection.inflation', R.projection.inflation))}
    ${ligne('Hausse de salaire par an (%)', champ('reglages.projection.hausseSalaire', R.projection.hausseSalaire))}
    ${ligne('Impôts et cotisations sur le business (%)', champ('reglages.projection.impotsBusiness', R.projection.impotsBusiness))}
    ${ligne('Part dépensée de mes revenus business (%)', champ('reglages.projection.partDepensee', R.projection.partDepensee))}
    <h4 style="margin-top:16px">Mes paliers</h4>
    ${f.paliers.map((p, i) => `<div class="liste-l"><input class="inp" data-fset="paliers.${i}.nom" data-type="texte" value="${esc(p.nom)}" aria-label="Nom du palier"><input class="inp court" data-fset="paliers.${i}.revenu" data-type="nombre" value="${p.revenu}" aria-label="Revenu visé" title="Revenu mensuel visé (0 si ce n'est pas un palier de revenu)"><input class="inp court" type="month" data-fset="paliers.${i}.vise" data-type="mois" value="${p.vise || ''}" aria-label="Date visée" style="max-width:150px"><button class="icon-btn sm" data-fsetact="palier-suppr:${i}" title="Retirer" aria-label="Retirer le palier">${I.close}</button></div>`).join('')}
    <button class="btn" data-fsetact="palier-ajout">${I.plus}Ajouter un palier</button>
  </section>
  <section class="set-sec"><h4>Comptes, import et confidentialité</h4>
    ${Object.entries(f.soldes).map(([c, s]) => ligne(`Solde ${c === 'bnp' ? 'BNP Paribas' : c === 'revolut' ? 'Revolut' : c}`, champ(`soldes.${c}.montant`, s.montant), `au ${s.date.split('-').reverse().join('/')} · mis à jour à chaque relevé`)).join('')}
    ${f.soldes.revolut ? '' : ligne('Solde Revolut', `<button class="btn" data-fsetact="revolut">Ajouter</button>`, 'Ou importe un CSV Revolut dans Opérations')}
    ${ligne('Rapprocher mes saisies et le relevé à ± (jours)', champ('reglages.fenetre', R.fenetre))}
    ${ligne('Lignes privées protégées par mon code', inter('reglages.privesProteges', R.privesProteges, 'Protéger les lignes privées'), S.lock ? 'Le même que l’onglet privé' : 'Définis d’abord le code de l’onglet privé')}
    ${ligne('Mode discret : flouter les montants', inter('reglages.discret', R.discret, 'Mode discret'), 'Un survol les affiche')}
    ${ligne('Exporter mes opérations', `<button class="btn" data-fsetact="csv">CSV</button>`)}
    ${ligne('Synchroniser avec mon iPhone', `<button class="btn" data-fsetact="synchro">Ouvrir</button>`, 'Réglages › Synchro iPhone')}
  </section></div>`;
}
const chemin = c => { const p = c.split('.'); let o = S.finances; for(const k of p.slice(0, -1)) o = o[k]; return [o, p[p.length - 1]]; };
document.addEventListener('change', e => {
  const el = e.target.closest && e.target.closest('[data-fset]'); if(!el) return;
  const [o, cle] = chemin(el.dataset.fset), t = el.dataset.type;
  let v = el.value;
  if(t === 'nombre'){ v = montantInput(v); if(!Number.isFinite(v)){ toast('Nombre invalide'); return; } }
  else if(t === 'liste') v = v.split(',').map(x => x.trim()).filter(Boolean).map(x => el.dataset.fset === 'reglages.retraitsPrives' ? montantInput(x) : x.toLowerCase()).filter(x => x === x);
  else v = v.trim();
  o[cle] = v; save(); toast('Réglage enregistré');
});
app.clics.push(e => {
  const s = e.target.closest('[data-fset-sw]');
  if(s){ const [o, cle] = chemin(s.dataset.fsetSw); o[cle] = !o[cle]; save(); render(); return true; }
  const a = e.target.closest('[data-fsetact]'); if(!a) return false;
  const [quoi, val] = a.dataset.fsetact.split(':'), f = F();
  if(quoi === 'fixe-ajout') f.reglages.fixes.push({ id: uid(), nom: 'Nouvelle charge', montant: 0 });
  else if(quoi === 'fixe-suppr') f.reglages.fixes.splice(+val, 1);
  else if(quoi === 'palier-ajout') f.paliers.push({ id: uid(), type: 'revenu', nom: 'Nouveau palier', revenu: 0, vise: C.moisSuivant(C.cleMois(auj()), 12) });
  else if(quoi === 'palier-suppr') f.paliers.splice(+val, 1);
  else if(quoi === 'regle-suppr') f.regles.splice(+val, 1);
  else if(quoi === 'synchro'){ const g = document.querySelector('[data-groupe="synchro"]') || [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Synchro iPhone'); if(g) g.click(); return true; }
  else if(quoi === 'revolut') f.soldes.revolut = { montant: 0, date: ymd(auj()) };
  else if(quoi === 'csv'){
    const lignes = [['date', 'libellé', 'montant', 'catégorie', 'précision', 'compte', 'source', 'bêtise', 'note']].concat(f.ops.map(o => [o.date, o.lib, String(o.montant).replace('.', ','), groupe(o.groupe).nom, nomSous(o.groupe, o.sous), o.compte, o.source, o.betise === true ? 'oui' : '', o.note || '']));
    const csv = '﻿' + lignes.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const lien = document.createElement('a'); lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); lien.download = `elan-operations-${ymd(auj())}.csv`; lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 5000); return true;
  }
  else return false;
  save(); render(); return true;
});
