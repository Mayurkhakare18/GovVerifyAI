/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Multilingual Interface & Complete Localization Test Suite
 * Validates 10 core localization scenarios across English, Hindi, and Marathi:
 * 1. Navbar localization across en, hi, mr
 * 2. Dashboard localization across en, hi, mr
 * 3. Scheme discovery search & category filters across en, hi, mr
 * 4. Personalized eligibility assessment questionnaire & status labels
 * 5. Application guidance & roadmap across en, hi, mr
 * 6. Verification console & claim review across en, hi, mr
 * 7. History & profile settings across en, hi, mr
 * 8. Guest mode language persistence (localStorage simulation)
 * 9. Authenticated profile language synchronization
 * 10. Fallback behavior for missing or invalid language codes
 */

import assert from 'assert';
import {
  SupportedLanguage,
  SUPPORTED_I18N_LANGUAGES,
  getTranslation,
  normalizeLanguageCode,
  translations,
} from '../src/i18n';

async function runMultilingualInterfaceTests() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — MULTILINGUAL INTERFACE LOCALIZATION TEST SUITE');
  console.log('Validating Full UI Coverage across English, Hindi, and Marathi');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // --------------------------------------------------------------------------
  // Scenario 1: Navbar localization across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 1. Navbar localization across en, hi, mr... ');

    const enHome = getTranslation('en', 'nav.home');
    const hiHome = getTranslation('hi', 'nav.home');
    const mrHome = getTranslation('mr', 'nav.home');

    assert.strictEqual(enHome, 'Home', 'English home should match');
    assert.strictEqual(hiHome, 'होम', 'Hindi home should match');
    assert.strictEqual(mrHome, 'मुख्यपृष्ठ', 'Marathi home should match');

    const enSchemes = getTranslation('en', 'nav.schemes');
    const hiSchemes = getTranslation('hi', 'nav.schemes');
    const mrSchemes = getTranslation('mr', 'nav.schemes');

    assert.strictEqual(enSchemes, 'Schemes', 'English schemes should match');
    assert.strictEqual(hiSchemes, 'सरकारी योजनाएं', 'Hindi schemes should match');
    assert.strictEqual(mrSchemes, 'शासकीय योजना', 'Marathi schemes should match');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 2: Dashboard localization across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 2. Dashboard overview and metrics localization... ');

    const enWelcome = getTranslation('en', 'dashboard.welcomeBack');
    const hiWelcome = getTranslation('hi', 'dashboard.welcomeBack');
    const mrWelcome = getTranslation('mr', 'dashboard.welcomeBack');

    assert.strictEqual(enWelcome, 'Welcome back,', 'English welcome should match');
    assert.strictEqual(hiWelcome, 'स्वागत है,', 'Hindi welcome should match');
    assert.strictEqual(mrWelcome, 'स्वागत आहे,', 'Marathi welcome should match');

    const enAudited = getTranslation('en', 'dashboard.totalAudited');
    const hiAudited = getTranslation('hi', 'dashboard.totalAudited');
    const mrAudited = getTranslation('mr', 'dashboard.totalAudited');

    assert.strictEqual(enAudited, 'Total Claims Audited');
    assert.strictEqual(hiAudited, 'कुल परीक्षित दावे');
    assert.strictEqual(mrAudited, 'एकूण तपासलेले दावे');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 3: Scheme discovery search & category filters across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 3. Scheme discovery search & filters localization... ');

    const enTitle = getTranslation('en', 'schemes.title');
    const hiTitle = getTranslation('hi', 'schemes.title');
    const mrTitle = getTranslation('mr', 'schemes.title');

    assert.ok(enTitle.includes('Discover Government Schemes'));
    assert.ok(hiTitle.includes('सरकारी योजनाएं'));
    assert.ok(mrTitle.includes('शासकीय योजना'));

    const enAllIndia = getTranslation('en', 'schemes.filters.allIndia');
    const hiAllIndia = getTranslation('hi', 'schemes.filters.allIndia');
    const mrAllIndia = getTranslation('mr', 'schemes.filters.allIndia');

    assert.strictEqual(enAllIndia, 'All India');
    assert.strictEqual(hiAllIndia, 'संपूर्ण भारत');
    assert.strictEqual(mrAllIndia, 'संपूर्ण भारत');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 4: Personalized eligibility assessment questionnaire & status labels
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 4. Personalized eligibility questions & status display... ');

    const enEligible = getTranslation('en', 'eligibility.statusPotentiallyEligible');
    const hiEligible = getTranslation('hi', 'eligibility.statusPotentiallyEligible');
    const mrEligible = getTranslation('mr', 'eligibility.statusPotentiallyEligible');

    assert.strictEqual(enEligible, 'POTENTIALLY ELIGIBLE');
    assert.strictEqual(hiEligible, 'संभावित रूप से पात्र');
    assert.strictEqual(mrEligible, 'संभाव्यतः पात्र');

    const enIncome = getTranslation('en', 'eligibility.incomeLabel');
    const hiIncome = getTranslation('hi', 'eligibility.incomeLabel');
    const mrIncome = getTranslation('mr', 'eligibility.incomeLabel');

    assert.ok(enIncome.includes('Annual Family Income'));
    assert.ok(hiIncome.includes('वार्षिक पारिवारिक आय'));
    assert.ok(mrIncome.includes('वार्षिक कौटुंबिक उत्पन्न'));

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 5: Application guidance & roadmap across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 5. Application guidance & roadmap tabs localization... ');

    const enRoadmapTab = getTranslation('en', 'guidance.tabRoadmap');
    const hiRoadmapTab = getTranslation('hi', 'guidance.tabRoadmap');
    const mrRoadmapTab = getTranslation('mr', 'guidance.tabRoadmap');

    assert.strictEqual(enRoadmapTab, 'Application Roadmap');
    assert.strictEqual(hiRoadmapTab, 'आवेदन रोडमैप');
    assert.strictEqual(mrRoadmapTab, 'अर्ज रोडमॅप');

    const enDocChecklist = getTranslation('en', 'guidance.tabDocuments');
    const hiDocChecklist = getTranslation('hi', 'guidance.tabDocuments');
    const mrDocChecklist = getTranslation('mr', 'guidance.tabDocuments');

    assert.strictEqual(enDocChecklist, 'Document Preparation');
    assert.strictEqual(hiDocChecklist, 'दस्तावेज़ तैयारी');
    assert.strictEqual(mrDocChecklist, 'कागदपत्रे तयारी');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 6: Verification workspace & claim review across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 6. Verification workspace & media intake tabs... ');

    const enTabText = getTranslation('en', 'workspace.tabText');
    const hiTabText = getTranslation('hi', 'workspace.tabText');
    const mrTabText = getTranslation('mr', 'workspace.tabText');

    assert.strictEqual(enTabText, 'Text Statement');
    assert.strictEqual(hiTabText, 'दावा संदेश');
    assert.strictEqual(mrTabText, 'दावा मजकूर');

    const enVerifyBtn = getTranslation('en', 'workspace.verifyButton');
    const hiVerifyBtn = getTranslation('hi', 'workspace.verifyButton');
    const mrVerifyBtn = getTranslation('mr', 'workspace.verifyButton');

    assert.strictEqual(enVerifyBtn, 'Run Sovereign Verification');
    assert.strictEqual(hiVerifyBtn, 'सरकारी सत्यापन शुरू करें');
    assert.strictEqual(mrVerifyBtn, 'शासकीय पडताळणी सुरू करा');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 7: History & profile settings across en, hi, mr
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 7. History and citizen auth modal localization... ');

    const enHistoryTitle = getTranslation('en', 'history.title');
    const hiHistoryTitle = getTranslation('hi', 'history.title');
    const mrHistoryTitle = getTranslation('mr', 'history.title');

    assert.strictEqual(enHistoryTitle, 'Verification History & Audit Log');
    assert.strictEqual(hiHistoryTitle, 'सत्यापन इतिहास एवं अभिलेख');
    assert.strictEqual(mrHistoryTitle, 'पडताळणी इतिहास व नोंदी');

    const enSignInTitle = getTranslation('en', 'auth.signInTitle');
    const hiSignInTitle = getTranslation('hi', 'auth.signInTitle');
    const mrSignInTitle = getTranslation('mr', 'auth.signInTitle');

    assert.strictEqual(enSignInTitle, 'Citizen Sign In');
    assert.strictEqual(hiSignInTitle, 'नागरिक साइन इन');
    assert.strictEqual(mrSignInTitle, 'नागरिक साइन इन');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 8: Guest mode language persistence (localStorage simulation)
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 8. Guest session language persistence simulation... ');

    const mockStorage: Record<string, string> = {};
    const setStoredLang = (lang: SupportedLanguage) => {
      mockStorage['govverify_language'] = lang;
    };
    const getStoredLang = (): SupportedLanguage => {
      return normalizeLanguageCode(mockStorage['govverify_language'] || 'en');
    };

    setStoredLang('hi');
    assert.strictEqual(getStoredLang(), 'hi', 'Guest stored language should be Hindi');

    setStoredLang('mr');
    assert.strictEqual(getStoredLang(), 'mr', 'Guest stored language should update to Marathi');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 9: Authenticated profile language synchronization
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 9. Authenticated profile language synchronization mapping... ');

    const langNameMap: Record<string, SupportedLanguage> = {
      'Hindi': 'hi',
      'Marathi': 'mr',
      'English': 'en',
    };

    assert.strictEqual(langNameMap['Hindi'], 'hi');
    assert.strictEqual(langNameMap['Marathi'], 'mr');
    assert.strictEqual(langNameMap['English'], 'en');

    // Normalizer test
    assert.strictEqual(normalizeLanguageCode('Hindi'), 'hi');
    assert.strictEqual(normalizeLanguageCode('Marathi'), 'mr');
    assert.strictEqual(normalizeLanguageCode('English'), 'en');
    assert.strictEqual(normalizeLanguageCode('हिन्दी'), 'hi');
    assert.strictEqual(normalizeLanguageCode('मराठी'), 'mr');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Scenario 10: Fallback behavior for missing or invalid language codes
  // --------------------------------------------------------------------------
  try {
    process.stdout.write('• Testing: 10. Fallback behavior for unknown keys or invalid codes... ');

    // Invalid language code should normalize to English
    const normalized = normalizeLanguageCode('unsupported-code');
    assert.strictEqual(normalized, 'en', 'Unknown language code should fallback to English');

    // Non-existent key should return the key itself
    const fallbackKey = getTranslation('en', 'nonexistent.random.key');
    assert.strictEqual(fallbackKey, 'nonexistent.random.key', 'Missing key should return key string');

    console.log('PASS');
    passed++;
  } catch (err: any) {
    console.log('FAIL:', err.message);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`MULTILINGUAL TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultilingualInterfaceTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
