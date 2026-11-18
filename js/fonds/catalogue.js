// Bibliothèque unique des fonds, partagée par le calendrier et le Pomodoro.
// mois : mois d'apparition dans le calendrier (1 = janvier). Le Pomodoro tire dans toute la liste.
// Les illustrations sont chargées à la demande, jamais toutes en mémoire.
// Ajouter un fond = écrire son illustration dans outils/fonds/, puis ajouter une ligne ici.
const f = (id, nom, mois) => ({ id, nom, mois, charge: () => import(`./${id}.js`) });
export const CATALOGUE = [
  // d'après les photos de référence
  f('paris', 'Paris', [4, 5, 6, 9]),
  f('londres', 'Londres', [4, 5, 9, 10]),
  f('cracovie', 'Cracovie', [11, 12, 1, 2]),
  f('aurore', 'Aurore boréale', [12, 1, 2]),
  f('paris-tour-eiffel', 'Paris, la tour Eiffel la nuit', [6, 7, 8]),
  f('paris-louvre', 'Paris, la pyramide du Louvre', [3, 10, 11]),
  f('moscou', 'Moscou', [5, 6, 7, 8]),
  f('pagani-noire', 'Pagani Huayra, crépuscule', [6, 7, 8, 9]),
  f('cracovie-sainte-marie', 'Cracovie, la basilique Sainte-Marie', [3, 4, 10]),
  f('cracovie-hotel-de-ville', "Cracovie, la tour de l'Hôtel de ville", [5, 6, 7, 8, 9]),
  f('lac-moraine', 'Lac Moraine', [7, 8, 9]),
  f('pagani-rouge', 'Pagani Huayra Roadster, grand ciel bleu', [11, 3, 4]),
  // d'après les descriptions
  f('dubai', 'Dubaï', [11, 12, 1, 2, 3]),
  f('los-angeles', 'Los Angeles', [5, 6, 7, 8, 9]),
  f('tokyo', 'Tokyo', [3, 4, 5]),
  f('lyon', 'Lyon', [9, 10, 11]),
  f('papeete', 'Papeete', [5, 6, 7, 8, 9, 10]),
  f('sydney', 'Sydney', [12, 1, 2, 3]),
  f('new-york', 'New York', [9, 10, 11, 12]),
  f('san-francisco', 'Baie de San Francisco', [6, 7, 8, 9, 10]),
  f('hong-kong', 'Hong Kong', [10, 11, 12]),
  f('zurich', 'Zurich', [10, 11, 12]),
  f('monaco', 'Monaco', [4, 5, 6, 9, 10]),
  f('gstaad', 'Gstaad', [12, 1, 2, 3]),
  f('courchevel', 'Courchevel 1850', [12, 1, 2, 3]),
  f('aspen', 'Aspen', [12, 1, 2, 3]),
  f('lac-de-come', 'Lac de Côme', [5, 6, 7, 8, 9]),
  f('hamptons', 'Les Hamptons', [6, 7, 8, 9]),
];
