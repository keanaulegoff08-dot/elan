import { S } from './store.js';

let AC = null;
export function playChime(){
  if(S.settings.sound === false) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime + 0.01;
    [783.99, 987.77, 1174.66].forEach((f,i) => {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f;
      const st = t0 + i*0.16;
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.14, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
      o.connect(g); g.connect(AC.destination); o.start(st); o.stop(st + 1.2);
    });
  }catch(e){}
}

export function playCheck(urgent){
  if(S.settings.sound === false) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime + 0.005;
    const out = AC.createGain(); out.gain.value = 0.55;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    out.connect(lp); lp.connect(AC.destination);
    // 1. le « pop » : une goutte qui remonte
    const o1 = AC.createOscillator(), g1 = AC.createGain();
    o1.type = 'sine'; o1.frequency.setValueAtTime(420, t0); o1.frequency.exponentialRampToValueAtTime(880, t0 + 0.07);
    g1.gain.setValueAtTime(0.0001, t0); g1.gain.exponentialRampToValueAtTime(0.35, t0 + 0.008); g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o1.connect(g1); g1.connect(out); o1.start(t0); o1.stop(t0 + 0.18);
    // 2. la note claire qui résonne
    const notes = urgent ? [1318.5, 1760] : [1318.5];
    notes.forEach((f, i) => {
      const st = t0 + 0.075 + i*0.085;
      [1, 2.01].forEach((h, k) => {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = 'sine'; o.frequency.value = f*h;
        const pk = k ? 0.035 : 0.16;
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(pk, st + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, st + (k ? 0.25 : 0.55));
        o.connect(g); g.connect(out); o.start(st); o.stop(st + 0.6);
      });
    });
  }catch(e){}
}
