/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LangType = "fr" | "ar";

export const translations = {
  fr: {
    // Top Navigation & General
    appTitle: "Bourse de Fret Algérie",
    bourseFret: "BOURSE DE FRET (PUBLIC)",
    espaceDonneur: "ESPACE DONNEUR D'ORDRE",
    espaceTransporteur: "ESPACE TRANSPORTEUR / MOYENS",
    logigramme: "LOGIGRAMME INTERACTIF",
    financierDocs: "FINANCIER & DOCUMENTS",
    transporteurs: "Transporteurs",
    commissionnaires: "Commissionnaires",
    manutention: "Manutention",
    stockage: "Stockage",
    recherche: "Recherche",
    simulateurProfil: "Simulateur Profil",
    inscription: "Inscription",
    bourseDigitale: "Bourse Digitale Directe",
    footerInfo: "NETLOG ALGERIE © 2026 — RÉSEAU LOGISTIQUE NATIONAL",
    support: "Support: 021 00 00 00",
    email: "Email : contact@netlog.dz",
    systemLogText: "Alerte Système",
    fermer: "Fermer",
    annuler: "Annuler",
    devPhase2: "Phase 2",

    // Hero Section
    heroTitle: "La plus grande Bourse de Fret digitale en Algérie",
    heroSubtitle: "Mettez en relation instantanée vos besoins d'affrètement de marchandises avec des centaines de transporteurs algériens vérifiés. Compatibilité technique des véhicules et génération légale de lettre de voiture à 100%.",
    heroActiveOffers: "offres de fret actives",
    heroDirectRoute: "Sétif & Alger → Constantine direct disponible",

    // Search filters
    searchSectionTitle: "Recherche Multicritère Instantanée",
    searchDepart: "Ville de départ",
    searchArrivee: "Ville d'arrivée",
    searchVehicule: "Type de véhicule requis",
    searchMarchandise: "Rechercher marchandise...",
    searchBtnReset: "Réinitialiser",
    searchNoOffers: "Aucune offre de fret ne correspond à vos critères de recherche en ce moment.",

    // General terms / columns
    colRoute: "Trajet (Départ -> Arrivée)",
    colMarchandise: "Marchandise & Poids",
    colVehicule: "Type de Véhicule",
    colDate: "Date de Chargement",
    colActions: "Actions",
    tonnes: "Tonnes",
    metres: "Mètres",
    voyages: "Voyage(s)",
    enSavoirPlus: "En savoir plus",
    tarifCible: "Tarif cible",
    proposerSaisie: "Proposer un tarif",
    proposePar: "Proposé par",
    telephone: "Téléphone",
    concerneVehicule: "Concerne le véhicule",

    // Offer Details modal / section
    detailsOffreTitle: "Détails de l'offre d'affrètement",
    dateLivraison: "Date de livraison prévue",
    commentaire: "Instructions spécialisées",
    soumettreProposition: "Soumettre une offre de prix (Transporteur)",
    votreTarifDzd: "Votre tarif proposé (DZD)",
    choisirMoyenTransport: "Sélectionner un véhicule de votre parc",
    commentaireFacultatif: "Commentaire ou détails de disponibilité (Facultatif)",
    aucunVehiculeAlerte: "Veuillez d'abord déclarer un véhicule dans l'espace Transporteur pour soumettre une offre.",
    boutonEnvoyer: "Envoyer ma proposition de prix",
    propExistante: "Vous avez déjà soumis un tarif pour ce fret.",

    // Tab Donneur d'Ordre
    doTitle: "ESPACE LOGISTIQUE DONNEUR D'ORDRE",
    doSubtitle: "Publiez vos chargements, comparez les prix des transporteurs algériens en temps réel et signez des lettres de voiture conformes.",
    publierFretBtn: "Publier un besoin de Fret",
    formDepart: "Ville de Départ (Ex: Alger, Sétif, Oran...)",
    formArrivee: "Ville d'Arrivée (Ex: Adrar, Hassi Messaoud...)",
    formDetailsDepart: "Commune, code postal ou port d'embarquement (Détails départ)",
    formDetailsArrivee: "Commune ou zone industrielle (Détails livraison/arrivée)",
    formPoids: "Poids de la marchandise (en Tonnes)",
    formLongueur: "Longueur utile requise (en mètres)",
    formNature: "Nature de la marchandise (Ex: Ciment, Dattes, Pièces...)",
    formTarifCible: "Tarif cible proposé au transporteur (Facultatif - DZD)",
    formDateChargement: "Date de Chargement",
    formCommentaireLabel: "Instructions complémentaires et exigences de sécurité",
    btnPublierBourse: "Publier sur la Bourse Directe",
    mesDemandesPubliees: "Mes demandes de transport publiées",
    aucuneDemandePubliee: "Aucun besoin de fret publié pour le moment.",
    contratsGeneresDoc: "Documents juridiques & Génération légale",
    genererContratLogistique: "Générer Contrat Logistique",
    genererLettreVoiture: "Télécharger Lettre Voiture",
    validerLivraison: "Valider la livraison",
    entrerCodeConfirmation: "Saisir le code d'authentification à 4 chiffres fourni par le transporteur pour valider le déchargement :",
    validerCloturePrestation: "Valider la livraison & Débloquer la facturation",
    signalerReservesLabel: "Mentionner des réserves d'état au déchargement (Optionnel)",
    codeAlerteDo: "Pour validation ultérieure, le transporteur vous demandera ce code de confirmation à la livraison : ",
    propositionsTransporteur: "Propositions reçues pour ce fret",
    aucunePropositionRecue: "Aucune proposition n'a encore été reçue pour cette offre.",
    boutonAccepterPropo: "Accepter le tarif",
    boutonRefuserPropo: "Décliner",

    // Tab Transporteur
    transTitle: "ESPACE PROFESSIONNEL TRANSPORTEUR",
    transSubtitle: "Gérez votre flotte de camions, proposez vos tarifs sur la bourse nationale et suivez vos transports actifs.",
    declarerVehicule: "Déclarer un nouveau véhicule de transport",
    formMarque: "Marque & Modèle (Ex: Shacman F3000, Volvo FH)",
    formImmat: "Plaque d'immatriculation (Ex: 16-123-01)",
    formPoidsUtile: "Poids utile maximum réel (Tonnes)",
    formLongueurPlateau: "Longueur du plateau / remorque (Mètres)",
    btnAjouterVehicule: "Ajouter le véhicule au parc",
    monParcVehicules: "Mon parc de camions déclarés",
    aucunVehiculeDeclare: "Aucun véhicule n'a encore été enregistré dans votre flotte.",
    mesTransportsEnCours: "Mes services d'acheminement actifs",
    aucunAcheminementEnCours: "Aucun transport actif pour le moment.",
    bntValiderChargement: "Déclarer le chargement sur site",
    btnValiderDechargement: "Déclarer l'arrivée au destinataire",
    creerFactureDirectement: "Émettre Facture Commerciale",

    // Tab Simulation & Logigramme
    simTitle: "LOGIGRAMME INTERACTIF DE SÉCURITÉ",
    simSubtitle: "Visualisez pas à pas le parcours sécurisé et réglementaire d'un transport d'affrètement sur NETLOG.",
    simCard1Title: "1. Compatibilité Technique",
    simCard1Desc: "Algorithme de comparaison automatique : vérification de la capacité de poids utile, de la longueur de la remorque et du type de matériel requis pour la marchandise.",
    simCard2Title: "2. Signature du Contrat",
    simCard2Desc: "Génération automatique d'un contrat d'affrètement tripartite liant le Client, le Transporteur et la plateforme de courtage NETLOG Algérie.",
    simCard3Title: "3. Traçabilité & Code Securisé",
    simCard3Desc: "Génération d'un code OTP unique à 4 chiffres à l'enlèvement. Ce code doit être fourni par le transporteur au destinataire physique lors de la livraison.",
    simCard4Title: "4. Pièces Comptables & Paiement",
    simCard4Desc: "Délivrance de la facture réglementaire sous 9% de TVA transport, puis validation du virement ou versement de déblocage bancaire direct.",

    // Tab Facturation & Finances
    finTitle: "SUIVI FINANCIER & DOCUMENTS COMPTABLES",
    finSubtitle: "Consultez l'ensemble de vos encours de facturation, réglez vos tiers et gardez vos attachements comptables.",
    facturationInterne: "Grand Livre de Facturation NETLOG",
    aucuneFacture: "Aucun mouvement comptable enregistré.",
    facturePourOffre: "Facture affrètement",
    montantPrestation: "Montant de la Prestation",
    modeReglement: "Mode de règlement",
    btnReglerFacture: "Procéder au règlement",

    // Register Modal
    regTitle: "Création de compte instantanée NETLOG",
    regNomForm: "Nom du représentant",
    regPrenomForm: "Prénom du représentant",
    regRaisonForm: "Raison sociale (Nom de l'entreprise légale)",
    regRcForm: "N° Registre de Commerce (RC Algérien / Wilaya)",
    regAdresseForm: "Adresse physique du siège social",
    regEmailForm: "Adresse Email d'affaires",
    regTelForm: "Numéro de Téléphone (Ex: +213 550 00 00 00)",
    regRoleForm: "S'inscrire en tant que :",
    regBtnSubmit: "S'enregistrer & Ouvrir mon espace",

    // Stats Widget Hompage
    statFretsDispos: "Frets Disponibles",
    statCamionsLibres: "Camions Libres",
    statAlgerCentre: "Alger centre",
    statDemandesAttente: "Demandes en attente",
    statUrgentes: "Urgentes",
    statPrixMoyen: "Prix Moyen / KM",
    statDZD: "DZD",
    opportunitesTitre: "Dernières opportunités de fret",
    filtreParVille: "Filtrer par Ville",
    filtreParType: "Type de Camion",
    voirOffre: "Voir l'offre",

    // Profile types translations
    profilDonneur: "Donneur d'ordre",
    profilTransporteur: "Transporteur",
    profilCommissionnaire: "Commissionnaire",
    profilManutentionnaire: "Manutentionnaire",
    profilStockage: "Espace de stockage",

    // Statut Offre Translation for badges
    statutPublie: "Publié",
    statutAttribue: "Attribué",
    statutCharge: "En cours d'acheminement",
    statutDecharge: "Déchargé à destination",
    statutValide: "Validé & Clôturé",

    // Miscellaneous
    de: "de",
    vers: "vers",
    km: "km",
    valider: "Valider",
    poids: "Poids",
    marchandise: "Marchandise",
    inscriptionBouton: "S'inscrire",
  },
  ar: {
    // Top Navigation & General
    appTitle: "بورصة الشحن بالجزائر",
    bourseFret: "بورصة الشحن (عام)",
    espaceDonneur: "فضاء آمر الصرف",
    espaceTransporteur: "فضاء الناقل / الوسائل",
    logigramme: "المخطط التفاعلي للأمان",
    financierDocs: "المالية والوثائق",
    transporteurs: "الناقلون",
    commissionnaires: "الوسطاء المعتمدون",
    manutention: "المناولة والرفع",
    stockage: "التخزين والمستودعات",
    recherche: "البحث",
    simulateurProfil: "محاكي الملف الشخصي",
    inscription: "التسجيل",
    bourseDigitale: "بورصة الشحن الرقمية المباشرة",
    footerInfo: "منصة NETLOG الجزائر © 2026 — الشبكة اللوجستية الوطنية",
    support: "الدعم: 021 00 00 00",
    email: "البريد الإلكتروني: contact@netlog.dz",
    systemLogText: "تنبيه النظام",
    fermer: "إغلاق",
    annuler: "إلغاء",
    devPhase2: "المرحلة الثانية",

    // Hero Section
    heroTitle: "أكبر بورصة شحن رقمية في الجزائر لربط الشاحنات",
    heroSubtitle: "صل احتياجاتك لحجز شاحنات نقل البضائع مباشرة بمئات الناقلين الجزائريين المؤهلين والمثبتين. توافق فني كامل للمركبات وصدور قانوني لرسالة الشحن بنسبة 100٪.",
    heroActiveOffers: "عروض نقل بضائع نشطة",
    heroDirectRoute: "سطيف والجزائر ← قسنطينة مباشرة متوفر",

    // Search filters
    searchSectionTitle: "البحث الفوري متعدد المعايير",
    searchDepart: "مدينة الانطلاق",
    searchArrivee: "مدينة الوصول",
    searchVehicule: "نوع المركبة المطلوبة",
    searchMarchandise: "البحث عن بضاعة...",
    searchBtnReset: "إعادة تعيين",
    searchNoOffers: "لا توجد عروض شحن تطابق معايير البحث الخاصة بك حالياً.",

    // General terms / columns
    colRoute: "مسار الرحلة (الانطلاق ← الوصول)",
    colMarchandise: "البضاعة والوزن",
    colVehicule: "نوع الشاحنة",
    colDate: "تاريخ الشحن",
    colActions: "الإجراءات",
    tonnes: "أطنان",
    metres: "أمتار",
    voyages: "رحلة / رحلات",
    enSavoirPlus: "مزيد من التفاصيل",
    tarifCible: "السعر المستهدف",
    proposerSaisie: "تقديم عرض سعر",
    proposePar: "مقدم من طرف",
    telephone: "الهاتف",
    concerneVehicule: "الشاحنة المخصصة",

    // Offer Details modal / section
    detailsOffreTitle: "تفاصيل عرض الشحن واللوجستيات",
    dateLivraison: "تاريخ التسليم المتوقع",
    commentaire: "تعليمات خاصة بالأمن والنقل",
    soumettreProposition: "تقديم عرض سعر (خاص بالناقلين)",
    votreTarifDzd: "سعركم المقترح (دينار جزائري)",
    choisirMoyenTransport: "اختر شاحنة من حظيرتك المصرح بها",
    commentaireFacultatif: "ملاحظات إضافية أو تفاصيل توفر المركبة (اختياري)",
    aucunVehiculeAlerte: "يرجى أولاً تسجيل شاحنة في فضاء الناقل لتتمكن من تقديم عرض السعر.",
    boutonEnvoyer: "إرسال عرض السعر للعميل",
    propExistante: "لقد قمت بتقديم سعر مسبقاً لهذا العرض.",

    // Tab Donneur d'Ordre
    doTitle: "قسم اللوجستيات لآمر الصرف (العميل)",
    doSubtitle: "انشر حمولاتك، وتلقى عروض الأسعار التنافسية من الناقلين الجزائريين مباشرة مع توقيع اتفاقيات النقل القانونية.",
    publierFretBtn: "نشر إعلان شحن بضاعة جديد",
    formDepart: "مدينة الانطلاق (مثال: الجزائر، سطيف، وهران...)",
    formArrivee: "مدينة الوصول (مثال: أدرار، حاسي مسعود...)",
    formDetailsDepart: "البلدية، الميناء أو تفاصيل عنوان شحن البضاعة",
    formDetailsArrivee: "البلدية أو المنطقة الصناعية (تفاصيل مكان التفريغ)",
    formPoids: "وزن الحمولة الإجمالي (بالأطنان)",
    formLongueur: "الطول المفيد الأدنى المطلوب للشاحنة (بالأمتار)",
    formNature: "طبيعة ونوع البضاعة (مثال: إسمنت، تمور، قطع غيار...)",
    formTarifCible: "السعر المقدر المستهدف (اختياري - د.ج)",
    formDateChargement: "تاريخ عملية الشحن",
    formCommentaireLabel: "إرشادات السلامة وشروط النقل الإضافية للناقل",
    btnPublierBourse: "نشر العرض في البورصة العامة",
    mesDemandesPubliees: "طلبات الشحن المنشورة الخاصة بي",
    aucuneDemandePubliee: "لا توجد طلبات تصدير أو نقل منشورة للآن.",
    contratsGeneresDoc: "المستندات القانونية والعقود التلقائية",
    genererContratLogistique: "إصدار العقد اللوجستي الرقمي",
    genererLettreVoiture: "تحميل رسالة الشحن الرسمية",
    validerLivraison: "تأكيد واستلام الشحنة",
    entrerCodeConfirmation: "أدخل الرمز السري المتكون من ٤ أرقام المستلم للتأكيد على تفريغ الحمولة بسلام :",
    validerCloturePrestation: "تأكيد الاستلام النهائي وتحرير المستند المالي",
    signalerReservesLabel: "كتابة تحفظات أو ملاحظات حول حالة البضائع (اختياري)",
    codeAlerteDo: "لتأكيد عملية التسليم لاحقاً، تطلب منك المنصة إعطاء هذا الكود السري للناقل: ",
    propositionsTransporteur: "قائمة عروض الأسعار المستلمة من الناقلين",
    aucunePropositionRecue: "لا توجد عروض أسعار مقدمة على حمولتك حتى الآن.",
    boutonAccepterPropo: "قبول السعر المطروح",
    boutonRefuserPropo: "رفض العرض",

    // Tab Transporteur
    transTitle: "قسم الناقلين والخدمات المهنية للخدمات اللوجستية",
    transSubtitle: "أدر أسطول شاحناتك بالكامل، وقدم تسعيرات فورية للحمولات على البورصة لمضاعفة أرباحك.",
    declarerVehicule: "تسجيل وتصريح مركبة جديدة بالحظيرة",
    formMarque: "العلامة والطراز (مثال: Shacman F3000, Volvo FH)",
    formImmat: "رقم لوحة الترقيم (مثال: 01-123-16)",
    formPoidsUtile: "الوزن الأقصى الذي تستطيع الشاحنة حمله (أطنان)",
    formLongueurPlateau: "طول مقطورة الشاحنة (بالأمتار)",
    btnAjouterVehicule: "إدراج المركبة في حظيرة الشاحنات",
    monParcVehicules: "أسطول شاحناتي المسجلة",
    aucunVehiculeDeclare: "لا توجد أي شاحنة مسجلة بأسطولك اللوجستي للآن.",
    mesTransportsEnCours: "عمليات نقل البضائع الجارية النشطة",
    aucunAcheminementEnCours: "لا توجد حمولات قيد النقل حالياً بأسطولك.",
    bntValiderChargement: "تأكيد إتمام شحن الحمولة من الموقع",
    btnValiderDechargement: "تأكيد الوصول لجهة المفرغ والتسليم",
    creerFactureDirectement: "إرسال وإصدار الفاتورة التجارية",

    // Tab Simulation & Logigramme
    simTitle: "المخطط التفاعلي لمسار الأمان والتعاقد ورقابة النقل",
    simSubtitle: "تتبع خطوة بخطوة التدفق الرقمي والقانوني والمالي لكل شحنة مسجلة على NETLOG.",
    simCard1Title: "١. مطابقة وموافقة الشاحنة",
    simCard1Desc: "فحص تلقائي ذكي: للتأكد التام من قدرة الشاحنة على تحمل الوزن المطروح، طول المجرورة وحمايتها لسلامة البضائع المصرحة.",
    simCard2Title: "٢. صياغة وتوقيع العقود",
    simCard2Desc: "إصدار فوري لعقد شحن رقمي ثلاثي الأطراف معتمد ومحمي يربط قانونياً كلاً من الزبون، الناقل المعتمد، وإدارة البورصة.",
    simCard3Title: "٣. تتبع بـالرمز السري الآمن",
    simCard3Desc: "إنشاء رقم تحقق سري فريد OTP مكون من 4 أرقام عند التحميل، يضمن تسليم البضائع للمستلم الحقيقي فقط في النقطة المستهدفة.",
    simCard4Title: "٤. تحرير الفواتير والدفع الإلكتروني",
    simCard4Desc: "توليد الفاتورة القانونية بالعملة الوطنية خاضعة لـ 9٪ من الرسوم الضريبية للنقل، ودفع المستحقات عبر حساب البنك المركزي.",

    // Tab Facturation & Finances
    finTitle: "المتابعة المالية ومستندات الفوترة للمنصة",
    finSubtitle: "ألقِ نظرة عامة على الإيرادات، الفواتير الصادرة والواردة وأعمال المحاسبة والتحصيل في الوقت الفعلي.",
    facturationInterne: "دفتر المحاسبة الشامل ومعاملات NETLOG المعتمدة",
    aucuneFacture: "لا توجد معاملات محاسبية مسجلة لهذا الحساب حالياً.",
    facturePourOffre: "فاتورة شحن وتصدير",
    montantPrestation: "مبلغ الخدمة الصافي",
    modeReglement: "طريقة التسوية المالية",
    btnReglerFacture: "تأكيد ودفع الفاتورة المستحقة",

    // Register Modal
    regTitle: "إنشاء حساب تجاري / احترافي فوري في الشبكة",
    regNomForm: "اللقب الشخصي",
    regPrenomForm: "الاسم الشخصي",
    regRaisonForm: "الاسم الاجتماعي (الشركة أو المؤسسة)",
    regRcForm: "رقم السجل التجاري (أو بطاقة الناقل للمهنيين)",
    regAdresseForm: "المقر الاجتماعي وعنوان المكاتب الرئيسي",
    regEmailForm: "البريد الإلكتروني المعتمد للاتصالات",
    regTelForm: "رقم الهاتف الفعال (مثال: 0550000000)",
    regRoleForm: "تسجيل غرض الحساب وحالته كـ :",
    regBtnSubmit: "تثبيت البيانات والولوج للوحة القيادة الحرفية",

    // Stats Widget Hompage
    statFretsDispos: "الحمولات المتوفرة",
    statCamionsLibres: "الشاحنات الفارغة",
    statAlgerCentre: "وسط الجزائر العاصمة",
    statDemandesAttente: "الحمولات بانتظار العروض",
    statUrgentes: "شحنات مستعجلة",
    statPrixMoyen: "متوسط السعر / كم",
    statDZD: "د.ج (ثابت)",
    opportunitesTitre: "أحدث فرص شحن البضائع المعروضة",
    filtreParVille: "فرز بحسب الرمز أو الولاية",
    filtreParType: "تصنيف المركبات",
    voirOffre: "تفاصيل العرض",

    // Profile types translations
    profilDonneur: "آمر صرف بضائع",
    profilTransporteur: "ناقل مهني",
    profilCommissionnaire: "وسيط نقل معتمد",
    profilManutentionnaire: "مؤسسة خدمات مناولة",
    profilStockage: "مستودع تخزين للسلع",

    // Statut Offre Translation for badges
    statutPublie: "منشور في البورصة",
    statutAttribue: "تم التعيين والتعاقد",
    statutCharge: "قيد النقل على الطريق",
    statutDecharge: "وصل نقطة الوصول (تفريغ)",
    statutValide: "تم التسليم ومغلق بالكامل",

    // Miscellaneous
    de: "من",
    vers: "إلى",
    km: "كلم",
    valider: "تأكيد",
    poids: "الوزن",
    marchandise: "البضاعة",
    inscriptionBouton: "تأكيد التسجيل",
  }
};

