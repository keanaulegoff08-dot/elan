// Lecture des relevés (PDF BNP Paribas, CSV Revolut) et fusion avec mes opérations.
// Fonctions pures : testées hors de l'application sur le vrai relevé.
import { classer, cleMarchand, BETISES_PROBABLES } from './classement.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = n => String(n).padStart(2, '0');
const cle = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const MONTANT = /^([−+\-–])\s*([\d\s  .]+,\d{2})\s*€$/;
const lireMontant = (signe, v) => { const n = parseFloat(v.replace(/[\s  .]/g, '').replace(',', '.')); return signe === '+' ? n : -n; };
const BRUIT = /^(Relevé d'Opérations|https?:\/\/|Vous pouvez pointer|d'opérations en cliquant|Opérations enregistrées|Une optimisation|Aujourd'hui$|N° \*|\d+ opérations?$|à venir)/i;

// lignes : [{ texte }] dans l'ordre de lecture (voir main/pdf.js).
export function lireBNP(lignes){
  const textes = lignes.map(l => typeof l === 'string' ? l : l.texte);
  // Date d'édition du relevé, en haut de chaque page : sert à retrouver l'année de chaque jour.
  let edition = null, solde = null;
  for(const t of textes){
    const m = t.match(/Relevé d'Opérations.*?(\d\d)\/(\d\d)\/(\d{4})/);
    if(m){ edition = new Date(+m[3], +m[2] - 1, +m[1]); break; }
  }
  if(!edition) throw new Error("Ce PDF ne ressemble pas à un relevé d'opérations BNP Paribas.");
  const iAuj = textes.findIndex(t => /^Aujourd'hui$/i.test(t));
  if(iAuj >= 0) for(let i = iAuj + 1; i < Math.min(iAuj + 4, textes.length); i++){
    const m = textes[i].match(/^(−|-)?\s*([\d\s  .]+,\d{2})\s*€$/);
    if(m){ solde = lireMontant(m[1] ? '-' : '+', m[2]); break; }
  }
  const annee = (jourSemaine, j, m) => {
    for(let y = edition.getFullYear(); y >= edition.getFullYear() - 3; y--){
      const d = new Date(y, m - 1, j);
      if(d.getDate() === j && d.getDay() === jourSemaine && d <= edition) return y;
    }
    return null;
  };

  const ops = []; let date = null, tampon = [], montant = null, enAttente = false;
  const pousser = (banque) => {
    const lib = tampon.join(' ').trim() || 'Opération';
    ops.push({ date, lib, montant, banque: banque || '', attente: enAttente });
    tampon = []; montant = null;
  };
  for(const brut of textes){
    let t = brut.trim();
    if(!t) continue;
    const jour = t.match(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) (\d{1,2}) (\p{L}+)$/u);
    if(jour){
      const js = JOURS.indexOf(jour[1].toLowerCase()), j = +jour[2], m = MOIS.indexOf(jour[3].toLowerCase()) + 1;
      const y = annee(js, j, m); if(y){ date = cle(y, m, j); enAttente = false; }
      tampon = []; montant = null; continue;
    }
    const att = t.match(/^\w+ \| Enregistrée le (\d\d)\/(\d\d)\/(\d{4})/);
    if(att){ date = cle(+att[3], +att[2], +att[1]); enAttente = true; tampon = ['Carte (en cours)']; montant = null; continue; }
    if(/^Relevé d'Opérations/.test(t) || /Page \d+ sur \d+$/.test(t)) continue;
    // Libellé et montant sur la même ligne (« Orange ¦ − 15,99 € »).
    const parts = t.split(' ¦ ');
    if(parts.length > 1 && MONTANT.test(parts[parts.length - 1]) && montant === null){
      tampon.push(parts.slice(0, -1).join(' '));
      t = parts[parts.length - 1];
    }
    const mm = t.match(MONTANT);
    if(mm && date){ montant = lireMontant(mm[1] === '+' ? '+' : '-', mm[2]); continue; }
    if(montant !== null){ pousser(t); continue; }
    if(BRUIT.test(t)) continue;
    if(date) tampon.push(t.replace(/ ¦ /g, ' '));
  }
  return { ops: ops.filter(o => o.date && Number.isFinite(o.montant)), solde, edition: cle(edition.getFullYear(), edition.getMonth() + 1, edition.getDate()) };
}

// Export CSV de Revolut (anglais ou français).
export function lireRevolut(texte){
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if(lignes.length < 2) throw new Error('Fichier CSV vide.');
  const sep = (lignes[0].match(/;/g) || []).length > (lignes[0].match(/,/g) || []).length ? ';' : ',';
  const decouper = l => { const r = []; let c = '', q = false; for(const ch of l){ if(ch === '"') q = !q; else if(ch === sep && !q){ r.push(c); c = ''; } else c += ch; } r.push(c); return r.map(x => x.trim()); };
  const tete = decouper(lignes[0]).map(h => h.toLowerCase());
  const col = (...noms) => tete.findIndex(h => noms.some(n => h === n || h.startsWith(n)));
  const cDate = col('completed date', 'date de fin', 'date de finalisation', 'started date', 'date de début', 'date'), cDesc = col('description', 'libellé');
  const cMont = col('amount', 'montant'), cFrais = col('fee', 'frais'), cEtat = col('state', 'état', 'etat'), cType = col('type'), cSolde = col('balance', 'solde');
  if(cDate < 0 || cDesc < 0 || cMont < 0) throw new Error("Ce CSV ne ressemble pas à un export Revolut (colonnes Date, Description, Montant).");
  const ops = []; let solde = null;
  for(const l of lignes.slice(1)){
    const v = decouper(l);
    const etat = cEtat >= 0 ? (v[cEtat] || '').toUpperCase() : 'COMPLETED';
    if(/REVERTED|DECLINED|FAILED|ANNUL|REFUS|ÉCHOU/.test(etat)) continue;
    const nombre = s => parseFloat(String(s || '0').replace(/\s/g, '').replace(',', '.')) || 0;
    const m = Math.round((nombre(v[cMont]) - Math.abs(nombre(v[cFrais]))) * 100) / 100;
    const d = (v[cDate] || '').match(/(\d{4})-(\d\d)-(\d\d)|(\d\d)\/(\d\d)\/(\d{4})/);
    if(!d || !m) continue;
    const date = d[1] ? `${d[1]}-${d[2]}-${d[3]}` : `${d[6]}-${d[5]}-${d[4]}`;
    const type = cType >= 0 ? (v[cType] || '').toLowerCase() : '';
    ops.push({ date, lib: v[cDesc] || 'Revolut', montant: m, banque: /top|recharge|transfer|virement/.test(type) ? 'Recharge' : '' });
    if(cSolde >= 0 && v[cSolde]) solde = nombre(v[cSolde]);
  }
  return { ops, solde, edition: ops.reduce((a, o) => o.date > a ? o.date : a, '') };
}

const jours = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);
const empreinte = o => `${o.compte}|${o.date}|${Math.round(o.montant * 100)}|${cleMarchand(o.libBanque || o.lib)}`;

// Ajoute les opérations lues à F.ops. Une opération déjà présente (même compte, date, montant, libellé) est ignorée ;
// une saisie à la main du même montant à ± N jours est « retrouvée » : elle garde ma catégorie et devient l'opération du relevé.
export function fusionner(F, lues, { compte, uid, fenetre = 3, aujourdhui = null }){
  const bilan = { lues: lues.length, nouvelles: 0, fusionnees: 0, doublons: 0, aVerifier: 0, ids: [] };
  const deja = new Map();
  for(const o of F.ops) if(o.source !== 'manuel' || o.rapproche){ const k = empreinte(o); deja.set(k, (deja.get(k) || 0) + 1); }
  const vus = new Map();
  for(const l of lues){
    const base = { compte, date: l.date, montant: l.montant, lib: l.lib };
    const k = empreinte(base);
    // Deux opérations identiques le même jour sont possibles (5 Vélo'v à 1 €) : on compte les occurrences.
    const n = (vus.get(k) || 0) + 1; vus.set(k, n);
    if((deja.get(k) || 0) >= n){ bilan.doublons++; continue; }
    const saisie = F.ops.find(o => o.source === 'manuel' && !o.rapproche && Math.abs(o.montant - l.montant) < 0.005 && jours(o.date, l.date) <= fenetre && (!o.compte || o.compte === compte));
    if(saisie){
      Object.assign(saisie, { rapproche: true, libBanque: l.lib, dateBanque: l.date, compte });
      bilan.fusionnees++; continue;
    }
    // Paiement carte « en cours » lors d'un relevé précédent, qui revient avec son vrai libellé : même opération.
    const enCours = !l.attente && F.ops.find(o => o.attente && o.compte === compte && Math.abs(o.montant - l.montant) < 0.005 && jours(o.date, l.date) <= 5);
    if(enCours){
      Object.assign(enCours, { attente: false, libBanque: l.lib, date: l.date, banque: l.banque || enCours.banque });
      bilan.fusionnees++; continue;
    }
    const c = classer(l, F.reglages, F.regles);
    const op = {
      id: uid(), date: l.date, lib: l.lib, montant: l.montant, compte, source: compte,
      groupe: c.groupe, sous: c.sous, verif: !!c.verif, betise: null, banque: l.banque || '',
    };
    if(l.attente) op.attente = true;
    if(F.reglages.proposerBetises !== false && BETISES_PROBABLES.has(op.groupe + ':' + op.sous)) op.aTrier = true;
    F.ops.push(op); bilan.nouvelles++; bilan.ids.push(op.id);
    if(op.verif) bilan.aVerifier++;
  }
  F.ops.sort((a, b) => b.date.localeCompare(a.date));
  return bilan;
}
