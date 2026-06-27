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
const geotech = require('../js/engine/geotech.js');
const trench = require('../js/engine/trench.js');
const retaining = require('../js/engine/retaining.js');
const elements = require('../js/engine/elements.js');
const vrd = require('../js/engine/vrd.js');
const combos = require('../js/engine/combos.js');

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

console.log('\n=== GÉOTECHNIQUE & BLINDAGE ===');
console.log('Poussée active : H=5, γ=18, φ=30, q=10 (sans nappe)');
const ge = geotech.pousseeActive({ H: 5, gamma: 18, phi: 30, q: 10 });
check('Ka', ge.Ka, 0.333, 0.02);
check('Poussée terres Psoil [kN/ml]', ge.Psoil, 75, 0.02);
check('Poussée surcharge Pq [kN/ml]', ge.Pq, 16.67, 0.03);

console.log('Tranchée blindée HEB+bois : H=4, B=3, φ=30, q=10');
const bl = trench.blindageBois({ H: 4, B: 3, gamma: 18, phi: 30, q: 10, sH: 2, nButons: 2, heb: 'HEB 160', fy: 235 });
check('Pression apparente sol [kPa]', bl.pression.pSoil, 15.6, 0.03);
check('Effort buton [kN]', bl.buton.N, 75.7, 0.05);
checkBool('blindage statut', bl.statut === 'OK', true);

console.log('\n=== SOUTÈNEMENT (mur en T) ===');
const mur = retaining.murEnT({ Hs: 4.5, ef: 0.5, eVoile: 0.5, patin: 0.8, talon: 1.7, gamma: 18, phi: 30, delta: 20, q: 10, sigmaAdm: 200, fck: 25, fyk: 500 });
check('FS renversement', mur.renversement.FS, 2.69, 0.05);
check('σ max sous semelle [kPa]', mur.poinconnement.sigMax, 144, 0.06);
checkBool('poinçonnement OK', mur.poinconnement.ok, true);
check('FS glissement', mur.glissement.FS, 0.99, 0.08);

console.log('\n=== ÉLÉMENTS BA ===');
console.log('Dalle 2 sens : lx=4, ly=5, p=10 kN/m²');
const d2 = elements.dalle2sens({ lx: 4, ly: 5, p: 10, h: 200, enrobage: 25, fck: 25, fyk: 500 });
check('α = lx/ly', d2.alpha, 0.8, 0.01);
check('Mx [kN·m/m]', d2.Mx, 8.98, 0.03);
check('My [kN·m/m]', d2.My, 5.35, 0.05);

console.log('Voile porteur : NEd=800, hw=200, lo=3, fck25');
const vo = elements.voile({ NEd: 800, hw: 200, lo: 3, e0: 20, fck: 25 });
check('NRd [kN/ml]', vo.NRd, 1755, 0.05);
checkBool('voile OK', vo.statut === 'OK', true);

console.log('\n=== VRD ===');
console.log('Pluvial rationnel : C=0.8, i=60 mm/h, A=2 ha');
const pl = vrd.pluvialRationnel({ C: 0.8, i: 60, A: 2 });
check('Débit Q [L/s]', pl.Qls, 266.7, 0.02);

console.log('Canalisation Manning : D=300, I=0.005, K=80');
const ca = vrd.canalisation({ Qls: 50, I: 0.005, K: 80, D: 300 });
check('Vitesse pleine [m/s]', ca.impose.V, 1.006, 0.05);
check('Capacité [L/s]', ca.impose.Q, 71, 0.05);

console.log('\n=== COMBINAISONS (EN 1990) ===');
const cb = combos.combinaisons({ G: 100, variables: [
  { nom: 'Q', Q: 50, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
  { nom: 'S', Q: 30, psi0: 0.5, psi1: 0.2, psi2: 0.0 }
] });
check('ELU max', cb.eluMax.valeur, 232.5, 0.01);
check('ELS caractéristique max', cb.elsCMax.valeur, 165, 0.01);
check('ELS quasi-permanente', cb.elsQMax.valeur, 115, 0.02);

console.log(`\n===========================================`);
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);
console.log(`===========================================\n`);
process.exit(failed === 0 ? 0 : 1);
