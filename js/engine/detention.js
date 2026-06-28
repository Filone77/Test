/*
 * detention.js — Bassin de rétention / d'orage des eaux pluviales
 * Méthode des pluies (coefficients de Montana). Le volume de stockage est le
 * maximum, sur toutes les durées, de (volume entrant − volume évacué).
 * Intensité de Montana : i(mm/min) = a·t^(−b) ; hauteur h(t) = a·t^(1−b).
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
    root.GC.detention = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // Coefficients de Montana indicatifs (a en mm/min, b) — à adapter à la station Météo
  const MONTANA = {
    'T=10 ans (6–120 min)': { a: 6.1, b: 0.69 },
    'T=20 ans (6–120 min)': { a: 7.0, b: 0.69 },
    'T=2 ans (6–120 min)': { a: 4.6, b: 0.68 }
  };

  /**
   * @param {object} p
   * @param {number} p.A      surface du bassin versant [ha]
   * @param {number} p.C      coefficient de ruissellement
   * @param {number} p.Qf     débit de fuite [L/s]
   * @param {number} p.a      coefficient de Montana a [mm/min]
   * @param {number} p.b      coefficient de Montana b
   */
  function bassin(p) {
    const Am2 = p.A * 10000;       // m²
    const Qf = p.Qf / 1000;        // m³/s
    let Vmax = 0, tcrit = 0;
    const courbe = [];
    for (let t = 5; t <= 1440; t += 1) { // durée en minutes
      const h = p.a * Math.pow(t, 1 - p.b);       // mm
      const Vin = h / 1000 * p.C * Am2;            // m³
      const Vout = Qf * t * 60;                    // m³
      const V = Vin - Vout;
      if (t % 5 === 0) courbe.push({ x: t, y: round(Math.max(V, 0), 1) });
      if (V > Vmax) { Vmax = V; tcrit = t; }
    }
    const hcrit = p.a * Math.pow(tcrit, 1 - p.b);
    const Vin = hcrit / 1000 * p.C * Am2;
    return {
      A: p.A, C: p.C, Qf: p.Qf, a: p.a, b: p.b,
      volume: round(Vmax, 1),
      dureeCritique: tcrit,
      hauteurCritique: round(hcrit, 1),
      Ventrant: round(Vin, 1),
      debitFuiteSpecifique: round(p.Qf / p.A, 1), // L/s/ha
      courbe,
      messages: p.Qf / p.A < 5 ? [] : ['Débit de fuite spécifique élevé (> 5 L/s/ha) : vérifier les contraintes de rejet locales.']
    };
  }

  return { MONTANA, bassin };
});
