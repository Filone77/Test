/* quantities.ui.js — interface du module Métré & Fondations */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  const elements = [
    { type: 'poteau', b: 0.3, h: 0.3, longueur: 3, nombre: 12 },
    { type: 'poutre', b: 0.25, h: 0.5, longueur: 5, nombre: 8 },
    { type: 'dalle', b: 5, h: 0.2, longueur: 5, nombre: 4 }
  ];

  const TYPES = ['poteau', 'poutre', 'dalle', 'semelle', 'voile'];

  function mini(value, oninput, title) {
    return D.el('input', { type: 'number', step: 'any', value, class: 'mini', oninput, title });
  }

  function renderElements() {
    const c = D.$('#mq_elements'); D.clear(c);
    elements.forEach((el, i) => {
      const sel = D.el('select', { class: 'mini', onchange: (e) => { el.type = e.target.value; } },
        TYPES.map((t) => D.el('option', { value: t, selected: t === el.type ? 'selected' : null }, [t])));
      c.appendChild(D.el('div', { class: 'rowline wide' }, [
        sel,
        mini(el.b, (e) => { el.b = parseFloat(e.target.value); }, 'b ou épaisseur [m]'),
        mini(el.h, (e) => { el.h = parseFloat(e.target.value); }, 'h [m]'),
        mini(el.longueur, (e) => { el.longueur = parseFloat(e.target.value); }, 'longueur [m]'),
        mini(el.nombre, (e) => { el.nombre = parseInt(e.target.value, 10); }, 'nombre'),
        D.el('button', { class: 'mini-btn del', onclick: () => { elements.splice(i, 1); renderElements(); } }, ['✕'])
      ]));
    });
  }

  function computeMetre() {
    const prix = {
      beton: D.num('mq_prix_beton'),
      acier: D.num('mq_prix_acier'),
      coffrage: D.num('mq_prix_coffrage')
    };
    const r = GC.quantities.metre(elements, prix);
    let html = '<div class="result-head"><h4>Avant-métré</h4></div>';
    html += D.table(['Élément', 'Nb', 'Dimensions', 'Béton [m³]', 'Coffrage [m²]', 'Acier [kg]'],
      r.lignes.map((l) => [l.type, l.nombre, l.dimensions, D.fmt(l.beton, 2), D.fmt(l.coffrage, 1), D.fmt(l.acier, 0)]));
    html += '<div class="kpis">' +
      kpi('Béton', D.fmt(r.totaux.beton, 2), 'm³') +
      kpi('Coffrage', D.fmt(r.totaux.coffrage, 1), 'm²') +
      kpi('Acier', D.fmt(r.totaux.acier, 0), 'kg') +
      kpi('Coût total', D.fmt(r.cout.total, 0), '€') +
      '</div>';
    html += D.table(['Poste', 'Quantité', 'Prix unitaire', 'Montant'], [
      ['Béton', D.fmt(r.totaux.beton, 2) + ' m³', D.fmt(prix.beton, 0) + ' €/m³', D.fmt(r.cout.beton, 0) + ' €'],
      ['Acier', D.fmt(r.totaux.acier, 0) + ' kg', D.fmt(prix.acier, 2) + ' €/kg', D.fmt(r.cout.acier, 0) + ' €'],
      ['Coffrage', D.fmt(r.totaux.coffrage, 1) + ' m²', D.fmt(prix.coffrage, 0) + ' €/m²', D.fmt(r.cout.coffrage, 0) + ' €'],
      ['<b>Total</b>', '', '', '<b>' + D.fmt(r.cout.total, 0) + ' €</b>']
    ]);
    D.$('#mq_res').innerHTML = html;
  }

  function computeFooting() {
    const r = GC.quantities.semelleIsolee({
      NEd: D.num('mf_NEd'),
      Nser: D.val('mf_Nser') ? D.num('mf_Nser') : undefined,
      sigmaSol: D.num('mf_sigma'),
      a: D.num('mf_a'), b: D.num('mf_b'),
      fck: D.num('mf_fck'), fyk: D.num('mf_fyk')
    });
    let html = `<div class="result-head">${D.badge(r.statut)}<h4>Semelle isolée — méthode des bielles</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Charge ELU NEd', D.fmt(r.NEd, 0), 'kN'],
      ['Charge ELS Nser', D.fmt(r.Nser, 0), 'kN'],
      ['Surface requise', D.fmt(r.Sreq, 2), 'm²'],
      ['<b>Dimensions A × B</b>', '<b>' + D.fmt(r.A, 2) + ' × ' + D.fmt(r.B, 2) + '</b>', 'm'],
      ['Hauteur totale H', D.fmt(r.H, 2), 'm'],
      ['Hauteur utile d', D.fmt(r.d, 2), 'm'],
      ['Contrainte sol / admissible', D.fmt(r.sigmaSol, 0) + ' / ' + D.fmt(r.sigmaAdm, 0), 'kPa'],
      ['<b>Aciers nappe inf. (par dir.)</b>', '<b>' + D.fmt(r.AsX, 2) + '</b>', 'cm²'],
      ['Volume béton', D.fmt(r.volume, 2), 'm³'],
      ['Poids propre', D.fmt(r.poids, 0), 'kN']
    ]);
    if (r.choixX && r.choixX.length) {
      html += '<h5>Choix d’armatures (par direction)</h5>' +
        D.table(['Choix', 'Aire'], r.choixX.map((c) => [`${c.n} Ø${c.phi}`, D.fmt(c.As, 0) + ' mm²']));
    }
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#mf_res').innerHTML = html;
  }

  function kpi(label, val, unit) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-val">${val} <small>${unit}</small></div></div>`;
  }

  function init() {
    renderElements();
    D.$('#mq_add').addEventListener('click', () => { elements.push({ type: 'poteau', b: 0.3, h: 0.3, longueur: 3, nombre: 1 }); renderElements(); });
    D.$('#mq_compute').addEventListener('click', computeMetre);
    D.$('#mf_compute').addEventListener('click', computeFooting);
    computeMetre();
    computeFooting();
  }

  GC.modules = GC.modules || {};
  GC.modules.quantities = { init, computeMetre, computeFooting };
})();
