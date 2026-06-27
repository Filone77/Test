/*
 * validator.js — Vérificateur de note de calcul (contrôle technique)
 * Recalcule indépendamment le résultat annoncé, le compare, rend un verdict
 * (conforme / avec réserves / non conforme) et propose des corrections.
 * S'appuie sur les moteurs de calcul existants.
 */
(function (root, factory) {
  'use strict';
  const dep = (n) => (typeof require === 'function' ? require(n) : null);
  const api = factory(
    dep('./core.js') || root.GC.core,
    dep('./concrete.js') || root.GC.concrete,
    dep('./quantities.js') || root.GC.quantities,
    dep('./retaining.js') || root.GC.retaining,
    dep('./vrd.js') || root.GC.vrd
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.validator = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core, concrete, quantities, retaining, vrd) {
  'use strict';
  const round = core.round;

  function ctrl(libelle, note, calcul, statut, correction, unite) {
    return { libelle, note, calcul, statut, correction: correction || '', unite: unite || '' };
  }

  function verdictGlobal(controles) {
    if (controles.some((c) => c.statut === 'NOK')) return 'NON CONFORME';
    if (controles.some((c) => c.statut === 'RÉSERVE')) return 'AVEC RÉSERVES';
    return 'CONFORME';
  }

  /** Compare une valeur « ressource » (As, B, capacité) : la note doit être ≥ au requis. */
  function compareMin(note, requis, tol) {
    tol = tol || 0.03;
    if (note == null || isNaN(note)) return { statut: 'RÉSERVE', msg: 'Valeur non renseignée dans la note.' };
    if (note >= requis * (1 - tol)) {
      if (note > requis * 1.5 && requis > 0) return { statut: 'RÉSERVE', msg: 'Surdimensionné (> 1,5× le requis) — possible optimisation.' };
      return { statut: 'OK', msg: '' };
    }
    return { statut: 'NOK', msg: `Insuffisant : porter à ${round(requis, 0)} (requis).` };
  }

  /** Vérifie qu'une valeur respecte un plafond (contrainte, taux). */
  function compareMax(note, limite, tol) {
    tol = tol || 0.03;
    if (note == null || isNaN(note)) return { statut: 'RÉSERVE', msg: 'Valeur non renseignée.' };
    if (note <= limite * (1 + tol)) return { statut: 'OK', msg: '' };
    return { statut: 'NOK', msg: `Dépasse la limite ${round(limite, 1)}.` };
  }

  // --- Types de vérification -------------------------------------------

  function baFlexion(d) {
    const r = concrete.flexionSimple({ MEd: d.MEd, b: d.b, h: d.h, d: d.d, fck: d.fck, fyk: d.fyk });
    const cAs = compareMin(d.As_note, r.AsRetenu);
    const controles = [
      ctrl('Section d’acier As', d.As_note, r.AsRetenu, cAs.statut, cAs.msg, 'mm²'),
      ctrl('Respect de As,min', d.As_note, r.AsMin, (d.As_note >= r.AsMin ? 'OK' : 'NOK'),
        d.As_note >= r.AsMin ? '' : `As < As,min : porter à ${r.AsMin} mm².`, 'mm²'),
      ctrl('Respect de As,max', d.As_note, r.AsMax, (d.As_note <= r.AsMax ? 'OK' : 'NOK'),
        d.As_note <= r.AsMax ? '' : 'As > As,max (4 % Ac) : section trop petite.', 'mm²')
    ];
    return finalise('Flexion simple (BA)', controles, [
      `Moment réduit μ = ${r.mu} (${r.aciersComprimes ? 'aciers comprimés requis' : 'section simplement armée'}).`,
      `Bras de levier z = ${r.z} mm, As requis = ${r.AsRetenu} mm².`
    ], r);
  }

  function semelle(d) {
    const r = quantities.semelleIsolee({ NEd: d.NEd, Nser: d.Nser, sigmaSol: d.sigmaSol, a: d.a, b: d.b, fck: d.fck, fyk: d.fyk });
    const sigmaNote = d.A_note ? (r.Nser / (d.A_note * d.A_note)) : null;
    const cA = compareMin(d.A_note, r.A);
    const cAs = compareMin(d.As_note, r.AsX);
    const cSig = sigmaNote != null ? compareMax(sigmaNote, d.sigmaSol) : { statut: 'RÉSERVE', msg: 'Dimension non renseignée.' };
    const controles = [
      ctrl('Côté de la semelle A', d.A_note, r.A, cA.statut, cA.msg, 'm'),
      ctrl('Contrainte sur le sol', sigmaNote != null ? round(sigmaNote, 0) : null, d.sigmaSol, cSig.statut, cSig.msg, 'kPa'),
      ctrl('Aciers / direction', d.As_note, r.AsX, cAs.statut, cAs.msg, 'cm²')
    ];
    return finalise('Semelle isolée', controles, [
      `Surface requise (ELS) = ${r.Sreq} m² → A ≥ ${r.A} m.`,
      `Aciers requis = ${r.AsX} cm²/direction.`
    ], r);
  }

  function soutenement(d) {
    const r = retaining.murEnT(d);
    const cR = compareMin(d.FSrenv_note, 1.5);
    const cG = compareMin(d.FSgliss_note, 1.5);
    const cS = compareMax(d.sigMax_note, d.sigmaAdm);
    const controles = [
      ctrl('FS renversement', d.FSrenv_note, 1.5, cR.statut, cR.statut === 'NOK' ? `Calcul indépendant : FS = ${r.renversement.FS}.` : cR.msg),
      ctrl('FS glissement', d.FSgliss_note, 1.5, cG.statut, cG.statut === 'NOK' ? `Calcul indépendant : FS = ${r.glissement.FS} — prévoir une bêche.` : cG.msg),
      ctrl('σ max sous semelle', d.sigMax_note, d.sigmaAdm, cS.statut, cS.statut === 'NOK' ? `Calcul indépendant : σ = ${r.poinconnement.sigMax} kPa.` : cS.msg, 'kPa')
    ];
    return finalise('Mur de soutènement', controles, [
      `Vérif. indépendante : FS renv. = ${r.renversement.FS}, FS gliss. = ${r.glissement.FS}, σ max = ${r.poinconnement.sigMax} kPa.`
    ], r);
  }

  function canalisation(d) {
    const r = vrd.canalisation({ Qls: d.Qls, I: d.I, K: d.K, D: d.DN_note });
    const imp = r.impose;
    const controles = [
      ctrl('Capacité hydraulique', imp ? imp.Q : null, d.Qls, imp && imp.Q >= d.Qls ? 'OK' : 'NOK',
        imp && imp.Q < d.Qls ? `Capacité insuffisante : adopter DN ${r.Dreq}.` : '', 'L/s'),
      ctrl('Vitesse (autocurage 0,6–4 m/s)', imp ? imp.V : null, null,
        imp && imp.autocurage && imp.vitesseOk ? 'OK' : (imp && !imp.autocurage ? 'RÉSERVE' : 'NOK'),
        imp && !imp.autocurage ? 'Vitesse < 0,6 m/s : risque de dépôt (augmenter la pente).' : (imp && !imp.vitesseOk ? 'Vitesse > 4 m/s : risque d’érosion.' : ''), 'm/s'),
      ctrl('Diamètre adopté', d.DN_note, r.Dreq, d.DN_note >= r.Dreq ? 'OK' : 'NOK',
        d.DN_note >= r.Dreq ? '' : `DN insuffisant : adopter DN ${r.Dreq}.`, 'mm')
    ];
    return finalise('Canalisation VRD (Manning)', controles, [
      `Diamètre requis (gamme normalisée) = DN ${r.Dreq}.`
    ], r);
  }

  function finalise(type, controles, recommandations, calcul) {
    return { type, verdict: verdictGlobal(controles), controles, recommandations: recommandations || [], calcul };
  }

  const TYPES = {
    ba_flexion: { libelle: 'Flexion simple (béton armé)', fn: baFlexion },
    semelle: { libelle: 'Semelle isolée', fn: semelle },
    soutenement: { libelle: 'Mur de soutènement', fn: soutenement },
    canalisation: { libelle: 'Canalisation VRD', fn: canalisation }
  };

  function verifier(type, data) {
    const t = TYPES[type];
    if (!t) throw new Error('Type de vérification inconnu : ' + type);
    return t.fn(data);
  }

  /** Extraction de valeurs numériques depuis un texte collé (préremplissage). */
  function extraire(texte) {
    const t = (texte || '').replace(/ /g, ' ');
    const find = (re) => { const m = t.match(re); return m ? parseFloat(m[1].replace(',', '.')) : null; };
    return {
      fck: find(/f\s*ck\s*[=:]?\s*([\d.,]+)/i),
      fyk: find(/f\s*yk\s*[=:]?\s*([\d.,]+)/i),
      MEd: find(/M\s*Ed\s*[=:]?\s*([\d.,]+)/i),
      NEd: find(/N\s*Ed\s*[=:]?\s*([\d.,]+)/i),
      b: find(/\bb\s*[=:]?\s*([\d.,]+)/i),
      h: find(/\bh\s*[=:]?\s*([\d.,]+)/i),
      d: find(/\bd\s*[=:]?\s*([\d.,]+)/i),
      As: find(/A\s*s\s*[=:]?\s*([\d.,]+)/i),
      sigmaSol: find(/(?:σ\s*sol|sigma\s*sol|contrainte\s*sol)\s*[=:]?\s*([\d.,]+)/i),
      Qls: find(/\bQ\s*[=:]?\s*([\d.,]+)\s*l\/s/i),
      DN: find(/DN\s*([\d.,]+)/i),
      pente: find(/(?:pente|I)\s*[=:]?\s*([\d.,]+)/i),
      FS: find(/(?:FS|coefficient de s[ée]curit[ée])\s*[=:]?\s*([\d.,]+)/i)
    };
  }

  return { TYPES, verifier, extraire, verdictGlobal };
});
