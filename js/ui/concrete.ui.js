/* concrete.ui.js — interface du module Béton armé (EC2) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function rowsFromBarres(choix) {
    if (!choix || !choix.length) return '';
    return D.table(['Choix', 'Aire réelle'],
      choix.map((c) => [`${c.n} Ø${c.phi}`, `${D.fmt(c.As, 0)} mm²`]));
  }

  function flexion() {
    const r = GC.concrete.flexionSimple({
      MEd: D.num('bf_MEd'), b: D.num('bf_b'), h: D.num('bf_h'),
      d: D.val('bf_d') ? D.num('bf_d') : undefined,
      fck: D.num('bf_fck'), fyk: D.num('bf_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Flexion simple — résultats</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Moment réduit μ', D.fmt(r.mu, 3) + (r.aciersComprimes ? ' (> μlim)' : ''), '—'],
      ['Hauteur utile d', D.fmt(r.hypotheses.d, 0), 'mm'],
      ['Position axe neutre x', D.fmt(r.x, 0), 'mm'],
      ['Bras de levier z', D.fmt(r.z, 0), 'mm'],
      ['<b>Section d’acier As</b>', '<b>' + D.fmt(r.As, 0) + '</b>', 'mm²'],
      r.aciersComprimes ? ['Aciers comprimés A’s', D.fmt(r.AsComprime, 0), 'mm²'] : null,
      ['As,min', D.fmt(r.AsMin, 0), 'mm²'],
      ['As retenu', D.fmt(r.AsRetenu, 0), 'mm²']
    ].filter(Boolean));
    html += '<h5>Choix d’armatures</h5>' + rowsFromBarres(r.choixBarres);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#bf_res').innerHTML = html;
  }

  function tranchant() {
    const r = GC.concrete.effortTranchant({
      VEd: D.num('bt_VEd'), bw: D.num('bt_bw'), d: D.num('bt_d'),
      fck: D.num('bt_fck'), fyk: D.num('bt_fyk'), As: D.num('bt_As')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Effort tranchant — résultats</h4></div>`;
    const rows = [
      ['VEd', D.fmt(r.VEd, 1), 'kN'],
      ['VRd,c (sans armatures)', D.fmt(r.VRdc, 1), 'kN'],
      ['Coefficient k', D.fmt(r.k, 3), '—'],
      ['Armatures requises ?', r.armaturesRequises ? 'Oui' : 'Non', '—']
    ];
    if (r.armaturesRequises) {
      rows.push(['Inclinaison bielle θ', D.fmt(r.theta, 1) + '° (cot θ=' + D.fmt(r.cotTheta, 2) + ')', '']);
      rows.push(['VRd,max', D.fmt(r.VRdmax, 1), 'kN']);
      rows.push(['<b>Asw/s requis</b>', '<b>' + D.fmt(r.AswSretenu, 3) + '</b>', 'mm²/mm']);
    } else {
      rows.push(['Asw/s minimal', D.fmt(r.AswSmin, 3), 'mm²/mm']);
    }
    html += D.table(['Grandeur', 'Valeur', 'Unité'], rows);
    if (r.espacements) {
      html += '<h5>Espacement des cadres (2 brins)</h5>' +
        D.table(['Cadre', 'Espacement s', 's,max'],
          r.espacements.map((e) => [`Ø${e.phi}`, D.fmt(e.s, 0) + ' mm', D.fmt(e.sMax, 0) + ' mm']));
    }
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#bt_res').innerHTML = html;
  }

  function poteau() {
    const r = GC.concrete.poteau({
      NEd: D.num('bp_NEd'), MEd: D.num('bp_MEd'),
      b: D.num('bp_b'), h: D.num('bp_h'),
      fck: D.num('bp_fck'), fyk: D.num('bp_fyk'),
      l0: D.val('bp_l0') ? D.num('bp_l0') : undefined
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Poteau — résultats</h4></div>`;
    const rows = [
      ['Effort normal NEd', D.fmt(r.NEd, 0), 'kN'],
      ['Moment MEd (≥ min)', D.fmt(r.MEd, 1), 'kN·m'],
      ['Excentricité e0', D.fmt(r.e0, 0), 'mm'],
      ['Capacité Mrd à NEd', D.fmt(r.capaciteM, 1), 'kN·m'],
      ['<b>Aciers symétriques As</b>', '<b>' + D.fmt(r.As, 0) + '</b>', 'mm²'],
      ['As,min / As,max', D.fmt(r.AsMin, 0) + ' / ' + D.fmt(r.AsMax, 0), 'mm²'],
      ['Capacité centrée N0', D.fmt(r.N0, 0), 'kN']
    ];
    if (r.elancement) {
      rows.push(['Élancement λ / λlim', D.fmt(r.elancement.lambda, 0) + ' / ' + D.fmt(r.elancement.lambdaLim, 0),
        r.elancement.elance ? '⚠ élancé' : 'court']);
    }
    html += D.table(['Grandeur', 'Valeur', 'Unité'], rows);
    html += '<h5>Choix d’armatures (total)</h5>' + rowsFromBarres(r.choixBarres);
    html += '<div id="bp_plot" class="plotbox"></div>';
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#bp_res').innerHTML = html;
    GC.plot.interaction(D.$('#bp_plot'), r.interaction, { N: r.NEd, M: r.MEd });
  }

  function dalle() {
    const r = GC.concrete.dalle({
      MEd: D.num('bd_MEd'), h: D.num('bd_h'),
      enrobage: D.num('bd_enrobage'),
      fck: D.num('bd_fck'), fyk: D.num('bd_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Dalle (par mètre) — résultats</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Moment réduit μ', D.fmt(r.mu, 3), '—'],
      ['Bras de levier z', D.fmt(r.z, 0), 'mm'],
      ['<b>As par mètre</b>', '<b>' + D.fmt(r.AsRetenu, 0) + '</b>', 'mm²/m'],
      ['As,min', D.fmt(r.AsMin, 0), 'mm²/m']
    ]);
    html += '<h5>Espacement des barres</h5>' +
      D.table(['Barre', 'Espacement'], r.choixEspacement.map((e) => [`Ø${e.phi}`, D.fmt(e.s, 0) + ' mm']));
    D.$('#bd_res').innerHTML = html;
  }

  GC.modules = GC.modules || {};
  GC.modules.concrete = { flexion, tranchant, poteau, dalle };
})();
