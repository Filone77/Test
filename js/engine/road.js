/*
 * road.js — Dimensionnement de chaussée (méthode rationnelle française)
 * Trafic cumulé (NPL, NE), classes de trafic et de plateforme, déformations
 * admissibles (εz sol support, εt fatigue), structure indicative.
 * Réf. : NF P98-086 / guide SETRA-LCPC (valeurs courantes).
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
    root.GC.road = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  /** Classe de trafic poids lourds (MJA = PL/jour/sens dimensionnant). */
  function classeTrafic(MJA) {
    if (MJA < 25) return 'T5';
    if (MJA <= 50) return 'T4';
    if (MJA <= 150) return 'T3';
    if (MJA <= 300) return 'T2';
    if (MJA <= 750) return 'T1';
    if (MJA <= 2000) return 'T0';
    if (MJA <= 5000) return 'TS';
    return 'TEX';
  }

  /** Classe de plateforme support (module EV2 long terme [MPa]). */
  function classePlateforme(module) {
    if (module < 50) return 'PF1';
    if (module < 80) return 'PF2';
    if (module < 120) return 'PF2qs';
    if (module < 200) return 'PF3';
    return 'PF4';
  }

  // Structures VRD indicatives (chaussée souple, plateforme PF2) par classe
  const CATALOGUE = {
    T5: { roulement: 5, base: 0, fondation: 30, materiau: 'BBSG + GNT' },
    T4: { roulement: 6, base: 0, fondation: 35, materiau: 'BBSG + GNT' },
    T3: { roulement: 6, base: 10, fondation: 20, materiau: 'BBSG + GB + GNT' },
    T2: { roulement: 6, base: 14, fondation: 15, materiau: 'BBSG + GB + GNT' },
    T1: { roulement: 8, base: 18, fondation: 15, materiau: 'BBSG + GB + GNT' },
    T0: { roulement: 8, base: 22, fondation: 15, materiau: 'BBME + GB + GNT' }
  };

  /**
   * @param {object} p
   * @param {number} p.MJA   trafic PL journalier (sens dimensionnant)
   * @param {number} p.taux  taux de croissance annuel (ex. 0,02)
   * @param {number} p.annees durée de calcul
   * @param {number} [p.CAM] coefficient d'agressivité moyen (0,8 par défaut)
   * @param {number} p.module module de la plateforme [MPa] (ou CBR via 5·CBR)
   * @param {number} [p.epsilon6] déformation admissible à 10⁶ cycles [μdef]
   * @param {number} [p.bFatigue] pente de fatigue (négatif)
   * @param {number} [p.kc] coefficient de calage
   */
  function dimensionner(p) {
    const CAM = p.CAM != null ? p.CAM : 0.8;
    const taux = p.taux || 0;
    const facteur = taux > 0 ? (Math.pow(1 + taux, p.annees) - 1) / taux : p.annees;
    const NPL = p.MJA * 365 * facteur;
    const NE = NPL * CAM;

    const TC = classeTrafic(p.MJA);
    const PF = classePlateforme(p.module);

    // Déformation admissible du sol support (orniérage)
    const A = 0.012;
    const epsZadm = A * Math.pow(NE, -0.222) * 1e6; // μdef

    // Déformation admissible en fatigue des matériaux bitumineux
    const e6 = p.epsilon6 != null ? p.epsilon6 : 100; // μdef
    const bf = p.bFatigue != null ? p.bFatigue : -0.2;
    const kc = p.kc != null ? p.kc : 1.3;
    const epsTadm = e6 * Math.pow(NE / 1e6, bf) * kc; // μdef

    const struct = CATALOGUE[TC] || CATALOGUE.T3;
    const epaisseurTotale = struct.roulement + struct.base + struct.fondation;

    return {
      MJA: p.MJA, taux, annees: p.annees, CAM,
      facteurCumul: round(facteur, 2),
      NPL: Math.round(NPL),
      NE: Math.round(NE),
      classeTrafic: TC,
      classePlateforme: PF,
      module: p.module,
      epsZadm: round(epsZadm, 0),
      epsTadm: round(epsTadm, 0),
      structure: struct,
      epaisseurTotale,
      messages: [
        'Structure indicative (catalogue VRD, plateforme PF2). Pour un projet, vérifier les déformations réelles avec un calcul multicouche (Alizé) et adapter selon la plateforme.'
      ]
    };
  }

  return { classeTrafic, classePlateforme, CATALOGUE, dimensionner };
});
