// SM-2 (samma grund som Anki): intervall och ease factor per kort.
// Kortdata: { ef, reps, iv (dagar), due "ÅÅÅÅ-MM-DD", introDag, misslyckanden }
import { laddaTillstand, spara, idagISO } from './state.js';

export const BETYG = { IGEN: 1, SVART: 3, BRA: 4, LATT: 5 };

export function allaKort() {
  return laddaTillstand().srs.kort;
}

export function nyttKort(rang, dag) {
  return { ef: 2.5, reps: 0, iv: 0, due: idagISO(), introDag: dag, miss: 0 };
}

function laggTillDagar(iso, dagar) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dagar);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Uppdaterar kortet enligt SM-2 och returnerar det. Muterar och sparar.
export function betygsatt(kort, betyg) {
  const idag = idagISO();
  if (betyg < 3) {
    kort.reps = 0;
    kort.iv = 0;
    kort.due = idag;      // tillbaka i dagens kö
    kort.miss = (kort.miss || 0) + 1;
  } else {
    if (kort.reps === 0) kort.iv = betyg === BETYG.LATT ? 4 : 1;
    else if (kort.reps === 1) kort.iv = 6;
    else kort.iv = Math.round(kort.iv * kort.ef);
    kort.reps += 1;
    kort.ef = Math.max(1.3, kort.ef + 0.1 - (5 - betyg) * (0.08 + (5 - betyg) * 0.02));
    kort.due = laggTillDagar(idag, kort.iv);
  }
  spara();
  return kort;
}

// Förhandsvisning av nästa intervall per betyg, för knapptexterna.
export function forhandsvisa(kort) {
  const res = {};
  for (const [namn, betyg] of Object.entries(BETYG)) {
    if (betyg < 3) { res[namn] = '<10 min'; continue; }
    let iv;
    if (kort.reps === 0) iv = betyg === BETYG.LATT ? 4 : 1;
    else if (kort.reps === 1) iv = 6;
    else iv = Math.round(kort.iv * kort.ef);
    res[namn] = iv >= 30 ? `${Math.round(iv / 30 * 10) / 10} mån` : `${iv} d`;
  }
  return res;
}

// Dagens kö för kursdag `dag`: repetitioner (due ≤ idag) + nya kort (rang ≤ dagSlut
// som ännu inte introducerats), enligt inställningarna.
export function byggKo(dag, dagSlut) {
  const t = laddaTillstand();
  const idag = idagISO();
  const inst = t.installningar;
  const kort = t.srs.kort;

  let repetitioner = Object.entries(kort)
    .filter(([, k]) => k.due <= idag && k.reps > 0)
    .map(([rang]) => Number(rang))
    .sort((a, b) => (kort[a].due < kort[b].due ? -1 : kort[a].due > kort[b].due ? 1 : a - b));
  if (inst.maxRep > 0) repetitioner = repetitioner.slice(0, inst.maxRep);

  // kort som introducerats men aldrig klarats (reps 0, t.ex. "igen" i går)
  const omstart = Object.entries(kort)
    .filter(([, k]) => k.due <= idag && k.reps === 0)
    .map(([rang]) => Number(rang))
    .sort((a, b) => a - b);

  let nya = [];
  if (!inst.pausaNya) {
    for (let r = 1; r <= dagSlut && nya.length < inst.maxNya; r++) {
      if (!kort[r]) nya.push(r);
    }
  }
  return { repetitioner: [...repetitioner, ...omstart], nya };
}

export function loggaSvar(nyttKortP) {
  const t = laddaTillstand();
  const idag = idagISO();
  const rad = t.srs.logg[idag] || (t.srs.logg[idag] = { nya: 0, rep: 0 });
  if (nyttKortP) rad.nya += 1; else rad.rep += 1;
  spara();
}

export function statistik() {
  const t = laddaTillstand();
  const kort = Object.values(t.srs.kort);
  const idag = idagISO();
  return {
    totalt: kort.length,
    mogna: kort.filter(k => k.iv >= 21).length,
    unga: kort.filter(k => k.reps > 0 && k.iv < 21).length,
    dueNu: kort.filter(k => k.due <= idag).length,
    idagLogg: t.srs.logg[idag] || { nya: 0, rep: 0 },
  };
}
