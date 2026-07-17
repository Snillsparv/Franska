// Modul 1: ordkort med SRS. Framsida franska, baksida svenska + guldkorn.
import { ord, dagInfo, ljudFil, markeraOrd, esc, getUttal } from './data.js';
import { laddaTillstand, sattChecklista } from './state.js';
import { allaKort, nyttKort, betygsatt, forhandsvisa, byggKo, loggaSvar, BETYG } from './srs.js';
import { spela, stoppa } from './audio.js';

let session = null;
let chipLektioner = null;

async function laddaChips() {
  if (chipLektioner) return chipLektioner;
  const u = await getUttal();
  chipLektioner = (u.lektioner || [])
    .filter(l => l.chip && l.chip.monster)
    .map(l => ({ id: l.id, etikett: l.chip.etikett || l.titel, regex: nyRegex(l.chip.monster) }))
    .filter(l => l.regex);
  return chipLektioner;
}

function nyRegex(m) {
  try { return new RegExp(m, 'iu'); } catch { return null; }
}

export async function visaKort(el, dagParam) {
  const t = laddaTillstand();
  const dag = dagParam || t.dag;
  const info = dagInfo(dag);
  const ko = byggKo(dag, info.ordSlut);
  await laddaChips();

  session = {
    dag,
    kvar: [...ko.repetitioner.map(r => ({ rang: r, ny: false })),
           ...ko.nya.map(r => ({ rang: r, ny: true }))],
    omkorning: [],   // "igen"-kort som ska tillbaka
    sedanOmkorning: 0,
    gjorda: 0,
    start: Date.now(),
  };
  if (session.kvar.length === 0 && session.omkorning.length === 0) {
    el.innerHTML = `<h1>Ordkort</h1>
      <div class="panel centrerad">
        <p class="stor">🎉</p>
        <p>Inget att repetera just nu, och dagens nya kort är klara.</p>
        <p class="dampad">Kom tillbaka i morgon — eller höj dagens dos i inställningarna.</p>
        <a class="knapp" href="#/">Till dashboarden</a>
      </div>`;
    return;
  }
  nastaKort(el);
}

function taNasta() {
  // varva in omkörningar efter ett tag, eller när ordinarie kön är slut
  if (session.omkorning.length &&
      (session.sedanOmkorning >= 8 || session.kvar.length === 0)) {
    session.sedanOmkorning = 0;
    return session.omkorning.shift();
  }
  if (session.kvar.length) {
    session.sedanOmkorning += 1;
    return session.kvar.shift();
  }
  return null;
}

function nastaKort(el) {
  stoppa();
  const post = taNasta();
  if (!post) return visaSlut(el);
  const o = ord(post.rang);
  const kvarTotal = session.kvar.length + session.omkorning.length;
  const t = laddaTillstand();

  el.innerHTML = `
    <div class="ko-rad">
      <span>${session.gjorda} klara</span>
      <span>${post.ny ? '🆕 nytt kort' : '🔁 repetition'}</span>
      <span>${kvarTotal} kvar</span>
    </div>
    <div class="flash" id="flash">
      <div class="ordet">${esc(o.franska)}</div>
      <div class="meningen fransk">${markeraOrd(o)}</div>
      <div class="knapp-rad" style="justify-content:center">
        <button class="ljud-knapp" id="ljud-ord">🔊 ordet</button>
        <button class="ljud-knapp" id="ljud-mening">🔊 meningen</button>
      </div>
      <div id="baksida"></div>
    </div>
    <button class="knapp brett" id="visa">Visa svar <span class="dampad">(mellanslag)</span></button>
    <div class="betyg-rad" id="betyg" hidden></div>`;

  const ljudOrd = () => spela({ fil: ljudFil('ord', o.rang), text: o.franska });
  el.querySelector('#ljud-ord').addEventListener('click', ljudOrd);
  el.querySelector('#ljud-mening').addEventListener('click',
    () => spela({ fil: ljudFil('mening', o.rang), text: o.meningFr }));
  if (t.installningar.autoLjud) ljudOrd();

  const visaKnapp = el.querySelector('#visa');
  const betygRad = el.querySelector('#betyg');

  const visaSvar = () => {
    visaKnapp.hidden = true;
    el.querySelector('#baksida').innerHTML = baksidaHtml(o);
    kopplaChips(el, o);
    betygRad.hidden = false;
    const kort = allaKort()[o.rang] || nyttKort(o.rang, session.dag);
    const forh = forhandsvisa(kort);
    betygRad.innerHTML = `
      <button class="knapp betyg-igen" data-betyg="${BETYG.IGEN}">Igen<small>${forh.IGEN}</small></button>
      <button class="knapp betyg-svart" data-betyg="${BETYG.SVART}">Svårt<small>${forh.SVART}</small></button>
      <button class="knapp betyg-bra" data-betyg="${BETYG.BRA}">Bra<small>${forh.BRA}</small></button>
      <button class="knapp betyg-latt" data-betyg="${BETYG.LATT}">Lätt<small>${forh.LATT}</small></button>`;
    betygRad.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => svara(el, o, post, Number(b.dataset.betyg))));
  };
  visaKnapp.addEventListener('click', visaSvar);

  el.onkeydown = e => {
    if (e.key === ' ' && !visaKnapp.hidden) { e.preventDefault(); visaSvar(); }
    else if (!betygRad.hidden && ['1', '2', '3', '4'].includes(e.key)) {
      const betyg = [BETYG.IGEN, BETYG.SVART, BETYG.BRA, BETYG.LATT][Number(e.key) - 1];
      svara(el, o, post, betyg);
    }
  };
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
}

