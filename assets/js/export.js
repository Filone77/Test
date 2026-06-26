/* ============================================================================
 * HydroCalc — Sorties : note de calcul (PDF via impression), Excel, CSV
 * ==========================================================================*/
(function (root) {
  'use strict';
  var Hydro = root.Hydro;
  var el = Hydro.ui.el, fmt = Hydro.ui.fmt;
  function T(s) { return (Hydro.i18n && typeof s === 'string') ? Hydro.i18n.t(s) : s; }

  /** Récupère la liste {module, results[]} pour tous les modules calculatoires. */
  function collect() {
    var out = [];
    var results = Hydro.getResults();
    Hydro.modules.forEach(function (m) {
      if (!m.compute) return;
      var r = results[m.id];
      if (r && r.results && r.results.length) out.push({ module: m, results: r.results, tables: r.tables || [] });
    });
    return out;
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function projet() { return (Hydro.getState().projet || 'projet'); }
  function dateStr() { return new Date().toLocaleDateString(); }

  /* =========================================================================
   * NOTE DE CALCUL (PDF via impression du navigateur)
   * =======================================================================*/
  function notePDF() {
    var data = collect();
    var report = el('div', { class: 'report' }, [
      el('div', { class: 'report-cover' }, [
        el('div', { class: 'report-logo' }, '◉ HydroCalc'),
        el('h1', null, T('Note de calcul hydraulique')),
        el('div', { class: 'report-projet' }, projet()),
        el('div', { class: 'report-meta' }, [
          el('div', null, [T('Date') + ' : ', dateStr()]),
          el('div', null, [T('Auteur') + ' : ', (Hydro.getState().auteur || '____________________')])
        ])
      ])
    ]);

    data.forEach(function (d) {
      var rows = d.results
        .filter(function (r) { return r.label && r.label.indexOf('—') !== 0; })
        .map(function (r) {
          var val = (typeof r.value === 'string') ? T(r.value) : fmt(r.value, r.unit);
          return el('tr', null, [
            el('td', null, [T(r.label), r.symbol ? ' (' + r.symbol + ')' : '']),
            el('td', { class: 'report-val' }, val),
            el('td', { class: 'report-formula' }, r.formula || '')
          ]);
        });
      report.appendChild(el('section', { class: 'report-section' }, [
        el('h2', null, [d.module.icon + ' ', T(d.module.title)]),
        el('table', { class: 'report-table' }, el('tbody', null, rows))
      ]));
    });

    document.body.appendChild(report);
    document.body.classList.add('printing-report');
    var cleanup = function () { document.body.classList.remove('printing-report'); report.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  }

  /* =========================================================================
   * EXPORT EXCEL (SpreadsheetML — ouvert nativement par Excel/LibreOffice)
   * =======================================================================*/
  function xmlEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function sheetName(s) { return T(s).replace(/[\[\]\:\*\?\/\\]/g, ' ').slice(0, 31); }

  function excel() {
    var data = collect();
    var sheets = data.map(function (d) {
      var rows = [['Grandeur', 'Symbole', 'Valeur', 'Unite', 'Formule']];
      d.results.forEach(function (r) {
        if (r.label && r.label.indexOf('—') === 0) return;
        rows.push([T(r.label), r.symbol || '', r.value, r.unit || '', r.formula || '']);
      });
      var xmlRows = rows.map(function (row, ri) {
        var cells = row.map(function (c) {
          var isNum = ri > 0 && typeof c === 'number' && isFinite(c);
          var type = isNum ? 'Number' : 'String';
          var val = isNum ? c : xmlEsc(c == null ? '' : c);
          return '<Cell><Data ss:Type="' + type + '">' + val + '</Data></Cell>';
        }).join('');
        return '<Row>' + cells + '</Row>';
      }).join('');
      return '<Worksheet ss:Name="' + xmlEsc(sheetName(d.module.title)) + '"><Table>' + xmlRows + '</Table></Worksheet>';
    }).join('');

    var xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' + sheets + '</Workbook>';
    download(projet() + '.xls', xml, 'application/vnd.ms-excel');
  }

  /* =========================================================================
   * EXPORT CSV (toutes les grandeurs, séparateur « ; »)
   * =======================================================================*/
  function csvCell(s) {
    s = (s == null) ? '' : String(s);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv() {
    var data = collect();
    var lines = ['sep=;', ['Module', 'Grandeur', 'Symbole', 'Valeur', 'Unite', 'Formule'].join(';')];
    data.forEach(function (d) {
      d.results.forEach(function (r) {
        if (r.label && r.label.indexOf('—') === 0) return;
        var val = (typeof r.value === 'number') ? Hydro.calc.round(r.value, 5) : r.value;
        lines.push([T(d.module.title), T(r.label), r.symbol || '', val, r.unit || '', r.formula || '']
          .map(csvCell).join(';'));
      });
    });
    download(projet() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  Hydro.export = { notePDF: notePDF, excel: excel, csv: csv };

})(typeof window !== 'undefined' ? window : this);
