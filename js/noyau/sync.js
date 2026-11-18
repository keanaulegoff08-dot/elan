// Synchronisation Mac ⇄ iPhone par Supabase, chiffrée de bout en bout.
// Les données sont découpées en éléments (une tâche, une opération, un bilan…), chacun chiffré sur l'appareil (AES-GCM,
// clé tirée du code de chiffrement par PBKDF2) avant d'être envoyé. Le serveur ne voit que des clés d'éléments et du texte chiffré.
// Règle de fusion : à chaque passage on récupère d'abord ce qui a changé ailleurs, puis on envoie ce qui a changé ici ;
// une modification locale pas encore envoyée l'emporte sur la version du serveur.

export const SUPABASE_URL = 'https://xzhgopditqovwmbponyg.supabase.co';
export const SUPABASE_CLE = 'sb_publishable_tIQ168hrZ3j0zy7VLyMsVw_oiG9yhCq';
const STOCK = 'elan-sync-v1';            // session, état de synchro, clé de chiffrement de cet appareil (jamais synchronisés)
const CONTROLE = '@controle';            // élément témoin : vérifie que le code de chiffrement est le bon

const LISTES = ['tasks', 'categories', 'dreams', 'events', 'commitments', 'markers', 'habits', 'quotes', 'people', 'finances.ops', 'finances.paliers'];
const DICTS = ['reviews', 'skipReviews'];
const IGNORES = new Set(['version', 'snooze']);

let S = null, sauver = () => {}, rendre = () => {};
let cle = null, enCours = null, minuteur = null, envoi = null, trierOps = false;
const auditeurs = new Set();
export const etat = { connecte: false, email: '', derniere: null, erreur: '', occupe: false };
const notifier = () => auditeurs.forEach(f => { try{ f(etat); }catch(e){} });
export const surChangement = f => { auditeurs.add(f); return () => auditeurs.delete(f); };

/* ---------- stockage local de l'appareil ---------- */
const lire = () => { try{ return JSON.parse(localStorage.getItem(STOCK)) || {}; }catch(e){ return {}; } };
const ecrire = o => { try{ localStorage.setItem(STOCK, JSON.stringify(o)); }catch(e){} };
const maj = patch => { const o = Object.assign(lire(), patch); ecrire(o); return o; };

/* ---------- outils ---------- */
const b64 = u8 => { let s = ''; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function empreinte(str){ let h = 2166136261 >>> 0; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + ':' + str.length; }

async function deriver(code, sel){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode('elan:' + sel), iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function chiffrer(obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(JSON.stringify(obj))));
  const tout = new Uint8Array(12 + c.length); tout.set(iv); tout.set(c, 12);
  return b64(tout);
}
async function dechiffrer(txt){
  const u = deb64(txt);
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, cle, u.subarray(12));
  return JSON.parse(new TextDecoder().decode(p));
}

