/* Vérification du rendu dans un vrai navigateur (Chromium via Playwright). */
'use strict';
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const outDir = path.resolve(__dirname, '..', 'assets');
  const fs = require('fs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  async function snap(view, file, prep) {
    await page.click(`.nav-item[data-view="${view}"]`);
    await page.waitForTimeout(250);
    if (prep) await prep();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  }

  // Accueil
  await snap('accueil', 'apercu-accueil.png');
  // Béton (flexion par défaut)
  await snap('beton', 'apercu-beton.png');
  // Béton — poteau (avec diagramme N-M)
  await page.click('[data-subtab="beton"][data-tab="poteau"]');
  await page.waitForTimeout(200);
  await page.click('#bp_calc');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'apercu-beton-poteau.png'), fullPage: true });
  // Béton — poutre en Té
  await page.click('[data-subtab="beton"][data-tab="poutreT"]');
  await page.waitForTimeout(150);
  await page.click('#bT_calc');
  await page.waitForTimeout(200);
  // Structures
  await snap('structures', 'apercu-structures.png', async () => { await page.click('#st_solve'); });
  // Acier
  await snap('acier', 'apercu-acier.png', async () => { await page.click('#sa_compute'); });
  // Métré
  await snap('metre', 'apercu-metre.png', async () => { await page.click('#mq_compute'); await page.click('#mf_compute'); });
  // Charges climatiques
  await snap('charges', 'apercu-charges.png', async () => { await page.click('#cn_calc'); });

  // Contrôles de contenu
  const checks = {};
  await page.click('.nav-item[data-view="beton"]');
  await page.click('[data-subtab="beton"][data-tab="flexion"]');
  await page.click('#bf_calc');
  await page.waitForTimeout(200);
  checks.flexion = await page.textContent('#bf_res');
  await page.click('.nav-item[data-view="structures"]');
  await page.click('#st_solve');
  await page.waitForTimeout(300);
  checks.structures = await page.textContent('#st_res');
  const svgCount = await page.$$eval('#st_res svg', (els) => els.length);
  await page.click('.nav-item[data-view="acier"]');
  await page.click('#sa_compute');
  await page.waitForTimeout(200);
  checks.acier = await page.textContent('#sa_res');
  await page.click('.nav-item[data-view="metre"]');
  await page.click('#mf_compute');
  await page.waitForTimeout(200);
  checks.fondation = await page.textContent('#mf_res');
  // Poutre en Té
  await page.click('.nav-item[data-view="beton"]');
  await page.click('[data-subtab="beton"][data-tab="poutreT"]');
  await page.click('#bT_calc');
  await page.waitForTimeout(150);
  checks.poutreT = await page.textContent('#bT_res');
  // Charges
  await page.click('.nav-item[data-view="charges"]');
  await page.click('#cn_calc');
  await page.click('[data-subtab="charges"][data-tab="vent"]');
  await page.click('#cv_calc');
  await page.waitForTimeout(150);
  checks.neige = await page.textContent('#cn_res');
  checks.vent = await page.textContent('#cv_res');
  // Note de calcul (générateur PDF) — test de la fonction de construction
  checks.report = await page.evaluate(() =>
    GC.report.build('Test', [['a', 'b']], '<p>résultat</p>').indexOf('Note de calcul') >= 0);

  console.log('\n--- Vérifications de contenu ---');
  function has(label, txt, needle) {
    const ok = txt && txt.indexOf(needle) >= 0;
    console.log(`  ${ok ? '✓' : '✗'} ${label} (contient « ${needle} »)`);
    return ok;
  }
  let ok = true;
  ok &= has('Béton/flexion', checks.flexion, 'As');
  ok &= has('Structures', checks.structures, 'Réactions');
  ok &= has('Structures/ELS', checks.structures, 'flèche');
  console.log(`  ${svgCount >= 3 ? '✓' : '✗'} Structures : ${svgCount} graphiques SVG`);
  ok &= svgCount >= 3;
  ok &= has('Acier', checks.acier, 'Nb,Rd');
  ok &= has('Fondation', checks.fondation, 'Dimensions');
  ok &= has('Poutre en Té', checks.poutreT, 'Té');
  ok &= has('Neige', checks.neige, 'neige');
  ok &= has('Vent', checks.vent, 'qp');
  console.log(`  ${checks.report ? '✓' : '✗'} Export note de calcul (PDF)`);
  ok &= checks.report;

  console.log('\n--- Erreurs JS détectées ---');
  if (errors.length === 0) console.log('  ✓ Aucune erreur console / page');
  else errors.forEach((e) => console.log('  ✗ ' + e));

  await browser.close();
  const success = ok && errors.length === 0;
  console.log(`\n${success ? '✅ Navigateur : OK' : '❌ Navigateur : échecs détectés'}\n`);
  process.exit(success ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
