/* dom.js — petits utilitaires d'interface (sans dépendance externe) */
(function () {
  'use strict';
  window.GC = window.GC || {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /** Formate un nombre : décimales fixes + séparateur de milliers (espace fine). */
  function fmt(x, dec) {
    if (x == null || isNaN(x)) return '—';
    dec = dec == null ? 2 : dec;
    const s = Number(x).toFixed(dec);
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }

  function badge(statut) {
    if (!statut) return '';
    const cls = statut === 'OK' ? 'badge-ok' : 'badge-nok';
    const ico = statut === 'OK' ? '✓' : '✗';
    return `<span class="badge ${cls}">${ico} ${statut}</span>`;
  }

  /** Lit la valeur numérique d'un input par id. */
  function num(id) {
    const n = $('#' + id);
    return n ? parseFloat(n.value) : NaN;
  }
  function val(id) {
    const n = $('#' + id);
    return n ? n.value : null;
  }

  /** Construit un tableau HTML à partir d'en-têtes et de lignes. */
  function table(headers, rows) {
    let h = '<table class="data"><thead><tr>';
    headers.forEach((c) => { h += `<th>${c}</th>`; });
    h += '</tr></thead><tbody>';
    rows.forEach((r) => {
      h += '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  GC.dom = { $, $all, el, clear, fmt, badge, num, val, table };
})();
