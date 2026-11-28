/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Citizen-Friendly Verdict & Explanation Formatter
 * Translates canonical verification engine states into everyday plain language
 * for citizens without technical or algorithmic jargon, supporting en, hi, mr.
 */

import { SupportedLanguage } from '../i18n/types';

export type CanonicalVerdict =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export const CANONICAL_VERDICTS: readonly CanonicalVerdict[] = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
];

export function isCanonicalVerdict(verdict: unknown): verdict is CanonicalVerdict {
  return (
    typeof verdict === 'string' &&
    (CANONICAL_VERDICTS as readonly string[]).includes(verdict)
  );
}

export interface CitizenVerdictConfig {
  verdict: CanonicalVerdict;
  label: string;
  statement: string;
  badgeClass: string;
  pillClass: string;
  borderClass: string;
  dotColor: string;
  shortMeaning: string;
  nextStepsAdvice: string[];
}

export const CITIZEN_VERDICTS_MULTILINGUAL: Record<
  SupportedLanguage,
  Record<CanonicalVerdict, CitizenVerdictConfig>
> = {
  en: {
    SUPPORTED: {
      verdict: 'SUPPORTED',
      label: 'Supported',
      statement: 'The available evidence supports this claim.',
      badgeClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      pillClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      borderClass: 'border-[#C6F5D5]',
      dotColor: '#12B76A',
      shortMeaning:
        'Official information supports the key facts in this claim. Receiving any benefits depends on meeting the scheme\'s statutory eligibility and verification requirements.',
      nextStepsAdvice: [
        'Check the official portal link below if you wish to apply or verify individual eligibility.',
        'Always use official government web addresses (.gov.in or .nic.in) for applications and payments.',
        'Copy or share this fact check to help others stay informed with verified facts.',
      ],
    },
    PARTIALLY_SUPPORTED: {
      verdict: 'PARTIALLY_SUPPORTED',
      label: 'Partly True / Conditional',
      statement: 'Some parts are correct, but there are important conditions.',
      badgeClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      pillClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      borderClass: 'border-[#FEDF89]',
      dotColor: '#F79009',
      shortMeaning:
        'Some parts of this statement match verified government programs, but important conditions, prerequisites, or eligibility limits apply.',
      nextStepsAdvice: [
        'Read the detailed breakdown below to see which specific points are confirmed and which are not.',
        'Consult the primary ministry guidelines before making financial or administrative decisions.',
        'Submit a narrower question if you need to verify a specific condition.',
      ],
    },
    CONTRADICTED: {
      verdict: 'CONTRADICTED',
      label: 'Contradicted',
      statement: 'Reliable evidence contradicts this claim.',
      badgeClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      pillClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      borderClass: 'border-[#FECDCA]',
      dotColor: '#F04438',
      shortMeaning:
        'Authoritative government records, gazettes, or official clarifications directly contradict this statement. Beware of false claims or unauthorized demands.',
      nextStepsAdvice: [
        'Do not forward or act upon viral messages repeating this claim.',
        'Beware of unofficial websites asking for registration fees or personal documents.',
        'Refer to Press Information Bureau (PIB Fact Check) or the nodal ministry for authentic alerts.',
      ],
    },
    INSUFFICIENT_EVIDENCE: {
      verdict: 'INSUFFICIENT_EVIDENCE',
      label: 'Insufficient Evidence',
      statement: 'We couldn\'t verify this claim with the available evidence.',
      badgeClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      pillClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      borderClass: 'border-[#D0D5DD]',
      dotColor: '#667085',
      shortMeaning:
        'We could not find sufficient authoritative government gazettes or notifications to confirm or refute this claim. This does not mean the claim is false, but reliable official proof is currently unavailable.',
      nextStepsAdvice: [
        'Try searching with the specific department or ministry name if known.',
        'Check whether the announcement is local, municipal, or yet to be notified formally in the Gazette.',
        'Submit a more specific claim with exact scheme names, dates, or states.',
      ],
    },
  },
  hi: {
    SUPPORTED: {
      verdict: 'SUPPORTED',
      label: 'प्रमाणित / सत्य',
      statement: 'उपलब्ध आधिकारिक साक्ष्य इस दावे का समर्थन करते हैं।',
      badgeClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      pillClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      borderClass: 'border-[#C6F5D5]',
      dotColor: '#12B76A',
      shortMeaning:
        'सरकारी राजपत्र एवं अधिसूचनाएं इस दावे के प्रमुख तथ्यों की पुष्टि करती हैं। योजना का लाभ पात्रता मानदंडों पर निर्भर करता है।',
      nextStepsAdvice: [
        'व्यक्तिगत पात्रता जांचने या आवेदन करने के लिए नीचे दिए गए आधिकारिक पोर्टल लिंक पर जाएं।',
        'आवेदन एवं भुगतानों के लिए केवल आधिकारिक सरकारी पोर्टल (.gov.in अथवा .nic.in) का ही उपयोग करें।',
        'नागरिकों को जागरूक रखने के लिए यह सत्यापित तथ्य साझा करें।',
      ],
    },
    PARTIALLY_SUPPORTED: {
      verdict: 'PARTIALLY_SUPPORTED',
      label: 'आंशिक सत्य / सशर्त',
      statement: 'कुछ अंश सही हैं, किन्तु महत्वपूर्ण शर्तें लागू होती हैं।',
      badgeClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      pillClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      borderClass: 'border-[#FEDF89]',
      dotColor: '#F79009',
      shortMeaning:
        'दावे के कुछ अंश सरकारी कार्यक्रमों से मेल खाते हैं, लेकिन पात्रता सीमाएं और शर्तें मौजूद हैं।',
      nextStepsAdvice: [
        'विस्तृत विश्लेषण पढ़कर जानें कि कौन से बिंदु सही हैं और कौन से नहीं।',
        'वित्तीय अथवा प्रशासनिक निर्णय लेने से पूर्व संबंधित मंत्रालय के दिशानिर्देश देखें।',
        'किसी विशिष्ट शर्त की पुष्टि के लिए स्पष्ट प्रश्न दर्ज करें।',
      ],
    },
    CONTRADICTED: {
      verdict: 'CONTRADICTED',
      label: 'खंडित / भ्रामक',
      statement: 'विश्वसनीय सरकारी साक्ष्य इस दावे का खंडन करते हैं।',
      badgeClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      pillClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      borderClass: 'border-[#FECDCA]',
      dotColor: '#F04438',
      shortMeaning:
        'आधिकारिक सरकारी अभिलेख, राजपत्र अथवा प्रेस विज्ञप्तियां इस दावे का सीधे खंडन करती हैं। फर्जी दावों से सतर्क रहें।',
      nextStepsAdvice: [
        'इस भ्रामक संदेश को आगे फॉरवर्ड न करें।',
        'पंजीकरण शुल्क या गोपनीय दस्तावेज मांगने वाली गैर-सरकारी वेबसाइटों से बचें।',
        'प्रामाणिक अलर्ट के लिए पीआईबी फैक्ट चेक अथवा संबंधित मंत्रालय का संदर्भ लें।',
      ],
    },
    INSUFFICIENT_EVIDENCE: {
      verdict: 'INSUFFICIENT_EVIDENCE',
      label: 'अपर्याप्त साक्ष्य',
      statement: 'उपलब्ध आधिकारिक साक्ष्यों से इस दावे की पुष्टि नहीं हो सकी।',
      badgeClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      pillClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      borderClass: 'border-[#D0D5DD]',
      dotColor: '#667085',
      shortMeaning:
        'इस दावे की पुष्टि या खंडन करने के लिए पर्याप्त आधिकारिक राजपत्र या अधिसूचनाएं उपलब्ध नहीं हैं।',
      nextStepsAdvice: [
        'विशिष्ट विभाग अथवा मंत्रालय के नाम के साथ पुनः खोजें।',
        'जांचें कि क्या यह स्थानीय स्तर की घोषणा है जो अभी राजपत्र में अधिसूचित नहीं हुई।',
        'सटीक योजना नाम, वर्ष अथवा राज्य के साथ पुनः दावा दर्ज करें।',
      ],
    },
  },
  mr: {
    SUPPORTED: {
      verdict: 'SUPPORTED',
      label: 'प्रमाणित / सत्य',
      statement: 'उपलब्ध शासकीय पुरावे या दाव्यास पुष्टी देतात.',
      badgeClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      pillClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
      borderClass: 'border-[#C6F5D5]',
      dotColor: '#12B76A',
      shortMeaning:
        'अधिकृत सरकारी माहिती या दाव्यातील मुख्य तथ्यांचे समर्थन करते. योजनेचा लाभ मिळणे वैधानिक पात्रतेवर अवलंबून आहे.',
      nextStepsAdvice: [
        'अर्ज करण्यासाठी किंवा वैयक्तिक पात्रता तपासण्यासाठी खाली दिलेल्या अधिकृत पोर्टल लिंकचा वापर करा.',
        'अर्ज व शुल्कासाठी नेहमी अधिकृत शासकीय वेब पत्ते (.gov.in किंवा .nic.in) वापरा.',
        'इतर नागरिकांना जागरूक ठेवण्यासाठी ही पडताळणी माहिती शेअर करा.',
      ],
    },
    PARTIALLY_SUPPORTED: {
      verdict: 'PARTIALLY_SUPPORTED',
      label: 'अंशतः सत्य / सशर्त',
      statement: 'काही भाग अचूक आहेत, परंतु महत्त्वाच्या अटी लागू आहेत.',
      badgeClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      pillClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
      borderClass: 'border-[#FEDF89]',
      dotColor: '#F79009',
      shortMeaning:
        'या विधानातील काही भाग सरकारी योजनांशी जुळतात, परंतु महत्त्वाच्या अटी आणि मर्यादा लागू आहेत.',
      nextStepsAdvice: [
        'कोणते मुद्दे प्रमाणित आहेत आणि कोणते नाहीत हे पाहण्यासाठी तपशीलवार विश्लेषण वाचा.',
        'आर्थिक किंवा प्रशासकीय निर्णय घेण्यापूर्वी संबंधित मंत्रालयाच्या मार्गदर्शक तत्त्वांचा सल्ला घ्या.',
        'विशिष्ट अटीच्या पडताळणीसाठी स्पष्ट प्रश्न नोंदवा.',
      ],
    },
    CONTRADICTED: {
      verdict: 'CONTRADICTED',
      label: 'खंडित / असत्य',
      statement: 'विश्वसनीय शासकीय पुरावे या दाव्याचे थेट खंडन करतात.',
      badgeClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      pillClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
      borderClass: 'border-[#FECDCA]',
      dotColor: '#F04438',
      shortMeaning:
        'अधिकृत सरकारी नोंदी, राजपत्रे किंवा खुलासे या विधानाचा स्पष्टपणे विरोध करतात. खोट्या दाव्यांपासून सावध रहा.',
      nextStepsAdvice: [
        'हा संदेश पुढे पाठवू नका किंवा त्यावर विश्वास ठेवू नका.',
        'नोंदणी शुल्क किंवा वैयक्तिक कागदपत्रे मागणार्‍या अनधिकृत संकेतस्थळांपासून सावध रहा.',
        'अधिकृत माहितीसाठी पीआयबी फॅक्ट चेक किंवा संबंधित विभागाचा संदर्भ घ्या.',
      ],
    },
    INSUFFICIENT_EVIDENCE: {
      verdict: 'INSUFFICIENT_EVIDENCE',
      label: 'अपुरा पुरावा',
      statement: 'उपलब्ध पुराव्यांच्या आधारे या दाव्याची पडताळणी होऊ शकली नाही.',
      badgeClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      pillClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
      borderClass: 'border-[#D0D5DD]',
      dotColor: '#667085',
      shortMeaning:
        'या दाव्याची पुष्टी करण्यासाठी किंवा खंडन करण्यासाठी पुरेसे अधिकृत सरकारी राजपत्र अथवा अधिसूचना उपलब्ध नाहीत.',
      nextStepsAdvice: [
        'विशिष्ट विभाग किंवा मंत्रालयाच्या नावाने पुन्हा शोधा.',
        'घोषणा स्थानिक स्तरावर आहे की अद्याप राजपत्रात अधिसूचित झालेली नाही ते तपासा.',
        'अचूक योजनेचे नाव व वर्ष नमूद करून अधिक स्पष्ट दावा प्रविष्ट करा.',
      ],
    },
  },
};

