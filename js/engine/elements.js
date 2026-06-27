/*
 * elements.js — Éléments en béton armé : dalle portant deux sens,
 * semelle filante, voile porteur (EN 1992-1-1).
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core,
    typeof require === 'function' ? require('./concrete.js') : root.GC.concrete
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.elements = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core, concrete) {
  'use strict';
  const round = core.round;

  // Coefficients de dalle (BAEL/EC, ELU, ν=0) — α = lx/ly (lx ≤ ly)
  const ALPHA = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
  const MUX = [0.1101, 0.1036, 0.0966, 0.0894, 0.0822, 0.0751, 0.0684, 0.0621, 0.0561, 0.0506, 0.0456, 0.0410, 0.0368];
  const MUY = [0.2500, 0.2500, 0.2500, 0.2500, 0.2948, 0.3613, 0.4320, 0.5105, 0.5959, 0.6864, 0.7834, 0.8875, 1.0000];

  /**
   * Dalle rectangulaire portant dans deux directions, appuyée sur 4 côtés.
   * @param {object} p {lx, ly [m], p [kN/m²], h [mm], enrobage, fck, fyk}
   */
  function dalle2sens(p) {
    const lx = Math.min(p.lx, p.ly), ly = Math.max(p.lx, p.ly);
    const alpha = lx / ly;
    const mux = core.interp(ALPHA, MUX, alpha);
    const muy = core.interp(ALPHA, MUY, alpha);
    const Mx = mux * p.p * lx * lx; // kN·m/m
    const My = muy * Mx;
    const porteUneDirection = alpha < 0.4;

    const ferX = concrete.dalle({ MEd: Mx, h: p.h, enrobage: p.enrobage, fck: p.fck, fyk: p.fyk });
    const ferY = concrete.dalle({ MEd: My, h: p.h - 10, enrobage: p.enrobage, fck: p.fck, fyk: p.fyk });

    return {
      lx, ly, alpha: round(alpha, 2),
      porteUneDirection,
      mux: round(mux, 4), muy: round(muy, 4),
      Mx: round(Mx, 2), My: round(My, 2),
      AsX: ferX.AsRetenu, choixX: ferX.choixEspacement,
      AsY: ferY.AsRetenu, choixY: ferY.choixEspacement,
      statut: 'OK'
    };
  }

  /**
   * Semelle filante sous voile/mur (méthode des bielles).
   * @param {object} p {Nu, Nser [kN/ml], sigmaAdm [kPa], a (largeur mur, m), fck, fyk}
   */
  function semelleFilante(p) {
    const Nser = p.Nser != null ? p.Nser : p.Nu / 1.35;
    let B = Nser / p.sigmaAdm; // m
    B = Math.max(Math.ceil(B / 0.05) * 0.05, p.a + 0.1);
    const sigma = Nser / B;
    let d = Math.max((B - p.a) / 4, 0.15);
    d = Math.ceil(d / 0.05) * 0.05;
    const H = round(d + 0.05, 2);
    const fyd = p.fyk / 1.15 * 1000; // kPa
    const As = p.Nu * (B - p.a) / (8 * d * fyd) * 1e4; // cm²/ml
    return {
      Nser: round(Nser, 1), B: round(B, 2), d: round(d, 2), H,
      sigma: round(sigma, 1), sigmaAdm: p.sigmaAdm, verifSol: sigma <= p.sigmaAdm,
      As: round(As, 2),
      choix: core.choisirBarres(As * 100).slice(0, 4),
      statut: sigma <= p.sigmaAdm ? 'OK' : 'NOK'
    };
  }

  /**
   * Voile porteur en béton non armé/armé (EC2 §12.6.5.2, méthode simplifiée).
   * @param {object} p {NEd [kN/ml], hw (épaisseur mm), lo (long. flambement m), e0 (mm), fck}
   */
  function voile(p) {
    const beton = core.betonProps(p.fck);
    const hw = p.hw;
    const b = 1000; // par mètre
    const ei = (p.lo * 1000) / 400; // imperfection
    const e0 = p.e0 != null ? p.e0 : Math.max(hw / 30, 20);
    const etot = e0 + ei;
    const borne = 1 - 2 * etot / hw;
    let Phi = 1.14 * (1 - 2 * etot / hw) - 0.02 * (p.lo * 1000) / hw;
    Phi = Math.min(Phi, borne);
    Phi = Math.max(Phi, 0);
    const NRd = b * hw * beton.fcd * Phi / 1000; // kN/ml
    const taux = p.NEd / NRd;
    const Ac = b * hw;
    const AsMin = 0.002 * Ac;
    return {
      hw, lo: p.lo, etot: round(etot, 1),
      fcd: round(beton.fcd, 2),
      Phi: round(Phi, 3),
      NRd: round(NRd, 0),
      NEd: p.NEd,
      taux: round(taux, 3),
      AsMin: round(AsMin, 0),
      statut: taux <= 1 ? 'OK' : 'NOK',
      messages: taux <= 1 ? [] : ['NEd > NRd : augmenter l’épaisseur du voile ou la résistance du béton.']
    };
  }

  return { dalle2sens, semelleFilante, voile, ALPHA, MUX, MUY };
});
