/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Complete Internationalization (i18n) Type Definitions
 * Supports English ('en'), Hindi ('hi'), and Marathi ('mr').
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  native: string;
  flag?: string;
}

export const SUPPORTED_I18N_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

export interface TranslationDictionary {
  // Navigation & Common
  nav: {
    home: string;
    howItWorks: string;
    schemes: string;
    features: string;
    resources: string;
    about: string;
    dashboard: string;
    signIn: string;
    getStarted: string;
    profile: string;
    signOut: string;
    selectLanguage: string;
    publicSite: string;
    account: string;
  };

  // Auth & Citizen Session Modal
  auth: {
    signInTitle: string;
    signUpTitle: string;
    profileTitle: string;
    emailLabel: string;
    passwordLabel: string;
    nameLabel: string;
    languageLabel: string;
    submitSignIn: string;
    submitSignUp: string;
    guestContinue: string;
    guestBadge: string;
    savePreferences: string;
    signOut: string;
    emailNotConfirmed: string;
    resendConfirmation: string;
    switchSignIn: string;
    switchSignUp: string;
    guestModeTitle: string;
    guestModeDesc: string;
  };

  // Hero Section
  hero: {
    badge: string;
    titleStart: string;
    titleHighlight: string;
    subtitle: string;
    ctaDashboard: string;
    ctaGetStarted: string;
    ctaHowItWorks: string;
  };

  // Feature Section
  features: {
    badge: string;
    title: string;
    subtitle: string;
    claimLevelTitle: string;
    claimLevelSub: string;
    claimLevelDesc: string;
    claimLevelWorkflow: string;
    evidenceTitle: string;
    evidenceSub: string;
    evidenceDesc: string;
    evidenceWorkflow: string;
    documentTitle: string;
    documentSub: string;
    documentDesc: string;
    documentWorkflow: string;
  };

  // How It Works
  howItWorks: {
    badge: string;
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
  };

  // About Section
  about: {
    badge: string;
    title: string;
    p1: string;
    p2: string;
    c1Title: string;
    c1Desc: string;
    c2Title: string;
    c2Desc: string;
    c3Title: string;
    c3Desc: string;
  };

  // Principles & Trust
  principles: {
    badge: string;
    title: string;
    subtitle: string;
    p1Title: string;
    p1Desc: string;
    p2Title: string;
    p2Desc: string;
    p3Title: string;
    p3Desc: string;
    p4Title: string;
    p4Desc: string;
    p5Title: string;
    p5Desc: string;
  };

  // Footer
  footer: {
    mission: string;
    platform: string;
    legal: string;
    sovereignNotice: string;
    allRightsReserved: string;
    terms: string;
    privacy: string;
    disclaimer: string;
    systemStatus: string;
  };

  // Citizen Dashboard Common & Overview
  dashboard: {
    overview: string;
    verifyClaim: string;
    history: string;
    sources: string;
    welcomeBack: string;
    citizenWorkspace: string;
    accountSubtitle: string;
    totalAudited: string;
    supportedClaims: string;
    refutedClaims: string;
    pendingScrutiny: string;
    recentActivity: string;
    quickVerification: string;
    quickVerifyPlaceholder: string;
    verifyButton: string;
    viewAllHistory: string;
  };

  // Verification Workspace
  workspace: {
    title: string;
    subtitle: string;
    tabText: string;
    tabImage: string;
    tabPdf: string;
    tabUrl: string;
    intakePlaceholder: string;
    verifyButton: string;
    verifying: string;
    guidelinesTitle: string;
    resultTitle: string;
    noClaimEntered: string;
    examplesLabel: string;
    clearButton: string;
  };

