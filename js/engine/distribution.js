/*
 * distribution.js — Ouvrage hydraulique passif de répartition de débit
 * Répartit un débit entrant sur plusieurs tuyaux/orifices. Le niveau d'eau
 * dans l'ouvrage s'établit pour que Σ(débits sortants) = débit entrant.
 * Chaque sortie : orifice noyé Qi = Cd·A·√(2g·(H − zi)).
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
    root.GC.distribution = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const G = 9.81;

  function debitSortie(o, H) {
    const charge = H - (o.z || 0);
    if (charge <= 0) return 0;
    const A = Math.PI * Math.pow(o.D / 1000, 2) / 4;
    return (o.Cd || 0.6) * A * Math.sqrt(2 * G * charge); // m³/s
  }

  /**
   * Répartition d'un débit total sur plusieurs sorties.
   * @param {object} p
   * @param {number} p.Qtotal débit entrant [L/s]
   * @param {Array<{nom, Cd, D (mm), z (m, niveau du radier/seuil de la sortie)}>} p.outlets
   */
  function repartition(p) {
    const Q = p.Qtotal / 1000; // m³/s
    const outlets = p.outlets;
    const zMin = Math.min.apply(null, outlets.map((o) => o.z || 0));

    // somme des débits sortants pour un niveau H
    const somme = (H) => outlets.reduce((a, o) => a + debitSortie(o, H), 0);

    // bissection sur H
    let lo = zMin, hi = zMin + 50;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (somme(mid) < Q) lo = mid; else hi = mid;
    }
    const H = (lo + hi) / 2;

    const detail = outlets.map((o) => {
      const qi = debitSortie(o, H);
      return {
        nom: o.nom, D: o.D, z: o.z || 0,
        charge: round(Math.max(H - (o.z || 0), 0), 3),
        Q: round(qi * 1000, 1),
        pourcentage: round(Q > 0 ? qi / Q * 100 : 0, 1),
        actif: qi > 1e-6
      };
    });

    const sommeSorties = detail.reduce((a, d) => a + d.Q, 0);
    return {
      Qtotal: p.Qtotal,
      niveau: round(H, 3),
      detail,
      equilibre: round(sommeSorties, 1),
      ok: Math.abs(sommeSorties - p.Qtotal) < 0.5,
      messages: detail.some((d) => !d.actif)
        ? ['Certaines sorties ne débitent pas (seuil au-dessus du niveau d’eau) — effet de régulation par paliers.'] : []
    };
  }

  return { repartition, debitSortie };
});
