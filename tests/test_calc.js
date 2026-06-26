/* ============================================================================
 * HydroCalc — Tests du moteur de calcul
 * ----------------------------------------------------------------------------
 * Vérifie les fonctions de assets/js/hydraulics.js contre les valeurs des
 * classeurs de référence. Lancer avec :  node tests/test_calc.js
 * ==========================================================================*/
var C = require('../assets/js/hydraulics.js');

var pass = 0, fail = 0;
function check(name, got, exp, tol) {
  tol = tol == null ? 0.02 : tol;
  var ok = Math.abs(got - exp) <= Math.abs(exp) * tol + 1e-9;
  console.log((ok ? '  OK  ' : ' FAIL ') + name +
    '  (obtenu=' + C.round(got, 5) + ', attendu=' + C.round(exp, 5) + ')');
  ok ? pass++ : fail++;
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* --- Propriétés de l'eau (T = 15 °C) ------------------------------------- */
section('Propriétés de l\'eau');
var p = C.proprietesEau(15);
check('Masse volumique ρ(15)', p.rho, 999.25);
check('Viscosité dynamique μ(15)', p.mu, 0.0013676);
check('Viscosité cinématique ν(15)', p.nu, 1.3686e-6);
check('Pression de vapeur Pv(15)', p.pv, 0.05875);

/* --- Conduite (classeur 1) ----------------------------------------------- */
section('Conduite & pertes linéaires');
check('Diamètre éco (200 m³/h, 1,5 m/s)', C.diametreEconomique(200, 1.5), 217.16);
check('Section (Di=150)', C.section(150), 0.017671);
check('Vitesse (200 m³/h, Di=150)', C.vitesseDepuisD(200, 150), 3.1438);
var cond = C.conduite({ Q_m3h: 200, Di_mm: 150, L_m: 160, eps_mm: 0.01, T: 15, methode: 'swamee' });
check('Reynolds', cond.Re, 343947, 0.01);
check('Coefficient λ (Swamee-Jain)', cond.lambda, 0.01478, 0.02);
check('Perte unitaire J', cond.J, 0.0497, 0.03);
check('Pertes linéaires ΔHlin', cond.dHlin, 7.955, 0.03);

/* --- Pertes singulières -------------------------------------------------- */
section('Pertes singulières');
var sing = C.pertesSingulieres([{ ksi: 0.3, n: 1 }, { ksi: 0.5, n: 1 }, { ksi: 0.2, n: 1 }], 3.1438);
check('Σξ (3 coudes)', sing.ksiTotal, 1.0);
check('ΔHsing', sing.dH, 1.0 * 3.1438 * 3.1438 / (2 * 9.81), 0.001);

/* --- Pompage (classeur 1) ------------------------------------------------ */
section('Station de pompage');
var HMT = C.hmt(5, 7.955, 20, 2);
check('HMT', HMT, 34.955);
var HMTdim = HMT * 1.1;
check("HMT' (marge 10 %)", HMTdim, 38.45);
var pp = C.puissancePompe(999.25, 200, HMTdim, 0.75, 0.92, 1.15);
check('Puissance hydraulique Ph', pp.Ph, 999.25 * 9.81 * (200 / 3600) * 38.45 / 1000, 0.005);
check('Rendement global ηg', pp.etaGlobal, 0.69);
check('Puissance absorbée Pelec', pp.Pelec, pp.Ph / 0.69, 0.005);
var patm = C.patmAltitude(10.33, 0);
check('Patm corrigée (alt 0)', patm, 10.33);
check('NPSH disponible', C.npshDisponible(patm, 0.05875, 2, 0.5), 7.7713, 0.001);

/* --- Coup de bélier (acier) ---------------------------------------------- */
section('Coup de bélier');
var cb = C.coupBelier({ rho: 999.25, D_m: 0.15, E: 200e9, e_m: 0.01, L: 160, V: 3.1438, Tf: 5, Pservice: 38.45 });
check('Célérité a (acier)', cb.a, 1347.4, 0.005);
check('Temps aller-retour Tar', cb.Tar, 2 * 160 / cb.a, 0.001);
check('Surpression lente (Michaud)', cb.dHlente, 2 * 160 * 3.1438 / (9.81 * 5), 0.001);

/* --- Bâche --------------------------------------------------------------- */
section('Bâche de pompage');
var ba = C.bache({ Qp_m3h: 100, Qe_m3h: 200, f: 6, Tr_min: 10, marge: 20, Hu: 2 });
check('Vu1 = Qp/(4f)', ba.Vu1, 100 / 24);
check('Vu2 = Qe·Tr', ba.Vu2, 200 * 10 / 60);
check('Vtot (marge 20 %)', ba.Vtot, Math.max(100 / 24, 200 * 10 / 60) * 1.2);

/* --- Énergie ------------------------------------------------------------- */
section('Bilan énergétique');
var en = C.energie({ Van: 5000, Q_m3h: 200, Pabs: 30, FC: 0.7, prixkWh: 0.15 });
check('Heures fonctionnement Hf', en.Hf, 25);
check('Consommation E', en.E, 30 * 25 * 0.7);
check('Coût annuel', en.cout, 30 * 25 * 0.7 * 0.15);

/* --- Manning (classeur 2) ------------------------------------------------ */
section('Écoulement à surface libre (Manning)');
var mn = C.manningCirculairePlein(300, 0.005, 0.013);
check('Rayon hydraulique Rh = D/4', mn.Rh, 0.075);
check('Vitesse Manning', mn.V, (1 / 0.013) * Math.pow(0.075, 2 / 3) * Math.sqrt(0.005), 0.001);
check('Débit capacité (L/s)', mn.Q_Ls, mn.V * mn.S * 1000, 0.001);
// Remplissage partiel : à mi-hauteur, Rh = D/4 également (propriété connue)
var mp = C.manningCirculairePartiel(300, 150, 0.005, 0.013);
check('Partiel h/D=0,5 : Rh = D/4', mp.Rh, 0.075, 0.001);

/* --- Méthode des pluies (classeur 2) ------------------------------------- */
section('Méthode des pluies');
var pl = C.methodePluies({ Sa: 1, a: 5.9, b: 0.62, q: 3 });
check('Intensité i(5 min)', pl.lignes[0].i, 5.9 * Math.pow(5, -0.62), 0.001);
check('Volume entrant (5 min)', pl.lignes[0].Ve, 5.9 * Math.pow(5, -0.62) * 5 * 1 * 10, 0.001);
check('Volume sortant (5 min)', pl.lignes[0].Vs, 3 * 1 * 5 * 60 / 1000, 0.001);

/* --- Bassin de rétention (classeur 2) ------------------------------------ */
section('Bassin de rétention');
var bs = C.bassin({ V: 250, h: 1.5, Qf_Ls: 5, Cd: 0.62, H: 1.2 });
check('Surface miroir = V/h', bs.Smiroir, 250 / 1.5);
check('Diamètre orifice de fuite', bs.dOrifice, C.diametreOrifice(5e-3, 0.62, 1.2), 0.001);
check('Temps de vidange (h)', bs.tempsVidange, 250 / 5e-3 / 3600, 0.001);

/* --- Conversions --------------------------------------------------------- */
section('Conversions d\'unités');
check('180 m³/h -> L/s', C.convertir('debit', 180, 'm³/h', 'L/s'), 50);
check('1 bar -> m CE', C.convertir('pression', 1, 'bar', 'm CE'), 10.197, 0.001);
check('1 m³/s -> m³/h', C.convertir('debit', 1, 'm³/s', 'm³/h'), 3600);

/* --- Bilan --------------------------------------------------------------- */
console.log('\n========================================');
console.log('  ' + pass + ' tests réussis, ' + fail + ' échecs');
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
