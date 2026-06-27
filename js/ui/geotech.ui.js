/* geotech.ui.js — interface Géotechnique & Tranchée blindée */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function populate() {
    const sel = D.$('#tb_heb');
    GC.profiles.list('HEB').forEach((p) => {
      sel.appendChild(D.el('option', { value: p.nom, selected: p.nom === 'HEB 160' ? 'selected' : null }, [p.nom]));
    });
    const fy = D.$('#tb_fy');
    Object.keys(GC.core.ACIERS_CONSTRUCTION).forEach((k) => {
      fy.appendChild(D.el('option', { value: GC.core.ACIERS_CONSTRUCTION[k], selected: k === 'S235' ? 'selected' : null }, [k]));
    });
  }

  function tauxBadge(t) {
    return `<span class="badge ${t <= 1 ? 'badge-ok' : 'badge-nok'}">${D.fmt(t * 100, 0)} %</span>`;
  }

  function bois() {
    const r = GC.trench.blindageBois({
      H: D.num('tb_H'), B: D.num('tb_B'), gamma: D.num('tb_gamma'),
      phi: D.num('tb_phi'), q: D.num('tb_q'), hw: D.num('tb_hw'),
      sH: D.num('tb_sH'), nButons: D.num('tb_nButons'),
      heb: D.val('tb_heb'), fy: D.num('tb_fy'),
      fmBois: D.num('tb_fmBois'), epPlanche: D.num('tb_epPlanche') / 1000
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Blindage HEB + bois</h4></div>`;
    html += D.table(['Pression latérale', 'Valeur', 'Unité'], [
      ['Coefficient Ka', D.fmt(r.pression.Ka, 3), '—'],
      ['Pression apparente sol (Terzaghi-Peck)', D.fmt(r.pression.pSoil, 1), 'kPa'],
      ['Surcharge', D.fmt(r.pression.pQ, 1), 'kPa'],
      ['Eau (moyenne)', D.fmt(r.pression.pEauMoy, 1), 'kPa'],
      ['<b>Pression de calcul</b>', '<b>' + D.fmt(r.pression.pDesign, 1) + '</b>', 'kPa']
    ]);
    html += '<h5>Vérifications des composants</h5>';
    html += D.table(['Élément', 'Sollicitation', 'Résistance', 'Taux'], [
      ['Soldat ' + r.soldat.profil + ' (flexion)', D.fmt(r.soldat.M, 1) + ' kN·m', D.fmt(r.soldat.McRd, 1) + ' kN·m', tauxBadge(r.soldat.taux)],
      ['Planche bois (flexion)', D.fmt(r.bois.sigma, 1) + ' MPa', r.bois.fm + ' MPa', tauxBadge(r.bois.taux)],
      ['Buton ' + r.buton.profil + ' (flambement)', D.fmt(r.buton.N, 1) + ' kN', D.fmt(r.buton.NbRd, 1) + ' kN', tauxBadge(r.buton.taux)]
    ]);
    html += `<p class="muted">Portée verticale entre lits de butons : ${D.fmt(r.Lv, 2)} m · χ buton = ${D.fmt(r.buton.chi, 2)}</p>`;
    D.$('#tb_res').innerHTML = html;
  }

  function caisson() {
    const r = GC.trench.caisson({
      H: D.num('tc_H'), gamma: D.num('tc_gamma'), phi: D.num('tc_phi'),
      q: D.num('tc_q'), hw: D.num('tc_hw'), ratingKPa: D.num('tc_rating')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Blindage par caisson</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Coefficient Ka', D.fmt(r.pression.Ka, 3), '—'],
      ['Pression maximale (sol+surcharge+eau)', D.fmt(r.pMax, 1), 'kPa'],
      ['Capacité du caisson', D.fmt(r.ratingKPa, 0), 'kPa'],
      ['<b>Taux d’utilisation</b>', '<b>' + D.fmt(r.taux * 100, 0) + ' %</b>', '']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#tc_res').innerHTML = html;
  }

  function init() {
    populate();
    D.$('#tb_calc').addEventListener('click', bois);
    D.$('#tc_calc').addEventListener('click', caisson);
    bois(); caisson();
  }

  GC.modules = GC.modules || {};
  GC.modules.geotech = { init, bois, caisson };
})();
