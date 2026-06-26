/* ============================================================================
 * HydroCalc — Moteur de calcul (extensions avancées)
 * ----------------------------------------------------------------------------
 * Fonctions PURES complémentaires : Hazen-Williams, multi-tronçons & profil
 * piézométrique, sections non circulaires (Manning), longueurs équivalentes,
 * méthode rationnelle & temps de concentration, courbes de pompe (ajustement
 * 3 points, parallèle/série), ballon anti-bélier, bassin à talus, réseau
 * maillé (Hardy-Cross).
 * Étend l'objet Hydro.calc défini dans hydraulics.js.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro || (root.Hydro = {});
  var C = Hydro.calc || (Hydro.calc = {});
  var G = C.G || 9.81;

  /* =========================================================================
   * 1. HAZEN-WILLIAMS  (adduction d'eau potable)
   *    hf = 10,67 · L · Q^1,852 / (Chw^1,852 · D^4,87)   [SI]
   * =======================================================================*/

  /** Perte de charge unitaire J (m/m). Q en m³/h, D en mm. */
  function hazenWilliamsJ(Q_m3h, Di_mm, Chw) {
    var Q = Q_m3h / 3600, D = Di_mm / 1000;
    return 10.67 * Math.pow(Q, 1.852) / (Math.pow(Chw, 1.852) * Math.pow(D, 4.87));
  }

  /** Calcul complet d'un tronçon par Hazen-Williams. */
  function hazenWilliams(Q_m3h, Di_mm, L_m, Chw) {
    var S = C.section(Di_mm);
    var V = C.vitesse(Q_m3h, S);
    var J = hazenWilliamsJ(Q_m3h, Di_mm, Chw);
    return { S: S, V: V, J: J, dHlin: J * L_m };
  }

  /* =========================================================================
   * 2. CONDUITE MULTI-TRONÇONS EN SÉRIE + PROFIL PIÉZOMÉTRIQUE
   *    Chaque tronçon : { Q_m3h, Di_mm, L_m, dz, eps_mm | Chw, ksi }
   * =======================================================================*/

  /** opts: { methode:'swamee'|'colebrook'|'hazen', nu, Hdepart (m) }
   *  Retourne le détail par tronçon, les totaux et les points du profil
   *  (longueur cumulée, cote terrain, ligne piézométrique). */
  function reseauSerie(troncons, opts) {
    opts = opts || {};
    var nu = opts.nu != null ? opts.nu : C.viscositeCinematique(15);
    var Lcum = 0, zTerrain = opts.zDepart || 0;
    var Hpiezo = (opts.Hdepart != null ? opts.Hdepart : 0) + zTerrain; // charge totale au départ
    var dHtotal = 0, dzTotal = 0;
    var details = [];
    var profil = [{ L: 0, z: zTerrain, piezo: Hpiezo }];

    troncons.forEach(function (t, i) {
      var seg;
      if (opts.methode === 'hazen') {
        seg = hazenWilliams(t.Q_m3h, t.Di_mm, t.L_m, t.Chw || 130);
        seg.Re = C.reynolds(seg.V, t.Di_mm, nu);
        seg.lambda = NaN;
      } else {
        seg = C.conduite({ Q_m3h: t.Q_m3h, Di_mm: t.Di_mm, L_m: t.L_m,
          eps_mm: t.eps_mm, nu: nu, methode: opts.methode || 'swamee' });
      }
      var dHsing = (t.ksi || 0) * seg.V * seg.V / (2 * G);
      var dH = seg.dHlin + dHsing;
      var dz = t.dz || 0;
      Lcum += t.L_m; zTerrain += dz;
      Hpiezo -= dH;                 // la charge diminue des pertes
      dHtotal += dH; dzTotal += dz;
      details.push({
        index: i + 1, Q: t.Q_m3h, Di: t.Di_mm, L: t.L_m, V: seg.V, Re: seg.Re,
        lambda: seg.lambda, J: seg.J, dHlin: seg.dHlin, dHsing: dHsing, dH: dH,
        Lcum: Lcum, z: zTerrain, piezo: Hpiezo,
        pression: Hpiezo - zTerrain   // pression disponible = charge - cote terrain
      });
      profil.push({ L: Lcum, z: zTerrain, piezo: Hpiezo });
    });

    var pressions = details.map(function (d) { return d.pression; });
    return {
      details: details, profil: profil,
      dHtotal: dHtotal, dzTotal: dzTotal, Ltotal: Lcum,
      pressionMin: pressions.length ? Math.min.apply(null, pressions) : NaN,
      pressionMax: pressions.length ? Math.max.apply(null, pressions) : NaN
    };
  }

  /* =========================================================================
   * 3. SECTIONS NON CIRCULAIRES (Manning-Strickler)
   * =======================================================================*/

  /** Géométrie d'une section. shape: 'rectangulaire'|'trapezoidale'|'triangulaire'
   *  p: { b (m), y (m), m (fruit H:V) }. Retourne { A, P, Rh }. */
  function geomSection(shape, p) {
    var A, P;
    if (shape === 'rectangulaire') {
      A = p.b * p.y; P = p.b + 2 * p.y;
    } else if (shape === 'triangulaire') {
      A = p.m * p.y * p.y; P = 2 * p.y * Math.sqrt(1 + p.m * p.m);
    } else { // trapézoïdale
      A = (p.b + p.m * p.y) * p.y;
      P = p.b + 2 * p.y * Math.sqrt(1 + p.m * p.m);
    }
    return { A: A, P: P, Rh: P > 0 ? A / P : 0 };
  }

  /** Débit et vitesse de Manning pour une section ouverte quelconque. */
  function manningSection(shape, p, I, n) {
    var g = geomSection(shape, p);
    var V = C.manningV(n, g.Rh, I);
    return { A: g.A, P: g.P, Rh: g.Rh, V: V, Q: V * g.A, Q_Ls: V * g.A * 1000,
             vitesseOK: V >= 0.6 && V <= 4 };
  }

  /* =========================================================================
   * 4. LONGUEURS ÉQUIVALENTES
   *    Leq = ξ · D / λ   (longueur de conduite produisant la même perte)
   * =======================================================================*/

  function longueurEquivalente(ksi, Di_mm, lambda) {
    if (!(lambda > 0)) return NaN;
    return ksi * (Di_mm / 1000) / lambda;
  }

  /* =========================================================================
   * 5. MÉTHODE RATIONNELLE & TEMPS DE CONCENTRATION (hydrologie)
   * =======================================================================*/

  /** Débit de pointe : Q (m³/s) = C · i · A / 360.  i en mm/h, A en ha. */
  function methodeRationnelle(Cr, i_mmh, A_ha) {
    return Cr * i_mmh * A_ha / 360;
  }

  /** Temps de concentration de Kirpich (min). L en m, pente I (m/m). */
  function tcKirpich(L_m, I) {
    return 0.0195 * Math.pow(L_m, 0.77) * Math.pow(I, -0.385);
  }

  /** Temps de concentration de Passini (min). A en km², L en km, I m/m.
   *  Formule de base en heures (coef 0,108), convertie en minutes. */
  function tcPassini(A_km2, L_km, I) {
    return 0.108 * Math.pow(A_km2 * L_km, 1 / 3) / Math.sqrt(I) * 60;
  }

  /** Intensité de Montana en mm/h pour une durée en minutes (a en base mm/min). */
  function montanaMmH(a, b, t_min) { return C.montana(a, b, t_min) * 60; }

  /* =========================================================================
   * 6. COURBES DE POMPE
   * =======================================================================*/

  /** Ajuste H = a0 + a1·Q + a2·Q² sur 3 points {Q,H}. Résolution 3×3 (Cramer). */
  function ajustePompe3pts(pts) {
    var p = pts;
    function det3(m) {
      return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
           - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
           + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    }
    var A = p.map(function (q) { return [1, q.Q, q.Q * q.Q]; });
    var b = p.map(function (q) { return q.H; });
    var D = det3(A);
    if (Math.abs(D) < 1e-12) return { a0: NaN, a1: NaN, a2: NaN };
    function col(A, b, c) { return A.map(function (r, i) { var rr = r.slice(); rr[c] = b[i]; return rr; }); }
    return { a0: det3(col(A,b,0))/D, a1: det3(col(A,b,1))/D, a2: det3(col(A,b,2))/D };
  }

  /** Hauteur d'une pompe au débit Q selon les coefficients ajustés. */
  function Hpompe(coef, Q) { return coef.a0 + coef.a1 * Q + coef.a2 * Q * Q; }

  /** Combine n pompes identiques. mode 'parallele' (Q×n) ou 'serie' (H×n). */
  function combinePompes(coef, n, mode, Q) {
    if (mode === 'serie') return n * Hpompe(coef, Q);
    return Hpompe(coef, Q / n); // parallèle : chaque pompe débite Q/n
  }

  /** Point de fonctionnement courbe pompe polynomiale × réseau H=Hgeo+R·Q².
   *  Résout (a2−R)·Q² + a1·Q + (a0−Hgeo) = 0. */
  function pointFonctionnementPoly(coef, Hgeo, R) {
    var A = coef.a2 - R, B = coef.a1, Cc = coef.a0 - Hgeo;
    var Q;
    if (Math.abs(A) < 1e-12) { Q = B !== 0 ? -Cc / B : NaN; }
    else {
      var disc = B * B - 4 * A * Cc;
      if (disc < 0) return { Q: NaN, H: NaN };
      Q = (-B - Math.sqrt(disc)) / (2 * A);
      if (Q < 0) Q = (-B + Math.sqrt(disc)) / (2 * A);
    }
    return { Q: Q, H: Hgeo + R * Q * Q };
  }

  /* =========================================================================
   * 7. BALLON ANTI-BÉLIER  (réservoir d'air, pré-dimensionnement isotherme)
   *    Énergie cinétique de la colonne absorbée par compression isotherme :
   *    ½·ρ·(L·A)·V² = P0·U0·ln(Pmax/P0)  →  U0
   * =======================================================================*/

  /** L,A conduite ; V vitesse ; P0, Pmax pressions absolues (m CE).
   *  Retourne le volume d'air initial U0 (m³) et le volume du ballon. */
  function ballonAntiBelier(rho, L, A, V, P0_mce, Pmax_mce) {
    var P0 = rho * G * P0_mce;            // Pa absolus
    var ratio = Pmax_mce / P0_mce;
    var Ec = 0.5 * rho * (L * A) * V * V; // énergie cinétique (J)
    var U0 = (P0 > 0 && ratio > 1) ? Ec / (P0 * Math.log(ratio)) : NaN; // m³
    var Umax = U0 * ratio;                // détente max (isotherme)
    return { U0: U0, Umax: Umax, volumeBallon: Umax * 1.2, ratio: ratio };
  }

  /* =========================================================================
   * 8. BASSIN À TALUS (volume d'un tronc de pyramide à base rectangulaire)
   *    V = Lb·lb·h + (Lb+lb)·m·h² + (4/3)·m²·h³
   * =======================================================================*/

  function volumeBassinTalus(Lb, lb, h, m) {
    return Lb * lb * h + (Lb + lb) * m * h * h + (4 / 3) * m * m * h * h * h;
  }

  /** Dimensions de fond (carré) pour atteindre un volume cible, par dichotomie. */
  function bassinTalusDepuisVolume(Vcible, h, m, ratio) {
    ratio = ratio || 1; // Lb = ratio · lb
    var lo = 0, hi = 1000;
    for (var i = 0; i < 60; i++) {
      var lb = (lo + hi) / 2, Lb = ratio * lb;
      (volumeBassinTalus(Lb, lb, h, m) < Vcible) ? (lo = lb) : (hi = lb);
    }
    var lb = (lo + hi) / 2;
    return { lb: lb, Lb: ratio * lb, h: h,
             Lhaut: ratio * lb + 2 * m * h, lhaut: lb + 2 * m * h,
             V: volumeBassinTalus(ratio * lb, lb, h, m) };
  }

  /* =========================================================================
   * 9. RÉSEAU MAILLÉ — HARDY-CROSS
   *    Pipes : { r, Q }  (perte = r·Q·|Q|^(n-1), n=2).
   *    Loops : tableaux d'objets { pipe:index, sens:+1|-1 }.
   * =======================================================================*/

  function hardyCross(pipes, loops, opts) {
    opts = opts || {};
    var n = opts.n || 2, maxIt = opts.maxIt || 100, tol = opts.tol || 1e-6;
    var Q = pipes.map(function (p) { return p.Q || 0; });
    var r = pipes.map(function (p) { return p.r; });
    var it, maxDQ = 0;
    for (it = 0; it < maxIt; it++) {
      maxDQ = 0;
      loops.forEach(function (loop) {
        var num = 0, den = 0;
        loop.forEach(function (e) {
          var q = Q[e.pipe] * e.sens;
          var hl = r[e.pipe] * q * Math.pow(Math.abs(q), n - 1);
          num += hl;
          den += n * r[e.pipe] * Math.pow(Math.abs(q), n - 1);
        });
        var dQ = den !== 0 ? -num / den : 0;
        loop.forEach(function (e) { Q[e.pipe] += dQ * e.sens; });
        if (Math.abs(dQ) > maxDQ) maxDQ = Math.abs(dQ);
      });
      if (maxDQ < tol) { it++; break; }
    }
    var debits = Q.map(function (q, i) {
      return { pipe: i, Q: q, perte: r[i] * q * Math.abs(q) };
    });
    return { Q: Q, debits: debits, iterations: it, convergence: maxDQ };
  }

  /* =========================================================================
   * Export — fusion dans Hydro.calc
   * =======================================================================*/
  var ext = {
    hazenWilliamsJ: hazenWilliamsJ, hazenWilliams: hazenWilliams,
    reseauSerie: reseauSerie,
    geomSection: geomSection, manningSection: manningSection,
    longueurEquivalente: longueurEquivalente,
    methodeRationnelle: methodeRationnelle, tcKirpich: tcKirpich,
    tcPassini: tcPassini, montanaMmH: montanaMmH,
    ajustePompe3pts: ajustePompe3pts, Hpompe: Hpompe, combinePompes: combinePompes,
    pointFonctionnementPoly: pointFonctionnementPoly,
    ballonAntiBelier: ballonAntiBelier,
    volumeBassinTalus: volumeBassinTalus, bassinTalusDepuisVolume: bassinTalusDepuisVolume,
    hardyCross: hardyCross
  };
  for (var k in ext) C[k] = ext[k];

  if (typeof module !== 'undefined' && module.exports) module.exports = ext;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
