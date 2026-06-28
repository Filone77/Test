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
const pressure = require('../js/engine/pressure.js');
const pumping = require('../js/engine/pumping.js');
const validator = require('../js/engine/validator.js');
const weirs = require('../js/engine/weirs.js');
const sludge = require('../js/engine/sludge.js');
const distribution = require('../js/engine/distribution.js');
const channel = require('../js/engine/channel.js');
const rainwater = require('../js/engine/rainwater.js');
const earthwork = require('../js/engine/earthwork.js');
const detention = require('../js/engine/detention.js');
const network = require('../js/engine/network.js');
const road = require('../js/engine/road.js');

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

console.log('\n=== CONDUITE SOUS PRESSION ===');
console.log('Q=50 L/s, DN200, L=500 m, PEHD, e=12 mm');
const co = pressure.conduite({ Qls: 50, D: 200, L: 500, materiau: 'PEHD (PE100)', e: 12, Pservice: 6 });
check('Vitesse [m/s]', co.V, 1.59, 0.02);
check('Facteur de friction f (PEHD lisse, ks/D=5e-5)', co.f, 0.0148, 0.05);
check('Perte de charge linéaire [m]', co.Jlin, 4.79, 0.05);
check('Célérité [m/s]', co.celerite, 264, 0.05);
check('Surpression coup de bélier [m]', co.surge, 42.8, 0.06);

console.log('\n=== STATION DE POMPAGE ===');
console.log('Q=100 m³/h, Hgeo=15, J=5 m, ηp=0.7, ηm=0.9, Z=10');
const st = pumping.station({ Q: 100, Hgeo: 15, Jasp: 0.5, Jref: 4.5, etaPompe: 0.7, etaMoteur: 0.9, Z: 10, Hasp: 2, NPSHr: 3 });
check('HMT [m]', st.HMT, 20, 0.01);
check('Puissance électrique [kW]', st.Pelec, 8.65, 0.03);
check('Volume utile bâche [m³]', st.Vu, 2.5, 0.01);
check('NPSH disponible [m]', st.NPSHd, 7.59, 0.02);
checkBool('cavitation OK', st.cavitationOk, true);

console.log('\n=== VÉRIFICATEUR DE NOTE ===');
const v1 = validator.verifier('ba_flexion', { MEd: 200, b: 300, h: 500, d: 450, fck: 25, fyk: 500, As_note: 1200 });
checkBool('note conforme (As=1200 ≥ 1150)', v1.verdict === 'CONFORME', true);
const v2 = validator.verifier('ba_flexion', { MEd: 200, b: 300, h: 500, d: 450, fck: 25, fyk: 500, As_note: 900 });
checkBool('note non conforme (As=900 < 1150)', v2.verdict === 'NON CONFORME', true);
const v3 = validator.verifier('canalisation', { Qls: 120, I: 0.005, K: 80, DN_note: 315 });
checkBool('canalisation : verdict produit', typeof v3.verdict === 'string', true);
const v4 = validator.verifier('rdm', { L: 6, w: 10, EI: 10000, Mmax_note: 45, fleche_note: 16.875 });
checkBool('RDM conforme (Mmax=45, f=16,9)', v4.verdict === 'CONFORME', true);
const v5 = validator.verifier('acier', { A: 28.5, Iz: 142, fy: 235, Lcr: 3, NEd: 200, taux_note: 0.81 });
checkBool('acier conforme (taux≈0,81)', v5.verdict === 'CONFORME', true);

console.log('\n=== DÉVERSOIRS ===');
const wr = weirs.rectangulaire({ b: 2, H: 0.3, Cd: 0.62 });
check('Seuil rectangulaire Q [m³/s]', wr.Q, 0.602, 0.02);
const wt = weirs.triangulaire({ theta: 90, H: 0.2, Cd: 0.58 });
check('Seuil triangulaire (V90°) Q [L/s]', wt.Qls, 24.5, 0.03);
const wo = weirs.deversoirOrage({ Qamont: 600, Qconserve: 150, b: 3, Cd: 0.62 });
check('Déversoir d’orage : débit déversé [L/s]', wo.Qdeverse, 450, 0.01);

console.log('\n=== RÉSEAUX BOUES ===');
const sp = sludge.proprietes({ C: 4, rhoS: 1450 });
check('Masse volumique boue 4% [kg/m³]', sp.rho, 1012.6, 0.01);
const sm = sludge.bilanMasse({ Q: 10, C: 4, rhoS: 1450 });
check('Débit matière sèche [kg/h]', sm.Mds_kgh, 405, 0.02);
const se = sludge.epaississement({ Q1: 100, C1: 1, C2: 4 });
check('Épaississement : volume final [m³/h]', se.Q2, 25, 0.01);

