/*
 * pumping.js — Station de pompage (dimensionnement complet)
 * Hauteur manométrique totale (HMT), puissances, volume utile de bâche
 * (limitation des démarrages), vérification de la cavitation (NPSH).
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
    root.GC.pumping = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const G = 9.81, RHO = 1000;
  const PATM = 10.33;   // pression atmosphérique [m d'eau]
  const PVAP = 0.24;    // tension de vapeur de l'eau à 20 °C [m]

  /**
   * @param {object} p
   * @param {number} p.Q       débit de pompage [m³/h]
   * @param {number} p.Hgeo    hauteur géométrique [m]
   * @param {number} p.Jasp    pertes de charge à l'aspiration [m]
   * @param {number} p.Jref    pertes de charge au refoulement [m]
   * @param {number} [p.Pres]  pression résiduelle requise [m]
   * @param {number} p.etaPompe rendement de la pompe (0–1)
   * @param {number} p.etaMoteur rendement du moteur (0–1)
   * @param {number} p.Z       démarrages admissibles par heure
   * @param {number} p.Hasp    hauteur d'aspiration (pompe au-dessus du plan d'eau) [m]
   * @param {number} p.NPSHr   NPSH requis (pompe) [m]
   * @param {number} [p.heures] heures de fonctionnement / jour
   * @param {number} [p.nPompes] nombre de pompes (secours)
   */
  function station(p) {
    const Pres = p.Pres || 0;
    const HMT = p.Hgeo + p.Jasp + p.Jref + Pres;
    const Qm3s = p.Q / 3600;

    const Ph = RHO * G * Qm3s * HMT;          // puissance hydraulique [W]
    const Parbre = Ph / (p.etaPompe || 0.7);  // puissance à l'arbre [W]
    const Pelec = Parbre / (p.etaMoteur || 0.9); // puissance électrique [W]

    // Volume utile de la bâche (anti court-cycle) : Vu = Q / (4·Z)
    const Vu = p.Q / (4 * (p.Z || 6)); // m³ (Q en m³/h)

    // NPSH disponible et vérification de cavitation
    const NPSHd = PATM - PVAP - p.Hasp - p.Jasp;
    const marge = NPSHd - (p.NPSHr || 0);
    const cavitationOk = marge >= 0.5;

    // Énergie
    const heures = p.heures || 0;
    const kWhJour = Pelec / 1000 * heures;

    const nPompes = p.nPompes || 2;

    return {
      HMT: round(HMT, 1),
      Q: p.Q, Qm3s: round(Qm3s, 4),
      Phydraulique: round(Ph / 1000, 2),
      Parbre: round(Parbre / 1000, 2),
      Pelec: round(Pelec / 1000, 2),
      Vu: round(Vu, 2),
      NPSHd: round(NPSHd, 2), NPSHr: p.NPSHr || 0, marge: round(marge, 2), cavitationOk,
      kWhJour: round(kWhJour, 1),
      kWhAn: round(kWhJour * 365, 0),
      nPompes,
      configuration: `${nPompes} pompes (${nPompes - 1} en service + 1 secours)`,
      statut: cavitationOk ? 'OK' : 'NOK',
      messages: cavitationOk ? [] : ['NPSH disponible insuffisant (marge < 0,5 m) : risque de cavitation. Réduire la hauteur/longueur d’aspiration ou choisir une pompe à NPSHr plus faible.']
    };
  }

  return { station, PATM, PVAP };
});
