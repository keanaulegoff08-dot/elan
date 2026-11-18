// Tous les calculs de « Mes finances » : bilans du mois, enveloppes, soldes passés, projection sur 30 ans, paliers.
// Fonctions pures sur l'objet F (S.finances) : testées hors de l'application.
import { NEUTRES, BUDGETS } from './taxonomie.js';

const pad = n => String(n).padStart(2, '0');
export const cleMois = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const moisSuivant = (m, n = 1) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return cleMois(d); };
export const joursDansMois = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
export const arrondi = n => Math.round(n * 100) / 100;

// Période budgétaire d'une date : le mois commence le jour choisi dans les réglages (1 par défaut, ou le jour de paie).
export function periode(date, debut = 1){
  const [y, m, d] = date.split('-').map(Number);
  if(debut <= 1 || d >= debut) return `${y}-${pad(m)}`;
  return moisSuivant(`${y}-${pad(m)}`, -1);
}
const compte = o => !NEUTRES.has(o.groupe);

export function opsDuMois(F, mois){
  const debut = F.reglages.debutMois || 1;
  return F.ops.filter(o => periode(o.date, debut) === mois);
}

// Bilan d'un mois : entrées, sorties, épargne, enveloppes, bêtises.
export function bilanMois(F, mois){
  const ops = opsDuMois(F, mois).filter(compte);
  const b = { mois, entrees: 0, famille: 0, sorties: 0, epargne: 0, groupes: {}, sous: {}, betises: 0, aTrier: 0, nb: ops.length };
  for(const o of ops){
    const k = o.groupe, ks = o.groupe + ':' + o.sous;
    b.groupes[k] = (b.groupes[k] || 0) + o.montant;
    b.sous[ks] = (b.sous[ks] || 0) + o.montant;
    if(o.groupe === 'epargne'){ b.epargne -= o.montant; continue; }
    if(o.groupe === 'entrees'){ b.entrees += o.montant; if(o.sous === 'famille') b.famille += o.montant; }
    else if(o.montant > 0) b.sorties += o.montant; // remboursements : diminuent les sorties
    else b.sorties += o.montant;
    if(o.betise === true) b.betises += o.montant;
    if(o.aTrier && o.betise == null) b.aTrier += o.montant;
  }
  b.sorties = -b.sorties; b.betises = -b.betises; b.aTrier = -b.aTrier;
  b.solde = b.entrees - b.sorties;
  b.soldeSansFamille = b.solde - b.famille;
  for(const k of Object.keys(b.groupes)) b.groupes[k] = arrondi(b.groupes[k]);
  return b;
}
export const depenseGroupe = (b, g) => Math.max(0, -(b.groupes[g] || 0));

export function moisConnus(F){
  const debut = F.reglages.debutMois || 1;
  return [...new Set(F.ops.map(o => periode(o.date, debut)))].sort();
}

// Enveloppes du mois en cours : dépensé, budget, rythme de fin de mois. La cagnotte des Plaisirs durables cumule ce qui reste.
export function enveloppes(F, mois, aujourdhui){
  const b = bilanMois(F, mois), R = F.reglages.budgets;
  const nbJ = joursDansMois(mois), jour = Math.min(nbJ, Math.max(1, aujourdhui.getDate()));
  const enCours = cleMois(aujourdhui) === mois;
  return BUDGETS.map(g => {
    const depense = depenseGroupe(b, g);
    let budget = R[g] || 0;
    if(g === 'durables' && F.reglages.cagnotte !== false){
      // Cagnotte : budget mensuel cumulé depuis le premier mois suivi, moins tout ce qui a été dépensé avant ce mois.
      const tous = moisConnus(F).filter(m => m >= (F.reglages.cagnotteDepuis || mois) && m < mois);
      budget = budget + tous.reduce((a, m) => a + (R[g] || 0) - depenseGroupe(bilanMois(F, m), g), 0);
    }
    const rythme = enCours ? depense / jour * nbJ : depense;
    return { id: g, depense, budget, reste: budget - depense, rythme, pct: budget > 0 ? Math.min(1, depense / budget) : (depense > 0 ? 1 : 0) };
  });
}

// Moyenne d'une valeur sur les n mois complets avant « mois ».
export function moyenne(F, mois, n, f){
  const liste = moisConnus(F).filter(m => m < mois).slice(-n);
  if(!liste.length) return 0;
  return liste.reduce((a, m) => a + f(bilanMois(F, m)), 0) / liste.length;
}

// Solde des comptes à la fin de chaque mois, reconstruit à rebours depuis le dernier solde connu de chaque compte.
export function soldesPasses(F){
  const mois = moisConnus(F), res = {};
  for(const m of mois) res[m] = 0;
  for(const [compte, s] of Object.entries(F.soldes || {})){
    if(!s || typeof s.montant !== 'number') continue;
    for(const m of mois){
      const fin = `${m}-31`;
      const apres = F.ops.filter(o => (o.compte || 'bnp') === compte && o.date > fin && o.date <= s.date).reduce((a, o) => a + o.montant, 0);
      if(fin < s.date || m === s.date.slice(0, 7)) res[m] += s.montant - apres;
    }
  }
  return mois.map(m => ({ mois: m, solde: arrondi(res[m]) }));
}

