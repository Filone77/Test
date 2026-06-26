# HydroCalc — Boîte à outils hydraulique

Logiciel de calcul hydraulique complet, conçu pour le travail d'ingénierie au
quotidien (adduction, refoulement, pompage, assainissement pluvial). Il reprend
**toutes** les fonctions des classeurs *Calcul Hydraulique Complet* et *Logiciel
Hydraulique*, et en ajoute d'autres, dans une interface unique où les modules
se chaînent automatiquement comme dans un tableur.

> Application 100 % locale, sans installation : un simple navigateur suffit.
> Aucune donnée ne quitte votre poste.

---

## Démarrer

1. Ouvrez **`index.html`** dans un navigateur (double-clic), **ou**
2. Hébergez le dossier sur un serveur web / GitHub Pages pour y accéder en ligne.

Rien à installer, aucune dépendance, fonctionne hors-ligne.

---

## Modules

### Fluide & conduite
| Module | Contenu |
|---|---|
| **Propriétés de l'eau** | ρ, μ, ν, pression de vapeur en fonction de la température |
| **Conduite & pertes linéaires** | Diamètre économique, vitesse, Reynolds, Darcy-Weisbach (Swamee-Jain / Colebrook-White) **ou Hazen-Williams** ; **sélecteur de matériau** qui remplit automatiquement ε, C et le Ø intérieur selon le PN |
| **Pertes singulières** | Catalogue de singularités, ΔH = ξ·V²/2g, **longueur équivalente** |
| **Conduite multi-tronçons & profil** | Tronçons en série (Ø/matériau/dénivelé différents), pertes cumulées, **profil en long + ligne piézométrique**, détection des pressions négatives |

### Pompage
| Module | Contenu |
|---|---|
| **Station de pompage** | HMT, puissances (hydraulique, arbre, absorbée, installée), NPSH / cavitation, configuration n+1 |
| **Point de fonctionnement** | Intersection courbe réseau × courbe pompe, avec graphique |
| **Pompes en parallèle / série** | Courbe ajustée sur **3 points constructeur**, association de n pompes, point de fonctionnement |
| **Bâche de pompage** | Volume utile (fréquence de démarrage & temps de rétention), dimensions |
| **Coup de bélier** | Célérité, Joukowsky / Michaud, classe de pression PN |
| **Ballon anti-bélier** | Pré-dimensionnement du volume du réservoir anti-bélier |
| **Bilan énergétique** | Consommation annuelle, coût, consommation spécifique |

### Réseaux
| Module | Contenu |
|---|---|
| **Réseau maillé (Hardy-Cross)** | Répartition des débits dans un réseau maillé, par itérations |

### Assainissement & hydrologie
| Module | Contenu |
|---|---|
| **Écoulement à surface libre** | Manning-Strickler — **circulaire (pleine/partielle), rectangulaire, trapézoïdale, triangulaire** |
| **Méthode rationnelle** | Q = C·i·A, temps de concentration (Kirpich), intensité de Montana |
| **Méthode des pluies** | Volume de stockage pluvial, durée critique |
| **Bassin de rétention** | Surface, **berges en talus** (tronc de pyramide), orifice de fuite, temps de vidange |
| **Orifices & déversoirs** | Orifice, déversoir rectangulaire, déversoir triangulaire (V-notch) |

### Outils
| Module | Contenu |
|---|---|
| **Convertisseur d'unités** | Débit, pression, longueur, volume, vitesse |
| **Comparaison de scénarios** | **Optimisation technico-économique** du diamètre (coût énergie + conduite) |
| **Tables de référence** | Rugosités, vitesses, modules d'élasticité, Manning, Hazen-Williams, ruissellement, diamètres |
| **Récapitulatif** | Synthèse de tous les modules, prête à imprimer |

## Fonctionnalités transverses

