/*
 * concrete.js — Béton armé selon l'Eurocode 2 (EN 1992-1-1)
 * Flexion simple, effort tranchant, poteau (interaction N-M), dalle.
 * Unités d'entrée : efforts en kN / kN·m, dimensions en mm, contraintes en MPa.
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
    root.GC.concrete = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  const { betonProps, acierProps, choisirBarres, round } = core;

  // Limite du moment réduit pour acier seul (pivot, fyk=500 → x/d = 0.617)
  const MU_LIM = 0.372;

  /**
   * Dimensionnement d'une poutre rectangulaire en flexion simple (ELU).
   * @param {object} p
   * @param {number} p.MEd  moment de calcul [kN·m]
   * @param {number} p.b    largeur [mm]
   * @param {number} p.h    hauteur totale [mm]
   * @param {number} [p.d]  hauteur utile [mm] (défaut : 0.9·h)
   * @param {number} [p.enrobage] enrobage à l'axe des aciers tendus [mm]
   * @param {number} p.fck  résistance béton [MPa]
   * @param {number} p.fyk  limite élastique acier [MPa]
   */
  function flexionSimple(p) {
    const beton = betonProps(p.fck, p.gammaC, p.alphaCC);
    const acier = acierProps(p.fyk, p.gammaS);
    const b = p.b;
    const h = p.h;
    const d = p.d != null ? p.d : (p.enrobage != null ? h - p.enrobage : 0.9 * h);
    const dp = p.dPrime != null ? p.dPrime : 40; // axe aciers comprimés
    const M = p.MEd * 1e6; // N·mm

    const fcd = beton.fcd;
    const fyd = acier.fyd;

    const mu = M / (b * d * d * fcd);
    const result = {
      hypotheses: { b, h, d, dp, fcd: round(fcd, 2), fyd: round(fyd, 1), fctm: round(beton.fctm, 2) },
      mu: round(mu, 3),
      muLim: MU_LIM,
      aciersComprimes: false
    };

    if (mu <= MU_LIM) {
      // Section simplement armée
      const alpha = 1.25 * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu)));
      const z = d * (1 - 0.4 * alpha);
      const x = alpha * d;
      const As = M / (z * fyd); // mm²
      result.alpha = round(alpha, 3);
      result.x = round(x, 1);
      result.z = round(z, 1);
      result.As = round(As, 0);
    } else {
      // Section doublement armée
      const alphaLim = 0.617;
      const zLim = d * (1 - 0.4 * alphaLim);
      const Mlim = MU_LIM * b * d * d * fcd; // N·mm
      const As2 = (M - Mlim) / ((d - dp) * fyd); // aciers comprimés
      const As1 = Mlim / (zLim * fyd) + As2; // aciers tendus
      result.aciersComprimes = true;
      result.z = round(zLim, 1);
      result.x = round(alphaLim * d, 1);
      result.As = round(As1, 0);
      result.AsComprime = round(As2, 0);
    }

    // Acier minimal / maximal (EC2 §9.2.1.1)
    const AsMin = Math.max(0.26 * beton.fctm / p.fyk * b * d, 0.0013 * b * d);
    const AsMax = 0.04 * b * h;
    result.AsMin = round(AsMin, 0);
    result.AsMax = round(AsMax, 0);

    let AsRetenu = Math.max(result.As, AsMin);
    result.AsRetenu = round(AsRetenu, 0);
    result.depasseAsMax = AsRetenu > AsMax;
    result.choixBarres = choisirBarres(AsRetenu).slice(0, 5);
    result.statut = result.depasseAsMax ? 'NOK' : 'OK';
    result.messages = [];
    if (result.aciersComprimes) {
      result.messages.push('μ > μlim : section doublement armée (aciers comprimés requis).');
    }
    if (result.depasseAsMax) {
      result.messages.push('As > As,max (4 % de Ac) : augmenter la section de béton.');
    }
    if (AsRetenu === AsMin && result.As < AsMin) {
      result.messages.push('As de calcul < As,min : As,min retenu.');
    }
    return result;
  }

  /**
   * Vérification / dimensionnement à l'effort tranchant (EC2 §6.2).
   * @param {object} p
   * @param {number} p.VEd  effort tranchant [kN]
   * @param {number} p.bw   largeur de l'âme [mm]
   * @param {number} p.d    hauteur utile [mm]
   * @param {number} p.fck  [MPa]
   * @param {number} p.fyk  [MPa] (acier transversal)
   * @param {number} p.As   aciers longitudinaux tendus [mm²]
   * @param {number} [p.cotTheta] cot(θ) bielle (1..2.5), défaut 2.5
   */
  function effortTranchant(p) {
    const beton = betonProps(p.fck, p.gammaC, p.alphaCC);
    const bw = p.bw;
    const d = p.d;
    const VEd = p.VEd * 1e3; // N
    const fck = p.fck;
    const fcd = beton.fcd;
    const fywd = (p.fyk) / (p.gammaS || 1.15);

    // VRd,c — sans armatures d'effort tranchant
    const CRdc = 0.18 / (p.gammaC || 1.5);
    const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
    const rho = Math.min((p.As || 0) / (bw * d), 0.02);
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
    const VRdc = Math.max(CRdc * k * Math.pow(100 * rho * fck, 1 / 3), vmin) * bw * d; // N

    const z = 0.9 * d;
    const nu1 = 0.6 * (1 - fck / 250);

    const result = {
      VEd: p.VEd,
      VRdc: round(VRdc / 1e3, 1),
      k: round(k, 3),
      rho: round(rho, 4),
      z: round(z, 1),
      messages: []
    };

    if (VEd <= VRdc) {
      result.armaturesRequises = false;
      // Armatures minimales (EC2 §9.2.2)
      const rhowMin = 0.08 * Math.sqrt(fck) / p.fyk;
      result.AswSmin = round(rhowMin * bw, 3); // mm²/mm
      result.statut = 'OK';
      result.messages.push('VEd ≤ VRd,c : armatures d’effort tranchant minimales suffisantes.');
      return result;
    }

    // Bielles d'effort tranchant nécessaires
    let cot = p.cotTheta || 2.5;
    const VRdmax = (cot) => bw * z * nu1 * fcd / (cot + 1 / cot); // N
    let vmax = VRdmax(cot);
    if (VEd > vmax) {
      // Réduire cot(θ) (incliner la bielle) jusqu'à VRd,max ≥ VEd ou cot=1
      // VEd = bw·z·ν1·fcd/(cot+1/cot) → résoudre cot
      const A = bw * z * nu1 * fcd / VEd; // = cot + 1/cot
      // cot² - A·cot + 1 = 0
      const disc = A * A - 4;
      if (disc >= 0) {
        cot = (A - Math.sqrt(disc)) / 2; // racine ≤ ... on prend la branche utile
        // garder cot dans [1, 2.5]
        cot = Math.max(1, Math.min(2.5, cot));
      } else {
        cot = 1;
      }
      vmax = VRdmax(cot);
    }

    result.armaturesRequises = true;
    result.cotTheta = round(cot, 2);
    result.theta = round(Math.atan(1 / cot) * 180 / Math.PI, 1);
    result.VRdmax = round(vmax / 1e3, 1);

    if (VEd > vmax + 1) {
      result.statut = 'NOK';
      result.messages.push('VEd > VRd,max même avec θ=45° : section trop faible, augmenter bw ou d.');
      return result;
    }

    // Asw/s requis [mm²/mm]
    const AswS = VEd / (z * fywd * cot);
    const rhowMin = 0.08 * Math.sqrt(fck) / p.fyk;
    const AswSmin = rhowMin * bw;
    const AswSretenu = Math.max(AswS, AswSmin);
    result.AswS = round(AswS, 3);
    result.AswSmin = round(AswSmin, 3);
    result.AswSretenu = round(AswSretenu, 3);

    // Proposition d'espacement pour un cadre Ø8 (2 brins) et Ø10 (2 brins)
    result.espacements = [8, 10].map((phi) => {
      const Asw = 2 * core.aireBarre(phi); // 2 brins
      const s = Asw / AswSretenu;
      const sMax = Math.min(0.75 * d, 400);
      return { phi, brins: 2, s: round(Math.min(s, sMax), 0), sMax: round(sMax, 0) };
    });
    result.statut = 'OK';
    result.messages.push('VEd > VRd,c : armatures d’effort tranchant calculées (treillis de Ritter-Mörsch).');
    return result;
  }

  /**
   * Dalle pleine portant dans une direction — flexion par mètre de largeur.
   * Réutilise la flexion simple avec b = 1000 mm.
   */
  function dalle(p) {
    const r = flexionSimple({
      MEd: p.MEd,
      b: 1000,
      h: p.h,
      d: p.d != null ? p.d : p.h - (p.enrobage != null ? p.enrobage : 25),
      fck: p.fck,
      fyk: p.fyk,
      gammaC: p.gammaC,
      gammaS: p.gammaS
    });
    r.parMetre = true;
    // Espacement des barres pour As,retenu (par mètre)
    r.choixEspacement = [8, 10, 12].map((phi) => {
      const a = core.aireBarre(phi);
      const s = a * 1000 / r.AsRetenu; // mm
      return { phi, s: round(Math.min(s, 250), 0) };
    });
    return r;
  }

  /**
   * Diagramme d'interaction N-M d'un poteau rectangulaire à armatures
   * symétriques (As/2 sur chaque face). Flexion uniaxiale + effort normal.
   */
  function interactionPoteau(p, As) {
    const beton = betonProps(p.fck, p.gammaC, p.alphaCC);
    const acier = acierProps(p.fyk, p.gammaS);
    const b = p.b, h = p.h;
    const dp = p.dPrime != null ? p.dPrime : 45;
    const d = h - dp;
    const fcd = beton.fcd, fyd = acier.fyd, Es = acier.Es;
    const epscu = core.FACTEURS.epsCU2;
    const eta = beton.eta, lambda = beton.lambda;
    const As1 = As / 2, As2 = As / 2; // tendue (à d) et comprimée (à dp)

    const pts = [];
    // Balayage de la profondeur d'axe neutre
    const xs = [];
    for (let x = 0.02 * h; x <= 2.5 * h; x += 0.02 * h) xs.push(x);
    for (const x of xs) {
      const Fc = eta * fcd * b * Math.min(lambda * x, h); // N (limité à la section)
      const epss2 = epscu * (x - dp) / x;
      const epss1 = epscu * (x - d) / x;
      const sig = (eps) => Math.max(-fyd, Math.min(fyd, Es * eps));
      const s2 = sig(epss2), s1 = sig(epss1);
      const Fs2 = As2 * s2, Fs1 = As1 * s1;
      const N = Fc + Fs2 + Fs1; // N (compression +)
      const aC = Math.min(lambda * x, h) / 2;
      const M = Fc * (h / 2 - aC) + Fs2 * (h / 2 - dp) + Fs1 * (h / 2 - d); // N·mm
      pts.push({ N: N / 1e3, M: Math.abs(M) / 1e6 });
    }
    // Point de compression centrée pure
    const N0 = (eta * fcd * b * h + As * fyd) / 1e3;
    pts.unshift({ N: N0, M: 0 });
    return pts;
  }

  /**
   * Vérification d'un poteau (N, M) — recherche des aciers symétriques requis.
   */
  function poteau(p) {
    const beton = betonProps(p.fck, p.gammaC, p.alphaCC);
    const acier = acierProps(p.fyk, p.gammaS);
    const b = p.b, h = p.h;
    const NEd = p.NEd; // kN (compression +)
    const e0 = Math.max(p.MEd ? p.MEd / NEd * 1000 : 0, h / 30, 20); // excentricité min [mm]
    const MEd = Math.max(p.MEd || 0, NEd * e0 / 1000); // kN·m

    const Ac = b * h;
    const AsMin = Math.max(0.10 * NEd * 1e3 / acier.fyd, 0.002 * Ac);
    const AsMax = 0.04 * Ac;

    // Recherche par bissection des As tels que (NEd, MEd) soit sur le diagramme
    const capaciteM = (As) => {
      const pts = interactionPoteau(p, As);
      // M résistant à N = NEd (interpolation sur l'enveloppe)
      let best = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], c = pts[i];
        if ((a.N - NEd) * (c.N - NEd) <= 0 && a.N !== c.N) {
          const t = (NEd - a.N) / (c.N - a.N);
          best = Math.max(best, a.M + t * (c.M - a.M));
        }
      }
      return best;
    };

    let lo = AsMin, hi = AsMax, As = AsMin;
    let faisable = capaciteM(hi) >= MEd;
    if (capaciteM(lo) >= MEd) {
      As = lo;
    } else if (!faisable) {
      As = hi;
    } else {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (capaciteM(mid) >= MEd) hi = mid; else lo = mid;
      }
      As = hi;
    }

    // Élancement (si longueur fournie)
    let elancement = null;
    if (p.l0) {
      const i = h / Math.sqrt(12); // rayon de giration section rect. (mm), axe fort h
      const lambda = (p.l0 * 1000) / i;
      const lambdaLim = 20 * 0.7 * 1.1 / Math.sqrt(NEd * 1e3 / (Ac * beton.fcd)); // approx EC2 §5.8.3.1
      elancement = {
        lambda: round(lambda, 0),
        lambdaLim: round(lambdaLim, 0),
        elance: lambda > lambdaLim
      };
    }

    return {
      hypotheses: { b, h, Ac, fcd: round(beton.fcd, 2), fyd: round(acier.fyd, 1) },
      NEd: round(NEd, 1),
      MEd: round(MEd, 2),
      e0: round(e0, 1),
      AsMin: round(AsMin, 0),
      AsMax: round(AsMax, 0),
      As: round(Math.max(As, AsMin), 0),
      faisable,
      capaciteM: round(capaciteM(Math.max(As, AsMin)), 2),
      N0: round((beton.eta * beton.fcd * Ac + Math.max(As, AsMin) * acier.fyd) / 1e3, 0),
      choixBarres: choisirBarres(Math.max(As, AsMin)).slice(0, 5),
      elancement,
      interaction: interactionPoteau(p, Math.max(As, AsMin)),
      statut: faisable ? 'OK' : 'NOK',
      messages: faisable ? [] : ['Section insuffisante : (N,M) hors du diagramme même à As,max. Augmenter la section.']
    };
  }

  return {
    MU_LIM,
    flexionSimple,
    effortTranchant,
    dalle,
    poteau,
    interactionPoteau
  };
});
