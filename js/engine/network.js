/*
 * network.js — Réseau d'assainissement gravitaire : profil en long
 * Cotes par regard (terrain, fil d'eau amont/aval, génératrice supérieure,
 * fond de fouille), chutes/décrochements dans les regards, écoulement à
 * surface libre (Manning, section circulaire), optimisation du fil d'eau et
 * vérification de la mise en charge (ligne piézométrique).
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

  function sectionCirc(D, theta) {
    const A = D * D / 8 * (theta - Math.sin(theta));
    const P = D * theta / 2;
    const y = D / 2 * (1 - Math.cos(theta / 2));
    return { A, P, Rh: A / P, y };
  }

  /** Écoulement normal dans un tuyau circulaire (Manning). */
  function ecoulementCirc(Q, D, I, K) {
    const thetaMax = 5.27;
    const Afull = Math.PI * D * D / 4;
    const debit = (theta) => {
      const s = sectionCirc(D, theta);
      return K * s.A * Math.pow(s.Rh, 2 / 3) * Math.sqrt(Math.max(I, 1e-6));
    };
    const Qmax = debit(thetaMax);
    if (Q >= Qmax || I <= 0) {
      return { enCharge: true, yD: 1, V: round(Q / Afull, 2), remplissage: 100, Qmax: round(Qmax, 4) };
    }
    let lo = 0.001, hi = thetaMax;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (debit(mid) < Q) lo = mid; else hi = mid;
    }
    const s = sectionCirc(D, (lo + hi) / 2);
    return {
      enCharge: false, y: round(s.y, 3), yD: round(s.y / D, 3),
      V: round(Q / s.A, 2), remplissage: round(s.y / D * 100, 0), Qmax: round(Qmax, 4)
    };
  }

  /** Profil en long (avec chutes éventuelles aux regards). */
  function profil(p) {
    const N = p.noeuds.length;
    const eLit = p.eLit != null ? p.eLit : 0.10;
    const couvMin = p.couvertureMin != null ? p.couvertureMin : 0.80;
    const penteMin = p.penteMin != null ? p.penteMin : 0.003;

    const filIn = new Array(N), filOut = new Array(N);
    filIn[0] = p.filEauDepart;
    filOut[0] = filIn[0] - (p.noeuds[0].chute || 0);
    for (let k = 0; k < N - 1; k++) {
      const L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      filIn[k + 1] = filOut[k] - p.troncons[k].pente * L;
      filOut[k + 1] = filIn[k + 1] - (p.noeuds[k + 1].chute || 0);
    }

    const noeuds = p.noeuds.map((nd, k) => {
      const trLeave = p.troncons[Math.min(k, N - 2)];
      const trArr = p.troncons[Math.max(0, k - 1)];
      const DEav = trLeave.DE / 1000, DEam = trArr.DE / 1000;
      const invAval = (k < N - 1) ? filOut[k] : filIn[k];
      const DEgov = (k < N - 1) ? DEav : DEam;
      const DNgov = (k < N - 1) ? trLeave.DN / 1000 : trArr.DN / 1000;
      const crown = invAval + DEgov;
      const fond = invAval - (DEgov - DNgov) / 2 - eLit;
      const couv = nd.TN - crown;
      return {
        nom: nd.nom, PM: nd.PM, TN: round(nd.TN, 3),
        filEauAmont: round(filIn[k], 3), filEauAval: round(filOut[k], 3),
        filEau: round(invAval, 3), chute: round(nd.chute || 0, 3),
        crownAmont: round(filIn[k] + DEam, 3), crownAval: round(filOut[k] + DEav, 3),
        crown: round(crown, 3), fondFouille: round(fond, 3),
        couverture: round(couv, 2), hauteurFouille: round(nd.TN - fond, 2),
        couvertureOk: couv >= couvMin
      };
    });

    const troncons = p.troncons.map((tr, k) => {
      const L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      const ec = ecoulementCirc((tr.Q || 0) / 1000, tr.DN / 1000, tr.pente, tr.K || 80);
      const autocurage = !ec.enCharge && ec.V >= 0.6;
      const remplOk = !ec.enCharge && ec.yD <= 0.85;
      const penteOk = tr.pente >= penteMin;
      return {
        de: p.noeuds[k].nom, vers: p.noeuds[k + 1].nom,
        longueur: round(L, 1), pente: tr.pente, penteMm: round(tr.pente * 1000, 1),
        DN: tr.DN, Q: tr.Q, V: ec.V, remplissage: ec.remplissage, yD: ec.yD,
        enCharge: ec.enCharge, autocurage, Qmax: ec.Qmax,
        statut: (!ec.enCharge && autocurage && remplOk && penteOk) ? 'OK' : 'NOK',
        messages: [].concat(
          ec.enCharge ? ['Tronçon en charge (capacité dépassée).'] : [],
          (!ec.enCharge && ec.V < 0.6) ? ['Vitesse < 0,6 m/s : autocurage non assuré.'] : [],
          (!ec.enCharge && ec.yD > 0.85) ? ['Remplissage > 85 % : prévoir un DN supérieur.'] : [],
          !penteOk ? [`Pente < ${penteMin * 1000} ‰.`] : []
        )
      };
    });

    const aChutes = noeuds.some((n) => n.chute > 0.001);
    const statut = troncons.every((t) => t.statut === 'OK') && noeuds.every((n) => n.couvertureOk) ? 'OK' : 'NOK';
    return { noeuds, troncons, statut, aChutes };
  }

  /**
   * Optimisation du fil d'eau : couverture minimale respectée, pente bornée,
   * décrochements (chutes) introduits aux regards là où le terrain plonge.
   */
  function optimiser(p) {
    const N = p.noeuds.length;
    const coverMin = p.couvertureMin != null ? p.couvertureMin : 0.80;
    const sMin = p.penteMin != null ? p.penteMin : 0.003;
    const sMax = p.penteMax != null ? p.penteMax : 0.05;
    const DE0 = p.troncons[0].DE / 1000;
    const filOut = new Array(N), filIn = new Array(N), chute = new Array(N), pente = new Array(N - 1);
    filIn[0] = p.noeuds[0].TN - coverMin - DE0;
    filOut[0] = filIn[0]; chute[0] = 0;
    for (let k = 0; k < N - 1; k++) {
      const L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      const terrain = (p.noeuds[k].TN - p.noeuds[k + 1].TN) / L;
      const s = Math.min(Math.max(terrain, sMin), sMax);
      pente[k] = round(s, 4);
      filIn[k + 1] = filOut[k] - s * L;
      const DEk = p.troncons[Math.min(k + 1, N - 2)].DE / 1000;
      const ideal = p.noeuds[k + 1].TN - coverMin - DEk;
      if (filIn[k + 1] > ideal + 1e-6) {
        chute[k + 1] = round(filIn[k + 1] - ideal, 3);
        filOut[k + 1] = ideal;
      } else { chute[k + 1] = 0; filOut[k + 1] = filIn[k + 1]; }
    }
    return {
      filEauDepart: round(filIn[0], 3),
      pentes: pente,
      chutes: chute.map((c) => round(c, 3)),
      nbChutes: chute.filter((c) => c > 0.001).length
    };
  }

  /**
   * Vérification de la mise en charge : ligne piézométrique marchée depuis
   * l'aval. Pour les tronçons en charge, perte de charge par frottement
   * (Manning section pleine) ; débordement si la ligne dépasse le terrain.
   */
  function ligneCharge(p, niveauAval) {
    const pr = profil(p);
    const N = pr.noeuds.length;
    const HGL = new Array(N);
    HGL[N - 1] = niveauAval != null ? niveauAval : pr.noeuds[N - 1].filEau + 0.05;
    for (let k = N - 2; k >= 0; k--) {
      const tr = p.troncons[k];
      const D = tr.DN / 1000, Q = (tr.Q || 0) / 1000, L = p.noeuds[k + 1].PM - p.noeuds[k].PM;
      const Afull = Math.PI * D * D / 4, Rh = D / 4;
      const V = Q / Afull;
      const Sf = Math.pow(V / ((tr.K || 80) * Math.pow(Rh, 2 / 3)), 2);
      const dH = Sf * L;
      const enCharge = pr.troncons[k].enCharge;
      if (enCharge) {
        HGL[k] = Math.max(HGL[k + 1] + dH, pr.noeuds[k].crownAval);
      } else {
        // surface libre : ligne d'eau ≈ fil d'eau + tirant normal
        HGL[k] = Math.max(pr.noeuds[k].filEauAval + (tr.yNormal || pr.troncons[k].yD * D), HGL[k + 1]);
      }
    }
    const noeuds = pr.noeuds.map((n, k) => ({
      nom: n.nom, PM: n.PM, TN: n.TN, crown: n.crown, HGL: round(HGL[k], 3),
      enCharge: HGL[k] > n.crown + 1e-3,
      debordement: HGL[k] > n.TN + 1e-3
    }));
    return {
      noeuds,
      miseEnCharge: noeuds.some((n) => n.enCharge),
      debordement: noeuds.some((n) => n.debordement),
      statut: noeuds.some((n) => n.debordement) ? 'NOK' : (noeuds.some((n) => n.enCharge) ? 'AVEC RÉSERVES' : 'OK')
    };
  }

  return { sectionCirc, ecoulementCirc, profil, optimiser, ligneCharge };
});