console.log('\n=== RÉPARTITEUR PASSIF ===');
const dr = distribution.repartition({ Qtotal: 300, outlets: [
  { nom: 'T1', Cd: 0.6, D: 200, z: 0 }, { nom: 'T2', Cd: 0.6, D: 200, z: 0 }, { nom: 'T3', Cd: 0.6, D: 200, z: 0 }
] });
check('Niveau d’équilibre [m]', dr.niveau, 1.435, 0.03);
check('Débit par tuyau identique [L/s]', dr.detail[0].Q, 100, 0.03);

console.log('\n=== POINT DE FONCTIONNEMENT ===');
const pf = pumping.pointFonctionnement({ Hgeo: 10, Qd: 100, Jd: 8, H0: 25, Qn: 120, Hn: 18 });
check('Débit de fonctionnement Qop [m³/h]', pf.Qop, 108, 0.02);
check('HMT de fonctionnement Hop [m]', pf.Hop, 19.33, 0.02);

console.log('\n=== CANIVEAU (Manning) ===');
const ch = channel.capacite({ forme: 'rectangulaire', b: 0.3, y: 0.2, I: 0.01, K: 70 });
check('Vitesse [m/s]', ch.V, 1.36, 0.03);
check('Débit [L/s]', ch.Qls, 81.6, 0.03);
const chd = channel.dimensionner({ Qls: 81.6, forme: 'rectangulaire', b: 0.3, I: 0.01, K: 70 });
check('Profondeur normale [m]', chd.yNormal, 0.2, 0.04);

console.log('\n=== RÉCUPÉRATION EAUX PLUVIALES ===');
const rw = rainwater.dimensionner({ surface: 100, pluvio: 700, Crunoff: 0.9, etaFiltre: 0.9, demandeJour: 200 });
check('Volume collectable [m³/an]', rw.Vcol, 56.7, 0.02);
check('Volume utile cuve [m³]', rw.Vutile, 3.26, 0.03);
check('Taux de couverture [%]', rw.tauxCouverture, 77.7, 0.03);
checkBool('cuve normalisée = 4 m³', rw.cuveNormalisee === 4, true);

console.log('Simulation journalière (cuve très grande → bilan annuel)');
const sim = rainwater.simulation({ surface: 100, Crunoff: 0.9, etaFiltre: 0.9, pluvio: 700, demandeJour: 200, Vcuve: 500 });
check('Pluviométrie simulée [mm]', sim.pluvioSimulee, 700, 0.02);
check('Taux couverture (V grand) [%]', sim.tauxCouverture, 77.7, 0.05);
const sim0 = rainwater.simulation({ surface: 100, Crunoff: 0.9, etaFiltre: 0.9, pluvio: 700, demandeJour: 200, Vcuve: 1 });
checkBool('couverture croît avec le volume', sim.tauxCouverture > sim0.tauxCouverture, true);

console.log('\n=== TERRASSEMENT EN 1610 ===');
const ew = earthwork.tranchee({ DN: 300, DE: 345, H: 1.5, L: 50, eLit: 0.10, couverture: 0.15, reutiliser: true });
check('Largeur EN 1610 [m]', ew.largeur, 0.845, 0.02);
check('Volume déblai [m³]', ew.Vdeblai, 63.4, 0.02);
check('Volume apport granulaire [m³]', ew.Vapport, 20.5, 0.03);
check('Section tuyau déduite [m³]', ew.Vtuyau, 4.67, 0.03);

console.log('\n=== BASSIN DE RÉTENTION (méthode des pluies) ===');
const ba = detention.bassin({ A: 2, C: 0.8, Qf: 50, a: 6.1, b: 0.69 });
check('Volume de stockage [m³]', ba.volume, 190, 0.1);
checkBool('durée critique 15–45 min', ba.dureeCritique >= 15 && ba.dureeCritique <= 45, true);
const ba2 = detention.bassin({ A: 2, C: 0.8, Qf: 100, a: 6.1, b: 0.69 });
checkBool('débit de fuite ↑ → volume ↓', ba2.volume < ba.volume, true);

console.log('\n=== COURBE DE REMOUS (caniveau) ===');
check('Profondeur critique (rect b=1, Q=1) [m]', channel.profondeurCritique({ forme: 'rectangulaire', b: 1, Q: 1 }), 0.467, 0.02);
check('Profondeur normale (b=1, Q=1, I=0.001, K=50) [m]', channel.profondeurNormale({ forme: 'rectangulaire', b: 1, Q: 1, I: 0.001, K: 50 }), 1.25, 0.05);
const rem = channel.courbeRemous({ forme: 'rectangulaire', b: 1, Q: 1, I: 0.001, K: 50, yAval: 1.6, L: 2000 });
checkBool('profil M1 (yAval > yn > yc)', rem.type === 'M1', true);
checkBool('profil de remous calculé', rem.profil.length > 5, true);

