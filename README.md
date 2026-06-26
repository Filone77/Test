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
| **Conduite & pertes linéaires** | Diamètre économique, vitesse, Reynolds, Darcy-Weisbach (Swamee-Jain **ou** Colebrook-White itératif) |
| **Pertes singulières** | Catalogue de singularités (coudes, vannes, clapets…), ΔH = ξ·V²/2g |

### Pompage
| Module | Contenu |
|---|---|
| **Station de pompage** | HMT, puissances (hydraulique, arbre, absorbée, installée), NPSH / cavitation, configuration n+1 |
| **Point de fonctionnement** | Intersection courbe réseau × courbe pompe, avec graphique |
| **Bâche de pompage** | Volume utile (fréquence de démarrage & temps de rétention), dimensions |
| **Coup de bélier** | Célérité, Joukowsky (fermeture rapide) / Michaud (fermeture lente), classe de pression PN |
| **Bilan énergétique** | Consommation annuelle, coût, consommation spécifique |

### Assainissement & hydrologie
| Module | Contenu |
|---|---|
| **Écoulement à surface libre** | Manning-Strickler, section pleine **et** partiellement remplie, courbe de capacité |
| **Méthode des pluies** | Volume de stockage pluvial (intensité de Montana), durée critique |
| **Bassin de rétention** | Surface, orifice de fuite, temps de vidange |
| **Orifices & déversoirs** | Orifice, déversoir rectangulaire, déversoir triangulaire (V-notch) |

### Outils
| Module | Contenu |
|---|---|
| **Convertisseur d'unités** | Débit, pression, longueur, volume, vitesse |
| **Tables de référence** | Rugosités, vitesses recommandées, modules d'élasticité, Manning, diamètres normalisés |
| **Récapitulatif** | Synthèse de tous les modules, prête à imprimer (note de calcul) |

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
assets/
  css/styles.css          feuille de style
  js/
    hydraulics.js         moteur de calcul (fonctions pures, testées)
    references.js         tables techniques de référence
    ui.js                 helpers d'interface (champs, tableaux, graphiques)
    modules.js            définition déclarative de chaque module
    app.js                application (état, recalcul en cascade, I/O)
tests/
  test_calc.js            tests du moteur de calcul
```

Le moteur (`hydraulics.js`) est volontairement séparé de l'interface : ce sont
des fonctions pures, réutilisables et vérifiables.

---

## Tests

```bash
node tests/test_calc.js
```

42 vérifications du moteur de calcul contre les valeurs des classeurs de
référence (propriétés du fluide, pertes de charge, pompage, NPSH, coup de
bélier, Manning, méthode des pluies, bassin, conversions…).

---

## Avertissement

Outil d'aide au prédimensionnement. Les résultats doivent être vérifiés par un
ingénieur et confrontés aux données des fournisseurs et aux normes en vigueur
avant toute exécution.
