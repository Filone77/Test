/* elements.ui.js — interface Éléments BA (dalle 2 sens, semelle filante, voile) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function dalle2() {
    const r = GC.elements.dalle2sens({
      lx: D.num('el_lx'), ly: D.num('el_ly'), p: D.num('el_p'),
      h: D.num('el_h'), enrobage: D.num('el_enrobage'),
      fck: D.num('el_fck'), fyk: D.num('el_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Dalle portant deux sens</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Élancement α = lx/ly', D.fmt(r.alpha, 2), '—'],
      ['Coefficients μx / μy', D.fmt(r.mux, 4) + ' / ' + D.fmt(r.muy, 4), '—'],
      ['Moment Mx (sens lx)', D.fmt(r.Mx, 2), 'kN·m/m'],
      ['Moment My (sens ly)', D.fmt(r.My, 2), 'kN·m/m'],
      ['<b>As sens lx</b>', '<b>' + D.fmt(r.AsX, 0) + '</b>', 'mm²/m'],
      ['<b>As sens ly</b>', '<b>' + D.fmt(r.AsY, 0) + '</b>', 'mm²/m']
    ]);
    html += '<h5>Disposition des armatures</h5>';
    html += D.table(['Direction', 'Choix'], [
      ['Sens lx', r.choixX && r.choixX[1] ? `Ø${r.choixX[1].phi} / ${D.fmt(r.choixX[1].s, 0)} mm` : '—'],
      ['Sens ly', r.choixY && r.choixY[1] ? `Ø${r.choixY[1].phi} / ${D.fmt(r.choixY[1].s, 0)} mm` : '—']
    ]);
    if (r.porteUneDirection) html += '<ul class="notes"><li>α < 0,4 : la dalle porte essentiellement dans un sens.</li></ul>';
    D.$('#el_res').innerHTML = html;
  }

  function filante() {
    const r = GC.elements.semelleFilante({
      Nu: D.num('ef_Nu'), Nser: D.val('ef_Nser') ? D.num('ef_Nser') : undefined,
      sigmaAdm: D.num('ef_sigma'), a: D.num('ef_a'),
      fck: D.num('ef_fck'), fyk: D.num('ef_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Semelle filante</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Charge ELS Nser', D.fmt(r.Nser, 0), 'kN/ml'],
      ['<b>Largeur B</b>', '<b>' + D.fmt(r.B, 2) + '</b>', 'm'],
      ['Hauteur utile d / totale H', D.fmt(r.d, 2) + ' / ' + D.fmt(r.H, 2), 'm'],
      ['Contrainte sol / admissible', D.fmt(r.sigma, 0) + ' / ' + r.sigmaAdm, 'kPa'],
      ['<b>As transversal</b>', '<b>' + D.fmt(r.As, 2) + '</b>', 'cm²/ml']
    ]);
    if (r.choix && r.choix.length) {
      html += '<h5>Choix d’armatures</h5>' + D.table(['Choix', 'Aire'], r.choix.map((c) => [`${c.n} Ø${c.phi}`, D.fmt(c.As, 0) + ' mm²']));
    }
    D.$('#ef_res').innerHTML = html;
  }

  function voile() {
    const r = GC.elements.voile({
      NEd: D.num('ev_NEd'), hw: D.num('ev_hw'), lo: D.num('ev_lo'),
      e0: D.num('ev_e0'), fck: D.num('ev_fck')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Voile porteur (EC2 §12)</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Épaisseur hw', D.fmt(r.hw, 0), 'mm'],
      ['Excentricité totale etot', D.fmt(r.etot, 1), 'mm'],
      ['Coefficient Φ', D.fmt(r.Phi, 3), '—'],
      ['<b>Résistance NRd</b>', '<b>' + D.fmt(r.NRd, 0) + '</b>', 'kN/ml'],
      ['Sollicitation NEd', D.fmt(r.NEd, 0), 'kN/ml'],
      ['<b>Taux d’utilisation</b>', '<b>' + D.fmt(r.taux * 100, 0) + ' %</b>', ''],
      ['Aciers minimaux', D.fmt(r.AsMin, 0), 'mm²/m']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ev_res').innerHTML = html;
  }

  function init() {
    D.$('#el_calc').addEventListener('click', dalle2);
    D.$('#ef_calc').addEventListener('click', filante);
    D.$('#ev_calc').addEventListener('click', voile);
    dalle2(); filante(); voile();
  }

  GC.modules = GC.modules || {};
  GC.modules.elements = { init, dalle2, filante, voile };
})();
