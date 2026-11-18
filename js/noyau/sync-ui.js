// Réglages › Synchro : connexion du compte, code de chiffrement, état de la synchro.
import { esc, toast, $ } from './ui.js';
import { app } from './bus.js';
import * as sync from './sync.js';

let mode = 'connexion', message = '';
const quand = d => { if(!d) return 'pas encore'; const s = Math.round((Date.now() - d) / 1000); return s < 60 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : d.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); };

export function reglagesSync(){
  const e = sync.etat;
  if(e.connecte) return `<section class="set-sec"><h4>Synchro Mac et iPhone</h4>
    <div class="set-line"><span>Compte</span><b>${esc(e.email)}</b></div>
    <div class="set-line"><span>Dernière synchro</span><span>${e.occupe ? 'en cours…' : quand(e.derniere)}</span></div>
    ${e.erreur ? `<p class="set-note" style="color:var(--urgent)">${esc(e.erreur)}</p>` : ''}
    <div class="ligne" style="margin-top:10px"><button class="btn primary" data-sync="maintenant">Synchroniser maintenant</button><button class="btn ghost" data-sync="deconnecter">Déconnecter cet appareil</button></div>
    <p class="set-note">Tes données sont chiffrées sur cet appareil avant d'être envoyées. Sans ton code de chiffrement, personne ne peut les lire, pas même Supabase. Les photos ne sont pas synchronisées.</p></section>`;
  const creer = mode === 'creation';
  return `<section class="set-sec"><h4>${creer ? 'Créer mon compte de synchro' : 'Connecter cet appareil'}</h4>
    <form class="form-col" id="syncForm" autocomplete="on">
      <label class="etiq">Email<input class="inp" type="email" id="syncEmail" autocomplete="username" required></label>
      <label class="etiq">Mot de passe du compte<input class="inp" type="password" id="syncMdp" autocomplete="${creer ? 'new-password' : 'current-password'}" minlength="6" required></label>
      <label class="etiq">Code de chiffrement<input class="inp" type="password" id="syncCode" autocomplete="off" minlength="6" required></label>
      <p class="set-note">Le code de chiffrement protège tes données. Il est différent du mot de passe, il ne quitte jamais tes appareils et il ne peut pas être récupéré : note-le précieusement. Le même code sur le Mac et l'iPhone.</p>
      <button class="btn primary">${creer ? 'Créer le compte et synchroniser' : 'Se connecter et synchroniser'}</button>
      <p class="set-note" id="syncMsg" role="alert">${esc(message)}</p>
    </form>
    <button class="btn ghost" data-sync="${creer ? 'mode-connexion' : 'mode-creation'}">${creer ? 'J’ai déjà un compte' : 'Première fois ? Créer mon compte'}</button></section>`;
}
document.addEventListener('submit', async ev => {
  if(ev.target.id !== 'syncForm') return;
  ev.preventDefault();
  const btn = ev.target.querySelector('button'); btn.disabled = true; $('#syncMsg').textContent = 'Connexion…';
  try{
    const r = await sync.connecter({ email: $('#syncEmail').value.trim(), motDePasse: $('#syncMdp').value, code: $('#syncCode').value, creer: mode === 'creation' });
    if(r.confirmer){ message = 'Compte créé. Ouvre le mail de confirmation reçu, clique sur le lien, puis reviens te connecter ici.'; mode = 'connexion'; }
    else { message = ''; toast('Synchro activée'); }
  }catch(e){ message = e.message; }
  app.rendre();
});
app.clics.push(e => {
  const b = e.target.closest('[data-sync]'); if(!b) return false;
  const q = b.dataset.sync;
  if(q === 'maintenant') sync.synchroniser().then(() => { app.rendre(); toast(sync.etat.erreur || 'Synchronisé'); });
  else if(q === 'deconnecter'){ sync.deconnecter(); toast('Cet appareil n’est plus synchronisé'); }
  else if(q === 'mode-creation' || q === 'mode-connexion'){ mode = q.slice(5); message = ''; }
  app.rendre(); return true;
});
sync.surChangement(() => { if(app.onglet === 'reglages' && !document.querySelector('#syncForm input:focus')) app.rendre(); });
