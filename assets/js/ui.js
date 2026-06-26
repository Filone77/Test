/* ============================================================================
 * HydroCalc — Helpers d'interface (présentation pure, sans logique métier)
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Hydro = root.Hydro || (root.Hydro = {});

  /** Crée un élément DOM. tag, attrs (props/attributs), enfants (string|node|array). */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!attrs.hasOwnProperty(k)) continue;
        var v = attrs[k];
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') { for (var d in v) node.dataset[d] = v[d]; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v != null && v !== false) {
          node.setAttribute(k, v === true ? '' : v);
        }
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children == null) return;
    if (Array.isArray(children)) {
      children.forEach(function (c) { appendChildren(node, c); });
    } else if (typeof children === 'string' || typeof children === 'number') {
      node.appendChild(document.createTextNode(String(children)));
    } else {
      node.appendChild(children);
    }
  }

  /** Formate un nombre pour l'affichage : précision adaptative + séparateur. */
  function fmt(x, unit) {
    if (typeof x === 'string') return x;
    if (x == null || (typeof x === 'number' && !isFinite(x))) return '—';
    var abs = Math.abs(x), digits;
    if (abs === 0) digits = 0;
    else if (abs >= 1e5 || abs < 1e-3) return toExp(x) + (unit ? ' ' + unit : '');
    else if (abs >= 100) digits = 1;
    else if (abs >= 10) digits = 2;
    else if (abs >= 1) digits = 3;
    else digits = 4;
    var s = x.toFixed(digits);
    // séparateur de milliers (espace fine), virgule décimale (français)
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    s = parts.join(',');
    return s + (unit ? ' ' + unit : '');
  }

  function toExp(x) {
    var e = x.toExponential(3); // ex: 1.369e-6
    var m = e.split('e');
    return m[0].replace('.', ',') + '·10' + sup(parseInt(m[1], 10));
  }

  function sup(n) {
    var map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(function (c) { return map[c] || c; }).join('');
  }

  /** Champ de saisie (number/select) avec libellé, unité, indice et lien. */
  function field(def, value, opts) {
    opts = opts || {};
    var input;
    if (def.type === 'select') {
      input = el('select', { class: 'field-input', dataset: { key: def.key } });
      (def.options || []).forEach(function (o) {
        var ov = typeof o === 'object' ? o.value : o;
        var ol = typeof o === 'object' ? o.label : o;
        var opt = el('option', { value: ov }, ol);
        if (String(ov) === String(value)) opt.selected = true;
        input.appendChild(opt);
      });
    } else {
      input = el('input', {
        class: 'field-input', type: 'number', step: def.step || 'any',
        value: value == null ? '' : value, dataset: { key: def.key }
      });
    }
    if (opts.onInput) input.addEventListener('input', opts.onInput);
    if (opts.onChange) input.addEventListener('change', opts.onChange);

    var labelText = def.label + (def.symbol ? '' : '');
    var symbolBadge = def.symbol ? el('span', { class: 'field-symbol' }, def.symbol) : null;
    var linkBadge = def.link ? el('span', {
      class: 'field-link', title: 'Valeur liée à un autre module — modifiable'
    }, '🔗') : null;

    var unit = def.unit ? el('span', { class: 'field-unit' }, def.unit) : null;

    return el('div', { class: 'field' + (def.wide ? ' field--wide' : '') }, [
      el('label', { class: 'field-label' }, [labelText, ' ', symbolBadge, ' ', linkBadge]),
      el('div', { class: 'field-control' }, [input, unit]),
      def.hint ? el('div', { class: 'field-hint' }, def.hint) : null
    ]);
  }

  /** Ligne de résultat. */
  function resultRow(r) {
    var statusEl = null;
    if (r.status) {
      var cls = r.status.kind === 'ok' ? 'badge--ok'
              : r.status.kind === 'warn' ? 'badge--warn' : 'badge--bad';
      statusEl = el('span', { class: 'badge ' + cls }, r.status.text);
    }
    return el('div', { class: 'result' + (r.strong ? ' result--strong' : '') }, [
      el('div', { class: 'result-label' }, [
        r.label,
        r.symbol ? el('span', { class: 'result-symbol' }, r.symbol) : null
      ]),
      el('div', { class: 'result-value' }, [
        el('span', { class: 'result-num' }, fmt(r.value, r.unit)),
        statusEl
      ]),
      r.formula ? el('div', { class: 'result-formula' }, r.formula) : null
    ]);
  }

  /** Tableau générique (en-têtes + lignes de cellules formatées). */
  function table(spec) {
    var thead = el('thead', null, el('tr', null,
      spec.headers.map(function (h) { return el('th', null, h); })));
    var tbody = el('tbody', null, spec.rows.map(function (row, ri) {
      var cls = (spec.highlightRow != null && spec.highlightRow === ri) ? 'row--hl' : null;
      return el('tr', cls ? { class: cls } : null, row.map(function (c) {
        if (c && typeof c === 'object' && c.node) return el('td', null, c.node);
        return el('td', null, typeof c === 'number' ? fmt(c) : String(c));
      }));
    }));
    return el('table', { class: 'data-table' }, [
      spec.caption ? el('caption', null, spec.caption) : null, thead, tbody
    ]);
  }

  /** Grille éditable : colonnes {key,label,unit,type,editable,options}.
   *  rows = tableau d'objets ; onCell(rowIndex, key, value) à chaque modification. */
  function editableGrid(columns, rows, onCell) {
    var thead = el('thead', null, el('tr', null,
      columns.map(function (c) {
        return el('th', null, c.label + (c.unit ? ' (' + c.unit + ')' : ''));
      })));
    var body = el('tbody');
    rows.forEach(function (row, ri) {
      var tr = el('tr');
      columns.forEach(function (c) {
        var td = el('td');
        if (c.editable) {
          var inp;
          if (c.type === 'select') {
            inp = el('select', { class: 'grid-input' });
            (c.options || []).forEach(function (o) {
              var opt = el('option', { value: o }, o);
              if (String(o) === String(row[c.key])) opt.selected = true;
              inp.appendChild(opt);
            });
          } else {
            inp = el('input', { class: 'grid-input', type: 'number',
              step: c.step || 'any', value: row[c.key] == null ? '' : row[c.key] });
          }
          inp.addEventListener('input', function () {
            var val = c.type === 'select' ? inp.value : parseFloat(inp.value);
            onCell(ri, c.key, val);
          });
          td.appendChild(inp);
        } else {
          var v = row[c.key];
          td.textContent = (typeof v === 'number') ? fmt(v) : (v == null ? '' : v);
          if (c.muted) td.className = 'cell--muted';
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return el('table', { class: 'data-table grid-table' }, [thead, body]);
  }

  /** Dessine une courbe simple (réseau vs pompe) sur un canvas. */
  function chartXY(series, opts) {
    opts = opts || {};
    var W = 560, H = 320, pad = 46;
    var cv = el('canvas', { width: W, height: H, class: 'chart' });
    var ctx = cv.getContext('2d');
    var xs = [], ys = [];
    series.forEach(function (s) { s.points.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var xmin = 0, xmax = Math.max.apply(null, xs) * 1.05 || 1;
    var ymin = 0, ymax = Math.max.apply(null, ys) * 1.1 || 1;
    function X(x) { return pad + (x - xmin) / (xmax - xmin) * (W - 2 * pad); }
    function Y(y) { return H - pad - (y - ymin) / (ymax - ymin) * (H - 2 * pad); }
    // axes
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.font = '11px sans-serif';
    ctx.fillStyle = '#64748b';
    for (var g = 0; g <= 5; g++) {
      var gx = xmin + (xmax - xmin) * g / 5, gy = ymin + (ymax - ymin) * g / 5;
      ctx.beginPath(); ctx.moveTo(X(gx), Y(ymin)); ctx.lineTo(X(gx), Y(ymax)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(xmin), Y(gy)); ctx.lineTo(X(xmax), Y(gy)); ctx.stroke();
      ctx.fillText(gx.toFixed(0), X(gx) - 6, H - pad + 14);
      ctx.fillText(gy.toFixed(0), 6, Y(gy) + 3);
    }
    ctx.fillStyle = '#334155';
    ctx.fillText(opts.xlabel || 'Q', W - pad, H - pad + 28);
    ctx.fillText(opts.ylabel || 'H', 6, pad - 14);
    // séries
    series.forEach(function (s) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
      s.points.forEach(function (p, i) { i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); });
      ctx.stroke();
    });
    // point de fonctionnement
    if (opts.marker && isFinite(opts.marker.x) && isFinite(opts.marker.y)) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(X(opts.marker.x), Y(opts.marker.y), 5, 0, 2 * Math.PI); ctx.fill();
    }
    return cv;
  }

  Hydro.ui = {
    el: el, fmt: fmt, field: field, resultRow: resultRow,
    table: table, editableGrid: editableGrid, chartXY: chartXY
  };

})(typeof window !== 'undefined' ? window : this);
