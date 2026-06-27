/* pressure.ui.js — interface Conduite sous pression */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function populate() {
    const sel = D.$('#pr_materiau');
    Object.keys(GC.pressure.MATERIAUX).forEach((k) => {
      sel.appendChild(D.el('option', { value: k, selected: k === 'PEHD (PE100)' ? 'selected' : null }, [k]));
    });
  }

  function compute() {
    const r = GC.pressure.conduite({
      Qls: D.num('pr_Qls'), D: D.num('pr_D'), L: D.num('pr_L'),
      materiau: D.val('pr_materiau'), e: D.num('pr_e'),
      sumXi: D.num('pr_sumXi'), Pservice: D.num('pr_Pservice'),
      fermeture: D.num('pr_fermeture')
    });
    const eco = GC.pressure.diametreEconomique(D.num('pr_Qls'), 1.5);

    let html = `<div class="result-head">${D.badge(r.statut === 'OK' ? 'OK' : (r.statut === 'NOK' ? 'NOK' : 'OK'))}<h4>Conduite ${r.materiau}</h4></div>`;
    html += '<h5>Écoulement &amp; pertes de charge</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Vitesse V', D.fmt(r.V, 2) + (r.vitesseOk ? ' ✓' : ' ⚠'), 'm/s'],
      ['Nombre de Reynolds', D.fmt(r.Re, 0), '—'],
      ['Facteur de friction f', D.fmt(r.f, 4), '—'],
      ['Perte de charge linéaire', D.fmt(r.Jlin, 2), 'm'],
      ['dont par km', D.fmt(r.JparKm, 2), 'm/km'],
      ['Pertes singulières', D.fmt(r.Jsing, 2), 'm'],
      ['<b>Perte de charge totale</b>', '<b>' + D.fmt(r.Htot, 2) + '</b>', 'm'],
      ['Ø économique suggéré (V≈1,5)', 'DN ' + eco.DN, 'mm']
    ]);
    html += '<h5>Coup de bélier &amp; tenue de la paroi</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Célérité de l’onde a', D.fmt(r.celerite, 0), 'm/s'],
      ['Temps critique 2L/a', D.fmt(r.tc, 2), 's'],
      ['Surpression (' + (r.fermetureBrusque ? 'brusque' : 'lente') + ')', D.fmt(r.surge, 1), 'm'],
      ['Pression de dimensionnement', D.fmt(r.Pdesign, 1), 'bar'],
      ['Contrainte de paroi σ', D.fmt(r.sigma, 1), 'MPa'],
      ['Contrainte admissible', D.fmt(r.sigmaAdm, 1) + (r.okParoi ? ' ✓' : ' ✗'), 'MPa']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#pr_res').innerHTML = html;
  }

  function init() {
    populate();
    D.$('#pr_calc').addEventListener('click', compute);
    D.$('#pr_materiau').addEventListener('change', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.pressure = { init, compute };
})();
