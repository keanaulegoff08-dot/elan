// Valeurs de départ de « Mes finances » (modifiables dans Réglages › Mes finances).
const id = () => Math.random().toString(36).slice(2, 10);

export function financesParDefaut(){
  return {
    ops: [],          // { id, date, lib, montant, compte, source: 'bnp'|'revolut'|'manuel', groupe, sous, verif, betise, aTrier, rapproche, note }
    regles: [],       // apprises de mes corrections : { motif, groupe, sous }
    soldes: {},       // dernier solde connu par compte : { bnp: { montant, date } }
    poches: { lep: 0, pea: 0, trading: 0 },
    imports: [],      // { date, fichier, compte, lues, nouvelles, fusionnees, doublons, aVerifier }
    historique: false,
    reglesPlan: ['Épargne auto le jour de paie', 'Une carte Revolut à 200 € par mois pour le Plaisir', '2 jokers Deliveroo par mois'],
    paliers: [
      { id: id(), type: 'stabiliser', nom: 'Stabiliser', detail: '3 mois positifs sans la famille', revenu: 0, vise: '2027-02' },
      { id: id(), type: 'coussin', nom: 'Coussin', detail: 'LEP à 3 500 €', revenu: 0, vise: '2027-08' },
      { id: id(), type: 'revenu', nom: '3 000 € par mois', detail: 'Premier revenu en plus', revenu: 3000, vise: '2028-01' },
      { id: id(), type: 'revenu', nom: '5 000 € par mois', detail: 'Décollage', revenu: 5000, vise: '2030-01' },
      { id: id(), type: 'revenu', nom: '10 000 € par mois', detail: 'Liberté partielle', revenu: 10000, vise: '2031-01' },
      { id: id(), type: 'revenu', nom: '30 000 € par mois', detail: 'Le rêve', revenu: 30000, vise: '2035-01' },
    ],
    reglages: {
      salaire: 1420, salaireDes: '2027-01', caf: 203, compterFamille: false, debutMois: 1,
      fixes: [
        { id: id(), nom: 'Loyer', montant: 499.7 }, { id: id(), nom: 'TCL', montant: 26 }, { id: id(), nom: 'On Air', montant: 31.96 },
        { id: id(), nom: 'Claude', montant: 21.6 }, { id: id(), nom: 'Sosh', montant: 15.99 }, { id: id(), nom: 'Amazon', montant: 23.98 },
      ],
      budgets: { courses: 275, plaisirs: 200, durables: 50, imprevus: 70 },
      cagnotte: true, cagnotteDepuis: '2026-11', jokers: 2, alerte80: true,
      proposerBetises: true, bilanBetises: true, objectifBetises: 100,
      noms: { moi: [], frere: [], famille: [], comptes: [] },
      retraitsPrives: [20, 30, 40],
      poches: { virement: 400, coussin: 3500, tauxLEP: 2.5, partTrading: 10, pauseApres: 3 },
      projection: { reve: 30000, rendementPEA: 7, inflation: 2, hausseSalaire: 2, impotsBusiness: 25, partDepensee: 50 },
      fenetre: 3, privesProteges: true, discret: false,
    },
  };
}
