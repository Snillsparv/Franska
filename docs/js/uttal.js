// Modul 3: uttalsregler — lektionslista, teori, exempelord med ljud, självtest.
import { getUttal, getKursplan, ord, ljudFil, esc } from './data.js';
import { laddaTillstand, spara, sattChecklista, checklista } from './state.js';
import { spela } from './audio.js';

export async function visaUttal(el, lektionId) {
  const u = await getUttal();
  if (!lektionId) return visaLista(el, u);
  const lek = (u.lektioner || []).find(l => l.id === Number(lektionId));
  if (!lek) {
    el.innerHTML = `<h1>Uttal</h1><div class="panel"><p>Lektion ${esc(lektionId)} finns inte än.</p>
      <a class="knapp sekundar" href="#/uttal">Alla lektioner</a></div>`;
    return;
  }
  visaLektion(el, lek);
}

function visaLista(el, u) {
  const t = laddaTillstand();
  const kp = getKursplan();
  const dagFor = {};
  for (const d of kp.dagar) if (d.uttal) dagFor[d.uttal] = d.dag;
  el.innerHTML = `<h1>Uttalsregler</h1><div id="lista"></div>`;
  const lista = el.querySelector('#lista');
  for (const info of kp.uttalLektioner) {
    const lek = (u.lektioner || []).find(l => l.id === info.id);
    const klar = t.uttal.klara[info.id];
    const rad = document.createElement('div');
    rad.className = 'panel' + (lek ? ' klickbar' : '');
    rad.innerHTML = `<strong>${info.id}. ${esc(info.titel)}</strong>
      ${klar ? '<span class="chip" style="color:var(--gron)">✓ klar</span>' : ''}
      <span class="under dampad" style="display:block">Dag ${dagFor[info.id] || '–'}${lek ? '' : ' · kommer snart'}</span>`;
    if (lek) rad.addEventListener('click', () => { location.hash = `#/uttal/${info.id}`; });
    lista.appendChild(rad);
  }
}

function visaLektion(el, lek) {
  const exempel = (lek.exempel || []).map(e => {
    const o = ord(e.rang);
    if (!o) return '';
    return `<button class="ljud-knapp exempel-ord" data-rang="${o.rang}" data-text="${esc(o.franska)}">
      🔊 ${esc(o.franska)}</button> <span class="dampad">${esc(o.svenska)}${e.fokus ? ` · ${esc(e.fokus)}` : ''}</span><br>`;
  }).join('');

  el.innerHTML = `<h1>${lek.id}. ${esc(lek.titel)}</h1>
    <div class="panel">${lek.teori}</div>
    ${exempel ? `<h2>Exempel ur ordlistan</h2><div class="panel" style="line-height:2.2">${exempel}</div>` : ''}
    ${(lek.sjalvtest || []).length ? `<div id="test-plats"><button class="knapp brett" id="starta-test">Starta självtestet (${lek.sjalvtest.length} frågor)</button></div>` : ''}
    <p><a href="#/uttal">◀ Alla lektioner</a></p>`;

  el.querySelectorAll('.exempel-ord').forEach(b =>
    b.addEventListener('click', () =>
      spela({ fil: ljudFil('ord', Number(b.dataset.rang)), text: b.dataset.text })));

  const start = el.querySelector('#starta-test');
  if (start) start.addEventListener('click', () =>
    korTest(el.querySelector('#test-plats'), lek, 0, 0));
}

function korTest(plats, lek, index, ratta) {
  if (index >= lek.sjalvtest.length) {
    const t = laddaTillstand();
    const godkand = ratta >= Math.ceil(lek.sjalvtest.length * 0.7);
    if (godkand) {
      t.uttal.klara[lek.id] = true;
      spara();
      const kp = getKursplan();
      const dag = kp.dagar.find(d => d.uttal === lek.id);
      if (dag) sattChecklista(dag.dag, 'uttal', true);
    }
    plats.innerHTML = `<div class="panel centrerad">
      <p class="stor">${godkand ? '✅' : '🔁'}</p>
      <p><strong>${ratta} av ${lek.sjalvtest.length} rätt.</strong>
      ${godkand ? 'Lektionen är avklarad!' : 'Läs regeln igen och gör om testet.'}</p>
      <button class="knapp sekundar" id="om">Gör om testet</button></div>`;
    plats.querySelector('#om').addEventListener('click', () => korTest(plats, lek, 0, 0));
    return;
  }
  const fraga = lek.sjalvtest[index];
  const o = fraga.rang ? ord(fraga.rang) : null;
  plats.innerHTML = `<div class="panel">
    <p class="dampad">Fråga ${index + 1} av ${lek.sjalvtest.length} · ${ratta} rätt</p>
    <p><strong>${esc(fraga.fraga || 'Lyssna — vad hör du?')}</strong></p>
    ${o || fraga.ljudText ? `<p class="centrerad"><button class="ljud-knapp" id="spela">🔊 Spela upp</button></p>` : ''}
    <div class="val-lista" id="val"></div>
    <p id="fb"></p></div>`;

  const spelaKnapp = plats.querySelector('#spela');
  if (spelaKnapp) {
    const alternativ = o
      ? { fil: ljudFil('ord', o.rang), text: o.franska }
      : { text: fraga.ljudText };
    spelaKnapp.addEventListener('click', () => spela(alternativ));
    spela(alternativ);
  }

  const val = plats.querySelector('#val');
  for (const alt of fraga.alternativ) {
    const b = document.createElement('button');
    b.textContent = alt;
    b.addEventListener('click', () => {
      const ratt = alt === fraga.ratt;
      b.classList.add(ratt ? 'vald-ratt' : 'vald-fel');
      val.querySelectorAll('button').forEach(x => { x.disabled = true; });
      const fb = plats.querySelector('#fb');
      fb.innerHTML = ratt
        ? `<span class="ratt">✓ Rätt!</span> ${fraga.forklaring ? esc(fraga.forklaring) : ''}`
        : `<span class="fel">✗ Rätt svar: ${esc(fraga.ratt)}.</span> ${fraga.forklaring ? esc(fraga.forklaring) : ''}`;
      setTimeout(() => korTest(plats, lek, index + 1, ratta + (ratt ? 1 : 0)), ratt ? 1100 : 2600);
    });
    val.appendChild(b);
  }
}
