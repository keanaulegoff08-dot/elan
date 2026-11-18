// Où se trouve chaque destination de la bibliothèque : lieu, coordonnées, fuseau horaire.
// Sert à la carte de cap (barre latérale) et à la vue Année du calendrier.
const L = (lieu, lat, lon, tz) => ({ lieu, lat, lon, tz });
export const LIEUX = {
  'paris':                   L('Paris, France', 48.857, 2.352, 'Europe/Paris'),
  'paris-tour-eiffel':       L('Paris, France', 48.858, 2.294, 'Europe/Paris'),
  'paris-louvre':            L('Paris, France', 48.861, 2.336, 'Europe/Paris'),
  'londres':                 L('Londres, Royaume-Uni', 51.507, -0.128, 'Europe/London'),
  'cracovie':                L('Cracovie, Pologne', 50.062, 19.938, 'Europe/Warsaw'),
  'cracovie-sainte-marie':   L('Cracovie, Pologne', 50.062, 19.939, 'Europe/Warsaw'),
  'cracovie-hotel-de-ville': L('Cracovie, Pologne', 50.061, 19.936, 'Europe/Warsaw'),
  'aurore':                  L('Tromsø, Norvège', 69.649, 18.955, 'Europe/Oslo'),
  'moscou':                  L('Moscou, Russie', 55.752, 37.617, 'Europe/Moscow'),
  'pagani-noire':            L('San Cesario sul Panaro, Italie', 44.563, 11.035, 'Europe/Rome'),
  'pagani-rouge':            L('San Cesario sul Panaro, Italie', 44.563, 11.035, 'Europe/Rome'),
  'lac-moraine':             L('Alberta, Canada', 51.322, -116.186, 'America/Edmonton'),
  'dubai':                   L('Dubaï, Émirats arabes unis', 25.204, 55.271, 'Asia/Dubai'),
  'los-angeles':             L('Los Angeles, États-Unis', 34.052, -118.244, 'America/Los_Angeles'),
  'tokyo':                   L('Tokyo, Japon', 35.682, 139.769, 'Asia/Tokyo'),
  'lyon':                    L('Lyon, France', 45.764, 4.836, 'Europe/Paris'),
  'papeete':                 L('Papeete, Polynésie française', -17.535, -149.569, 'Pacific/Tahiti'),
  'sydney':                  L('Sydney, Australie', -33.868, 151.209, 'Australia/Sydney'),
  'new-york':                L('New York, États-Unis', 40.713, -74.006, 'America/New_York'),
  'san-francisco':           L('San Francisco, États-Unis', 37.775, -122.419, 'America/Los_Angeles'),
  'hong-kong':               L('Hong Kong', 22.319, 114.169, 'Asia/Hong_Kong'),
  'zurich':                  L('Zurich, Suisse', 47.377, 8.542, 'Europe/Zurich'),
  'monaco':                  L('Monaco', 43.738, 7.424, 'Europe/Monaco'),
  'gstaad':                  L('Gstaad, Suisse', 46.475, 7.286, 'Europe/Zurich'),
  'courchevel':              L('Courchevel, France', 45.415, 6.634, 'Europe/Paris'),
  'aspen':                   L('Aspen, États-Unis', 39.191, -106.818, 'America/Denver'),
  'lac-de-come':             L('Lac de Côme, Italie', 45.994, 9.257, 'Europe/Rome'),
  'hamptons':                L('Les Hamptons, États-Unis', 40.963, -72.185, 'America/New_York'),
};
// 17°32′S 149°34′O
const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return `${m === 60 ? d + 1 : d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′${v >= 0 ? pos : neg}`; };
export const coordonnees = l => `${dms(l.lat, 'N', 'S')} ${dms(l.lon, 'E', 'O')}`;
export function heureLocale(l, quand = new Date()){
  try{ return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: l.tz }).format(quand); }catch(e){ return ''; }
}
