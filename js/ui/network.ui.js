/* network.ui.js — interface Réseau gravitaire / Profil en long */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  const state = {
    regards: [
      { nom: 'R1', PM: 0, TN: 100.0, DN: 300, DE: 345, Q: 30, pente: 0.005, K: 80, chute: 0 },
      { nom: 'R2', PM: 50, TN: 99.5, DN: 300, DE: 345, Q: 45, pente: 0.004, K: 80, chute: 0 },
      { nom: 'R3', PM: 100, TN: 99.2, DN: 400, DE: 450, Q: 60, pente: 0.004, K: 80, chute: 0 },
      { nom: 'R4', PM: 160, TN: 98.7, chute: 0 }
    ],
    hgl: null
  };

  function mini(v, oninput, title, w) {
    return D.el('input', { type: typeof v === 'string' ? 'text' : 'number', step: 'any', value: v == null ? '' : v, class: 'mini', oninput, title, style: 'width:' + (w || '64px') });
  }

  function render() {
    const c = D.$('#nw_regards'); D.clear(c);
    c.appendChild(D.el('div', { class: 'rowline wide', style: 'font-size:0.72rem;color:#61708a;font-weight:600' }, [
      D.el('span', { style: 'width:70px' }, ['Regard']), D.el('span', { style: 'width:64px' }, ['PM']),
      D.el('span', { style: 'width:64px' }, ['TN']), D.el('span', { style: 'width:64px' }, ['DN']),
      D.el('span', { style: 'width:64px' }, ['DE']), D.el('span', { style: 'width:64px' }, ['Q L/s']),
      D.el('span', { style: 'width:64px' }, ['pente']), D.el('span', { style: 'width:64px' }, ['K']),
      D.el('span', { style: 'width:64px' }, ['chute']), D.el('span', {}, [''])
    ]));
    state.regards.forEach((r, i) => {
      const dernier = i === state.regards.length - 1;
      c.appendChild(D.el('div', { class: 'rowline wide' }, [
        mini(r.nom, (e) => { r.nom = e.target.value; }, 'nom', '70px'),
        mini(r.PM, (e) => { r.PM = parseFloat(e.target.value); }, 'PM [m]'),
        mini(r.TN, (e) => { r.TN = parseFloat(e.target.value); }, 'terrain [m]'),
        mini(dernier ? '' : r.DN, (e) => { r.DN = parseFloat(e.target.value); }, 'DN [mm]'),
        mini(dernier ? '' : r.DE, (e) => { r.DE = parseFloat(e.target.value); }, 'DE [mm]'),
        mini(dernier ? '' : r.Q, (e) => { r.Q = parseFloat(e.target.value); }, 'débit [L/s]'),
        mini(dernier ? '' : r.pente, (e) => { r.pente = parseFloat(e.target.value); }, 'pente [m/m]'),
        mini(dernier ? '' : r.K, (e) => { r.K = parseFloat(e.target.value); }, 'Strickler'),
        mini(r.chute || 0, (e) => { r.chute = parseFloat(e.target.value); }, 'chute [m]'),
        D.el('button', { class: 'mini-btn del', onclick: () => { if (state.regards.length > 2) { state.regards.splice(i, 1); render(); } } }, ['✕'])
      ]));
    });
  }

  function modele() {
    return {
      noeuds: state.regards.map((r) => ({ nom: r.nom, PM: r.PM, TN: r.TN, chute: r.chute || 0 })),
      troncons: state.regards.slice(0, -1).map((r) => ({ DN: r.DN, DE: r.DE, K: r.K, Q: r.Q, pente: r.pente })),
      filEauDepart: D.num('nw_fileau'), eLit: D.num('nw_elit')
    };
  }

  function compute() {
    let res;
    try { res = GC.network.profil(modele()); }
    catch (e) { D.$('#nw_res').innerHTML = `<p class="error">${e.message}</p>`; return; }

    let html = `<div class="result-head">${D.badge(res.statut)}<h4>Cotes des regards${res.aChutes ? ' (avec décrochements)' : ''}</h4></div>`;
    html += D.table(['Regard', 'PM', 'TN', 'Fil d’eau', 'Chute', 'Gén. sup.', 'Fond fouille', 'Couv.', 'H fouille'],
      res.noeuds.map((n) => [n.nom, D.fmt(n.PM, 0), D.fmt(n.TN, 2), D.fmt(n.filEau, 2),
        n.chute > 0.001 ? D.fmt(n.chute, 2) : '—', D.fmt(n.crown, 2),
        D.fmt(n.fondFouille, 2), D.fmt(n.couverture, 2) + (n.couvertureOk ? '' : ' ⚠'), D.fmt(n.hauteurFouille, 2)]));
    html += '<h5>Hydraulique des tronçons</h5>';
    html += D.table(['Tronçon', 'L [m]', 'Pente ‰', 'DN', 'Q L/s', 'V m/s', 'Rempl.', 'Statut'],
      res.troncons.map((t) => [t.de + '→' + t.vers, D.fmt(t.longueur, 0), D.fmt(t.penteMm, 1), t.DN, D.fmt(t.Q, 0),
        t.enCharge ? 'en charge' : D.fmt(t.V, 2), t.enCharge ? '100 %' : D.fmt(t.remplissage, 0) + ' %', D.badge(t.statut)]));
    if (state.hgl) {
      html += `<h5>Mise en charge (ligne piézométrique)</h5>`;
      html += `<p class="muted">${D.badge(state.hgl.statut === 'OK' ? 'OK' : 'NOK')} ${state.hgl.miseEnCharge ? 'Réseau en charge' : 'Écoulement à surface libre'}${state.hgl.debordement ? ' — débordement détecté !' : ''}</p>`;
      html += D.table(['Regard', 'TN', 'Gén. sup.', 'Ligne piézo.', 'État'],
        state.hgl.noeuds.map((n) => [n.nom, D.fmt(n.TN, 2), D.fmt(n.crown, 2), D.fmt(n.HGL, 2),
          n.debordement ? '⚠ débordement' : (n.enCharge ? 'en charge' : 'libre')]));
    }
    html += '<div id="nw_plot" class="plotbox"></div>';
    const msgs = [].concat.apply([], res.troncons.map((t) => t.messages));
    if (msgs.length) html += '<ul class="notes">' + Array.from(new Set(msgs)).map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#nw_res').innerHTML = html;
    GC.plot.profilLong(D.$('#nw_plot'), res.noeuds, state.hgl ? { hgl: state.hgl.noeuds } : {});
  }

  function optimiser() {
    const m = modele();
    const opt = GC.network.optimiser({ noeuds: m.noeuds, troncons: m.troncons, couvertureMin: 0.8, penteMin: 0.003, penteMax: 0.05 });
    D.$('#nw_fileau').value = opt.filEauDepart;
    state.regards.forEach((r, i) => {
      if (i < state.regards.length - 1) r.pente = opt.pentes[i];
      r.chute = opt.chutes[i];
    });
    state.hgl = null;
    render();
    compute();
  }

  function miseEnCharge() {
    state.hgl = GC.network.ligneCharge(modele(), D.val('nw_aval') ? D.num('nw_aval') : null);
    compute();
  }

  function init() {
    render();
    D.$('#nw_add').addEventListener('click', () => {
      const last = state.regards[state.regards.length - 1];
      const prev = state.regards[state.regards.length - 2] || {};
      last.DN = prev.DN || 300; last.DE = prev.DE || 345; last.Q = (prev.Q || 30) + 15; last.pente = prev.pente || 0.004; last.K = prev.K || 80;
      state.regards.push({ nom: 'R' + (state.regards.length + 1), PM: last.PM + 50, TN: last.TN - 0.3, chute: 0 });
      render();
    });
    D.$('#nw_calc').addEventListener('click', () => { state.hgl = null; compute(); });
    D.$('#nw_optim').addEventListener('click', optimiser);
    D.$('#nw_charge').addEventListener('click', miseEnCharge);
    compute();
  }

  GC.modules = GC.modules || {};
  GC.modules.network = { init, compute };
})();
