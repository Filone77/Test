/*
 * Tests du moteur de calcul — vérification contre des résultats établis à la main.
 * Lancement : node tests/run-tests.js
 */
'use strict';
const concrete = require('../js/engine/concrete.js');
const beam = require('../js/engine/beam.js');
const steel = require('../js/engine/steel.js');
const profiles = require('../js/engine/profiles.js');
const quantities = require('../js/engine/quantities.js');
const loads = require('../js/engine/loads.js');

let passed = 0, failed = 0;
function check(label, got, expected, tol) {
  tol = tol == null ? 0.02 : tol; // tolérance relative par défaut 2 %
  const ok = Math.abs(got - expected) <= Math.abs(expected) * tol + 1e-9;
  if (ok) { passed++; console.log(`  ✓ ${label}: ${round(got)} ≈ ${expected}`); }
  else { failed++; console.log(`  ✗ ${label}: ${round(got)} attendu ${expected}`); }
}
function checkBool(label, got, expected) {
  const ok = got === expected;
  if (ok) { passed++; console.log(`  ✓ ${label}: ${got}`); }
  else { failed++; console.log(`  ✗ ${label}: ${got} attendu ${expected}`); }
}
function round(x) { return Math.round(x * 1000) / 1000; }

console.log('\n=== BÉTON ARMÉ (EC2) ===');
console.log('Poutre 300×500, d=450, fck25, fyk500, MEd=200 kN·m');
const f = concrete.flexionSimple({ MEd: 200, b: 300, h: 500, d: 450, fck: 25, fyk: 500 });
check('μ', f.mu, 0.1975, 0.03);
check('z [mm]', f.z, 400, 0.02);
check('As [mm²]', f.As, 1150, 0.03);
checkBool('statut', f.statut, 'OK');

console.log('Effort tranchant VEd=150 kN, bw=300, d=450, As=1150');
const v = concrete.effortTranchant({ VEd: 150, bw: 300, d: 450, fck: 25, fyk: 500, As: 1150 });
check('VRd,c [kN]', v.VRdc, 74.8, 0.05);
checkBool('armatures requises', v.armaturesRequises, true);
check('Asw/s [mm²/mm]', v.AswSretenu, 0.341, 0.05);

console.log('Poteau 300×300, fck25, fyk500, NEd=1500, MEd=60');
const pot = concrete.poteau({ b: 300, h: 300, fck: 25, fyk: 500, NEd: 1500, MEd: 60 });
checkBool('faisable', pot.faisable, true);
check('As ≥ As,min', pot.As >= pot.AsMin ? 1 : 0, 1, 0);

console.log('Poutre en Té — axe neutre dans la table');
const t1 = concrete.flexionT({ MEd: 300, beff: 800, bw: 200, hf: 100, h: 500, d: 450, fck: 25, fyk: 500 });
checkBool('axe neutre = table', t1.axeNeutre === 'table', true);
check('As (table) [mm²]', t1.As, 1630, 0.04);

console.log('Poutre en Té — axe neutre dans l’âme');
const t2 = concrete.flexionT({ MEd: 400, beff: 600, bw: 200, hf: 80, h: 500, d: 450, fck: 25, fyk: 500 });
checkBool('axe neutre = âme', t2.axeNeutre === 'ame', true);
check('As total (âme) [mm²]', t2.As, 2330, 0.05);

console.log('\n=== RDM — poutre sur 2 appuis, L=6 m, w=10 kN/m, EI=10000 ===');
const b1 = beam.solveBeam({
  supports: [{ x: 0, type: 'appui' }, { x: 6, type: 'appui' }],
  EI: 10000,
  distLoads: [{ x1: 0, x2: 6, w: 10 }]
});
check('Réaction gauche [kN]', b1.reactions[0].Rv, 30, 0.01);
check('Réaction droite [kN]', b1.reactions[1].Rv, 30, 0.01);
check('Mmax [kN·m]', b1.Mmax.val, 45, 0.01);
check('Vmax [kN]', Math.abs(b1.Vmax.val), 30, 0.02);
check('Flèche max [mm]', Math.abs(b1.flecheMax.val), 16.875, 0.02);
checkBool('équilibre', b1.equilibre.ok, true);

