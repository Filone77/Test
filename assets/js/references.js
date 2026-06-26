/* ============================================================================
 * HydroCalc — Données de référence
 * ----------------------------------------------------------------------------
 * Tables techniques reprises des classeurs (feuille « Références » et
 * « Hypotheses ») et complétées : rugosités, vitesses recommandées, modules
 * d'élasticité, diamètres nominaux, catalogue de singularités, coefficients
 * de Manning-Strickler.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro || (root.Hydro = {});

  Hydro.refs = {

    /** Rugosités absolues ε (mm) — neuf / usagé. */
    rugosites: [
      { materiau: 'Acier soudé',            neuf: 0.05,   usage: 0.15 },
      { materiau: 'Acier riveté',           neuf: 1.0,    usage: 3.0  },
      { materiau: 'Fonte ductile revêtue',  neuf: 0.03,   usage: 0.10 },
      { materiau: 'Fonte grise',            neuf: 0.25,   usage: 1.0  },
      { materiau: 'Béton lisse',            neuf: 0.30,   usage: 1.0  },
      { materiau: 'Béton rugueux',          neuf: 1.0,    usage: 3.0  },
      { materiau: 'PEHD',                   neuf: 0.007,  usage: 0.01 },
      { materiau: 'PVC',                    neuf: 0.007,  usage: 0.01 },
      { materiau: 'Cuivre / Laiton',        neuf: 0.0015, usage: 0.01 },
      { materiau: 'Inox',                   neuf: 0.015,  usage: 0.03 }
    ],

    /** Vitesses recommandées (m/s) selon le type de conduite. */
    vitesses: [
      { type: 'Aspiration pompe',          vmin: 0.5, vmax: 1.0 },
      { type: 'Refoulement pompe',         vmin: 0.8, vmax: 1.5 },
      { type: 'Distribution gravitaire',   vmin: 0.5, vmax: 1.2 },
      { type: 'Adduction gravitaire',      vmin: 0.3, vmax: 0.8 },
      { type: 'Assainissement gravitaire', vmin: 0.6, vmax: 3.0 },
      { type: 'Refoulement eaux usées',    vmin: 0.7, vmax: 2.0 }
    ],

    /** Modules d'élasticité E (Pa) des matériaux de conduite. */
    modulesElasticite: [
      { materiau: 'Acier',         E: 210e9, note: '210 GPa' },
      { materiau: 'Fonte ductile', E: 170e9, note: '170 GPa' },
      { materiau: 'Fonte grise',   E: 100e9, note: '100 GPa' },
      { materiau: 'PEHD PE100',    E: 1e9,   note: '1 GPa'   },
      { materiau: 'PVC rigide',    E: 3e9,   note: '3 GPa'   },
      { materiau: 'Béton',         E: 30e9,  note: '30 GPa'  },
      { materiau: 'Cuivre',        E: 120e9, note: '120 GPa' }
    ],

    /** Diamètres nominaux normalisés courants (mm). */
    diametresNominaux: [
      25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250,
      280, 315, 355, 400, 450, 500, 560, 630, 710, 800, 900, 1000
    ],

    /** Catalogue des singularités et leur coefficient de perte ξ. */
    singularites: [
      { nom: 'Coude 90° grand rayon',         ksi: 0.30 },
      { nom: 'Coude 90° petit rayon',         ksi: 0.50 },
      { nom: 'Coude 45°',                     ksi: 0.20 },
      { nom: 'Coude 22,5°',                   ksi: 0.10 },
      { nom: 'Té passage direct',             ksi: 0.30 },
      { nom: 'Té bifurcation',                ksi: 1.00 },
      { nom: 'Vanne à opercule ouverte',      ksi: 0.15 },
      { nom: 'Vanne papillon ouverte',        ksi: 0.30 },
      { nom: 'Clapet anti-retour battant',    ksi: 2.00 },
      { nom: 'Clapet anti-retour à boule',    ksi: 4.00 },
      { nom: 'Réduction progressive',         ksi: 0.25 },
      { nom: 'Élargissement progressif',      ksi: 0.30 },
      { nom: 'Entrée réservoir (bords vifs)', ksi: 0.50 },
      { nom: 'Entrée réservoir (arrondie)',   ksi: 0.20 },
      { nom: 'Sortie réservoir',              ksi: 1.00 },
      { nom: 'Filtre / Crépine',              ksi: 2.50 },
      { nom: 'Compteur',                      ksi: 3.00 },
      { nom: 'Ventouse',                      ksi: 0.50 }
    ],

    /** Coefficients de Manning n (et Strickler K = 1/n). */
    manning: [
      { materiau: 'PVC / PEHD lisse',  n: 0.009, K: 111 },
      { materiau: 'Fonte / acier',     n: 0.011, K: 91  },
      { materiau: 'Béton lisse',       n: 0.012, K: 83  },
      { materiau: 'Béton courant',     n: 0.013, K: 77  },
      { materiau: 'Béton rugueux',     n: 0.016, K: 63  },
      { materiau: 'Maçonnerie',        n: 0.020, K: 50  },
      { materiau: 'Terre / enrochement', n: 0.030, K: 33 }
    ],

    /** Constantes physiques par défaut (feuille Hypotheses). */
    constantes: {
      g: 9.81,
      rho20: 1000,        // kg/m³ à 20 °C
      nu20: 1e-6,         // m²/s à 20 °C
      patm: 101325,       // Pa
      pvap20: 2340        // Pa à 20 °C
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Hydro.refs;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
