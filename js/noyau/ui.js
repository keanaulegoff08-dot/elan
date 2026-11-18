// Petits outils d'interface partagés.
export const $ = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function notify(title, body){
  try{
    if(window.desktop && window.desktop.notify){ window.desktop.notify(title, body); return; }
    if('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  }catch(e){}
}

export let toastT;
export function toast(msg, undo){
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo?'<button id="undoBtn">Annuler</button>':''}`;
  el.classList.add('show'); clearTimeout(toastT);
  if(undo) $('#undoBtn').onclick = () => { undo(); el.classList.remove('show'); };
  toastT = setTimeout(() => el.classList.remove('show'), undo ? 4500 : 2400);
}

// Célébration discrète : quelques éclats de couleur qui s'élèvent et s'effacent (transform et opacity).
export function celebrer(x, y, couleur){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for(let i = 0; i < 16; i++){
    const p = document.createElement('i');
    p.className = 'eclat'; p.style.cssText = `left:${x}px;top:${y}px;background:${i % 3 ? couleur : '#fff'}`;
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(.2)`, opacity: 0 }],
      { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = () => p.remove();
  }
}
export function autoGrandir(el){ el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
export const dateLongue = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