export const totalPoches = F => (F.poches.lep || 0) + (F.poches.pea || 0) + (F.poches.trading || 0);
export function patrimoine(F){
  const comptes = Object.values(F.soldes || {}).reduce((a, s) => a + (s && s.montant || 0), 0);
  return arrondi(comptes + totalPoches(F));
}

// Projection mois par mois, sur « annees » ans. Trois scénarios :
//   avant : mes dépenses moyennes des 12 derniers mois ; plan : mes budgets ; cible : mes paliers de revenus atteints.
export function projection(F, scenario, aujourdhui, annees = 30){
  const R = F.reglages, P = R.projection;
  const depart = cleMois(aujourdhui), fin = moisSuivant(depart, annees * 12);
  const fixes = R.fixes.reduce((a, f) => a + (+f.montant || 0), 0);
  const budgetPlan = fixes + BUDGETS.reduce((a, g) => a + (R.budgets[g] || 0), 0);
  const moyenneAvant = moyenne(F, depart, 12, b => b.sorties);
  let lep = F.poches.lep || 0, pea = (F.poches.pea || 0) + (F.poches.trading || 0), dette = 0;
  let comptes = Object.values(F.soldes || {}).reduce((a, s) => a + (s && s.montant || 0), 0);
  const points = [];
  const salaireDes = R.salaireDes || depart;
  for(let m = moisSuivant(depart), i = 1; m <= fin; m = moisSuivant(m), i++){
    const t = i / 12, an = +m.slice(0, 4);
    const salaire = m >= salaireDes ? R.salaire * Math.pow(1 + P.hausseSalaire / 100, t) : 0;
    let revenu = salaire + R.caf, depenses;
    if(scenario === 'avant') depenses = moyenneAvant * Math.pow(1 + P.inflation / 100, t);
    else depenses = budgetPlan * Math.pow(1 + P.inflation / 100, t);
    if(scenario === 'cible'){
      const cible = cibleRevenu(F, m);
      const business = Math.max(0, cible - revenu);
      const impots = business * (P.impotsBusiness / 100);
      revenu += business;
      depenses = Math.max(depenses, (revenu - impots) * (P.partDepensee / 100)) + impots;
    }
    lep *= 1 + R.poches.tauxLEP / 100 / 12; pea *= 1 + P.rendementPEA / 100 / 12;
    let net = revenu - depenses;
    if(net < 0){
      const pris = Math.min(Math.max(0, comptes), -net); comptes -= pris; net += pris;
      if(net < 0){ const l = Math.min(lep, -net); lep -= l; net += l; }
      if(net < 0) dette += -net;
    } else {
      const coussin = Math.min(R.poches.coussin * Math.pow(1 + P.inflation / 100, t), 10000);
      const versLep = Math.min(net, Math.max(0, coussin - lep)); lep += versLep; pea += net - versLep;
    }
    points.push({ mois: m, an, revenu: Math.round(revenu), depenses: Math.round(depenses), patrimoine: Math.round(comptes + lep + pea - dette), lep: Math.round(lep), aide: Math.round(dette) });
  }
  return points;
}

// Revenu mensuel visé à un mois donné, d'après les paliers (interpolation en escalier).
export function cibleRevenu(F, mois){
  const pal = F.paliers.filter(p => p.revenu > 0 && p.vise).sort((a, b) => a.vise.localeCompare(b.vise));
  let r = 0;
  for(const p of pal) if(mois >= p.vise) r = p.revenu;
  const dernier = pal[pal.length - 1];
  if(dernier && mois > dernier.vise){
    const ans = (Date.parse(mois + '-01') - Date.parse(dernier.vise + '-01')) / (365.25 * 864e5);
    r = dernier.revenu * Math.pow(1.03, Math.max(0, ans));
  }
  return r;
}

// Palier 0 : nombre de mois complets d'affilée (les plus récents) avec un solde positif sans la famille.
export function moisPositifsDAffilee(F, aujourdhui){
  const enCours = cleMois(aujourdhui);
  const liste = moisConnus(F).filter(m => m < enCours).reverse();
  let n = 0;
  for(const m of liste){ if(bilanMois(F, m).soldeSansFamille >= 0) n++; else break; }
  return n;
}

// Date estimée où le plan atteint un montant de LEP (coussin) : premier mois de la projection « plan ».
export function dateCoussin(F, aujourdhui){
  if((F.poches.lep || 0) >= F.reglages.poches.coussin) return 'atteint';
  const p = projection(F, 'plan', aujourdhui, 5).find(x => x.lep >= F.reglages.poches.coussin);
  return p ? p.mois : null;
}
