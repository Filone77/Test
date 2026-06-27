/*
 * retaining.js — Mur de soutènement en T (ouvrage enterré en béton armé)
 * Stabilité externe : renversement, glissement, poinçonnement du sol.
 * Stabilité interne : ferraillage du voile et de la semelle.
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core,
    typeof require === 'function' ? require('./geotech.js') : root.GC.geotech,
    typeof require === 'function' ? require('./concrete.js') : root.GC.concrete
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.retaining = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core, geotech, concrete) {
  'use strict';
  const round = core.round;
  const rad = (d) => d * Math.PI / 180;

  /**
   * @param {object} p
   * @param {number} p.Hs   hauteur du voile au-dessus de la semelle [m]
   * @param {number} p.ef   épaisseur de la semelle [m]
   * @param {number} p.eVoile épaisseur du voile [m]
   * @param {number} p.patin longueur du patin avant (toe) [m]
   * @param {number} p.talon longueur du talon arrière (heel) [m]
   * @param {number} p.gamma, p.phi, p.c, p.q, p.delta (frottement base)
   * @param {number} p.sigmaAdm [kPa], p.gammaBeton (25), p.fck, p.fyk
   */
  function murEnT(p) {
    const Hs = p.Hs, ef = p.ef, eV = p.eVoile;
    const patin = p.patin, talon = p.talon;
    const H = Hs + ef; // hauteur totale pour la poussée
    const B = patin + eV + talon;
    const gBeton = p.gammaBeton || 25;
    const delta = p.delta != null ? p.delta : (2 / 3) * p.phi;

    // Poussée des terres sur le plan vertical arrière (hauteur totale H)
    const pa = geotech.pousseeActive({ H, gamma: p.gamma, phi: p.phi, c: p.c || 0, q: p.q || 0 });
    const Ph = pa.Ptot;      // composante horizontale [kN/ml]
    const zPh = pa.zbar;     // bras de levier depuis la base

    // Charges verticales et bras par rapport au pied avant (toe), x croissant vers l'arrière
    const xVoile = patin + eV / 2;
    const xSemelle = B / 2;
    const xTerre = patin + eV + talon / 2;
    const Wvoile = eV * Hs * gBeton;
    const Wsemelle = B * ef * gBeton;
    const Wterre = talon * Hs * p.gamma;
    const Wq = (p.q || 0) * talon;
    const charges = [
      { nom: 'Voile', V: Wvoile, x: xVoile },
      { nom: 'Semelle', V: Wsemelle, x: xSemelle },
      { nom: 'Terres sur talon', V: Wterre, x: xTerre },
      { nom: 'Surcharge sur talon', V: Wq, x: xTerre }
    ];
    const SV = charges.reduce((a, c) => a + c.V, 0);
    const Mstab = charges.reduce((a, c) => a + c.V * c.x, 0);
    const Mren = Ph * zPh;

    // 1) Renversement
    const FSrenv = Mren > 0 ? Mstab / Mren : Infinity;

    // 2) Glissement
    const resist = SV * Math.tan(rad(delta)) + (p.c || 0) * B;
    const FSgliss = Ph > 0 ? resist / Ph : Infinity;

    // 3) Poinçonnement (contraintes sous la semelle)
    const Mnet = Mstab - Mren;
    const xR = Mnet / SV; // position de la résultante depuis le toe
    const e = B / 2 - xR;  // excentricité par rapport au centre
    let sigMax, sigMin, repartition;
    if (Math.abs(e) <= B / 6) {
      sigMax = SV / B * (1 + 6 * e / B);
      sigMin = SV / B * (1 - 6 * e / B);
      repartition = 'trapézoïdale';
    } else {
      // résultante hors du tiers central : diagramme triangulaire
      const a = 3 * (B / 2 - Math.abs(e));
      sigMax = 2 * SV / a;
      sigMin = 0;
      repartition = 'triangulaire (hors tiers central)';
    }
    const okSol = sigMax <= p.sigmaAdm;

    // Ferraillage du voile (encastrement en pied) — moment ELU
    const paVoile = geotech.pousseeActive({ H: Hs, gamma: p.gamma, phi: p.phi, c: p.c || 0, q: p.q || 0 });
    const Mvoile_ELU = 1.35 * paVoile.Ptot * paVoile.zbar; // kN·m/ml
    const ferVoile = concrete.dalle({ MEd: Mvoile_ELU, h: eV * 1000, enrobage: 50, fck: p.fck, fyk: p.fyk });

    // Ferraillage du talon (porte-à-faux, poids des terres vers le bas, réaction sol vers le haut)
    const qTalon = (Wterre + Wq) / talon - sigMin; // approximation nette descendante [kN/m]
    const Mtalon_ELU = 1.35 * Math.abs(qTalon) * talon * talon / 2;
    const ferTalon = concrete.dalle({ MEd: Mtalon_ELU, h: ef * 1000, enrobage: 50, fck: p.fck, fyk: p.fyk });

    const statutGlobal = (FSrenv >= 1.5 && FSgliss >= 1.5 && okSol) ? 'OK' : 'NOK';
    const messages = [];
    if (FSrenv < 1.5) messages.push('Sécurité au renversement insuffisante (< 1,5) : élargir la semelle / le talon.');
    if (FSgliss < 1.5) messages.push('Sécurité au glissement insuffisante (< 1,5) : ajouter une bêche ou élargir la semelle.');
    if (!okSol) messages.push('Contrainte sur le sol dépassée : élargir la semelle ou améliorer le sol.');

    return {
      geometrie: { H: round(H, 2), B: round(B, 2), Hs, ef, eVoile: eV, patin, talon },
      poussee: { Ph: round(Ph, 1), zPh: round(zPh, 2), Ka: pa.Ka, Mren: round(Mren, 1) },
      charges: charges.map((c) => ({ nom: c.nom, V: round(c.V, 1), x: round(c.x, 2), M: round(c.V * c.x, 1) })),
      SV: round(SV, 1), Mstab: round(Mstab, 1),
      renversement: { FS: round(FSrenv, 2), ok: FSrenv >= 1.5 },
      glissement: { FS: round(FSgliss, 2), delta: round(delta, 1), ok: FSgliss >= 1.5 },
      poinconnement: { e: round(e, 3), sigMax: round(sigMax, 1), sigMin: round(sigMin, 1), sigAdm: p.sigmaAdm, repartition, ok: okSol },
      ferraillage: {
        voile: { M: round(Mvoile_ELU, 1), As: ferVoile.AsRetenu, choix: ferVoile.choixEspacement },
        talon: { M: round(Mtalon_ELU, 1), As: ferTalon.AsRetenu, choix: ferTalon.choixEspacement }
      },
      statut: statutGlobal,
      messages
    };
  }

  return { murEnT };
});
