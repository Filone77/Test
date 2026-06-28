/* weirs.ui.js — interface Déversoirs */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function rect() {
    const r = GC.weirs.rectangulaire({ b: D.num('wr_b'), H: D.num('wr_H'), P: D.val('wr_P') ? D.num('wr_P') : undefined, Cd: D.val('wr_Cd') ? D.num('wr_Cd') : undefined, contractions: D.num('wr_contractions') });
    D.$('#wr_res').innerHTML = head('Seuil rectangulaire (paroi mince)') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Coefficient de débit Cd', D.fmt(r.Cd, 3), '—'],
      ['Largeur effective', D.fmt(r.beff, 2), 'm'],
      ['Charge H', D.fmt(r.H, 2), 'm'],
      ['<b>Débit Q</b>', '<b>' + D.fmt(r.Q, 3) + '</b>', 'm³/s'],
      ['Débit Q', D.fmt(r.Qls, 0), 'L/s']
    ]);
  }
  function tri() {
    const r = GC.weirs.triangulaire({ theta: D.num('wt_theta'), H: D.num('wt_H'), Cd: D.val('wt_Cd') ? D.num('wt_Cd') : undefined });
    D.$('#wt_res').innerHTML = head('Seuil triangulaire (V-notch)') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Angle d’ouverture θ', D.fmt(r.theta, 0), '°'],
      ['Coefficient Cd', D.fmt(r.Cd, 3), '—'],
      ['Charge H', D.fmt(r.H, 2), 'm'],
      ['<b>Débit Q</b>', '<b>' + D.fmt(r.Qls, 1) + '</b>', 'L/s']
    ]);
  }
  function epais() {
    const r = GC.weirs.epais({ b: D.num('we_b'), H: D.num('we_H'), Cd: D.val('we_Cd') ? D.num('we_Cd') : undefined });
    D.$('#we_res').innerHTML = head('Seuil épais (broad-crested)') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Coefficient Cd', D.fmt(r.Cd, 3), '—'],
      ['Charge H', D.fmt(r.H, 2), 'm'],
      ['Hauteur critique sur seuil', D.fmt(r.Hcrit, 2), 'm'],
      ['<b>Débit Q</b>', '<b>' + D.fmt(r.Q, 3) + '</b>', 'm³/s']
    ]);
  }
  function orage() {
    const r = GC.weirs.deversoirOrage({ Qamont: D.num('wo_Qamont'), Qconserve: D.num('wo_Qconserve'), b: D.num('wo_b'), Cd: D.val('wo_Cd') ? D.num('wo_Cd') : undefined });
    let html = head('Déversoir d’orage (latéral)') + D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Débit amont', D.fmt(r.Qamont, 0), 'L/s'],
      ['Débit conservé (vers station)', D.fmt(r.Qconserve, 0), 'L/s'],
      ['<b>Débit déversé</b>', '<b>' + D.fmt(r.Qdeverse, 0) + '</b>', 'L/s'],
      ['Hauteur de lame H', D.fmt(r.H, 3), 'm'],
      ['Taux de dilution', D.fmt(r.tauxDilution, 2), '—']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#wo_res').innerHTML = html;
  }
  function head(t) { return `<div class="result-head"><span class="badge badge-ok">Hydraulique</span><h4>${t}</h4></div>`; }

  function init() {
    D.$('#wr_calc').addEventListener('click', rect);
    D.$('#wt_calc').addEventListener('click', tri);
    D.$('#we_calc').addEventListener('click', epais);
    D.$('#wo_calc').addEventListener('click', orage);
    rect(); tri(); epais(); orage();
  }
  GC.modules = GC.modules || {};
  GC.modules.weirs = { init, rect, tri, epais, orage };
})();