function svara(el, o, post, betyg) {
  const t = laddaTillstand();
  const kort = t.srs.kort[o.rang] || (t.srs.kort[o.rang] = nyttKort(o.rang, session.dag));
  betygsatt(kort, betyg);
  loggaSvar(post.ny);
  session.gjorda += 1;
  if (betyg < 3) session.omkorning.push({ rang: post.rang, ny: false });
  nastaKort(el);
}

function baksidaHtml(o) {
  const genus = o.genus ? ` <span class="chip">${esc(o.genus)}</span>` : '';
  const taggar = (o.taggar || []).filter(t => t !== 'UTTAL')
    .map(t => `<span class="chip tagg-${t.replace(/[^A-Z]/g, '')}">${esc(t)}</span>`).join('');
  let info = '';
  if (o.uttal) info += `<p>🗣️ <strong>Uttal:</strong> ${esc(o.uttal)}</p>`;
  if (o.bonusord) info += `<p>➕ <strong>Bonus:</strong> ${esc(o.bonusord)}</p>`;
  if (o.notering) info += `<p>💡 ${esc(o.notering)}</p>`;
  return `
    <div class="oversattning">${esc(o.svenska)}</div>
    <div class="dampad">${esc(o.ordklass)}${genus} ${taggar}
      <span class="chip">rang ${o.rang}</span><span id="regelchips"></span></div>
    <div class="meningen dampad">${esc(o.meningSv)}</div>
    ${info ? `<div class="info">${info}</div>` : ''}`;
}

function kopplaChips(el, o) {
  const plats = el.querySelector('#regelchips');
  if (!plats || !chipLektioner) return;
  const former = o.franska.split(' / ').map(f => f.trim());
  for (const lek of chipLektioner) {
    if (former.some(f => lek.regex.test(f))) {
      const a = document.createElement('a');
      a.className = 'chip uttal-chip';
      a.href = `#/uttal/${lek.id}`;
      a.textContent = `🔗 ${lek.etikett}`;
      plats.appendChild(a);
    }
  }
}

function visaSlut(el) {
  const min = Math.round((Date.now() - session.start) / 60000);
  sattChecklista(session.dag, 'ord', true);
  el.innerHTML = `<h1>Ordkort</h1>
    <div class="panel centrerad">
      <p class="stor">✅</p>
      <p><strong>${session.gjorda} kort</strong> på ${min || '<1'} min — dagens ordpass är klart!</p>
      <a class="knapp" href="#/">Till dashboarden</a>
    </div>`;
  el.onkeydown = null;
}
