/*
 * network.js — Réseau d'assainissement gravitaire : profil en long
 * Calcule, regard par regard, les cotes (terrain, fil d'eau, génératrice
 * supérieure, fond de fouille) et, tronçon par tronçon, l'écoulement à
 * surface libre en section circulaire partiellement remplie (Manning).
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
    root.GC.network = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;
  const G = 9.81;

  /** Géométrie d'une section circulaire partiellement remplie (angle θ). */
  function sectionCirc(D, theta) {
    const A = D * D / 8 * (theta - Math.sin(theta));
    const P = D * theta / 2;
    const y = D / 2 * (1 - Math.cos(theta / 2));
    return { A, P, Rh: A / P, y };
  }

  /** Profondeur normale et vitesse dans un tuyau circulaire (Manning). */
  function ecoulementCirc(Q, D, I, K) {
    // capacité maximale (vers y/D ≈ 0,94, θ ≈ 5,27)
    const thetaMax = 5.27;
    const debit = (theta) => {
      const s = sectionCirc(D, theta);
      return K * s.A * Math.pow(s.Rh, 2 / 3) * Math.sqrt(I);
    };
    const Qmax = debit(thetaMax);
    if (I <= 0) return { enCharge: true, yD: 1, V: 0, remplissage: 100, Q };
    if (Q >= Qmax) {
      const s = sectionCirc(D, thetaMax);
      return { enCharge: true, yD: 0.94, V: round(Q / s.A, 2), remplissage: 100, Qmax: round(Qmax, 4) };
    }
    let lo = 0.001, hi = thetaMax;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (debit(mid) < Q) lo = mid; else hi = mid;
    }
    const theta = (lo + hi) / 2;
    const s = sectionCirc(D, theta);
    const V = Q / s.A;
    return {
      enCharge: false,
      y: round(s.y, 3), yD: round(s.y / D, 3), V: round(V, 2),
      remplissage: round(s.y / D * 100, 0),
      Qmax: round(Qmax, 4),
      Vpleine: round(K * Math.pow(D / 4, 2 / 3) * Math.sqrt(I), 2)
    };
  }

  /**
   * Profil en long du réseau.
   * @param {object} p
   * @param {Array<{nom, PM (m), TN (m)}>} p.noeuds  regards (amont→aval)
   * @param {Array<{DN (mm), DE (mm), K, Q (L/s), pente (m/m)}>} p.troncons  (n-1)
   * @param {number} p.filEauDepart  cote fil d'eau au premier regard [m]
   * @param {number} [p.eLit] épaisseur du lit de pose [m]
   * @param {number} [p.couvertureMin] couverture minimale [m]
   * @param {number} [p.penteMin] pente minimale d'autocurage [m/m]
   */
  function profil(p) {
    const N = p.noeuds.length;
    const eLit = p.eLit != null ? p.eLit : 0.10;
    const couvMin = p.couvertureMin != null ? p.couvertureMin : 0.80;
    const penteMin = p.penteMin != null ? p.penteMin : 0.003;

    // fil d'eau par marche descendante
    const filEau = new Array(N);
    filEau[0] = p.filEauDepart;
    for (let k = 0; k < N - 1; k++) {
      const L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      filEau[k + 1] = filEau[k] - p.troncons[k].pente * L;
    }

    // cotes par regard (DE du tronçon adjacent : aval pour les regards amont)
    const noeuds = p.noeuds.map((nd, k) => {
      const tr = p.troncons[Math.min(k, N - 2)];
      const DE = tr.DE / 1000;
      const crown = filEau[k] + DE;
      const fond = filEau[k] - (DE - tr.DN / 1000) / 2 - eLit;
      const couv = nd.TN - crown;
      return {
        nom: nd.nom, PM: nd.PM, TN: round(nd.TN, 3),
        filEau: round(filEau[k], 3),
        crown: round(crown, 3),
        fondFouille: round(fond, 3),
        couverture: round(couv, 2),
        hauteurFouille: round(nd.TN - fond, 2),
        couvertureOk: couv >= couvMin
      };
    });

    // hydraulique par tronçon
    const troncons = p.troncons.map((tr, k) => {
      const L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      const ec = ecoulementCirc((tr.Q || 0) / 1000, tr.DN / 1000, tr.pente, tr.K || 80);
      const autocurage = !ec.enCharge && ec.V >= 0.6;
      const remplOk = !ec.enCharge && ec.yD <= 0.85;
      const penteOk = tr.pente >= penteMin;
      const statut = (!ec.enCharge && autocurage && remplOk && penteOk) ? 'OK' : 'NOK';
      return {
        de: p.noeuds[k].nom, vers: p.noeuds[k + 1].nom,
        longueur: round(L, 1), pente: tr.pente, penteMm: round(tr.pente * 1000, 1),
        DN: tr.DN, Q: tr.Q,
        V: ec.V, remplissage: ec.remplissage, yD: ec.yD,
        enCharge: ec.enCharge, autocurage, remplOk, penteOk, Qmax: ec.Qmax,
        statut,
        messages: [].concat(
          ec.enCharge ? ['Tronçon en charge (capacité dépassée).'] : [],
          (!ec.enCharge && ec.V < 0.6) ? ['Vitesse < 0,6 m/s : autocurage non assuré.'] : [],
          (!ec.enCharge && ec.yD > 0.85) ? ['Remplissage > 85 % : prévoir un DN supérieur.'] : [],
          !penteOk ? [`Pente < ${penteMin * 1000} ‰ (mini d'autocurage).`] : []
        )
      };
    });

    const statutGlobal = troncons.every((t) => t.statut === 'OK') && noeuds.every((n) => n.couvertureOk) ? 'OK' : 'NOK';
    return { noeuds, troncons, statut: statutGlobal };
  }

  return { sectionCirc, ecoulementCirc, profil };
});
