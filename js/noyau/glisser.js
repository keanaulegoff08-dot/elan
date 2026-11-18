// Réordonner une liste en la faisant glisser par sa poignée (souris, trackpad, clavier). Sans dépendance.
//   liste   : l'élément qui contient les lignes
//   options : ligne (sélecteur des lignes), poignee (sélecteur de la poignée), fin(de, vers) appelé si l'ordre change
// Les autres lignes s'écartent pendant le geste ; au lâcher, fin() reçoit l'ancien et le nouvel indice.
export function triable(liste, { ligne = '.sub', poignee = '.sub-grip', fin }){
  if(!liste || liste.dataset.triable) return;
  liste.dataset.triable = '1';
  const lignes = () => Array.from(liste.querySelectorAll(':scope > ' + ligne));

  liste.addEventListener('pointerdown', e => {
    const g = e.target.closest(poignee); if(!g || e.button !== 0) return;
    const el = g.closest(ligne), tous = lignes(), de = tous.indexOf(el);
    if(de < 0 || tous.length < 2) return;
    e.preventDefault();
    const boites = tous.map(x => x.getBoundingClientRect());
    const ecart = boites[1].top - boites[0].bottom, pas = boites[de].height + ecart;
    const y0 = e.clientY, min = boites[0].top - boites[de].top, max = boites[boites.length - 1].bottom - boites[de].bottom;
    let vers = de;
    try{ g.setPointerCapture(e.pointerId); }catch(err){}
    liste.classList.add('tri'); el.classList.add('glisse');
    const bouger = ev => {
      const d = Math.max(min, Math.min(max, ev.clientY - y0));
      el.style.transform = `translateY(${d}px)`;
      const centre = boites[de].top + boites[de].height / 2 + d;
      vers = de;
      tous.forEach((x, i) => {
        if(i === de) return;
        const c = boites[i].top + boites[i].height / 2;
        let t = 0;
        if(i > de && centre > c){ t = -pas; vers = Math.max(vers, i); }
        else if(i < de && centre < c){ t = pas; vers = Math.min(vers, i); }
        x.style.transform = t ? `translateY(${t}px)` : '';
      });
    };
    const lacher = () => {
      g.removeEventListener('pointermove', bouger); g.removeEventListener('pointerup', lacher); g.removeEventListener('pointercancel', lacher);
      liste.classList.remove('tri'); el.classList.remove('glisse');
      tous.forEach(x => { x.style.transform = ''; });
      if(vers !== de && fin) fin(de, vers);
    };
    g.addEventListener('pointermove', bouger); g.addEventListener('pointerup', lacher); g.addEventListener('pointercancel', lacher);
  });

  // Au clavier : poignée sélectionnée, flèches haut et bas.
  liste.addEventListener('keydown', e => {
    const g = e.target.closest(poignee); if(!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const tous = lignes(), de = tous.indexOf(g.closest(ligne)), vers = de + (e.key === 'ArrowUp' ? -1 : 1);
    if(de < 0 || vers < 0 || vers >= tous.length) return;
    e.preventDefault(); e.stopPropagation();
    const cle = tous[de].dataset.subId;
    if(fin) fin(de, vers);
    requestAnimationFrame(() => { const n = cle && document.querySelector(`[data-sub-id="${cle}"] ${poignee}`); if(n) n.focus(); });
  });
}
// Déplace un élément d'un tableau, en place.
export function deplacer(t, de, vers){ if(de === vers) return t; const [x] = t.splice(de, 1); t.splice(vers, 0, x); return t; }
