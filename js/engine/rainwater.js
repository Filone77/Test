/*
 * rainwater.js — Récupération des eaux pluviales (bâche / cuve)
 * Volume collectable depuis une toiture, demande, dimensionnement du volume
 * utile de la cuve (règle des ~21 jours), taux de couverture et économie.
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
    root.GC.rainwater = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // Volumes de cuves normalisés [m³]
  const CUVES = [1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 30];

  // Coefficients de ruissellement par type de toiture
  const TOITURES = {
    'Tuiles / ardoises (forte pente)': 0.9,
    'Toiture plate gravillonnée': 0.6,
    'Toiture végétalisée': 0.4,
    'Surface imperméable (béton, bitume)': 0.85
  };

  /**
   * @param {object} p
   * @param {number} p.surface   surface de collecte (projetée) [m²]
   * @param {number} p.pluvio    pluviométrie annuelle [mm/an]
   * @param {number} p.Crunoff   coefficient de ruissellement
   * @param {number} [p.etaFiltre] rendement du filtre (0,9 par défaut)
   * @param {number} p.demandeJour demande journalière [L/j]
   * @param {number} [p.joursStockage] période de stockage [j] (21 par défaut)
   */
  function dimensionner(p) {
    const eta = p.etaFiltre != null ? p.etaFiltre : 0.9;
    const jours = p.joursStockage || 21;

    // Volume annuel collectable [m³/an]
    const Vcol = p.surface * p.pluvio * p.Crunoff * eta / 1000;
    // Demande annuelle [m³/an]
    const Vdem = p.demandeJour * 365 / 1000;

    const limitant = Math.min(Vcol, Vdem);
    // Volume utile = volume limitant sur la période de stockage
    const Vutile = limitant * jours / 365;

    // Cuve normalisée immédiatement supérieure
    let cuve = CUVES[CUVES.length - 1];
    for (const c of CUVES) { if (c >= Vutile) { cuve = c; break; } }

    const tauxCouverture = Vdem > 0 ? limitant / Vdem * 100 : 0;
    const economieAn = limitant; // m³/an substitués à l'eau potable

    return {
      Vcol: round(Vcol, 1),
      Vdem: round(Vdem, 1),
      facteurLimitant: Vcol < Vdem ? 'collecte' : 'demande',
      Vutile: round(Vutile, 2),
      cuveNormalisee: cuve,
      tauxCouverture: round(tauxCouverture, 1),
      economieAn: round(economieAn, 1),
      autonomie: round(p.demandeJour > 0 ? cuve * 1000 / p.demandeJour : 0, 1),
      messages: [
        `Dimensionnement sur ${jours} jours (règle usuelle). Facteur limitant : ${Vcol < Vdem ? 'la collecte' : 'la demande'}.`,
        'Prévoir un trop-plein raccordé et une disconnexion avec le réseau d’eau potable.'
      ]
    };
  }

  return { CUVES, TOITURES, dimensionner };
});
