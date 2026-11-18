// Point de rencontre entre les modules : évite les dépendances croisées.
export const app = {
  rendre: () => {},          // redessine la barre latérale et l'onglet courant
  aller: (_id, _params) => {}, // change d'onglet
  horizon: () => {},         // remonte la destination d'arrière-plan (après un changement de réglage)
  clics: [],                 // gestionnaires de clic globaux ; le premier qui renvoie true gagne
  onglet: 'accueil',
  params: null,
};
