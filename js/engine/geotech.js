/*
 * geotech.js — Géotechnique : poussée des terres
 * Théorie de Rankine (Ka, K0, Kp), prise en compte de la nappe, de la
 * cohésion et d'une surcharge. Poussées résultantes et points d'application.
 * Unités : longueurs [m], poids volumiques [kN/m³], contraintes [kPa].
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
    root.GC.geotech = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const rad = (deg) => deg * Math.PI / 180;

  /** Coefficients de pression des terres (Rankine, sol horizontal). */
  function coefficients(phi) {
    const p = rad(phi);
    const Ka = Math.pow(Math.tan(rad(45 - phi / 2)), 2);
    const K0 = 1 - Math.sin(p);
    const Kp = Math.pow(Math.tan(rad(45 + phi / 2)), 2);
    return { Ka: round(Ka, 3), K0: round(K0, 3), Kp: round(Kp, 3) };
  }

  /**
   * Diagramme de poussée active sur un écran de hauteur H.
   * @param {object} p
   * @param {number} p.H       hauteur de l'écran [m]
   * @param {number} p.gamma   poids volumique humide (au-dessus nappe) [kN/m³]
   * @param {number} p.phi     angle de frottement [°]
   * @param {number} [p.c]     cohésion [kPa]
   * @param {number} [p.q]     surcharge en tête [kPa]
   * @param {number} [p.hw]    hauteur de la nappe au-dessus de la base [m]
   * @param {number} [p.gammaSat] poids volumique saturé [kN/m³]
   * @param {number} [p.gammaW]   poids volumique de l'eau [kN/m³] (10)
   */
  function pousseeActive(p) {
    const H = p.H, gamma = p.gamma, phi = p.phi;
    const c = p.c || 0, q = p.q || 0;
    const hw = p.hw || 0;
    const gammaSat = p.gammaSat || gamma;
    const gammaW = p.gammaW || 10;
    const Ka = Math.pow(Math.tan(rad(45 - phi / 2)), 2);
    const sqrtKa = Math.sqrt(Ka);
    const zWT = H - hw; // profondeur de la nappe depuis la tête

    const N = 200;
    const dz = H / N;
    let Psoil = 0, U = 0, Pq = 0;
    let Msoil = 0, Mu = 0, Mq = 0; // moments par rapport à la base
    const diagram = [];
    for (let i = 0; i <= N; i++) {
      const z = i * dz; // depuis la tête
      // contrainte verticale effective
      let sigV;
      if (z <= zWT) sigV = gamma * z;
      else sigV = gamma * zWT + (gammaSat - gammaW) * (z - zWT);
      const paSoil = Math.max(Ka * sigV - 2 * c * sqrtKa, 0);
      const u = z > zWT ? gammaW * (z - zWT) : 0;
      const paQ = Ka * q;
      const bras = H - z; // distance à la base
      const wz = (i === 0 || i === N) ? 0.5 : 1; // trapèze
      Psoil += wz * paSoil * dz; Msoil += wz * paSoil * dz * bras;
      U += wz * u * dz; Mu += wz * u * dz * bras;
      Pq += wz * paQ * dz; Mq += wz * paQ * dz * bras;
      diagram.push({ z: round(z, 2), pSoil: round(paSoil, 2), u: round(u, 2), pq: round(paQ, 2), p: round(paSoil + u + paQ, 2) });
    }
    const Ptot = Psoil + U + Pq;
    const Mtot = Msoil + Mu + Mq;
    const zbar = Ptot > 0 ? Mtot / Ptot : 0; // depuis la base

    return {
      Ka: round(Ka, 3),
      pBase: round(Ka * gamma * H + Ka * q, 2),
      Psoil: round(Psoil, 1), zbarSoil: round(Psoil > 0 ? Msoil / Psoil : 0, 2),
      U: round(U, 1), zbarU: round(U > 0 ? Mu / U : 0, 2),
      Pq: round(Pq, 1), zbarQ: round(Pq > 0 ? Mq / Pq : 0, 2),
      Ptot: round(Ptot, 1),
      zbar: round(zbar, 2),
      Mbase: round(Mtot, 1), // moment de poussée au pied [kN·m/ml]
      diagram
    };
  }

  return { coefficients, pousseeActive };
});
