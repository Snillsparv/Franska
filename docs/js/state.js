// All framsteg i localStorage under en nyckel, med export/import som JSON-fil.
const NYCKEL = 'franska-v1';

const STANDARD = {
  version: 1,
  dag: 1,
  checklista: {},     // { "12": { ord:true, uttal:true, siffror:true, monolog:true, grammatik:true } }
  srs: { kort: {}, logg: {} },
  siffror: { stats: {} },   // { "1": { ratt, fel, tempoBasta } }
  uttal: { klara: {} },     // { "3": true }
  grammatik: { kapitel: {} }, // { "5": { ratt, fel, klar } }
  monolog: { klara: {} },
  installningar: {
    maxNya: 100,
    maxRep: 0,          // 0 = obegränsat
    pausaNya: false,
    autoLjud: true,
    talsyntesFallback: true,
    blixtMs: 1500,
  },
};

let tillstand = null;

export function laddaTillstand() {
  if (tillstand) return tillstand;
  try {
    const rått = localStorage.getItem(NYCKEL);
    tillstand = rått ? sammanfoga(strukturKopia(STANDARD), JSON.parse(rått)) : strukturKopia(STANDARD);
  } catch {
    tillstand = strukturKopia(STANDARD);
  }
  return tillstand;
}

function strukturKopia(o) { return JSON.parse(JSON.stringify(o)); }

function sammanfoga(bas, over) {
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && bas[k] && typeof bas[k] === 'object') {
      sammanfoga(bas[k], v);
    } else {
      bas[k] = v;
    }
  }
  return bas;
}

export function spara() {
  try {
    localStorage.setItem(NYCKEL, JSON.stringify(tillstand));
  } catch (e) {
    console.error('kunde inte spara', e);
  }
}

export function checklista(dag) {
  const t = laddaTillstand();
  return t.checklista[dag] || (t.checklista[dag] = {});
}

export function sattChecklista(dag, del, varde) {
  checklista(dag)[del] = varde;
  spara();
}

export function idagISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function exporteraFil() {
  const t = laddaTillstand();
  const blob = new Blob([JSON.stringify(t, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `franska-backup-${idagISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function importeraText(text) {
  const data = JSON.parse(text);
  if (typeof data !== 'object' || !data.srs) throw new Error('Filen ser inte ut som en Franska 3000-backup.');
  tillstand = sammanfoga(strukturKopia(STANDARD), data);
  spara();
}

export function nollstall() {
  tillstand = strukturKopia(STANDARD);
  spara();
}
