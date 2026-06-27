/*
 * core.js — Noyau partagé du moteur de calcul "Génie Civil"
 * Constantes, facteurs partiels, données matériaux et utilitaires communs.
 * Compatible navigateur (window.GC) et Node.js (module.exports).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.core = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Facteurs partiels Eurocode (valeurs recommandées) ---
  const FACTEURS = {
    gammaC: 1.5, // béton (ELU durable)
    gammaS: 1.15, // acier d'armature
    gammaM0: 1.0, // acier de construction — résistance section
    gammaM1: 1.0, // acier de construction — instabilité
    alphaCC: 1.0, // coefficient de longue durée (EC2, NF: souvent 1.0)
    Es: 200000, // module acier d'armature [MPa]
    Ea: 210000, // module acier de construction [MPa]
    epsCU2: 0.0035 // déformation ultime béton (fck ≤ 50)
  };

  // --- Classes de béton courantes : fck [MPa] ---
  const BETONS = [12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60];

  // --- Nuances d'acier d'armature : fyk [MPa] ---
  const ACIERS_ARMATURE = [400, 500, 600];

  // --- Nuances d'acier de construction : fy [MPa] ---
  const ACIERS_CONSTRUCTION = {
    S235: 235,
    S275: 275,
    S355: 355,
    S420: 420,
    S460: 460
  };

  // --- Diamètres normalisés d'armatures et aires unitaires [mm²] ---
  const BARRES = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];

  function aireBarre(phi) {
    return Math.PI * phi * phi / 4;
  }

  /**
   * Propriétés du béton dérivées de fck (EN 1992-1-1, §3.1).
   * @param {number} fck [MPa]
   */
  function betonProps(fck, gammaC, alphaCC) {
    gammaC = gammaC || FACTEURS.gammaC;
    alphaCC = (alphaCC == null) ? FACTEURS.alphaCC : alphaCC;
    const fcd = alphaCC * fck / gammaC;
    const fcm = fck + 8;
    const fctm = fck <= 50
      ? 0.30 * Math.pow(fck, 2 / 3)
      : 2.12 * Math.log(1 + fcm / 10);
    const Ecm = 22000 * Math.pow(fcm / 10, 0.3); // [MPa]
    const eta = fck <= 50 ? 1.0 : 1.0 - (fck - 50) / 200; // bloc rectangulaire
    const lambda = fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400;
    return { fck, fcd, fcm, fctm, Ecm, eta, lambda };
  }

  /**
   * Propriétés de l'acier d'armature.
   */
  function acierProps(fyk, gammaS) {
    gammaS = gammaS || FACTEURS.gammaS;
    const fyd = fyk / gammaS;
    return { fyk, fyd, Es: FACTEURS.Es, epsYd: fyd / FACTEURS.Es };
  }

  /**
   * Propose des choix de barres (n × Ø) couvrant une aire d'acier requise.
   * @param {number} AsReq [mm²]
   * @returns {Array<{phi:number, n:number, As:number}>}
   */
  function choisirBarres(AsReq) {
    if (!(AsReq > 0)) return [];
    const out = [];
    for (const phi of BARRES) {
      const a = aireBarre(phi);
      const n = Math.max(2, Math.ceil(AsReq / a));
      if (n <= 12) {
        out.push({ phi, n, As: n * a });
      }
    }
    return out;
  }

  /** Arrondi propre à n décimales. */
  function round(x, n) {
    n = (n == null) ? 2 : n;
    const f = Math.pow(10, n);
    return Math.round(x * f) / f;
  }

  /** Interpolation linéaire de y pour une valeur x dans des séries triées par x. */
  function interp(xs, ys, x) {
    const n = xs.length;
    if (n === 0) return NaN;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    for (let i = 1; i < n; i++) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return ys[i - 1] + t * (ys[i] - ys[i - 1]);
      }
    }
    return ys[n - 1];
  }

  return {
    FACTEURS,
    BETONS,
    ACIERS_ARMATURE,
    ACIERS_CONSTRUCTION,
    BARRES,
    aireBarre,
    betonProps,
    acierProps,
    choisirBarres,
    round,
    interp
  };
});
