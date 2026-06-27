/* combos.ui.js — interface Combinaisons d'actions (EN 1990) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  const state = {
    variables: [
      { nom: 'Q', Q: 50, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
      { nom: 'Neige', Q: 20, psi0: 0.5, psi1: 0.2, psi2: 0.0 }
    ]
  };

  function mini(value, oninput, title, w) {
    return D.el('input', { type: value === '' ? 'text' : 'number', step: 'any', value, class: 'mini', oninput, title, style: w ? 'width:' + w : null });
  }

  function render() {
    const c = D.$('#cb_vars'); D.clear(c);
    state.variables.forEach((v, i) => {
      c.appendChild(D.el('div', { class: 'rowline wide' }, [
        D.el('input', { type: 'text', value: v.nom, class: 'mini', style: 'width:90px', oninput: (e) => { v.nom = e.target.value; }, title: 'nom' }),
        mini(v.Q, (e) => { v.Q = parseFloat(e.target.value); }, 'valeur Qk'),
        mini(v.psi0, (e) => { v.psi0 = parseFloat(e.target.value); }, 'ψ0', '64px'),
        mini(v.psi1, (e) => { v.psi1 = parseFloat(e.target.value); }, 'ψ1', '64px'),
        mini(v.psi2, (e) => { v.psi2 = parseFloat(e.target.value); }, 'ψ2', '64px'),
        D.el('button', { class: 'mini-btn del', onclick: () => { state.variables.splice(i, 1); render(); } }, ['✕'])
      ]));
    });
  }

  function compute() {
    const r = GC.combos.combinaisons({ G: D.num('cb_G'), variables: state.variables });
    let html = '<div class="result-head"><span class="badge badge-ok">EN 1990</span><h4>Combinaisons d’actions</h4></div>';
    html += '<div class="kpis">' +
      kpi('ELU (fond.)', D.fmt(r.eluMax.valeur, 1), '', r.eluMax.nom) +
      kpi('ELS caract.', D.fmt(r.elsCMax.valeur, 1), '', r.elsCMax.nom) +
      (r.elsFMax ? kpi('ELS fréq.', D.fmt(r.elsFMax.valeur, 1), '', r.elsFMax.nom) : '') +
      kpi('ELS quasi-perm.', D.fmt(r.elsQMax.valeur, 1), '', r.elsQMax.nom) +
      '</div>';
    html += '<h5>ELU fondamentales</h5>' + D.table(['Combinaison', 'Valeur'], r.elu.map((c) => [c.nom, '<b>' + D.fmt(c.valeur, 1) + '</b>']));
    html += '<h5>ELS caractéristiques</h5>' + D.table(['Combinaison', 'Valeur'], r.elsC.map((c) => [c.nom, D.fmt(c.valeur, 1)]));
    if (r.elsF.length) html += '<h5>ELS fréquentes</h5>' + D.table(['Combinaison', 'Valeur'], r.elsF.map((c) => [c.nom, D.fmt(c.valeur, 1)]));
    html += '<h5>ELS quasi-permanente</h5>' + D.table(['Combinaison', 'Valeur'], r.elsQ.map((c) => [c.nom, D.fmt(c.valeur, 1)]));
    D.$('#cb_res').innerHTML = html;
  }

  function kpi(label, val, unit, sub) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-val">${val} <small>${unit}</small></div><div class="kpi-sub" style="font-size:0.66rem">${sub}</div></div>`;
  }

  function init() {
    render();
    // remplir le sélecteur de catégorie ψ
    const sel = D.$('#cb_preset');
    Object.keys(GC.combos.PSI).forEach((k) => sel.appendChild(D.el('option', { value: k }, [k])));
    D.$('#cb_add').addEventListener('click', () => {
      const k = D.val('cb_preset');
      const ps = GC.combos.PSI[k] || { psi0: 0.7, psi1: 0.5, psi2: 0.3 };
      state.variables.push({ nom: k.split(' ')[0], Q: 30, psi0: ps.psi0, psi1: ps.psi1, psi2: ps.psi2 });
      render();
    });
    D.$('#cb_calc').addEventListener('click', compute);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.combos = { init, compute };
})();
