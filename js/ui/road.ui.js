/* road.ui.js — interface Dimensionnement de voirie */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function compute() {
    const r = GC.road.dimensionner({
      MJA: D.num('rv_MJA'), taux: D.num('rv_taux'), annees: D.num('rv_annees'),
      CAM: D.num('rv_CAM'), module: D.num('rv_module'),
      epsilon6: D.num('rv_e6'), bFatigue: D.num('rv_b'), kc: D.num('rv_kc')
    });
    let html = `<div class="result-head"><span class="badge badge-ok">NF P98-086</span><h4>Dimensionnement — ${r.classeTrafic} / ${r.classePlateforme}</h4></div>`;
    html += '<div class="kpis">' +
      `<div class="kpi"><div class="kpi-label">Classe trafic</div><div class="kpi-val">${r.classeTrafic}</div></div>` +
      `<div class="kpi"><div class="kpi-label">Plateforme</div><div class="kpi-val">${r.classePlateforme}</div></div>` +
      `<div class="kpi"><div class="kpi-label">Essieux éq. NE</div><div class="kpi-val">${D.fmt(r.NE / 1e6, 2)} <small>×10⁶</small></div></div>` +
      `<div class="kpi"><div class="kpi-label">Épaisseur</div><div class="kpi-val">${D.fmt(r.epaisseurTotale, 0)} <small>cm</small></div></div>` +
      '</div>';
    html += '<h5>Trafic &amp; déformations admissibles</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Facteur de cumul', D.fmt(r.facteurCumul, 1), '—'],
      ['Trafic cumulé NPL', D.fmt(r.NPL, 0), 'PL'],
      ['Essieux équivalents NE', D.fmt(r.NE, 0), '—'],
      ['Module de plateforme', D.fmt(r.module, 0), 'MPa'],
      ['<b>Déformation εz admissible (sol)</b>', '<b>' + D.fmt(r.epsZadm, 0) + '</b>', 'μdef'],
      ['<b>Déformation εt admissible (fatigue)</b>', '<b>' + D.fmt(r.epsTadm, 0) + '</b>', 'μdef']
    ]);
    html += '<h5>Structure indicative (catalogue VRD)</h5>';
    html += D.table(['Couche', 'Épaisseur', 'Matériau'], [
      ['Roulement', D.fmt(r.structure.roulement, 0) + ' cm', r.structure.materiau.split(' + ')[0] || 'BBSG'],
      ['Base', r.structure.base ? D.fmt(r.structure.base, 0) + ' cm' : '—', r.structure.base ? (r.structure.materiau.indexOf('GB') >= 0 ? 'GB' : 'GNT') : '—'],
      ['Fondation', D.fmt(r.structure.fondation, 0) + ' cm', 'GNT'],
      ['<b>Total</b>', '<b>' + D.fmt(r.epaisseurTotale, 0) + ' cm</b>', r.structure.materiau]
    ]);
    html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#rv_res').innerHTML = html;
  }

  function init() {
    D.$('#rv_calc').addEventListener('click', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.road = { init, compute };
})();
