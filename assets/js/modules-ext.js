/* ============================================================================
 * HydroCalc — Modules d'extension
 * ----------------------------------------------------------------------------
 * Nouveaux modules ajoutés à Hydro.modules :
 *  - Conduite multi-tronçons & profil piézométrique
 *  - Pompes en parallèle / série (courbe ajustée sur 3 points)
 *  - Ballon anti-bélier
 *  - Réseau maillé (Hardy-Cross)
 *  - Méthode rationnelle
 *  - Comparaison de scénarios (optimisation technico-économique)
 * ==========================================================================*/
(function (root) {
  'use strict';
  var Hydro = root.Hydro;
  var C = Hydro.calc, R = Hydro.refs;

  function st(kind, text) { return { kind: kind, text: text }; }
  function res(label, symbol, value, unit, formula, extra) {
    var o = { label: label, symbol: symbol, value: value, unit: unit, formula: formula };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function matEps(nom) {
    var m = (R.materiaux || []).filter(function (x) { return x.nom === nom; })[0];
    return m ? m.eps : 0.01;
  }

  /** Analyse "0+,1+,3-,2-;4+,5-,1-" -> [[{pipe,sens}]] */
  function parseLoops(text, nPipes) {
    if (!text) return [];
    return String(text).split(';').map(function (loop) {
      return loop.split(',').map(function (tok) {
        tok = tok.trim(); if (!tok) return null;
        var sens = tok.slice(-1) === '-' ? -1 : 1;
        var idx = parseInt(tok.replace(/[+-]\s*$/, ''), 10);
        if (isNaN(idx) || idx < 0 || idx >= nPipes) return null;
        return { pipe: idx, sens: sens };
      }).filter(Boolean);
    }).filter(function (l) { return l.length; });
  }

  var modules = [

    /* ----------------------------------------- CONDUITE MULTI-TRONÇONS */
    {
      id: 'multitroncons', icon: '🧩', group: 'Fluide & conduite',
      title: 'Conduite multi-tronçons & profil',
      intro: 'Conduite composée de plusieurs tronçons (diamètre, matériau, ' +
             'longueur, dénivelé différents). Calcule les pertes cumulées et ' +
             'trace le profil en long avec la ligne piézométrique.',
      inputs: [
        { key: 'methode', label: 'Méthode de perte de charge', unit: '', type: 'select', wide: true,
          options: [ { value: 'swamee', label: 'Darcy — Swamee-Jain' },
                     { value: 'colebrook', label: 'Darcy — Colebrook-White' },
                     { value: 'hazen', label: 'Hazen-Williams (colonne ε = C)' } ],
          default: 'swamee' },
        { key: 'Hdepart', label: 'Charge au départ', symbol: 'H₀', unit: 'm', default: 50,
          hint: 'Pression disponible à l\'origine' },
        { key: 'zDepart', label: 'Cote terrain au départ', symbol: 'z₀', unit: 'm NGF', default: 10 }
      ],
      grid: {
        key: 'segments',
        columns: [
          { key: 'Q', label: 'Q', unit: 'm³/h', editable: true },
          { key: 'Di', label: 'Di', unit: 'mm', editable: true },
          { key: 'L', label: 'L', unit: 'm', editable: true },
          { key: 'eps', label: 'ε / C', unit: '', editable: true, step: 0.001 },
          { key: 'ksi', label: 'Σξ', unit: '-', editable: true, step: 0.1 },
          { key: 'dz', label: 'Δz', unit: 'm', editable: true, step: 0.1 }
        ],
        rows: [
          { Q: 200, Di: 200, L: 300, eps: 0.01, ksi: 1, dz: 2 },
          { Q: 200, Di: 150, L: 200, eps: 0.01, ksi: 0.5, dz: 3 }
        ]
      },
      compute: function (v, store) {
        var nu = store.nu || C.viscositeCinematique(15);
        var segs = (v.segments || []).filter(function (r) { return +r.L > 0; }).map(function (r) {
          return { Q_m3h: +r.Q, Di_mm: +r.Di, L_m: +r.L, eps_mm: +r.eps,
                   Chw: +r.eps, ksi: +r.ksi || 0, dz: +r.dz || 0 };
        });
        var rs = C.reseauSerie(segs, { methode: v.methode, nu: nu,
          Hdepart: +v.Hdepart, zDepart: +v.zDepart });
        var rows = rs.details.map(function (d) {
          return [d.index, C.round(d.V, 3), C.round(d.J, 5), C.round(d.dH, 3),
                  C.round(d.Lcum, 0), C.round(d.piezo, 2), C.round(d.pression, 2)];
        });
        var terrain = rs.profil.map(function (p) { return { x: p.L, y: p.z }; });
        var piezo = rs.profil.map(function (p) { return { x: p.L, y: p.piezo }; });
        var notes = [];
        if (rs.pressionMin < 0)
          notes.push('⚠ Pression négative en ligne : risque de poche d\'air / cavitation. ' +
                     'Revoir le tracé, les diamètres ou la charge de départ.');
        return {
          results: [
            res('Longueur totale', 'L', rs.Ltotal, 'm', ''),
            res('Dénivelé total', 'Δz', rs.dzTotal, 'm', ''),
            res('Pertes de charge totales', 'ΔHtot', rs.dHtotal, 'm', '', { strong: true }),
            res('Pression minimale en ligne', '', rs.pressionMin, 'm CE', '',
                { strong: true, status: rs.pressionMin > 0 ? st('ok', 'OK') : st('bad', 'Négative') }),
            res('Pression maximale en ligne', '', rs.pressionMax, 'm CE', '')
          ],
          tables: [{ caption: 'Détail par tronçon',
            headers: ['#', 'V (m/s)', 'J (m/m)', 'ΔH (m)', 'L cum. (m)', 'Piézo (m)', 'Pression (m)'],
            rows: rows }],
          chart: {
            series: [ { points: terrain, color: '#a16207' }, { points: piezo, color: '#2563eb' } ],
            opts: { xlabel: 'L (m)', ylabel: 'Cote (m)', autoY: true, width: 620, height: 300 },
            legend: [ { color: '#a16207', label: 'Profil terrain' },
                      { color: '#2563eb', label: 'Ligne piézométrique' } ]
          },
          notes: notes
        };
      }
    },

    /* ----------------------------------------- POMPES PARALLÈLE / SÉRIE */
    {
      id: 'pompesmultiples', icon: '🔀', group: 'Pompage',
      title: 'Pompes en parallèle / série',
      intro: 'Courbe de pompe ajustée sur 3 points constructeur, puis ' +
             'association de n pompes identiques en parallèle ou en série, et ' +
             'point de fonctionnement sur le réseau.',
      inputs: [
        { key: 'Q1', label: 'Point 1 — débit', symbol: 'Q₁', unit: 'm³/h', default: 0 },
        { key: 'H1', label: 'Point 1 — hauteur', symbol: 'H₁', unit: 'm', default: 50 },
        { key: 'Q2', label: 'Point 2 — débit', symbol: 'Q₂', unit: 'm³/h', default: 100 },
        { key: 'H2', label: 'Point 2 — hauteur', symbol: 'H₂', unit: 'm', default: 42 },
        { key: 'Q3', label: 'Point 3 — débit', symbol: 'Q₃', unit: 'm³/h', default: 200 },
        { key: 'H3', label: 'Point 3 — hauteur', symbol: 'H₃', unit: 'm', default: 28 },
        { key: 'n', label: 'Nombre de pompes', symbol: 'n', unit: '-', default: 2, step: 1 },
        { key: 'mode', label: 'Association', unit: '', type: 'select', wide: true,
          options: [ { value: 'parallele', label: 'Parallèle (débits qui s\'ajoutent)' },
                     { value: 'serie', label: 'Série (hauteurs qui s\'ajoutent)' } ],
          default: 'parallele' },
        { key: 'Hgeo', label: 'Hauteur géométrique', symbol: 'Hgéo', unit: 'm', link: 'Hgeo', default: 5 },
        { key: 'dHtot', label: 'Pertes au débit de référence', symbol: 'ΔHtot', unit: 'm', link: 'dHtot', default: 8 },
        { key: 'Qref', label: 'Débit de référence', symbol: 'Qref', unit: 'm³/h', link: 'Q', default: 200 }
      ],
      compute: function (v) {
        var coef = C.ajustePompe3pts([{ Q: +v.Q1, H: +v.H1 }, { Q: +v.Q2, H: +v.H2 }, { Q: +v.Q3, H: +v.H3 }]);
        var n = +v.n || 1;
        var comb = (v.mode === 'serie')
          ? { a0: n * coef.a0, a1: n * coef.a1, a2: n * coef.a2 }
          : { a0: coef.a0, a1: coef.a1 / n, a2: coef.a2 / (n * n) };
        var R2 = C.resistanceReseau(v.dHtot, v.Qref);
        var pt = C.pointFonctionnementPoly(comb, v.Hgeo, R2);
        var Qmax = Math.max(+v.Q3, +v.Qref, isFinite(pt.Q) ? pt.Q : 0) * 1.25 || 100;
        var s1 = [], sc = [], sr = [];
        for (var i = 0; i <= 30; i++) {
          var q = Qmax * i / 30;
          s1.push({ x: q, y: Math.max(0, C.Hpompe(coef, q)) });
          sc.push({ x: q, y: Math.max(0, C.Hpompe(comb, q)) });
          sr.push({ x: q, y: v.Hgeo + R2 * q * q });
        }
        var debitParPompe = (v.mode === 'parallele') ? pt.Q / n : pt.Q;
        return {
          results: [
            res('Courbe pompe — a₀', 'a₀', coef.a0, 'm', 'H = a₀+a₁Q+a₂Q²'),
            res('Courbe pompe — a₁', 'a₁', coef.a1, '', ''),
            res('Courbe pompe — a₂', 'a₂', coef.a2, '', ''),
            res('Débit de fonctionnement', 'Q', pt.Q, 'm³/h', n + ' pompes ' + v.mode, { strong: true }),
            res('Hauteur de fonctionnement', 'H', pt.H, 'm', 'intersection', { strong: true }),
            res('Débit par pompe', '', debitParPompe, 'm³/h', v.mode === 'parallele' ? 'Q / n' : 'Q')
          ],
          chart: {
            series: [ { points: s1, color: '#94a3b8' }, { points: sc, color: '#16a34a' },
                      { points: sr, color: '#2563eb' } ],
            opts: { xlabel: 'Q (m³/h)', ylabel: 'H (m)', marker: { x: pt.Q, y: pt.H } },
            legend: [ { color: '#94a3b8', label: '1 pompe' },
                      { color: '#16a34a', label: n + ' pompes (' + v.mode + ')' },
                      { color: '#2563eb', label: 'Réseau' },
                      { color: '#dc2626', label: 'Point de fonctionnement' } ]
          }
        };
      }
    },

    /* ----------------------------------------- BALLON ANTI-BÉLIER */
    {
      id: 'ballon', icon: '🎈', group: 'Pompage',
      title: 'Ballon anti-bélier',
      intro: 'Pré-dimensionnement du volume d\'un réservoir anti-bélier (ballon ' +
             'à vessie) par bilan énergétique isotherme. À confirmer par une ' +
             'modélisation transitoire (méthode de Vibert / Bergeron).',
      inputs: [
        { key: 'Di', label: 'Diamètre intérieur', symbol: 'D', unit: 'mm', link: 'Di', default: 150 },
        { key: 'L', label: 'Longueur de conduite', symbol: 'L', unit: 'm', link: 'L', default: 160 },
        { key: 'V', label: 'Vitesse d\'écoulement', symbol: 'V', unit: 'm/s', link: 'V', default: 1.5 },
        { key: 'Pservice', label: 'Pression de service', symbol: 'Pn', unit: 'm CE', link: 'Pservice', default: 40 },
        { key: 'maj', label: 'Surpression admissible', unit: '%', default: 30, hint: 'Pmax = (Pn+Patm)·(1+maj)' }
      ],
      compute: function (v, store) {
        var rho = store.rho || 1000;
        var A = C.section(v.Di);
        var P0 = v.Pservice + 10.33;            // pression absolue de service (m CE)
        var Pmax = P0 * (1 + (+v.maj) / 100);
        var bb = C.ballonAntiBelier(rho, v.L, A, v.V, P0, Pmax);
        return {
          results: [
            res('Section de la conduite', 'A', A, 'm²', 'π·D²/4'),
            res('Pression absolue de service', 'P₀', P0, 'm CE', 'Pn + Patm'),
            res('Pression absolue maximale', 'Pmax', Pmax, 'm CE', 'P₀·(1+maj)'),
            res('Volume d\'air initial', 'U₀', bb.U0, 'm³', 'bilan isotherme', { strong: true }),
            res('Volume d\'air maximal', 'Umax', bb.Umax, 'm³', 'U₀·(Pmax/P₀)'),
            res('Volume de ballon conseillé', 'Vb', bb.volumeBallon, 'm³', 'Umax + 20 %', { strong: true })
          ],
          notes: ['Méthode de pré-dimensionnement énergétique (compression isotherme). ' +
                  'Le volume réel dépend du type de protection et doit être validé par une ' +
                  'analyse transitoire détaillée.']
        };
      }
    },

    /* ----------------------------------------- RÉSEAU MAILLÉ (HARDY-CROSS) */
    {
      id: 'reseaumaille', icon: '🕸️', group: 'Réseaux',
      title: 'Réseau maillé (Hardy-Cross)',
      intro: 'Répartition des débits dans un réseau maillé par la méthode de ' +
             'Hardy-Cross. Renseignez la résistance r et le débit initial de ' +
             'chaque conduite, puis définissez les mailles.',
      inputs: [
        { key: 'loops', label: 'Mailles (ex. « 0+,1+,3-,2- »)', unit: '', type: 'text', wide: true,
          default: '0+,1+,3-,2-',
          hint: 'Indices de conduites avec sens (+/−), mailles séparées par « ; »' }
      ],
      grid: {
        key: 'pipes',
        columns: [
          { key: 'r', label: 'Résistance r', unit: 'm/(m³/h)²', editable: true, step: 0.001 },
          { key: 'Q', label: 'Débit initial', unit: 'm³/h', editable: true }
        ],
        rows: [ { r: 0.002, Q: 60 }, { r: 0.003, Q: 60 }, { r: 0.002, Q: 40 }, { r: 0.003, Q: 40 } ]
      },
      compute: function (v) {
        var pipes = (v.pipes || []).map(function (r) { return { r: +r.r, Q: +r.Q }; });
        var loops = parseLoops(v.loops, pipes.length);
        if (!loops.length)
          return { results: [res('Définir au moins une maille valide', '', '', '', '')] };
        var hc = C.hardyCross(pipes, loops, {});
        var rows = hc.debits.map(function (d) {
          return [d.pipe, C.round(d.Q, 2), C.round(d.perte, 4)];
        });
        return {
          results: [
            res('Nombre de mailles', '', loops.length, '-', ''),
            res('Itérations', '', hc.iterations, '-', 'convergence Hardy-Cross'),
            res('Correction finale', 'ΔQ', hc.convergence, 'm³/h', '', { strong: true })
          ],
          tables: [{ caption: 'Débits convergés par conduite',
            headers: ['Conduite', 'Q (m³/h)', 'Perte r·Q² (m)'], rows: rows }]
        };
      }
    },

    /* ----------------------------------------- MÉTHODE RATIONNELLE */
    {
      id: 'rationnelle', icon: '☔', group: 'Assainissement & hydrologie',
      title: 'Méthode rationnelle',
      intro: 'Débit de pointe pluvial Q = C·i·A. Le temps de concentration ' +
             '(Kirpich) fixe la durée de pluie, et l\'intensité suit la loi de ' +
             'Montana.',
      inputs: [
        { key: 'A', label: 'Surface du bassin versant', symbol: 'A', unit: 'ha', default: 5 },
        { key: 'Cr', label: 'Coefficient de ruissellement', symbol: 'C', unit: '-', default: 0.8, step: 0.05,
          hint: 'Toiture 0,9 · urbain 0,7 · vert 0,15' },
        { key: 'L', label: 'Longueur d\'écoulement', symbol: 'L', unit: 'm', default: 500 },
        { key: 'I', label: 'Pente moyenne', symbol: 'I', unit: 'm/m', default: 0.01, step: 0.001 },
        { key: 'a', label: 'Coefficient de Montana a', symbol: 'a', unit: '-', default: 5.9, step: 0.1 },
        { key: 'b', label: 'Coefficient de Montana b', symbol: 'b', unit: '-', default: 0.62, step: 0.01 }
      ],
      compute: function (v) {
        var tc = C.tcKirpich(v.L, v.I);
        var i = C.montanaMmH(v.a, v.b, tc);
        var Q = C.methodeRationnelle(v.Cr, i, v.A);
        return {
          results: [
            res('Temps de concentration', 'tc', tc, 'min', 'Kirpich : 0,0195·L^0,77·I^−0,385'),
            res('Intensité de pluie', 'i', i, 'mm/h', 'Montana à t = tc'),
            res('Débit de pointe', 'Q', Q, 'm³/s', 'C·i·A / 360', { strong: true }),
            res('Débit de pointe', '', Q * 1000, 'L/s', '', { strong: true })
          ],
          publish: { Qpluvial: Q * 1000 }
        };
      }
    },

    /* ----------------------------------------- COMPARAISON DE SCÉNARIOS */
    {
      id: 'scenarios', icon: '⚖️', group: 'Outils',
      title: 'Comparaison de scénarios',
      intro: 'Optimisation technico-économique du diamètre : pour chaque DN, ' +
             'coût de l\'énergie de pompage et coût annualisé de la conduite. ' +
             'Le diamètre optimal minimise le coût total annuel.',
      inputs: [
        { key: 'Q', label: 'Débit', symbol: 'Q', unit: 'm³/h', link: 'Q', default: 200 },
        { key: 'L', label: 'Longueur de conduite', symbol: 'L', unit: 'm', link: 'L', default: 160 },
        { key: 'Hgeo', label: 'Hauteur géométrique', symbol: 'Hgéo', unit: 'm', link: 'Hgeo', default: 5 },
        { key: 'materiau', label: 'Matériau', unit: '', type: 'select', wide: true,
          options: R.materiaux.map(function (m) { return m.nom; }), default: 'PEHD PE100' },
        { key: 'Pres', label: 'Pression résiduelle', symbol: 'Prés', unit: 'm', default: 20 },
        { key: 'etaG', label: 'Rendement global pompe+moteur', symbol: 'ηg', unit: '-', default: 0.7, step: 0.01 },
        { key: 'Hf', label: 'Heures de fonctionnement', symbol: 'Hf', unit: 'h/an', default: 4000 },
        { key: 'prixkWh', label: 'Prix de l\'électricité', unit: '€/kWh', default: 0.15, step: 0.01 },
        { key: 'prixCond', label: 'Coût conduite', unit: '€/m/100mm', default: 40,
          hint: 'Coût par mètre et par 100 mm de DN' },
        { key: 'dureeVie', label: 'Durée d\'amortissement', unit: 'an', default: 30 }
      ],
      compute: function (v, store) {
        var rho = store.rho || 1000, nu = store.nu || 1e-6, eps = matEps(v.materiau);
        var best = null, rows = [];
        R.diametresNominaux.forEach(function (DN) {
          var Di = R.diInterieur(v.materiau, DN, 16);
          var cond = C.conduite({ Q_m3h: v.Q, Di_mm: Di, L_m: v.L, eps_mm: eps, nu: nu, methode: 'swamee' });
          if (cond.V < 0.4 || cond.V > 3.5) return; // hors plage utile
          var HMT = Math.abs(v.Hgeo) + cond.dHlin + v.Pres;
          var Pelec = rho * 9.81 * (v.Q / 3600) * HMT / 1000 / v.etaG;
          var coutE = Pelec * v.Hf * v.prixkWh;                 // €/an
          var capital = v.prixCond * (DN / 100) * v.L;          // €
          var annualise = capital / v.dureeVie;                 // €/an
          var total = coutE + annualise;
          var row = { DN: DN, V: cond.V, dHlin: cond.dHlin, HMT: HMT, Pelec: Pelec,
                      coutE: coutE, capital: capital, total: total };
          rows.push(row);
          if (!best || total < best.total) best = row;
        });
        var hl = rows.indexOf(best);
        var tableRows = rows.map(function (r) {
          return [r.DN, C.round(r.V, 2), C.round(r.dHlin, 2), C.round(r.HMT, 1),
                  C.round(r.Pelec, 1), Math.round(r.coutE), Math.round(r.capital), Math.round(r.total)];
        });
        return {
          results: best ? [
            res('Diamètre optimal', 'DN', best.DN, 'mm', 'coût total minimal', { strong: true }),
            res('Vitesse correspondante', 'V', best.V, 'm/s', ''),
            res('Coût énergétique annuel', '', best.coutE, '€/an', ''),
            res('Coût conduite annualisé', '', best.capital / v.dureeVie, '€/an', ''),
            res('Coût total annuel', '', best.total, '€/an', '', { strong: true })
          ] : [res('Aucun diamètre dans la plage de vitesse', '', '', '', '')],
          tables: [{ caption: 'Comparaison des diamètres',
            headers: ['DN', 'V (m/s)', 'ΔHlin (m)', 'HMT (m)', 'Pélec (kW)', 'Énergie €/an', 'Conduite €', 'Total €/an'],
            rows: tableRows, highlightRow: hl }]
        };
      }
    }
  ];

  Array.prototype.push.apply(Hydro.modules, modules);

})(typeof window !== 'undefined' ? window : this);
