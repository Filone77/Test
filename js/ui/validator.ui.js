/* validator.ui.js — interface Vérificateur de note de calcul */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  // Champs par type ({id, label, def, note:true si « valeur annoncée dans la note »})
  const FIELDS = {
    ba_flexion: [
      { id: 'MEd', label: 'MEd [kN·m]', def: 200 }, { id: 'b', label: 'b [mm]', def: 300 },
      { id: 'h', label: 'h [mm]', def: 500 }, { id: 'd', label: 'd [mm]', def: 450 },
      { id: 'fck', label: 'fck [MPa]', def: 25 }, { id: 'fyk', label: 'fyk [MPa]', def: 500 },
      { id: 'As_note', label: 'As de la note [mm²]', def: 1200, note: true }
    ],
    semelle: [
      { id: 'NEd', label: 'NEd [kN]', def: 900 }, { id: 'Nser', label: 'Nser [kN]', def: 667 },
      { id: 'sigmaSol', label: 'σ sol [kPa]', def: 200 }, { id: 'a', label: 'poteau a [m]', def: 0.4 },
      { id: 'b', label: 'poteau b [m]', def: 0.4 }, { id: 'fck', label: 'fck', def: 25 }, { id: 'fyk', label: 'fyk', def: 500 },
      { id: 'A_note', label: 'Côté A de la note [m]', def: 1.85, note: true },
      { id: 'As_note', label: 'As/direction de la note [cm²]', def: 9.5, note: true }
    ],
    soutenement: [
      { id: 'Hs', label: 'Hs [m]', def: 4.5 }, { id: 'ef', label: 'ef [m]', def: 0.5 }, { id: 'eVoile', label: 'ép. voile [m]', def: 0.5 },
      { id: 'patin', label: 'patin [m]', def: 0.8 }, { id: 'talon', label: 'talon [m]', def: 1.7 },
      { id: 'gamma', label: 'γ [kN/m³]', def: 18 }, { id: 'phi', label: 'φ [°]', def: 30 }, { id: 'delta', label: 'δ [°]', def: 20 },
      { id: 'q', label: 'q [kPa]', def: 10 }, { id: 'sigmaAdm', label: 'σ adm [kPa]', def: 200 }, { id: 'fck', label: 'fck', def: 25 }, { id: 'fyk', label: 'fyk', def: 500 },
      { id: 'FSrenv_note', label: 'FS renversement (note)', def: 2.7, note: true },
      { id: 'FSgliss_note', label: 'FS glissement (note)', def: 1.0, note: true },
      { id: 'sigMax_note', label: 'σ max (note) [kPa]', def: 145, note: true }
    ],
    canalisation: [
      { id: 'Qls', label: 'Débit Q [L/s]', def: 120 }, { id: 'I', label: 'Pente I [m/m]', def: 0.005 },
      { id: 'K', label: 'Strickler K', def: 80 }, { id: 'DN_note', label: 'DN adopté (note) [mm]', def: 315, note: true }
    ]
  };

  function renderFields() {
    const type = D.val('va_type');
    const cont = D.$('#va_fields'); D.clear(cont);
    const grid = D.el('div', { class: 'form-grid' });
    FIELDS[type].forEach((f) => {
      const field = D.el('div', { class: 'field' + (f.note ? ' note-field' : '') }, [
        D.el('label', {}, [f.note ? '📝 ' + f.label : f.label]),
        D.el('input', { type: 'number', step: 'any', id: 'va_' + f.id, value: f.def })
      ]);
      grid.appendChild(field);
    });
    cont.appendChild(grid);
  }

  function verdictBanner(verdict) {
    const map = {
      'CONFORME': ['banner-ok', '✓'],
      'AVEC RÉSERVES': ['banner-warn', '⚠'],
      'NON CONFORME': ['banner-nok', '✗']
    };
    const m = map[verdict] || map['AVEC RÉSERVES'];
    return `<div class="verdict ${m[0]}">${m[1]} Avis : ${verdict}</div>`;
  }

  function statutBadge(s) {
    if (s === 'OK') return '<span class="badge badge-ok">✓ OK</span>';
    if (s === 'NOK') return '<span class="badge badge-nok">✗ NOK</span>';
    return '<span class="badge badge-warn">⚠ réserve</span>';
  }

  function verifier() {
    const type = D.val('va_type');
    const data = {};
    FIELDS[type].forEach((f) => { data[f.id] = D.num('va_' + f.id); });
    let r;
    try { r = GC.validator.verifier(type, data); }
    catch (e) { D.$('#va_res').innerHTML = `<p class="error">${e.message}</p>`; return; }

    let html = verdictBanner(r.verdict);
    html += `<h4 style="margin:14px 0 8px">${r.type} — contrôles</h4>`;
    html += D.table(['Contrôle', 'Note', 'Référence', 'Statut', 'Correction proposée'],
      r.controles.map((c) => [
        c.libelle,
        (c.note != null ? D.fmt(c.note, 2) : '—') + (c.unite ? ' ' + c.unite : ''),
        (c.calcul != null ? D.fmt(c.calcul, 2) : '—') + (c.unite ? ' ' + c.unite : ''),
        statutBadge(c.statut),
        c.correction || '—'
      ]));
    if (r.recommandations && r.recommandations.length) {
      html += '<h5>Détails du recalcul</h5><ul class="notes" style="color:#34425a">' +
        r.recommandations.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    }
    D.$('#va_res').innerHTML = html;
  }

  function extraire() {
    const found = GC.validator.extraire(D.val('va_paste') || '');
    const type = D.val('va_type');
    const remap = { As: 'As_note', DN: 'DN_note', pente: 'I', FS: 'FSrenv_note' };
    let n = 0;
    Object.keys(found).forEach((k) => {
      if (found[k] == null) return;
      const target = remap[k] || k;
      const el = document.getElementById('va_' + target);
      if (el && FIELDS[type].some((f) => f.id === target)) { el.value = found[k]; n++; }
    });
    const msg = D.$('#va_extract_msg');
    if (msg) msg.textContent = n > 0 ? `${n} valeur(s) extraite(s) et préremplie(s) — vérifiez-les avant de valider.` : 'Aucune valeur reconnue automatiquement (saisie manuelle).';
  }

  function init() {
    renderFields();
    D.$('#va_type').addEventListener('change', () => { renderFields(); verifier(); });
    D.$('#va_verify').addEventListener('click', verifier);
    D.$('#va_extract').addEventListener('click', extraire);
    verifier();
  }

  GC.modules = GC.modules || {};
  GC.modules.validator = { init, verifier };
})();