console.log('\n=== RDM — console L=3 m, P=20 kN en bout, EI=10000 ===');
const b2 = beam.solveBeam({
  supports: [{ x: 0, type: 'encastrement' }, { x: 3, type: 'libre' }],
  EI: 10000,
  pointLoads: [{ x: 3, P: 20 }]
});
check('Réaction verticale [kN]', b2.reactions[0].Rv, 20, 0.02);
check('Moment d’encastrement |M| [kN·m]', Math.abs(b2.Mmin.val), 60, 0.03);
check('Flèche en bout [mm]', Math.abs(b2.flecheMax.val), 18, 0.03);

console.log('\n=== RDM — poutre continue 2 travées 5+5 m, w=10 kN/m ===');
const b3 = beam.solveBeam({
  supports: [{ x: 0, type: 'appui' }, { x: 5, type: 'appui' }, { x: 10, type: 'appui' }],
  EI: 10000,
  distLoads: [{ x1: 0, x2: 10, w: 10 }]
});
// solution exacte : appui central R = 1.25·wL = 62.5 kN, appuis de rive = 18.75 kN
check('Réaction appui central [kN]', b3.reactions[1].Rv, 62.5, 0.02);
check('Réaction appui rive [kN]', b3.reactions[0].Rv, 18.75, 0.03);
// moment sur appui central : -wL²/8 = -31.25 kN·m
check('Moment sur appui central [kN·m]', Math.abs(b3.Mmin.val), 31.25, 0.04);

console.log('\n=== ACIER (EC3) ===');
const ipe200 = profiles.get('IPE 200');
console.log('IPE 200 S235, flambement faible axe, Lcr=3 m, courbe b');
const c = steel.compression({ A: ipe200.A, I: ipe200.Iz, fy: 235, Lcr: 3, courbe: 'b', NEd: 200 });
check('Ncr [kN]', c.Ncr, 327, 0.03);
check('λ̄', c.lambdaBar, 1.431, 0.03);
check('χ', c.chi, 0.369, 0.04);
check('Nb,Rd [kN]', c.NbRd, 247, 0.04);
checkBool('statut', c.statut, 'OK');

const ipe300 = profiles.get('IPE 300');
console.log('IPE 300 S235, flexion');
const fl = steel.flexion({ Wpl: ipe300.Wply, fy: 235, MEd: 100 });
check('Mc,Rd [kN·m]', fl.McRd, 147.6, 0.02);

console.log('IPE 300 S235, traction');
const tr = steel.traction({ A: ipe300.A, fy: 235, NEd: 1000 });
check('Npl,Rd [kN]', tr.NplRd, 1264, 0.02);

console.log('\n=== MÉTRÉ & FONDATIONS ===');
console.log('Semelle isolée NEd=900, Nser=667, σsol=200 kPa, poteau 0.4×0.4');
const sem = quantities.semelleIsolee({ NEd: 900, Nser: 667, sigmaSol: 200, a: 0.4, b: 0.4, fck: 25, fyk: 500 });
check('Côté A [m]', sem.A, 1.85, 0.05);
checkBool('vérif sol', sem.verifSol, true);
check('As/direction [cm²]', sem.AsX, 9.38, 0.08);

console.log('Métré : 4 poteaux 0.3×0.3×3 m');
const m = quantities.metre([{ type: 'poteau', b: 0.3, h: 0.3, longueur: 3, nombre: 4 }]);
check('Volume béton [m³]', m.totaux.beton, 1.08, 0.01); // 0.3·0.3·3·4 = 1.08
check('Coffrage [m²]', m.totaux.coffrage, 14.4, 0.01); // 2·(0.6)·3·4 = 14.4

console.log('\n=== CHARGES CLIMATIQUES (EN 1991) ===');
console.log('Neige zone C1, altitude 300 m, toiture 15°');
const nei = loads.neige({ zone: 'C1', altitude: 300, alpha: 15 });
check('sk (avec altitude) [kN/m²]', nei.sk, 0.75, 0.02);
check('μ1', nei.mu1, 0.8, 0.01);
check('Charge neige s [kN/m²]', nei.s, 0.60, 0.03);

console.log('Vent région 3 (vb0=26), terrain II, z=10 m');
const ven = loads.vent({ region: 3, terrain: 'II', z: 10, cpe: 0.8 });
check('vb [m/s]', ven.vb, 26, 0.01);
check('qp(10 m) [kN/m²]', ven.qp, 0.994, 0.05);
check('ce(z)', ven.ce, 2.35, 0.05);

console.log(`\n===========================================`);
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);
console.log(`===========================================\n`);
process.exit(failed === 0 ? 0 : 1);
