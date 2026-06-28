/* app.js — navigation et initialisation de l'application */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function showView(name) {
    D.$all('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    D.$all('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
  }

  function subTab(group, name) {
    D.$all('[data-subtab="' + group + '"]').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === name));
    D.$all('[data-subpanel="' + group + '"]').forEach((p) =>
      p.classList.toggle('active', p.dataset.panel === name));
  }

  function init() {
    // Navigation principale
    D.$all('.nav-item').forEach((n) => {
      n.addEventListener('click', () => showView(n.dataset.view));
    });
    // Sous-onglets (béton)
    D.$all('[data-subtab]').forEach((b) => {
      b.addEventListener('click', () => subTab(b.dataset.subtab, b.dataset.tab));
    });
    // Boutons de calcul béton
    D.$('#bf_calc').addEventListener('click', GC.modules.concrete.flexion);
    D.$('#bT_calc').addEventListener('click', GC.modules.concrete.poutreT);
    D.$('#bt_calc').addEventListener('click', GC.modules.concrete.tranchant);
    D.$('#bp_calc').addEventListener('click', GC.modules.concrete.poteau);
    D.$('#bd_calc').addEventListener('click', GC.modules.concrete.dalle);

    // Initialisation des modules complexes
    GC.modules.structures.init();
    GC.modules.steel.init();
    GC.modules.quantities.init();
    GC.modules.loads.init();
    GC.modules.geotech.init();
    GC.modules.retaining.init();
    GC.modules.elements.init();
    GC.modules.vrd.init();
    GC.modules.combos.init();
    GC.modules.pressure.init();
    GC.modules.pumping.init();
    GC.modules.weirs.init();
    GC.modules.sludge.init();
    GC.modules.distribution.init();
    GC.modules.validator.init();

    // Premiers calculs béton (valeurs par défaut)
    GC.modules.concrete.flexion();
    GC.modules.concrete.poutreT();
    GC.modules.concrete.tranchant();
    GC.modules.concrete.poteau();
    GC.modules.concrete.dalle();

    // Boutons d'export de note de calcul (PDF)
    D.$all('[data-export-res]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        const resEl = document.getElementById(btn.dataset.exportRes);
        GC.report.fromForm(btn.dataset.exportTitle, card, resEl);
      });
    });

    // Vue initiale (depuis le hash éventuel)
    const start = (location.hash || '#accueil').slice(1);
    const views = ['accueil', 'beton', 'elements', 'structures', 'acier', 'soutenement', 'geotech', 'metre', 'vrd', 'conduite', 'pompage', 'deversoirs', 'boues', 'repartiteur', 'charges', 'combinaisons', 'validation', 'apropos'];
    showView(views.indexOf(start) >= 0 ? start : 'accueil');

    // Boutons "Démarrer" de l'accueil
    D.$all('[data-goto]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.goto)));
  }

  document.addEventListener('DOMContentLoaded', init);
  GC.app = { showView };
})();
