// Migration des données. Règle : on ajoute, on ne modifie ni ne supprime jamais un champ existant.
// Fonction pure, utilisée par l'application et par l'outil de test (outils/test-migration.mjs).
export const VERSION = 3;

const objet = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const liste = v => Array.isArray(v) ? v : [];

export function migrer(d) {
  if (!d || !Array.isArray(d.tasks)) throw new Error('Données Élan invalides');
  const de = d.version || 1;

  // v1 : champs garantis
  d.categories = liste(d.categories);
  d.log = liste(d.log);
  d.settings = objet(d.settings);
  if (typeof d.snooze !== 'number') d.snooze = 0;

  // v2 : tâches enrichies
  for (const t of d.tasks) {
    if (!Array.isArray(t.subtasks)) t.subtasks = []; // { id, title, done, min }
    if (!Array.isArray(t.links)) t.links = [];       // { id, url, label }
    if (!Array.isArray(t.files)) t.files = [];       // { id, nom, rel, taille } : fichier sous media/
  }

  // v2 : nouveaux blocs
  d.dreams = liste(d.dreams);       // rêves : { id, title, desc, domain, deadline, steps[], taskIds[], manualPct, createdAt, achievedAt }
  d.events = liste(d.events);       // événements du calendrier : { id, title, date, end, time, timeEnd, allDay, notes, cat?, taskId? }
  d.commitments = liste(d.commitments); // engagements : { id, title, why, cat, start, days, log, createdAt, stoppedAt }
  d.reviews = objet(d.reviews);     // bilans : { 'AAAA-MM-JJ': { good, bad, next, files[], at } }
  d.markers = liste(d.markers);     // repères : { id, text, kind: 'appui' | 'vigilance', date, on }
  d.habits = liste(d.habits);       // addictions suivies : { id, name, createdAt, days: { 'AAAA-MM-JJ': 'ok' | 'ko' } }
  d.quotes = liste(d.quotes);       // citations : { id, text, author }
  d.people = liste(d.people);       // personnes inspirantes : { id, name, rel }
  d.wallpapers = Object.assign({ draws: {}, pins: {}, custom: [], off: [] }, objet(d.wallpapers));
  d.souvenirs = Object.assign({ albumsOff: [], photosOff: [], accueil: [] }, objet(d.souvenirs));
  if (d.lock === undefined) d.lock = null; // { salt, hash } : code de l'onglet verrouillé, jamais en clair
  if (typeof d.skipReviews !== 'object' || !d.skipReviews) d.skipReviews = {}; // bilans écartés : { 'AAAA-MM-JJ': true }

  // v3 : « Mes finances » (complété par onglets/finances.js au premier passage)
  if (!d.finances || typeof d.finances !== 'object') d.finances = null;

  const s = d.settings;
  s.pomodoro = Object.assign({ fonds: true, anim: true, chaque: 30, apparition: 10, disparition: 3 }, objet(s.pomodoro));
  s.calendrier = Object.assign({ anim: true, zoom: 72, panneau: false }, objet(s.calendrier));
  s.accueil = Object.assign({ chaque: 25 }, objet(s.accueil)); // défilement des souvenirs sur l'accueil, en secondes (20 à 30)
  if (s.horizon === undefined) s.horizon = true;                // la destination du mois teinte l'arrière-plan
  if (s.barreMasquee === undefined) s.barreMasquee = false;     // barre latérale cachée (⌃⌘S)

  if (de < VERSION) d.version = VERSION;
  return { donnees: d, de };
}
