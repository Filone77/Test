/* structures.ui.js — interface du module Analyse de structures (RDM) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  const state = {
    supports: [{ x: 0, type: 'appui' }, { x: 6, type: 'appui' }],
    pointLoads: [],
    distLoads: [{ x1: 0, x2: 6, w: 15 }]
  };

  function inputCell(value, onInput, attrs) {
    return GC.dom.el('input', Object.assign({ type: 'number', step: 'any', value, class: 'mini', oninput: onInput }, attrs || {}));
  }

  function renderLists() {
    // Appuis
    const sc = D.$('#st_supports'); D.clear(sc);
    state.supports.forEach((s, i) => {
      const sel = D.el('select', { class: 'mini', onchange: (e) => { s.type = e.target.value; } },
        ['appui', 'encastrement', 'libre'].map((t) =>
          D.el('option', { value: t, selected: t === s.type ? 'selected' : null }, [t])));
      const row = D.el('div', { class: 'rowline' }, [
        D.el('span', { class: 'tag' }, ['Appui ' + (i + 1)]),
        inputCell(s.x, (e) => { s.x = parseFloat(e.target.value); }, { title: 'position x [m]' }),
        sel,
        D.el('button', { class: 'mini-btn del', onclick: () => { state.supports.splice(i, 1); renderLists(); } }, ['✕'])
      ]);
      sc.appendChild(row);
    });

    // Charges ponctuelles
    const pc = D.$('#st_points'); D.clear(pc);
    state.pointLoads.forEach((p, i) => {
      pc.appendChild(D.el('div', { class: 'rowline' }, [
        D.el('span', { class: 'tag' }, ['P' + (i + 1)]),
        inputCell(p.x, (e) => { p.x = parseFloat(e.target.value); }, { title: 'x [m]' }),
        inputCell(p.P, (e) => { p.P = parseFloat(e.target.value); }, { title: 'P [kN]' }),
        D.el('button', { class: 'mini-btn del', onclick: () => { state.pointLoads.splice(i, 1); renderLists(); } }, ['✕'])
      ]));
    });

    // Charges réparties
    const dc = D.$('#st_dist'); D.clear(dc);
    state.distLoads.forEach((d, i) => {
      dc.appendChild(D.el('div', { class: 'rowline' }, [
        D.el('span', { class: 'tag' }, ['q' + (i + 1)]),
        inputCell(d.x1, (e) => { d.x1 = parseFloat(e.target.value); }, { title: 'début x1 [m]' }),
        inputCell(d.x2, (e) => { d.x2 = parseFloat(e.target.value); }, { title: 'fin x2 [m]' }),
        inputCell(d.w, (e) => { d.w = parseFloat(e.target.value); }, { title: 'w [kN/m]' }),
        D.el('button', { class: 'mini-btn del', onclick: () => { state.distLoads.splice(i, 1); renderLists(); } }, ['✕'])
      ]));
    });
  }

  function solve() {
    const EI = D.num('st_EI');
    const model = {
      supports: state.supports.map((s) => ({ x: s.x, type: s.type })),
      pointLoads: state.pointLoads.slice(),
      distLoads: state.distLoads.slice(),
      EI: EI,
      nSub: 16
    };
    let res;
    try {
      res = GC.beam.solveBeam(model);
    } catch (err) {
      D.$('#st_res').innerHTML = `<p class="error">Erreur de calcul : ${err.message}. Vérifiez les appuis (au moins 2 blocages).</p>`;
      return;
    }

    let html = '<div class="result-head"><h4>Réactions d’appui</h4></div>';
    html += D.table(['Appui', 'Position', 'Réaction V [kN]', 'Moment [kN·m]'],
      res.reactions.map((r, i) => [
        'A' + (i + 1) + ' (' + r.type + ')', D.fmt(r.x, 2) + ' m',
        D.fmt(r.Rv, 2), r.Rm != null ? D.fmt(r.Rm, 2) : '—'
      ]));
    html += '<div class="kpis">' +
      kpi('M max', D.fmt(res.Mmax.val, 1), 'kN·m', 'à ' + D.fmt(res.Mmax.x, 2) + ' m') +
      kpi('M min', D.fmt(res.Mmin.val, 1), 'kN·m', 'à ' + D.fmt(res.Mmin.x, 2) + ' m') +
      kpi('V max', D.fmt(res.Vmax.val, 1), 'kN', 'à ' + D.fmt(res.Vmax.x, 2) + ' m') +
      kpi('Flèche max', D.fmt(res.flecheMax.val, 2), 'mm', 'à ' + D.fmt(res.flecheMax.x, 2) + ' m') +
      '</div>';
    html += `<p class="muted">Équilibre vertical : ΣP = ${D.fmt(res.equilibre.sumLoads, 1)} kN, ΣR = ${D.fmt(res.equilibre.sumReac, 1)} kN ${res.equilibre.ok ? '✓' : '⚠'}</p>`;
    html += '<div id="st_schema" class="plotbox"></div>';
    html += '<div id="st_V" class="plotbox"></div>';
    html += '<div id="st_M" class="plotbox"></div>';
    html += '<div id="st_f" class="plotbox"></div>';
    D.$('#st_res').innerHTML = html;

    GC.plot.beamSchematic(D.$('#st_schema'), model);
    GC.plot.diagram(D.$('#st_V'), res.diagram, { yKey: 'V', color: '#2e7d32', fill: 'rgba(46,125,50,0.12)', title: 'Effort tranchant V(x)', unit: 'kN' });
    GC.plot.diagram(D.$('#st_M'), res.diagram, { yKey: 'M', color: '#1b3a5b', fill: 'rgba(27,58,91,0.12)', title: 'Moment fléchissant M(x)', unit: 'kN·m', invert: true });
    GC.plot.diagram(D.$('#st_f'), res.diagram.map((d) => ({ x: d.x, v: d.v * 1000 })), { yKey: 'v', color: '#e08a1e', fill: 'rgba(224,138,30,0.12)', title: 'Déformée (flèche)', unit: 'mm', invert: true });
  }

  function kpi(label, val, unit, sub) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-val">${val} <small>${unit}</small></div><div class="kpi-sub">${sub}</div></div>`;
  }

  function init() {
    renderLists();
    D.$('#st_add_support').addEventListener('click', () => {
      const lastX = state.supports.length ? state.supports[state.supports.length - 1].x + 3 : 0;
      state.supports.push({ x: lastX, type: 'appui' }); renderLists();
    });
    D.$('#st_add_point').addEventListener('click', () => {
      state.pointLoads.push({ x: 3, P: 20 }); renderLists();
    });
    D.$('#st_add_dist').addEventListener('click', () => {
      state.distLoads.push({ x1: 0, x2: 6, w: 10 }); renderLists();
    });
    D.$('#st_solve').addEventListener('click', solve);
    solve();
  }

  GC.modules = GC.modules || {};
  GC.modules.structures = { init, solve };
})();
