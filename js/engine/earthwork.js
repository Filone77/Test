/*
 * earthwork.js — Terrassement de tranchée selon EN 1610
 * Largeur minimale de tranchée (tableaux 1 et 2), volumes par zone
 * (lit de pose, zone d'enrobage, remblai), déduction de la section du tuyau,
 * matériaux d'apport et évacuation des déblais.
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
    root.GC.earthwork = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  /**
   * Largeur minimale de tranchée selon EN 1610 (max des tableaux 1 et 2).
   * @param {number} DN  diamètre nominal [mm]
   * @param {number} OD  diamètre extérieur [m]
   * @param {number} H   profondeur de la tranchée [m]
   */
  function largeurMini(DN, OD, H) {
    // Tableau 1 — en fonction du DN (tranchée blindée/verticale)
    let b;
    if (DN <= 225) b = 0.40;
    else if (DN <= 350) b = 0.50;
    else if (DN <= 700) b = 0.70;
    else if (DN <= 1200) b = 0.85;
    else b = 1.00;
    const w1 = OD + b;
    // Tableau 2 — en fonction de la profondeur
    let w2 = 0;
    if (H >= 1.00 && H <= 1.75) w2 = 0.80;
    else if (H > 1.75 && H <= 4.00) w2 = 0.90;
    else if (H > 4.00) w2 = 1.00;
    return { largeur: round(Math.max(w1, w2), 2), w1: round(w1, 2), w2: round(w2, 2), bLateral: b };
  }

  /**
   * Métré complet d'une tranchée de canalisation (EN 1610).
   * @param {object} p
   * @param {number} p.DN  diamètre nominal [mm]
   * @param {number} p.DE  diamètre extérieur [mm]
   * @param {number} p.H   profondeur [m]
   * @param {number} p.L   longueur [m]
   * @param {number} [p.largeur] largeur imposée [m] (sinon EN 1610)
   * @param {number} [p.eLit] épaisseur du lit de pose [m] (0,10)
   * @param {number} [p.couverture] couverture sur génératrice sup. dans l'enrobage [m] (0,15)
   * @param {number} [p.foisonnement] (1,3)
   * @param {boolean} [p.reutiliser] réutiliser les déblais en remblai principal
   */
  function tranchee(p) {
    const OD = p.DE / 1000;
    const eLit = p.eLit != null ? p.eLit : 0.10;
    const couv = p.couverture != null ? p.couverture : 0.15;
    const foison = p.foisonnement != null ? p.foisonnement : 1.3;
    const lm = largeurMini(p.DN, OD, p.H);
    const W = p.largeur || lm.largeur;
    const L = p.L;

    const Vdeblai = W * p.H * L;
    const Vlit = W * eLit * L;
    const hEnrobage = OD + couv;            // hauteur de la zone d'enrobage (au-dessus du lit)
    const VenrobageBrut = W * hEnrobage * L;
    const Vtuyau = Math.PI * OD * OD / 4 * L;
    const VenrobageNet = Math.max(VenrobageBrut - Vtuyau, 0);
    const hRemblai = Math.max(p.H - eLit - hEnrobage, 0);
    const Vremblai = W * hRemblai * L;

    const Vapport = Vlit + VenrobageNet;     // grave/sable d'apport
    const Vreutilise = p.reutiliser ? Vremblai : 0;
    const Vevacuation = (Vdeblai - Vreutilise) * foison;

    const couvertureTotale = p.H - eLit - OD; // hauteur de couverture totale sur le tuyau
    return {
      largeurEN1610: lm,
      largeur: round(W, 2),
      Vdeblai: round(Vdeblai, 1),
      Vlit: round(Vlit, 1),
      Venrobage: round(VenrobageNet, 1),
      Vtuyau: round(Vtuyau, 2),
      Vremblai: round(Vremblai, 1),
      Vapport: round(Vapport, 1),
      Vevacuation: round(Vevacuation, 1),
      couvertureTotale: round(couvertureTotale, 2),
      messages: [].concat(
        couvertureTotale < 0.80 ? ['Couverture < 0,80 m : vérifier la protection mécanique (charges roulantes).'] : [],
        p.largeur && p.largeur < lm.largeur ? [`Largeur imposée < largeur mini EN 1610 (${lm.largeur} m).`] : []
      )
    };
  }

  return { largeurMini, tranchee };
});
