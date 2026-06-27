/*
 * beam.js — Analyse de structures (RDM)
 * Solveur de poutre continue par la méthode des éléments finis (raideur directe).
 * Élément de poutre d'Euler-Bernoulli à 2 nœuds, 2 ddl/nœud (flèche v, rotation θ).
 *
 * Conventions :
 *   - x croissant de gauche à droite [m]
 *   - charges descendantes positives [kN] ou [kN/m]
 *   - moment fléchissant positif = fibre inférieure tendue (sagging)
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.beam = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Résout A·x = b par élimination de Gauss avec pivot partiel. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.slice().concat(b[i]));
    for (let col = 0; col < n; col++) {
      // pivot
      let piv = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      }
      if (Math.abs(M[piv][col]) < 1e-12) continue;
      [M[col], M[piv]] = [M[piv], M[col]];
      const d = M[col][col];
      for (let j = col; j <= n; j++) M[col][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (f === 0) continue;
        for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
      }
    }
    return M.map((row) => row[n]);
  }

  function approxEqual(a, b, tol) {
    return Math.abs(a - b) < (tol || 1e-6);
  }

  /**
   * @param {object} model
   * @param {Array<{x:number, type:'libre'|'appui'|'encastrement'}>} model.supports
   *        positions et types d'appuis (appui = bloque v ; encastrement = bloque v et θ)
   * @param {number} model.EI  rigidité flexionnelle [kN·m²]
   * @param {Array<{x:number, P:number}>} [model.pointLoads] charges ponctuelles [kN]
   * @param {Array<{x1:number, x2:number, w:number}>} [model.distLoads] charges réparties [kN/m]
   * @param {Array<{x:number, M:number}>} [model.moments] moments appliqués [kN·m]
   * @param {number} [model.nSub] subdivisions par segment (résolution des diagrammes)
   */
  function solveBeam(model) {
    const EI = model.EI;
    const nSub = model.nSub || 12;
    const supports = model.supports.slice().sort((a, b) => a.x - b.x);
    const pointLoads = model.pointLoads || [];
    const distLoads = model.distLoads || [];
    const moments = model.moments || [];

    const L = supports[supports.length - 1].x;
    const x0 = supports[0].x;

    // 1) Positions clés : appuis, charges ponctuelles, bornes des charges réparties
    const keys = new Set();
    supports.forEach((s) => keys.add(round6(s.x)));
    pointLoads.forEach((p) => keys.add(round6(p.x)));
    moments.forEach((m) => keys.add(round6(m.x)));
    distLoads.forEach((d) => { keys.add(round6(d.x1)); keys.add(round6(d.x2)); });
    let keyList = Array.from(keys).filter((x) => x >= x0 - 1e-9 && x <= L + 1e-9).sort((a, b) => a - b);

    // 2) Maillage : subdivisions entre positions clés consécutives
    const nodesX = [];
    for (let i = 0; i < keyList.length - 1; i++) {
      const a = keyList[i], c = keyList[i + 1];
      for (let s = 0; s < nSub; s++) {
        nodesX.push(a + (c - a) * s / nSub);
      }
    }
    nodesX.push(keyList[keyList.length - 1]);
    // dédoublonnage
    const ux = [];
    for (const x of nodesX) {
      if (ux.length === 0 || Math.abs(x - ux[ux.length - 1]) > 1e-9) ux.push(x);
    }
    const nNodes = ux.length;
    const nDof = 2 * nNodes;

    const nodeIndex = (x) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < nNodes; i++) {
        const d = Math.abs(ux[i] - x);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };

    // 3) Assemblage de la matrice de raideur globale et du vecteur charges
    const K = Array.from({ length: nDof }, () => new Array(nDof).fill(0));
    const F = new Array(nDof).fill(0);
    // mémorise les forces d'encastrement parfait par élément (pour efforts internes)
    const elems = [];

    for (let e = 0; e < nNodes - 1; e++) {
      const xi = ux[e], xj = ux[e + 1];
      const Le = xj - xi;
      const c = EI / (Le * Le * Le);
      // matrice élémentaire 4x4, ddl [vi, θi, vj, θj]
      const ke = [
        [12 * c, 6 * Le * c, -12 * c, 6 * Le * c],
        [6 * Le * c, 4 * Le * Le * c, -6 * Le * c, 2 * Le * Le * c],
        [-12 * c, -6 * Le * c, 12 * c, -6 * Le * c],
        [6 * Le * c, 2 * Le * Le * c, -6 * Le * c, 4 * Le * Le * c]
      ];
      const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++)
          K[map[a]][map[b]] += ke[a][b];

      // charge répartie couvrant l'élément (par construction, uniforme sur l'élément)
      let w = 0;
      const xm = (xi + xj) / 2;
      for (const dl of distLoads) {
        if (xm > Math.min(dl.x1, dl.x2) - 1e-9 && xm < Math.max(dl.x1, dl.x2) + 1e-9) {
          w += dl.w;
        }
      }
      // forces nodales équivalentes (encastrement parfait) pour charge w descendante
      const fe = [w * Le / 2, w * Le * Le / 12, w * Le / 2, -w * Le * Le / 12];
      // signe : charge descendante => réactions verticales vers le haut sur la poutre
      F[map[0]] -= fe[0];
      F[map[1]] -= fe[1];
      F[map[2]] -= fe[2];
      F[map[3]] -= fe[3];
      elems.push({ e, xi, xj, Le, w, fe });
    }

    // Charges ponctuelles -> au nœud le plus proche (ddl vertical)
    for (const pl of pointLoads) {
      const idx = nodeIndex(pl.x);
      F[2 * idx] -= pl.P; // descendant
    }
    // Moments appliqués -> ddl rotation
    for (const m of moments) {
      const idx = nodeIndex(m.x);
      F[2 * idx + 1] += m.M;
    }

    // 4) Conditions aux limites
    const fixed = new Array(nDof).fill(false);
    for (const s of supports) {
      const idx = nodeIndex(s.x);
      if (s.type === 'appui' || s.type === 'encastrement') fixed[2 * idx] = true;
      if (s.type === 'encastrement') fixed[2 * idx + 1] = true;
    }

    // Réduction : on impose u=0 sur les ddl bloqués (méthode de pénalité propre = élimination)
    const free = [];
    for (let i = 0; i < nDof; i++) if (!fixed[i]) free.push(i);

    const Kff = free.map((r) => free.map((c) => K[r][c]));
    const Ff = free.map((r) => F[r]);
    const Uf = solve(Kff, Ff);

    const U = new Array(nDof).fill(0);
    free.forEach((dof, i) => { U[dof] = Uf[i]; });

    // 5) Réactions : R = K·U - F (sur ddl bloqués)
    const reactions = [];
    for (const s of supports) {
      const idx = nodeIndex(s.x);
      let Rv = 0;
      for (let j = 0; j < nDof; j++) Rv += K[2 * idx][j] * U[j];
      Rv -= F[2 * idx];
      let Rm = null;
      if (s.type === 'encastrement') {
        let m = 0;
        for (let j = 0; j < nDof; j++) m += K[2 * idx + 1][j] * U[j];
        m -= F[2 * idx + 1];
        Rm = m;
      }
      reactions.push({ x: s.x, type: s.type, Rv, Rm });
    }

    // 6) Efforts internes V, M et flèche le long de la poutre
    const diagram = [];
    for (const el of elems) {
      const ue = [U[2 * el.e], U[2 * el.e + 1], U[2 * el.e + 2], U[2 * el.e + 3]];
      const Le = el.Le;
      const c = EI / (Le * Le * Le);
      const ke = [
        [12 * c, 6 * Le * c, -12 * c, 6 * Le * c],
        [6 * Le * c, 4 * Le * Le * c, -6 * Le * c, 2 * Le * Le * c],
        [-12 * c, -6 * Le * c, 12 * c, -6 * Le * c],
        [6 * Le * c, 2 * Le * Le * c, -6 * Le * c, 4 * Le * Le * c]
      ];
      // forces nodales de l'élément = ke·ue + forces d'encastrement
      const fend = [0, 1, 2, 3].map((a) =>
        ke[a][0] * ue[0] + ke[a][1] * ue[1] + ke[a][2] * ue[2] + ke[a][3] * ue[3] + el.fe[a]
      );
      // Au nœud i : effort tranchant = fend[0], moment = -fend[1] (convention sagging+)
      const Vi = fend[0];
      const Mi = -fend[1];
      const w = el.w;
      // échantillonnage interne
      const steps = 4;
      for (let s = 0; s <= steps; s++) {
        const xi = (Le) * s / steps;
        const V = Vi - w * xi;
        const M = Mi + Vi * xi - w * xi * xi / 2;
        // flèche par fonctions de forme d'Hermite
        const xL = xi / Le;
        const N1 = 1 - 3 * xL * xL + 2 * xL * xL * xL;
        const N2 = Le * (xL - 2 * xL * xL + xL * xL * xL);
        const N3 = 3 * xL * xL - 2 * xL * xL * xL;
        const N4 = Le * (-xL * xL + xL * xL * xL);
        const v = N1 * ue[0] + N2 * ue[1] + N3 * ue[2] + N4 * ue[3];
        diagram.push({ x: el.xi + xi, V, M, v });
      }
    }
    // tri + nettoyage doublons en x
    diagram.sort((a, b) => a.x - b.x);

    // Extrema
    let Vmax = { x: 0, val: 0 }, Mmax = { x: 0, val: 0 }, Mmin = { x: 0, val: 0 }, fmax = { x: 0, val: 0 };
    for (const d of diagram) {
      if (Math.abs(d.V) > Math.abs(Vmax.val)) Vmax = { x: d.x, val: d.V };
      if (d.M > Mmax.val) Mmax = { x: d.x, val: d.M };
      if (d.M < Mmin.val) Mmin = { x: d.x, val: d.M };
      if (Math.abs(d.v) > Math.abs(fmax.val)) fmax = { x: d.x, val: d.v };
    }

    // Vérification d'équilibre global
    const sumLoads = pointLoads.reduce((a, p) => a + p.P, 0)
      + distLoads.reduce((a, d) => a + d.w * Math.abs(d.x2 - d.x1), 0);
    const sumReac = reactions.reduce((a, r) => a + r.Rv, 0);

    return {
      L, span: L - x0,
      reactions,
      diagram,
      Vmax, Mmax, Mmin,
      flecheMax: { x: fmax.x, val: fmax.val * 1000 }, // mm (U en m car EI en kN·m²)
      equilibre: { sumLoads, sumReac, ecart: sumReac - sumLoads, ok: approxEqual(sumReac, sumLoads, 1e-3) }
    };
  }

  function round6(x) { return Math.round(x * 1e6) / 1e6; }

  return { solveBeam, solve };
});
