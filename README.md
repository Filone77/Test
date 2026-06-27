# GéniCivil — Logiciel de calcul de génie civil

Application web complète de calcul de structures conforme aux **Eurocodes**.
Elle fonctionne **entièrement dans le navigateur** : aucune installation, aucun
serveur, aucune donnée transmise. Le moteur de calcul est séparé de l'interface
et **validé par une suite de tests automatisés** comparés à des solutions
analytiques connues.

![Aperçu — Analyse de structures](assets/apercu-structures.png)

## Modules

| Module | Norme | Contenu |
|--------|-------|---------|
| **Béton armé** | EN 1992-1-1 | Flexion simple (section simplement/doublement armée), **poutre en Té** (axe neutre table/âme), effort tranchant (treillis de bielles), poteau en flexion composée avec **diagramme d'interaction N-M**, dalle pleine |
| **Analyse de structures (RDM)** | Éléments finis | Poutre continue par la **méthode de la raideur directe** (élément d'Euler-Bernoulli) : réactions, effort tranchant V(x), moment fléchissant M(x), déformée, **vérification ELS de la flèche** par travée (L/250, L/300, L/500) |
| **Charpente acier** | EN 1993-1-1 | Base de profilés **IPE / HEA / HEB**, traction, **flambement par flexion**, flexion, cisaillement, interaction N+M |
| **Métré & Fondations** | Avant-métré / DTU | Quantités béton / coffrage / acier, estimation de coût, **semelle isolée** par la méthode des bielles |
| **Charges climatiques** | EN 1991-1-3 / 1-4 | **Neige** (s = μ₁·Ce·Ct·sk, zones françaises + altitude) et **vent** (pression dynamique de pointe qp(z), pression sur paroi) |

Chaque module permet d'**exporter une note de calcul en PDF** (bouton « Note PDF »,
via l'impression du navigateur) : en-tête, données d'entrée, résultats et avertissement.

## Démarrage

L'application n'a **aucune dépendance** pour fonctionner. Deux possibilités :

1. **Ouvrir directement** le fichier `index.html` dans un navigateur.
2. **Servir** le dossier (recommandé) :

   ```bash
   python3 -m http.server 8080
   # puis ouvrir http://localhost:8080
   ```

## Tests

Le moteur de calcul est testable hors navigateur, sous Node.js :

```bash
npm test            # 43 vérifications contre des résultats analytiques
npm run test:browser  # rendu réel dans Chromium (Playwright) + captures
```

Exemples de cas vérifiés :

- Poutre 300×500, fck25, MEd=200 kN·m → **As ≈ 1150 mm²**, z = 400 mm
- Poutre en Té (axe neutre dans l'âme), MEd=400 kN·m → **As ≈ 2330 mm²**
- Poutre sur 2 appuis, L=6 m, w=10 kN/m → R=30 kN, **Mmax = 45 kN·m**, flèche = 16,9 mm
- Poutre continue 2×5 m → réaction centrale **62,5 kN**, moment sur appui −31,25 kN·m
- IPE 200 S235, Lcr=3 m → λ̄=1,43, χ=0,37, **Nb,Rd ≈ 247 kN**
- Semelle NEd=900 kN, σsol=200 kPa → **1,85 × 1,85 m**, As = 9,38 cm²/direction
- Neige zone C1 à 300 m, toiture 15° → **s = 0,60 kN/m²**
- Vent région 3, terrain II, z=10 m → **qp ≈ 0,99 kN/m²**, ce = 2,35

## Architecture

```
index.html              page unique (SPA)
css/styles.css          mise en forme
js/engine/              MOTEUR DE CALCUL (pur, testable sous Node)
  core.js               facteurs partiels, matériaux, utilitaires
  concrete.js           béton armé EC2 (dont poutre en Té)
  beam.js               solveur RDM (éléments finis)
  steel.js              acier EC3
  profiles.js           catalogue de profilés
  quantities.js         métré & fondations
  loads.js              charges climatiques neige/vent (EN 1991)
js/ui/                  INTERFACE (navigateur)
  dom.js, plot.js       utilitaires + graphiques SVG
  report.js             génération de la note de calcul PDF
  *.ui.js               contrôleurs par module
  app.js                navigation
tests/                  run-tests.js (Node) + browser-check.js (Playwright)
```

Les modules du moteur sont écrits en **UMD** : ils s'exécutent indifféremment
dans le navigateur (`window.GC.*`) et sous Node.js (`require`), ce qui permet de
les tester sans dépendance.

## Hypothèses de calcul

- État limite ultime (ELU), facteurs partiels recommandés :
  γ<sub>C</sub> = 1,5 ; γ<sub>S</sub> = 1,15 ; γ<sub>M0</sub> = γ<sub>M1</sub> = 1,0 ; α<sub>cc</sub> = 1,0.
- Béton : `fcd`, `fctm`, `Ecm` dérivés de `fck` (EN 1992-1-1 §3.1).
- Acier de construction : E = 210 000 MPa, courbes de flambement a0…d.

## ⚠ Avertissement

Outil d'**aide à l'avant-projet à but pédagogique**. Les résultats doivent être
vérifiés par un ingénieur qualifié et ne remplacent pas une note de calcul
réglementaire (combinaisons d'actions, dispositions constructives, vérifications
à l'ELS, etc.).

## Licence

MIT.
