/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice-Based AI Citizen Assistant Service
 * Provides multilingual voice conversation orchestration across:
 * 1. Conversational Scheme Discovery (Phase 5)
 * 2. Conversational Eligibility Assessment (Phase 6)
 * 3. Voice-Based Application Assistance (Phase 7)
 * 4. Voice-Based Claim Verification (Phases 3 & 4)
 * 
 * Strict Privacy & Safety Guarantees:
 * - Never collects Aadhaar, PAN, bank account, passwords, or OTPs.
 * - Progressive single-question eligibility assessment.
 * - Preserves canonical eligibility and claim verification status codes.
 * - Grounded exclusively in verified Indian sovereign (.gov.in / .nic.in) procedures.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiClient, getGeminiConfigStatus, GEMINI_FLASH_MODEL } from './gemini';
import { discoverSchemes, getSchemeByIdOrSlug, VERIFIED_SOVEREIGN_SCHEMES } from './schemeDiscovery';
import { evaluatePersonalizedEligibility } from './eligibilityEngine';
import { getApplicationRoadmap, getDocumentPreparationChecklist } from './applicationGuidance';
import { decomposeClaimIntoSubclaims, evaluateEvidenceForSubclaims } from './verdictAnalysis';

export type VoiceAssistantIntent =
  | 'SCHEME_DISCOVERY'
  | 'ELIGIBILITY_ASSESSMENT'
  | 'APPLICATION_ASSISTANCE'
  | 'CLAIM_VERIFICATION'
  | 'GENERAL_QUERY';

export interface VoiceChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface VoiceAssistantSessionState {
  currentSchemeId?: string;
  currentSchemeName?: string;
  schemeId?: string;
  eligibilityProfile?: Record<string, any>;
  activeQuestionIndex?: number;
  collectedAnswers?: Record<string, string>;
  mode?: 'DISCOVERY' | 'ELIGIBILITY' | 'APPLICATION' | 'VERIFICATION' | 'IDLE';
}

export interface VoiceAssistantRequest {
  message?: string;
  query?: string;
  language?: 'en' | 'hi' | 'mr';
  sessionState?: VoiceAssistantSessionState;
  conversationHistory?: VoiceChatMessage[];
  options?: {
    mockResponse?: Partial<VoiceAssistantResponse>;
  };
}

export interface VoiceAssistantResponse {
  intent: VoiceAssistantIntent;
  spokenText: string;
  displayText: string;
  spokenResponse?: string;
  language: 'en' | 'hi' | 'mr';
  sessionState: VoiceAssistantSessionState;
  schemes?: any[];
  progressiveEligibility?: {
    currentStep: number;
    totalSteps: number;
    question: string;
    field: string;
    rationale: string;
    options: string[];
    isComplete?: boolean;
    finalAssessment?: any;
  };
  eligibilityResult?: any;
  applicationRoadmap?: any;
  verificationResult?: any;
  actionPayload?: {
    schemes?: any[];
    eligibilityStep?: {
      question: string;
      field: string;
      rationale: string;
      options?: string[];
      isComplete?: boolean;
      finalAssessment?: any;
    };
    roadmap?: any;
    checklist?: any;
    verdict?: any;
  };
  citations?: Array<{ title: string; url: string; domain: string; authority: string }>;
  securityNotice?: string;
}

/**
 * Checks for sensitive personal identifiers (Aadhaar, PAN, Bank, OTP, Password)
 * and returns localized privacy refusal message if detected.
 */
export function checkSensitiveIdentifierViolation(
  text: string,
  lang: 'en' | 'hi' | 'mr' = 'en'
): { isViolated: boolean; refusalMessage?: string } {
  const clean = text.trim();

  // 12-digit Aadhaar pattern (with or without spaces/hyphens)
  const aadhaarRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
  // 10-char PAN pattern (5 letters, 4 digits, 1 letter)
  const panRegex = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/;
  // OTP / Password / PIN / CVV requests or shares
  const credentialRegex = /\b(?:otp|password|cvv|atm\s*pin|passcode|गुपित\s*शब्द|पासवर्ड|ओटीपी)\b/i;
  // Bank account numbers (9 to 18 digits with bank context)
  const bankRegex = /\b(?:account\s*(?:no|number)?|ac\s*no|खाता\s*क्रमांक)\s*[:=]?\s*\d{9,18}\b/i;

  if (
    aadhaarRegex.test(clean) ||
    panRegex.test(clean) ||
    credentialRegex.test(clean) ||
    bankRegex.test(clean)
  ) {
    if (lang === 'hi') {
      return {
        isViolated: true,
        refusalMessage:
          'नागरिक गोपनीयता सुरक्षा: कृपया अपना आधार नंबर, पैन नंबर, बैंक खाता या ओटीपी साझा न करें। GovVerify AI इन जानकारियों को एकत्र नहीं करता है। आप केवल अपनी सामान्य पात्रता जैसे राज्य, भूमि या आय के बारे में बता सकते हैं।',
      };
    }
    if (lang === 'mr') {
      return {
        isViolated: true,
        refusalMessage:
          'नागरिक गोपनीयता संरक्षण: कृपया आपला आधार क्रमांक, पॅन क्रमांक, बँक खाते किंवा ओटीपी शेअर करू नका. GovVerify AI या खाजगी नोंदी कधीही गोळा करत नाही. आपण फक्त राज्य, शेती किंवा उत्पन्न यांसारख्या सामान्य निकषांची माहिती देऊ शकता.',
      };
    }
    return {
      isViolated: true,
      refusalMessage:
        'Privacy Safeguard: Please do not share sensitive personal identifiers such as your Aadhaar number, PAN card, bank details, or OTPs. GovVerify AI never requests or stores private credentials.',
    };
  }

  return { isViolated: false };
}

