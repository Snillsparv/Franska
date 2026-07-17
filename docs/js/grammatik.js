// Modul 6: grammatik — teori + övningar genererade ur kursens exempelmeningar.
// Övningstyper: lucka (flerval/fritext), val, ordfoljd (pussel), oversatt.
import { getGrammatik, getKursplan, ord, esc } from './data.js';
import { laddaTillstand, spara, sattChecklista } from './state.js';

export async function visaGrammatik(el, kapitelId) {
  const g = await getGrammatik();
  if (!kapitelId) return visaLista(el, g);
  const kap = (g.kapitel || []).find(k => k.id === Number(kapitelId));
  if (!kap) {
    el.innerHTML = `<h1>Grammatik</h1><div class="panel"><p>Kapitel ${esc(kapitelId)} finns inte än.</p>
      <a class="knapp sekundar" href="#/grammatik">Alla kapitel</a></div>`;
    return;
  }
  visaKapitel(el, kap);
}

function visaLista(el, g) {
  const t = laddaTillstand();
  const kp = getKursplan();
  el.innerHTML = `<h1>Grammatik</h1><div id="lista"></div>`;
  const lista = el.querySelector('#lista');
  for (const info of kp.grammatikKapitel) {
    const kap = (g.kapitel || []).find(k => k.id === info.id);
    const st = t.grammatik.kapitel[info.id];
    const rad = document.createElement('div');
    rad.className = 'panel' + (kap ? ' klickbar' : '');
    rad.innerHTML = `<strong>${info.id}. ${esc(info.titel)}</strong>
      ${st?.klar ? '<span class="chip" style="color:var(--gron)">✓ klar</span>' : ''}
      <span class="under dampad" style="display:block">Dag ${info.id}${kap ? ` · ${kap.ovningar.length} övningar` : ' · kommer snart'}</span>`;
    if (kap) rad.addEventListener('click', () => { location.hash = `#/grammatik/${info.id}`; });
    lista.appendChild(rad);
  }
}

function visaKapitel(el, kap) {
  el.innerHTML = `<h1>${kap.id}. ${esc(kap.titel)}</h1>
    <div class="panel">${kap.teori}</div>
    <div id="ovningsplats">
      <button class="knapp brett" id="starta">Starta övningarna (${kap.ovningar.length} st)</button>
    </div>
    <p><a href="#/grammatik">◀ Alla kapitel</a></p>`;
  el.querySelector('#starta').addEventListener('click', () =>
    korOvning(el.querySelector('#ovningsplats'), kap, 0, 0));
}

function korOvning(plats, kap, index, ratta) {
  if (index >= kap.ovningar.length) return visaSammanfattning(plats, kap, ratta);
  const ov = kap.ovningar[index];
  const huvud = `<p class="dampad">Övning ${index + 1} av ${kap.ovningar.length} · ${ratta} rätt</p>`;
  const vidare = ratt => setTimeout(
    () => korOvning(plats, kap, index + 1, ratta + (ratt ? 1 : 0)), ratt ? 1100 : 3000);

  if (ov.typ === 'ordfoljd') return visaOrdfoljd(plats, ov, huvud, vidare);
  if (ov.typ === 'oversatt') return visaOversatt(plats, ov, huvud, vidare);
  visaLuckaEllerVal(plats, ov, huvud, vidare);
}

function facitHtml(ov, ratt, svarText) {
  const forklaring = ov.forklaring ? ` <span class="dampad">${esc(ov.forklaring)}</span>` : '';
  const kalla = ov.rang ? kallaHtml(ov.rang) : '';
  return (ratt
    ? `<span class="ratt">✓ Rätt!</span>${forklaring}`
    : `<span class="fel">✗ Rätt svar: ${esc(svarText)}.</span>${forklaring}`) + kalla;
}

function kallaHtml(rang) {
  const o = ord(rang);
  if (!o) return '';
  return `<br><span class="dampad" style="font-size:.8rem">Ur meningen för <em>${esc(o.franska)}</em> (rang ${o.rang}): «${esc(o.meningFr)}» — ${esc(o.meningSv)}</span>`;
}

function normalisera(s) {
  return s.toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ')
    .replace(/\s+([?!.,;:])/g, '$1').trim();
}