export const CITIZEN_VERDICTS: Record<CanonicalVerdict, CitizenVerdictConfig> =
  CITIZEN_VERDICTS_MULTILINGUAL.en;

/**
 * Returns citizen-friendly config for any verdict string, with multilingual support and safe fallback.
 */
export function getCitizenVerdict(
  verdictStr?: string | null,
  lang: SupportedLanguage = 'en'
): CitizenVerdictConfig {
  const selectedLang = CITIZEN_VERDICTS_MULTILINGUAL[lang] ? lang : 'en';
  const dict = CITIZEN_VERDICTS_MULTILINGUAL[selectedLang];

  if (!verdictStr) {
    return dict.INSUFFICIENT_EVIDENCE;
  }
  const normalized = verdictStr.toUpperCase() as CanonicalVerdict;
  return dict[normalized] || dict.INSUFFICIENT_EVIDENCE;
}

/**
 * Formats a plain-language explanation removing technical implementation jargon.
 */
export function cleanCitizenExplanation(rawText?: string | null): string {
  if (!rawText || typeof rawText !== 'string') {
    return 'Official verification completed. Please review the detailed evidence excerpts below.';
  }

  let cleaned = rawText
    .replace(/atomic propositions?/gi, 'specific points')
    .replace(/decomposed subclaims?/gi, 'parts of the claim')
    .replace(/semantic decomposition/gi, 'claim breakdown')
    .replace(/grounding pipeline/gi, 'source discovery')
    .replace(/google search grounding/gi, 'official government web search')
    .replace(/tavily search grounding/gi, 'authoritative government web search')
    .replace(/retrieved chunks?/gi, 'retrieved documents')
    .replace(/corpus/gi, 'collection')
    .replace(/provenance metadata/gi, 'source records');

  return cleaned.trim();
}