export const translateMoyenType = (mtype: string, lang: LangType): string => {
  if (lang === "ar") {
    switch (mtype) {
      case "VUL": return "مركبة تجارية خفيفة (VUL)";
      case "Tracteur": return "جرار طريقي (Tracteur)";
      case "Tautliner": return "شاحنة ذات غطاء (Tautliner)";
      case "Fourgon": return "شاحنة مقفلة (Fourgon)";
      case "Plateau": return "شاحنة مسطحة (Plateau)";
      case "Porte-engin": return "حاملة آليات (Porte-engin)";
      case "Citerne": return "شاحنة صهريج (Citerne)";
      case "Camion frigorifique": return "شاحنة تبريد (Frigo)";
      case "Benne basculante": return "شاحنة قلابة (Benne)";
      case "Camion porteur": return "شاحنة ناقلة (Porteur)";
      case "Fardier": return "مقطورة حمولة ثقيلة (Fardier)";
      default: return mtype;
    }
  }
  return mtype;
};

export const translateCity = (city: string, lang: LangType): string => {
  if (lang === "ar") {
    switch (city.trim()) {
      case "Alger": return "الجزائر العاصمة";
      case "Adrar": return "أدرار";
      case "Béjaia": case "Béjaïa": return "بجاية";
      case "Djelfa": return "الجلفة";
      case "Chlef": return "الشلف";
      case "Tebessa": case "Tébessa": return "تبسة";
      case "Oran": return "وهران";
      case "Hassi Messaoud (HMD)": case "Hassi Messaoud": return "حاسي مسعود";
      case "Sétif": return "سطيف";
      case "Constantine": return "قسنطينة";
      default: return city;
    }
  }
  return city;
};

