/*
 * vrd.js — Voirie et Réseaux Divers
 * Assainissement pluvial (méthode rationnelle), dimensionnement de
 * canalisations (Manning-Strickler), terrassement de tranchée, corps de
 * chaussée (estimation CBR indicative).
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
    root.GC.vrd = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // Diamètres normalisés de canalisation [mm]
  const DN = [160, 200, 250, 315, 400, 500, 600, 800, 1000, 1200];

  /**
   * Débit pluvial — méthode rationnelle Q = C·i·A.
   * @param {object} p {C (ruissellement), i (mm/h), A (ha)}
   * @returns débit en m³/s et L/s
   */
  function pluvialRationnel(p) {
    const Qm3s = p.C * p.i * p.A / 360; // m³/s
    return {
      C: p.C, i: p.i, A: p.A,
      Qm3s: round(Qm3s, 4),
      Qls: round(Qm3s * 1000, 1)
    };
  }

  /** Capacité d'une canalisation circulaire pleine (Manning-Strickler). */
  function canalisationPleine(D, I, K) {
    const r = D / 2;
    const A = Math.PI * r * r;
    const P = Math.PI * D;
    const Rh = A / P; // = D/4
    const V = K * Math.pow(Rh, 2 / 3) * Math.sqrt(I);
    const Q = V * A;
    return { A, Rh, V, Q };
  }

  /**
   * Dimensionnement d'une canalisation : capacité et diamètre requis.
   * @param {object} p {Qls (débit à évacuer), I (pente m/m), K (Strickler), D (mm, optionnel)}
   */
  function canalisation(p) {
    const Q = p.Qls / 1000; // m³/s
    const I = p.I, K = p.K || 80;

    // Diamètre requis parmi la gamme normalisée
    let Dreq = null, capReq = null;
    for (const dn of DN) {
      const c = canalisationPleine(dn / 1000, I, K);
      if (c.Q >= Q) { Dreq = dn; capReq = c; break; }
    }

    // Vérification d'un diamètre imposé
    let impose = null;
    if (p.D) {
      const c = canalisationPleine(p.D / 1000, I, K);
      impose = {
        D: p.D, V: round(c.V, 2), Q: round(c.Q * 1000, 1),
        taux: round(Q / c.Q, 2),
        autocurage: c.V >= 0.6, vitesseOk: c.V <= 4,
        statut: c.Q >= Q ? 'OK' : 'NOK'
      };
    }

    return {
      Qls: p.Qls, I, K,
      Dreq,
      capacite: capReq ? { D: Dreq, V: round(capReq.V, 2), Q: round(capReq.Q * 1000, 1) } : null,
      impose
    };
  }

  /**
   * Terrassement d'une tranchée de réseau.
   * @param {object} p {L (m), largeur (m), profondeur (m), DN (mm), litSable (m), foisonnement (1.3)}
   */
  function terrassement(p) {
    const L = p.L, b = p.largeur, h = p.profondeur;
    const lit = p.litSable || 0.10;
    const foison = p.foisonnement || 1.3;
    const D = (p.DN || 0) / 1000;
    const deblai = b * h * L;
    const sable = b * lit * L; // lit de pose
    const enrobage = b * D * L * 0.9; // enrobage autour du tuyau (approx)
    const volTuyau = Math.PI * D * D / 4 * L;
    const remblai = deblai - sable - volTuyau;
    const evacuation = (deblai - remblai > 0 ? (deblai - remblai) : 0) * foison;
    return {
      deblai: round(deblai, 1),
      litSable: round(sable, 1),
      enrobage: round(enrobage, 1),
      remblai: round(Math.max(remblai, 0), 1),
      evacuationFoisonnee: round((sable + volTuyau) * foison, 1)
    };
  }

  /**
   * Épaisseur de chaussée — formule CBR (estimation préliminaire indicative).
   * e = (100 + 150·√P) / (CBR + 5)   [cm], P charge par roue [t]
   */
  function chausseeCBR(p) {
    const P = p.P || 6.5, CBR = p.CBR || 10;
    const e = (100 + 150 * Math.sqrt(P)) / (CBR + 5);
    return {
      P, CBR,
      epaisseur: round(e, 1),
      messages: ['Estimation préliminaire (formule CBR). Pour un projet, utiliser le catalogue SETRA/LCPC selon trafic et plateforme.']
    };
  }

  return { DN, pluvialRationnel, canalisation, canalisationPleine, terrassement, chausseeCBR };
});
