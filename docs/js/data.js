// Laddar och indexerar kursdata (JSON genererad av scripts/build_data.py).
let ordLista = null;
let ordPerRang = null;
let kursplan = null;
let siffror = null;
let uttal = null;      // laddas vid behov
let grammatik = null;  // laddas vid behov
const monologer = new Map();

async function hamtaJson(sokvag) {
  const svar = await fetch(sokvag);
  if (!svar.ok) throw new Error(`${sokvag}: ${svar.status}`);
  return svar.json();
}

export async function initData() {
  [ordLista, kursplan, siffror] = await Promise.all([
    hamtaJson('data/ord.json'),
    hamtaJson('data/kursplan.json'),
    hamtaJson('data/siffror.json'),
  ]);
  ordPerRang = new Map(ordLista.map(o => [o.rang, o]));
}

export function allaOrd() { return ordLista; }
export function ord(rang) { return ordPerRang.get(rang); }
export function getKursplan() { return kursplan; }
export function dagInfo(dag) { return kursplan.dagar[dag - 1]; }
export function getSiffror() { return siffror; }

export async function getUttal() {
  if (!uttal) {
    try { uttal = await hamtaJson('data/uttal.json'); }
    catch { uttal = { lektioner: [] }; }
  }
  return uttal;
}

export async function getGrammatik() {
  if (!grammatik) {
    try { grammatik = await hamtaJson('data/grammatik.json'); }
    catch { grammatik = { kapitel: [] }; }
  }
  return grammatik;
}

export async function getMonolog(dag) {
  if (!monologer.has(dag)) {
    const nr = String(dag).padStart(2, '0');
    try { monologer.set(dag, await hamtaJson(`data/monolog/dag_${nr}.json`)); }
    catch { monologer.set(dag, null); }
  }
  return monologer.get(dag);
}

// Index: ordform (gemener) → rang, för monolog-tooltips.
// Fält som "le / la / les" delas upp i sina former.
let formIndex = null;
export function slaUppForm(form) {
  if (!formIndex) {
    formIndex = new Map();
    for (const o of ordLista) {
      for (const del of o.franska.toLowerCase().split(' / ')) {
        const f = del.trim();
        if (f && !formIndex.has(f)) formIndex.set(f, o.rang);
      }
    }
  }
  return formIndex.get(form.toLowerCase());
}

// Filnamn för ljudklipp, t.ex. audio/ord_0001.mp3
export function ljudFil(typ, rang) {
  return `audio/${typ}_${String(rang).padStart(4, '0')}.mp3`;
}

// Markera ordet i exempelmeningen med <mark>. Returnerar HTML-säker sträng.
export function markeraOrd(o) {
  const mening = o.meningFr;
  const former = o.franska.split(' / ').map(f => f.trim()).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const lc = mening.toLowerCase();
  for (const form of former) {
    const i = hittaForm(lc, form.toLowerCase());
    if (i >= 0) {
      return esc(mening.slice(0, i)) + '<mark>' + esc(mening.slice(i, i + form.length)) +
        '</mark>' + esc(mening.slice(i + form.length));
    }
  }
  return esc(mening);
}

function hittaForm(lcMening, lcForm) {
  let fran = 0;
  while (true) {
    const i = lcMening.indexOf(lcForm, fran);
    if (i < 0) return -1;
    const fore = i === 0 ? '' : lcMening[i - 1];
    const efter = lcMening[i + lcForm.length] ?? '';
    if (!arBokstav(fore) && !arBokstav(efter)) return i;
    fran = i + 1;
  }
}

function arBokstav(c) {
  return c !== '' && /\p{L}/u.test(c);
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
