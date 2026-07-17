// Modul 4: sifferträning — lyssna→skriv, blixtvisning och tempoläge.
import { getSiffror, getKursplan, dagInfo, esc } from './data.js';
import { laddaTillstand, spara, sattChecklista } from './state.js';
import { spela, stoppa } from './audio.js';
import { talTillFranska, sammaFranska, rattSiffersvar } from './nummer.js';

let pass = null;

export function visaSiffror(el, nivaId) {
  if (!nivaId) return visaNivaval(el);
  const niva = getSiffror().nivaer.find(n => n.id === Number(nivaId));
  if (!niva) return visaNivaval(el);
  visaLagesval(el, niva);
}

function visaNivaval(el) {
  const t = laddaTillstand();
  const dagens = dagInfo(t.dag).siffror;
  el.innerHTML = `<h1>Sifferträning</h1><div id="nivalista"></div>`;
  const lista = el.querySelector('#nivalista');
  for (const n of getSiffror().nivaer) {
    const stats = t.siffror.stats[n.id];
    const rad = document.createElement('div');
    rad.className = 'panel klickbar';
    rad.innerHTML = `<strong>Nivå ${n.id}: ${esc(n.titel)}</strong>
      ${n.id === dagens ? '<span class="chip uttal-chip">dagens nivå</span>' : ''}
      <span class="under dampad" style="display:block">
        ${stats ? `${stats.ratt} rätt · ${stats.fel} fel` : 'inte tränad än'}
        ${stats && stats.tempoBasta ? ` · tempo-rekord: ${stats.tempoBasta} rätt/min` : ''}</span>`;
    rad.addEventListener('click', () => { location.hash = `#/siffror/${n.id}`; });
    lista.appendChild(rad);
  }
}

function visaLagesval(el, niva) {
  el.innerHTML = `<h1>Nivå ${niva.id}: ${esc(niva.titel)}</h1>
    <div class="panel">
      <p class="dampad">Välj läge:</p>
      <div class="knapp-rad" style="flex-direction:column">
        <button class="knapp" id="lage-lyssna">👂 Lyssna → skriv siffran</button>
        <button class="knapp" id="lage-blixt">⚡ Blixtvisning → skriv på franska</button>
        <button class="knapp" id="lage-tempo">⏱️ Tempoläge (60 sekunder)</button>
      </div>
      <p class="dampad"><a href="#/siffror">◀ Alla nivåer</a></p>
    </div>`;
  el.querySelector('#lage-lyssna').addEventListener('click', () => startaPass(el, niva, 'lyssna'));
  el.querySelector('#lage-blixt').addEventListener('click', () => startaPass(el, niva, 'blixt'));
  el.querySelector('#lage-tempo').addEventListener('click', () => startaPass(el, niva, 'tempo'));
}

