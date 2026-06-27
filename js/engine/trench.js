/*
 * trench.js — Tranchée blindée (étaiement de fouille)
 * Méthode traditionnelle : poutrelles HEB verticales (soldats) + planches bois
 * (blindage horizontal) + butons (étrésillons). Variante caisson (panneaux).
 * Diagramme de pression apparente de Terzaghi-Peck pour fouilles butonnées.
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core,
    typeof require === 'function' ? require('./steel.js') : root.GC.steel,
    typeof require === 'function' ? require('./profiles.js') : root.GC.profiles
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.trench = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core, steel, profiles) {
  'use strict';
  const round = core.round;

  /**
   * Pression latérale de dimensionnement (diagramme apparent + surcharge + eau).
   */
  function pressionDimensionnement(p) {
    const Ka = Math.pow(Math.tan((45 - p.phi / 2) * Math.PI / 180), 2);
    const pSoil = 0.65 * Ka * p.gamma * p.H; // apparent (Terzaghi-Peck, sable)
    const pQ = Ka * (p.q || 0);
    const gammaW = p.gammaW || 10;
    const pEauMoy = p.hw ? gammaW * p.hw / 2 : 0; // contribution hydrostatique moyenne
    const pEauBase = p.hw ? gammaW * p.hw : 0;
    return {
      Ka: round(Ka, 3),
      pSoil: round(pSoil, 2),
      pQ: round(pQ, 2),
      pEauMoy: round(pEauMoy, 2),
      pDesign: round(pSoil + pQ + pEauMoy, 2),
      pMax: round(pSoil + pQ + pEauBase, 2)
    };
  }

  /**
   * Blindage traditionnel HEB + bois.
   * @param {object} p {H, B, gamma, phi, c, q, hw, sH (espacement soldats),
   *   nButons, heb (nom profilé), fy, fmBois, epPlanche (m)}
   */
  function blindageBois(p) {
    const pr = pressionDimensionnement(p);
    const pDes = pr.pDesign; // kPa
    const sH = p.sH; // espacement horizontal des soldats [m]
    const n = p.nButons || 2;
    const Lv = p.H / n; // portée verticale entre lits de butons [m]
    const heb = profiles.get(p.heb) || profiles.get('HEB 160');
    const fy = p.fy || 235;

    // 1) Soldat HEB (poutre verticale) en flexion entre lits de butons
    const wSoldat = pDes * sH; // kN/m
    const Msoldat = wSoldat * Lv * Lv / 8; // kN·m
    const flexHEB = steel.flexion({ Wpl: heb.Wply, fy, MEd: Msoldat });

    // 2) Planches bois (blindage horizontal) en flexion entre soldats
    const Mbois = pr.pMax * sH * sH / 8; // kN·m par mètre de hauteur
    const t = p.epPlanche || 0.08; // m
    const Wbois = t * t / 6; // m³ par mètre de hauteur
    const sigmaBois = Mbois / Wbois / 1000; // MPa  (kN·m / m³ = kPa → /1000 = MPa)
    const fmBois = p.fmBois || 24; // C24
    const tauxBois = sigmaBois / fmBois;

    // 3) Buton (compression) sur la largeur B, flambement
    const Nbuton = pDes * sH * Lv; // kN
    const compHEB = steel.compression({ A: heb.A, I: heb.Iz, fy, Lcr: p.B, courbe: 'c', NEd: Nbuton });

    const taux = Math.max(flexHEB.taux || 0, tauxBois, compHEB.taux || 0);
    return {
      pression: pr,
      Lv: round(Lv, 2),
      soldat: { profil: heb.nom, M: round(Msoldat, 1), McRd: flexHEB.McRd, taux: flexHEB.taux, statut: flexHEB.statut },
      bois: { M: round(Mbois, 1), epaisseur: t * 1000, sigma: round(sigmaBois, 1), fm: fmBois, taux: round(tauxBois, 2), statut: tauxBois <= 1 ? 'OK' : 'NOK' },
      buton: { profil: heb.nom, N: round(Nbuton, 1), NbRd: compHEB.NbRd, lambdaBar: compHEB.lambdaBar, chi: compHEB.chi, taux: compHEB.taux, statut: compHEB.statut },
      tauxMax: round(taux, 2),
      statut: taux <= 1 ? 'OK' : 'NOK'
    };
  }

  /**
   * Blindage par caisson (panneaux préfabriqués) — vérification de capacité.
   * @param {object} p {H, gamma, phi, q, hw, ratingKPa (pression admissible panneau)}
   */
  function caisson(p) {
    const pr = pressionDimensionnement(p);
    const rating = p.ratingKPa || 50;
    const taux = pr.pMax / rating;
    return {
      pression: pr,
      ratingKPa: rating,
      pMax: pr.pMax,
      taux: round(taux, 2),
      statut: taux <= 1 ? 'OK' : 'NOK',
      messages: taux <= 1
        ? ['Pression maximale ≤ capacité du caisson.']
        : ['Pression supérieure à la capacité du caisson : choisir un panneau renforcé ou réduire la profondeur / rabattre la nappe.']
    };
  }

  return { pressionDimensionnement, blindageBois, caisson };
});
