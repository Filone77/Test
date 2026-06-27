/* loads.ui.js — interface du module Charges climatiques (neige / vent) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function populate() {
    const z = D.$('#cn_zone');
    Object.keys(GC.loads.ZONES_NEIGE).forEach((k) => {
      z.appendChild(D.el('option', { value: k, selected: k === 'C2' ? 'selected' : null },
        [k + ' (sk,0 = ' + GC.loads.ZONES_NEIGE[k] + ' kN/m²)']));
    });
    const r = D.$('#cv_region');
    Object.keys(GC.loads.REGIONS_VENT).forEach((k) => {
      r.appendChild(D.el('option', { value: k, selected: k === '3' ? 'selected' : null },
        ['Région ' + k + ' (vb,0 = ' + GC.loads.REGIONS_VENT[k] + ' m/s)']));
    });
    const t = D.$('#cv_terrain');
    Object.keys(GC.loads.TERRAINS).forEach((k) => {
      t.appendChild(D.el('option', { value: k, selected: k === 'II' ? 'selected' : null },
        ['Cat. ' + k + ' — ' + GC.loads.TERRAINS[k].libelle]));
    });
  }

  function neige() {
    const r = GC.loads.neige({
      zone: D.val('cn_zone'),
      sk0: D.val('cn_sk0') ? D.num('cn_sk0') : undefined,
      altitude: D.num('cn_altitude'),
      alpha: D.num('cn_alpha'),
      Ce: D.num('cn_Ce'), Ct: D.num('cn_Ct')
    });
    let html = `<div class="result-head"><span class="badge badge-ok">EN 1991-1-3</span><h4>Charge de neige</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Zone (sk,0 au sol)', r.zone + ' → ' + D.fmt(r.sk0, 2), 'kN/m²'],
      ['Majoration altitude Δs', D.fmt(r.dAlt, 2), 'kN/m²'],
      ['sk = sk,0 + Δs', D.fmt(r.sk, 2), 'kN/m²'],
      ['Coefficient de forme μ₁ (α=' + r.alpha + '°)', D.fmt(r.mu1, 2), '—'],
      ['Ce · Ct', D.fmt(r.Ce, 2) + ' · ' + D.fmt(r.Ct, 2), '—'],
      ['<b>Charge sur toiture s = μ₁·Ce·Ct·sk</b>', '<b>' + D.fmt(r.s, 2) + '</b>', 'kN/m²']
    ]);
    html += '<p class="muted">Charge de neige projetée sur l’horizontale, à combiner avec les autres actions (ELU/ELS).</p>';
    D.$('#cn_res').innerHTML = html;
  }

  function vent() {
    const r = GC.loads.vent({
      region: D.val('cv_region'),
      terrain: D.val('cv_terrain'),
      z: D.num('cv_z'),
      cpe: D.num('cv_cpe'),
      aire: D.num('cv_aire')
    });
    let html = `<div class="result-head"><span class="badge badge-ok">EN 1991-1-4</span><h4>Action du vent</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Vitesse de référence vb', D.fmt(r.vb, 1), 'm/s'],
      ['Rugosité cr(z)', D.fmt(r.cr, 3), '—'],
      ['Vitesse moyenne vm(z)', D.fmt(r.vm, 1), 'm/s'],
      ['Intensité de turbulence Iv', D.fmt(r.Iv, 3), '—'],
      ['Pression dynamique de référence qb', D.fmt(r.qb, 3), 'kN/m²'],
      ['Coefficient d’exposition ce(z)', D.fmt(r.ce, 2), '—'],
      ['<b>Pression de pointe qp(z)</b>', '<b>' + D.fmt(r.qp, 3) + '</b>', 'kN/m²'],
      ['Pression sur paroi we = qp·cpe (cpe=' + r.cpe + ')', D.fmt(r.we, 3), 'kN/m²'],
      ['Force sur ' + r.aire + ' m²', D.fmt(r.force, 2), 'kN']
    ]);
    html += '<p class="muted">cpe usuels : +0,8 (paroi au vent), −0,5 (paroi sous le vent), −0,7 à +0,2 (versants de toiture selon configuration).</p>';
    D.$('#cv_res').innerHTML = html;
  }

  function init() {
    populate();
    D.$('#cn_calc').addEventListener('click', neige);
    D.$('#cv_calc').addEventListener('click', vent);
    neige();
    vent();
  }

  GC.modules = GC.modules || {};
  GC.modules.loads = { init, neige, vent };
})();
