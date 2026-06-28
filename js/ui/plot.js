/* plot.js — tracé de diagrammes en SVG (pas de librairie externe) */
(function () {
  'use strict';
  window.GC = window.GC || {};
  const NS = 'http://www.w3.org/2000/svg';

  function svg(w, h) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('class', 'plot');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return s;
  }
  function node(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function text(x, y, str, attrs) {
    const t = node('text', Object.assign({ x, y }, attrs || {}));
    t.textContent = str;
    return t;
  }

  /**
   * Diagramme courbe (V, M ou flèche) le long de x.
   * @param {Array<{x:number}>} data
   * @param {object} opt {yKey, color, fill, title, unit, invert}
   */
  function diagram(container, data, opt) {
    container.innerHTML = '';
    const W = 680, H = 220, mL = 52, mR = 18, mT = 28, mB = 30;
    const s = svg(W, H);
    const xs = data.map((d) => d.x);
    const ys = data.map((d) => d[opt.yKey]);
    const xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    let yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.12;
    yMin -= pad; yMax += pad;

    const px = (x) => mL + (x - xMin) / (xMax - xMin || 1) * (W - mL - mR);
    const invert = opt.invert;
    const py = (y) => {
      const t = (y - yMin) / (yMax - yMin || 1);
      return invert ? mT + t * (H - mT - mB) : (H - mB) - t * (H - mT - mB);
    };

    // cadre + grille
    s.appendChild(node('rect', { x: mL, y: mT, width: W - mL - mR, height: H - mT - mB, fill: '#fff', stroke: '#e1e6ee' }));
    // axe zéro
    const y0 = py(0);
    s.appendChild(node('line', { x1: mL, y1: y0, x2: W - mR, y2: y0, stroke: '#9aa5b5', 'stroke-dasharray': '4 3' }));

    // aire + courbe
    let dPath = '';
    data.forEach((d, i) => { dPath += (i === 0 ? 'M' : 'L') + px(d.x) + ' ' + py(d[opt.yKey]); });
    const area = `M${px(xMin)} ${y0} ` + data.map((d) => 'L' + px(d.x) + ' ' + py(d[opt.yKey])).join(' ') + ` L${px(xMax)} ${y0} Z`;
    s.appendChild(node('path', { d: area, fill: opt.fill || 'rgba(27,58,91,0.10)', stroke: 'none' }));
    s.appendChild(node('path', { d: dPath, fill: 'none', stroke: opt.color || '#1b3a5b', 'stroke-width': 2 }));

    // extrema
    const iMax = ys.indexOf(Math.max.apply(null, ys));
    const iMin = ys.indexOf(Math.min.apply(null, ys));
    [iMax, iMin].forEach((i) => {
      if (Math.abs(ys[i]) < 1e-9) return;
      s.appendChild(node('circle', { cx: px(xs[i]), cy: py(ys[i]), r: 3, fill: opt.color || '#1b3a5b' }));
      const lbl = text(px(xs[i]), py(ys[i]) + (ys[i] >= 0 ? -6 : 14), GC.dom.fmt(ys[i], 1), { 'font-size': 11, fill: '#11203a', 'text-anchor': 'middle', 'font-weight': 600 });
      s.appendChild(lbl);
    });

    // graduations x
    for (let k = 0; k <= 5; k++) {
      const xv = xMin + (xMax - xMin) * k / 5;
      s.appendChild(text(px(xv), H - 10, GC.dom.fmt(xv, 1), { 'font-size': 10, fill: '#5a6678', 'text-anchor': 'middle' }));
    }
    // graduations y
    [yMax, (yMax + yMin) / 2, yMin].forEach((yv) => {
      s.appendChild(text(mL - 6, py(yv) + 3, GC.dom.fmt(yv, 0), { 'font-size': 10, fill: '#5a6678', 'text-anchor': 'end' }));
    });
    // titre
    s.appendChild(text(mL, 18, opt.title || '', { 'font-size': 12, fill: '#11203a', 'font-weight': 700 }));
    s.appendChild(text(W - mR, 18, opt.unit || '', { 'font-size': 11, fill: '#5a6678', 'text-anchor': 'end' }));
    container.appendChild(s);
  }

  /** Schéma de la poutre : ligne, appuis, charges. */
  function beamSchematic(container, model) {
    container.innerHTML = '';
    const W = 680, H = 130, mL = 30, mR = 30, yB = 60;
    const s = svg(W, H);
    const supports = model.supports.slice().sort((a, b) => a.x - b.x);
    const x0 = supports[0].x, x1 = supports[supports.length - 1].x;
    const px = (x) => mL + (x - x0) / (x1 - x0 || 1) * (W - mL - mR);

    // poutre
    s.appendChild(node('line', { x1: px(x0), y1: yB, x2: px(x1), y2: yB, stroke: '#1b3a5b', 'stroke-width': 5 }));

    // appuis
    supports.forEach((sp) => {
      const x = px(sp.x);
      if (sp.type === 'appui') {
        s.appendChild(node('polygon', { points: `${x},${yB} ${x - 9},${yB + 16} ${x + 9},${yB + 16}`, fill: '#fff', stroke: '#1b3a5b', 'stroke-width': 1.5 }));
        s.appendChild(node('line', { x1: x - 12, y1: yB + 20, x2: x + 12, y2: yB + 20, stroke: '#1b3a5b', 'stroke-width': 1.5 }));
      } else if (sp.type === 'encastrement') {
        s.appendChild(node('rect', { x: x < W / 2 ? x - 6 : x, y: yB - 18, width: 6, height: 36, fill: '#1b3a5b' }));
        for (let i = -16; i <= 16; i += 6) {
          s.appendChild(node('line', { x1: x < W / 2 ? x - 6 : x + 6, y1: yB + i, x2: x < W / 2 ? x - 12 : x + 12, y2: yB + i + 4, stroke: '#1b3a5b' }));
        }
      }
      s.appendChild(text(x, yB + 36, GC.dom.fmt(sp.x, 1) + ' m', { 'font-size': 10, fill: '#5a6678', 'text-anchor': 'middle' }));
    });

    // charges réparties
    (model.distLoads || []).forEach((d) => {
      const xa = px(Math.min(d.x1, d.x2)), xb = px(Math.max(d.x1, d.x2));
      s.appendChild(node('rect', { x: xa, y: yB - 30, width: xb - xa, height: 18, fill: 'rgba(224,138,30,0.18)', stroke: '#e08a1e' }));
      for (let x = xa + 6; x <= xb; x += 16) {
        s.appendChild(node('line', { x1: x, y1: yB - 30, x2: x, y2: yB - 4, stroke: '#e08a1e', 'marker-end': 'url(#arr)' }));
      }
      s.appendChild(text((xa + xb) / 2, yB - 34, d.w + ' kN/m', { 'font-size': 10, fill: '#b5710f', 'text-anchor': 'middle', 'font-weight': 600 }));
    });
    // charges ponctuelles
    (model.pointLoads || []).forEach((p) => {
      const x = px(p.x);
      s.appendChild(node('line', { x1: x, y1: yB - 42, x2: x, y2: yB - 4, stroke: '#c0392b', 'stroke-width': 2, 'marker-end': 'url(#arrR)' }));
      s.appendChild(text(x, yB - 46, p.P + ' kN', { 'font-size': 10, fill: '#c0392b', 'text-anchor': 'middle', 'font-weight': 600 }));
    });

    // marqueurs de flèches
    const defs = node('defs', {});
    [['arr', '#e08a1e'], ['arrR', '#c0392b']].forEach(([id, col]) => {
      const m = node('marker', { id, markerWidth: 6, markerHeight: 6, refX: 3, refY: 5, orient: 'auto' });
      m.appendChild(node('path', { d: 'M0,0 L6,0 L3,6 Z', fill: col }));
      defs.appendChild(m);
    });
    s.insertBefore(defs, s.firstChild);
    container.appendChild(s);
  }

  /** Diagramme d'interaction N-M d'un poteau + point sollicitant. */
  function interaction(container, pts, pt) {
    container.innerHTML = '';
    const W = 420, H = 320, mL = 56, mR = 18, mT = 24, mB = 40;
    const s = svg(W, H);
    const Ns = pts.map((p) => p.N), Ms = pts.map((p) => p.M);
    const Nmax = Math.max.apply(null, Ns) * 1.05;
    const Nmin = Math.min(0, Math.min.apply(null, Ns));
    const Mmax = Math.max(Math.max.apply(null, Ms), pt ? pt.M : 0) * 1.15;
    const px = (m) => mL + m / (Mmax || 1) * (W - mL - mR);
    const py = (n) => (H - mB) - (n - Nmin) / (Nmax - Nmin || 1) * (H - mT - mB);

    s.appendChild(node('rect', { x: mL, y: mT, width: W - mL - mR, height: H - mT - mB, fill: '#fff', stroke: '#e1e6ee' }));
    let d = '';
    pts.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + px(p.M) + ' ' + py(p.N); });
    s.appendChild(node('path', { d, fill: 'rgba(27,58,91,0.08)', stroke: '#1b3a5b', 'stroke-width': 2 }));

    if (pt) {
      const inside = true;
      s.appendChild(node('circle', { cx: px(pt.M), cy: py(pt.N), r: 5, fill: '#c0392b', stroke: '#fff', 'stroke-width': 1.5 }));
      s.appendChild(text(px(pt.M) + 8, py(pt.N) + 4, `(${GC.dom.fmt(pt.M, 0)} ; ${GC.dom.fmt(pt.N, 0)})`, { 'font-size': 10, fill: '#c0392b' }));
    }
    s.appendChild(text(mL, 16, 'Diagramme d’interaction N–M', { 'font-size': 12, 'font-weight': 700, fill: '#11203a' }));
    s.appendChild(text((W) / 2, H - 8, 'M [kN·m]', { 'font-size': 11, fill: '#5a6678', 'text-anchor': 'middle' }));
    s.appendChild(text(14, mT + 6, 'N [kN]', { 'font-size': 11, fill: '#5a6678' }));
    // graduations
    for (let k = 0; k <= 4; k++) {
      s.appendChild(text(px(Mmax * k / 4), H - mB + 14, GC.dom.fmt(Mmax * k / 4, 0), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'middle' }));
      s.appendChild(text(mL - 6, py(Nmin + (Nmax - Nmin) * k / 4) + 3, GC.dom.fmt(Nmin + (Nmax - Nmin) * k / 4, 0), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'end' }));
    }
    container.appendChild(s);
  }

  /** Tracé de plusieurs courbes y(x) sur un même graphe, avec point remarquable. */
  function courbes(container, series, opt) {
    container.innerHTML = '';
    opt = opt || {};
    const W = 560, H = 320, mL = 56, mR = 18, mT = 26, mB = 42;
    const s = svg(W, H);
    let xMax = 0, yMax = 0;
    series.forEach((se) => se.data.forEach((p) => { xMax = Math.max(xMax, p.x); yMax = Math.max(yMax, p.y); }));
    if (opt.point) { xMax = Math.max(xMax, opt.point.x); yMax = Math.max(yMax, opt.point.y); }
    xMax *= 1.05; yMax *= 1.1;
    const px = (x) => mL + x / (xMax || 1) * (W - mL - mR);
    const py = (y) => (H - mB) - y / (yMax || 1) * (H - mT - mB);

    s.appendChild(node('rect', { x: mL, y: mT, width: W - mL - mR, height: H - mT - mB, fill: '#fff', stroke: '#e1e6ee' }));
    series.forEach((se) => {
      let d = '';
      se.data.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + px(p.x) + ' ' + py(p.y); });
      s.appendChild(node('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2 }));
    });
    if (opt.point) {
      s.appendChild(node('line', { x1: px(opt.point.x), y1: py(0), x2: px(opt.point.x), y2: py(opt.point.y), stroke: '#888', 'stroke-dasharray': '4 3' }));
      s.appendChild(node('line', { x1: mL, y1: py(opt.point.y), x2: px(opt.point.x), y2: py(opt.point.y), stroke: '#888', 'stroke-dasharray': '4 3' }));
      s.appendChild(node('circle', { cx: px(opt.point.x), cy: py(opt.point.y), r: 5, fill: '#c0392b', stroke: '#fff', 'stroke-width': 1.5 }));
      s.appendChild(text(px(opt.point.x) + 8, py(opt.point.y) - 6, `(${GC.dom.fmt(opt.point.x, 0)} ; ${GC.dom.fmt(opt.point.y, 1)})`, { 'font-size': 11, fill: '#c0392b', 'font-weight': 700 }));
    }
    // légende
    series.forEach((se, i) => {
      s.appendChild(node('line', { x1: mL + 8 + i * 130, y1: mT - 10, x2: mL + 26 + i * 130, y2: mT - 10, stroke: se.color, 'stroke-width': 3 }));
      s.appendChild(text(mL + 30 + i * 130, mT - 6, se.name, { 'font-size': 11, fill: '#34425a' }));
    });
    for (let k = 0; k <= 4; k++) {
      s.appendChild(text(px(xMax * k / 4), H - mB + 14, GC.dom.fmt(xMax * k / 4, 0), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'middle' }));
      s.appendChild(text(mL - 6, py(yMax * k / 4) + 3, GC.dom.fmt(yMax * k / 4, 0), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'end' }));
    }
    s.appendChild(text(W / 2, H - 6, opt.xlabel || '', { 'font-size': 11, fill: '#5a6678', 'text-anchor': 'middle' }));
    s.appendChild(text(14, mT + 4, opt.ylabel || '', { 'font-size': 11, fill: '#5a6678' }));
    container.appendChild(s);
  }

  /** Profil en long d'un réseau gravitaire (terrain, fil d'eau, tuyau, regards). */
  function profilLong(container, noeuds, opt) {
    container.innerHTML = '';
    opt = opt || {};
    const W = 820, H = 360, mL = 58, mR = 16, mT = 24, mB = 64;
    const s = svg(W, H);
    const PMs = noeuds.map((n) => n.PM);
    const pmMin = Math.min.apply(null, PMs), pmMax = Math.max.apply(null, PMs);
    let cMin = Infinity, cMax = -Infinity;
    noeuds.forEach((n) => { cMin = Math.min(cMin, n.fondFouille); cMax = Math.max(cMax, n.TN); });
    if (opt.hgl) opt.hgl.forEach((h) => { cMax = Math.max(cMax, h.HGL); });
    const pad = (cMax - cMin) * 0.12 || 1;
    cMin -= pad; cMax += pad;
    const px = (pm) => mL + (pm - pmMin) / (pmMax - pmMin || 1) * (W - mL - mR);
    const py = (c) => (H - mB) - (c - cMin) / (cMax - cMin || 1) * (H - mT - mB);
    const fa = (n) => n.filEauAval != null ? n.filEauAval : n.filEau;
    const fm = (n) => n.filEauAmont != null ? n.filEauAmont : n.filEau;
    const ca = (n) => n.crownAval != null ? n.crownAval : n.crown;
    const cm = (n) => n.crownAmont != null ? n.crownAmont : n.crown;

    s.appendChild(node('rect', { x: mL, y: mT, width: W - mL - mR, height: H - mT - mB, fill: '#fff', stroke: '#e1e6ee' }));

    // bande de tuyau (fil d'eau → génératrice supérieure), avec chutes éventuelles
    for (let k = 0; k < noeuds.length - 1; k++) {
      const a = noeuds[k], b = noeuds[k + 1];
      const poly = `${px(a.PM)},${py(ca(a))} ${px(b.PM)},${py(cm(b))} ${px(b.PM)},${py(fm(b))} ${px(a.PM)},${py(fa(a))}`;
      s.appendChild(node('polygon', { points: poly, fill: 'rgba(27,58,91,0.18)', stroke: '#1b3a5b', 'stroke-width': 1 }));
    }
    // décrochements (chutes) dans les regards
    noeuds.forEach((n) => {
      if (n.chute > 0.001) {
        s.appendChild(node('line', { x1: px(n.PM), y1: py(fm(n)), x2: px(n.PM), y2: py(fa(n)), stroke: '#c0392b', 'stroke-width': 2.5 }));
        s.appendChild(text(px(n.PM) + 6, (py(fm(n)) + py(fa(n))) / 2, '▼' + GC.dom.fmt(n.chute, 2), { 'font-size': 9, fill: '#c0392b' }));
      }
    });
    // regards (TN → fond de fouille)
    noeuds.forEach((n) => {
      s.appendChild(node('rect', { x: px(n.PM) - 4, y: py(n.TN), width: 8, height: py(n.fondFouille) - py(n.TN), fill: '#cfd8e6', stroke: '#8aa0bd' }));
    });
    // ligne piézométrique (mise en charge)
    if (opt.hgl) {
      let dH = '';
      opt.hgl.forEach((h, i) => { dH += (i === 0 ? 'M' : 'L') + px(h.PM) + ' ' + py(h.HGL); });
      s.appendChild(node('path', { d: dH, fill: 'none', stroke: '#2e7d32', 'stroke-width': 1.8, 'stroke-dasharray': '6 3' }));
    }
    // terrain naturel
    let dTN = '';
    noeuds.forEach((n, i) => { dTN += (i === 0 ? 'M' : 'L') + px(n.PM) + ' ' + py(n.TN); });
    s.appendChild(node('path', { d: dTN, fill: 'none', stroke: '#9c6b2f', 'stroke-width': 2 }));
    // fond de fouille (pointillé)
    let dF = '';
    noeuds.forEach((n, i) => { dF += (i === 0 ? 'M' : 'L') + px(n.PM) + ' ' + py(n.fondFouille); });
    s.appendChild(node('path', { d: dF, fill: 'none', stroke: '#b0392b', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));

    // étiquettes des regards
    noeuds.forEach((n) => {
      s.appendChild(text(px(n.PM), py(n.TN) - 6, n.nom, { 'font-size': 10, fill: '#11203a', 'text-anchor': 'middle', 'font-weight': 700 }));
      s.appendChild(text(px(n.PM), H - mB + 14, 'PM ' + GC.dom.fmt(n.PM, 0), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'middle' }));
      s.appendChild(text(px(n.PM), H - mB + 26, 'FE ' + GC.dom.fmt(n.filEau, 2), { 'font-size': 9, fill: '#1b3a5b', 'text-anchor': 'middle' }));
      s.appendChild(text(px(n.PM), H - mB + 38, 'TN ' + GC.dom.fmt(n.TN, 2), { 'font-size': 9, fill: '#9c6b2f', 'text-anchor': 'middle' }));
    });
    // graduations cote
    [cMax, (cMax + cMin) / 2, cMin].forEach((cv) => {
      s.appendChild(text(mL - 6, py(cv) + 3, GC.dom.fmt(cv, 1), { 'font-size': 9, fill: '#5a6678', 'text-anchor': 'end' }));
    });
    // légende
    const leg = [['Terrain', '#9c6b2f'], ['Fil d’eau / tuyau', '#1b3a5b'], ['Fond de fouille', '#b0392b']];
    leg.forEach((l, i) => {
      s.appendChild(node('line', { x1: mL + 6 + i * 150, y1: 14, x2: mL + 24 + i * 150, y2: 14, stroke: l[1], 'stroke-width': 3 }));
      s.appendChild(text(mL + 28 + i * 150, 18, l[0], { 'font-size': 10, fill: '#34425a' }));
    });
    container.appendChild(s);
  }

  GC.plot = { diagram, beamSchematic, interaction, courbes, profilLong };
})();
