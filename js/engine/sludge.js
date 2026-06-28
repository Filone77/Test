/*
 * sludge.js — Réseaux de boues (assainissement)
 * Masse volumique selon la siccité, débit de matière sèche, épaississement /
 * déshydratation, pertes de charge corrigées de la concentration.
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core,
    typeof require === 'function' ? require('./pressure.js') : root.GC.pressure
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.sludge = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core, pressure) {
  'use strict';
  const round = core.round;
  const G = 9.81, RHOW = 1000, NU = 1.0e-6;

  /**
   * Masse volumique de la boue à partir de la siccité (concentration massique).
   * @param {object} p {C (% MS), rhoS (masse volumique des MS, kg/m³)}
   */
  function proprietes(p) {
    const c = p.C / 100; // fraction massique
    const rhoS = p.rhoS || 1450;
    const rho = 1 / (c / rhoS + (1 - c) / RHOW);
    return { C: p.C, c: round(c, 4), rhoS, rho: round(rho, 1) };
  }

  /**
   * Bilan de matière sèche.
   * @param {object} p {Q (m³/h), C (%), rhoS}
   */
  function bilanMasse(p) {
    const pr = proprietes(p);
    const Mds = p.Q * pr.rho * pr.c; // kg/h
    return {
      rho: pr.rho,
      Mds_kgh: round(Mds, 1),
      Mds_td: round(Mds * 24 / 1000, 2),
      Mds_tan: round(Mds * 24 * 365 / 1000, 0)
    };
  }

  /**
   * Épaississement / déshydratation (conservation de la matière sèche).
   * @param {object} p {Q1 (m³/h), C1 (%), C2 (%)}
   */
  function epaississement(p) {
    const Q2 = p.Q1 * p.C1 / p.C2;
    const reduction = (1 - Q2 / p.Q1) * 100;
    return {
      Q1: p.Q1, C1: p.C1, C2: p.C2,
      Q2: round(Q2, 2),
      reductionVolume: round(reduction, 1),
      filtrat: round(p.Q1 - Q2, 2)
    };
  }

  /** Facteur correctif de perte de charge (indicatif) : k = 1 + a·C^b. */
  function facteurCorrection(C) {
    return 1 + 0.25 * Math.pow(C, 1.6);
  }

  /**
   * Perte de charge d'une conduite de boue (eau × facteur de concentration).
   * @param {object} p {Q (L/s), D (mm), L (m), C (%), ks (mm), kFactor (override)}
   */
  function perteCharge(p) {
    const Q = p.Qls / 1000, D = p.D / 1000;
    const ks = (p.ks != null ? p.ks : 0.25) / 1000;
    const A = Math.PI * D * D / 4;
    const V = Q / A;
    const Re = V * D / NU;
    const f = pressure.colebrook(Re, ks / D);
    const hfEau = f * (p.L / D) * V * V / (2 * G);
    const k = p.kFactor != null ? p.kFactor : facteurCorrection(p.C);
    const hfBoue = k * hfEau;
    return {
      V: round(V, 2), Re: round(Re, 0), f: round(f, 4),
      hfEau: round(hfEau, 2),
      kFacteur: round(k, 2),
      hfBoue: round(hfBoue, 2),
      messages: ['Facteur de correction indicatif (boues non newtoniennes) — à caler sur des mesures réelles.']
    };
  }

  return { proprietes, bilanMasse, epaississement, perteCharge, facteurCorrection };
});
