/*
 * rainwater.js — Récupération des eaux pluviales (bâche / cuve)
 * Volume collectable depuis une toiture, demande, dimensionnement du volume
 * utile de la cuve (règle des ~21 jours), taux de couverture et économie.
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
    root.GC.rainwater = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const round = core.round;

  // Volumes de cuves normalisés [m³]
  const CUVES = [1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 30];

  // Coefficients de ruissellement par type de toiture
  const TOITURES = {
    'Tuiles / ardoises (forte pente)': 0.9,
    'Toiture plate gravillonnée': 0.6,
    'Toiture végétalisée': 0.4,
    'Surface imperméable (béton, bitume)': 0.85
  };

  /**
   * @param {object} p
   * @param {number} p.surface   surface de collecte (projetée) [m²]
   * @param {number} p.pluvio    pluviométrie annuelle [mm/an]
   * @param {number} p.Crunoff   coefficient de ruissellement
   * @param {number} [p.etaFiltre] rendement du filtre (0,9 par défaut)
   * @param {number} p.demandeJour demande journalière [L/j]
   * @param {number} [p.joursStockage] période de stockage [j] (21 par défaut)
   */
  function dimensionner(p) {
    const eta = p.etaFiltre != null ? p.etaFiltre : 0.9;
    const jours = p.joursStockage || 21;

    // Volume annuel collectable [m³/an]
    const Vcol = p.surface * p.pluvio * p.Crunoff * eta / 1000;
    // Demande annuelle [m³/an]
    const Vdem = p.demandeJour * 365 / 1000;

    const limitant = Math.min(Vcol, Vdem);
    // Volume utile = volume limitant sur la période de stockage
    const Vutile = limitant * jours / 365;

    // Cuve normalisée immédiatement supérieure
    let cuve = CUVES[CUVES.length - 1];
    for (const c of CUVES) { if (c >= Vutile) { cuve = c; break; } }

    const tauxCouverture = Vdem > 0 ? limitant / Vdem * 100 : 0;
    const economieAn = limitant; // m³/an substitués à l'eau potable

    return {
      Vcol: round(Vcol, 1),
      Vdem: round(Vdem, 1),
      facteurLimitant: Vcol < Vdem ? 'collecte' : 'demande',
      Vutile: round(Vutile, 2),
      cuveNormalisee: cuve,
      tauxCouverture: round(tauxCouverture, 1),
      economieAn: round(economieAn, 1),
      autonomie: round(p.demandeJour > 0 ? cuve * 1000 / p.demandeJour : 0, 1),
      messages: [
        `Dimensionnement sur ${jours} jours (règle usuelle). Facteur limitant : ${Vcol < Vdem ? 'la collecte' : 'la demande'}.`,
        'Prévoir un trop-plein raccordé et une disconnexion avec le réseau d’eau potable.'
      ]
    };
  }

  // Répartition mensuelle indicative (climat tempéré, légère pointe automne/hiver)
  const PROFIL_MENSUEL = [0.09, 0.08, 0.08, 0.08, 0.08, 0.07, 0.06, 0.06, 0.08, 0.10, 0.11, 0.11];
  const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  /** Générateur pseudo-aléatoire déterministe (LCG) — chronique reproductible. */
  function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
  }

  /**
   * Génère une chronique journalière (mm) reproductible avec regroupement
   * réaliste des pluies (jours secs / averses), totaux mensuels respectés.
   */
  function chroniqueJournaliere(pluvioAn, nJoursPluie) {
    const rng = lcg(20240617);
    const serie = new Array(365).fill(0);
    let jour = 0;
    for (let mois = 0; mois < 12; mois++) {
      const nd = JOURS_MOIS[mois];
      const pluieMois = pluvioAn * PROFIL_MENSUEL[mois];
      const nb = Math.min(nd, Math.max(1, Math.round(nJoursPluie * PROFIL_MENSUEL[mois])));
      // jours de pluie tirés au hasard dans le mois
      const choisis = {};
      let c = 0;
      while (c < nb) { const d = Math.floor(rng() * nd); if (!choisis[d]) { choisis[d] = true; c++; } }
      // hauteurs distribuées (loi exponentielle), recalées sur le total mensuel
      const jours = Object.keys(choisis).map(Number);
      const poids = jours.map(() => -Math.log(Math.max(rng(), 1e-9)));
      const somme = poids.reduce((a, b) => a + b, 0);
      jours.forEach((d, i) => { serie[jour + d] = pluieMois * poids[i] / somme; });
      jour += nd;
    }
    return serie;
  }

  /**
   * Simulation journalière du réservoir (modèle YAS : prélèvement après débordement).
   * @param {object} p {surface, Crunoff, etaFiltre, pluvio (mm/an), nJoursPluie,
   *                     demandeJour (L/j), Vcuve (m³)}
   */
  /** Bilan réservoir sur une chronique journalière fournie (modèle YAS). */
  function simulerReservoir(serie, p) {
    const eta = p.etaFiltre != null ? p.etaFiltre : 0.9;
    const demandeJour = p.demandeJour / 1000; // m³/j
    const V = p.Vcuve;
    let S = 0, met = 0, dem = 0, spill = 0, fromMains = 0, joursVides = 0;
    for (let j = 0; j < serie.length; j++) {
      const inflow = p.surface * serie[j] / 1000 * p.Crunoff * eta; // m³
      let Sf = S + inflow;
      if (Sf > V) { spill += Sf - V; Sf = V; }
      const fourni = Math.min(demandeJour, Sf);
      S = Sf - fourni;
      met += fourni; dem += demandeJour; fromMains += demandeJour - fourni;
      if (S < 1e-6) joursVides++;
    }
    return {
      Vcuve: V,
      jours: serie.length,
      pluvioSimulee: round(serie.reduce((a, b) => a + b, 0), 0),
      tauxCouverture: round(dem > 0 ? met / dem * 100 : 0, 1),
      volumeRecupere: round(met, 1),
      complementReseau: round(fromMains, 1),
      debordement: round(spill, 1),
      joursVides
    };
  }

  function simulation(p) {
    const serie = p.serie || chroniqueJournaliere(p.pluvio, p.nJoursPluie || 110);
    return simulerReservoir(serie, p);
  }

  /** Courbe taux de couverture en fonction du volume de cuve. */
  function courbeCouverture(p, Vmax) {
    const pts = [];
    const max = Vmax || 20;
    for (let i = 0; i <= 20; i++) {
      const V = max * i / 20;
      const s = simulation(Object.assign({}, p, { Vcuve: V }));
      pts.push({ x: round(V, 1), y: s.tauxCouverture });
    }
    return pts;
  }

  /** Parse une chronique CSV/texte → tableau de hauteurs [mm]. Tolère date,valeur. */
  function parseChronique(texte) {
    const lignes = (texte || '').split(/\r?\n/);
    const out = [];
    for (const l of lignes) {
      if (!l.trim()) continue;
      // virgule décimale (entre deux chiffres) → point, avant de découper les colonnes
      const norm = l.replace(/(\d),(\d)/g, '$1.$2');
      const toks = norm.split(/[;,\t ]+/).filter((t) => t !== '');
      const v = parseFloat(toks[toks.length - 1]);
      if (!isNaN(v)) out.push(v);
    }
    return out;
  }

  return { CUVES, TOITURES, PROFIL_MENSUEL, dimensionner, chroniqueJournaliere, simulerReservoir, simulation, courbeCouverture, parseChronique };
});
