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
  // Nouveaux modules
  await snap('soutenement', 'apercu-soutenement.png', async () => { await page.click('#rt_calc'); });
  await snap('geotech', 'apercu-geotech.png', async () => { await page.click('#tb_calc'); });
  await snap('vrd', 'apercu-vrd.png', async () => { await page.click('#vp_calc'); });
  await snap('elements', 'apercu-elements.png', async () => { await page.click('#el_calc'); });
  await snap('combinaisons', 'apercu-combinaisons.png', async () => { await page.click('#cb_calc'); });
  await snap('conduite', 'apercu-conduite.png', async () => { await page.click('#pr_calc'); });
  await snap('pompage', 'apercu-pompage.png', async () => { await page.click('#pu_calc'); });
  await snap('validation', 'apercu-validation.png', async () => {
    await page.selectOption('#va_type', 'ba_flexion'); await page.fill('#va_As_note', '900'); await page.click('#va_verify');
  });
  await snap('deversoirs', 'apercu-deversoirs.png', async () => { await page.click('#wr_calc'); });
  await snap('boues', 'apercu-boues.png', async () => { await page.click('#sl_calc'); });
  await snap('repartiteur', 'apercu-repartiteur.png', async () => { await page.click('#di_calc'); });
  // Point de fonctionnement
  await page.click('.nav-item[data-view="pompage"]');
  await page.click('[data-subtab="pompage"][data-tab="pf"]');
  await page.waitForTimeout(150); await page.click('#pf_calc'); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, 'apercu-point-fonctionnement.png'), fullPage: true });

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
  // Nouveaux modules
  await page.click('.nav-item[data-view="soutenement"]'); await page.click('#rt_calc'); await page.waitForTimeout(120);
  checks.soutenement = await page.textContent('#rt_res');
  await page.click('.nav-item[data-view="geotech"]'); await page.click('#tb_calc'); await page.waitForTimeout(120);
  checks.geotech = await page.textContent('#tb_res');
  await page.click('.nav-item[data-view="elements"]'); await page.click('#el_calc'); await page.waitForTimeout(120);
  checks.elements = await page.textContent('#el_res');
  await page.click('.nav-item[data-view="vrd"]'); await page.click('#vp_calc'); await page.waitForTimeout(120);
  checks.vrd = await page.textContent('#vp_res');
  await page.click('.nav-item[data-view="combinaisons"]'); await page.click('#cb_calc'); await page.waitForTimeout(120);
  checks.combos = await page.textContent('#cb_res');
  await page.click('.nav-item[data-view="conduite"]'); await page.click('#pr_calc'); await page.waitForTimeout(120);
  checks.conduite = await page.textContent('#pr_res');
  await page.click('.nav-item[data-view="pompage"]'); await page.click('[data-subtab="pompage"][data-tab="dim"]'); await page.click('#pu_calc'); await page.waitForTimeout(120);
  checks.pompage = await page.textContent('#pu_res');
  await page.click('.nav-item[data-view="validation"]');
  await page.selectOption('#va_type', 'ba_flexion'); await page.fill('#va_As_note', '900'); await page.click('#va_verify'); await page.waitForTimeout(120);
  checks.validation = await page.textContent('#va_res');
  await page.selectOption('#va_type', 'rdm'); await page.waitForTimeout(80); await page.click('#va_verify'); await page.waitForTimeout(120);
  checks.validationRdm = await page.textContent('#va_res');
  await page.click('.nav-item[data-view="deversoirs"]'); await page.click('#wr_calc'); await page.waitForTimeout(120);
  checks.deversoirs = await page.textContent('#wr_res');
  await page.click('.nav-item[data-view="boues"]'); await page.click('#sl_calc'); await page.waitForTimeout(120);
  checks.boues = await page.textContent('#sl_res');
  await page.click('.nav-item[data-view="repartiteur"]'); await page.click('#di_calc'); await page.waitForTimeout(120);
  checks.repartiteur = await page.textContent('#di_res');
  // captures caniveau / récup EP
  await page.click('.nav-item[data-view="vrd"]');
  await page.click('[data-subtab="vrd"][data-tab="caniveau"]'); await page.waitForTimeout(120); await page.click('#ca_calc'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'apercu-caniveau.png'), fullPage: true });
  await page.click('[data-subtab="vrd"][data-tab="recupEP"]'); await page.waitForTimeout(120); await page.click('#ep_calc'); await page.click('#ep_sim'); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, 'apercu-recup-ep.png'), fullPage: true });
  await page.click('[data-subtab="vrd"][data-tab="terr"]'); await page.waitForTimeout(120); await page.click('#vt_calc'); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, 'apercu-terrassement.png'), fullPage: true });
  await page.click('[data-subtab="vrd"][data-tab="bassin"]'); await page.waitForTimeout(120); await page.click('#ba_calc'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'apercu-bassin.png'), fullPage: true });
  await page.click('[data-subtab="vrd"][data-tab="caniveau"]'); await page.waitForTimeout(120); await page.click('#ca_remous'); await page.click('#ca_ressaut'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'apercu-remous.png'), fullPage: true });
  await snap('reseau', 'apercu-reseau.png', async () => { await page.click('#nw_calc'); await page.click('#nw_charge'); });
  await snap('voirie', 'apercu-voirie.png', async () => { await page.click('#rv_calc'); });
  await page.click('.nav-item[data-view="pompage"]'); await page.click('[data-subtab="pompage"][data-tab="pf"]'); await page.waitForTimeout(120); await page.click('#pf_calc'); await page.waitForTimeout(150);
  checks.pf = await page.textContent('#pf_res');
  const pfSvg = await page.$$eval('#pf_res svg', (els) => els.length);
  // Caniveau & récupération EP (sous-onglets VRD)
  await page.click('.nav-item[data-view="vrd"]');
  await page.click('[data-subtab="vrd"][data-tab="caniveau"]'); await page.waitForTimeout(100); await page.click('#ca_calc'); await page.waitForTimeout(120);
  checks.caniveau = await page.textContent('#ca_res');
  await page.click('[data-subtab="vrd"][data-tab="recupEP"]'); await page.waitForTimeout(100); await page.click('#ep_calc'); await page.waitForTimeout(120);
  checks.recupEP = await page.textContent('#ep_res');
  // v6 : terrassement EN 1610, bassin, simulation EP, courbe de remous
  await page.click('[data-subtab="vrd"][data-tab="terr"]'); await page.waitForTimeout(100); await page.click('#vt_calc'); await page.waitForTimeout(120);
  checks.terrEN = await page.textContent('#vt_res');
  await page.click('[data-subtab="vrd"][data-tab="bassin"]'); await page.waitForTimeout(100); await page.click('#ba_calc'); await page.waitForTimeout(150);
  checks.bassin = await page.textContent('#ba_res');
  await page.click('[data-subtab="vrd"][data-tab="recupEP"]'); await page.waitForTimeout(100); await page.click('#ep_sim'); await page.waitForTimeout(180);
  checks.epsim = await page.textContent('#ep_simres');
  const epSimSvg = await page.$$eval('#ep_simres svg', (els) => els.length);
  await page.click('[data-subtab="vrd"][data-tab="caniveau"]'); await page.waitForTimeout(100); await page.click('#ca_remous'); await page.waitForTimeout(150);
  checks.remous = await page.textContent('#ca_remres');
  await page.click('#ca_ressaut'); await page.waitForTimeout(120);
  checks.ressaut = await page.textContent('#ca_ressres');
  await page.click('#ca_rlcalc'); await page.waitForTimeout(150);
  checks.ressautLoc = await page.textContent('#ca_rlres');
  // Réseau gravitaire — profil en long
  await page.click('.nav-item[data-view="reseau"]'); await page.click('#nw_calc'); await page.waitForTimeout(150);
  checks.reseau = await page.textContent('#nw_res');
  const nwSvg = await page.$$eval('#nw_res svg', (els) => els.length);
  await page.click('#nw_charge'); await page.waitForTimeout(150);
  checks.charge = await page.textContent('#nw_res');
  await page.click('#nw_optim'); await page.waitForTimeout(150);
  checks.optim = await page.textContent('#nw_res');
  // Voirie
  await page.click('.nav-item[data-view="voirie"]'); await page.click('#rv_calc'); await page.waitForTimeout(150);
  checks.voirie = await page.textContent('#rv_res');
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
  ok &= has('Soutènement', checks.soutenement, 'enversement');
  ok &= has('Géotech/Blindage', checks.geotech, 'Buton');
  ok &= has('Éléments BA', checks.elements, 'deux sens');
  ok &= has('VRD', checks.vrd, 'Débit');
  ok &= has('Combinaisons', checks.combos, 'ELU');
  ok &= has('Conduite', checks.conduite, 'lérité');
  ok &= has('Pompage', checks.pompage, 'HMT');
  ok &= has('Vérificateur', checks.validation, 'CONFORME');
  ok &= has('Vérificateur/RDM', checks.validationRdm, 'RDM');
  ok &= has('Déversoirs', checks.deversoirs, 'rectangulaire');
  ok &= has('Réseaux boues', checks.boues, 'volumique');
  ok &= has('Répartiteur', checks.repartiteur, 'équilibre');
  ok &= has('Point de fonctionnement', checks.pf, 'Qop');
  console.log(`  ${pfSvg >= 1 ? '✓' : '✗'} Point de fonctionnement : ${pfSvg} courbe SVG`);
  ok &= pfSvg >= 1;
  ok &= has('Caniveau', checks.caniveau, 'Manning');
  ok &= has('Récup. EP', checks.recupEP, 'cuve');
  ok &= has('Terrassement EN 1610', checks.terrEN, 'EN 1610');
  ok &= has('Bassin rétention', checks.bassin, 'rétention');
  ok &= has('Simulation EP', checks.epsim, 'couverture');
  console.log(`  ${epSimSvg >= 1 ? '✓' : '✗'} Simulation EP : ${epSimSvg} courbe SVG`);
  ok &= epSimSvg >= 1;
  ok &= has('Courbe de remous', checks.remous, 'remous');
  ok &= has('Ressaut hydraulique', checks.ressaut, 'conjugué');
  ok &= has('Réseau / profil', checks.reseau, 'Fil d’eau');
  console.log(`  ${nwSvg >= 1 ? '✓' : '✗'} Réseau : ${nwSvg} profil SVG`);
  ok &= nwSvg >= 1;
  ok &= has('Ressaut localisé', checks.ressautLoc, 'critique');
  ok &= has('Mise en charge', checks.charge, 'piézo');
  ok &= has('Optimisation fil d’eau', checks.optim, 'Cotes');
  ok &= has('Voirie', checks.voirie, 'admissible');

  console.log('\n--- Erreurs JS détectées ---');
  if (errors.length === 0) console.log('  ✓ Aucune erreur console / page');
  else errors.forEach((e) => console.log('  ✗ ' + e));

  await browser.close();
  const success = ok && errors.length === 0;
  console.log(`\n${success ? '✅ Navigateur : OK' : '❌ Navigateur : échecs détectés'}\n`);
  process.exit(success ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
