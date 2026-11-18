// Dates, périodes et formats français.
export const pad = n => String(n).padStart(2,'0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const sod = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
export const eod = d => { const x = new Date(d); x.setHours(23,59,0,0); return x; };
export const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
export const monday = d => { const x = sod(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; };
export const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const y0 = new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/864e5+1)/7); };
export const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
export const MOIS_C = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
export const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
export const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
export const dShort = d => `${d.getDate()} ${MOIS_C[d.getMonth()]}`;
export const dLong = d => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
export const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const toLocalInput = iso => { if(!iso) return ''; const d = new Date(iso); return `${ymd(d)}T${hm(d)}`; };

export function period(list, now = new Date()){
  const y = now.getFullYear(), m = now.getMonth();
  if(list === 'day'){
    return { key: ymd(now), start: sod(now), end: eod(now), sub: cap(dLong(now)), name: "Aujourd'hui" };
  }
  if(list === 'week'){
    const s = monday(now), e = eod(addDays(s,6));
    return { key: ymd(s), start: s, end: e, sub: `Semaine ${isoWeek(now)} · ${dShort(s)} → ${dShort(e)}`, name: 'Cette semaine' };
  }
  if(list === 'month'){
    const s = new Date(y,m,1), e = eod(new Date(y,m+1,0));
    return { key: `${y}-${pad(m+1)}`, start: s, end: e, sub: `${cap(MOIS[m])} ${y}`, name: 'Ce mois-ci' };
  }
  if(list === 'quarter'){
    const q = Math.floor(m/3), s = new Date(y,q*3,1), e = eod(new Date(y,q*3+3,0));
    return { key: `${y}-Q${q+1}`, start: s, end: e, sub: `T${q+1} ${y} · ${MOIS[q*3]} → ${MOIS[q*3+2]}`, name: 'Ce trimestre' };
  }
  return null;
}
export function periodFromKey(list, key){
  if(list === 'day' || list === 'week'){ const [y,m,d] = key.split('-').map(Number); return period(list, new Date(y,m-1,d,12)); }
  if(list === 'month'){ const [y,m] = key.split('-').map(Number); return period(list, new Date(y,m-1,15)); }
  if(list === 'quarter'){ const [y,q] = key.split('-Q').map(Number); return period(list, new Date(y,(q-1)*3+1,15)); }
  return null;
}
export function fmtLeft(ms){
  const late = ms < 0; ms = Math.abs(ms);
  const min = Math.round(ms/6e4), h = Math.floor(min/60), d = Math.floor(h/24);
  let s;
  if(min < 60) s = `${Math.max(min,1)} min`;
  else if(h < 24) s = `${h} h${min%60 ? ' '+pad(min%60) : ''}`;
  else if(d < 7) s = `${d} j${h%24 ? ' '+(h%24)+' h' : ''}`;
  else s = `${d} j`;
  return late ? `En retard · ${s}` : s;
}
