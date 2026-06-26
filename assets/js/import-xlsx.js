/* ============================================================================
 * HydroCalc — Import de classeurs Excel (.xlsx)
 * ----------------------------------------------------------------------------
 * Lit un fichier .xlsx sans dépendance externe : dézippage natif via
 * DecompressionStream (deflate-raw), lecture des cellules, puis correspondance
 * des données vers les modules pour les deux classeurs de référence.
 * ==========================================================================*/
(function (root) {
  'use strict';
  var Hydro = root.Hydro;

  /* --- Dézippage minimal d'un ArrayBuffer ZIP ----------------------------- */
  function u8(buf) { return new Uint8Array(buf); }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream indisponible');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return u8(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    var bytes = u8(buffer), dv = new DataView(buffer), files = {};
    // End Of Central Directory
    var eo = -1;
    for (var i = bytes.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    }
    if (eo < 0) throw new Error('ZIP invalide');
    var nEntries = dv.getUint16(eo + 10, true);
    var cd = dv.getUint32(eo + 16, true);
    var dec = new TextDecoder();
    for (var e = 0; e < nEntries; e++) {
      if (dv.getUint32(cd, true) !== 0x02014b50) break;
      var method = dv.getUint16(cd + 10, true);
      var compSize = dv.getUint32(cd + 20, true);
      var nameLen = dv.getUint16(cd + 28, true);
      var extraLen = dv.getUint16(cd + 30, true);
      var commentLen = dv.getUint16(cd + 32, true);
      var localOff = dv.getUint32(cd + 42, true);
      var name = dec.decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
      // En-tête local pour localiser les données
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;
      var comp = bytes.subarray(dataStart, dataStart + compSize);
      files[name] = { method: method, data: comp };
      cd += 46 + nameLen + extraLen + commentLen;
    }
    // Décompression à la demande
    var out = {};
    for (var fn in files) {
      var f = files[fn];
      out[fn] = (f.method === 0) ? new TextDecoder().decode(f.data)
                                 : new TextDecoder().decode(await inflateRaw(f.data));
    }
    return out;
  }

  /* --- Lecture des cellules d'une feuille --------------------------------- */
  function parseSharedStrings(xml) {
    if (!xml) return [];
    var strings = [], re = /<si>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml))) {
      var txt = m[1].replace(/<[^>]+>/g, '');
      strings.push(decodeEntities(txt));
    }
    return strings;
  }
  function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(n); });
  }
  function parseSheet(xml, shared) {
    var cells = {}, re = /<c r="([A-Z]+\d+)"([^>]*)>(?:<f[^>]*>[\s\S]*?<\/f>)?(?:<v>([\s\S]*?)<\/v>)?<\/c>/g, m;
    while ((m = re.exec(xml))) {
      var ref = m[1], attrs = m[2], v = m[3];
      if (v == null) continue;
      if (/t="s"/.test(attrs)) cells[ref] = shared[parseInt(v, 10)];
      else if (/t="str"/.test(attrs)) cells[ref] = decodeEntities(v);
      else cells[ref] = parseFloat(v);
    }
    return cells;
  }

  /** Mappe noms de feuilles -> cellules. */
  async function readWorkbook(buffer) {
    var files = await unzip(buffer);
    var shared = parseSharedStrings(files['xl/sharedStrings.xml']);
    // Correspondance nom de feuille -> fichier
    var wb = files['xl/workbook.xml'] || '';
    var rels = files['xl/_rels/workbook.xml.rels'] || '';
    var relMap = {}, rm;
    var reRel = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    while ((rm = reRel.exec(rels))) relMap[rm[1]] = rm[2].replace(/^\/?xl\//, '');
    var sheets = {}, sm;
    var reSheet = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
    while ((sm = reSheet.exec(wb))) {
      var target = relMap[sm[2]];
      var key = 'xl/' + target;
      if (files[key]) sheets[decodeEntities(sm[1])] = parseSheet(files[key], shared);
    }
    return sheets;
  }

  /* --- Correspondance vers les modules HydroCalc -------------------------- */
  // [feuille, cellule, module, champ, facteur]
  var MAP_COMPLET = [
    ['Données et Conduite', 'C5', 'conduite', 'Q', 1],
    ['Données et Conduite', 'C6', 'conduite', 'Qmoy', 1],
    ['Données et Conduite', 'C8', 'conduite', 'L', 1],
    ['Données et Conduite', 'C9', 'conduite', 'Zamont', 1],
    ['Données et Conduite', 'C10', 'conduite', 'Zaval', 1],
    ['Données et Conduite', 'C13', 'conduite', 'eps', 1],
    ['Données et Conduite', 'C27', 'conduite', 'Veco', 1],
    ['Données et Conduite', 'C29', 'conduite', 'DN', 1],
    ['Données et Conduite', 'C30', 'conduite', 'Di', 1],
    ['Données et Conduite', 'C12', 'fluide', 'T', 1],
    ['Station Pompage', 'C7', 'pompage', 'Pres', 1],
    ['Station Pompage', 'C8', 'pompage', 'dHstation', 1],
    ['Station Pompage', 'C21', 'pompage', 'etaP', 1],
    ['Station Pompage', 'C22', 'pompage', 'etaM', 1],
    ['Station Pompage', 'C39', 'pompage', 'NPSHr', 1],
    ['Bilan Énergétique', 'C5', 'energie', 'Van', 1],
    ['Bilan Énergétique', 'C11', 'energie', 'prixkWh', 1]
  ];
  var MAP_LOGICIEL = [
    ['Pertes de charge', 'B4', 'conduite', 'Q', 3.6],   // L/s -> m³/h
    ['Pertes de charge', 'B5', 'conduite', 'Di', 1],
    ['Pertes de charge', 'B6', 'conduite', 'L', 1],
    ['Pertes de charge', 'B7', 'conduite', 'eps', 1],
    ['Pompage', 'B5', 'pompage', 'Hgeo', 1],
    ['Pompage', 'B8', 'pompage', 'etaP', 1],
    ['Pompage', 'B9', 'pompage', 'etaM', 1],
    ['Methode des pluies', 'B4', 'pluies', 'Sa', 1],
    ['Methode des pluies', 'B5', 'pluies', 'a', 1],
    ['Methode des pluies', 'B6', 'pluies', 'b', 1],
    ['Methode des pluies', 'B7', 'pluies', 'q', 1],
    ['Bassin de retention', 'B4', 'bassin', 'V', 1],
    ['Bassin de retention', 'B5', 'bassin', 'h', 1],
    ['Bassin de retention', 'B7', 'bassin', 'Qf', 1],
    ['Reseau', 'B4', 'surfacelibre', 'D', 1],
    ['Reseau', 'B5', 'surfacelibre', 'I', 1]
  ];

  function applyMap(sheets, map, state) {
    var n = 0;
    map.forEach(function (row) {
      var sh = sheets[row[0]];
      if (!sh) return;
      var val = sh[row[1]];
      if (typeof val !== 'number' || !isFinite(val)) return;
      var mid = row[2], key = row[3];
      state.values[mid] = state.values[mid] || {};
      state.edited[mid] = state.edited[mid] || {};
      state.values[mid][key] = val * row[4];
      state.edited[mid][key] = true;
      n++;
    });
    return n;
  }

  Hydro.importXLSX = function (file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      readWorkbook(reader.result).then(function (sheets) {
        var state = Hydro.getState();
        var names = Object.keys(sheets);
        var n = 0;
        if (names.indexOf('Données et Conduite') >= 0) n += applyMap(sheets, MAP_COMPLET, state);
        if (names.indexOf('Pertes de charge') >= 0) n += applyMap(sheets, MAP_LOGICIEL, state);
        done(n, names);
      }).catch(function (e) { done(-1, [], e); });
    };
    reader.readAsArrayBuffer(file);
  };

})(typeof window !== 'undefined' ? window : this);