/* ---------- API Supabase (sans bibliothèque) ---------- */
async function api(chemin, { methode = 'GET', corps, entetes = {}, auth = true } = {}){
  const s = lire().session;
  const h = Object.assign({ apikey: SUPABASE_CLE, 'Content-Type': 'application/json' }, entetes);
  if(auth && s) h.Authorization = 'Bearer ' + s.access_token;
  const r = await fetch(SUPABASE_URL + chemin, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
  const t = await r.text(); let d = null; try{ d = t ? JSON.parse(t) : null; }catch(e){ d = t; }
  if(!r.ok){ const m = (d && (d.msg || d.message || d.error_description || d.error)) || ('Erreur ' + r.status); const e = new Error(traduire(m)); e.statut = r.status; throw e; }
  return d;
}
function traduire(m){
  const t = String(m);
  if(/Invalid login credentials/i.test(t)) return 'Email ou mot de passe incorrect.';
  if(/Email not confirmed/i.test(t)) return 'Confirme d’abord ton email (lien reçu par mail), puis connecte-toi.';
  if(/already registered|already been registered/i.test(t)) return 'Un compte existe déjà avec cet email : connecte-toi.';
  if(/Password should be at least/i.test(t)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if(/Signups not allowed/i.test(t)) return 'La création de compte est fermée : connecte-toi avec ton compte existant.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(t)) return 'Pas de connexion internet.';
  return t;
}
async function rafraichirSession(){
  const s = lire().session; if(!s) throw new Error('Non connecté.');
  if(s.expires_at && s.expires_at * 1000 > Date.now() + 60e3) return s;
  const n = await api('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', corps: { refresh_token: s.refresh_token }, auth: false });
  maj({ session: n }); return n;
}

/* ---------- découpage de l'état en éléments ---------- */
function prendre(chemin){ let o = S; for(const k of chemin.split('.')){ if(o == null) return undefined; o = o[k]; } return o; }
function elements(){
  const res = new Map();
  for(const ch of LISTES){ const l = prendre(ch); if(Array.isArray(l)) l.forEach(x => { if(x && x.id) res.set(`${ch}/${x.id}`, x); }); }
  for(const ch of DICTS){ const d = prendre(ch); if(d && typeof d === 'object') for(const [k, v] of Object.entries(d)) res.set(`${ch}/${k}`, v); }
  for(const [k, v] of Object.entries(S)){
    if(IGNORES.has(k) || LISTES.includes(k) || DICTS.includes(k) || v === undefined) continue;
    if(k === 'finances'){ if(v) for(const [k2, v2] of Object.entries(v)) if(!LISTES.includes('finances.' + k2)) res.set(`@finances.${k2}`, v2); continue; }
    res.set('@' + k, v);
  }
  return res;
}
function appliquer(c, valeur, supprime){
  if(c === CONTROLE) return;
  if(c.startsWith('@')){
    const ch = c.slice(1);
    if(ch.startsWith('finances.')){ if(!S.finances) S.finances = {}; const k = ch.slice(9); if(supprime) delete S.finances[k]; else S.finances[k] = valeur; }
    else if(supprime) delete S[ch]; else S[ch] = valeur;
    return;
  }
  const i = c.lastIndexOf('/'), ch = c.slice(0, i), id = c.slice(i + 1);
  if(DICTS.includes(ch)){ if(!S[ch]) S[ch] = {}; if(supprime) delete S[ch][id]; else S[ch][id] = valeur; return; }
  if(ch.startsWith('finances.') && !S.finances) S.finances = {};
  const parent = ch.startsWith('finances.') ? S.finances : S, k = ch.startsWith('finances.') ? ch.slice(9) : ch;
  if(!Array.isArray(parent[k])) parent[k] = [];
  const l = parent[k], j = l.findIndex(x => x && x.id === id);
  if(supprime){ if(j >= 0) l.splice(j, 1); return; }
  const v = Object.assign({}, valeur); delete v._rang;
  if(j >= 0) l[j] = v; else l.push(v);
  if(ch === 'finances.ops') trierOps = true;
}

/* ---------- un passage de synchro ---------- */
export function synchroniser(){
  if(enCours) return enCours;
  enCours = passage().finally(() => { enCours = null; });
  return enCours;
}
async function passage(){
  if(!cle || !lire().session){ etat.connecte = false; notifier(); return; }
  etat.occupe = true; notifier();
  try{
    await rafraichirSession();
    const st = lire(), premier = !st.empreintes;
    const vues = Object.assign({}, st.empreintes || {});
    let depuis = st.depuis || '1970-01-01T00:00:00Z', plusRecent = depuis, recus = 0;
    const locales = elements();
    // 1. Ce qui a changé ailleurs
    const distants = new Set();
    for(let page = 0; ; page++){
      const rows = await api(`/rest/v1/elements?select=cle,contenu,maj,supprime&maj=gt.${encodeURIComponent(depuis)}&order=maj.asc&limit=1000`);
      for(const r of rows){
        if(r.maj > plusRecent) plusRecent = r.maj;
        distants.add(r.cle);
        if(r.cle === CONTROLE) continue;
        const loc = locales.get(r.cle), locHash = loc === undefined ? null : empreinte(JSON.stringify(loc));
        const enAttente = !premier && loc !== undefined && locHash !== vues[r.cle];
        if(enAttente) continue; // modifié ici aussi : ma version partira juste après
        if(r.supprime){ appliquer(r.cle, null, true); delete vues[r.cle]; recus++; continue; }
        const v = await dechiffrer(r.contenu);
        appliquer(r.cle, v, false); vues[r.cle] = empreinte(JSON.stringify(v)); recus++;
      }
      if(rows.length < 1000) break;
      depuis = plusRecent;
    }
    // 2. Ce qui a changé ici
    const apres = elements(), envoyer = [];
    for(const [c, v] of apres){
      const h = empreinte(JSON.stringify(v));
      if(premier && distants.has(c)){ vues[c] = h; continue; }
      if(vues[c] !== h) envoyer.push({ cle: c, valeur: v, h });
    }
    const supprimes = premier ? [] : Object.keys(vues).filter(c => !apres.has(c) && c !== CONTROLE);
    for(let i = 0; i < envoyer.length; i += 300){
      const lot = envoyer.slice(i, i + 300);
      const corps = await Promise.all(lot.map(async e => ({ cle: e.cle, contenu: await chiffrer(e.valeur), supprime: false })));
      const r = await api('/rest/v1/elements?on_conflict=user_id,cle', { methode: 'POST', corps, entetes: { Prefer: 'resolution=merge-duplicates,return=representation' } });
      for(const x of r || []) if(x.maj > plusRecent) plusRecent = x.maj;
      lot.forEach(e => { vues[e.cle] = e.h; });
    }
    for(let i = 0; i < supprimes.length; i += 300){
      const lot = supprimes.slice(i, i + 300);
      const r = await api('/rest/v1/elements?on_conflict=user_id,cle', { methode: 'POST', corps: lot.map(c => ({ cle: c, contenu: '', supprime: true })), entetes: { Prefer: 'resolution=merge-duplicates,return=representation' } });
      for(const x of r || []) if(x.maj > plusRecent) plusRecent = x.maj;
      lot.forEach(c => delete vues[c]);
    }
    maj({ empreintes: vues, depuis: plusRecent });
    etat.derniere = new Date(); etat.erreur = ''; etat.connecte = true;
    if(trierOps && S.finances && Array.isArray(S.finances.ops)){ S.finances.ops.sort((a, b) => b.date.localeCompare(a.date)); trierOps = false; }
    if(recus){ sauver(true); rendre(); }
  }catch(e){
    etat.erreur = e.message || String(e);
    if(e.statut === 401){ etat.connecte = false; }
  }finally{ etat.occupe = false; notifier(); }
}

/* ---------- connexion ---------- */
async function verifierOuPoserControle(){
  const rows = await api(`/rest/v1/elements?select=contenu&cle=eq.${encodeURIComponent(CONTROLE)}`);
  if(rows.length){
    try{ const v = await dechiffrer(rows[0].contenu); if(v !== 'elan-ok') throw 0; }
    catch(e){ cle = null; throw new Error('Ce code de chiffrement ne correspond pas à celui de tes autres appareils.'); }
    return false;
  }
  await api('/rest/v1/elements?on_conflict=user_id,cle', { methode: 'POST', corps: [{ cle: CONTROLE, contenu: await chiffrer('elan-ok'), supprime: false }], entetes: { Prefer: 'resolution=merge-duplicates' } });
  return true;
}
export async function connecter({ email, motDePasse, code, creer }){
  if(!email || !motDePasse || !code) throw new Error('Remplis les trois champs.');
  if(code.length < 6) throw new Error('Le code de chiffrement doit faire au moins 6 caractères.');
  let session;
  if(creer){
    const r = await api('/auth/v1/signup', { methode: 'POST', corps: { email, password: motDePasse }, auth: false });
    session = r && r.access_token ? r : null;
    if(!session) return { confirmer: true };
  } else session = await api('/auth/v1/token?grant_type=password', { methode: 'POST', corps: { email, password: motDePasse }, auth: false });
  ecrire({ session, email: session.user && session.user.email || email });
  cle = await deriver(code, session.user.id);
  await verifierOuPoserControle();
  maj({ cleBrute: b64(new Uint8Array(await crypto.subtle.exportKey('raw', cle))) });
  etat.connecte = true; etat.email = lire().email; notifier();
  await synchroniser();
  return { ok: true };
}
export function deconnecter(){
  const s = lire().session;
  if(s) api('/auth/v1/logout', { methode: 'POST' }).catch(() => {});
  ecrire({}); cle = null; Object.assign(etat, { connecte: false, email: '', derniere: null, erreur: '' }); notifier();
}

/* ---------- démarrage ---------- */
export async function demarrer(etatApp, { sauvegarder, redessiner }){
  S = etatApp; sauver = sauvegarder; rendre = redessiner;
  const st = lire();
  if(st.session && st.cleBrute){
    try{ cle = await crypto.subtle.importKey('raw', deb64(st.cleBrute), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']); etat.connecte = true; etat.email = st.email || ''; }catch(e){ cle = null; }
  }
  notifier();
  if(cle) synchroniser();
  clearInterval(minuteur);
  minuteur = setInterval(() => { if(cle && !document.hidden) synchroniser(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if(!document.hidden && cle) synchroniser(); });
  addEventListener('online', () => { if(cle) synchroniser(); });
}
// Appelé après chaque sauvegarde locale : envoi groupé quelques secondes plus tard.
export function apresSauvegarde(){
  if(!cle) return;
  clearTimeout(envoi); envoi = setTimeout(synchroniser, 2500);
}
