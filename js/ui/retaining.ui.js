/* retaining.ui.js — interface Soutènement / Ouvrages enterrés (mur en T) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function fsBadge(ok) { return `<span class="badge ${ok ? 'badge-ok' : 'badge-nok'}">${ok ? '✓ OK' : '✗ NOK'}</span>`; }

  function compute() {
    const r = GC.retaining.murEnT({
      Hs: D.num('rt_Hs'), ef: D.num('rt_ef'), eVoile: D.num('rt_eVoile'),
      patin: D.num('rt_patin'), talon: D.num('rt_talon'),
      gamma: D.num('rt_gamma'), phi: D.num('rt_phi'), delta: D.num('rt_delta'),
      q: D.num('rt_q'), sigmaAdm: D.num('rt_sigmaAdm'),
      fck: D.num('rt_fck'), fyk: D.num('rt_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Mur de soutènement en T (B = ${D.fmt(r.geometrie.B, 2)} m)</h4></div>`;

    html += '<h5>Poussée des terres</h5>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Coefficient Ka', D.fmt(r.poussee.Ka, 3), '—'],
      ['Poussée horizontale Ph', D.fmt(r.poussee.Ph, 1), 'kN/ml'],
      ['Bras de levier / base', D.fmt(r.poussee.zPh, 2), 'm'],
      ['Charge verticale totale ΣV', D.fmt(r.SV, 1), 'kN/ml']
    ]);

    html += '<h5>Stabilité externe</h5>';
    html += D.table(['Vérification', 'Valeur', 'Exigence', 'Statut'], [
      ['Renversement (FS)', D.fmt(r.renversement.FS, 2), '≥ 1,5', fsBadge(r.renversement.ok)],
      ['Glissement (FS, δ=' + D.fmt(r.glissement.delta, 0) + '°)', D.fmt(r.glissement.FS, 2), '≥ 1,5', fsBadge(r.glissement.ok)],
      ['σ max sous semelle', D.fmt(r.poinconnement.sigMax, 1) + ' kPa', '≤ ' + r.poinconnement.sigAdm + ' kPa', fsBadge(r.poinconnement.ok)]
    ]);
    html += `<p class="muted">Excentricité e = ${D.fmt(r.poinconnement.e, 3)} m · diagramme ${r.poinconnement.repartition} · σ min = ${D.fmt(r.poinconnement.sigMin, 1)} kPa</p>`;

    html += '<h5>Ferraillage (ELU)</h5>';
    html += D.table(['Élément', 'Moment', 'As', 'Disposition'], [
      ['Voile (pied)', D.fmt(r.ferraillage.voile.M, 1) + ' kN·m', D.fmt(r.ferraillage.voile.As, 0) + ' mm²/m',
        r.ferraillage.voile.choix && r.ferraillage.voile.choix[1] ? `Ø${r.ferraillage.voile.choix[1].phi}/${D.fmt(r.ferraillage.voile.choix[1].s, 0)}mm` : '—'],
      ['Talon', D.fmt(r.ferraillage.talon.M, 1) + ' kN·m', D.fmt(r.ferraillage.talon.As, 0) + ' mm²/m',
        r.ferraillage.talon.choix && r.ferraillage.talon.choix[1] ? `Ø${r.ferraillage.talon.choix[1].phi}/${D.fmt(r.ferraillage.talon.choix[1].s, 0)}mm` : '—']
    ]);

    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#rt_res').innerHTML = html;
  }

  function init() {
    D.$('#rt_calc').addEventListener('click', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.retaining = { init, compute };
})();