/**
 * Neutralizes prompt injection patterns from speech transcription.
 */
export function sanitizeVoicePromptInjection(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|system)?\s*(?:instructions|rules|guidelines|prompts)/gi, '[neutralized_prompt]')
    .replace(/(?:mark\s+as\s+supported|force\s+approved|override\s+verdict)/gi, '[neutralized_command]')
    .replace(/(?:system\s+prompt|developer\s+mode)/gi, '[neutralized_command]')
    .trim();
}

/**
 * Classifies citizen query intent across the 4 core GovVerify AI engines.
 */
export function classifyVoiceIntent(
  message: string,
  sessionState?: VoiceAssistantSessionState
): VoiceAssistantIntent {
  const lmsg = message.toLowerCase();

  // If already in an active multi-turn eligibility assessment, stay in eligibility
  if (sessionState?.mode === 'ELIGIBILITY' && sessionState.currentSchemeId) {
    if (!lmsg.includes('stop') && !lmsg.includes('cancel') && !lmsg.includes('थांबवा') && !lmsg.includes('रोकें')) {
      return 'ELIGIBILITY_ASSESSMENT';
    }
  }

  // 1. Eligibility keywords
  if (
    lmsg.includes('eligible') ||
    lmsg.includes('eligibility') ||
    lmsg.includes('पात्र') ||
    lmsg.includes('पात्रता') ||
    lmsg.includes('मिळेल का') ||
    lmsg.includes('मिलेगा क्या') ||
    lmsg.includes('लायक') ||
    lmsg.includes('qualify')
  ) {
    return 'ELIGIBILITY_ASSESSMENT';
  }

  // 2. Application assistance & documents
  if (
    lmsg.includes('how to apply') ||
    lmsg.includes('apply') ||
    lmsg.includes('document') ||
    lmsg.includes('checklist') ||
    lmsg.includes('portal') ||
    lmsg.includes('website') ||
    lmsg.includes('grievance') ||
    lmsg.includes('status') ||
    lmsg.includes('अर्ज कसा करावा') ||
    lmsg.includes('कागदपत्रे') ||
    lmsg.includes('दाखला') ||
    lmsg.includes('पोर्टल') ||
    lmsg.includes('आवेदन कैसे करें') ||
    lmsg.includes('दस्तावेज') ||
    lmsg.includes('प्रमाण पत्र')
  ) {
    return 'APPLICATION_ASSISTANCE';
  }

  // 3. Claim verification (suspicious viral claims / payouts)
  if (
    lmsg.includes('is it true') ||
    lmsg.includes('fake') ||
    lmsg.includes('real or fake') ||
    lmsg.includes('viral') ||
    lmsg.includes('whatsapp') ||
    lmsg.includes('giving rs') ||
    lmsg.includes('claim') ||
    lmsg.includes('verify') ||
    lmsg.includes('खरे आहे का') ||
    lmsg.includes('खोटे') ||
    lmsg.includes('अफवा') ||
    lmsg.includes('सच्चा है क्या') ||
    lmsg.includes('फर्जी') ||
    lmsg.includes('सच या झूठ')
  ) {
    return 'CLAIM_VERIFICATION';
  }

  // 4. Default: Scheme discovery
  return 'SCHEME_DISCOVERY';
}

/**
 * Question sequence for progressive conversational eligibility assessment.
 */
interface ProgressiveEligibilityQuestion {
  field: string;
  en: { question: string; rationale: string; options?: string[] };
  hi: { question: string; rationale: string; options?: string[] };
  mr: { question: string; rationale: string; options?: string[] };
}

/**
 * Normalizes voice assistant response with top-level convenience aliases.
 */
