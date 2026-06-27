/* pumping.ui.js — interface Station de pompage */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function compute() {
    const r = GC.pumping.station({
      Q: D.num('pu_Q'), Hgeo: D.num('pu_Hgeo'),
      Jasp: D.num('pu_Jasp'), Jref: D.num('pu_Jref'), Pres: D.num('pu_Pres'),
      etaPompe: D.num('pu_etaPompe'), etaMoteur: D.num('pu_etaMoteur'),
      Z: D.num('pu_Z'), Hasp: D.num('pu_Hasp'), NPSHr: D.num('pu_NPSHr'),
      heures: D.num('pu_heures'), nPompes: D.num('pu_nPompes')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Station de pompage</h4></div>`;
    html += '<div class="kpis">' +
      kpi('HMT', D.fmt(r.HMT, 1), 'm') +
      kpi('P. électrique', D.fmt(r.Pelec, 2), 'kW') +
      kpi('Volume bâche', D.fmt(r.Vu, 2), 'm³') +
      kpi('NPSH dispo', D.fmt(r.NPSHd, 2), 'm') +
      '</div>';
    html += '<h5>Hauteur &amp; puissances</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Hauteur manométrique totale HMT', D.fmt(r.HMT, 1), 'm'],
      ['Puissance hydraulique', D.fmt(r.Phydraulique, 2), 'kW'],
      ['Puissance à l’arbre', D.fmt(r.Parbre, 2), 'kW'],
      ['<b>Puissance électrique absorbée</b>', '<b>' + D.fmt(r.Pelec, 2) + '</b>', 'kW']
    ]);
    html += '<h5>Bâche, cavitation &amp; énergie</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Statut'], [
      ['Volume utile bâche (Z=' + D.num('pu_Z') + '/h)', D.fmt(r.Vu, 2) + ' m³', ''],
      ['NPSH disponible / requis', D.fmt(r.NPSHd, 2) + ' / ' + D.fmt(r.NPSHr, 1) + ' m', D.badge(r.cavitationOk ? 'OK' : 'NOK')],
      ['Marge anti-cavitation', D.fmt(r.marge, 2) + ' m', r.marge >= 0.5 ? '✓' : '✗'],
      ['Configuration', r.configuration, ''],
      ['Énergie', D.fmt(r.kWhJour, 0) + ' kWh/j · ' + D.fmt(r.kWhAn, 0) + ' kWh/an', '']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#pu_res').innerHTML = html;
  }

  function kpi(label, val, unit) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-val">${val} <small>${unit}</small></div></div>`;
  }

  function init() {
    D.$('#pu_calc').addEventListener('click', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.pumping = { init, compute };
})();
