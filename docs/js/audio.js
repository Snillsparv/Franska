// Ljuduppspelning: mp3-fil om den finns, annars talsyntes (fr-FR) som reserv.
import { laddaTillstand } from './state.js';

let aktuell = null;
let roster = null;

function franskRost() {
  if (!('speechSynthesis' in window)) return null;
  if (roster === null) {
    const alla = speechSynthesis.getVoices();
    roster = alla.filter(r => r.lang && r.lang.toLowerCase().startsWith('fr'));
    // föredra manlig/fransk standardröst om det går att gissa på namnet
    roster.sort((a, b) => (b.lang === 'fr-FR') - (a.lang === 'fr-FR'));
  }
  return roster[0] || null;
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { roster = null; };
}

export function stoppa() {
  if (aktuell) { aktuell.pause(); aktuell = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// spela({ fil, text, takt }) — fil = relativ sökväg till mp3, text = reservtext.
export function spela({ fil, text, takt = 1.0 }) {
  stoppa();
  return new Promise(resolve => {
    const klart = () => resolve();
    if (fil) {
      const ljud = new Audio(fil);
      aktuell = ljud;
      ljud.playbackRate = takt;
      ljud.onended = klart;
      ljud.onerror = () => { aktuell = null; talsyntes(text, takt).then(klart); };
      ljud.play().catch(() => { aktuell = null; talsyntes(text, takt).then(klart); });
    } else {
      talsyntes(text, takt).then(klart);
    }
  });
}

function talsyntes(text, takt) {
  return new Promise(resolve => {
    const inst = laddaTillstand().installningar;
    if (!text || !inst.talsyntesFallback || !('speechSynthesis' in window)) return resolve();
    const y = new SpeechSynthesisUtterance(text);
    y.lang = 'fr-FR';
    const rost = franskRost();
    if (rost) y.voice = rost;
    y.rate = 0.9 * takt;
    y.onend = resolve;
    y.onerror = resolve;
    speechSynthesis.speak(y);
  });
}

export function ljudKnapp(etikett, alternativ) {
  const b = document.createElement('button');
  b.className = 'ljud-knapp';
  b.type = 'button';
  b.textContent = etikett;
  b.addEventListener('click', e => { e.stopPropagation(); spela(alternativ); });
  return b;
}
