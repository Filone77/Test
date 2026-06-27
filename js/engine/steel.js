/*
 * steel.js — Charpente métallique selon l'Eurocode 3 (EN 1993-1-1)
 * Traction, compression avec flambement, flexion, cisaillement, interaction.
 * Unités d'entrée : efforts kN / kN·m ; longueurs m ; sections issues de profiles.js.
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
    root.GC.steel = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  const round = core.round;
  const E = core.FACTEURS.Ea; // 210000 MPa

  // Facteurs d'imperfection des courbes de flambement (EC3 §6.3.1.2)
  const ALPHA_COURBE = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 };

  /**
   * Résistance en traction (EC3 §6.2.3).
   * @param {object} p {A [cm²], fy [MPa], NEd [kN], gammaM0}
   */
  function traction(p) {
    const A = p.A * 100; // mm²
    const gammaM0 = p.gammaM0 || 1.0;
    const NplRd = A * p.fy / gammaM0 / 1e3; // kN
    const taux = p.NEd != null ? p.NEd / NplRd : null;
    return {
      type: 'traction',
      NplRd: round(NplRd, 1),
      NEd: p.NEd,
      taux: taux != null ? round(taux, 3) : null,
      statut: taux == null ? null : (taux <= 1 ? 'OK' : 'NOK')
    };
  }

  /**
   * Résistance au flambement par flexion (EC3 §6.3.1).
   * @param {object} p {A [cm²], I [cm⁴], fy, Lcr [m], courbe, NEd [kN], gammaM1}
   */
  function compression(p) {
    const A = p.A * 100; // mm²
    const I = p.I * 1e4; // mm⁴
    const Lcr = p.Lcr * 1000; // mm
    const gammaM1 = p.gammaM1 || 1.0;
    const alpha = ALPHA_COURBE[p.courbe || 'b'];

    const Ncr = Math.PI * Math.PI * E * I / (Lcr * Lcr); // N
    const lambdaBar = Math.sqrt(A * p.fy / Ncr);
    const Phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
    let chi = 1 / (Phi + Math.sqrt(Math.max(0, Phi * Phi - lambdaBar * lambdaBar)));
    chi = Math.min(chi, 1.0);
    const NbRd = chi * A * p.fy / gammaM1 / 1e3; // kN
    const NplRd = A * p.fy / gammaM1 / 1e3;
    const taux = p.NEd != null ? p.NEd / NbRd : null;
    return {
      type: 'compression',
      Ncr: round(Ncr / 1e3, 1),
      lambdaBar: round(lambdaBar, 3),
      Phi: round(Phi, 3),
      chi: round(chi, 3),
      courbe: p.courbe || 'b',
      NbRd: round(NbRd, 1),
      NplRd: round(NplRd, 1),
      NEd: p.NEd,
      taux: taux != null ? round(taux, 3) : null,
      statut: taux == null ? null : (taux <= 1 ? 'OK' : 'NOK')
    };
  }

  /**
   * Résistance en flexion — sections de classe 1 ou 2 (EC3 §6.2.5).
   * @param {object} p {Wpl [cm³], fy, MEd [kN·m], gammaM0}
   */
  function flexion(p) {
    const Wpl = p.Wpl * 1e3; // mm³
    const gammaM0 = p.gammaM0 || 1.0;
    const McRd = Wpl * p.fy / gammaM0 / 1e6; // kN·m
    const taux = p.MEd != null ? p.MEd / McRd : null;
    return {
      type: 'flexion',
      McRd: round(McRd, 1),
      MEd: p.MEd,
      taux: taux != null ? round(taux, 3) : null,
      statut: taux == null ? null : (taux <= 1 ? 'OK' : 'NOK')
    };
  }

  /**
   * Résistance au cisaillement (EC3 §6.2.6), aire de cisaillement approchée.
   * @param {object} p {Av [cm²], fy, VEd [kN], gammaM0}
   */
  function cisaillement(p) {
    const Av = p.Av * 100; // mm²
    const gammaM0 = p.gammaM0 || 1.0;
    const VplRd = Av * (p.fy / Math.sqrt(3)) / gammaM0 / 1e3; // kN
    const taux = p.VEd != null ? p.VEd / VplRd : null;
    return {
      type: 'cisaillement',
      VplRd: round(VplRd, 1),
      VEd: p.VEd,
      taux: taux != null ? round(taux, 3) : null,
      statut: taux == null ? null : (taux <= 1 ? 'OK' : 'NOK')
    };
  }

  /**
   * Vérification d'ensemble d'un profilé selon le mode sollicité.
   * Combine, le cas échéant, une interaction simplifiée N + M (EC3 §6.2.1) :
   *   NEd/NRd + MEd/MRd ≤ 1.
   */
  function verifier(p) {
    const profil = p.profil; // objet issu de profiles.js
    const fy = p.fy;
    const res = { profil: profil.nom, fy, checks: [] };
    let pire = 0;

    if (p.mode === 'traction' || p.NEd != null && p.NEd < 0) {
      const r = traction({ A: profil.A, fy, NEd: Math.abs(p.NEd), gammaM0: p.gammaM0 });
      res.checks.push(r); if (r.taux) pire = Math.max(pire, r.taux);
    }
    if (p.mode === 'compression' && p.NEd != null) {
      // flambement selon l'axe le plus faible (iz) par défaut
      const r = compression({ A: profil.A, I: profil.Iz, fy, Lcr: p.Lcr, courbe: p.courbe, NEd: Math.abs(p.NEd), gammaM1: p.gammaM1 });
      res.checks.push(r); if (r.taux) pire = Math.max(pire, r.taux);
    }
    if (p.MEd != null) {
      const r = flexion({ Wpl: profil.Wply, fy, MEd: Math.abs(p.MEd), gammaM0: p.gammaM0 });
      res.checks.push(r); if (r.taux) pire = Math.max(pire, r.taux);
    }
    if (p.VEd != null) {
      // Av ≈ A - 2·b·tf + (tw+2r)·tf ; approché par 0.6·A (sécuritaire pour profils en I)
      const Av = profil.A * 0.6;
      const r = cisaillement({ Av, fy, VEd: Math.abs(p.VEd), gammaM0: p.gammaM0 });
      res.checks.push(r); if (r.taux) pire = Math.max(pire, r.taux);
    }
    // interaction N+M
    if (p.NEd != null && p.MEd != null) {
      const nr = (p.mode === 'compression')
        ? compression({ A: profil.A, I: profil.Iz, fy, Lcr: p.Lcr, courbe: p.courbe, NEd: Math.abs(p.NEd), gammaM1: p.gammaM1 }).NbRd
        : traction({ A: profil.A, fy, gammaM0: p.gammaM0 }).NplRd;
      const mr = flexion({ Wpl: profil.Wply, fy, gammaM0: p.gammaM0 }).McRd;
      const inter = Math.abs(p.NEd) / nr + Math.abs(p.MEd) / mr;
      res.checks.push({ type: 'interaction N+M', valeur: round(inter, 3), statut: inter <= 1 ? 'OK' : 'NOK' });
      pire = Math.max(pire, inter);
    }

    res.tauxMax = round(pire, 3);
    res.statut = pire <= 1 ? 'OK' : 'NOK';
    return res;
  }

  return { traction, compression, flexion, cisaillement, verifier, ALPHA_COURBE };
});
