/* ============================================================================
 * HydroCalc — Application (état, recalcul en cascade, navigation, I/O)
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro;
  var ui = Hydro.ui, el = ui.el;
  var modules = Hydro.modules;
  var byId = {};
  modules.forEach(function (m) { byId[m.id] = m; });

  var LS_KEY = 'hydrocalc.state.v1';

  var state = {
    projet: 'Projet hydraulique',
    values: {},   // values[moduleId][key] = valeur saisie
    edited: {},   // edited[moduleId][key] = true si modifié manuellement (champs liés)
    grids: {},    // grids[moduleId] = lignes de la grille éditable
    current: 'fluide'
  };
  var store = {};            // valeurs partagées publiées par les modules
  var results = {};          // résultats calculés par module
  Hydro.results = results;

  /* --- Initialisation de l'état -------------------------------------------- */
  function initState() {
    modules.forEach(function (m) {
      state.values[m.id] = state.values[m.id] || {};
      state.edited[m.id] = state.edited[m.id] || {};
      (m.inputs || []).forEach(function (inp) {
        if (!inp.link && state.values[m.id][inp.key] == null) {
          state.values[m.id][inp.key] = inp.default;
        }
      });
      if (m.grid && !state.grids[m.id]) {
        state.grids[m.id] = m.grid.rows.map(function (r) {
          var c = {}; for (var k in r) c[k] = r[k]; return c;
        });
      }
    });
  }

  /* --- Résolution des entrées d'un module (gère les liens) ----------------- */
  function resolveInputs(m) {
    var v = {}, id = m.id;
    (m.inputs || []).forEach(function (inp) {
      var k = inp.key;
      if (inp.link) {
        if (state.edited[id][k] && state.values[id][k] != null) v[k] = num(state.values[id][k]);
        else if (store[inp.link] != null) v[k] = store[inp.link];
        else v[k] = num(state.values[id][k] != null ? state.values[id][k] : inp.default);
      } else {
        var raw = state.values[id][k];
        v[k] = (raw != null) ? raw : inp.default;
        if (inp.type !== 'select') v[k] = num(v[k]);
      }
    });
    if (m.grid) v[m.grid.key] = state.grids[id];
    return v;
  }

  function num(x) { var n = parseFloat(x); return isFinite(n) ? n : (x === 0 ? 0 : x); }

  /** Valeur affichée dans un champ : 6 chiffres significatifs (supprime le
   *  bruit en virgule flottante des valeurs liées sans nuire à la précision,
   *  le calcul utilisant toujours la valeur partagée à pleine précision). */
  function toInputValue(v) {
    if (typeof v !== 'number') return v == null ? '' : v;
    if (!isFinite(v) || v === 0) return v === 0 ? 0 : '';
    return parseFloat(v.toPrecision(6));
  }

  /* --- Recalcul en cascade (ordre de dépendance) --------------------------- */
  function recomputeAll() {
    store = {};
    Hydro.store = store;
    Hydro.moduleOrder.forEach(function (id) {
      var m = byId[id];
      if (!m.compute) return;
      var v = resolveInputs(m);
      var out;
      try { out = m.compute(v, store); }
      catch (e) { out = { results: [{ label: 'Erreur de calcul', value: String(e.message || e) }] }; }
      results[id] = out || {};
      if (out && out.publish) for (var k in out.publish) store[k] = out.publish[k];
    });
    saveLocal();
  }

  /* --- Persistance locale -------------------------------------------------- */
  function saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        projet: state.projet, values: state.values, edited: state.edited,
        grids: state.grids, current: state.current
      }));
    } catch (e) { /* quota / mode privé : on ignore */ }
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.projet) state.projet = d.projet;
      if (d.values) state.values = d.values;
      if (d.edited) state.edited = d.edited;
      if (d.grids) state.grids = d.grids;
      if (d.current && byId[d.current]) state.current = d.current;
    } catch (e) { /* données corrompues : on repart des défauts */ }
  }

  /* =========================================================================
   * RENDU
   * =======================================================================*/
  var $nav, $content, $title;

  function renderNav() {
    $nav.innerHTML = '';
    var groups = [];
    modules.forEach(function (m) {
      var g = groups.filter(function (x) { return x.name === m.group; })[0];
      if (!g) { g = { name: m.group, items: [] }; groups.push(g); }
      g.items.push(m);
    });
    groups.forEach(function (g) {
      $nav.appendChild(el('div', { class: 'nav-group' }, g.name));
      g.items.forEach(function (m) {
        var item = el('button', {
          class: 'nav-item' + (m.id === state.current ? ' is-active' : ''),
          onClick: function () { go(m.id); }
        }, [el('span', { class: 'nav-icon' }, m.icon), el('span', null, m.title)]);
        $nav.appendChild(item);
      });
    });
  }

  function go(id) {
    state.current = id;
    saveLocal();
    renderNav();
    renderModule();
    $content.scrollTop = 0;
  }

  function renderModule() {
    recomputeAll();
    var m = byId[state.current];
    $content.innerHTML = '';

    var header = el('div', { class: 'module-header' }, [
      el('div', { class: 'module-titleline' }, [
        el('span', { class: 'module-icon' }, m.icon),
        el('h2', null, m.title)
      ]),
      m.intro ? el('p', { class: 'module-intro' }, m.intro) : null
    ]);
    $content.appendChild(header);

    if (m.render) {
      var ctx = m._ctx || (m._ctx = {});
      ctx.store = store;
      $content.appendChild(m.render(ctx));
      return;
    }

    var hasLinks = (m.inputs || []).some(function (i) { return i.link; });

    // Panneau des entrées
    var fields = el('div', { class: 'fields' });
    var resolved = resolveInputs(m);
    (m.inputs || []).forEach(function (inp) {
      var v = (inp.type === 'select') ? resolved[inp.key] : toInputValue(resolved[inp.key]);
      fields.appendChild(ui.field(inp, v, {
        onInput: function (e) {
          var raw = e.target.value;
          state.values[m.id][inp.key] = (inp.type === 'select') ? raw : raw;
          if (inp.link) state.edited[m.id][inp.key] = true;
          refreshResults(m);
        }
      }));
    });

    var gridEl = null;
    if (m.grid) {
      gridEl = ui.editableGrid(m.grid.columns, state.grids[m.id], function (ri, key, val) {
        state.grids[m.id][ri][key] = val;
        refreshResults(m);
      });
    }

    var inputCol = el('div', { class: 'col-input no-print' }, [
      el('div', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [
          el('span', null, 'Données d\'entrée'),
          hasLinks ? el('button', { class: 'btn btn--ghost btn--sm',
            title: 'Recharger les valeurs liées depuis les modules amont',
            onClick: function () { resync(m); } }, '↻ Resync. liens') : null
        ]),
        fields,
        gridEl ? el('div', { class: 'grid-wrap' }, gridEl) : null
      ])
    ]);

    var resultCol = el('div', { class: 'col-result' }, [
      el('div', { class: 'panel panel--result', id: 'result-panel' })
    ]);

    $content.appendChild(el('div', { class: 'module-grid' }, [inputCol, resultCol]));
    refreshResults(m);
  }

  function resync(m) {
    (m.inputs || []).forEach(function (inp) {
      if (inp.link) state.edited[m.id][inp.key] = false;
    });
    renderModule();
  }

  function refreshResults(m) {
    recomputeAll();
    var panel = document.getElementById('result-panel');
    if (!panel) return;
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'panel-head' }, 'Résultats'));

    var out = results[m.id] || {};
    (out.results || []).forEach(function (r) { panel.appendChild(ui.resultRow(r)); });

    if (out.chart) {
      panel.appendChild(ui.chartXY(out.chart.series, out.chart.opts));
      if (out.chart.legend) {
        panel.appendChild(el('div', { class: 'legend' }, out.chart.legend.map(function (l) {
          return el('span', { class: 'legend-item' }, [
            el('span', { class: 'legend-swatch', style: 'background:' + l.color }), l.label
          ]);
        })));
      }
    }
    (out.tables || []).forEach(function (t) {
      panel.appendChild(el('div', { class: 'table-wrap' }, ui.table(t)));
    });
    (out.notes || []).forEach(function (n) {
      panel.appendChild(el('div', { class: 'note' }, n));
    });
  }

  /* =========================================================================
   * BARRE D'OUTILS : sauvegarde / chargement / impression / réinitialisation
   * =======================================================================*/
  function exportJSON() {
    var data = { app: 'HydroCalc', projet: state.projet, date: new Date().toISOString(),
                 values: state.values, edited: state.edited, grids: state.grids };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: (state.projet || 'projet') + '.hydro.json' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (d.values) state.values = d.values;
        if (d.edited) state.edited = d.edited;
        if (d.grids) state.grids = d.grids;
        if (d.projet) { state.projet = d.projet; document.getElementById('projet-name').value = d.projet; }
        initState();
        renderModule();
        toast('Projet chargé');
      } catch (e) { toast('Fichier invalide'); }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm('Réinitialiser toutes les données saisies aux valeurs par défaut ?')) return;
    state.values = {}; state.edited = {}; state.grids = {};
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    initState();
    renderModule();
    toast('Valeurs réinitialisées');
  }

  function toast(msg) {
    var t = el('div', { class: 'toast' }, msg);
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 1800);
  }

  /* =========================================================================
   * AMORÇAGE
   * =======================================================================*/
  function build() {
    var app = document.getElementById('app');

    var topbar = el('header', { class: 'topbar no-print' }, [
      el('div', { class: 'brand' }, [
        el('span', { class: 'brand-mark' }, '◉'),
        el('span', null, 'HydroCalc'),
        el('span', { class: 'brand-sub' }, 'Boîte à outils hydraulique')
      ]),
      el('div', { class: 'topbar-actions' }, [
        el('input', { id: 'projet-name', class: 'projet-input', value: state.projet,
          title: 'Nom du projet',
          onInput: function (e) { state.projet = e.target.value; saveLocal(); } }),
        el('button', { class: 'btn', onClick: exportJSON, title: 'Enregistrer le projet (.json)' }, '💾 Enregistrer'),
        el('label', { class: 'btn', title: 'Charger un projet (.json)' }, [
          '📂 Charger',
          el('input', { type: 'file', accept: '.json,application/json', style: 'display:none',
            onChange: function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; } })
        ]),
        el('button', { class: 'btn', onClick: function () { window.print(); }, title: 'Imprimer / exporter en PDF' }, '🖨️ Imprimer'),
        el('button', { class: 'btn btn--ghost', onClick: resetAll, title: 'Réinitialiser' }, '↺')
      ])
    ]);

    $nav = el('nav', { class: 'sidebar no-print' });
    $title = el('div');
    $content = el('main', { class: 'content', id: 'content' });

    app.appendChild(topbar);
    app.appendChild(el('div', { class: 'layout' }, [$nav, $content]));

    renderNav();
    renderModule();
  }

  function start() {
    loadLocal();
    initState();
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof window !== 'undefined' ? window : this);