/**
 * Classifies an evidence source into citizen-friendly trust tiers with multilingual support.
 */
export function getCitizenSourceTrustBadge(
  domain: string,
  sourceType?: string,
  lang: SupportedLanguage = 'en'
): {
  label: string;
  isOfficial: boolean;
  pillClass: string;
  dotColor: string;
} {
  const d = domain.toLowerCase();

  const labels = {
    govPortal: {
      en: 'Official Government Portal',
      hi: 'आधिकारिक सरकारी पोर्टल',
      mr: 'अधिकृत शासकीय पोर्टल',
    },
    apexStatutory: {
      en: 'Apex Statutory Institution',
      hi: 'सर्वोच्च वैधानिक संस्था',
      mr: 'सर्वोच्च वैधानिक संस्था',
    },
    publicInfo: {
      en: 'Official Public Information Service',
      hi: 'आधिकारिक लोक सूचना सेवा',
      mr: 'अधिकृत सार्वजनिक माहिती सेवा',
    },
    educational: {
      en: 'Recognized Public University / Academic Body',
      hi: 'मान्यता प्राप्त विश्वविद्यालय / शैक्षणिक निकाय',
      mr: 'मान्यताप्राप्त विद्यापीठ / शैक्षणिक संस्था',
    },
    verifiedOrg: {
      en: 'Verified Public Organization',
      hi: 'सत्यापित सार्वजनिक संगठन',
      mr: 'सत्यापित सार्वजनिक संस्था',
    },
    unverifiedExternal: {
      en: 'External / Unverified Third-Party Domain',
      hi: 'बाह्य / असत्यापित तृतीय-पक्ष डोमेन',
      mr: 'बाह्य / असत्यापित तृतीय-पक्ष डोमेन',
    },
  };

  const currentLang: SupportedLanguage = lang === 'hi' || lang === 'mr' ? lang : 'en';

  if (d.endsWith('.gov.in') || d.endsWith('.nic.in') || d === 'india.gov.in' || d === 'mygov.in') {
    return {
      label: labels.govPortal[currentLang],
      isOfficial: true,
      pillClass: 'bg-[#ECFDF3] text-[#027A48] border-[#D1FADF]',
      dotColor: '#12B76A',
    };
  }

  if (
    d.endsWith('rbi.org.in') ||
    d.endsWith('sebi.gov.in') ||
    d.endsWith('sci.gov.in') ||
    d.endsWith('nta.ac.in') ||
    d.endsWith('ugc.ac.in')
  ) {
    return {
      label: labels.apexStatutory[currentLang],
      isOfficial: true,
      pillClass: 'bg-[#EAF1FF] text-[#2457C5] border-[#D1E9FF]',
      dotColor: '#2457C5',
    };
  }

  if (d.includes('ddnews') || d.includes('newsonair') || d.includes('pib')) {
    return {
      label: labels.publicInfo[currentLang],
      isOfficial: true,
      pillClass: 'bg-[#ECFDF3] text-[#027A48] border-[#D1FADF]',
      dotColor: '#12B76A',
    };
  }

  if (d.endsWith('.ac.in') || d.endsWith('.edu.in')) {
    return {
      label: labels.educational[currentLang],
      isOfficial: true,
      pillClass: 'bg-[#EAF1FF] text-[#2457C5] border-[#D1E9FF]',
      dotColor: '#2457C5',
    };
  }

  if (d.endsWith('.org.in') || d.endsWith('.res.in')) {
    return {
      label: labels.verifiedOrg[currentLang],
      isOfficial: false,
      pillClass: 'bg-[#F8F9FC] text-[#344054] border-[#EAECF0]',
      dotColor: '#667085',
    };
  }

  return {
    label: labels.unverifiedExternal[currentLang],
    isOfficial: false,
    pillClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
    dotColor: '#F04438',
  };
}
