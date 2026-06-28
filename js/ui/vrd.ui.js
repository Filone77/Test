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
    const r = GC.earthwork.tranchee({
      DN: D.num('vt_DN'), DE: D.num('vt_DE'), H: D.num('vt_profondeur'), L: D.num('vt_L'),
      eLit: D.num('vt_lit'), couverture: D.num('vt_couv'),
      largeur: D.val('vt_largeur') ? D.num('vt_largeur') : undefined,
      foisonnement: D.num('vt_foison'), reutiliser: D.val('vt_reuse') === '1'
    });
    let html = `<div class="result-head"><span class="badge badge-ok">EN 1610</span><h4>Tranchée de réseau</h4></div>`;
    html += `<p class="muted">Largeur mini EN 1610 : tableau 1 = ${D.fmt(r.largeurEN1610.w1, 2)} m, tableau 2 = ${D.fmt(r.largeurEN1610.w2, 2)} m → <b>${D.fmt(r.largeur, 2)} m</b> · couverture totale ${D.fmt(r.couvertureTotale, 2)} m</p>`;
    html += D.table(['Poste', 'Volume', 'Unité'], [
      ['Déblai total', D.fmt(r.Vdeblai, 1), 'm³'],
      ['Lit de pose (apport)', D.fmt(r.Vlit, 1), 'm³'],
      ['Enrobage net (apport, tuyau déduit)', D.fmt(r.Venrobage, 1), 'm³'],
      ['Section de tuyau déduite', D.fmt(r.Vtuyau, 2), 'm³'],
      ['Remblai principal', D.fmt(r.Vremblai, 1), 'm³'],
      ['<b>Matériaux d’apport (grave/sable)</b>', '<b>' + D.fmt(r.Vapport, 1) + '</b>', 'm³'],
      ['<b>Évacuation (foisonnée)</b>', '<b>' + D.fmt(r.Vevacuation, 1) + '</b>', 'm³']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#vt_res').innerHTML = html;
  }

  function bassin() {
    const r = GC.detention.bassin({ A: D.num('ba_A'), C: D.num('ba_C'), Qf: D.num('ba_Qf'), a: D.num('ba_a'), b: D.num('ba_b') });
    let html = `<div class="result-head"><span class="badge badge-ok">Méthode des pluies</span><h4>Bassin de rétention</h4></div>`;
    html += '<div class="kpis">' +
      `<div class="kpi"><div class="kpi-label">Volume de stockage</div><div class="kpi-val">${D.fmt(r.volume, 0)} <small>m³</small></div></div>` +
      `<div class="kpi"><div class="kpi-label">Durée critique</div><div class="kpi-val">${D.fmt(r.dureeCritique, 0)} <small>min</small></div></div>` +
      `<div class="kpi"><div class="kpi-label">Débit fuite spéc.</div><div class="kpi-val">${D.fmt(r.debitFuiteSpecifique, 1)} <small>L/s/ha</small></div></div>` +
      '</div>';
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Surface active (C·A)', D.fmt(r.C * r.A, 2), 'ha'],
      ['Débit de fuite', D.fmt(r.Qf, 0), 'L/s'],
      ['Montana a / b', D.fmt(r.a, 2) + ' / ' + D.fmt(r.b, 2), '—'],
      ['Hauteur de pluie critique', D.fmt(r.hauteurCritique, 1), 'mm'],
      ['Volume entrant à tcrit', D.fmt(r.Ventrant, 1), 'm³'],
      ['<b>Volume de rétention</b>', '<b>' + D.fmt(r.volume, 1) + '</b>', 'm³']
    ]);
    html += '<div id="ba_plot" class="plotbox"></div>';
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ba_res').innerHTML = html;
    GC.plot.diagram(D.$('#ba_plot'), r.courbe, { yKey: 'y', color: '#1b3a5b', fill: 'rgba(27,58,91,0.10)', title: 'Volume stocké selon la durée de pluie', unit: 'm³' });
  }

  let serieImportee = null;

  function recupSim(serie) {
    const C = parseFloat(D.val('ep_toiture'));
    const base = { surface: D.num('ep_surface'), Crunoff: C, pluvio: D.num('ep_pluvio'), demandeJour: D.num('ep_demande'), nJoursPluie: D.num('ep_npluie') };
    const importee = serie && serie.length;
    if (importee) base.serie = serie;
    const r = GC.rainwater.simulation(Object.assign({ Vcuve: D.num('ep_vcuve') }, base));
    let html = `<div class="result-head"><span class="badge badge-ok">${importee ? 'Chronique importée (' + r.jours + ' j)' : 'Simulation 365 j'}</span><h4>Couverture réelle (cuve ${D.fmt(r.Vcuve, 1)} m³)</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      [importee ? 'Pluviométrie de la chronique' : 'Pluviométrie simulée', D.fmt(r.pluvioSimulee, 0), 'mm'],
      ['<b>Taux de couverture réel</b>', '<b>' + D.fmt(r.tauxCouverture, 1) + '</b>', '%'],
      ['Volume récupéré', D.fmt(r.volumeRecupere, 1), 'm³'],
      ['Complément réseau', D.fmt(r.complementReseau, 1), 'm³'],
      ['Débordement (trop-plein)', D.fmt(r.debordement, 1), 'm³'],
      ['Jours cuve vide', D.fmt(r.joursVides, 0), 'j']
    ]);
    html += '<div id="ep_simplot" class="plotbox"></div>';
    D.$('#ep_simres').innerHTML = html;
    GC.plot.diagram(D.$('#ep_simplot'), GC.rainwater.courbeCouverture(base, Math.max(10, D.num('ep_vcuve') * 2)),
      { yKey: 'y', color: '#e08a1e', fill: 'rgba(224,138,30,0.12)', title: 'Taux de couverture selon le volume de cuve', unit: '%' });
  }

  function importerCSV(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      let serie = GC.rainwater.parseChronique(reader.result);
      const pas = D.num('ep_pas');
      let note = '';
      if (pas > 0 && pas < 1440) {
        const avant = serie.length;
        serie = GC.rainwater.agregerJournalier(serie, pas);
        note = ` (${avant} pas de ${pas} min agrégés en ${serie.length} jours)`;
      }
      serieImportee = serie;
      const total = Math.round(serieImportee.reduce((a, b) => a + b, 0));
      const msg = D.$('#ep_csvmsg');
      if (msg) msg.textContent = serieImportee.length
        ? `${serieImportee.length} jours, total ${total} mm${note}. Cliquez « Simuler la chronique ».`
        : 'Aucune valeur numérique détectée dans le fichier.';
    };
    reader.readAsText(f);
  }

  function ressautLoc() {
    const r = GC.channel.ressautLocalise({
      b: D.num('ca_b'), Q: D.num('ca_Qrl'), I: D.num('ca_Irl'), K: D.num('ca_K'),
      yAmont: D.num('ca_yam'), yAval: D.num('ca_yav'), L: D.num('ca_Lrl')
    });
    let html = `<div class="result-head"><span class="badge ${r.ressautPresent ? 'badge-ok' : 'badge-warn'}">${r.ressautPresent ? 'Ressaut localisé' : 'Pas de ressaut'}</span><h4>Ressaut sur le profil</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Profondeur critique yc', D.fmt(r.yc, 3), 'm'],
      ['Profondeur normale yn', D.fmt(r.yn, 3), 'm'],
      ['Position du ressaut', r.position != null ? D.fmt(r.position, 1) : '—', 'm'],
      ['Profondeur amont y₁', r.y1 != null ? D.fmt(r.y1, 3) : '—', 'm'],
      ['Profondeur aval y₂', r.y2 != null ? D.fmt(r.y2, 3) : '—', 'm']
    ]);
    html += '<div id="ca_rlplot" class="plotbox"></div>';
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ca_rlres').innerHTML = html;
    GC.plot.courbes(D.$('#ca_rlplot'), [
      { name: 'Profil amont (torrentiel)', color: '#c0392b', data: r.profilSup },
      { name: 'Profil aval (fluvial)', color: '#1b3a5b', data: r.profilSub }
    ], { xlabel: 'x [m]', ylabel: 'y [m]', point: r.position != null ? { x: r.position, y: r.y2 } : null });
  }

  function ressaut() {
    const r = GC.channel.ressaut({ b: D.num('ca_b'), Q: D.num('ca_Qres'), y1: D.num('ca_y1') });
    let html = `<div class="result-head"><span class="badge ${r.Fr1 >= 1 ? 'badge-ok' : 'badge-warn'}">${r.type}</span><h4>Ressaut hydraulique</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Tirant amont y₁ (torrentiel)', D.fmt(r.y1, 3), 'm'],
      ['Vitesse / Froude amont', D.fmt(r.V1, 2) + ' m/s · Fr₁=' + D.fmt(r.Fr1, 2), '—'],
      ['<b>Tirant aval y₂ (conjugué)</b>', '<b>' + D.fmt(r.y2, 3) + '</b>', 'm'],
      ['Froude aval Fr₂', D.fmt(r.Fr2, 2), '—'],
      ['Perte d’énergie ΔE', D.fmt(r.deltaE, 3), 'm'],
      ['Longueur du ressaut', D.fmt(r.longueur, 2), 'm']
    ]);
    if (r.messages.length) html += '<ul class="notes">' + r.messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    D.$('#ca_ressres').innerHTML = html;
  }

  function remous() {
    const r = GC.channel.courbeRemous({
      forme: D.val('ca_forme'), b: D.num('ca_b'), m: D.num('ca_m'),
      Q: D.num('ca_Qrem'), I: D.num('ca_I'), K: D.num('ca_K'), yAval: D.num('ca_yaval'), L: 2000
    });
    let html = `<div class="result-head"><span class="badge badge-ok">Remous (GVF)</span><h4>Courbe de remous — profil ${r.type}</h4></div>`;
    html += D.table(['Grandeur', 'Valeur', 'Unité'], [
      ['Profondeur normale yn', D.fmt(r.yn, 3), 'm'],
      ['Profondeur critique yc', D.fmt(r.yc, 3), 'm'],
      ['Type de pente', r.pente, '—'],
      ['Profil', r.type + ' (' + r.sens + ')', '—'],
      ['Longueur d’influence', D.fmt(r.longueur, 0), 'm']
    ]);
    html += '<div id="ca_remplot" class="plotbox"></div>';
    D.$('#ca_remres').innerHTML = html;
    GC.plot.diagram(D.$('#ca_remplot'), r.profil, { yKey: 'y', color: '#2a5688', fill: 'rgba(42,86,136,0.12)', title: 'Profil de la surface libre y(x)', unit: 'm' });
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
    // Montana (bassin de rétention)
    const ms = D.$('#ba_montana');
    if (ms) {
      Object.keys(GC.detention.MONTANA).forEach((k) => ms.appendChild(D.el('option', { value: k }, [k])));
      ms.addEventListener('change', () => {
        const m = GC.detention.MONTANA[ms.value];
        if (m) { D.$('#ba_a').value = m.a; D.$('#ba_b').value = m.b; bassin(); }
      });
    }
    D.$('#ba_calc').addEventListener('click', bassin);
    D.$('#ep_sim').addEventListener('click', () => recupSim());
    D.$('#ca_remous').addEventListener('click', remous);
    D.$('#ca_ressaut').addEventListener('click', ressaut);
    D.$('#ca_rlcalc').addEventListener('click', ressautLoc);
    const csv = D.$('#ep_csv');
    if (csv) csv.addEventListener('change', importerCSV);
    D.$('#ep_simcsv').addEventListener('click', () => recupSim(serieImportee));
    pluvial(); canal(); terr(); chaussee(); caniveau(); recupEP();
    bassin(); recupSim(); remous(); ressaut(); ressautLoc();
  }

  GC.modules = GC.modules || {};
  GC.modules.vrd = { init, pluvial, canal, terr, chaussee };
})();
