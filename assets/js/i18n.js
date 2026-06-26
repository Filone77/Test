/* ============================================================================
 * HydroCalc — Internationalisation (FR / EN / AR)
 * ----------------------------------------------------------------------------
 * Le français est la langue SOURCE : t(chaîne) renvoie la traduction de la
 * chaîne française pour la langue active, sinon la chaîne d'origine.
 * L'anglais couvre l'ensemble de l'interface et des calculs ; l'arabe couvre
 * l'interface, la navigation et les intitulés de modules (RTL), les libellés
 * de calcul détaillés s'affichant alors en français (repli).
 * ==========================================================================*/
(function (root) {
  'use strict';
  var Hydro = root.Hydro || (root.Hydro = {});

  var EN = {
    // Chrome / interface
    'Boîte à outils hydraulique': 'Hydraulic toolbox',
    'Projet hydraulique': 'Hydraulic project',
    'Données d\'entrée': 'Input data',
    'Résultats': 'Results',
    '↻ Resync. liens': '↻ Resync links',
    'Enregistrer': 'Save', 'Charger': 'Load', 'Imprimer': 'Print',
    '💾 Enregistrer': '💾 Save', '📂 Charger': '📂 Load', '🖨️ Imprimer': '🖨️ Print',
    'Nom du projet': 'Project name',
    'Enregistrer le projet (.json)': 'Save project (.json)',
    'Charger un projet (.json)': 'Load a project (.json)',
    'Importer un classeur Excel (.xlsx)': 'Import an Excel workbook (.xlsx)',
    'Imprimer / exporter en PDF': 'Print / export to PDF',
    'Réinitialiser': 'Reset',
    'Recharger les valeurs liées depuis les modules amont': 'Reload linked values from upstream modules',
    'Valeur liée à un autre module — modifiable': 'Value linked to another module — editable',
    'Projet chargé': 'Project loaded', 'Fichier invalide': 'Invalid file',
    'Valeurs réinitialisées': 'Values reset',
    'Réinitialiser toutes les données saisies aux valeurs par défaut ?': 'Reset all entered data to default values?',
    'Rechercher un module…': 'Search a module…',
    'Langue': 'Language', 'Thème': 'Theme', 'Cas-types': 'Templates',
    'Note de calcul (PDF)': 'Calculation report (PDF)',
    'Note de calcul hydraulique': 'Hydraulic calculation report',
    'Date': 'Date', 'Auteur': 'Author',
    'Export Excel': 'Excel export', 'Export CSV': 'CSV export',
    'Partager': 'Share', 'Lien copié dans le presse-papiers': 'Link copied to clipboard',
    // Groupes de navigation
    'Fluide & conduite': 'Fluid & pipe', 'Pompage': 'Pumping',
    'Réseaux': 'Networks',
    'Assainissement & hydrologie': 'Drainage & hydrology', 'Outils': 'Tools',
    // Titres de modules
    'Propriétés de l\'eau': 'Water properties',
    'Conduite & pertes linéaires': 'Pipe & friction losses',
    'Pertes de charge singulières': 'Local (minor) losses',
    'Conduite multi-tronçons & profil': 'Multi-segment pipe & profile',
    'Station de pompage (HMT, puissance, NPSH)': 'Pumping station (TDH, power, NPSH)',
    'Point de fonctionnement': 'Operating point',
    'Pompes en parallèle / série': 'Pumps in parallel / series',
    'Bâche de pompage': 'Pump sump',
    'Coup de bélier (transitoires)': 'Water hammer (transients)',
    'Ballon anti-bélier': 'Anti-hammer air vessel',
    'Bilan énergétique': 'Energy balance',
    'Réseau maillé (Hardy-Cross)': 'Looped network (Hardy-Cross)',
    'Écoulement à surface libre (Manning)': 'Open-channel flow (Manning)',
    'Méthode rationnelle': 'Rational method',
    'Méthode des pluies (stockage)': 'Rain method (storage)',
    'Bassin de rétention': 'Retention basin',
    'Orifices & déversoirs': 'Orifices & weirs',
    'Convertisseur d\'unités': 'Unit converter',
    'Comparaison de scénarios': 'Scenario comparison',
    'Tables de référence': 'Reference tables',
    'Récapitulatif du projet': 'Project summary',
    // Libellés d'entrée fréquents
    'Température de l\'eau': 'Water temperature',
    'Débit de pointe': 'Peak flow', 'Débit moyen': 'Average flow',
    'Vitesse économique visée': 'Target economic velocity',
    'Diamètre nominal': 'Nominal diameter', 'Diamètre intérieur réel': 'Actual inner diameter',
    'Longueur de conduite': 'Pipe length', 'Rugosité absolue': 'Absolute roughness',
    'Altitude amont': 'Upstream elevation', 'Altitude aval': 'Downstream elevation',
    'Matériau': 'Material', 'Matériau de la conduite': 'Pipe material',
    'Méthode du coefficient λ': 'λ coefficient method', 'Pression résiduelle requise': 'Required residual pressure',
    'Hauteur géométrique': 'Geometric head', 'Pertes de charge totales': 'Total head losses',
    'Rendement pompe': 'Pump efficiency', 'Rendement moteur': 'Motor efficiency',
    'Pompes en service': 'Duty pumps', 'Pompes de secours': 'Standby pumps',
    'Altitude du site': 'Site elevation', 'Hauteur d\'aspiration': 'Suction lift',
    'NPSH requis (constructeur)': 'Required NPSH (manufacturer)',
    'Volume annuel pompé': 'Annual pumped volume', 'Prix de l\'électricité': 'Electricity price',
    'Diamètre de la conduite': 'Pipe diameter', 'Pente': 'Slope', 'Coefficient de Manning': 'Manning coefficient',
    'Taux de remplissage': 'Filling ratio', 'Surface active (S·Cr)': 'Active area (S·Cr)',
    'Débit de fuite spécifique': 'Specific leak flow', 'Débit de fuite': 'Leak flow',
    'Profondeur utile': 'Useful depth', 'Volume utile à stocker': 'Useful storage volume',
    // Statuts / divers
    'OK': 'OK', 'Pas de cavitation': 'No cavitation', 'Risque cavitation': 'Cavitation risk',
    'Turbulent': 'Turbulent', 'Laminaire': 'Laminar', 'Transition': 'Transition',
    'Fermeture lente': 'Slow closure', 'Fermeture rapide': 'Rapid closure',
    'Grandeur': 'Quantity', 'Valeur': 'Value', 'Unité': 'Unit', 'Unité de départ': 'Source unit',
    'Équivalences': 'Conversions', 'Synthèse des résultats clés issus de tous les modules. Utilisez « Imprimer / PDF » pour éditer une note de calcul.':
      'Summary of key results from all modules. Use “Print / PDF” to produce a calculation report.'
  };

  var AR = {
    'Boîte à outils hydraulique': 'صندوق أدوات هيدروليكي',
    'Projet hydraulique': 'مشروع هيدروليكي',
    'Données d\'entrée': 'بيانات الإدخال', 'Résultats': 'النتائج',
    '↻ Resync. liens': '↻ إعادة المزامنة',
    'Enregistrer': 'حفظ', 'Charger': 'تحميل', 'Imprimer': 'طباعة',
    '💾 Enregistrer': '💾 حفظ', '📂 Charger': '📂 تحميل', '🖨️ Imprimer': '🖨️ طباعة',
    'Nom du projet': 'اسم المشروع', 'Réinitialiser': 'إعادة ضبط',
    'Rechercher un module…': 'ابحث عن وحدة…',
    'Langue': 'اللغة', 'Thème': 'السمة', 'Cas-types': 'نماذج جاهزة',
    'Note de calcul (PDF)': 'مذكرة حسابية (PDF)',
    'Export Excel': 'تصدير Excel', 'Export CSV': 'تصدير CSV', 'Partager': 'مشاركة',
    // Groupes
    'Fluide & conduite': 'المائع والأنبوب', 'Pompage': 'الضخ', 'Réseaux': 'الشبكات',
    'Assainissement & hydrologie': 'الصرف والهيدرولوجيا', 'Outils': 'الأدوات',
    // Titres de modules
    'Propriétés de l\'eau': 'خصائص الماء',
    'Conduite & pertes linéaires': 'الأنبوب والفواقد الخطية',
    'Pertes de charge singulières': 'الفواقد الموضعية',
    'Conduite multi-tronçons & profil': 'أنبوب متعدد المقاطع والمنسوب',
    'Station de pompage (HMT, puissance, NPSH)': 'محطة الضخ (HMT، القدرة، NPSH)',
    'Point de fonctionnement': 'نقطة التشغيل',
    'Pompes en parallèle / série': 'مضخات على التوازي/التوالي',
    'Bâche de pompage': 'خزان الضخ',
    'Coup de bélier (transitoires)': 'المطرقة المائية',
    'Ballon anti-bélier': 'خزان هوائي ضد المطرقة',
    'Bilan énergétique': 'الموازنة الطاقية',
    'Réseau maillé (Hardy-Cross)': 'شبكة حلقية (هاردي-كروس)',
    'Écoulement à surface libre (Manning)': 'الجريان الحر (مانينغ)',
    'Méthode rationnelle': 'الطريقة العقلانية',
    'Méthode des pluies (stockage)': 'طريقة الأمطار (التخزين)',
    'Bassin de rétention': 'حوض الاحتجاز',
    'Orifices & déversoirs': 'الفتحات والهدّارات',
    'Convertisseur d\'unités': 'محوّل الوحدات',
    'Comparaison de scénarios': 'مقارنة السيناريوهات',
    'Tables de référence': 'جداول مرجعية',
    'Récapitulatif du projet': 'ملخص المشروع'
  };

  Hydro.i18n = {
    lang: 'fr',
    langues: [ { code: 'fr', nom: 'Français' }, { code: 'en', nom: 'English' }, { code: 'ar', nom: 'العربية' } ],
    dict: { en: EN, ar: AR },
    rtlSet: { ar: true },
    t: function (s) {
      if (this.lang === 'fr' || s == null) return s;
      var d = this.dict[this.lang];
      return (d && d[s]) || s;
    },
    dir: function () { return this.rtlSet[this.lang] ? 'rtl' : 'ltr'; },
    setLang: function (l) {
      this.lang = l;
      document.documentElement.lang = l;
      document.documentElement.dir = this.dir();
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Hydro.i18n;

})(typeof window !== 'undefined' ? window : this);
