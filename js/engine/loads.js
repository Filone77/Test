/*
 * loads.js — Charges climatiques
 * Neige : EN 1991-1-3 (+ Annexe Nationale française)
 * Vent  : EN 1991-1-4 (pression dynamique de pointe qp, pression we)
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
    root.GC.loads = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // --- NEIGE ------------------------------------------------------------
  // Valeurs caractéristiques au sol sk,0 (≤ 200 m) par zone française [kN/m²]
  const ZONES_NEIGE = {
    A1: 0.45, A2: 0.45, B1: 0.55, B2: 0.55,
    C1: 0.65, C2: 0.65, D: 0.90, E: 1.40
  };

  /** Majoration d'altitude Δs (NF EN 1991-1-3/NA) [kN/m²]. */
  function majorationAltitude(A) {
    if (A <= 200) return 0;
    if (A <= 500) return (A - 200) / 1000;
    if (A <= 1000) return 1.5 * (A - 500) / 1000 + 0.30;
    if (A <= 2000) return 3.5 * (A - 1000) / 1000 + 1.05;
    return 4.55;
  }

  /** Coefficient de forme μ1 pour toiture à versant (EN 1991-1-3 §5.3). */
  function muForme(alpha) {
    if (alpha <= 30) return 0.8;
    if (alpha < 60) return 0.8 * (60 - alpha) / 30;
    return 0;
  }

  /**
   * Charge de neige sur la toiture.
   * @param {object} p {zone, sk0?, altitude, alpha, Ce=1, Ct=1}
   */
  function neige(p) {
    const sk0 = p.sk0 != null ? p.sk0 : (ZONES_NEIGE[p.zone] || 0.45);
    const dAlt = majorationAltitude(p.altitude || 0);
    const sk = sk0 + dAlt;
    const Ce = p.Ce != null ? p.Ce : 1.0;
    const Ct = p.Ct != null ? p.Ct : 1.0;
    const mu = muForme(p.alpha || 0);
    const s = mu * Ce * Ct * sk;
    return {
      zone: p.zone, sk0: round(sk0, 2), dAlt: round(dAlt, 2), sk: round(sk, 2),
      mu1: round(mu, 2), Ce, Ct, alpha: p.alpha || 0,
      s: round(s, 2)
    };
  }

  // --- VENT --------------------------------------------------------------
  // Vitesses de référence vb,0 par région française [m/s]
  const REGIONS_VENT = { 1: 22, 2: 24, 3: 26, 4: 28 };
  // Catégories de terrain : z0 [m], zmin [m]
  const TERRAINS = {
    '0': { z0: 0.003, zmin: 1, libelle: 'Mer / zone côtière exposée' },
    'II': { z0: 0.05, zmin: 2, libelle: 'Rase campagne, obstacles isolés' },
    'IIIa': { z0: 0.20, zmin: 5, libelle: 'Campagne avec haies' },
    'IIIb': { z0: 0.50, zmin: 9, libelle: 'Zone urbanisée / industrielle' },
    'IV': { z0: 1.0, zmin: 10, libelle: 'Zone urbaine dense' }
  };
  const RHO_AIR = 1.25; // kg/m³

  /**
   * Pression dynamique de pointe et pression exercée.
   * @param {object} p {region, vb0?, terrain, z, cpe?, cdir=1, cseason=1, aire?}
   */
  function vent(p) {
    const vb0 = p.vb0 != null ? p.vb0 : (REGIONS_VENT[p.region] || 24);
    const cdir = p.cdir != null ? p.cdir : 1.0;
    const cseason = p.cseason != null ? p.cseason : 1.0;
    const vb = cdir * cseason * vb0;
    const t = TERRAINS[p.terrain] || TERRAINS['II'];
    const z = Math.max(p.z || 10, t.zmin);

    const kr = 0.19 * Math.pow(t.z0 / 0.05, 0.07);
    const cr = kr * Math.log(z / t.z0);
    const co = 1.0;
    const vm = cr * co * vb;
    const Iv = 1.0 / (co * Math.log(z / t.z0));
    const qb = 0.5 * RHO_AIR * vb * vb; // Pa
    const qp = (1 + 7 * Iv) * 0.5 * RHO_AIR * vm * vm; // Pa
    const ce = qp / qb;

    const cpe = p.cpe != null ? p.cpe : 0.8;
    const we = qp * cpe; // Pa
    const aire = p.aire || 1;
    const force = we * aire / 1000; // kN

    return {
      vb0, vb: round(vb, 1), terrain: p.terrain, z: round(z, 1),
      kr: round(kr, 3), cr: round(cr, 3), vm: round(vm, 1), Iv: round(Iv, 3),
      qb: round(qb / 1000, 3), // kN/m²
      qp: round(qp / 1000, 3), // kN/m²
      ce: round(ce, 2),
      cpe, we: round(we / 1000, 3), // kN/m²
      aire, force: round(force, 2) // kN
    };
  }

  return {
    ZONES_NEIGE, REGIONS_VENT, TERRAINS,
    majorationAltitude, muForme, neige, vent
  };
});
