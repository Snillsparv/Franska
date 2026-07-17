// Smoketest: klickar igenom kärnflödena i riktig Chromium och rapporterar fel.
// Kräver playwright. Kör:
//   cd docs && python3 -m http.server 8123 &
//   node scripts/smoketest.js          (CHROME_BIN kan peka ut chromium-binären)
// OBS: körs mot en FÄRSK profil — påverkar inte dina riktiga framsteg.
const { chromium } = require('playwright');

const BAS = 'http://localhost:8123/index.html';
const fel = [];
let steg = '';

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => {
    // 404:or för ljud/innehåll som inte genererats än är väntade — talsyntesen tar över
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      fel.push(`[konsol @ ${steg}] ${msg.text()}`);
    }
  });
  page.on('pageerror', e => fel.push(`[pageerror @ ${steg}] ${e.message}`));

  const kolla = async (namn, fn) => {
    steg = namn;
    try { await fn(); console.log(`ok: ${namn}`); }
    catch (e) { fel.push(`[${namn}] ${e.message.split('\n')[0]}`); console.log(`FEL: ${namn}`); }
  };

  await kolla('dashboard laddar', async () => {
    await page.goto(BAS);
    await page.waitForSelector('h1:has-text("Dag 1")', { timeout: 8000 });
    const antal = await page.locator('.checklista li').count();
    if (antal !== 5) throw new Error(`${antal} checklisterader, väntade 5`);
  });

  await kolla('nästa dag-knappen', async () => {
    await page.click('#dag-nasta');
    await page.waitForSelector('h1:has-text("Dag 2")');
    await page.click('#dag-fore');
    await page.waitForSelector('h1:has-text("Dag 1")');
  });

  await kolla('checklista-bock', async () => {
    await page.locator('.checklista .bock').first().click();
    await page.waitForSelector('.checklista .bock.klar');
  });

  await kolla('ordkort: framsida', async () => {
    await page.goto(BAS + '#/ord');
    await page.waitForSelector('.flash .ordet', { timeout: 8000 });
    const ordet = await page.locator('.flash .ordet').textContent();
    if (!ordet.includes('le / la / les')) throw new Error(`första kortet: ${ordet}`);
  });

  await kolla('ordkort: svar + betyg', async () => {
    await page.click('#visa');
    await page.waitForSelector('.betyg-rad:not([hidden])');
    const oversattning = await page.locator('.oversattning').textContent();
    if (!oversattning.includes('bestämd artikel')) throw new Error(`baksida: ${oversattning}`);
    await page.click('.betyg-bra');
    await page.waitForSelector('.flash .ordet:has-text("de")');
  });

  await kolla('ordkort: kortkommandon', async () => {
    await page.keyboard.press(' ');
    await page.waitForSelector('.betyg-rad:not([hidden])');
    await page.keyboard.press('3');
    await page.waitForFunction(() =>
      document.querySelector('.flash .ordet')?.textContent.includes('un / une'));
  });

  await kolla('siffror: nivålista', async () => {
    await page.goto(BAS + '#/siffror');
    await page.waitForSelector('h1:has-text("Sifferträning")');
    const antal = await page.locator('#nivalista .panel').count();
    if (antal !== 8) throw new Error(`${antal} nivåer, väntade 8`);
  });

  await kolla('siffror: blixtläge', async () => {
    await page.goto(BAS + '#/siffror/1');
    await page.click('#lage-blixt');
    await page.waitForSelector('#blixt');
    await page.waitForSelector('#svarsdel:not([hidden])', { timeout: 5000 });
    const visat = await page.evaluate(() => window.__blixtvarde);
    await page.fill('#svar', 'zéro'); // gissning — vi kollar bara att rättning sker
    await page.click('#ratta');
    await page.waitForSelector('#feedback :is(.ratt,.fel)');
  });

  await kolla('siffror: lyssna-läge rättar', async () => {
    await page.goto(BAS + '#/siffror');           // bort och tillbaka — samma hash triggar ingen omrendering
    await page.goto(BAS + '#/siffror/1');
    await page.click('#lage-lyssna');
    await page.waitForSelector('#svar');
    await page.fill('#svar', '5');
    await page.click('#ratta');
    await page.waitForSelector('#feedback :is(.ratt,.fel)');
  });

  await kolla('uttal: lista med 20', async () => {
    await page.goto(BAS + '#/uttal');
    await page.waitForSelector('h1:has-text("Uttalsregler")');
    const antal = await page.locator('#lista .panel').count();
    if (antal !== 20) throw new Error(`${antal} lektioner, väntade 20`);
  });

  await kolla('monolog: vy renderas', async () => {
    await page.goto(BAS + '#/monolog/1');
    await page.waitForSelector('h1:has-text("Monolog")');
  });

  await kolla('grammatik: lista med 30', async () => {
    await page.goto(BAS + '#/grammatik');
    await page.waitForSelector('h1:has-text("Grammatik")');
    const antal = await page.locator('#lista .panel').count();
    if (antal !== 30) throw new Error(`${antal} kapitel, väntade 30`);
  });

  await kolla('inställningar + export', async () => {
    await page.goto(BAS + '#/installningar');
    await page.waitForSelector('h1:has-text("Inställningar")');
    const [nedladdning] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.click('#exportera'),
    ]);
    if (!nedladdning.suggestedFilename().startsWith('franska-backup')) {
      throw new Error(`konstigt filnamn: ${nedladdning.suggestedFilename()}`);
    }
  });

  await kolla('srs-tillstånd sparat', async () => {
    const tillstand = await page.evaluate(() => JSON.parse(localStorage.getItem('franska-v1')));
    const kort = Object.keys(tillstand.srs.kort);
    if (kort.length < 2) throw new Error(`bara ${kort.length} kort i SRS`);
    if (!tillstand.srs.kort['1'] || tillstand.srs.kort['1'].reps !== 1) {
      throw new Error('kort 1 har inte reps=1 efter Bra-betyg');
    }
  });

  await browser.close();
  console.log('\n' + (fel.length ? `PROBLEM (${fel.length}):\n` + fel.join('\n') : 'ALLT GRÖNT'));
  process.exit(fel.length ? 1 : 0);
})().catch(e => { console.error('krasch:', e); process.exit(2); });
