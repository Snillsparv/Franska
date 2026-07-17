// Modul 5: daglig monolog — svensk text, facit med klickbara ord, ljud.
import { getMonolog, ord, slaUppForm, esc } from './data.js';
import { laddaTillstand, spara, sattChecklista } from './state.js';
import { spela } from './audio.js';

const ELISIONER = {
  "j'": 'je', "l'": 'le', "d'": 'de', "n'": 'ne', "qu'": 'que',
  "c'": 'ce', "s'": 'se', "m'": 'me', "t'": 'te',
};

export async function visaMonolog(el, dagParam) {
  const t = laddaTillstand();
  const dag = Number(dagParam) || t.dag;
  const m = await getMonolog(dag);
  const nav = `<div class="dag-nav" style="margin:8px 0">
    ${dag > 1 ? `<a class="knapp sekundar liten" href="#/monolog/${dag - 1}">◀ Dag ${dag - 1}</a>` : ''}
    ${dag < 30 ? `<a class="knapp sekundar liten" href="#/monolog/${dag + 1}">Dag ${dag + 1} ▶</a>` : ''}
  </div>`;

  if (!m) {
    el.innerHTML = `<h1>Monolog · dag ${dag}</h1>${nav}
      <div class="panel"><p>Monologen för dag ${dag} är inte skriven än.</p></div>`;
    return;
  }

  el.innerHTML = `<h1>Monolog · dag ${dag}</h1>
    <h2 style="margin-top:0" class="dampad">${esc(m.titel || '')}</h2>${nav}
    <div class="panel">
      <p class="dampad">Översätt muntligt eller skriftligt till franska — klicka sedan fram facit.</p>
      <div id="svensk-text">${stycken(m.svenska)}</div>
    </div>
    <button class="knapp brett" id="visa-facit">Visa facit på franska</button>
    <div id="facit" hidden>
      <div class="panel">
        <p><button class="ljud-knapp" id="ljud">🔊 Lyssna på monologen</button></p>
        <div class="monolog-fr fransk" id="fransk-text"></div>
        <p class="dampad" style="font-size:.8rem">Klicka på ett ord för betydelse, rang och ordklass.</p>
      </div>
      <button class="knapp brett" id="klar">Markera dagens monolog som klar ✓</button>
    </div>`;

  el.querySelector('#visa-facit').addEventListener('click', () => {
    el.querySelector('#visa-facit').hidden = true;
    const facit = el.querySelector('#facit');
    facit.hidden = false;
    renderaFranska(el.querySelector('#fransk-text'), m);
  });

  el.querySelector('#ljud').addEventListener('click', () =>
    spela({ fil: `audio/monolog_${String(dag).padStart(2, '0')}.mp3`, text: m.franska }));

  el.querySelector('#klar').addEventListener('click', () => {
    const t2 = laddaTillstand();
    t2.monolog.klara[dag] = true;
    spara();
    sattChecklista(dag, 'monolog', true);
    location.hash = '#/';
  });
}

function stycken(text) {
  return text.split(/\n\n+/).map(s => `<p>${esc(s.trim())}</p>`).join('');
}

function renderaFranska(el, m) {
  const lemma = m.lemma || {};
  const fria = new Set((m.friaOrd || []).map(x => x.toLowerCase()));
  el.innerHTML = '';
  for (const styckeText of m.franska.split(/\n\n+/)) {
    const p = document.createElement('p');
    // dela i ord (inkl. apostrof-delar) och övrigt
    for (const del of styckeText.split(/([\p{L}\p{M}'’-]+)/u)) {
      if (!del) continue;
      if (/[\p{L}\p{M}]/u.test(del)) {
        const span = document.createElement('span');
        span.className = 'tok';
        span.textContent = del;
        span.addEventListener('click', e => visaTooltip(e, del, lemma, fria));
        p.appendChild(span);
      } else {
        p.appendChild(document.createTextNode(del));
      }
    }
    el.appendChild(p);
  }
}

function slaUppToken(token, lemma, fria) {
  const ren = token.toLowerCase().replace(/’/g, "'");
  if (fria.has(ren)) return { fri: true };
  const kandidater = [ren];
  // "j'ai" → prova hela, sedan delarna
  const apostrof = ren.match(/^([\p{L}]+')(.+)$/u);
  if (apostrof) kandidater.push(apostrof[1], apostrof[2]);
  for (const k of kandidater) {
    if (k in lemma) { const o = ord(lemma[k]); if (o) return { ord: o }; }
    const viaForm = slaUppForm(k);
    if (viaForm) return { ord: ord(viaForm) };
    if (k in ELISIONER) {
      const viaElision = slaUppForm(ELISIONER[k]);
      if (viaElision) return { ord: ord(viaElision) };
    }
  }
  return null;
}

let tooltipEl = null;

function visaTooltip(handelse, token, lemma, fria) {
  stangTooltip();
  const traff = slaUppToken(token, lemma, fria);
  const div = document.createElement('div');
  div.className = 'tooltip';
  if (traff?.ord) {
    const o = traff.ord;
    div.innerHTML = `<strong>${esc(o.franska)}</strong> — ${esc(o.svenska)}<br>
      <span class="dampad">${esc(o.ordklass)}${o.genus ? ` (${esc(o.genus)})` : ''} · rang ${o.rang}</span>`;
  } else if (traff?.fri) {
    div.innerHTML = `<strong>${esc(token)}</strong><br><span class="dampad">namn eller internationellt ord</span>`;
  } else {
    div.innerHTML = `<strong>${esc(token)}</strong><br><span class="dampad">okänd form</span>`;
  }
  document.body.appendChild(div);
  tooltipEl = div;
  const r = handelse.target.getBoundingClientRect();
  const bredd = div.offsetWidth;
  div.style.left = Math.max(8, Math.min(window.innerWidth - bredd - 8, r.left)) + 'px';
  div.style.top = (r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', stangTooltip, { once: true }), 0);
}

function stangTooltip() {
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}
