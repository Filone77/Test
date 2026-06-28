/*
 * channel.js — Caniveau / canal à surface libre
 * Écoulement uniforme par Manning-Strickler : Q = K·S·Rh^(2/3)·√I
 * Sections rectangulaire et trapézoïdale. Capacité et dimensionnement
 * (recherche de la profondeur normale).
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
    root.GC.channel = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  /** Caractéristiques géométriques d'une section (rect. ou trapéze). */
  function geometrie(forme, b, y, m) {
    if (forme === 'trapeze') {
      m = m || 0;
      const A = (b + m * y) * y;
      const P = b + 2 * y * Math.sqrt(1 + m * m);
      const T = b + 2 * m * y; // largeur au miroir
      return { A, P, Rh: A / P, T };
    }
    // rectangulaire
    const A = b * y;
    const P = b + 2 * y;
    return { A, P, Rh: A / P, T: b };
  }

  /**
   * Capacité d'un caniveau (débit pour une profondeur d'eau donnée).
   * @param {object} p {forme, b (m), y (tirant d'eau m), m (fruit H/V), I (pente m/m), K (Strickler)}
   */
  function capacite(p) {
    const g = geometrie(p.forme, p.b, p.y, p.m);
    const V = p.K * Math.pow(g.Rh, 2 / 3) * Math.sqrt(p.I);
    const Q = V * g.A;
    const Fr = V / Math.sqrt(9.81 * g.A / g.T); // Froude
    return {
      forme: p.forme, b: p.b, y: p.y, m: p.m || 0, I: p.I, K: p.K,
      A: round(g.A, 4), P: round(g.P, 3), Rh: round(g.Rh, 4),
      V: round(V, 2), Q: round(Q, 4), Qls: round(Q * 1000, 1),
      froude: round(Fr, 2), regime: Fr < 1 ? 'fluvial' : 'torrentiel',
      autocurage: V >= 0.5, vitesseOk: V <= 4
    };
  }

  /**
   * Dimensionnement : profondeur normale pour évacuer un débit Q.
   * @param {object} p {Qls (L/s), forme, b (m), m, I, K, revanche (m)}
   */
  function dimensionner(p) {
    const Q = p.Qls / 1000;
    // bissection sur le tirant d'eau y
    let lo = 0.001, hi = 10;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const g = geometrie(p.forme, p.b, mid, p.m);
      const q = p.K * Math.pow(g.Rh, 2 / 3) * Math.sqrt(p.I) * g.A;
      if (q < Q) lo = mid; else hi = mid;
    }
    const y = (lo + hi) / 2;
    const cap = capacite({ forme: p.forme, b: p.b, y, m: p.m, I: p.I, K: p.K });
    const revanche = p.revanche != null ? p.revanche : 0.05;
    const hTotal = y + revanche;
    return Object.assign(cap, {
      yNormal: round(y, 3),
      revanche,
      hTotal: round(hTotal, 3),
      messages: [].concat(
        cap.autocurage ? [] : ['Vitesse < 0,5 m/s : risque de dépôt (augmenter la pente).'],
        cap.vitesseOk ? [] : ['Vitesse > 4 m/s : risque d’érosion / protéger le radier.']
      )
    });
  }

  return { geometrie, capacite, dimensionner };
});
