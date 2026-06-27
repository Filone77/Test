/* steel.ui.js — interface du module Charpente acier (EC3) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function populate() {
    const ps = D.$('#sa_profil');
    GC.profiles.FAMILIES.forEach((fam) => {
      const grp = D.el('optgroup', { label: fam });
      GC.profiles.list(fam).forEach((p) => {
        grp.appendChild(D.el('option', { value: p.nom, selected: p.nom === 'IPE 240' ? 'selected' : null }, [p.nom]));
      });
      ps.appendChild(grp);
    });
    const gs = D.$('#sa_nuance');
    Object.keys(GC.core.ACIERS_CONSTRUCTION).forEach((k) => {
      gs.appendChild(D.el('option', { value: k, selected: k === 'S235' ? 'selected' : null }, [k]));
    });
  }

  function showProps(p) {
    return D.table(['Caractéristique', 'Valeur', 'Unité'], [
      ['Hauteur h', D.fmt(p.h, 0), 'mm'],
      ['Largeur b', D.fmt(p.b, 0), 'mm'],
      ['Aire A', D.fmt(p.A, 1), 'cm²'],
      ['Inertie Iy', D.fmt(p.Iy, 0), 'cm⁴'],
      ['Module plastique Wpl,y', D.fmt(p.Wply, 0), 'cm³'],
      ['Inertie Iz', D.fmt(p.Iz, 0), 'cm⁴'],
      ['Rayon de giration iz', D.fmt(p.iz, 2), 'cm'],
      ['Masse', D.fmt(p.masse, 1), 'kg/m']
    ]);
  }

  function checkRow(c) {
    const labels = {
      traction: 'Traction Npl,Rd',
      compression: 'Compression Nb,Rd (flambement)',
      flexion: 'Flexion Mc,Rd',
      cisaillement: 'Cisaillement Vpl,Rd',
      'interaction N+M': 'Interaction N+M'
    };
    let detail = '';
    if (c.type === 'compression') detail = `λ̄=${D.fmt(c.lambdaBar, 2)}, χ=${D.fmt(c.chi, 2)} → ${D.fmt(c.NbRd, 0)} kN`;
    else if (c.type === 'traction') detail = `${D.fmt(c.NplRd, 0)} kN`;
    else if (c.type === 'flexion') detail = `${D.fmt(c.McRd, 1)} kN·m`;
    else if (c.type === 'cisaillement') detail = `${D.fmt(c.VplRd, 0)} kN`;
    else detail = '';
    const taux = c.taux != null ? c.taux : c.valeur;
    return [labels[c.type] || c.type, detail, taux != null ? D.fmt(taux * 100, 0) + ' %' : '—', D.badge(c.statut)];
  }

  function compute() {
    const profil = GC.profiles.get(D.val('sa_profil'));
    const fy = GC.core.ACIERS_CONSTRUCTION[D.val('sa_nuance')];
    const mode = D.val('sa_mode');
    const p = {
      profil, fy, mode,
      courbe: D.val('sa_courbe'),
      Lcr: D.num('sa_Lcr')
    };
    if (D.val('sa_NEd') !== '' && !isNaN(D.num('sa_NEd'))) p.NEd = D.num('sa_NEd');
    if (D.val('sa_MEd') !== '' && !isNaN(D.num('sa_MEd'))) p.MEd = D.num('sa_MEd');
    if (D.val('sa_VEd') !== '' && !isNaN(D.num('sa_VEd'))) p.VEd = D.num('sa_VEd');

    const res = GC.steel.verifier(p);
    let html = `<div class="result-head">${D.badge(res.statut)}<h4>${profil.nom} — ${D.val('sa_nuance')} (fy=${fy} MPa)</h4></div>`;
    html += `<p class="muted">Taux de travail maximal : <b>${D.fmt(res.tauxMax * 100, 0)} %</b></p>`;
    if (res.checks.length) {
      html += D.table(['Vérification', 'Résistance', 'Taux', 'Statut'], res.checks.map(checkRow));
    } else {
      html += '<p class="muted">Renseignez au moins un effort (NEd, MEd ou VEd).</p>';
    }
    html += '<h5>Caractéristiques du profilé</h5>' + showProps(profil);
    D.$('#sa_res').innerHTML = html;
  }

  function init() {
    populate();
    D.$('#sa_compute').addEventListener('click', compute);
    D.$('#sa_profil').addEventListener('change', compute);
    D.$('#sa_mode').addEventListener('change', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.steel = { init, compute };
})();
