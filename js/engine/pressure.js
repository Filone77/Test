/*
 * pressure.js — Conduite sous pression (dimensionnement hydraulique complet)
 * Vitesse, pertes de charge (Darcy-Weisbach + Colebrook-White), diamètre
 * économique, épaisseur/contrainte de paroi, coup de bélier (Joukowsky).
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.pressure = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const G = 9.81;
  const RHO = 1000;       // eau [kg/m³]
  const NU = 1.0e-6;      // viscosité cinématique [m²/s]
  const K_EAU = 2.1e9;    // module de compressibilité de l'eau [Pa]

  // Matériaux : rugosité ks [mm], module E [MPa], contrainte admissible σ [MPa]
  const MATERIAUX = {
    'PVC': { ks: 0.01, E: 3000, sigma: 12.5 },
    'PEHD (PE100)': { ks: 0.01, E: 1200, sigma: 8.0 },
    'Fonte ductile': { ks: 0.10, E: 170000, sigma: 200 },
    'Acier': { ks: 0.05, E: 210000, sigma: 160 },
    'Béton': { ks: 0.50, E: 30000, sigma: 2.0 }
  };

  // Diamètres nominaux [mm]
  const DN = [50, 63, 75, 90, 110, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000];

  /** Facteur de friction de Darcy par Colebrook-White (itératif). */
  function colebrook(Re, ksRel) {
    if (Re < 2300) return 64 / Re; // laminaire
    let f = 0.02;
    for (let i = 0; i < 40; i++) {
      const rhs = -2 * Math.log10(ksRel / 3.7 + 2.51 / (Re * Math.sqrt(f)));
      f = 1 / (rhs * rhs);
    }
    return f;
  }

  /**
   * Dimensionnement d'une conduite sous pression.
   * @param {object} p
   * @param {number} p.Qls  débit [L/s]
   * @param {number} p.D    diamètre intérieur [mm]
   * @param {number} p.L    longueur [m]
   * @param {string} p.materiau
   * @param {number} p.e    épaisseur de paroi [mm]
   * @param {number} [p.sumXi] somme des coefficients de pertes singulières
   * @param {number} [p.Pservice] pression de service [bar]
   * @param {number} [p.fermeture] temps de fermeture de vanne [s] (coup de bélier)
   */
  function conduite(p) {
    const mat = MATERIAUX[p.materiau] || MATERIAUX['PEHD (PE100)'];
    const Q = p.Qls / 1000;        // m³/s
    const D = p.D / 1000;          // m
    const e = (p.e || 10) / 1000;  // m
    const ks = mat.ks / 1000;      // m
    const A = Math.PI * D * D / 4;
    const V = Q / A;
    const Re = V * D / NU;
    const f = colebrook(Re, ks / D);

    // Pertes de charge
    const Jlin = f * (p.L / D) * V * V / (2 * G);          // m
    const Jsing = (p.sumXi || 0) * V * V / (2 * G);        // m
    const Htot = Jlin + Jsing;
    const JparKm = (p.L > 0) ? Jlin / p.L * 1000 : 0;

    // Coup de bélier (Joukowsky)
    const celerite = 1 / Math.sqrt(RHO * (1 / K_EAU + D / (mat.E * 1e6 * e)));
    const tc = 2 * p.L / celerite; // temps critique (aller-retour onde)
    const fermeture = p.fermeture != null ? p.fermeture : 0;
    let surge; // surpression [m]
    if (fermeture <= tc || fermeture === 0) {
      surge = celerite * V / G; // fermeture brusque (Joukowsky)
    } else {
      surge = celerite * V / G * (tc / fermeture); // fermeture lente (Michaud)
    }

    // Pression de dimensionnement et contrainte de paroi
    const Pservice = (p.Pservice || 6); // bar
    const Pdesign = Pservice + surge * RHO * G / 1e5; // bar (ajout surpression)
    const sigma = Pdesign * 1e5 * D / (2 * e) / 1e6; // MPa (contrainte circonférentielle)
    const okParoi = sigma <= mat.sigma;

    // Vérification de la vitesse (plage économique 0,5–2,0 m/s)
    const vitesseOk = V >= 0.5 && V <= 2.0;

    return {
      materiau: p.materiau, ks: mat.ks,
      V: round(V, 2), Re: round(Re, 0), f: round(f, 4),
      Jlin: round(Jlin, 2), Jsing: round(Jsing, 2), Htot: round(Htot, 2), JparKm: round(JparKm, 2),
      vitesseOk,
      celerite: round(celerite, 0), tc: round(tc, 2), fermetureBrusque: fermeture <= tc || fermeture === 0,
      surge: round(surge, 1),
      Pservice, Pdesign: round(Pdesign, 1),
      sigma: round(sigma, 1), sigmaAdm: mat.sigma, okParoi,
      statut: (okParoi && vitesseOk) ? 'OK' : (okParoi ? 'AVEC RÉSERVES' : 'NOK'),
      messages: [].concat(
        vitesseOk ? [] : ['Vitesse hors plage économique 0,5–2,0 m/s.'],
        okParoi ? [] : ['Contrainte de paroi dépassée : augmenter l’épaisseur ou la classe de pression (PN).']
      )
    };
  }

  /** Diamètre intérieur théorique pour une vitesse cible. */
  function diametreEconomique(Qls, Vcible) {
    const Q = Qls / 1000;
    const D = Math.sqrt(4 * Q / (Math.PI * (Vcible || 1.5))) * 1000; // mm
    let dn = DN[DN.length - 1];
    for (const d of DN) { if (d >= D) { dn = d; break; } }
    return { Dtheorique: round(D, 0), DN: dn };
  }

  return { MATERIAUX, DN, colebrook, conduite, diametreEconomique, G, RHO };
});
