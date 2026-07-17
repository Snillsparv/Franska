// Startpunkt: laddar data, hash-router, service worker.
import { initData } from './data.js';
import { visaDashboard, uppdateraToppDag } from './dashboard.js';
import { visaKort } from './kort.js';
import { visaSiffror } from './siffror.js';
import { visaUttal } from './uttal.js';
import { visaMonolog } from './monolog.js';
import { visaGrammatik } from './grammatik.js';
import { visaInstallningar } from './installningar.js';
import { stoppa } from './audio.js';

const vy = document.getElementById('vy');

async function rutt() {
  stoppa();
  vy.onkeydown = null;
  const delar = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [rot, arg] = delar;
  markeraNav(rot || '');
  try {
    switch (rot) {
      case undefined:
      case '':
      case 'dag':
        visaDashboard(vy, arg ? Number(arg) : undefined); break;
      case 'ord': await visaKort(vy, arg ? Number(arg) : undefined); break;
      case 'siffror': visaSiffror(vy, arg); break;
      case 'uttal': await visaUttal(vy, arg); break;
      case 'monolog': await visaMonolog(vy, arg); break;
      case 'grammatik': await visaGrammatik(vy, arg); break;
      case 'installningar': visaInstallningar(vy); break;
      default:
        vy.innerHTML = `<div class="panel"><p>Sidan finns inte.</p><a class="knapp" href="#/">Hem</a></div>`;
    }
  } catch (fel) {
    console.error(fel);
    vy.innerHTML = `<div class="panel"><p>Något gick fel: ${fel.message}</p>
      <a class="knapp" href="#/">Till startsidan</a></div>`;
  }
  uppdateraToppDag();
  window.scrollTo(0, 0);
}

function markeraNav(rot) {
  document.querySelectorAll('#botten-nav a').forEach(a => {
    a.classList.toggle('aktiv', a.dataset.rot === rot);
  });
}

async function start() {
  try {
    await initData();
  } catch (fel) {
    vy.innerHTML = `<div class="panel"><p>Kunde inte ladda kursdatan (${fel.message}).
      Kontrollera att data-filerna är genererade: <code>python3 scripts/build_data.py</code></p></div>`;
    return;
  }
  window.addEventListener('hashchange', rutt);
  rutt();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
