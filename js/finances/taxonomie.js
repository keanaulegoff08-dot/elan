// Catégories de « Mes finances ». Un groupe = un budget ou un type de mouvement ; chaque groupe a ses sous-catégories.
// Les couleurs restent sobres : seules les enveloppes du mois ont une teinte.
export const GROUPES = [
  { id:'entrees',  nom:'Entrées',            sens:'+', teinte:'accent', sous:[['salaire','Salaire'],['caf','CAF'],['aides','Aides publiques'],['famille','Famille'],['ventes','Ventes (Vinted…)'],['business','Revenus business'],['autres','Autres entrées']] },
  { id:'fixes',    nom:'Charges fixes',      sens:'-', teinte:'ink',    sous:[['loyer','Loyer'],['transport','Transport'],['sport','Salle de sport'],['abonnements','Abonnements'],['telephone','Téléphone'],['banque','Frais bancaires'],['assurance','Assurance']] },
  { id:'courses',  nom:'Courses',            sens:'-', teinte:'accent', budget:true, sous:[['courses','Courses']] },
  { id:'plaisirs', nom:'Plaisirs',           sens:'-', teinte:'aube',   budget:true, sous:[['snacks','Snacks, boulangeries, restos'],['deliveroo','Deliveroo'],['sorties','Sorties'],['tabac','Tabac'],['weed','Weed',true],['adultes','Sites adultes',true],['autres','Autres plaisirs']] },
  { id:'durables', nom:'Plaisirs durables',  sens:'-', teinte:'vert',   budget:true, sous:[['vetements','Vêtements'],['hightech','High-tech'],['maison','Maison'],['livres','Livres'],['sport','Sport'],['autres','Autres']] },
  { id:'imprevus', nom:'Imprévus',           sens:'-', teinte:'warm',   budget:true, sous:[['achats','Achats'],['amis','Entre amis'],['dons','Dons'],['sante','Santé'],['admin','Administratif'],['divers','Divers']] },
  { id:'business', nom:'Business',           sens:'-', teinte:'lav',    sous:[['outils','Outils']] },
  { id:'trading',  nom:'Trading',            sens:'-', teinte:'lav',    sous:[['crypto','Crypto'],['challenges','Challenges']] },
  { id:'etudes',   nom:'Études',             sens:'-', teinte:'ink',    sous:[['scolarite','Scolarité']] },
  { id:'proches',  nom:'Proches',            sens:'±', teinte:'ink',    sous:[['frere','Frère'],['autres','Autres proches']] },
  { id:'epargne',  nom:'Vers mon épargne',   sens:'-', teinte:'accent', sous:[['lep','LEP'],['pea','PEA'],['trading','Poche Trading']] },
  { id:'interne',  nom:'Entre mes comptes',  sens:'±', teinte:'ink',    sous:[['transfert','Transfert']] },
];
export const groupe = id => GROUPES.find(g => g.id === id) || GROUPES.find(g => g.id === 'imprevus');
export const nomSous = (g, s) => { const x = groupe(g).sous.find(v => v[0] === s); return x ? x[1] : s; };
export const estPrive = (g, s) => { const x = groupe(g).sous.find(v => v[0] === s); return !!(x && x[2]); };
// Mouvements qui ne sont ni des revenus ni des dépenses : ils ne comptent dans aucun total.
export const NEUTRES = new Set(['interne']);
// Groupes dont l'argent ne quitte pas vraiment mon patrimoine.
export const VERS_EPARGNE = new Set(['epargne']);
export const BUDGETS = ['courses', 'plaisirs', 'durables', 'imprevus'];
