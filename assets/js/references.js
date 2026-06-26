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
    },

    /** Matériaux unifiés : rugosité ε (mm), module E (Pa), coef. Hazen-Williams
     *  C, coef. de Manning n. Sert au remplissage automatique des champs. */
    materiaux: [
      { nom: 'PEHD PE100',   eps: 0.01,   E: 1e9,   Chw: 150, n: 0.009, sdr: { 6: 26, 10: 17, 16: 11, 25: 9 } },
      { nom: 'PVC rigide',   eps: 0.01,   E: 3e9,   Chw: 150, n: 0.009, sdr: { 6: 41, 10: 26, 16: 21, 25: 13.6 } },
      { nom: 'Fonte ductile',eps: 0.10,   E: 170e9, Chw: 130, n: 0.011, sdr: null },
      { nom: 'Acier',        eps: 0.05,   E: 210e9, Chw: 120, n: 0.012, sdr: null },
      { nom: 'Béton',        eps: 0.50,   E: 30e9,  Chw: 120, n: 0.013, sdr: null },
      { nom: 'Cuivre',       eps: 0.0015, E: 120e9, Chw: 140, n: 0.010, sdr: null },
      { nom: 'Inox',         eps: 0.015,  E: 200e9, Chw: 140, n: 0.011, sdr: null }
    ],

    /** Coefficients de Hazen-Williams C (rappel rapide). */
    hazenWilliams: [
      { materiau: 'PVC / PEHD neuf', C: 150 },
      { materiau: 'Fonte ductile (ciment)', C: 130 },
      { materiau: 'Acier neuf', C: 120 },
      { materiau: 'Fonte ancienne', C: 100 },
      { materiau: 'Béton', C: 120 },
      { materiau: 'Acier rivé/ancien', C: 90 }
    ],

    /** Coefficients de ruissellement (méthode rationnelle / des pluies). */
    ruissellement: [
      { surface: 'Toiture', C: 0.90 },
      { surface: 'Chaussée bitume / béton', C: 0.90 },
      { surface: 'Pavés joints serrés', C: 0.70 },
      { surface: 'Pavés joints larges', C: 0.50 },
      { surface: 'Gravier compacté', C: 0.40 },
      { surface: 'Zone urbaine dense', C: 0.70 },
      { surface: 'Zone résidentielle', C: 0.40 },
      { surface: 'Espaces verts / pelouse', C: 0.15 },
      { surface: 'Forêt / prairie', C: 0.10 }
    ],

    /** Diamètre intérieur estimé (mm) selon matériau, DN et PN.
     *  Plastiques : Di = DN·(1 − 2/SDR). Métaux/béton : Di ≈ DN. */
    diInterieur: function (nomMateriau, DN, PN) {
      var m = null;
      for (var i = 0; i < this.materiaux.length; i++)
        if (this.materiaux[i].nom === nomMateriau) m = this.materiaux[i];
      if (m && m.sdr) {
        var sdr = m.sdr[PN] || m.sdr[16] || 17;
        return Math.round(DN * (1 - 2 / sdr) * 10) / 10;
      }
      return DN; // approximation métaux/béton
    },

    /** Cas-types pré-remplis (valeurs par module). */
    casTypes: [
      { nom: 'Refoulement eaux usées',
        description: 'Poste de relevage vers exutoire — PEHD, vitesse 1 m/s.',
        values: {
          conduite: { Q: 120, Qmoy: 80, Veco: 1.0, DN: 160, Di: 141, L: 800, eps: 0.01, Zamont: 20, Zaval: 35 },
          pompage: { Pres: 5, dHstation: 1.5, marge: 10, etaP: 0.65, etaM: 0.9, nService: 2, nSecours: 1 }
        } },
      { nom: 'Adduction AEP gravitaire',
        description: 'Réservoir haut vers réservoir bas, écoulement gravitaire.',
        values: {
          conduite: { Q: 90, Qmoy: 60, Veco: 0.8, DN: 200, Di: 176, L: 2500, eps: 0.01, Zamont: 320, Zaval: 280 }
        } },
      { nom: 'Refoulement AEP',
        description: 'Station de pompage AEP — fonte ductile, vitesse 1,2 m/s.',
        values: {
          conduite: { Q: 300, Qmoy: 200, Veco: 1.2, DN: 300, Di: 300, L: 1200, eps: 0.10, Zamont: 50, Zaval: 95 },
          pompage: { Pres: 25, dHstation: 2, marge: 12, etaP: 0.78, etaM: 0.93, nService: 2, nSecours: 1 }
        } },
      { nom: 'Assainissement pluvial',
        description: 'Bassin de rétention dimensionné par la méthode des pluies.',
        values: {
          pluies: { Sa: 3, a: 5.9, b: 0.62, q: 3 },
          bassin: { h: 1.5, Qf: 9, Cd: 0.62, H: 1.2 }
        } }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Hydro.refs;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