console.log('\n=== RESSAUT HYDRAULIQUE ===');
const rs = channel.ressaut({ b: 0.5, Q: 0.5, y1: 0.15 });
check('Nombre de Froude amont Fr1', rs.Fr1, 5.5, 0.03);
check('Profondeur conjuguée y2 [m]', rs.y2, 1.094, 0.03);
check('Perte d’énergie ΔE [m]', rs.deltaE, 1.281, 0.04);
checkBool('type = ressaut stable', rs.type === 'ressaut stable', true);

console.log('\n=== RÉSEAU GRAVITAIRE — PROFIL EN LONG ===');
const net = network.profil({
  noeuds: [{ nom: 'R1', PM: 0, TN: 100.0 }, { nom: 'R2', PM: 50, TN: 99.5 }, { nom: 'R3', PM: 100, TN: 99.2 }],
  troncons: [{ DN: 300, DE: 345, K: 80, Q: 30, pente: 0.005 }, { DN: 300, DE: 345, K: 80, Q: 40, pente: 0.004 }],
  filEauDepart: 98.5, eLit: 0.10
});
check('Fil d’eau au R3 [m]', net.noeuds[2].filEau, 98.05, 0.001);
check('Couverture au R1 [m]', net.noeuds[0].couverture, 1.16, 0.02);
check('Vitesse tronçon 1 [m/s]', net.troncons[0].V, 0.96, 0.08);
checkBool('remplissage tronçon 1 < 60 %', net.troncons[0].remplissage < 60, true);

console.log('\n=== BÂCHE EP — CHRONIQUE IMPORTÉE ===');
const csv = 'date;pluie_mm\n2020-01-01;5.2\n2020-01-02;0\n2020-01-03;12,4';
const serie = rainwater.parseChronique(csv);
check('Chronique parsée : nb jours', serie.length, 3, 0);
check('Chronique parsée : total [mm]', serie.reduce((a, b) => a + b, 0), 17.6, 0.01);
const serieUnif = new Array(365).fill(2); // 2 mm/j
const simS = rainwater.simulation({ surface: 100, Crunoff: 0.9, etaFiltre: 0.9, demandeJour: 200, Vcuve: 500, serie: serieUnif });
check('Simulation série : couverture [%]', simS.tauxCouverture, 81, 0.03);

console.log('Agrégation sub-journalière (6 min → jour)');
const serie6 = new Array(480).fill(0.1); // 2 jours à pas de 6 min
const agg = rainwater.agregerJournalier(serie6, 6);
check('Nb jours agrégés', agg.length, 2, 0);
check('Pluie journalière agrégée [mm]', agg[0], 24, 0.01);

console.log('\n=== DIMENSIONNEMENT VOIRIE ===');
const rd = road.dimensionner({ MJA: 100, taux: 0.02, annees: 20, CAM: 1.0, module: 100 });
check('Trafic cumulé NPL', rd.NPL, 886858, 0.01);
check('Essieux équivalents NE', rd.NE, 886858, 0.01);
check('Déformation admissible εz [μdef]', rd.epsZadm, 574, 0.03);
checkBool('classe de trafic T3', rd.classeTrafic === 'T3', true);
checkBool('plateforme PF2qs', rd.classePlateforme === 'PF2qs', true);

console.log('\n=== RÉSEAU — OPTIMISATION FIL D’EAU (chutes) ===');
const opt = network.optimiser({
  noeuds: [{ nom: 'R1', PM: 0, TN: 100 }, { nom: 'R2', PM: 50, TN: 99 }, { nom: 'R3', PM: 100, TN: 96 }],
  troncons: [{ DN: 300, DE: 345 }, { DN: 300, DE: 345 }],
  couvertureMin: 0.8, penteMin: 0.003, penteMax: 0.05
});
check('Chute au regard R3 [m]', opt.chutes[2], 0.5, 0.05);
checkBool('au moins un décrochement', opt.nbChutes >= 1, true);

console.log('\n=== RÉSEAU — MISE EN CHARGE ===');
const charge = network.ligneCharge({
  noeuds: [{ nom: 'A', PM: 0, TN: 100 }, { nom: 'B', PM: 100, TN: 99.6 }],
  troncons: [{ DN: 300, DE: 345, K: 80, Q: 150, pente: 0.004 }],
  filEauDepart: 98.0
}, 98.0);
checkBool('mise en charge détectée (Q=150 > capacité)', charge.miseEnCharge, true);

console.log('\n=== RESSAUT LOCALISÉ ===');
const rl = channel.ressautLocalise({ b: 1, Q: 2, I: 0.006, K: 50, yAmont: 0.35, yAval: 0.9, L: 80 });
checkBool('ressaut présent', rl.ressautPresent, true);
checkBool('y1 < yc < y2', rl.y1 < rl.yc && rl.y2 > rl.yc, true);
check('position du ressaut [m]', rl.position, 12, 0.3);

console.log(`\n===========================================`);
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);
console.log(`===========================================\n`);
process.exit(failed === 0 ? 0 : 1);
