/* ============================================================================
 * HydroCalc — Application (état, recalcul en cascade, navigation, I/O)
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro;
  var ui = Hydro.ui, el = ui.el;
  function T(s) { return (Hydro.i18n && typeof s === 'string') ? Hydro.i18n.t(s) : s; }
  var modules = Hydro.modules;
  var byId = {};

  // Ordre canonique (navigation ET cascade de calcul) — inclut les modules
  // de base et les modules d'extension.
  var ORDER = [
    'fluide', 'conduite', 'singulieres', 'multitroncons',
    'pompage', 'pointfonct', 'pompesmultiples', 'bache', 'belier', 'ballon', 'energie',
    'reseaumaille',
    'surfacelibre', 'rationnelle', 'pluies', 'bassin', 'orifices',
    'conversions', 'scenarios', 'references', 'recap'
  ];

  /** (Re)trie les modules selon ORDER et reconstruit l'index + l'ordre de calcul. */
  function indexModules() {
    modules.sort(function (a, b) {
      var ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    byId = {};
    modules.forEach(function (m) { byId[m.id] = m; });
    Hydro.moduleOrder = modules.map(function (m) { return m.id; });
  }
  indexModules();

  var LS_KEY = 'hydrocalc.state.v1';

  var state = {
    projet: 'Projet hydraulique',
    values: {},   // values[moduleId][key] = valeur saisie
    edited: {},   // edited[moduleId][key] = true si modifié manuellement (champs liés)
    grids: {},    // grids[moduleId] = lignes de la grille éditable
    current: 'fluide',
    lang: 'fr',
    theme: 'clair',
    search: ''
  };
  Hydro.getState = function () { return state; };
  Hydro.getStore = function () { return store; };
  Hydro.getResults = function () { return results; };
  Hydro.refresh = function () { renderNav(); renderModule(); };
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
        grids: state.grids, current: state.current, lang: state.lang, theme: state.theme
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
      if (d.lang) state.lang = d.lang;
      if (d.theme) state.theme = d.theme;
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
    var filter = (state.search || '').toLowerCase();
    groups.forEach(function (g) {
      var items = g.items.filter(function (m) {
        return !filter || T(m.title).toLowerCase().indexOf(filter) >= 0
                       || m.title.toLowerCase().indexOf(filter) >= 0;
      });
      if (!items.length) return;
      $nav.appendChild(el('div', { class: 'nav-group' }, T(g.name)));
      items.forEach(function (m) {
        var item = el('button', {
          class: 'nav-item' + (m.id === state.current ? ' is-active' : ''),
          onClick: function () { go(m.id); }
        }, [el('span', { class: 'nav-icon' }, m.icon), el('span', null, T(m.title))]);
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
        el('h2', null, T(m.title))
      ]),
      m.intro ? el('p', { class: 'module-intro' }, T(m.intro)) : null
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
          state.values[m.id][inp.key] = raw;
          if (inp.link) state.edited[m.id][inp.key] = true;
          if (inp.onPick) {
            inp.onPick(raw, state.values[m.id], function (key, val) {
              state.values[m.id][key] = val;
            });
            renderModule(); // certains champs ont été auto-remplis
            return;
          }
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
          el('span', null, T('Données d\'entrée')),
          hasLinks ? el('button', { class: 'btn btn--ghost btn--sm',
            title: T('Recharger les valeurs liées depuis les modules amont'),
            onClick: function () { resync(m); } }, T('↻ Resync. liens')) : null
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
    panel.appendChild(el('div', { class: 'panel-head' }, T('Résultats')));

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
      panel.appendChild(el('div', { class: 'note' }, T(n)));
    });
  }

  /* =========================================================================
   * BARRE D'OUTILS : sauvegarde / chargement / impression / réinitialisation
   * =======================================================================*/
  function exportJSON() {
    var data = { app: 'HydroCalc', projet: state.projet, date: new Date().toISOString(),
                 values: state.values, edited: state.edited, grids: state.grids,
                 lang: state.lang, theme: state.theme };
    download((state.projet || 'projet') + '.hydro.json',
             JSON.stringify(data, null, 2), 'application/json');
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function applyImported(d) {
    if (d.values) state.values = d.values;
    if (d.edited) state.edited = d.edited;
    if (d.grids) state.grids = d.grids;
    if (d.projet) state.projet = d.projet;
    if (d.lang) state.lang = d.lang;
    initState();
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try { applyImported(JSON.parse(reader.result)); rebuildUI(); toast('Projet chargé'); }
      catch (e) { toast('Fichier invalide'); }
    };
    reader.readAsText(file);
  }

  function importExcel(file) {
    if (!Hydro.importXLSX) { toast('Import Excel indisponible'); return; }
    Hydro.importXLSX(file, function (n, names, err) {
      if (n < 0) { toast('Lecture impossible (' + (err ? err.message : 'format') + ')'); return; }
      if (n === 0) { toast('Classeur non reconnu'); return; }
      initState(); renderModule();
      toast(n + ' valeurs importées');
    });
  }

  function resetAll() {
    if (!confirm(T('Réinitialiser toutes les données saisies aux valeurs par défaut ?'))) return;
    state.values = {}; state.edited = {}; state.grids = {};
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    initState();
    renderModule();
    toast('Valeurs réinitialisées');
  }

  function applyTemplate(preset) {
    for (var mid in preset.values) {
      state.values[mid] = state.values[mid] || {};
      state.edited[mid] = state.edited[mid] || {};
      for (var k in preset.values[mid]) {
        state.values[mid][k] = preset.values[mid][k];
        state.edited[mid][k] = true;
      }
    }
    state.projet = preset.nom;
    var pn = document.getElementById('projet-name');
    if (pn) pn.value = preset.nom;
    saveLocal();
    renderModule();
    toast(preset.nom);
  }

  function changeLang(l) {
    state.lang = l; Hydro.i18n.setLang(l); saveLocal(); rebuildUI();
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme === 'sombre' ? 'sombre' : 'clair');
  }
  function toggleTheme() {
    state.theme = (state.theme === 'sombre') ? 'clair' : 'sombre';
    applyTheme(); saveLocal(); rebuildUI();
  }

  /** Partage : encode l'état dans le fragment d'URL (#p=...). */
  function shareLink() {
    try {
      var payload = { projet: state.projet, values: state.values, edited: state.edited,
                      grids: state.grids, lang: state.lang };
      var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      var url = location.origin + location.pathname + '#p=' + enc;
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      toast('Lien copié dans le presse-papiers');
    } catch (e) { toast('Partage impossible'); }
  }
  function loadFromHash() {
    if (!location.hash || location.hash.indexOf('#p=') !== 0) return false;
    try {
      var json = decodeURIComponent(escape(atob(location.hash.slice(3))));
      applyImported(JSON.parse(json));
      return true;
    } catch (e) { return false; }
  }

  function toast(msg) {
    var t = el('div', { class: 'toast' }, T(msg));
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 1800);
  }

  /* --- Petit menu déroulant ------------------------------------------------ */
  function dropdown(label, title, items) {
    var menu = el('div', { class: 'menu' }, items.map(function (it) {
      return el('button', { class: 'menu-item', onClick: function () {
        closeMenus(); it.action();
      } }, [it.icon ? it.icon + '  ' : '', T(it.label)]);
    }));
    var btn = el('button', { class: 'btn', title: T(title || label), onClick: function (e) {
      e.stopPropagation();
      var open = wrap.classList.contains('open'); closeMenus();
      if (!open) wrap.classList.add('open');
    } }, [T(label), ' ▾']);
    var wrap = el('div', { class: 'dropdown' }, [btn, menu]);
    return wrap;
  }
  function closeMenus() {
    [].forEach.call(document.querySelectorAll('.dropdown.open'), function (d) { d.classList.remove('open'); });
  }

  /* =========================================================================
   * AMORÇAGE
   * =======================================================================*/
  function buildTopbar() {
    var X = Hydro.export || {};
    var langSel = el('select', { class: 'lang-select', title: T('Langue'),
      onChange: function (e) { changeLang(e.target.value); } },
      Hydro.i18n.langues.map(function (L) {
        var o = el('option', { value: L.code }, L.nom);
        if (L.code === state.lang) o.selected = true; return o;
      }));

    return el('header', { class: 'topbar no-print' }, [
      el('div', { class: 'brand' }, [
        el('span', { class: 'brand-mark' }, '◉'),
        el('span', null, 'HydroCalc'),
        el('span', { class: 'brand-sub' }, T('Boîte à outils hydraulique'))
      ]),
      el('div', { class: 'topbar-actions' }, [
        el('input', { id: 'projet-name', class: 'projet-input', value: state.projet,
          title: T('Nom du projet'),
          onInput: function (e) { state.projet = e.target.value; saveLocal(); } }),
        dropdown('Cas-types', 'Cas-types', (Hydro.refs.casTypes || []).map(function (p) {
          return { label: p.nom, icon: '📁', action: function () { applyTemplate(p); } };
        })),
        dropdown('Exporter', 'Exporter', [
          { label: 'Note de calcul (PDF)', icon: '📄', action: function () { X.notePDF && X.notePDF(); } },
          { label: 'Export Excel', icon: '📊', action: function () { X.excel && X.excel(); } },
          { label: 'Export CSV', icon: '📑', action: function () { X.csv && X.csv(); } },
          { label: 'Enregistrer', icon: '💾', action: exportJSON }
        ]),
        el('label', { class: 'btn', title: T('Charger un projet (.json)') }, [
          '📂',
          el('input', { type: 'file', accept: '.json,application/json', style: 'display:none',
            onChange: function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; } })
        ]),
        el('label', { class: 'btn', title: T('Importer un classeur Excel (.xlsx)') }, [
          '📥',
          el('input', { type: 'file', accept: '.xlsx', style: 'display:none',
            onChange: function (e) { if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = ''; } })
        ]),
        el('button', { class: 'btn', onClick: shareLink, title: T('Partager') }, '🔗'),
        el('button', { class: 'btn', onClick: function () { window.print(); }, title: T('Imprimer / exporter en PDF') }, '🖨️'),
        el('button', { class: 'btn', onClick: toggleTheme, title: T('Thème') }, state.theme === 'sombre' ? '☀️' : '🌙'),
        langSel,
        el('button', { class: 'btn btn--ghost', onClick: resetAll, title: T('Réinitialiser') }, '↺')
      ])
    ]);
  }

  function build() {
    var app = document.getElementById('app');
    app.innerHTML = '';

    $nav = el('nav', { class: 'sidebar no-print' });
    $content = el('main', { class: 'content', id: 'content' });

    var searchBox = el('div', { class: 'search-box no-print' }, [
      el('input', { class: 'search-input', placeholder: T('Rechercher un module…'), value: state.search,
        onInput: function (e) { state.search = e.target.value; renderNav(); } })
    ]);
    var sidebarWrap = el('div', { class: 'sidebar-wrap no-print' }, [searchBox, $nav]);

    app.appendChild(buildTopbar());
    app.appendChild(el('div', { class: 'layout' }, [sidebarWrap, $content]));

    renderNav();
    renderModule();
  }

  function rebuildUI() { build(); }

  function start() {
    loadLocal();
    var shared = loadFromHash();
    Hydro.i18n.setLang(state.lang || 'fr');
    applyTheme();
    initState();
    build();
    if (shared) toast('Projet partagé chargé');
    // PWA (uniquement en http/https ; ignoré en file://)
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    document.addEventListener('click', closeMenus);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof window !== 'undefined' ? window : this);
