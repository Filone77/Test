/* sludge.ui.js — interface Réseaux de boues */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function bilan() {
    const pr = GC.sludge.proprietes({ C: D.num('sl_C'), rhoS: D.num('sl_rhoS') });
    const m = GC.sludge.bilanMasse({ Q: D.num('sl_Q'), C: D.num('sl_C'), rhoS: D.num('sl_rhoS') });
    D.$('#sl_res').innerHTML = head('Propriétés & matière sèche') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Siccité (concentration MS)', D.fmt(pr.C, 1), '%'],
      ['Masse volumique des MS', D.fmt(pr.rhoS, 0), 'kg/m³'],
      ['<b>Masse volumique de la boue</b>', '<b>' + D.fmt(pr.rho, 1) + '</b>', 'kg/m³'],
      ['Débit de matière sèche', D.fmt(m.Mds_kgh, 0), 'kg/h'],
      ['Production MS', D.fmt(m.Mds_td, 2), 't/j'],
      ['Production MS annuelle', D.fmt(m.Mds_tan, 0), 't/an']
    ]);
  }
  function epaiss() {
    const r = GC.sludge.epaississement({ Q1: D.num('se_Q1'), C1: D.num('se_C1'), C2: D.num('se_C2') });
    D.$('#se_res').innerHTML = head('Épaississement / déshydratation') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Débit initial (C=' + D.fmt(r.C1, 1) + ' %)', D.fmt(r.Q1, 1), 'm³/h'],
      ['<b>Débit épaissi (C=' + D.fmt(r.C2, 1) + ' %)</b>', '<b>' + D.fmt(r.Q2, 1) + '</b>', 'm³/h'],
      ['Réduction de volume', D.fmt(r.reductionVolume, 1), '%'],
      ['Filtrat / surnageant', D.fmt(r.filtrat, 1), 'm³/h']
    ]);
  }
  function pertes() {
    const r = GC.sludge.perteCharge({ Qls: D.num('sp_Qls'), D: D.num('sp_D'), L: D.num('sp_L'), C: D.num('sp_C') });
    let html = head('Pertes de charge (conduite de boue)') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Vitesse', D.fmt(r.V, 2), 'm/s'],
      ['Facteur de friction f', D.fmt(r.f, 4), '—'],
      ['Perte de charge (eau)', D.fmt(r.hfEau, 2), 'm'],
      ['Facteur de correction boue', D.fmt(r.kFacteur, 2), '×'],
      ['<b>Perte de charge (boue)</b>', '<b>' + D.fmt(r.hfBoue, 2) + '</b>', 'm']
    ]);
    html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#sp_res').innerHTML = html;
  }
  function head(t) { return `<div class="result-head"><span class="badge badge-ok">Boues</span><h4>${t}</h4></div>`; }

  function init() {
    D.$('#sl_calc').addEventListener('click', bilan);
    D.$('#se_calc').addEventListener('click', epaiss);
    D.$('#sp_calc').addEventListener('click', pertes);
    bilan(); epaiss(); pertes();
  }
  GC.modules = GC.modules || {};
  GC.modules.sludge = { init, bilan, epaiss, pertes };
})();