export const translateMarchandise = (marchandise: string, lang: LangType): string => {
  if (lang === "ar") {
    switch (marchandise.trim()) {
      case "Générale": return "بضاعة عامة";
      case "Conteneur": return "حاوية حمولة";
      case "Palettes": return "منصات خشبية";
      case "Gasoil": return "مازوت / وقود";
      default: return marchandise;
    }
  }
  return marchandise;
};

export const translateCommentaire = (comment: string, lang: LangType): string => {
  if (lang === "ar") {
    switch (comment.trim()) {
      case "Transport de produits alimentaires emballés sur palettes.":
        return "نقل عتاد ومواد غذائية معلبة على منصات خشبية حمايةً للسلع.";
      case "Conteneur métallique 40 pieds ISO lourd.":
        return "حاوية حديدية قوية 40 قدم ISO مخصصة للشحنات الثقيلة.";
      case "20 voyages réguliers programmés sur un mois.":
        return "20 رحلة برية منتظمة مبرمجة ومتفق عليها بالتساوي خلال شهر.";
      case "Transport de Gasoil industriel avec certificat de conformité ADR requis.":
        return "نقل المازوت الصناعي عالي الجودة مع اشتراط حيازة شهادة مطابقة المواد الخطرة (ADR) مطلوب.";
      default: return comment;
    }
  }
  return comment;
};
