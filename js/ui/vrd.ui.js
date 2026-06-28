/* vrd.ui.js — interface VRD (assainissement, canalisations, terrassement, chaussée) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function pluvial() {
    const r = GC.vrd.pluvialRationnel({ C: D.num('vp_C'), i: D.num('vp_i'), A: D.num('vp_A') });
    let html = `<div class="result-head"><span class="badge badge-ok">Méthode rationnelle</span><h4>Débit pluvial</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Coefficient de ruissellement C', D.fmt(r.C, 2), '—'],
      ['Intensité i', D.fmt(r.i, 0), 'mm/h'],
      ['Surface A', D.fmt(r.A, 2), 'ha'],
      ['<b>Débit Q = C·i·A</b>', '<b>' + D.fmt(r.Qls, 1) + '</b>', 'L/s'],
      ['Débit Q', D.fmt(r.Qm3s, 3), 'm³/s']
    ]);
    D.$('#vp_res').innerHTML = html;
  }

  function canal() {
    const r = GC.vrd.canalisation({ Qls: D.num('vc_Qls'), I: D.num('vc_I'), K: D.num('vc_K'), D: D.val('vc_D') ? D.num('vc_D') : undefined });
    let html = `<div class="result-head"><span class="badge badge-ok">Manning-Strickler</span><h4>Canalisation gravitaire</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Débit à évacuer', D.fmt(r.Qls, 1), 'L/s'],
      ['Pente I', D.fmt(r.I, 4), 'm/m'],
      ['Coefficient de Strickler K', D.fmt(r.K, 0), '—'],
      ['<b>Diamètre requis (gamme normalisée)</b>', '<b>DN ' + (r.Dreq || '—') + '</b>', 'mm']
    ]);
    if (r.capacite) html += `<p class="muted">DN ${r.capacite.D} : capacité ${D.fmt(r.capacite.Q, 0)} L/s à V = ${D.fmt(r.capacite.V, 2)} m/s.</p>`;
    if (r.impose) {
      html += '<h5>Vérification du diamètre imposé DN ' + r.impose.D + '</h5>';
      html += D.table(['Grandeur', 'Valeur', 'Statut'], [
        ['Capacité pleine', D.fmt(r.impose.Q, 1) + ' L/s', D.badge(r.impose.statut)],
        ['Vitesse', D.fmt(r.impose.V, 2) + ' m/s', r.impose.autocurage ? (r.impose.vitesseOk ? '✓ 0,6–4 m/s' : '⚠ > 4 m/s') : '⚠ < 0,6 m/s (autocurage)'],
        ['Taux de remplissage', D.fmt(r.impose.taux * 100, 0) + ' %', '']
      ]);
    }
    D.$('#vc_res').innerHTML = html;
  }

  function terr() {
    const r = GC.vrd.terrassement({
      L: D.num('vt_L'), largeur: D.num('vt_largeur'), profondeur: D.num('vt_profondeur'),
      DN: D.num('vt_DN'), litSable: D.num('vt_lit'), foisonnement: D.num('vt_foison')
    });
    let html = `<div class="result-head"><span class="badge badge-ok">Terrassement</span><h4>Tranchée de réseau</h4></div>`;
    html += D.table(['Poste', 'Volume', 'Unité'], [
      ['Déblai', D.fmt(r.deblai, 1), 'm³'],
      ['Lit de pose (sable)', D.fmt(r.litSable, 1), 'm³'],
      ['Enrobage', D.fmt(r.enrobage, 1), 'm³'],
      ['Remblai (réutilisé)', D.fmt(r.remblai, 1), 'm³'],
      ['Évacuation (foisonné)', D.fmt(r.evacuationFoisonnee, 1), 'm³']
    ]);
    D.$('#vt_res').innerHTML = html;
  }

  function caniveau() {
    const r = GC.channel.dimensionner({
      Qls: D.num('ca_Qls'), forme: D.val('ca_forme'),
      b: D.num('ca_b'), m: D.num('ca_m'), I: D.num('ca_I'), K: D.num('ca_K'),
      revanche: D.num('ca_revanche')
    });
    let html = `<div class="result-head">${D.badge(r.autocurage && r.vitesseOk ? 'OK' : 'NOK')}<h4>Caniveau (Manning-Strickler)</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Débit à évacuer', D.fmt(r.Qls, 1), 'L/s'],
      ['<b>Tirant d’eau normal</b>', '<b>' + D.fmt(r.yNormal, 3) + '</b>', 'm'],
      ['Hauteur totale (+ revanche)', D.fmt(r.hTotal, 3), 'm'],
      ['Section mouillée', D.fmt(r.A, 4), 'm²'],
      ['Rayon hydraulique Rh', D.fmt(r.Rh, 3), 'm'],
      ['Vitesse V', D.fmt(r.V, 2) + (r.autocurage && r.vitesseOk ? ' ✓' : ' ⚠'), 'm/s'],
      ['Nombre de Froude', D.fmt(r.froude, 2) + ' (' + r.regime + ')', '—']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ca_res').innerHTML = html;
  }

  function recupEP() {
    const C = parseFloat(D.val('ep_toiture'));
    const r = GC.rainwater.dimensionner({
      surface: D.num('ep_surface'), pluvio: D.num('ep_pluvio'),
      Crunoff: C, demandeJour: D.num('ep_demande'), joursStockage: D.num('ep_jours')
    });
    let html = `<div class="result-head"><span class="badge badge-ok">Eaux pluviales</span><h4>Bâche de récupération</h4></div>`;
    html += '<div class="kpis">' +
      `<div class="kpi"><div class="kpi-label">Cuve conseillée</div><div class="kpi-val">${D.fmt(r.cuveNormalisee, 1)} <small>m³</small></div></div>` +
      `<div class="kpi"><div class="kpi-label">Couverture besoin</div><div class="kpi-val">${D.fmt(r.tauxCouverture, 0)} <small>%</small></div></div>` +
      `<div class="kpi"><div class="kpi-label">Économie</div><div class="kpi-val">${D.fmt(r.economieAn, 0)} <small>m³/an</small></div></div>` +
      '</div>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Volume collectable annuel', D.fmt(r.Vcol, 1), 'm³/an'],
      ['Demande annuelle', D.fmt(r.Vdem, 1), 'm³/an'],
      ['Facteur limitant', r.facteurLimitant, '—'],
      ['<b>Volume utile (' + D.num('ep_jours') + ' j)</b>', '<b>' + D.fmt(r.Vutile, 2) + '</b>', 'm³'],
      ['Cuve normalisée retenue', D.fmt(r.cuveNormalisee, 1), 'm³'],
      ['Autonomie (cuve pleine)', D.fmt(r.autonomie, 0), 'jours']
    ]);
    html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ep_res').innerHTML = html;
  }

  function chaussee() {
    const r = GC.vrd.chausseeCBR({ P: D.num('vch_P'), CBR: D.num('vch_CBR') });
    let html = `<div class="result-head"><span class="badge badge-ok">Indicatif (CBR)</span><h4>Corps de chaussée</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Charge par roue P', D.fmt(r.P, 1), 't'],
      ['Indice portant CBR', D.fmt(r.CBR, 0), '%'],
      ['<b>Épaisseur totale estimée</b>', '<b>' + D.fmt(r.epaisseur, 0) + '</b>', 'cm']
    ]);
    html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#vch_res').innerHTML = html;
  }

  function init() {
    // sélecteur de toiture (eaux pluviales)
    const tt = D.$('#ep_toiture');
    if (tt) Object.keys(GC.rainwater.TOITURES).forEach((k) => {
      tt.appendChild(D.el('option', { value: GC.rainwater.TOITURES[k], selected: k.indexOf('Tuiles') === 0 ? 'selected' : null }, [k]));
    });
    D.$('#vp_calc').addEventListener('click', pluvial);
    D.$('#vc_calc').addEventListener('click', canal);
    D.$('#vt_calc').addEventListener('click', terr);
    D.$('#vch_calc').addEventListener('click', chaussee);
    D.$('#ca_calc').addEventListener('click', caniveau);
    D.$('#ep_calc').addEventListener('click', recupEP);
    pluvial(); canal(); terr(); chaussee(); caniveau(); recupEP();
  }

  GC.modules = GC.modules || {};
  GC.modules.vrd = { init, pluvial, canal, terr, chaussee };
})();
