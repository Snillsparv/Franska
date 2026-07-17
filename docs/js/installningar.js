// Inställningar: SRS-dos, ljud, backup (export/import), nedladdning av ljud för offline.
import { laddaTillstand, spara, exporteraFil, importeraText, nollstall } from './state.js';
import { allaOrd, getSiffror, ljudFil, esc } from './data.js';

export function visaInstallningar(el) {
  const t = laddaTillstand();
  const i = t.installningar;
  el.innerHTML = `<h1>Inställningar</h1>
    <div class="panel">
      <h2 style="margin-top:0">Ordkorten</h2>
      <div class="inst-rad"><label for="max-nya">Max nya kort per dag</label>
        <input type="number" id="max-nya" min="0" max="200" value="${i.maxNya}" style="width:5em"></div>
      <div class="inst-rad"><label for="max-rep">Max repetitioner per dag (0 = obegränsat)</label>
        <input type="number" id="max-rep" min="0" max="1000" value="${i.maxRep}" style="width:5em"></div>
      <div class="inst-rad"><label for="pausa-nya">Pausa nya kort</label>
        <input type="checkbox" id="pausa-nya" ${i.pausaNya ? 'checked' : ''}></div>
      <div class="inst-rad"><label for="auto-ljud">Spela ordets ljud automatiskt</label>
        <input type="checkbox" id="auto-ljud" ${i.autoLjud ? 'checked' : ''}></div>
      <div class="inst-rad"><label for="talsyntes">Talsyntes när ljudfil saknas</label>
        <input type="checkbox" id="talsyntes" ${i.talsyntesFallback ? 'checked' : ''}></div>
      <div class="inst-rad"><label for="blixt-ms">Blixtvisning (millisekunder)</label>
        <input type="number" id="blixt-ms" min="300" max="5000" step="100" value="${i.blixtMs}" style="width:6em"></div>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">Backup</h2>
      <p class="dampad">Allt sparas i webbläsaren. Exportera regelbundet — och för att flytta mellan enheter.</p>
      <div class="knapp-rad">
        <button class="knapp" id="exportera">⬇️ Exportera framsteg</button>
        <button class="knapp sekundar" id="importera">⬆️ Importera</button>
      </div>
      <input type="file" id="import-fil" accept="application/json" hidden>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">Ljud för offline</h2>
      <p class="dampad">Hämtar ljudfiler till webbläsarens cache så att de fungerar utan nät.
        Kräver att ljudfilerna är genererade och uppladdade (se scripts/generate_tts.py).</p>
      <div class="knapp-rad">
        <button class="knapp sekundar" id="ladda-dag">Dagens ljud</button>
        <button class="knapp sekundar" id="ladda-allt">Allt ljud</button>
      </div>
      <p id="ljud-status" class="dampad"></p>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">Nollställ</h2>
      <button class="knapp" style="background:var(--rod)" id="nollstall">Radera alla framsteg</button>
    </div>
    <p class="dampad centrerad" style="font-size:.8rem">Franska 3000 · 30 dagar · byggd för Jonas 🇫🇷</p>`;

  const sparaInst = () => {
    i.maxNya = Number(el.querySelector('#max-nya').value) || 0;
    i.maxRep = Number(el.querySelector('#max-rep').value) || 0;
    i.pausaNya = el.querySelector('#pausa-nya').checked;
    i.autoLjud = el.querySelector('#auto-ljud').checked;
    i.talsyntesFallback = el.querySelector('#talsyntes').checked;
    i.blixtMs = Number(el.querySelector('#blixt-ms').value) || 1500;
    spara();
  };
  el.querySelectorAll('input[type=number],input[type=checkbox]').forEach(x =>
    x.addEventListener('change', sparaInst));

  el.querySelector('#exportera').addEventListener('click', exporteraFil);
  const importFil = el.querySelector('#import-fil');
  el.querySelector('#importera').addEventListener('click', () => importFil.click());
  importFil.addEventListener('change', async () => {
    const fil = importFil.files[0];
    if (!fil) return;
    try {
      importeraText(await fil.text());
      alert('Importen lyckades!');
      location.hash = '#/';
    } catch (e) {
      alert(`Importen misslyckades: ${e.message}`);
    }
  });

  el.querySelector('#nollstall').addEventListener('click', () => {
    if (confirm('Säkert? Alla framsteg och SRS-data raderas. Exportera först om du är osäker.')) {
      nollstall();
      location.hash = '#/';
      location.reload();
    }
  });

  el.querySelector('#ladda-dag').addEventListener('click', () => laddaLjud(el, 'dag'));
  el.querySelector('#ladda-allt').addEventListener('click', () => laddaLjud(el, 'allt'));
}

async function laddaLjud(el, omfang) {
  const status = el.querySelector('#ljud-status');
  if (!('caches' in window)) { status.textContent = 'Cache-API saknas i webbläsaren.'; return; }
  const t = laddaTillstand();
  const filer = [];
  if (omfang === 'dag') {
    const start = (t.dag - 1) * 100 + 1;
    for (let r = start; r < start + 100; r++) {
      filer.push(ljudFil('ord', r), ljudFil('mening', r));
    }
    filer.push(`audio/monolog_${String(t.dag).padStart(2, '0')}.mp3`);
  } else {
    for (const o of allaOrd()) filer.push(ljudFil('ord', o.rang), ljudFil('mening', o.rang));
    for (const n of getSiffror().nivaer) for (const p of n.poster) filer.push(`audio/${p.ljud}.mp3`);
    for (let d = 1; d <= 30; d++) filer.push(`audio/monolog_${String(d).padStart(2, '0')}.mp3`);
  }
  const cache = await caches.open('franska-ljud-v1');
  let klara = 0, saknas = 0;
  for (const fil of filer) {
    if (await cache.match(fil)) { klara += 1; continue; }
    try {
      const svar = await fetch(fil);
      if (svar.ok) { await cache.put(fil, svar); klara += 1; }
      else saknas += 1;
    } catch { saknas += 1; }
    if ((klara + saknas) % 25 === 0) {
      status.textContent = `Hämtar … ${klara + saknas} av ${filer.length}`;
    }
  }
  status.textContent = `Klart: ${klara} filer i cachen${saknas ? `, ${saknas} saknas (inte genererade än?)` : ''}.`;
}
