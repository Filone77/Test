/* ============================================================================
 * HydroCalc — Moteur de calcul hydraulique
 * ----------------------------------------------------------------------------
 * Bibliothèque de fonctions PURES (sans effet de bord, sans UI).
 * Reproduit fidèlement les formules des classeurs « Calcul Hydraulique Complet »
 * et « Logiciel Hydraulique », et ajoute des fonctions complémentaires.
 *
 * Unités : SI sauf indication contraire dans le nom/commentaire de la fonction.
 * Fonctionne dans le navigateur (global Hydro.calc) et sous Node (module.exports)
 * afin de permettre des tests automatisés.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var G = 9.81;            // accélération de la pesanteur (m/s²)
  var K_EAU = 2.1e9;       // module d'élasticité de l'eau (Pa)
  var PATM_MCE = 10.33;    // pression atmosphérique au niveau de la mer (m CE)

  // --- Utilitaires numériques -----------------------------------------------
  function log10(x) { return Math.log(x) / Math.LN10; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  /** Arrondi « intelligent » pour l'affichage (ne sert pas aux calculs). */
  function round(x, n) {
    if (!isNum(x)) return x;
    var f = Math.pow(10, n == null ? 3 : n);
    return Math.round(x * f) / f;
  }

  /* =========================================================================
   * 1. PROPRIÉTÉS DU FLUIDE (EAU) — fonction de la température T (°C)
   *    Corrélations issues du classeur « Calcul Hydraulique Complet ».
   * =======================================================================*/

  /** Masse volumique de l'eau (kg/m³). */
  function masseVolumique(T) { return 1000.3 - 0.0178 * Math.pow(T - 4, 1.7); }

  /** Viscosité dynamique (Pa·s). */
  function viscositeDynamique(T) { return 0.001792 * Math.exp(-0.0179 * T); }

  /** Viscosité cinématique ν = μ/ρ (m²/s). */
  function viscositeCinematique(T) {
    return viscositeDynamique(T) / masseVolumique(T);
  }

  /** Pression de vapeur saturante (m CE). */
  function pressionVapeur(T) { return 0.0231 * Math.exp(0.0622 * T); }

  /** Ensemble des propriétés du fluide pour une température donnée. */
  function proprietesEau(T) {
    var rho = masseVolumique(T);
    var mu = viscositeDynamique(T);
    return {
      T: T,
      rho: rho,
      mu: mu,
      nu: mu / rho,
      pv: pressionVapeur(T),
      g: G
    };
  }

  /* =========================================================================
   * 2. CONDUITE EN CHARGE — dimensionnement & pertes de charge linéaires
   * =======================================================================*/

  /** Diamètre théorique (mm) pour une vitesse économique visée.
   *  Q en m³/h, V en m/s. D = √(4Q/πV). */
  function diametreEconomique(Q_m3h, V_eco) {
    return 1000 * Math.sqrt(4 * (Q_m3h / 3600) / (Math.PI * V_eco));
  }

  /** Section hydraulique S = πD²/4 (m²). D en mm. */
  function section(Di_mm) {
    var D = Di_mm / 1000;
    return Math.PI * D * D / 4;
  }

  /** Vitesse d'écoulement V = Q/S (m/s). Q en m³/h, S en m². */
  function vitesse(Q_m3h, S_m2) { return (Q_m3h / 3600) / S_m2; }

  /** Vitesse directement à partir du débit et du diamètre intérieur. */
  function vitesseDepuisD(Q_m3h, Di_mm) {
    return vitesse(Q_m3h, section(Di_mm));
  }

  /** Nombre de Reynolds Re = V·D/ν. D en mm, ν en m²/s. */
  function reynolds(V, Di_mm, nu) { return V * (Di_mm / 1000) / nu; }

  /** Régime d'écoulement selon Re. */
  function regime(Re) {
    if (Re < 2000) return 'Laminaire';
    if (Re < 4000) return 'Transition';
    return 'Turbulent';
  }

  /** Coefficient de frottement λ (Darcy) — approximation de Swamee-Jain
   *  de la formule de Colebrook-White. eps et Di en mm. */
  function lambdaSwameeJain(eps_mm, Di_mm, Re) {
    var krel = (eps_mm / 1000) / (3.7 * (Di_mm / 1000)); // = eps/(3.7·Di)
    var d = log10(krel + 5.74 / Math.pow(Re, 0.9));
    return 0.25 / (d * d);
  }

  /** Coefficient de frottement λ — résolution itérative de Colebrook-White.
   *  Plus précis que Swamee-Jain ; converge en quelques itérations. */
  function lambdaColebrook(eps_mm, Di_mm, Re) {
    if (Re < 2000) return 64 / Re; // régime laminaire
    var krel = (eps_mm / 1000) / (Di_mm / 1000);
    var f = lambdaSwameeJain(eps_mm, Di_mm, Re); // valeur initiale
    for (var i = 0; i < 30; i++) {
      var inv = -2 * log10(krel / 3.7 + 2.51 / (Re * Math.sqrt(f)));
      var fn = 1 / (inv * inv);
      if (Math.abs(fn - f) < 1e-9) { f = fn; break; }
      f = fn;
    }
    return f;
  }

  /** Perte de charge linéaire unitaire J = λ·(1/D)·(V²/2g) (m/m). D en mm. */
  function pertesUnitaire(lambda, Di_mm, V) {
    return lambda * (1 / (Di_mm / 1000)) * (V * V / (2 * G));
  }

  /** Calcul complet d'une conduite en charge.
   *  opts: { Q_m3h, Di_mm, L_m, eps_mm, T, methode } methode = 'swamee'|'colebrook'
   *  Retourne toutes les grandeurs intermédiaires. */
  function conduite(opts) {
    var T = opts.T == null ? 15 : opts.T;
    var nu = opts.nu != null ? opts.nu : viscositeCinematique(T);
    var S = section(opts.Di_mm);
    var V = vitesse(opts.Q_m3h, S);
    var Re = reynolds(V, opts.Di_mm, nu);
    var lam = (opts.methode === 'colebrook')
      ? lambdaColebrook(opts.eps_mm, opts.Di_mm, Re)
      : lambdaSwameeJain(opts.eps_mm, opts.Di_mm, Re);
    var J = pertesUnitaire(lam, opts.Di_mm, V);
    var dHlin = J * opts.L_m;
    return {
      S: S, V: V, Re: Re, regime: regime(Re),
      lambda: lam, J: J, dHlin: dHlin, nu: nu,
      vitesseOK: V >= 0.5 && V <= 2
    };
  }

  /* =========================================================================
   * 3. PERTES DE CHARGE SINGULIÈRES
   * =======================================================================*/

  /** Perte de charge d'une singularité : ΔH = ξ·V²/2g (m). */
  function perteSinguliere(ksi, V) { return ksi * V * V / (2 * G); }

  /** Total des pertes singulières à partir d'une liste {ksi, n}.
   *  Retourne { ksiTotal, dH }. */
  function pertesSingulieres(items, V) {
    var ksiTotal = 0;
    for (var i = 0; i < items.length; i++) {
      var n = items[i].n == null ? 1 : items[i].n;
      ksiTotal += items[i].ksi * n;
    }
    return { ksiTotal: ksiTotal, dH: perteSinguliere(ksiTotal, V) };
  }

  /* =========================================================================
   * 4. STATION DE POMPAGE — HMT, puissance, NPSH
   * =======================================================================*/

  /** Hauteur Manométrique Totale (m).
   *  HMT = |Hgéo| + ΔHtot + Prés + ΔHstation. */
  function hmt(Hgeo, dHtot, Pres, dHstation) {
    return Math.abs(Hgeo) + dHtot + (Pres || 0) + (dHstation || 0);
  }

  /** Puissance hydraulique Ph = ρ·g·Q·HMT/1000 (kW). Q en m³/h. */
  function puissanceHydraulique(rho, Q_m3h, HMT) {
    return rho * G * (Q_m3h / 3600) * HMT / 1000;
  }

  /** Bilan de puissance d'un groupe de pompage.
   *  Retourne Ph, Pabs (arbre), Pelec (absorbée), Pinst (moteur). */
  function puissancePompe(rho, Q_m3h, HMT, etaP, etaM, coefSurdim) {
    var Ph = puissanceHydraulique(rho, Q_m3h, HMT);
    var Parbre = Ph / etaP;
    var Pelec = Parbre / etaM;
    var Pinst = Pelec * (coefSurdim == null ? 1.15 : coefSurdim);
    return {
      Ph: Ph, Parbre: Parbre, Pelec: Pelec, Pinst: Pinst,
      etaGlobal: etaP * etaM
    };
  }

  /** Correction de la pression atmosphérique avec l'altitude (m CE).
   *  Patm' = Patm·(1 - (1 - alt/44330)^5.255). */
  function patmAltitude(Patm_mce, alt_m) {
    var delta = Patm_mce * (1 - Math.pow(1 - alt_m / 44330, 5.255));
    return Patm_mce - delta;
  }

  /** NPSH disponible (m). Toutes les grandeurs en m CE / m.
   *  NPSHd = Patm' - Pv - Hasp - ΔHasp. */
  function npshDisponible(Patm_mce, Pv_mce, Hasp, dHasp) {
    return Patm_mce - Pv_mce - Hasp - dHasp;
  }

  /* =========================================================================
   * 5. COUP DE BÉLIER — régimes transitoires
   * =======================================================================*/

  /** Célérité de l'onde de pression (m/s).
   *  a = √( K/ρ / (1 + K·D/(E·e)) ). D, e en m ; E, K en Pa. */
  function celerite(K, rho, D_m, E, e_m) {
    return Math.sqrt((K / rho) / (1 + (K * D_m) / (E * e_m)));
  }

  /** Surpression de Joukowsky — fermeture rapide : ΔH = a·V/g (m). */
  function joukowsky(a, V) { return a * V / G; }

  /** Surpression — fermeture lente : ΔH = 2·L·V/(g·Tf) (m). */
  function surpressionLente(L, V, Tf) { return 2 * L * V / (G * Tf); }

  /** Analyse complète du coup de bélier.
   *  opts: { K, rho, D_m, E, e_m, L, V, Tf, Pservice } */
  function coupBelier(opts) {
    var K = opts.K == null ? K_EAU : opts.K;
    var a = celerite(K, opts.rho, opts.D_m, opts.E, opts.e_m);
    var Tar = 2 * opts.L / a;                 // temps aller-retour de l'onde
    var lente = opts.Tf > Tar;
    var dHrapide = joukowsky(a, opts.V);
    var dHlente = surpressionLente(opts.L, opts.V, opts.Tf);
    var dH = lente ? dHlente : dHrapide;
    var Pmax = opts.Pservice + dH;
    return {
      a: a, Tar: Tar, lente: lente,
      typeFermeture: lente ? 'Fermeture lente' : 'Fermeture rapide',
      dHrapide: dHrapide, dHlente: dHlente, dH: dH,
      Pmax: Pmax, Pmax_bar: Pmax / 10.2,
      classePN: classePN(Pmax / 10.2)
    };
  }

  /** Classe de pression normalisée à partir d'une pression en bar. */
  function classePN(bar) {
    if (bar < 6) return 'PN6';
    if (bar < 10) return 'PN10';
    if (bar < 16) return 'PN16';
    if (bar < 25) return 'PN25';
    return 'PN40';
  }

  /* =========================================================================
   * 6. BÂCHE DE POMPAGE
   * =======================================================================*/

  /** Volume utile par la méthode de la fréquence de démarrage (m³).
   *  Vu = Qp/(4·f). Qp débit pompe (m³/h), f démarrages/heure. */
  function volumeFrequence(Qp_m3h, f) { return Qp_m3h / (4 * f); }

  /** Volume utile par la méthode du temps de rétention (m³).
   *  Vu = Qe·Tr. Qe (m³/h), Tr (min). */
  function volumeRetention(Qe_m3h, Tr_min) { return Qe_m3h * Tr_min / 60; }

  /** Dimensionnement complet de la bâche. */
  function bache(opts) {
    var Vu1 = volumeFrequence(opts.Qp_m3h, opts.f);
    var Vu2 = volumeRetention(opts.Qe_m3h, opts.Tr_min);
    var Vu = Math.max(Vu1, Vu2);
    var Vtot = Vu * (1 + (opts.marge || 0) / 100);
    var S = Vtot / opts.Hu;
    return { Vu1: Vu1, Vu2: Vu2, Vu: Vu, Vtot: Vtot, S: S, cote: Math.sqrt(S) };
  }

  /* =========================================================================
   * 7. BILAN ÉNERGÉTIQUE
   * =======================================================================*/

  /** Bilan énergétique annuel.
   *  opts: { Van (m³/an), Q_m3h, Pabs (kW), FC, prixkWh } */
  function energie(opts) {
    var Hf = opts.Van / opts.Q_m3h;            // heures de fonctionnement/an
    var E = opts.Pabs * Hf * opts.FC;          // kWh/an
    var cout = E * opts.prixkWh;               // €/an
    return {
      Hf: Hf, E: E, cout: cout,
      consoSpecifique: E / opts.Van,           // kWh/m³
      coutSpecifique: cout / opts.Van          // €/m³
    };
  }

  /* =========================================================================
   * 8. ÉCOULEMENT À SURFACE LIBRE — Manning-Strickler
   * =======================================================================*/

  /** Vitesse de Manning V = (1/n)·Rh^(2/3)·I^(1/2) (m/s). */
  function manningV(n, Rh, I) {
    return (1 / n) * Math.pow(Rh, 2 / 3) * Math.sqrt(I);
  }

  /** Conduite circulaire — section pleine. D en mm. */
  function manningCirculairePlein(D_mm, I, n) {
    var D = D_mm / 1000;
    var S = Math.PI * D * D / 4;
    var P = Math.PI * D;
    var Rh = S / P; // = D/4
    var V = manningV(n, Rh, I);
    return { S: S, P: P, Rh: Rh, V: V, Q: V * S, Q_Ls: V * S * 1000,
             vitesseOK: V >= 0.6 && V <= 4 };
  }

  /** Conduite circulaire — remplissage partiel. D en mm, h profondeur (mm). */
  function manningCirculairePartiel(D_mm, h_mm, I, n) {
    var D = D_mm / 1000, h = h_mm / 1000;
    if (h <= 0) return { S: 0, P: 0, Rh: 0, V: 0, Q: 0, Q_Ls: 0, theta: 0, taux: 0 };
    if (h > D) h = D;
    var theta = 2 * Math.acos(1 - 2 * h / D);   // angle au centre (rad)
    var S = (D * D / 8) * (theta - Math.sin(theta));
    var P = (D * theta) / 2;
    var Rh = S / P;
    var V = manningV(n, Rh, I);
    return {
      theta: theta, taux: h / D,
      S: S, P: P, Rh: Rh, V: V, Q: V * S, Q_Ls: V * S * 1000,
      vitesseOK: V >= 0.6 && V <= 4
    };
  }

  /* =========================================================================
   * 9. MÉTHODE DES PLUIES — volume de stockage (assainissement pluvial)
   * =======================================================================*/

  /** Intensité de Montana i = a·t^(-b) (mm/min). t en min. */
  function montana(a, b, t_min) { return a * Math.pow(t_min, -b); }

  /** Table de la méthode des pluies.
   *  opts: { Sa (ha, = S·Cr), a, b, q (L/s/ha), durees [min] }
   *  Retourne { lignes:[{t,i,Ve,Vs,Vstock}], Vstockage, dureeCritique }. */
  function methodePluies(opts) {
    var durees = opts.durees || [5,10,15,20,30,40,50,60,75,90,105,120,150,180];
    var lignes = [], best = -Infinity, tcrit = null;
    for (var k = 0; k < durees.length; k++) {
      var t = durees[k];
      var i = montana(opts.a, opts.b, t);
      var Ve = i * t * opts.Sa * 10;            // volume entrant (m³)
      var Vs = opts.q * opts.Sa * t * 60 / 1000; // volume sortant (m³)
      var Vstock = Math.max(0, Ve - Vs);
      lignes.push({ t: t, i: i, Ve: Ve, Vs: Vs, Vstock: Vstock });
      if (Vstock > best) { best = Vstock; tcrit = t; }
    }
    return { lignes: lignes, Vstockage: best, dureeCritique: tcrit };
  }

  /* =========================================================================
   * 10. BASSIN DE RÉTENTION
   * =======================================================================*/

  /** Diamètre d'orifice de fuite (mm) pour un débit Qf donné.
   *  Q = Cd·A·√(2gH) → d = √(4A/π). Qf en m³/s, H en m. */
  function diametreOrifice(Qf_m3s, Cd, H) {
    var A = Qf_m3s / (Cd * Math.sqrt(2 * G * H));
    return Math.sqrt(4 * A / Math.PI) * 1000;
  }

  /** Dimensionnement du bassin de rétention. */
  function bassin(opts) {
    var Smiroir = opts.V / opts.h;
    var l = Math.sqrt(Smiroir / 2);
    var Qf_si = opts.Qf_Ls / 1000;
    return {
      Smiroir: Smiroir,
      largeur: l,
      longueur: 2 * l,
      Qf_si: Qf_si,
      dOrifice: diametreOrifice(Qf_si, opts.Cd, opts.H),
      tempsVidange: opts.V / Qf_si / 3600 // h
    };
  }

  /* =========================================================================
   * 11. ORIFICES & DÉVERSOIRS (fonctions complémentaires)
   * =======================================================================*/

  /** Débit d'un orifice noyé/dénoyé : Q = Cd·A·√(2gH) (m³/s). */
  function debitOrifice(Cd, A, H) { return Cd * A * Math.sqrt(2 * G * H); }

  /** Débit d'un déversoir rectangulaire : Q = (2/3)·Cd·b·√(2g)·H^(3/2). */
  function deversoirRectangulaire(Cd, b, H) {
    return (2 / 3) * Cd * b * Math.sqrt(2 * G) * Math.pow(H, 1.5);
  }

  /** Débit d'un déversoir triangulaire (V-notch), angle theta (°).
   *  Q = (8/15)·Cd·tan(θ/2)·√(2g)·H^(5/2). */
  function deversoirTriangulaire(Cd, theta_deg, H) {
    var t = Math.tan((theta_deg * Math.PI / 180) / 2);
    return (8 / 15) * Cd * t * Math.sqrt(2 * G) * Math.pow(H, 2.5);
  }

  /* =========================================================================
   * 12. POINT DE FONCTIONNEMENT — courbe réseau × courbe pompe
   * =======================================================================*/

  /** Courbe réseau (caractéristique) : H = Hgéo + R·Q².
   *  R calé sur le point de dimensionnement (dHtot, Qref). */
  function resistanceReseau(dHtot, Qref) {
    return Qref > 0 ? dHtot / (Qref * Qref) : 0;
  }

  /** Point de fonctionnement à l'intersection de :
   *  - réseau : H = Hgeo + R·Q²
   *  - pompe  : H = H0 - alpha·Q²  (courbe quadratique simplifiée)
   *  Résolution analytique. Q dans l'unité de Qref. */
  function pointFonctionnement(Hgeo, R, H0, alpha) {
    var denom = R + alpha;
    if (denom <= 0) return { Q: NaN, H: NaN };
    var Q2 = (H0 - Hgeo) / denom;
    if (Q2 < 0) return { Q: NaN, H: NaN };
    var Q = Math.sqrt(Q2);
    return { Q: Q, H: Hgeo + R * Q2 };
  }

  /** Détermine (H0, alpha) d'une pompe à partir de la hauteur à débit nul (H0)
   *  et d'un point de fonctionnement nominal (Qn, Hn). */
  function caleCourbePompe(H0, Qn, Hn) {
    var alpha = Qn > 0 ? (H0 - Hn) / (Qn * Qn) : 0;
    return { H0: H0, alpha: alpha };
  }

  /* =========================================================================
   * 13. CONVERSIONS D'UNITÉS
   * =======================================================================*/

  var FACTEURS = {
    debit:    { 'm³/s': 1, 'm³/h': 1/3600, 'L/s': 1e-3, 'L/min': 1e-3/60, 'm³/j': 1/86400 },
    pression: { 'Pa': 1, 'kPa': 1e3, 'bar': 1e5, 'mbar': 1e2, 'm CE': 9806.65, 'mm Hg': 133.322 },
    longueur: { 'm': 1, 'mm': 1e-3, 'cm': 1e-2, 'km': 1e3, 'in': 0.0254 },
    volume:   { 'm³': 1, 'L': 1e-3, 'hL': 0.1, 'cm³': 1e-6 },
    vitesse:  { 'm/s': 1, 'km/h': 1/3.6, 'm/h': 1/3600 }
  };

  /** Convertit une valeur d'une unité vers une autre dans une grandeur donnée. */
  function convertir(grandeur, valeur, uDe, uVers) {
    var f = FACTEURS[grandeur];
    if (!f || f[uDe] == null || f[uVers] == null) return NaN;
    return valeur * f[uDe] / f[uVers];
  }

  /* =========================================================================
   * Export
   * =======================================================================*/

  var Hydro = root.Hydro || (root.Hydro = {});
  Hydro.calc = {
    // constantes & utilitaires
    G: G, K_EAU: K_EAU, PATM_MCE: PATM_MCE, FACTEURS: FACTEURS,
    log10: log10, round: round, isNum: isNum,
    // fluide
    masseVolumique: masseVolumique, viscositeDynamique: viscositeDynamique,
    viscositeCinematique: viscositeCinematique, pressionVapeur: pressionVapeur,
    proprietesEau: proprietesEau,
    // conduite
    diametreEconomique: diametreEconomique, section: section,
    vitesse: vitesse, vitesseDepuisD: vitesseDepuisD, reynolds: reynolds,
    regime: regime, lambdaSwameeJain: lambdaSwameeJain,
    lambdaColebrook: lambdaColebrook, pertesUnitaire: pertesUnitaire,
    conduite: conduite,
    // singulières
    perteSinguliere: perteSinguliere, pertesSingulieres: pertesSingulieres,
    // pompage
    hmt: hmt, puissanceHydraulique: puissanceHydraulique,
    puissancePompe: puissancePompe, patmAltitude: patmAltitude,
    npshDisponible: npshDisponible,
    // bélier
    celerite: celerite, joukowsky: joukowsky, surpressionLente: surpressionLente,
    coupBelier: coupBelier, classePN: classePN,
    // bâche
    volumeFrequence: volumeFrequence, volumeRetention: volumeRetention, bache: bache,
    // énergie
    energie: energie,
    // surface libre
    manningV: manningV, manningCirculairePlein: manningCirculairePlein,
    manningCirculairePartiel: manningCirculairePartiel,
    // pluies & bassin
    montana: montana, methodePluies: methodePluies,
    diametreOrifice: diametreOrifice, bassin: bassin,
    // orifices & déversoirs
    debitOrifice: debitOrifice, deversoirRectangulaire: deversoirRectangulaire,
    deversoirTriangulaire: deversoirTriangulaire,
    // point de fonctionnement
    resistanceReseau: resistanceReseau, pointFonctionnement: pointFonctionnement,
    caleCourbePompe: caleCourbePompe,
    // conversions
    convertir: convertir
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Hydro.calc;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