function visaLuckaEllerVal(plats, ov, huvud, vidare) {
  const flerval = Array.isArray(ov.alternativ) && ov.alternativ.length > 0;
  plats.innerHTML = `<div class="panel">${huvud}
    ${ov.fraga ? `<p><strong>${esc(ov.fraga)}</strong></p>` : ''}
    ${ov.mening ? `<p class="fransk">${esc(ov.mening)}</p>` : ''}
    ${ov.meningSv ? `<p class="dampad">${esc(ov.meningSv)}</p>` : ''}
    ${flerval
      ? '<div class="val-lista" id="val"></div>'
      : `<input class="svar-falt" id="svar" autocomplete="off" autocapitalize="off" placeholder="skriv svaret">
         <div class="knapp-rad"><button class="knapp" id="ratta">Rätta</button></div>`}
    <p id="fb"></p></div>`;

  const svarLista = Array.isArray(ov.svar) ? ov.svar : [ov.svar];
  const fb = plats.querySelector('#fb');

  if (flerval) {
    const val = plats.querySelector('#val');
    const alternativ = [...ov.alternativ];
    alternativ.sort(() => Math.random() - 0.5);
    for (const alt of alternativ) {
      const b = document.createElement('button');
      b.textContent = alt;
      b.addEventListener('click', () => {
        const ratt = svarLista.some(s => normalisera(s) === normalisera(alt));
        b.classList.add(ratt ? 'vald-ratt' : 'vald-fel');
        val.querySelectorAll('button').forEach(x => { x.disabled = true; });
        fb.innerHTML = facitHtml(ov, ratt, svarLista[0]);
        vidare(ratt);
      });
      val.appendChild(b);
    }
  } else {
    const falt = plats.querySelector('#svar');
    falt.focus();
    const ratta = () => {
      const ratt = svarLista.some(s => normalisera(s) === normalisera(falt.value));
      falt.disabled = true;
      plats.querySelector('#ratta').disabled = true;
      fb.innerHTML = facitHtml(ov, ratt, svarLista[0]);
      vidare(ratt);
    };
    plats.querySelector('#ratta').addEventListener('click', ratta);
    falt.addEventListener('keydown', e => { if (e.key === 'Enter') ratta(); });
  }
}

function visaOrdfoljd(plats, ov, huvud, vidare) {
  plats.innerHTML = `<div class="panel">${huvud}
    <p><strong>${esc(ov.fraga || 'Sätt orden i rätt ordning:')}</strong></p>
    ${ov.meningSv ? `<p class="dampad">${esc(ov.meningSv)}</p>` : ''}
    <div class="pussel-svar" id="svar"></div>
    <div class="pussel-bank" id="bank"></div>
    <div class="knapp-rad"><button class="knapp" id="ratta" disabled>Rätta</button></div>
    <p id="fb"></p></div>`;

  const bank = plats.querySelector('#bank');
  const svar = plats.querySelector('#svar');
  const rattaKnapp = plats.querySelector('#ratta');
  const brickor = [...ov.ord];
  brickor.sort(() => Math.random() - 0.5);
  // se till att pusslet inte redan står i rätt ordning
  if (brickor.join(' ') === ov.ord.join(' ') && brickor.length > 2) brickor.reverse();

  const uppdatera = () => { rattaKnapp.disabled = bank.children.length > 0; };
  for (const b of brickor) {
    const knapp = document.createElement('button');
    knapp.textContent = b;
    knapp.addEventListener('click', () => {
      (knapp.parentElement === bank ? svar : bank).appendChild(knapp);
      uppdatera();
    });
    bank.appendChild(knapp);
  }

  rattaKnapp.addEventListener('click', () => {
    const forsok = [...svar.children].map(b => b.textContent);
    const ratt = forsok.join(' ') === ov.ord.join(' ');
    plats.querySelectorAll('button').forEach(b => { b.disabled = true; });
    plats.querySelector('#fb').innerHTML = facitHtml(ov, ratt, ov.ord.join(' '));
    vidare(ratt);
  });
}

function visaOversatt(plats, ov, huvud, vidare) {
  plats.innerHTML = `<div class="panel">${huvud}
    <p><strong>Översätt till franska:</strong></p>
    <p>${esc(ov.meningSv)}</p>
    <input class="svar-falt" id="svar" autocomplete="off" autocapitalize="off" placeholder="skriv på franska">
    <div class="knapp-rad"><button class="knapp" id="ratta">Rätta</button></div>
    <p id="fb"></p></div>`;
  const falt = plats.querySelector('#svar');
  falt.focus();
  const svarLista = Array.isArray(ov.svar) ? ov.svar : [ov.svar];
  const ratta = () => {
    const ratt = svarLista.some(s => normalisera(s) === normalisera(falt.value));
    falt.disabled = true;
    plats.querySelector('#ratta').disabled = true;
    plats.querySelector('#fb').innerHTML = facitHtml(ov, ratt, svarLista[0]);
    vidare(ratt);
  };
  plats.querySelector('#ratta').addEventListener('click', ratta);
  falt.addEventListener('keydown', e => { if (e.key === 'Enter') ratta(); });
}

function visaSammanfattning(plats, kap, ratta) {
  const t = laddaTillstand();
  const st = t.grammatik.kapitel[kap.id] || (t.grammatik.kapitel[kap.id] = { ratt: 0, fel: 0 });
  st.ratt += ratta;
  st.fel += kap.ovningar.length - ratta;
  const godkand = ratta >= Math.ceil(kap.ovningar.length * 0.7);
  if (godkand) {
    st.klar = true;
    sattChecklista(kap.id, 'grammatik', true);
  }
  spara();
  plats.innerHTML = `<div class="panel centrerad">
    <p class="stor">${godkand ? '✅' : '🔁'}</p>
    <p><strong>${ratta} av ${kap.ovningar.length} rätt.</strong>
      ${godkand ? 'Kapitlet är avklarat!' : 'Läs teorin igen och gör ett nytt försök.'}</p>
    <div class="knapp-rad">
      <button class="knapp sekundar" id="om">Gör om övningarna</button>
      <a class="knapp" href="#/">Dashboard</a>
    </div></div>`;
  plats.querySelector('#om').addEventListener('click', () => korOvning(plats, kap, 0, 0));
}