  // Verification History
  history: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allStatus: string;
    statusSupported: string;
    statusContradicted: string;
    statusInsufficient: string;
    dateCol: string;
    claimCol: string;
    verdictCol: string;
    actionsCol: string;
    noRecords: string;
    deleteRecord: string;
    viewReport: string;
    paginationPage: string;
    paginationOf: string;
  };

  // Verification Result Detail
  resultDetail: {
    title: string;
    subtitle: string;
    verdictBadge: string;
    confidence: string;
    explanationTitle: string;
    assertionsTitle: string;
    citationsTitle: string;
    backButton: string;
    printReport: string;
    reVerify: string;
    statutoryDisclaimer: string;
  };

  // Sources & Evidence Directory
  sources: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allDomains: string;
    authorityCol: string;
    tierCol: string;
    sampleEvidenceCol: string;
    noSources: string;
    officialBadge: string;
    openPortal: string;
  };

  // Scheme Discovery Section
  schemes: {
    sectionBadge: string;
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    popularLabel: string;
    popularPills: {
      collegeScholarship: string;
      farmerSupport: string;
      solarPump: string;
      womenEntrepreneurs: string;
      healthCoverage: string;
      businessLoan: string;
    };
    filters: {
      allIndia: string;
      centralOnly: string;
      maharashtra: string;
      allCategories: string;
      allStatuses: string;
      resetFilters: string;
    };
    resultsCount: string;
    sovereignRepositories: string;
    noSchemesFound: string;
    noSchemesMessage: string;
    detailsButton: string;
    checkEligibility: string;
    applicationAssistance: string;
    officialPortal: string;
    statusActive: string;
    statusUpcoming: string;
    statusClosed: string;
  };

  // Scheme Detail Modal
  schemeDetail: {
    overviewTab: string;
    eligibilityTab: string;
    documentsTab: string;
    roadmapTab: string;
    checkerTab: string;
    benefitsTitle: string;
    criteriaTitle: string;
    documentsTitle: string;
    portalTitle: string;
    verifyClaimAction: string;
    closeButton: string;
    ministryLabel: string;
    jurisdictionLabel: string;
    stateLabel: string;
  };

  // Eligibility Engine (Phase 6)
  eligibility: {
    modalTitle: string;
    step1Privacy: string;
    step2Profile: string;
    step3ConditionAudit: string;
    step4DocReadiness: string;
    step5Roadmap: string;
    step6Alternatives: string;
    privacyNoticeTitle: string;
    privacyNoticeBody: string;
    noAadhaarGuarantee: string;
    evaluationSummaryTitle: string;
    statusPotentiallyEligible: string;
    statusCriteriaUnmet: string;
    statusInsufficientInfo: string;
    conditionSatisfied: string;
    conditionNotSatisfied: string;
    conditionUnknown: string;
    conditionNotApplicable: string;
    ageLabel: string;
    stateLabel: string;
    incomeLabel: string;
    educationLabel: string;
    occupationLabel: string;
    landholderLabel: string;
    landholdingSize: string;
    businessOwnerLabel: string;
    casteCategoryLabel: string;
    genderLabel: string;
    collegeEnrolledLabel: string;
    kutchaHouseLabel: string;
    electricityConnectionLabel: string;
    evaluateButton: string;
    reEvaluateButton: string;
    disclaimer: string;
  };

  // Application Guidance & Roadmap (Phase 7)
  guidance: {
    modalTitle: string;
    tabRoadmap: string;
    tabDocuments: string;
    tabStatus: string;
    tabAssistant: string;
    applicationMethod: string;
    onlineMethod: string;
    offlineMethod: string;
    hybridMethod: string;
    verifiedPortal: string;
    unverifiedPortal: string;
    openOfficialPortal: string;
    prepareDocuments: string;
    applicationWindow: string;
    submissionAuthority: string;
    onlinePathwayTitle: string;
    offlinePathwayTitle: string;
    approvalStagesTitle: string;
    helpdeskTitle: string;
    verifiedSourcesTitle: string;
    statutoryDisclaimer: string;
    docReadinessTitle: string;
    docsReadyCount: string;
    markReady: string;
    markedReady: string;
    mandatory: string;
    optional: string;
    issuedBy: string;
    formatReq: string;
    validityReq: string;
    obtainVia: string;
    docPrivacyNotice: string;
    selectStatusLabel: string;
    statusMeaningTitle: string;
    recommendedNextSteps: string;
    trackingChannelsTitle: string;
    appealPathwayTitle: string;
    statusDisclaimer: string;
  };

  // AI Application Assistant
  assistant: {
    welcomeMessage: string;
    promptSuggestions: {
      mandatoryDocs: string;
      cscApply: string;
      timeline: string;
      trackStatus: string;
    };
    groundedBadge: string;
    unverifiedBadge: string;
    citationsLabel: string;
    consultingNotice: string;
    inputPlaceholder: string;
    askButton: string;
    piiWarningAadhaar: string;
    piiWarningPan: string;
    piiWarningCreds: string;
    disclaimer: string;
  };

  // Voice Citizen Assistant
  voice: {
    title: string;
    subtitle: string;
    startRecording: string;
    stopRecording: string;
    listening: string;
    processing: string;
    micPermissionDenied: string;
    micUnsupported: string;
    editTranscriptNotice: string;
    sendQuery: string;
    clearTranscript: string;
    inputPlaceholder: string;
    speechSpeed: string;
    playingAudio: string;
    pauseAudio: string;
    resumeAudio: string;
    stopAudio: string;
    quickPromptsTitle: string;
    prompts: {
      discovery: string;
      eligibility: string;
      application: string;
      verification: string;
    };
    privacyBadge: string;
    speakPrompt: string;
    greeting: string;
    notSupported: string;
    lifecycle: {
      requestingPermission: string;
      listening: string;
      processing: string;
      submitting: string;
      responding: string;
      transcriptReady: string;
    };
  };

  // Verification Console (Public Home)
  console: {
    title: string;
    authoritativeBadge: string;
    authenticatedCitizen: string;
    publicAccess: string;
    tabClaim: string;
    tabDocument: string;
    tabUrl: string;
    claimPlaceholder: string;
    verifyButton: string;
    verifying: string;
    queuedBadge: string;
    queuedTitle: string;
    queuedDesc: string;
    requestId: string;
    copyId: string;
    copiedId: string;
    downloadReport: string;
    urlPlaceholder: string;
    inspectUrlButton: string;
    inspectingUrl: string;
    examplesLabel: string;
    clearButton: string;
  };

  // Category Explorer
  categoryExplorer: {
    badge: string;
    title: string;
    subtitle: string;
    exploreBtn: string;
  };

  // Trust Section
  trustSection: {
    t1Title: string;
    t1Desc: string;
    t2Title: string;
    t2Desc: string;
    t3Title: string;
    t3Desc: string;
    t4Title: string;
    t4Desc: string;
  };

  // Evidence Explainer
  evidenceExplainer: {
    badge: string;
    title: string;
    subtitle: string;
    sampleInputTitle: string;
    sampleInputType: string;
    sampleInputText: string;
    breakdownTitle: string;
    breakdownDesc: string;
    crosscheckTitle: string;
    crosscheckDesc: string;
  };

  // Example Claims
  exampleClaims: {
    badge: string;
    title: string;
    subtitle: string;
    clickToVerify: string;
  };

  // FAQ Section
  faqSection: {
    badge: string;
    title: string;
    subtitle: string;
  };

  // CTA Section
  ctaSection: {
    badge: string;
    title: string;
    subtitle: string;
    getStarted: string;
    reviewPrinciples: string;
  };

  // Action Guidance
  actionGuidance: {
    title: string;
    subtitle: string;
    officialPortalNotice: string;
    grievanceNotice: string;
    safePracticesNotice: string;
  };

  // Status Guide
  statusGuide: {
    title: string;
    subtitle: string;
    notStarted: string;
    documentsPending: string;
    readyToApply: string;
    submitted: string;
    underReview: string;
    approved: string;
    rejected: string;
    unknown: string;
  };
}
