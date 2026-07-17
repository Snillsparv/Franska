// Tal → franska räkneord (spegel av scripts/fr_nummer.py) + svarsjämförelse.
const ENHETER = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
  'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf'];
const TIOTAL = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

function under100(n) {
  if (n < 20) return ENHETER[n];
  if (n < 70) {
    const tio = Math.floor(n / 10) * 10, rest = n % 10;
    if (rest === 0) return TIOTAL[tio];
    if (rest === 1) return `${TIOTAL[tio]} et un`;
    return `${TIOTAL[tio]}-${ENHETER[rest]}`;
  }
  if (n < 80) {
    const rest = n - 60;
    return rest === 11 ? 'soixante et onze' : `soixante-${ENHETER[rest]}`;
  }
  const rest = n - 80;
  return rest === 0 ? 'quatre-vingts' : `quatre-vingt-${ENHETER[rest]}`;
}

function under1000(n) {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100), rest = n % 100;
  let del;
  if (h === 1) del = 'cent';
  else if (rest === 0) del = `${ENHETER[h]} cents`;
  else del = `${ENHETER[h]} cent`;
  return rest === 0 ? del : `${del} ${under100(rest)}`;
}

export function talTillFranska(n) {
  if (n < 0 || n > 999999) throw new Error(`utanför intervallet: ${n}`);
  if (n < 1000) return under1000(n);
  const tusen = Math.floor(n / 1000), rest = n % 1000;
  let t;
  if (tusen === 1) t = 'mille';
  else {
    let prefix = under1000(tusen);
    if (prefix.endsWith('quatre-vingts') || prefix.endsWith('cents')) prefix = prefix.slice(0, -1);
    t = `${prefix} mille`;
  }
  return rest === 0 ? t : `${t} ${under1000(rest)}`;
}

// Normalisera för jämförelse: gemener, bindestreck→mellanslag, accepterar
// både traditionell ("vingt et un") och 1990-reformens stavning ("vingt-et-un").
export function normaliseraFranska(s) {
  return s.toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sammaFranska(a, b) {
  return normaliseraFranska(a) === normaliseraFranska(b);
}

// Normalisera sifferinmatning: "12,50", "12.50", "06 12 34 56 78", "15:30" …
export function normaliseraSiffersvar(s) {
  return s.replace(/[\s]/g, '').replace(/[.,]/g, ',').replace(/€/g, '').trim();
}

export function rattSiffersvar(inmatning, svarLista) {
  const n = normaliseraSiffersvar(inmatning);
  return svarLista.some(sv => normaliseraSiffersvar(sv) === n);
}
