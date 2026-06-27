/* report.js — génération d'une note de calcul imprimable (→ PDF via le navigateur) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const D = GC.dom;

  function readInputs(container) {
    if (!container) return [];
    const rows = [];
    container.querySelectorAll('.field').forEach((f) => {
      const lab = f.querySelector('label');
      const inp = f.querySelector('input, select');
      if (!lab || !inp) return;
      let v = inp.value;
      if (inp.tagName === 'SELECT' && inp.selectedIndex >= 0) v = inp.options[inp.selectedIndex].text;
      if (v === '' || v == null) return;
      rows.push([lab.textContent.trim(), v]);
    });
    return rows;
  }

  /** Construit le document HTML complet de la note de calcul. */
  function build(titre, inputsRows, resultHTML) {
    const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    let inputsTable = '';
    if (inputsRows && inputsRows.length) {
      inputsTable = '<h2>Données d’entrée</h2><table>' +
        inputsRows.map((r) => `<tr><td class="lbl">${r[0]}</td><td>${r[1]}</td></tr>`).join('') +
        '</table>';
    }
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Note de calcul — ${titre}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1b2433; margin: 0; padding: 28px 34px; font-size: 12px; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1b3a5b; padding-bottom: 12px; margin-bottom: 18px; }
  .hd .logo { font-size: 1.5rem; font-weight: 800; color: #1b3a5b; }
  .hd .logo .m { background: #e08a1e; color: #15314f; padding: 1px 7px; border-radius: 5px; margin-right: 6px; }
  .hd .sub { color: #61708a; font-size: 0.78rem; }
  .hd .meta { text-align: right; font-size: 0.78rem; color: #61708a; }
  h1 { font-size: 1.25rem; color: #1b3a5b; margin: 6px 0 16px; }
  h2 { font-size: 0.95rem; color: #1b3a5b; text-transform: uppercase; letter-spacing: 0.4px; margin: 18px 0 8px; border-bottom: 1px solid #dfe4ec; padding-bottom: 4px; }
  h4 { margin: 0 0 8px; font-size: 1rem; }
  h5 { margin: 14px 0 6px; color: #1b3a5b; font-size: 0.82rem; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td, th { padding: 5px 9px; border-bottom: 1px solid #edf1f6; text-align: left; font-size: 11.5px; }
  th { background: #eef3fa; color: #1b3a5b; }
  td.lbl { color: #61708a; width: 50%; }
  .badge { padding: 2px 9px; border-radius: 12px; font-weight: 700; font-size: 0.78rem; }
  .badge-ok { background: #e3f3e4; color: #2e7d32; }
  .badge-nok { background: #fbe4e1; color: #c0392b; }
  .result-head { display: flex; gap: 10px; align-items: center; margin: 4px 0 8px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
  .kpi { border: 1px solid #dfe4ec; border-radius: 8px; padding: 8px 12px; }
  .kpi-label { font-size: 0.7rem; color: #61708a; text-transform: uppercase; }
  .kpi-val { font-size: 1.1rem; font-weight: 700; color: #1b3a5b; }
  .kpi-sub { font-size: 0.7rem; color: #61708a; }
  .notes { color: #7a4d12; font-size: 0.8rem; }
  .muted { color: #61708a; font-size: 0.8rem; }
  svg.plot { width: 100%; max-width: 640px; height: auto; border: 1px solid #dfe4ec; border-radius: 6px; }
  .foot { margin-top: 26px; border-top: 1px solid #dfe4ec; padding-top: 10px; font-size: 0.72rem; color: #8a96a8; }
  .disclaimer { background: #fff8ec; border: 1px solid #f0dcb8; border-radius: 8px; padding: 9px 12px; font-size: 0.74rem; color: #7a5a1c; margin-top: 12px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head><body>
  <div class="hd">
    <div><div class="logo"><span class="m">▟</span>GéniCivil</div><div class="sub">Calcul de structures · Eurocodes</div></div>
    <div class="meta">Note de calcul<br>${date}</div>
  </div>
  <h1>${titre}</h1>
  ${inputsTable}
  <h2>Résultats</h2>
  ${resultHTML}
  <div class="disclaimer">⚠ Outil d'aide à l'avant-projet à but pédagogique. Résultats à vérifier par un ingénieur qualifié ; ne remplace pas une note de calcul réglementaire (combinaisons d'actions, ELS, dispositions constructives).</div>
  <div class="foot">Généré par GéniCivil — calculs selon les Eurocodes (valeurs recommandées).</div>
</body></html>`;
  }

  function print(titre, inputsRows, resultHTML) {
    const html = build(titre, inputsRows, resultHTML);
    const w = window.open('', '_blank');
    if (!w) { alert('Veuillez autoriser les fenêtres pop-up pour générer la note de calcul.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { /* impression annulée */ } }, 350);
  }

  /** Construit la note à partir d'une carte de formulaire et d'un panneau de résultats. */
  function fromForm(titre, formEl, resultEl) {
    const inputs = readInputs(formEl);
    const html = resultEl ? resultEl.innerHTML : '';
    if (!html.trim()) { alert('Lancez d’abord un calcul avant d’exporter la note.'); return; }
    print(titre, inputs, html);
  }

  GC.report = { build, print, fromForm, readInputs };
})();
