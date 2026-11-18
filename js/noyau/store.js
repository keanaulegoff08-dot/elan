// État de l'application : un seul objet S, lu au démarrage, réécrit en entier à chaque sauvegarde.
import { migrer, VERSION } from './migration.js';

export const DEFAULT_CATS = [
  { id:'etudes',   name:'Études',           color:'#8790D8' },
  { id:'travail',  name:'Travail',          color:'#6A9FCB' },
  { id:'trading',  name:'Trading',          color:'#5FAE8A' },
  { id:'sport',    name:'Sport',            color:'#E2A06F' },
  { id:'courses',  name:'Courses & dépôts', color:'#DB8FB0' },
  { id:'admin',    name:'Admin & finances', color:'#A8957E' },
  { id:'projets',  name:'Projets perso',    color:'#A88AD6' },
  { id:'bienetre', name:'Bien-être',        color:'#5FB3B3' },
  { id:'maison',   name:'Maison',           color:'#C9B25A' },
  { id:'proches',  name:'Proches',          color:'#D58E8E' },
];
export const SWATCHES = ['#8790D8','#6A9FCB','#5FAE8A','#E2A06F','#DB8FB0','#A8957E','#A88AD6','#5FB3B3','#C9B25A','#D58E8E','#7FA7A0','#B98FB0','#8FB36A','#D9A86C','#7C93B8'];

const STORE_KEY = 'elan-data-v1';
export const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

// S n'est jamais réaffecté : tous les modules partagent la même référence.
export const S = {};

export function blankState(){
  return migrer({ version: VERSION, tasks:[], categories: DEFAULT_CATS.map(c => ({...c})), log:[], settings:{ theme:'auto', name:'', notify:true, sound:true }, snooze:0 }).donnees;
}
function remplacer(d){
  for(const k of Object.keys(S)) delete S[k];
  Object.assign(S, d);
}

export function load(){
  const bureau = window.desktop;
  let raw = null;
  try{ if(bureau && bureau.load) raw = bureau.load(); }catch(e){}
  if(!raw){ try{ raw = localStorage.getItem(STORE_KEY); }catch(e){} }
  if(raw){
    try{
      const d = JSON.parse(raw);
      if(d && Array.isArray(d.tasks)){
        // Copie de l'ancien fichier avant toute montée de version.
        if((d.version || 1) < VERSION && bureau && bureau.archiver) bureau.archiver('avant-v' + VERSION);
        remplacer(migrer(Object.assign(blankState(), d)).donnees);
        return;
      }
      throw new Error('format');
    }catch(e){
      // Fichier présent mais illisible : on le met de côté au lieu de l'écraser.
      try{ if(bureau && bureau.archiver) bureau.archiver('illisible'); }catch(_){}
    }
  }
  remplacer(blankState());
}

// Import d'une sauvegarde (v1 ou v2) : l'état courant est archivé avant d'être remplacé.
export function importer(texte){
  const d = JSON.parse(texte);
  if(!d || !Array.isArray(d.tasks)) throw new Error('format');
  try{ if(window.desktop && window.desktop.archiver) window.desktop.archiver('avant-import'); }catch(e){}
  remplacer(migrer(Object.assign(blankState(), d)).donnees);
  save();
}

let saveT;
const apresEcriture = [];
export const surSauvegarde = f => apresEcriture.push(f);
export function save(){
  clearTimeout(saveT);
  saveT = setTimeout(ecrire, 150);
}
function ecrire(){
  const str = JSON.stringify(S);
  try{ if(window.desktop && window.desktop.save) window.desktop.save(str); }catch(e){}
  try{ localStorage.setItem(STORE_KEY, str); }catch(e){}
  for(const f of apresEcriture){ try{ f(); }catch(e){} }
}
// Rien ne se perd si la fenêtre se ferme pendant le délai d'écriture.
addEventListener('beforeunload', () => { if(saveT){ clearTimeout(saveT); ecrire(); } });

export const mediaUrl = rel => 'elan-media://m/' + String(rel).split('/').map(encodeURIComponent).join('/');