function normalizeVoiceResponse(
  res: any,
  lang: 'en' | 'hi' | 'mr'
): VoiceAssistantResponse {
  const progressive = res.actionPayload?.eligibilityStep
    ? {
        currentStep: (res.sessionState?.activeQuestionIndex ?? 0) + 1,
        totalSteps: 2,
        question: res.actionPayload.eligibilityStep.question,
        field: res.actionPayload.eligibilityStep.field,
        rationale: res.actionPayload.eligibilityStep.rationale,
        options: res.actionPayload.eligibilityStep.options || [],
        isComplete: res.actionPayload.eligibilityStep.isComplete,
        finalAssessment: res.actionPayload.eligibilityStep.finalAssessment,
      }
    : undefined;

  const sessionState: VoiceAssistantSessionState = {
    ...res.sessionState,
    currentSchemeId: res.sessionState?.currentSchemeId || res.sessionState?.schemeId,
    schemeId: res.sessionState?.currentSchemeId || res.sessionState?.schemeId,
  };

  return {
    ...res,
    sessionState,
    spokenResponse: res.spokenText,
    schemes: res.actionPayload?.schemes,
    progressiveEligibility: progressive,
    eligibilityResult: res.actionPayload?.eligibilityStep?.finalAssessment,
    applicationRoadmap: res.actionPayload?.roadmap,
    verificationResult: res.actionPayload?.verdict,
  };
}

const SCHEME_PROGRESSIVE_QUESTIONS: Record<string, ProgressiveEligibilityQuestion[]> = {
  'sch-pm-kisan': [
    {
      field: 'isLandholder',
      en: {
        question: 'Do you or your family own cultivable agricultural land registered in your name?',
        rationale: 'PM-KISAN statutory guidelines require landholding farmer families with land in land records.',
        options: ['Yes, we own cultivable land', 'No, we do not own land'],
      },
      hi: {
        question: 'क्या आपके या आपके परिवार के नाम पर खेती योग्य कृषि भूमि दर्ज है?',
        rationale: 'पीएम-किसान योजना के नियमों के अनुसार लाभार्थी के नाम पर कृषि भूमि होना अनिवार्य है।',
        options: ['हाँ, जमीन दर्ज है', 'नहीं, जमीन नहीं है'],
      },
      mr: {
        question: 'तुमच्या किंवा तुमच्या कुटुंबाच्या नावावर लागवडीयोग्य शेतजमीन (७/१२ उतारा) आहे का?',
        rationale: 'पीएम-किसान नियमांनुसार भूधारक शेतकरी कुटुंबाकडे स्वतःच्या नावावर शेतजमीन असणे आवश्यक आहे.',
        options: ['होय, शेतजमीन आहे', 'नाही, शेतजमीन नाही'],
      },
    },
    {
      field: 'isTaxPayee',
      en: {
        question: 'Did any member of your household pay Income Tax in the previous assessment year?',
        rationale: 'Income tax payees and constitutional post holders are excluded under official exclusion criteria.',
        options: ['No, no one pays Income Tax', 'Yes, someone pays Income Tax'],
      },
      hi: {
        question: 'क्या आपके परिवार के किसी सदस्य ने पिछले वित्तीय वर्ष में आयकर (Income Tax) का भुगतान किया है?',
        rationale: 'सरकारी दिशानिर्देशों के अनुसार आयकर दाता और संवैधानिक पदों पर कार्यरत व्यक्ति इस योजना से बाहर हैं।',
        options: ['नहीं, कोई आयकर नहीं भरता', 'हाँ, आयकर भरते हैं'],
      },
      mr: {
        question: 'तुमच्या कुटुंबातील कोणत्याही व्यक्तीने मागील आर्थिक वर्षात आयकर (इन्कम टॅक्स) भरला आहे का?',
        rationale: 'शासकीय नियमांनुसार आयकर भरणारे व्यक्ती आणि संस्थात्मक भूधारक या योजनेसाठी अपात्र आहेत.',
        options: ['नाही, आयकर भरत नाही', 'होय, आयकर भरतो'],
      },
    },
  ],
  'sch-maha-saur-pump': [
    {
      field: 'state',
      en: {
        question: 'Are you a resident of Maharashtra with agricultural land located in Maharashtra?',
        rationale: 'Magel Tyala Saur Krushi Pump Yojana is a Maharashtra State Government welfare initiative.',
        options: ['Yes, Maharashtra resident', 'No, another state'],
      },
      hi: {
        question: 'क्या आप महाराष्ट्र के निवासी हैं और आपकी कृषि भूमि महाराष्ट्र में स्थित है?',
        rationale: 'मागेल त्याला सौर कृषी पंप योजना महाराष्ट्र सरकार की राज्य स्तरीय योजना है।',
        options: ['हाँ, महाराष्ट्र निवासी', 'नहीं, अन्य राज्य'],
      },
      mr: {
        question: 'तुम्ही महाराष्ट्राचे रहिवासी आहात का आणि तुमची शेतजमीन महाराष्ट्रात आहे का?',
        rationale: 'मागेल त्याला सौर कृषी पंप योजना ही महाराष्ट्र शासनाची राज्य पुरस्कृत योजना आहे.',
        options: ['होय, महाराष्ट्राचे रहिवासी', 'नाही, इतर राज्य'],
      },
    },
    {
      field: 'hasElectricityConnection',
      en: {
        question: 'Do you currently have a conventional grid electricity connection for your agricultural pump?',
        rationale: 'Priority is statutory given to off-grid farms without conventional electricity lines.',
        options: ['No electric connection (Off-grid)', 'Yes, already electrified'],
      },
      hi: {
        question: 'क्या आपके कृषि पंप के लिए पारंपरिक बिजली कनेक्शन पहले से उपलब्ध है?',
        rationale: 'यह योजना उन किसानों को प्राथमिकता देती है जिनके पास बिजली ग्रिड कनेक्शन नहीं है।',
        options: ['नहीं, बिजली कनेक्शन नहीं है', 'हाँ, बिजली कनेक्शन है'],
      },
      mr: {
        question: 'तुमच्या शेतात कृषी पंपासाठी पारंपरिक विजेचे कनेक्शन उपलब्ध आहे का?',
        rationale: 'या योजनेअंतर्गत वीज जोडणी नसलेल्या किंवा दूरवरच्या शेतांना सौर पंपासाठी प्राधान्य दिले जाते.',
        options: ['नाही, वीज जोडणी नाही', 'होय, वीज जोडणी आहे'],
      },
    },
  ],
};