function slumpa(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

function startaPass(el, niva, lage) {
  pass = {
    niva, lage, ratt: 0, fel: 0, tider: [],
    slut: lage === 'tempo' ? Date.now() + 60000 : null,
    antal: lage === 'tempo' ? Infinity : 10,
  };
  nastaFraga(el);
}

function nastaFraga(el) {
  stoppa();
  if (pass.slut && Date.now() >= pass.slut) return visaResultat(el);
  if (pass.ratt + pass.fel >= pass.antal) return visaResultat(el);
  const post = slumpa(pass.niva.poster);
  pass.fragaStart = Date.now();

  if (pass.lage === 'blixt') return visaBlixt(el, post);
  visaLyssna(el, post);
}

function huvudHtml(inre) {
  const kvar = pass.slut
    ? `⏱️ ${Math.max(0, Math.ceil((pass.slut - Date.now()) / 1000))} s`
    : `${pass.ratt + pass.fel + 1} av ${pass.antal}`;
  return `
    <div class="ko-rad">
      <span class="ratt">${pass.ratt} rätt</span><span>${kvar}</span><span class="fel">${pass.fel} fel</span>
    </div>
    <div class="panel">${inre}</div>`;
}

function visaLyssna(el, post) {
  el.innerHTML = huvudHtml(`
    <p class="centrerad"><button class="ljud-knapp stor" id="spela">🔊 Spela upp</button></p>
    <input class="svar-falt" id="svar" inputmode="${pass.niva.typ === 'klockslag' || pass.niva.typ === 'pris' ? 'text' : 'numeric'}"
      placeholder="${platshallare(pass.niva.typ)}" autocomplete="off">
    <div class="knapp-rad"><button class="knapp" id="ratta">Rätta</button></div>
    <p id="feedback"></p>`);
  const ljud = () => spela({ fil: `audio/${post.ljud}.mp3`, text: post.fr });
  el.querySelector('#spela').addEventListener('click', ljud);
  ljud();
  const falt = el.querySelector('#svar');
  falt.focus();
  const ratta = () => bedom(el, post, rattSiffersvar(falt.value, post.svar), `${post.visning} — ${post.fr}`);
  el.querySelector('#ratta').addEventListener('click', ratta);
  falt.addEventListener('keydown', e => { if (e.key === 'Enter') ratta(); });
}

function visaBlixt(el, post) {
  const t = laddaTillstand();
  const friText = pass.niva.typ === 'tal' || pass.niva.typ === 'artal';
  el.innerHTML = huvudHtml(`
    <div class="siffer-visning" id="blixt">${esc(post.visning)}</div>
    <div id="svarsdel" hidden>
      ${friText
        ? `<input class="svar-falt" id="svar" placeholder="skriv talet på franska" autocomplete="off">
           <div class="knapp-rad"><button class="knapp" id="ratta">Rätta</button></div>`
        : `<p class="dampad centrerad">Vilket är rätt på franska?</p><div class="val-lista" id="val"></div>`}
      <p id="feedback"></p>
    </div>`);
  setTimeout(() => {
    const blixt = el.querySelector('#blixt');
    if (!blixt) return;
    blixt.textContent = '···';
    const del = el.querySelector('#svarsdel');
    del.hidden = false;
    if (friText) {
      const falt = el.querySelector('#svar');
      falt.focus();
      const facit = post.fr;
      const ratta = () => bedom(el, post, sammaFranska(falt.value, facit), `${post.visning} = ${facit}`);
      el.querySelector('#ratta').addEventListener('click', ratta);
      falt.addEventListener('keydown', e => { if (e.key === 'Enter') ratta(); });
    } else {
      const val = el.querySelector('#val');
      const alternativ = [post];
      while (alternativ.length < Math.min(4, pass.niva.poster.length)) {
        const kandidat = slumpa(pass.niva.poster);
        if (!alternativ.some(a => a.fr === kandidat.fr)) alternativ.push(kandidat);
      }
      alternativ.sort(() => Math.random() - 0.5);
      for (const alt of alternativ) {
        const b = document.createElement('button');
        b.textContent = alt.fr;
        b.addEventListener('click', () => {
          b.classList.add(alt.fr === post.fr ? 'vald-ratt' : 'vald-fel');
          bedom(el, post, alt.fr === post.fr, `${post.visning} = ${post.fr}`);
        });
        val.appendChild(b);
      }
    }
  }, t.installningar.blixtMs);
}

function bedom(el, post, ratt, facit) {
  pass.tider.push(Date.now() - pass.fragaStart);
  if (ratt) pass.ratt += 1; else pass.fel += 1;
  const fb = el.querySelector('#feedback');
  if (fb) fb.innerHTML = ratt
    ? `<span class="ratt">✓ Rätt!</span> <span class="dampad">${esc(facit)}</span>`
    : `<span class="fel">✗ Fel.</span> ${esc(facit)}`;
  el.querySelectorAll('input,button:not(.ljud-knapp)').forEach(b => { b.disabled = true; });
  setTimeout(() => nastaFraga(el), ratt ? 900 : 2200);
}

function visaResultat(el) {
  const t = laddaTillstand();
  const stats = t.siffror.stats[pass.niva.id] || (t.siffror.stats[pass.niva.id] = { ratt: 0, fel: 0 });
  stats.ratt += pass.ratt;
  stats.fel += pass.fel;
  const totalt = pass.ratt + pass.fel;
  const procent = totalt ? Math.round(pass.ratt / totalt * 100) : 0;
  const snitt = pass.tider.length
    ? Math.round(pass.tider.reduce((a, b) => a + b, 0) / pass.tider.length / 100) / 10 : 0;
  let rekord = '';
  if (pass.lage === 'tempo' && pass.ratt > (stats.tempoBasta || 0)) {
    stats.tempoBasta = pass.ratt;
    rekord = '<p class="ratt">🏆 Nytt tempo-rekord!</p>';
  }
  spara();
  if (totalt >= 10 && pass.niva.id === dagInfo(t.dag).siffror) {
    sattChecklista(t.dag, 'siffror', true);
  }
  el.innerHTML = `<h1>Resultat</h1>
    <div class="stat-rad">
      <div class="panel"><span class="varde">${procent} %</span>rätt</div>
      <div class="panel"><span class="varde">${pass.ratt}/${totalt}</span>svar</div>
      <div class="panel"><span class="varde">${snitt} s</span>snittid</div>
    </div>
    ${rekord}
    <div class="knapp-rad">
      <button class="knapp" id="igen">En gång till</button>
      <a class="knapp sekundar" href="#/siffror/${pass.niva.id}">Byt läge</a>
      <a class="knapp sekundar" href="#/siffror">Nivåer</a>
    </div>`;
  el.querySelector('#igen').addEventListener('click', () => startaPass(el, pass.niva, pass.lage));
}

function platshallare(typ) {
  return { tal: 't.ex. 72', artal: 't.ex. 1984', pris: 't.ex. 12,50',
           telefon: 't.ex. 0612345678', klockslag: 't.ex. 15:30' }[typ] || '';
}
