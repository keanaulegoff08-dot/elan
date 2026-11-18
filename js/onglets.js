// Registre des onglets. Ajouter, retirer ou réordonner un onglet = modifier cette liste, rien d'autre.
//   id      : identifiant interne
//   nom     : libellé de la barre latérale
//   icone   : clé de noyau/icones.js
//   module  : { rendre(vue), rafraichir?(), touche?(e), entrer?(params), quitter?() }
//   large   : la page utilise toute la largeur
//   floute  : le libellé est flouté dans la barre latérale
//   minical : affiche le mois compact sous le libellé
//   marque  : page d'accueil (le logo de la barre y ramène aussi)
//   bas     : rangé en bas de la barre, sous la carte de cap
import * as accueil from './onglets/accueil.js';
import * as reves from './onglets/reves.js';
import * as finances from './onglets/finances.js';
import * as taches from './onglets/taches.js';
import * as engagements from './onglets/engagements.js';
import * as bilans from './onglets/bilans.js';
import * as addictions from './onglets/addictions.js';
import * as calendrier from './onglets/calendrier.js';
import * as reglages from './onglets/reglages.js';

export const ONGLETS = [
  { id:'accueil',    nom:'Accueil',            icone:'elan',   module: accueil, marque:true, moyen:true },
  { id:'reves',      nom:'Mes rêves',          icone:'reve',   module: reves, moyen:true },
  { id:'finances',   nom:'Mes finances',       icone:'finances', module: finances, moyen:true },
  { id:'taches',     nom:'Mes tâches',         icone:'taches', module: taches },
  { id:'engagements', nom:'Mes engagements', icone:'engagement', module: engagements, moyen:true },
  { id:'bilans',     nom:'Bilans journaliers', icone:'bilan',  module: bilans, moyen:true },
  { id:'addictions', nom:'Addictions',         icone:'verrou', module: addictions, floute:true, moyen:true },
  { id:'calendrier', nom:'Calendrier',         icone:'month',  module: calendrier, large:true, minical:true },
  { id:'reglages',   nom:'Réglages',           icone:'gear',   module: reglages, bas:true },
];
