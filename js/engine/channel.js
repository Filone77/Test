/*
 * channel.js — Caniveau / canal à surface libre
 * Écoulement uniforme par Manning-Strickler : Q = K·S·Rh^(2/3)·√I
 * Sections rectangulaire et trapézoïdale. Capacité et dimensionnement
 * (recherche de la profondeur normale).
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
    root.GC.channel = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  /** Caractéristiques géométriques d'une section (rect. ou trapéze). */
  function geometrie(forme, b, y, m) {
    if (forme === 'trapeze') {
      m = m || 0;
      const A = (b + m * y) * y;
      const P = b + 2 * y * Math.sqrt(1 + m * m);
      const T = b + 2 * m * y; // largeur au miroir
      return { A, P, Rh: A / P, T };
    }
    // rectangulaire
    const A = b * y;
    const P = b + 2 * y;
    return { A, P, Rh: A / P, T: b };
  }

  /**
   * Capacité d'un caniveau (débit pour une profondeur d'eau donnée).
   * @param {object} p {forme, b (m), y (tirant d'eau m), m (fruit H/V), I (pente m/m), K (Strickler)}
   */
  function capacite(p) {
    const g = geometrie(p.forme, p.b, p.y, p.m);
    const V = p.K * Math.pow(g.Rh, 2 / 3) * Math.sqrt(p.I);
    const Q = V * g.A;
    const Fr = V / Math.sqrt(9.81 * g.A / g.T); // Froude
    return {
      forme: p.forme, b: p.b, y: p.y, m: p.m || 0, I: p.I, K: p.K,
      A: round(g.A, 4), P: round(g.P, 3), Rh: round(g.Rh, 4),
      V: round(V, 2), Q: round(Q, 4), Qls: round(Q * 1000, 1),
      froude: round(Fr, 2), regime: Fr < 1 ? 'fluvial' : 'torrentiel',
      autocurage: V >= 0.5, vitesseOk: V <= 4
    };
  }

  /**
   * Dimensionnement : profondeur normale pour évacuer un débit Q.
   * @param {object} p {Qls (L/s), forme, b (m), m, I, K, revanche (m)}
   */
  function dimensionner(p) {
    const Q = p.Qls / 1000;
    // bissection sur le tirant d'eau y
    let lo = 0.001, hi = 10;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const g = geometrie(p.forme, p.b, mid, p.m);
      const q = p.K * Math.pow(g.Rh, 2 / 3) * Math.sqrt(p.I) * g.A;
      if (q < Q) lo = mid; else hi = mid;
    }
    const y = (lo + hi) / 2;
    const cap = capacite({ forme: p.forme, b: p.b, y, m: p.m, I: p.I, K: p.K });
    const revanche = p.revanche != null ? p.revanche : 0.05;
    const hTotal = y + revanche;
    return Object.assign(cap, {
      yNormal: round(y, 3),
      revanche,
      hTotal: round(hTotal, 3),
      messages: [].concat(
        cap.autocurage ? [] : ['Vitesse < 0,5 m/s : risque de dépôt (augmenter la pente).'],
        cap.vitesseOk ? [] : ['Vitesse > 4 m/s : risque d’érosion / protéger le radier.']
      )
    });
  }

  const G = 9.81;

  /** Profondeur normale (écoulement uniforme) pour un débit Q. */
  function profondeurNormale(p) {
    const Q = p.Q;
    let lo = 1e-4, hi = 20;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const g = geometrie(p.forme, p.b, mid, p.m);
      const q = p.K * Math.pow(g.Rh, 2 / 3) * Math.sqrt(p.I) * g.A;
      if (q < Q) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Profondeur critique (Fr = 1 : Q²·T / (g·A³) = 1). */
  function profondeurCritique(p) {
    const Q = p.Q;
    let lo = 1e-4, hi = 20;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const g = geometrie(p.forme, p.b, mid, p.m);
      const f = Q * Q * g.T / (G * Math.pow(g.A, 3)); // = 1 au critique
      if (f > 1) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Courbe de remous (régime graduellement varié) par la méthode du pas direct.
   * @param {object} p {forme, b, m, Q (m³/s), I (pente), K, yAval (tirant d'eau de contrôle), L}
   */
  function courbeRemous(p) {
    const yn = profondeurNormale(p);
    const yc = profondeurCritique(p);
    const pente = yn > yc ? 'faible (M)' : (yn < yc ? 'forte (S)' : 'critique');
    const Sf = (y) => {
      const g = geometrie(p.forme, p.b, y, p.m);
      const V = p.Q / g.A;
      return Math.pow(V / (p.K * Math.pow(g.Rh, 2 / 3)), 2);
    };
    const E = (y) => {
      const g = geometrie(p.forme, p.b, y, p.m);
      return y + p.Q * p.Q / (2 * G * g.A * g.A);
    };

    // classification du profil
    let type = '—';
    if (yn > yc) type = p.yAval > yn ? 'M1' : (p.yAval > yc ? 'M2' : 'M3');
    else if (yn < yc) type = p.yAval > yc ? 'S1' : (p.yAval > yn ? 'S2' : 'S3');

    // marche du pas direct de yAval vers yn (asymptote)
    const N = 80;
    let y = p.yAval;
    const cible = p.yAval > yn ? yn + 0.01 * (p.yAval - yn) : yn - 0.01 * (yn - p.yAval);
    const dy = (cible - p.yAval) / N;
    let x = 0;
    const profil = [{ x: 0, y: round(y, 3) }];
    const Lmax = p.L || 200;
    for (let i = 0; i < N; i++) {
      const y2 = y + dy;
      const SfMoy = (Sf(y) + Sf(y2)) / 2;
      const dx = (E(y2) - E(y)) / (p.I - SfMoy);
      x += dx;
      y = y2;
      if (Math.abs(x) > Lmax) break;
      profil.push({ x: round(Math.abs(x), 2), y: round(y, 3) });
    }
    profil.sort((a, b) => a.x - b.x);
    return {
      yn: round(yn, 3), yc: round(yc, 3), pente, type,
      sens: profil.length > 1 && x < 0 ? 'vers l’amont' : 'vers l’aval',
      longueur: round(Math.abs(x), 1),
      profil,
      messages: [`Profil ${type} sur pente ${pente} — tirant normal yn = ${round(yn, 3)} m, critique yc = ${round(yc, 3)} m.`]
    };
  }

  return { geometrie, capacite, dimensionner, profondeurNormale, profondeurCritique, courbeRemous };
});
