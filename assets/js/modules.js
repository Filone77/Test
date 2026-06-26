/* ============================================================================
 * HydroCalc — Définition des modules de calcul
 * ----------------------------------------------------------------------------
 * Chaque module est décrit de façon déclarative :
 *   { id, title, icon, group, intro, inputs[], grid?, compute(v, store), render? }
 * - inputs : champs scalaires (number/select). `link` relie le champ à une
 *            valeur publiée par un module amont (recalcul en cascade).
 * - grid   : grille éditable (ex. catalogue de singularités).
 * - compute: fonction PURE -> { results[], publish{}, tables[], notes[], chart }.
 * - render : rendu entièrement personnalisé (références, récap, conversions).
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro;
  var C = Hydro.calc;
  var R = Hydro.refs;
  var ui = Hydro.ui;
  var el = ui.el;

  function st(kind, text) { return { kind: kind, text: text }; }
  function res(label, symbol, value, unit, formula, extra) {
    var o = { label: label, symbol: symbol, value: value, unit: unit, formula: formula };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  /* --- Quantités par défaut des singularités (d'après le classeur) -------- */
  var FITTINGS_DEFAULT = R.singularites.map(function (s) {
    var n = 0;
    if (s.nom === 'Coude 90° grand rayon' || s.nom === 'Coude 90° petit rayon'
        || s.nom === 'Coude 45°') n = 1;
    return { nom: s.nom, ksi: s.ksi, n: n };
  });

  /* === MODULES ============================================================ */

  var modules = [

    /* ---------------------------------------------------------------- FLUIDE */
    {
      id: 'fluide', icon: '💧', group: 'Fluide & conduite',
      title: 'Propriétés de l\'eau',
      intro: 'Masse volumique, viscosité et pression de vapeur de l\'eau en ' +
             'fonction de la température. Ces valeurs alimentent automatiquement ' +
             'les autres modules.',
      inputs: [
        { key: 'T', label: 'Température de l\'eau', symbol: 'T', unit: '°C',
          default: 15, hint: 'Défaut 15 °C' }
      ],
      compute: function (v) {
        var p = C.proprietesEau(v.T);
        return {
          results: [
            res('Masse volumique', 'ρ', p.rho, 'kg/m³', '1000,3 − 0,0178·(T−4)^1,7'),
            res('Viscosité dynamique', 'μ', p.mu, 'Pa·s', '0,001792·e^(−0,0179·T)'),
            res('Viscosité cinématique', 'ν', p.nu, 'm²/s', 'ν = μ/ρ'),
            res('Pression de vapeur', 'Pv', p.pv, 'm CE', '0,0231·e^(0,0622·T)'),
            res('Accélération de la pesanteur', 'g', 9.81, 'm/s²', 'constante')
          ],
          publish: { T: v.T, rho: p.rho, mu: p.mu, nu: p.nu, pv: p.pv, g: 9.81 }
        };
      }
    },

    /* -------------------------------------------------------------- CONDUITE */
    {
      id: 'conduite', icon: '📏', group: 'Fluide & conduite',
      title: 'Conduite & pertes linéaires',
      intro: 'Dimensionnement de la conduite en charge et pertes de charge ' +
             'linéaires par Darcy-Weisbach (coefficient de Colebrook-White, ' +
             'approximation de Swamee-Jain).',
      inputs: [
        { key: 'Q', label: 'Débit de pointe', symbol: 'Qp', unit: 'm³/h', default: 200,
          hint: 'Débit de dimensionnement' },
        { key: 'Qmoy', label: 'Débit moyen', symbol: 'Qmoy', unit: 'm³/h', default: 150,
          hint: 'Pour le coefficient de pointe' },
        { key: 'Veco', label: 'Vitesse économique visée', symbol: 'Véco', unit: 'm/s',
          default: 1.5, hint: '0,8–1,5 en refoulement' },
        { key: 'DN', label: 'Diamètre nominal', symbol: 'DN', unit: 'mm', type: 'select',
          options: R.diametresNominaux, default: 200, hint: 'Série normalisée' },
        { key: 'Di', label: 'Diamètre intérieur réel', symbol: 'Di', unit: 'mm',
          default: 150, hint: 'Selon fabricant' },
        { key: 'L', label: 'Longueur de conduite', symbol: 'L', unit: 'm', default: 160 },
        { key: 'eps', label: 'Rugosité absolue', symbol: 'ε', unit: 'mm', default: 0.01,
          step: 0.001, hint: 'PEHD 0,01 · Acier 0,05 · Fonte 0,1' },
        { key: 'Zamont', label: 'Altitude amont', symbol: 'Zam', unit: 'm NGF', default: 25 },
        { key: 'Zaval', label: 'Altitude aval', symbol: 'Zav', unit: 'm NGF', default: 30 },
        { key: 'methode', label: 'Méthode du coefficient λ', unit: '', type: 'select',
          options: [ { value: 'swamee', label: 'Swamee-Jain (explicite)' },
                     { value: 'colebrook', label: 'Colebrook-White (itératif)' } ],
          default: 'swamee', wide: true }
      ],
      compute: function (v, store) {
        var nu = store.nu || C.viscositeCinematique(15);
        var Dth = C.diametreEconomique(v.Q, v.Veco);
        var cond = C.conduite({ Q_m3h: v.Q, Di_mm: v.Di, L_m: v.L, eps_mm: v.eps,
                                nu: nu, methode: v.methode });
        var Hgeo = v.Zaval - v.Zamont;
        var Cp = v.Qmoy > 0 ? v.Q / v.Qmoy : NaN;
        var vStatus = cond.vitesseOK ? st('ok', 'OK') : st('warn', 'Hors 0,5–2 m/s');
        return {
          results: [
            res('Coefficient de pointe', 'Cp', Cp, '-', 'Qp / Qmoy'),
            res('Diamètre théorique', 'Dth', Dth, 'mm', '√(4Q/πV) — indicatif'),
            res('Section hydraulique', 'S', cond.S, 'm²', 'π·Di²/4'),
            res('Vitesse réelle', 'V', cond.V, 'm/s', 'Q / S', { status: vStatus, strong: true }),
            res('Nombre de Reynolds', 'Re', cond.Re, '-', 'V·Di/ν'),
            res('Régime d\'écoulement', '', cond.regime, '', 'selon Re'),
            res('Coefficient de frottement', 'λ', cond.lambda, '-',
                v.methode === 'colebrook' ? 'Colebrook-White' : 'Swamee-Jain'),
            res('Perte de charge unitaire', 'J', cond.J, 'm/m', 'λ·(1/D)·V²/2g'),
            res('Pertes linéaires totales', 'ΔHlin', cond.dHlin, 'm', 'J × L', { strong: true }),
            res('Dénivellation géométrique', 'Hgéo', Hgeo, 'm', 'Zaval − Zamont')
          ],
          publish: { Q: v.Q, Di: v.Di, V: cond.V, dHlin: cond.dHlin, L: v.L,
                     Hgeo: Hgeo, eps: v.eps, nu: nu }
        };
      }
    },

    /* ----------------------------------------------------------- SINGULIÈRES */
    {
      id: 'singulieres', icon: '🔧', group: 'Fluide & conduite',
      title: 'Pertes de charge singulières',
      intro: 'Pertes locales dues aux coudes, vannes, tés, etc. : ΔH = ξ·V²/2g. ' +
             'Renseignez les quantités ; le total alimente la station de pompage.',
      inputs: [
        { key: 'V', label: 'Vitesse dans la conduite', symbol: 'V', unit: 'm/s',
          link: 'V', default: 1.5, hint: 'Liée au module Conduite' }
      ],
      grid: {
        key: 'fittings',
        columns: [
          { key: 'nom', label: 'Singularité' },
          { key: 'ksi', label: 'ξ unitaire', unit: '-', editable: true, step: 0.05 },
          { key: 'n', label: 'Quantité', unit: 'nb', editable: true, step: 1 }
        ],
        rows: FITTINGS_DEFAULT
      },
      compute: function (v, store) {
        var V = v.V, vh = V * V / (2 * 9.81);
        var rows = [], ksiTotal = 0, dHsing = 0;
        (v.fittings || FITTINGS_DEFAULT).forEach(function (f) {
          var n = +f.n || 0, ksi = +f.ksi || 0;
          var k = ksi * n, perte = k * vh;
          ksiTotal += k; dHsing += perte;
          if (n > 0) rows.push([f.nom, ksi, n, C.round(k, 3), C.round(perte, 4)]);
        });
        var dHlin = store.dHlin || 0;
        var tables = rows.length ? [{
          caption: 'Détail des singularités actives',
          headers: ['Singularité', 'ξ', 'Quantité', 'ξ·n', 'Perte (m)'],
          rows: rows
        }] : [];
        return {
          results: [
            res('Terme cinétique', 'V²/2g', vh, 'm', 'V² / 2g'),
            res('Somme des coefficients', 'Σξ', ksiTotal, '-', 'Σ(ξ·quantité)'),
            res('Pertes singulières', 'ΔHsing', dHsing, 'm', 'Σξ · V²/2g', { strong: true }),
            res('Pertes linéaires (rappel)', 'ΔHlin', dHlin, 'm', 'module Conduite'),
            res('PERTES TOTALES', 'ΔHtot', dHlin + dHsing, 'm', 'ΔHlin + ΔHsing', { strong: true })
          ],
          tables: tables,
          publish: { dHsing: dHsing, dHtot: dHlin + dHsing }
        };
      }
    },

    /* --------------------------------------------------------------- POMPAGE */
    {
      id: 'pompage', icon: '⚙️', group: 'Pompage',
      title: 'Station de pompage (HMT, puissance, NPSH)',
      intro: 'Hauteur manométrique totale, puissances et vérification du NPSH ' +
             '(risque de cavitation).',
      inputs: [
        { key: 'Q', label: 'Débit de pompage', symbol: 'Q', unit: 'm³/h', link: 'Q', default: 200 },
        { key: 'Hgeo', label: 'Hauteur géométrique', symbol: 'Hgéo', unit: 'm', link: 'Hgeo', default: 5 },
        { key: 'dHtot', label: 'Pertes de charge totales', symbol: 'ΔHtot', unit: 'm', link: 'dHtot', default: 8 },
        { key: 'Pres', label: 'Pression résiduelle requise', symbol: 'Prés', unit: 'm', default: 20,
          hint: '10–30 m typique' },
        { key: 'dHstation', label: 'Pertes dans la station', symbol: 'ΔHsta', unit: 'm', default: 2 },
        { key: 'marge', label: 'Marge de sécurité', unit: '%', default: 10, hint: '5–15 %' },
        { key: 'etaP', label: 'Rendement pompe', symbol: 'ηp', unit: '-', default: 0.75, step: 0.01 },
        { key: 'etaM', label: 'Rendement moteur', symbol: 'ηm', unit: '-', default: 0.92, step: 0.01 },
        { key: 'coefSurdim', label: 'Coef. surdimensionnement', unit: '-', default: 1.15, step: 0.05 },
        { key: 'nService', label: 'Pompes en service', symbol: 'n', unit: 'nb', default: 2, step: 1 },
        { key: 'nSecours', label: 'Pompes de secours', unit: 'nb', default: 1, step: 1 },
        { key: 'Patm', label: 'Pression atmosphérique', symbol: 'Patm', unit: 'm CE', default: 10.33 },
        { key: 'alt', label: 'Altitude du site', symbol: 'Alt', unit: 'm', default: 0 },
        { key: 'Hasp', label: 'Hauteur d\'aspiration', symbol: 'Hasp', unit: 'm', default: 2,
          hint: '+ si pompe au-dessus du plan d\'eau' },
        { key: 'dHasp', label: 'Pertes à l\'aspiration', symbol: 'ΔHasp', unit: 'm', default: 0.5 },
        { key: 'NPSHr', label: 'NPSH requis (constructeur)', symbol: 'NPSHr', unit: 'm', default: 3 }
      ],
      compute: function (v, store) {
        var HMT = C.hmt(v.Hgeo, v.dHtot, v.Pres, v.dHstation);
        var HMTdim = HMT * (1 + v.marge / 100);
        var rho = store.rho || 1000;
        var pp = C.puissancePompe(rho, v.Q, HMTdim, v.etaP, v.etaM, v.coefSurdim);
        var Qunit = v.Q / v.nService, Punit = pp.Pinst / v.nService;
        var patm = C.patmAltitude(v.Patm, v.alt);
        var pv = store.pv != null ? store.pv : 0.17;
        var npshd = C.npshDisponible(patm, pv, v.Hasp, v.dHasp);
        var margeN = npshd - v.NPSHr;
        var nStatus = margeN > 0.5 ? st('ok', 'Pas de cavitation') : st('bad', 'Risque cavitation');
        return {
          results: [
            res('HMT calculée', 'HMT', HMT, 'm', '|Hgéo| + ΔHtot + Prés + ΔHsta'),
            res('HMT de dimensionnement', 'HMT\'', HMTdim, 'm', 'HMT·(1+marge)', { strong: true }),
            res('Puissance hydraulique', 'Ph', pp.Ph, 'kW', 'ρ·g·Q·HMT/1000'),
            res('Rendement global', 'ηg', pp.etaGlobal, '-', 'ηp·ηm'),
            res('Puissance absorbée (électrique)', 'Pabs', pp.Pelec, 'kW', 'Ph/ηg', { strong: true }),
            res('Puissance moteur à installer', 'Pinst', pp.Pinst, 'kW', 'Pabs·coef'),
            res('Nombre total de pompes', '', v.nService + v.nSecours, 'nb', 'service + secours (n+1)'),
            res('Débit unitaire par pompe', 'Qunit', Qunit, 'm³/h', 'Q / n'),
            res('Puissance unitaire par pompe', 'Punit', Punit, 'kW', 'Pinst / n'),
            res('Pression atm. corrigée', 'Patm\'', patm, 'm CE', 'correction altitude'),
            res('NPSH disponible', 'NPSHd', npshd, 'm', 'Patm − Pv − Hasp − ΔHasp'),
            res('Marge NPSH', '', margeN, 'm', 'NPSHd − NPSHr', { status: nStatus, strong: true })
          ],
          publish: { HMT: HMTdim, Pservice: HMTdim, Pelec: pp.Pelec, Pinst: pp.Pinst, Qunit: Qunit }
        };
      }
    },

    /* ------------------------------------------------------- POINT DE FONCT. */
    {
      id: 'pointfonct', icon: '📈', group: 'Pompage',
      title: 'Point de fonctionnement',
      intro: 'Intersection de la courbe caractéristique du réseau ' +
             '(H = Hgéo + R·Q²) et de la courbe de la pompe (H = H0 − α·Q²).',
      inputs: [
        { key: 'Hgeo', label: 'Hauteur géométrique', symbol: 'Hgéo', unit: 'm', link: 'Hgeo', default: 5 },
        { key: 'dHtot', label: 'Pertes au débit de référence', symbol: 'ΔHtot', unit: 'm', link: 'dHtot', default: 8 },
        { key: 'Qref', label: 'Débit de référence', symbol: 'Qref', unit: 'm³/h', link: 'Q', default: 200 },
        { key: 'H0', label: 'Hauteur pompe à débit nul', symbol: 'H0', unit: 'm', default: 50,
          hint: 'Hauteur à vanne fermée' },
        { key: 'Qn', label: 'Débit nominal pompe', symbol: 'Qn', unit: 'm³/h', default: 200 },
        { key: 'Hn', label: 'Hauteur pompe au débit nominal', symbol: 'Hn', unit: 'm', default: 40 }
      ],
      compute: function (v) {
        var R2 = C.resistanceReseau(v.dHtot, v.Qref);
        var cale = C.caleCourbePompe(v.H0, v.Qn, v.Hn);
        var pt = C.pointFonctionnement(v.Hgeo, R2, cale.H0, cale.alpha);
        var Qmax = Math.max(v.Qref, v.Qn, isFinite(pt.Q) ? pt.Q : 0) * 1.3 || 100;
        var sR = [], sP = [];
        for (var i = 0; i <= 30; i++) {
          var q = Qmax * i / 30;
          sR.push({ x: q, y: v.Hgeo + R2 * q * q });
          sP.push({ x: q, y: Math.max(0, cale.H0 - cale.alpha * q * q) });
        }
        return {
          results: [
            res('Résistance du réseau', 'R', R2, 'm/(m³/h)²', 'ΔHtot / Qref²'),
            res('Coefficient pompe', 'α', cale.alpha, 'm/(m³/h)²', '(H0−Hn)/Qn²'),
            res('Débit de fonctionnement', 'Q', pt.Q, 'm³/h', 'intersection', { strong: true }),
            res('Hauteur de fonctionnement', 'H', pt.H, 'm', 'intersection', { strong: true })
          ],
          chart: {
            series: [ { points: sR, color: '#2563eb' }, { points: sP, color: '#16a34a' } ],
            opts: { xlabel: 'Q (m³/h)', ylabel: 'H (m)', marker: { x: pt.Q, y: pt.H } },
            legend: [ { color: '#2563eb', label: 'Réseau' }, { color: '#16a34a', label: 'Pompe' },
                      { color: '#dc2626', label: 'Point de fonctionnement' } ]
          }
        };
      }
    },

    /* ----------------------------------------------------------------- BÂCHE */
    {
      id: 'bache', icon: '🛢️', group: 'Pompage',
      title: 'Bâche de pompage',
      intro: 'Volume utile de la bâche par la méthode de la fréquence de ' +
             'démarrage et par le temps de rétention ; on retient le maximum.',
      inputs: [
        { key: 'Qe', label: 'Débit de pointe entrant', symbol: 'Qe', unit: 'm³/h', link: 'Q', default: 200 },
        { key: 'Qp', label: 'Débit pompe unitaire', symbol: 'Qp', unit: 'm³/h', link: 'Qunit', default: 100 },
        { key: 'f', label: 'Fréquence max. démarrages', symbol: 'f', unit: '/h', default: 6,
          hint: '6–10 pour pompes submersibles' },
        { key: 'Tr', label: 'Temps de rétention min.', symbol: 'Tr', unit: 'min', default: 10, hint: '10–15 min' },
        { key: 'marge', label: 'Marge de sécurité', unit: '%', default: 20 },
        { key: 'Hu', label: 'Hauteur utile', symbol: 'Hu', unit: 'm', default: 2 }
      ],
      compute: function (v) {
        var b = C.bache({ Qp_m3h: v.Qp, Qe_m3h: v.Qe, f: v.f, Tr_min: v.Tr, marge: v.marge, Hu: v.Hu });
        return {
          results: [
            res('Volume utile (fréquence)', 'Vu1', b.Vu1, 'm³', 'Qp / (4f)'),
            res('Volume utile (rétention)', 'Vu2', b.Vu2, 'm³', 'Qe · Tr'),
            res('Volume utile retenu', 'Vu', b.Vu, 'm³', 'max(Vu1, Vu2)', { strong: true }),
            res('Volume total de la bâche', 'Vtot', b.Vtot, 'm³', 'Vu·(1+marge)', { strong: true }),
            res('Surface en plan', 'S', b.S, 'm²', 'Vtot / Hu'),
            res('Côté (si carré)', '', b.cote, 'm', '√S')
          ],
          publish: { Vbache: b.Vtot }
        };
      }
    },

    /* -------------------------------------------------------- COUP DE BÉLIER */
    {
      id: 'belier', icon: '💥', group: 'Pompage',
      title: 'Coup de bélier (transitoires)',
      intro: 'Célérité de l\'onde, surpression de Joukowsky (fermeture rapide) ' +
             'ou formule de Michaud (fermeture lente), et classe de pression requise.',
      inputs: [
        { key: 'materiau', label: 'Matériau de la conduite', unit: '', type: 'select', wide: true,
          options: R.modulesElasticite.map(function (m) { return { value: m.E, label: m.materiau + ' (' + m.note + ')' }; }),
          default: 210e9 },
        { key: 'e', label: 'Épaisseur de paroi', symbol: 'e', unit: 'm', default: 0.01, step: 0.001 },
        { key: 'Di', label: 'Diamètre intérieur', symbol: 'D', unit: 'mm', link: 'Di', default: 150 },
        { key: 'V', label: 'Vitesse d\'écoulement', symbol: 'V', unit: 'm/s', link: 'V', default: 1.5 },
        { key: 'L', label: 'Longueur de conduite', symbol: 'L', unit: 'm', link: 'L', default: 160 },
        { key: 'Tf', label: 'Temps de fermeture vanne', symbol: 'Tf', unit: 's', default: 5 },
        { key: 'Pservice', label: 'Pression de service', symbol: 'Pn', unit: 'm CE', link: 'Pservice', default: 40 }
      ],
      compute: function (v, store) {
        var rho = store.rho || 1000;
        var cb = C.coupBelier({ rho: rho, D_m: v.Di / 1000, E: +v.materiau, e_m: v.e,
                                L: v.L, V: v.V, Tf: v.Tf, Pservice: v.Pservice });
        return {
          results: [
            res('Célérité de l\'onde', 'a', cb.a, 'm/s', '√(K/ρ/(1+KD/Ee))'),
            res('Temps aller-retour', 'Tar', cb.Tar, 's', '2L / a'),
            res('Type de fermeture', '', cb.typeFermeture, '', 'lente si Tf > Tar'),
            res('Surpression (fermeture rapide)', 'ΔHr', cb.dHrapide, 'm', 'a·V/g'),
            res('Surpression (fermeture lente)', 'ΔHl', cb.dHlente, 'm', '2LV/(g·Tf)'),
            res('Surpression retenue', 'ΔH', cb.dH, 'm', 'selon type', { strong: true }),
            res('Pression maximale', 'Pmax', cb.Pmax, 'm CE', 'Pn + ΔH'),
            res('Pression maximale', '', cb.Pmax_bar, 'bar', 'Pmax / 10,2'),
            res('Classe de pression requise', 'PN', cb.classePN, '', 'selon surpression',
                { status: st('ok', cb.classePN), strong: true })
          ],
          notes: [
            'Protections possibles : volant d\'inertie, réservoir anti-bélier (ballon ' +
            'à vessie), soupape de décharge, cheminée d\'équilibre, clapet à fermeture ' +
            'lente, variateur de fréquence (rampe d\'arrêt).'
          ],
          publish: { PN: cb.classePN }
        };
      }
    },

    /* ---------------------------------------------------------------- ÉNERGIE */
    {
      id: 'energie', icon: '⚡', group: 'Pompage',
      title: 'Bilan énergétique',
      intro: 'Consommation électrique annuelle et coût d\'exploitation de la station.',
      inputs: [
        { key: 'Van', label: 'Volume annuel pompé', symbol: 'Van', unit: 'm³/an', default: 5000 },
        { key: 'Q', label: 'Débit moyen de pompage', symbol: 'Q', unit: 'm³/h', link: 'Q', default: 200 },
        { key: 'Pabs', label: 'Puissance absorbée moyenne', symbol: 'Pabs', unit: 'kW', link: 'Pelec', default: 30 },
        { key: 'FC', label: 'Facteur de charge', symbol: 'FC', unit: '-', default: 0.7, step: 0.05, hint: '0,5–0,9' },
        { key: 'prixkWh', label: 'Prix de l\'électricité', symbol: 'Pe', unit: '€/kWh', default: 0.15, step: 0.01 }
      ],
      compute: function (v) {
        var e = C.energie({ Van: v.Van, Q_m3h: v.Q, Pabs: v.Pabs, FC: v.FC, prixkWh: v.prixkWh });
        return {
          results: [
            res('Heures de fonctionnement', 'Hf', e.Hf, 'h/an', 'Van / Q'),
            res('Consommation annuelle', 'E', e.E, 'kWh/an', 'P · Hf · FC', { strong: true }),
            res('Coût énergétique annuel', 'Ce', e.cout, '€/an', 'E · prix', { strong: true }),
            res('Consommation spécifique', '', e.consoSpecifique, 'kWh/m³', 'E / Van'),
            res('Coût spécifique', '', e.coutSpecifique, '€/m³', 'Ce / Van')
          ]
        };
      }
    },

    /* ---------------------------------------------------------- SURFACE LIBRE */
    {
      id: 'surfacelibre', icon: '🌊', group: 'Assainissement & hydrologie',
      title: 'Écoulement à surface libre (Manning)',
      intro: 'Capacité d\'une conduite circulaire à surface libre par la formule ' +
             'de Manning-Strickler, en section pleine ou partiellement remplie.',
      inputs: [
        { key: 'D', label: 'Diamètre de la conduite', symbol: 'D', unit: 'mm', default: 300 },
        { key: 'I', label: 'Pente', symbol: 'I', unit: 'm/m', default: 0.005, step: 0.001, hint: '0,005 = 5 ‰' },
        { key: 'n', label: 'Coefficient de Manning', symbol: 'n', unit: '-', type: 'select',
          options: R.manning.map(function (m) { return { value: m.n, label: m.materiau + ' (n=' + m.n + ')' }; }),
          default: 0.013, wide: true },
        { key: 'taux', label: 'Taux de remplissage', unit: '-', default: 1, step: 0.05, hint: '1 = pleine section' }
      ],
      compute: function (v) {
        var n = +v.n;
        var full = v.taux >= 1;
        var m = full ? C.manningCirculairePlein(v.D, v.I, n)
                     : C.manningCirculairePartiel(v.D, v.taux * v.D, v.I, n);
        var vStatus = m.vitesseOK ? st('ok', 'OK') : st('warn', 'Hors 0,6–4 m/s');
        var results = [
          res('Section mouillée', 'S', m.S, 'm²', full ? 'π·D²/4' : 'segment circulaire'),
          res('Rayon hydraulique', 'Rh', m.Rh, 'm', 'S / P'),
          res('Vitesse', 'V', m.V, 'm/s', '(1/n)·Rh^⅔·√I', { status: vStatus, strong: true }),
          res('Débit capacité', 'Q', m.Q, 'm³/s', 'V · S'),
          res('Débit capacité', '', m.Q_Ls, 'L/s', '', { strong: true })
        ];
        if (!full) results.splice(0, 0, res('Taux de remplissage', 'h/D', m.taux, '-', ''));
        // courbe de capacité (remplissage 0,1 -> 1,0)
        var rows = [];
        for (var t = 0.1; t <= 1.001; t += 0.1) {
          var mm = (t >= 1) ? C.manningCirculairePlein(v.D, v.I, n)
                            : C.manningCirculairePartiel(v.D, t * v.D, v.I, n);
          rows.push([C.round(t, 2), C.round(mm.V, 3), C.round(mm.Q_Ls, 1)]);
        }
        return {
          results: results,
          tables: [{ caption: 'Capacité selon le remplissage',
                     headers: ['h/D', 'V (m/s)', 'Q (L/s)'], rows: rows }],
          publish: { Qcapacite: m.Q_Ls }
        };
      }
    },

    /* ------------------------------------------------------- MÉTHODE PLUIES */
    {
      id: 'pluies', icon: '🌧️', group: 'Assainissement & hydrologie',
      title: 'Méthode des pluies (stockage)',
      intro: 'Volume de stockage pluvial par la méthode des pluies : intensité de ' +
             'Montana i = a·t^(−b), débit de fuite constant, on retient le maximum.',
      inputs: [
        { key: 'Sa', label: 'Surface active (S·Cr)', symbol: 'Sa', unit: 'ha', default: 1, step: 0.1 },
        { key: 'a', label: 'Coefficient de Montana a', symbol: 'a', unit: '-', default: 5.9, step: 0.1 },
        { key: 'b', label: 'Coefficient de Montana b', symbol: 'b', unit: '-', default: 0.62, step: 0.01 },
        { key: 'q', label: 'Débit de fuite spécifique', symbol: 'q', unit: 'L/s/ha', default: 3 }
      ],
      compute: function (v) {
        var mp = C.methodePluies({ Sa: v.Sa, a: v.a, b: v.b, q: v.q });
        var rows = mp.lignes.map(function (l) {
          return [l.t, C.round(l.i, 3), C.round(l.Ve, 1), C.round(l.Vs, 1), C.round(l.Vstock, 1)];
        });
        var hl = mp.lignes.findIndex(function (l) { return l.t === mp.dureeCritique; });
        return {
          results: [
            res('Volume de stockage à retenir', 'V', mp.Vstockage, 'm³', 'max(Ventrant − Vsortant)', { strong: true }),
            res('Durée critique', 'tc', mp.dureeCritique, 'min', 'durée du maximum')
          ],
          tables: [{ caption: 'Volume à stocker selon la durée de pluie',
                     headers: ['t (min)', 'i (mm/min)', 'V entrant (m³)', 'V sortant (m³)', 'V à stocker (m³)'],
                     rows: rows, highlightRow: hl }],
          publish: { Vstockage: mp.Vstockage }
        };
      }
    },

    /* ----------------------------------------------------------------- BASSIN */
    {
      id: 'bassin', icon: '🏞️', group: 'Assainissement & hydrologie',
      title: 'Bassin de rétention',
      intro: 'Dimensionnement du bassin, diamètre de l\'orifice de fuite et temps ' +
             'de vidange.',
      inputs: [
        { key: 'V', label: 'Volume utile à stocker', symbol: 'V', unit: 'm³', link: 'Vstockage', default: 250 },
        { key: 'h', label: 'Profondeur utile', symbol: 'h', unit: 'm', default: 1.5 },
        { key: 'Qf', label: 'Débit de fuite', symbol: 'Qf', unit: 'L/s', default: 5 },
        { key: 'Cd', label: 'Coefficient de débit orifice', symbol: 'Cd', unit: '-', default: 0.62, step: 0.01 },
        { key: 'H', label: 'Charge sur l\'orifice', symbol: 'H', unit: 'm', default: 1.2 }
      ],
      compute: function (v) {
        var b = C.bassin({ V: v.V, h: v.h, Qf_Ls: v.Qf, Cd: v.Cd, H: v.H });
        return {
          results: [
            res('Surface au miroir', 'S', b.Smiroir, 'm²', 'V / h'),
            res('Largeur estimée (L = 2·l)', 'l', b.largeur, 'm', '√(S/2)'),
            res('Longueur estimée', 'L', b.longueur, 'm', '2·l'),
            res('Diamètre de l\'orifice de fuite', 'd', b.dOrifice, 'mm', 'Q = Cd·A·√(2gH)', { strong: true }),
            res('Temps de vidange théorique', 'tv', b.tempsVidange, 'h', 'V / Qf', { strong: true })
          ]
        };
      }
    },

    /* ----------------------------------------------------- ORIFICES/DÉVERSOIRS */
    {
      id: 'orifices', icon: '🚪', group: 'Assainissement & hydrologie',
      title: 'Orifices & déversoirs',
      intro: 'Débits à travers un orifice et au-dessus de déversoirs rectangulaire ' +
             'et triangulaire (V-notch).',
      inputs: [
        { key: 'Cd_o', label: 'Orifice — coef. débit', symbol: 'Cd', unit: '-', default: 0.62, step: 0.01 },
        { key: 'd_o', label: 'Orifice — diamètre', symbol: 'd', unit: 'mm', default: 100 },
        { key: 'H_o', label: 'Orifice — charge', symbol: 'H', unit: 'm', default: 2 },
        { key: 'Cd_dr', label: 'Dév. rect. — coef. débit', symbol: 'Cd', unit: '-', default: 0.62, step: 0.01 },
        { key: 'b_dr', label: 'Dév. rect. — largeur', symbol: 'b', unit: 'm', default: 1 },
        { key: 'H_dr', label: 'Dév. rect. — charge', symbol: 'H', unit: 'm', default: 0.3 },
        { key: 'Cd_dt', label: 'Dév. tri. — coef. débit', symbol: 'Cd', unit: '-', default: 0.6, step: 0.01 },
        { key: 'theta_dt', label: 'Dév. tri. — angle', symbol: 'θ', unit: '°', default: 90 },
        { key: 'H_dt', label: 'Dév. tri. — charge', symbol: 'H', unit: 'm', default: 0.2 }
      ],
      compute: function (v) {
        var A = Math.PI * Math.pow(v.d_o / 1000, 2) / 4;
        var Qo = C.debitOrifice(v.Cd_o, A, v.H_o);
        var Qdr = C.deversoirRectangulaire(v.Cd_dr, v.b_dr, v.H_dr);
        var Qdt = C.deversoirTriangulaire(v.Cd_dt, v.theta_dt, v.H_dt);
        return {
          results: [
            res('Orifice — débit', 'Q', Qo, 'm³/s', 'Cd·A·√(2gH)'),
            res('Orifice — débit', '', Qo * 1000, 'L/s', '', { strong: true }),
            res('Déversoir rectangulaire', 'Q', Qdr, 'm³/s', '⅔·Cd·b·√(2g)·H^1,5'),
            res('Déversoir rectangulaire', '', Qdr * 1000, 'L/s', '', { strong: true }),
            res('Déversoir triangulaire', 'Q', Qdt, 'm³/s', '8/15·Cd·tan(θ/2)·√(2g)·H^2,5'),
            res('Déversoir triangulaire', '', Qdt * 1000, 'L/s', '', { strong: true })
          ]
        };
      }
    },

    /* ------------------------------------------------------------ CONVERSIONS */
    {
      id: 'conversions', icon: '🔁', group: 'Outils',
      title: 'Convertisseur d\'unités',
      intro: 'Conversions usuelles en hydraulique : débit, pression, longueur, ' +
             'volume, vitesse.',
      render: function (ctx) {
        var grandeurs = Object.keys(C.FACTEURS);
        var labels = { debit: 'Débit', pression: 'Pression', longueur: 'Longueur',
                       volume: 'Volume', vitesse: 'Vitesse' };
        var state = ctx.convState || (ctx.convState = { grandeur: 'debit', valeur: 1, unite: 'L/s' });
        var wrap = el('div', { class: 'panel' });
        function rebuild() {
          wrap.innerHTML = '';
          var units = Object.keys(C.FACTEURS[state.grandeur]);
          if (units.indexOf(state.unite) < 0) state.unite = units[0];
          var gSel = el('select', { class: 'field-input' },
            grandeurs.map(function (g) {
              var o = el('option', { value: g }, labels[g]); if (g === state.grandeur) o.selected = true; return o;
            }));
          gSel.addEventListener('change', function () { state.grandeur = gSel.value; rebuild(); });
          var vInp = el('input', { class: 'field-input', type: 'number', step: 'any', value: state.valeur });
          vInp.addEventListener('input', function () { state.valeur = parseFloat(vInp.value); rebuild(); });
          var uSel = el('select', { class: 'field-input' },
            units.map(function (u) {
              var o = el('option', { value: u }, u); if (u === state.unite) o.selected = true; return o;
            }));
          uSel.addEventListener('change', function () { state.unite = uSel.value; rebuild(); });

          var rows = units.map(function (u) {
            var conv = C.convertir(state.grandeur, state.valeur, state.unite, u);
            return [u, ui.fmt(conv)];
          });
          wrap.appendChild(el('div', { class: 'fields' }, [
            el('div', { class: 'field field--wide' }, [el('label', { class: 'field-label' }, 'Grandeur'),
              el('div', { class: 'field-control' }, gSel)]),
            el('div', { class: 'field' }, [el('label', { class: 'field-label' }, 'Valeur'),
              el('div', { class: 'field-control' }, vInp)]),
            el('div', { class: 'field' }, [el('label', { class: 'field-label' }, 'Unité de départ'),
              el('div', { class: 'field-control' }, uSel)])
          ]));
          wrap.appendChild(ui.table({ caption: 'Équivalences', headers: ['Unité', 'Valeur'], rows: rows }));
        }
        rebuild();
        return wrap;
      }
    },

    /* ------------------------------------------------------------- RÉFÉRENCES */
    {
      id: 'references', icon: '📚', group: 'Outils',
      title: 'Tables de référence',
      intro: 'Rugosités, vitesses recommandées, modules d\'élasticité, diamètres ' +
             'normalisés et coefficients de Manning.',
      render: function () {
        function tbl(caption, headers, rows) {
          return el('div', { class: 'panel' }, ui.table({ caption: caption, headers: headers, rows: rows }));
        }
        return el('div', null, [
          tbl('Rugosités absolues ε (mm)', ['Matériau', 'ε neuf', 'ε usagé'],
            R.rugosites.map(function (r) { return [r.materiau, r.neuf, r.usage]; })),
          tbl('Vitesses recommandées (m/s)', ['Type', 'V min', 'V max'],
            R.vitesses.map(function (r) { return [r.type, r.vmin, r.vmax]; })),
          tbl('Modules d\'élasticité', ['Matériau', 'E (Pa)', 'Remarque'],
            R.modulesElasticite.map(function (r) { return [r.materiau, ui.fmt(r.E), r.note]; })),
          tbl('Coefficients de Manning / Strickler', ['Matériau', 'n', 'K = 1/n'],
            R.manning.map(function (r) { return [r.materiau, r.n, r.K]; })),
          tbl('Coefficients de singularité ξ', ['Singularité', 'ξ'],
            R.singularites.map(function (r) { return [r.nom, r.ksi]; })),
          el('div', { class: 'panel' }, [
            el('div', { class: 'panel-caption' }, 'Diamètres nominaux normalisés (mm)'),
            el('div', { class: 'dn-grid' }, R.diametresNominaux.map(function (d) {
              return el('span', { class: 'dn-chip' }, String(d));
            }))
          ])
        ]);
      }
    },

    /* ------------------------------------------------------------- RÉCAP */
    {
      id: 'recap', icon: '📋', group: 'Outils',
      title: 'Récapitulatif du projet',
      intro: 'Synthèse des résultats clés issus de tous les modules. Utilisez ' +
             '« Imprimer / PDF » pour éditer une note de calcul.',
      render: function (ctx) {
        var s = ctx.store;
        function g(k, u, d) { var v = s[k]; return (v == null) ? '—' : ui.fmt(v, u); }
        var groups = [
          ['Conduite', [
            ['Débit de pointe', g('Q', 'm³/h')],
            ['Diamètre intérieur', g('Di', 'mm')],
            ['Vitesse d\'écoulement', g('V', 'm/s')],
            ['Pertes de charge totales', g('dHtot', 'm')]
          ]],
          ['Station de pompage', [
            ['HMT de dimensionnement', g('HMT', 'm')],
            ['Puissance absorbée', g('Pelec', 'kW')],
            ['Puissance installée', g('Pinst', 'kW')],
            ['Débit unitaire / pompe', g('Qunit', 'm³/h')]
          ]],
          ['Bâche & transitoires', [
            ['Volume total bâche', g('Vbache', 'm³')],
            ['Classe de pression', s.PN || '—']
          ]],
          ['Hydrologie', [
            ['Volume de stockage pluvial', g('Vstockage', 'm³')],
            ['Capacité réseau Manning', g('Qcapacite', 'L/s')]
          ]]
        ];
        var blocks = groups.map(function (gr) {
          return el('div', { class: 'recap-card' }, [
            el('h3', null, gr[0]),
            el('table', { class: 'data-table' }, el('tbody', null, gr[1].map(function (row) {
              return el('tr', null, [el('td', null, row[0]), el('td', { class: 'recap-val' }, row[1])]);
            })))
          ]);
        });
        return el('div', { class: 'recap-grid' }, blocks);
      }
    }
  ];

  Hydro.modules = modules;
  Hydro.moduleOrder = modules.map(function (m) { return m.id; });

})(typeof window !== 'undefined' ? window : this);
