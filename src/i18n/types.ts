/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 8: Internationalization (i18n) Type Definitions
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

  // Dashboard Common & Navigation
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
    // Canonical Status Display Labels (Display only — underlying status codes stay immutable)
    statusPotentiallyEligible: string;
    statusCriteriaUnmet: string;
    statusInsufficientInfo: string;
    conditionSatisfied: string;
    conditionNotSatisfied: string;
    conditionUnknown: string;
    conditionNotApplicable: string;
    // Questionnaire Labels
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
    // Document Preparation
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
    // Status Navigator
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
}
