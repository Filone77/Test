/*
 * quantities.js — Métré (avant-métré) et fondations superficielles.
 * Métré béton / coffrage / acier + estimation de coût.
 * Semelle isolée par la méthode des bielles (EC2 / DTU 13).
 */
(function (root, factory) {
  'use strict';
  const api = factory(
    typeof require === 'function' ? require('./core.js') : root.GC.core
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GC = root.GC || {};
    root.GC.quantities = api;
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  const round = core.round;
  const DENSITE_ACIER = 7850; // kg/m³

  // Prix indicatifs par défaut (modifiables côté UI)
  const PRIX = { beton: 130, acier: 1.5, coffrage: 45 }; // €/m³, €/kg, €/m²

  /**
   * Métré d'une liste d'éléments en béton armé.
   * Chaque élément : {type:'poutre'|'poteau'|'dalle'|'semelle'|'voile',
   *                    b,h,longueur [m], nombre, ratioAcier [kg/m³]}
   */
  function metre(elements, prix) {
    prix = Object.assign({}, PRIX, prix || {});
    let totBeton = 0, totCoffrage = 0, totAcier = 0;
    const lignes = elements.map((el) => {
      const n = el.nombre || 1;
      const b = el.b, h = el.h, L = el.longueur;
      const volUnit = b * h * L;
      let coffUnit;
      switch (el.type) {
        case 'poteau':
          coffUnit = 2 * (b + h) * L; // 4 faces
          break;
        case 'dalle':
          coffUnit = b * L + 2 * (b + L) * h; // sous-face + rives
          break;
        case 'voile':
          coffUnit = 2 * h * L; // 2 grandes faces (b = épaisseur)
          break;
        case 'semelle':
          coffUnit = 2 * (b + L) * h; // pourtour
          break;
        case 'poutre':
        default:
          coffUnit = (2 * h + b) * L; // 2 joues + fond
      }
      const vol = volUnit * n;
      const coff = coffUnit * n;
      const ratio = el.ratioAcier != null ? el.ratioAcier : ratioParDefaut(el.type);
      const acier = vol * ratio;
      totBeton += vol; totCoffrage += coff; totAcier += acier;
      return {
        type: el.type, nombre: n,
        dimensions: `${b}×${h}×${L} m`,
        beton: round(vol, 3),
        coffrage: round(coff, 2),
        ratioAcier: ratio,
        acier: round(acier, 1)
      };
    });
    const cout = {
      beton: round(totBeton * prix.beton, 2),
      acier: round(totAcier * prix.acier, 2),
      coffrage: round(totCoffrage * prix.coffrage, 2)
    };
    cout.total = round(cout.beton + cout.acier + cout.coffrage, 2);
    return {
      lignes,
      totaux: {
        beton: round(totBeton, 3),
        coffrage: round(totCoffrage, 2),
        acier: round(totAcier, 1)
      },
      prix, cout
    };
  }

  function ratioParDefaut(type) {
    switch (type) {
      case 'poteau': return 110;
      case 'poutre': return 130;
      case 'dalle': return 90;
      case 'semelle': return 70;
      case 'voile': return 60;
      default: return 100;
    }
  }

  /**
   * Semelle isolée carrée — méthode des bielles (EC2 §6.5 / DTU 13.12).
   * @param {object} p
   * @param {number} p.NEd  charge ELU à la base du poteau [kN]
   * @param {number} [p.Nser] charge ELS pour la vérification du sol [kN]
   * @param {number} p.sigmaSol contrainte admissible du sol [kPa]
   * @param {number} p.a   largeur du poteau [m]
   * @param {number} p.b   profondeur du poteau [m]
   * @param {number} p.fck [MPa], p.fyk [MPa]
   */
  function semelleIsolee(p) {
    const Nser = p.Nser != null ? p.Nser : p.NEd / 1.35; // estimation ELS
    const sigma = p.sigmaSol; // kPa
    const a = p.a, b = p.b;

    // Surface requise (ELS) puis dimensions homothétiques
    const Sreq = Nser / sigma; // m²
    // semelle carrée dimensionnée >= côté poteau, multiple de 0.05 m
    let A = Math.max(Math.sqrt(Sreq), a, b);
    A = Math.ceil(A / 0.05) * 0.05;
    let B = A; // carrée

    const sigmaSol = Nser / (A * B); // kPa réel

    // hauteur utile (condition de rigidité des bielles) : d ≥ (A - a)/4
    const dA = (A - a) / 4;
    const dB = (B - b) / 4;
    let d = Math.max(dA, dB, 0.15);
    d = Math.ceil(d / 0.05) * 0.05;
    const enrobage = p.enrobage != null ? p.enrobage : 0.05; // m
    const H = round(d + enrobage, 2);

    // Aciers (méthode des bielles), nappe inférieure, par direction
    const fyd = p.fyk / 1.15 * 1000; // kPa
    const NEd = p.NEd;
    const AsX = NEd * (A - a) / (8 * d * fyd); // m²
    const AsY = NEd * (B - b) / (8 * d * fyd);
    const AsXcm2 = AsX * 1e4;
    const AsYcm2 = AsY * 1e4;

    // poids propre indicatif
    const poids = A * B * H * 25; // kN (béton 25 kN/m³)

    return {
      Nser: round(Nser, 1),
      NEd: round(NEd, 1),
      Sreq: round(Sreq, 3),
      A: round(A, 2), B: round(B, 2),
      H, d: round(d, 2),
      sigmaSol: round(sigmaSol, 1),
      sigmaAdm: sigma,
      verifSol: sigmaSol <= sigma,
      AsX: round(AsXcm2, 2),
      AsY: round(AsYcm2, 2),
      choixX: core.choisirBarres(AsXcm2 * 100).slice(0, 4),
      poids: round(poids, 1),
      volume: round(A * B * H, 3),
      statut: sigmaSol <= sigma ? 'OK' : 'NOK',
      messages: sigmaSol <= sigma ? [] : ['Contrainte sur le sol dépassée : agrandir la semelle.']
    };
  }

  return { metre, semelleIsolee, ratioParDefaut, PRIX, DENSITE_ACIER };
});
