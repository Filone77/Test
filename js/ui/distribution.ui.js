/* distribution.ui.js — interface Répartiteur passif de débit */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  const state = {
    outlets: [
      { nom: 'T1', Cd: 0.6, D: 200, z: 0 },
      { nom: 'T2', Cd: 0.6, D: 250, z: 0 },
      { nom: 'T3', Cd: 0.6, D: 200, z: 0.3 }
    ]
  };

  function mini(v, oninput, title, w) {
    return D.el('input', { type: typeof v === 'string' ? 'text' : 'number', step: 'any', value: v, class: 'mini', oninput, title, style: w ? 'width:' + w : null });
  }

  function render() {
    const c = D.$('#di_outlets'); D.clear(c);
    state.outlets.forEach((o, i) => {
      c.appendChild(D.el('div', { class: 'rowline wide' }, [
        mini(o.nom, (e) => { o.nom = e.target.value; }, 'nom', '70px'),
        mini(o.D, (e) => { o.D = parseFloat(e.target.value); }, 'Ø [mm]'),
        mini(o.Cd, (e) => { o.Cd = parseFloat(e.target.value); }, 'Cd', '64px'),
        mini(o.z, (e) => { o.z = parseFloat(e.target.value); }, 'niveau radier z [m]'),
        D.el('button', { class: 'mini-btn del', onclick: () => { state.outlets.splice(i, 1); render(); } }, ['✕'])
      ]));
    });
  }

  function compute() {
    const r = GC.distribution.repartition({ Qtotal: D.num('di_Qtotal'), outlets: state.outlets.slice() });
    let html = `<div class="result-head">${D.badge(r.ok ? 'OK' : 'NOK')}<h4>Répartition du débit</h4></div>`;
    html += `<p class="muted">Niveau d’eau d’équilibre dans l’ouvrage : <b>${D.fmt(r.niveau, 3)} m</b> · Σ sorties = ${D.fmt(r.equilibre, 1)} L/s</p>`;
    html += D.table(['Sortie', 'Ø [mm]', 'Radier z [m]', 'Charge [m]', 'Débit [L/s]', '% du total'],
      r.detail.map((d) => [d.nom, D.fmt(d.D, 0), D.fmt(d.z, 2), D.fmt(d.charge, 2), '<b>' + D.fmt(d.Q, 1) + '</b>', D.fmt(d.pourcentage, 1) + ' %' + (d.actif ? '' : ' (inactif)')]));
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#di_res').innerHTML = html;
  }

  function init() {
    render();
    D.$('#di_add').addEventListener('click', () => { state.outlets.push({ nom: 'T' + (state.outlets.length + 1), Cd: 0.6, D: 200, z: 0 }); render(); });
    D.$('#di_calc').addEventListener('click', compute);
    compute();
  }
  GC.modules = GC.modules || {};
  GC.modules.distribution = { init, compute };
})();