- **Multilingue** 🇫🇷 / 🇬🇧 / 🇸🇦 — français, anglais et **arabe (interface en RTL)**.
- **Note de calcul PDF** structurée (page de garde, résultats + formules) via l'impression.
- **Export Excel** (multi-feuilles) et **export CSV**.
- **Import des classeurs Excel** `.xlsx` existants (les deux classeurs de référence sont reconnus et mappés automatiquement).
- **Cas-types** pré-remplis (refoulement EU, AEP gravitaire, refoulement AEP, pluvial).
- **Mode sombre**, **recherche de module**, **partage par lien** (état encodé dans l'URL).
- **PWA** : installable sur ordinateur/téléphone, fonctionne hors-ligne.
- **Déploiement GitHub Pages** automatisé (`.github/workflows/pages.yml`).

---

## Chaînage automatique des modules

Comme dans un tableur avec références entre feuilles, les résultats d'un module
alimentent les suivants. Les champs concernés portent l'icône 🔗 et restent
**modifiables** ; le bouton **« ↻ Resync. liens »** recharge la valeur amont.

```
Propriétés de l'eau ─► Conduite ─► Pertes singulières ─► Station de pompage
                                                            ├─► Point de fonctionnement
                                                            ├─► Bâche
                                                            ├─► Coup de bélier
                                                            └─► Bilan énergétique
Méthode des pluies ─► Bassin de rétention
```

Toute modification se répercute instantanément sur l'ensemble du projet.

---

## Sauvegarde, impression

- **💾 Enregistrer / 📂 Charger** : projet au format `.hydro.json`.
- **🖨️ Imprimer** : édite une note de calcul (PDF via l'impression du navigateur).
- Sauvegarde automatique dans le navigateur (reprise à la réouverture).

---

## Principales hypothèses de calcul

- Pertes linéaires : **Darcy-Weisbach** avec coefficient de **Colebrook-White**
  (approximation explicite de **Swamee-Jain** ou résolution itérative).
- Pertes singulières : ΔH = ξ·V²/2g.
- Écoulement à surface libre : **Manning-Strickler**.
- Coup de bélier : célérité d'Allievi, **Joukowsky** / **Michaud**.
- Méthode des pluies : débit de fuite constant, intensité de **Montana** `i = a·t^(−b)`.
- Propriétés de l'eau : corrélations en fonction de la température.
- Unités SI, sauf indication contraire (débits souvent en m³/h ou L/s).

---

## Architecture du code

```
index.html
manifest.webmanifest      manifeste PWA
sw.js                     service worker (hors-ligne)
.github/workflows/pages.yml  déploiement GitHub Pages
assets/
  icon.svg                icône de l'application
  css/styles.css          feuille de style (clair/sombre, RTL, impression)
  js/
    hydraulics.js         moteur de calcul (fonctions pures, testées)
    hydraulics-ext.js     méthodes avancées (Hazen-Williams, profil, Hardy-Cross…)
    references.js         tables techniques + cas-types
    i18n.js               internationalisation FR / EN / AR
    ui.js                 helpers d'interface (champs, tableaux, graphiques)
    modules.js            modules de base
    modules-ext.js        modules d'extension
    export.js             note PDF, export Excel, export CSV
    import-xlsx.js        import de classeurs Excel (.xlsx)
    app.js                application (état, recalcul en cascade, I/O)
tests/
  test_calc.js            tests du moteur de base (42)
  test_ext.js             tests des méthodes avancées (24)
```

Le moteur (`hydraulics.js`) est volontairement séparé de l'interface : ce sont
des fonctions pures, réutilisables et vérifiables.

---

## Tests

```bash
node tests/test_calc.js   # 42 tests du moteur de base
node tests/test_ext.js    # 24 tests des méthodes avancées
```

66 vérifications au total, contre les valeurs des classeurs de référence et
les solutions analytiques connues (propriétés du fluide, pertes de charge,
Hazen-Williams, pompage, NPSH, coup de bélier, Manning, méthode des pluies,
bassin, Hardy-Cross, ajustement de courbe de pompe, conversions…).

---

## Avertissement

Outil d'aide au prédimensionnement. Les résultats doivent être vérifiés par un
ingénieur et confrontés aux données des fournisseurs et aux normes en vigueur
avant toute exécution.
