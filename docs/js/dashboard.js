// Modul 0: Dashboard — dagens dos som checklista, dagväljare, statistik.
import { dagInfo, getKursplan } from './data.js';
import { laddaTillstand, spara, checklista, sattChecklista } from './state.js';
import { byggKo, statistik } from './srs.js';
import { esc } from './data.js';

const DELAR = ['ord', 'uttal', 'siffror', 'monolog', 'grammatik'];

export function visaDashboard(el, dag) {
  const t = laddaTillstand();
  if (dag) { t.dag = Math.min(30, Math.max(1, dag)); spara(); }
  const d = t.dag;
  const info = dagInfo(d);
  const kp = getKursplan();
  const lista = checklista(d);
  const ko = byggKo(d, info.ordSlut);
  const stat = statistik();

  const uttalTitel = info.uttal
    ? `Lektion ${info.uttal}: ${kp.uttalLektioner[info.uttal - 1].titel}`
    : 'Repetition av tidigare lektioner';
  const sifferTitel = `Nivå ${info.siffror}: ${kp.sifferNivaer[info.siffror - 1].titel}`;
  const gramTitel = `Kapitel ${info.grammatik}: ${kp.grammatikKapitel[info.grammatik - 1].titel}`;

  const rader = [
    { del: 'ord', rubrik: `Ord ${info.ordStart}–${info.ordSlut}`,
      under: `${ko.repetitioner.length} repetitioner + ${ko.nya.length} nya`, mal: '#/ord' },
    { del: 'uttal', rubrik: 'Uttal', under: uttalTitel,
      mal: info.uttal ? `#/uttal/${info.uttal}` : '#/uttal' },
    { del: 'siffror', rubrik: 'Siffror', under: sifferTitel, mal: `#/siffror/${info.siffror}` },
    { del: 'monolog', rubrik: 'Dagens monolog', under: `Monolog ${d}`, mal: `#/monolog/${d}` },
    { del: 'grammatik', rubrik: 'Grammatik', under: gramTitel, mal: `#/grammatik/${info.grammatik}` },
  ];

  const klaraDelar = DELAR.filter(x => lista[x]).length;

  el.innerHTML = `
    <div class="dag-huvud">
      <h1>Dag ${d} <span class="dampad">av 30</span></h1>
      <div class="dag-nav">
        <button class="knapp sekundar liten" id="dag-fore" ${d <= 1 ? 'disabled' : ''}>◀</button>
        <button class="knapp liten" id="dag-nasta" ${d >= 30 ? 'disabled' : ''}>Nästa dag ▶</button>
      </div>
    </div>
    <div class="framsteg"><div style="width:${klaraDelar / DELAR.length * 100}%"></div></div>
    <ul class="checklista panel" id="checklista"></ul>
    <div class="panel">
      <h2 style="margin-top:0">Ordförrådet</h2>
      <p class="dampad" style="margin:0">
        ${stat.totalt} av 3000 introducerade · ${stat.mogna} mogna · ${stat.dueNu} väntar nu ·
        i dag: ${stat.idagLogg.nya} nya, ${stat.idagLogg.rep} repetitioner</p>
    </div>
    <h2>Alla dagar</h2>
    <div class="dag-rutnat" id="dag-rutnat"></div>`;

  const ul = el.querySelector('#checklista');
  for (const rad of rader) {
    const li = document.createElement('li');
    const klar = !!lista[rad.del];
    li.innerHTML = `
      <button class="bock ${klar ? 'klar' : ''}" aria-label="Bocka av ${rad.rubrik}">${klar ? '✓' : ''}</button>
      <a class="rad" href="${rad.mal}"><strong>${esc(rad.rubrik)}</strong>
        <span class="under">${esc(rad.under)}</span></a>`;
    li.querySelector('.bock').addEventListener('click', () => {
      sattChecklista(d, rad.del, !checklista(d)[rad.del]);
      visaDashboard(el);
    });
    ul.appendChild(li);
  }

  el.querySelector('#dag-fore').addEventListener('click', () => visaDashboard(el, d - 1));
  el.querySelector('#dag-nasta').addEventListener('click', () => visaDashboard(el, d + 1));

  const rutnat = el.querySelector('#dag-rutnat');
  for (let i = 1; i <= 30; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    const listaI = t.checklista[i] || {};
    if (DELAR.every(x => listaI[x])) b.classList.add('klar');
    if (i === d) b.classList.add('nu');
    b.addEventListener('click', () => visaDashboard(el, i));
    rutnat.appendChild(b);
  }
  uppdateraToppDag();
}

export function uppdateraToppDag() {
  const t = laddaTillstand();
  const span = document.getElementById('topp-dag');
  if (span) span.textContent = `Dag ${t.dag} av 30`;
}
