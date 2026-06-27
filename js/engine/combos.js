/*
 * combos.js — Combinaisons d'actions selon l'Eurocode 0 (EN 1990)
 * Génère les combinaisons ELU fondamentales et ELS (caractéristique,
 * fréquente, quasi-permanente) à partir des actions caractéristiques.
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
    root.GC.combos = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // Coefficients ψ recommandés (EN 1990, tableau A1.1) par catégorie
  const PSI = {
    'Habitation (A)': { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    'Bureaux (B)': { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    'Commerces (C)': { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    'Stockage (E)': { psi0: 1.0, psi1: 0.9, psi2: 0.8 },
    'Neige (< 1000 m)': { psi0: 0.5, psi1: 0.2, psi2: 0.0 },
    'Vent': { psi0: 0.6, psi1: 0.2, psi2: 0.0 },
    'Température': { psi0: 0.6, psi1: 0.5, psi2: 0.0 }
  };

  /**
   * @param {object} p
   * @param {number} p.G  action permanente caractéristique
   * @param {Array<{nom, Q, psi0, psi1, psi2}>} p.variables actions variables
   * @param {number} [p.gG] coefficient sur G défavorable (1.35)
   * @param {number} [p.gQ] coefficient sur Q défavorable (1.5)
   */
  function combinaisons(p) {
    const G = p.G || 0;
    const vars = p.variables || [];
    const gG = p.gG || 1.35, gQ = p.gQ || 1.5;
    const elu = [], elsC = [], elsF = [], elsQ = [];

    if (vars.length === 0) {
      elu.push({ nom: `${gG}·G`, valeur: gG * G });
      elsC.push({ nom: 'G', valeur: G });
      elsQ.push({ nom: 'G', valeur: G });
    } else {
      vars.forEach((lead, i) => {
        // ELU fondamentale (action variable dominante = lead)
        let vu = gG * G + gQ * lead.Q;
        let eu = `${gG}·G + ${gQ}·${lead.nom}`;
        let vc = G + lead.Q, ec = `G + ${lead.nom}`;
        let vf = G + lead.psi1 * lead.Q, ef = `G + ψ1·${lead.nom}`;
        vars.forEach((o, j) => {
          if (j === i) return;
          vu += gQ * o.psi0 * o.Q; eu += ` + ${gQ}·ψ0·${o.nom}`;
          vc += o.psi0 * o.Q; ec += ` + ψ0·${o.nom}`;
          vf += o.psi2 * o.Q; ef += ` + ψ2·${o.nom}`;
        });
        elu.push({ nom: eu, valeur: vu, lead: lead.nom });
        elsC.push({ nom: ec, valeur: vc, lead: lead.nom });
        elsF.push({ nom: ef, valeur: vf, lead: lead.nom });
      });
      // ELS quasi-permanente (unique)
      let vq = G, eq = 'G';
      vars.forEach((o) => { vq += o.psi2 * o.Q; if (o.psi2 > 0) eq += ` + ψ2·${o.nom}`; });
      elsQ.push({ nom: eq, valeur: vq });
    }

    const fmt = (arr) => arr.map((c) => ({ nom: c.nom, valeur: round(c.valeur, 2), lead: c.lead }));
    const maxOf = (arr) => arr.reduce((m, c) => c.valeur > m.valeur ? c : m, { valeur: -Infinity });

    return {
      elu: fmt(elu), eluMax: { nom: maxOf(elu).nom, valeur: round(maxOf(elu).valeur, 2) },
      elsC: fmt(elsC), elsCMax: { nom: maxOf(elsC).nom, valeur: round(maxOf(elsC).valeur, 2) },
      elsF: fmt(elsF), elsFMax: elsF.length ? { nom: maxOf(elsF).nom, valeur: round(maxOf(elsF).valeur, 2) } : null,
      elsQ: fmt(elsQ), elsQMax: { nom: maxOf(elsQ).nom, valeur: round(maxOf(elsQ).valeur, 2) }
    };
  }

  return { PSI, combinaisons };
});