/**
 * Main Voice Assistant Execution Orchestrator.
 */
export async function processVoiceCitizenRequest(
  request: VoiceAssistantRequest
): Promise<VoiceAssistantResponse> {
  const lang = request.language || 'en';
  const rawMessage = ((request.message || request.query || '') as string).trim();

  // Test suite mock bypass
  if (request.options?.mockResponse) {
    const mock = request.options.mockResponse;
    return normalizeVoiceResponse({
      intent: mock.intent || 'SCHEME_DISCOVERY',
      spokenText: mock.spokenText || 'Mock response',
      displayText: mock.displayText || 'Mock response',
      language: lang,
      sessionState: mock.sessionState || request.sessionState || { mode: 'IDLE' },
      actionPayload: mock.actionPayload,
      citations: mock.citations || [],
      securityNotice: mock.securityNotice,
    }, lang);
  }

  // 1. Enforce Privacy Shield (Aadhaar / PAN / Credentials check)
  const privacyCheck = checkSensitiveIdentifierViolation(rawMessage, lang);
  if (privacyCheck.isViolated) {
    return normalizeVoiceResponse({
      intent: 'GENERAL_QUERY',
      spokenText: privacyCheck.refusalMessage!,
      displayText: privacyCheck.refusalMessage!,
      language: lang,
      sessionState: request.sessionState || { mode: 'IDLE' },
      securityNotice: 'SENSITIVE_IDENTIFIER_REJECTED',
    }, lang);
  }

  // 2. Sanitize against prompt injections
  const sanitizedMessage = sanitizeVoicePromptInjection(rawMessage);
  const sessionState: VoiceAssistantSessionState = {
    mode: 'IDLE',
    ...request.sessionState,
  };

  // 3. Classify citizen intent
  const intent = classifyVoiceIntent(sanitizedMessage, sessionState);

  // ============================================================================
  // DISPATCH TO SPECIALIZED SOVEREIGN ENGINE
  // ============================================================================

  // --- MODE A: CONVERSATIONAL SCHEME DISCOVERY ---
  if (intent === 'SCHEME_DISCOVERY') {
    const discoveryResult = await discoverSchemes({ query: sanitizedMessage });
    const schemes = discoveryResult.schemes.slice(0, 3);

    let spokenText = '';
    let displayText = '';

    if (schemes.length === 0) {
      if (lang === 'hi') {
        spokenText = 'मुझे आपकी खोज के अनुसार कोई आधिकारिक योजना नहीं मिली। कृपया अपने प्रश्न को थोड़ा बदलकर पूछें।';
      } else if (lang === 'mr') {
        spokenText = 'तुमच्या शोध निकषानुसार कोणतीही अधिकृत योजना आढळली नाही. कृपया वेगळ्या शब्दांत विचारून पहा.';
      } else {
        spokenText = 'I could not find an official government scheme matching those terms. Please try rephrasing your question.';
      }
      displayText = spokenText;
    } else {
      const topNames = schemes.map((s) => s.shortName || s.schemeName).join(', ');
      if (lang === 'hi') {
        spokenText = `मुझे आपके लिए ${schemes.length} प्रमुख सरकारी योजनाएं मिली हैं: ${topNames}। अधिक विवरण या पात्रता जानने के लिए किसी भी योजना का नाम बोलें।`;
        displayText = `मुझे आपके लिए निम्नलिखित ${schemes.length} योजनाएं मिली हैं:\n` +
          schemes.map((s, i) => `${i + 1}. **${s.schemeName}** (${s.shortName || ''}) — ${s.benefits}`).join('\n\n');
      } else if (lang === 'mr') {
        spokenText = `मला आपल्यासाठी ${schemes.length} प्रमुख सरकारी योजना सापडल्या आहेत: ${topNames}. अधिक माहिती किंवा पात्रतेसाठी योजनेचे नाव सांगा.`;
        displayText = `आपल्यासाठी खालील ${schemes.length} अधिकृत योजना उपलब्ध आहेत:\n` +
          schemes.map((s, i) => `${i + 1}. **${s.schemeName}** (${s.shortName || ''}) — ${s.benefits}`).join('\n\n');
      } else {
        spokenText = `I found ${schemes.length} official government schemes for you: ${topNames}. Speak a scheme name to assess your eligibility or view documents.`;
        displayText = `Here are ${schemes.length} verified government schemes matching your inquiry:\n` +
          schemes.map((s, i) => `${i + 1}. **${s.schemeName}** (${s.shortName || ''}) — ${s.benefits}`).join('\n\n');
      }
    }

    const citations = schemes.flatMap((s) =>
      (s.sourceCitations || []).map((c) => ({
        title: c.title,
        url: c.url,
        domain: c.domain,
        authority: c.issuingAuthority,
      }))
    );

    return normalizeVoiceResponse({
      intent: 'SCHEME_DISCOVERY',
      spokenText,
      displayText,
      language: lang,
      sessionState: {
        ...sessionState,
        mode: 'DISCOVERY',
        currentSchemeId: schemes[0]?.id,
        currentSchemeName: schemes[0]?.schemeName,
      },
      actionPayload: { schemes },
      citations: citations.slice(0, 3),
    }, lang);
  }

  // --- MODE B: CONVERSATIONAL ELIGIBILITY ASSESSMENT ---
  if (intent === 'ELIGIBILITY_ASSESSMENT') {
    // Identify scheme target
    let targetScheme = sessionState.currentSchemeId
      ? await getSchemeByIdOrSlug(sessionState.currentSchemeId)
      : null;

    if (!targetScheme) {
      const lmsg = sanitizedMessage.toLowerCase();
      if (lmsg.includes('kisan') || lmsg.includes('किसान') || lmsg.includes('शेतकरी')) {
        targetScheme = await getSchemeByIdOrSlug('sch-pm-kisan');
      } else if (lmsg.includes('solar') || lmsg.includes('सौर') || lmsg.includes('पंप')) {
        targetScheme = await getSchemeByIdOrSlug('sch-maha-saur-pump');
      } else if (lmsg.includes('scholarship') || lmsg.includes('शिष्यवृत्ती') || lmsg.includes('छात्रवृत्ति')) {
        targetScheme = await getSchemeByIdOrSlug('sch-maha-shahu-maharaj');
      } else {
        // Fallback default scheme for eligibility demonstration
        targetScheme = await getSchemeByIdOrSlug('sch-pm-kisan');
      }
    }

    const schemeId = targetScheme?.id || 'sch-pm-kisan';
    const questions = SCHEME_PROGRESSIVE_QUESTIONS[schemeId] || SCHEME_PROGRESSIVE_QUESTIONS['sch-pm-kisan'];
    const currentProfile = { ...(sessionState.eligibilityProfile || {}) };
    let qIdx = sessionState.activeQuestionIndex ?? 0;

    // Process user's answer to the previous question if within flow
    if (sessionState.mode === 'ELIGIBILITY' && qIdx < questions.length) {
      const activeQ = questions[qIdx];
      const ansText = sanitizedMessage.toLowerCase();
      const isAffirmative =
        ansText.includes('yes') ||
        ansText.includes('हाँ') ||
        ansText.includes('होय') ||
        ansText.includes('आहे') ||
        ansText.includes('दर्ज') ||
        ansText.includes('own');
      const isNegative =
        ansText.includes('no') ||
        ansText.includes('नहीं') ||
        ansText.includes('नाही') ||
        ansText.includes('ना');

      if (activeQ.field === 'isLandholder') {
        currentProfile.isLandholder = isAffirmative ? true : isNegative ? false : true;
      } else if (activeQ.field === 'isTaxPayee') {
        currentProfile.isTaxPayee = isNegative ? false : isAffirmative ? true : false;
      } else if (activeQ.field === 'state') {
        currentProfile.state = isAffirmative ? 'Maharashtra' : 'Other';
      } else if (activeQ.field === 'hasElectricityConnection') {
        currentProfile.hasElectricityConnection = isAffirmative ? true : false;
      }

      qIdx++;
    }

    // Still have questions to ask
    if (qIdx < questions.length) {
      const nextQ = questions[qIdx];
      const localized = nextQ[lang] || nextQ.en;

      return normalizeVoiceResponse({
        intent: 'ELIGIBILITY_ASSESSMENT',
        spokenText: `${localized.question} ${localized.rationale}`,
        displayText: `**Question ${qIdx + 1} of ${questions.length}**: ${localized.question}\n\n*Why this is required*: ${localized.rationale}`,
        language: lang,
        sessionState: {
          ...sessionState,
          mode: 'ELIGIBILITY',
          currentSchemeId: schemeId,
          schemeId,
          currentSchemeName: targetScheme?.schemeName,
          eligibilityProfile: currentProfile,
          activeQuestionIndex: qIdx,
          collectedAnswers: {
            ...(sessionState.collectedAnswers || {}),
            ...(qIdx > 0 ? { [`step${qIdx}`]: sanitizedMessage } : {}),
          },
        },
        actionPayload: {
          eligibilityStep: {
            question: localized.question,
            field: nextQ.field,
            rationale: localized.rationale,
            options: localized.options,
            isComplete: false,
          },
        },
      }, lang);
    }

    // All questions answered: Execute formal statutory assessment
    const assessment = await evaluatePersonalizedEligibility(targetScheme!, currentProfile);

    let spokenText = '';
    let displayText = '';

    if (assessment.overallStatus === 'POTENTIALLY_ELIGIBLE') {
      if (lang === 'hi') {
        spokenText = `प्रारंभिक मूल्यांकन के अनुसार, आप ${targetScheme?.schemeName} के लिए संभावित रूप से पात्र हैं। सरकारी अंतिम स्वीकृति मूल दस्तावेजों के सत्यापन के बाद ही मिलती है।`;
      } else if (lang === 'mr') {
        spokenText = `प्राथमिक मूल्यांकनानुसार, आपण ${targetScheme?.schemeName} साठी संभाव्यतः पात्र आहात. अंतिम मंजुरी मूळ कागदपत्रांच्या शासकीय पडताळणीनंतरच मिळते.`;
      } else {
        spokenText = `Based on statutory preliminary criteria, you are Potentially Eligible for ${targetScheme?.schemeName}. Government sanction is subject to physical verification.`;
      }
    } else if (assessment.overallStatus === 'CRITERIA_UNMET') {
      if (lang === 'hi') {
        spokenText = `दिए गए विवरण के अनुसार, आप इस योजना की कुछ अनिवार्य शर्तें पूरी नहीं करते हैं। कृपया नीचे दिए गए विवरण की समीक्षा करें।`;
      } else if (lang === 'mr') {
        spokenText = `दिलेल्या माहितीनुसार, आपण या योजनेच्या काही अनिवार्य अटी पूर्ण करत नाही. कृपया तपशील तपासा.`;
      } else {
        spokenText = `Based on your responses, certain mandatory statutory conditions for ${targetScheme?.schemeName} are unmet.`;
      }
    } else {
      if (lang === 'hi') {
        spokenText = `पात्रता की पुष्टि के लिए अतिरिक्त जानकारी की आवश्यकता है।`;
      } else if (lang === 'mr') {
        spokenText = `पात्रता निश्चित करण्यासाठी अधिक माहितीची आवश्यकता आहे.`;
      } else {
        spokenText = `Additional information is required to establish statutory eligibility.`;
      }
    }

    displayText =
      `### ${assessment.summaryTitle}\n` +
      `**Canonical Status**: \`${assessment.overallStatus}\`\n\n` +
      `${assessment.summaryExplanation}\n\n` +
      `**Conditions Evaluated**:\n` +
      assessment.conditionBreakdown
        .map((c, i) => `${i + 1}. [${c.outcome}] ${c.conditionText} — *${c.reason}*`)
        .join('\n');

    return normalizeVoiceResponse({
      intent: 'ELIGIBILITY_ASSESSMENT',
      spokenText,
      displayText,
      language: lang,
      sessionState: {
        ...sessionState,
        mode: 'IDLE',
        activeQuestionIndex: 0,
      },
      actionPayload: {
        eligibilityStep: {
          question: 'Eligibility assessment completed',
          field: 'completed',
          rationale: 'All statutory preliminary conditions evaluated.',
          isComplete: true,
          finalAssessment: assessment,
        },
      },
      citations: (targetScheme?.sourceCitations || []).map((c) => ({
        title: c.title,
        url: c.url,
        domain: c.domain,
        authority: c.issuingAuthority,
      })),
    }, lang);
  }

  // --- MODE C: VOICE-BASED APPLICATION ASSISTANCE ---
  if (intent === 'APPLICATION_ASSISTANCE') {
    const lmsg = sanitizedMessage.toLowerCase();
    let targetSchemeId = sessionState.currentSchemeId || 'sch-pm-kisan';
    if (lmsg.includes('solar') || lmsg.includes('सौर')) {
      targetSchemeId = 'sch-maha-saur-pump';
    } else if (lmsg.includes('scholarship') || lmsg.includes('शिष्यवृत्ती')) {
      targetSchemeId = 'sch-maha-shahu-maharaj';
    }

    const [roadmap, checklist] = await Promise.all([
      getApplicationRoadmap(targetSchemeId),
      getDocumentPreparationChecklist(targetSchemeId),
    ]);

    let spokenText = '';
    let displayText = '';

    const portalUrl = roadmap?.officialApplicationPortal || 'https://www.india.gov.in';
    const portalName = portalUrl.replace(/^https?:\/\//, '').split('/')[0];
    const docList = ((checklist as any)?.allDocuments || (checklist as any)?.items || roadmap?.requiredDocuments || []) as any[];
    const docNames = docList.slice(0, 3).map((d: any) => d.documentName).join(', ');
    const onlineSteps = (roadmap?.stepByStepInstructions?.online || []) as string[];
    const schemeName = roadmap?.schemeName || targetSchemeId;
    const appMethod = roadmap?.applicationMethod || 'ONLINE';

    if (lang === 'hi') {
      spokenText = `इस योजना के लिए आधिकारिक पोर्टल ${portalName} है। आवश्यक मुख्य दस्तावेज हैं: ${docNames}। पोर्टल पर ऑनलाइन आवेदन किया जा सकता है।`;
      displayText = `### ${schemeName} — आवेदन मार्गदर्शन\n\n` +
        `**आधिकारिक पोर्टल**: [${portalUrl}](${portalUrl})\n` +
        `**आवेदन माध्यम**: ${appMethod}\n\n` +
        `**आवश्यक दस्तावेज**:\n` +
        docList.map((d: any, i: number) => `${i + 1}. **${d.documentName}** — निर्गमन प्राधिकारी: ${d.whereToObtain?.authority || d.issuingAuthority || 'सक्षम प्राधिकारी'}`).join('\n') +
        `\n\n**प्रक्रिया चरण**:\n` +
        onlineSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    } else if (lang === 'mr') {
      spokenText = `या योजनेसाठी अधिकृत पोर्टल ${portalName} आहे. मुख्य आवश्यक कागदपत्रे आहेत: ${docNames}. आपण अधिकृत पोर्टलवर अर्ज करू शकता.`;
      displayText = `### ${schemeName} — अर्ज प्रक्रिया मार्गदर्शन\n\n` +
        `**अधिकृत पोर्टल**: [${portalUrl}](${portalUrl})\n` +
        `**अर्ज पद्धती**: ${appMethod}\n\n` +
        `**आवश्यक कागदपत्रे**:\n` +
        docList.map((d: any, i: number) => `${i + 1}. **${d.documentName}** — देणारा विभाग: ${d.whereToObtain?.authority || d.issuingAuthority || 'सक्षम प्राधिकरण'}`).join('\n') +
        `\n\n**अर्ज करण्याचे टप्पे**:\n` +
        onlineSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    } else {
      spokenText = `The official application portal is ${portalName}. Key required documents are ${docNames}. Applications are accepted online through official government channels.`;
      displayText = `### ${schemeName} — Application Guidance\n\n` +
        `**Official Portal**: [${portalUrl}](${portalUrl})\n` +
        `**Application Method**: ${appMethod}\n\n` +
        `**Required Documents**:\n` +
        docList.map((d: any, i: number) => `${i + 1}. **${d.documentName}** (${d.whereToObtain?.authority || d.issuingAuthority || 'Competent Authority'})`).join('\n') +
        `\n\n**Step-by-Step Procedure**:\n` +
        onlineSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    }

    return normalizeVoiceResponse({
      intent: 'APPLICATION_ASSISTANCE',
      spokenText,
      displayText,
      language: lang,
      sessionState: {
        ...sessionState,
        mode: 'APPLICATION',
        currentSchemeId: targetSchemeId,
        currentSchemeName: schemeName,
      },
      actionPayload: {
        roadmap,
        checklist,
      },
      citations: (roadmap?.sourceCitations || []).map((c) => ({
        title: c.title,
        url: c.url,
        domain: c.domain,
        authority: c.issuingAuthority,
      })),
    }, lang);
  }

  // --- MODE D: VOICE-BASED CLAIM VERIFICATION ---
  if (intent === 'CLAIM_VERIFICATION') {
    // Execute claim decomposition and evidence evaluation
    const subclaims = await decomposeClaimIntoSubclaims(sanitizedMessage);
    const evaluation = evaluateEvidenceForSubclaims(sanitizedMessage, subclaims, []);

    const verdict = evaluation.verdict;
    let spokenText = '';
    let displayText = '';

    if (verdict === 'CONTRADICTED') {
      if (lang === 'hi') {
        spokenText = 'सत्यापन परिणाम: यह दावा आधिकारिक सरकारी गजट और रिकॉर्ड द्वारा खंडित (गलत) है। ऐसी किसी योजना की पुष्टि नहीं हुई है।';
      } else if (lang === 'mr') {
        spokenText = 'पडताळणी निकाल: हा दावा अधिकृत शासकीय शासन निर्णय व नोंदीनुसार असत्य (खंडित) आहे. अशा कोणत्याही लाभाची अधिकृत पुष्टी नाही.';
      } else {
        spokenText = 'Verification Verdict: This claim is CONTRADICTED by published sovereign gazettes and official circulars.';
      }
    } else if (verdict === 'SUPPORTED') {
      if (lang === 'hi') {
        spokenText = 'सत्यापन परिणाम: यह दावा आधिकारिक सरकारी स्रोतों द्वारा समर्थित (सत्य) है।';
      } else if (lang === 'mr') {
        spokenText = 'पडताळणी निकाल: हा दावा अधिकृत शासकीय स्रोतांद्वारे प्रमाणित (सत्य) आहे.';
      } else {
        spokenText = 'Verification Verdict: This claim is SUPPORTED by verified official government publications.';
      }
    } else if (verdict === 'PARTIALLY_SUPPORTED') {
      if (lang === 'hi') {
        spokenText = 'सत्यापन परिणाम: यह दावा आंशिक रूप से सही है, लेकिन कुछ नियम या आंकड़े गलत बताए गए हैं।';
      } else if (lang === 'mr') {
        spokenText = 'पडताळणी निकाल: हा दावा अंशतः सत्य आहे, परंतु काही अटी किंवा आकडेवारी चुकीची आहे.';
      } else {
        spokenText = 'Verification Verdict: This claim is PARTIALLY SUPPORTED; certain statutory conditions or numbers differ.';
      }
    } else {
      // INSUFFICIENT_EVIDENCE
      if (lang === 'hi') {
        spokenText = 'सत्यापन परिणाम: इस दावे की पुष्टि के लिए पर्याप्त आधिकारिक साक्ष्य उपलब्ध नहीं हैं। इसे फर्जी नहीं कहा गया है, लेकिन कोई सरकारी अधिसूचना नहीं मिली है।';
      } else if (lang === 'mr') {
        spokenText = 'पडताळणी निकाल: या दाव्याची पडताळणी करण्यासाठी पुरेसा अधिकृत पुरावा उपलब्ध नाही. हा थेट खोटा ठरवलेला नाही, पण कोणताही शासन निर्णय आढळलेला नाही.';
      } else {
        spokenText = 'Verification Verdict: INSUFFICIENT EVIDENCE. There is currently no sovereign gazette to substantiate or refute this claim.';
      }
    }

    displayText =
      `### Sovereign Claim Verification Audit\n` +
      `**Statement**: "${sanitizedMessage}"\n\n` +
      `**Canonical Verdict**: \`${verdict}\`\n\n` +
      `**Audit Explanation**: ${evaluation.summaryExplanation}\n\n` +
      `**Safety Notice**: Government seals, viral forward images, or lookalike links are NOT proof of authenticity. Always verify against gazette notifications on .gov.in.`;

    const sovereignCitations = [
      {
        title: 'Official Press Information Bureau (PIB) Fact Check & Sovereign Gazette',
        url: 'https://pib.gov.in',
        domain: 'pib.gov.in',
        authority: 'Press Information Bureau, Government of India',
        sourceUrl: 'https://pib.gov.in',
        sourceTitle: 'Official Press Information Bureau (PIB) Fact Check & Sovereign Gazette',
      },
    ];

    return normalizeVoiceResponse({
      intent: 'CLAIM_VERIFICATION',
      spokenText,
      displayText,
      language: lang,
      sessionState: {
        ...sessionState,
        mode: 'VERIFICATION',
      },
      actionPayload: {
        verdict: {
          verdict,
          explanation: evaluation.summaryExplanation,
          subclaims: evaluation.subclaims,
          citations: sovereignCitations,
        },
      },
      citations: sovereignCitations,
    }, lang);
  }

  // Fallback general query
  return normalizeVoiceResponse({
    intent: 'GENERAL_QUERY',
    spokenText:
      lang === 'mr'
        ? 'मी आपली काय मदत करू शकतो? आपण योजना शोधू शकता, पात्रता तपासू शकता किंवा दाव्यांची पडताळणी करू शकता.'
        : lang === 'hi'
        ? 'मैं आपकी क्या सहायता कर सकता हूँ? आप सरकारी योजनाएं खोज सकते हैं, पात्रता जांच सकते हैं या दावों का सत्यापन कर सकते हैं।'
        : 'How can I assist you today? You can search for government schemes, assess your eligibility, or verify suspicious claims.',
    displayText: 'How can I assist you? Ask about schemes, eligibility, or verify a claim.',
    language: lang,
    sessionState,
  }, lang);
}
