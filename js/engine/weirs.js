/*
 * weirs.js — Déversoirs (hydraulique à surface libre)
 * Seuil rectangulaire (mince, Rehbock / contractions de Francis), triangulaire
 * (V-notch), seuil épais (broad-crested), déversoir d'orage (lame déversante).
 * Unités : longueurs [m], débits [m³/s] (ou L/s en sortie).
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
    root.GC.weirs = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const G = 9.81;

  /**
   * Seuil rectangulaire à paroi mince.
   * @param {object} p {b (largeur), H (charge), P (pelle), Cd, contractions (0,1,2)}
   */
  function rectangulaire(p) {
    const H = p.H, b = p.b;
    const Cd = p.Cd != null ? p.Cd : (p.P ? 0.602 + 0.083 * H / p.P : 0.62); // Rehbock
    const n = p.contractions || 0;
    const beff = b - 0.1 * n * H; // contractions latérales (Francis)
    const Q = Cd * (2 / 3) * Math.sqrt(2 * G) * beff * Math.pow(H, 1.5);
    return { type: 'rectangulaire', Cd: round(Cd, 3), beff: round(beff, 3), H, Q: round(Q, 4), Qls: round(Q * 1000, 1) };
  }

  /** Charge H nécessaire pour évacuer un débit Q sur un seuil rectangulaire. */
  function chargeRectangulaire(Q, b, Cd) {
    Cd = Cd || 0.62;
    const k = Cd * (2 / 3) * Math.sqrt(2 * G) * b;
    return Math.pow(Q / k, 2 / 3);
  }

  /**
   * Seuil triangulaire (V-notch).
   * @param {object} p {theta (angle d'ouverture en °), H, Cd}
   */
  function triangulaire(p) {
    const Cd = p.Cd != null ? p.Cd : 0.58;
    const theta = p.theta * Math.PI / 180;
    const Q = Cd * (8 / 15) * Math.sqrt(2 * G) * Math.tan(theta / 2) * Math.pow(p.H, 2.5);
    return { type: 'triangulaire', Cd: round(Cd, 3), theta: p.theta, H: p.H, Q: round(Q, 4), Qls: round(Q * 1000, 1) };
  }

  /**
   * Seuil épais (broad-crested).
   * @param {object} p {b, H, Cd}
   */
  function epais(p) {
    const Cd = p.Cd != null ? p.Cd : 0.85;
    const Q = Cd * Math.pow(2 / 3, 1.5) * Math.sqrt(G) * p.b * Math.pow(p.H, 1.5);
    const Hcrit = (2 / 3) * p.H; // hauteur critique sur le seuil
    return { type: 'épais', Cd: round(Cd, 3), b: p.b, H: p.H, Hcrit: round(Hcrit, 3), Q: round(Q, 4), Qls: round(Q * 1000, 1) };
  }

  /**
   * Déversoir d'orage (latéral) — répartition amont/conservé/déversé.
   * @param {object} p {Qamont (L/s), Qconserve (L/s), b (longueur seuil), Cd, P}
   */
  function deversoirOrage(p) {
    const Qamont = p.Qamont / 1000, Qcons = p.Qconserve / 1000;
    const Qdev = Math.max(Qamont - Qcons, 0);
    const Cd = p.Cd != null ? p.Cd : 0.62;
    const H = Qdev > 0 ? chargeRectangulaire(Qdev, p.b, Cd) : 0;
    const tauxDilution = Qcons > 0 ? Qamont / Qcons : 0;
    return {
      type: 'déversoir d’orage',
      Qamont: p.Qamont, Qconserve: p.Qconserve,
      Qdeverse: round(Qdev * 1000, 1),
      H: round(H, 3),
      tauxDilution: round(tauxDilution, 2),
      messages: tauxDilution && tauxDilution < 3
        ? ['Taux de dilution < 3 : vérifier la conformité du déversoir (réglementation eaux pluviales).'] : []
    };
  }

  function calcul(type, p) {
    if (type === 'rectangulaire') return rectangulaire(p);
    if (type === 'triangulaire') return triangulaire(p);
    if (type === 'epais') return epais(p);
    if (type === 'orage') return deversoirOrage(p);
    throw new Error('Type de déversoir inconnu : ' + type);
  }

  return { rectangulaire, triangulaire, epais, deversoirOrage, chargeRectangulaire, calcul };
});
