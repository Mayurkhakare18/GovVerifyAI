/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Historical Verification Request Recovery Script
 * 
 * Purpose:
 * Audits, classifies, and executes controlled recovery of historical stranded
 * PROCESSING verification requests using strict sovereign evidence provenance rules.
 * 
 * Safety Rules:
 * - Default mode is read-only dry run (--dry-run).
 * - --execute is strictly restricted to Category 1 (--category=1).
 * - Excluded requests (Categories 2, 3, 4) are strictly skipped and untouched.
 * - Idempotency and overwrite protection are preserved.
 * - Never fabricates verdicts or citations.
 */

import dotenv from 'dotenv';
dotenv.config();

import { getServerSupabase } from '../src/server/supabase.js';
import {
  filterVerifiedEvidence,
  analyzeAndPersistVerdictForRequest,
} from '../src/server/services/verdictAnalysis.js';

export type RecoveryCategory =
  | 'CATEGORY_1_ELIGIBLE'
  | 'CATEGORY_2_REDISCOVERY_NEEDED'
  | 'CATEGORY_3_INADEQUATE_PROVENANCE'
  | 'CATEGORY_4_INELIGIBLE';

export interface RequestClassification {
  requestId: string;
  shortId: string;
  inputType: string;
  claimsCount: number;
  totalEvidenceCount: number;
  verifiedEvidenceCount: number;
  hasExistingResult: boolean;
  existingVerdict?: string;
  category: RecoveryCategory;
  categoryLabel: string;
  skipReason?: string;
  proposedAction: string;
}

export interface RecoveryExecutionSummary {
  attempted: number;
  completed: number;
  failed: number;
  verdicts: Record<string, number>;
  details: Array<{
    shortId: string;
    verdict?: string;
    confidence?: number;
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
    error?: string;
  }>;
}

export interface DryRunSummary {
  totalScanned: number;
  category1Eligible: number;
  category2Rediscovery: number;
  category3Inadequate: number;
  category4Ineligible: number;
  recordsModified: number;
  mode: 'DRY_RUN' | 'EXECUTE';
  executedAt: string;
  items: RequestClassification[];
  executionResults?: RecoveryExecutionSummary;
}

export interface RecoveryOptions {
  dryRun?: boolean;
  category?: number;
  execute?: boolean;
  silent?: boolean;
}

/**
 * Evaluates a single verification request against strict sovereign provenance rules.
 * Pure analysis function — performs zero database mutations.
 */
export function classifyRequest(request: any): RequestClassification {
  const shortId = request.id ? `${request.id.slice(0, 8)}...` : 'unknown';
  const inputType = request.input_type || 'UNKNOWN';
  const claims = Array.isArray(request.claims) ? request.claims : [];
  const rawEvidence = Array.isArray(request.evidence) ? request.evidence : [];
  const results = Array.isArray(request.verification_results) ? request.verification_results : [];

  const claimsCount = claims.length;
  const totalEvidenceCount = rawEvidence.length;
  const hasExistingResult = results.length > 0;
  const existingVerdict = hasExistingResult ? results[0].verdict : undefined;

  // Strict Provenance: Reuse filterVerifiedEvidence from verdictAnalysis service
  const verifiedEvidence = filterVerifiedEvidence(rawEvidence);
  const verifiedEvidenceCount = verifiedEvidence.length;

  // RULE 1: Already has a result or not in PROCESSING status
  if (hasExistingResult || request.status === 'COMPLETED') {
    return {
      requestId: request.id,
      shortId,
      inputType,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasExistingResult,
      existingVerdict,
      category: 'CATEGORY_4_INELIGIBLE',
      categoryLabel: 'Category 4 (Ineligible / Has Result)',
      skipReason: hasExistingResult
        ? `Existing validated result (${existingVerdict}) must be preserved`
        : 'Request is already in COMPLETED status',
      proposedAction: '[SKIP] Preserve existing result; do not overwrite',
    };
  }

  if (request.status !== 'PROCESSING') {
    return {
      requestId: request.id,
      shortId,
      inputType,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasExistingResult,
      category: 'CATEGORY_4_INELIGIBLE',
      categoryLabel: 'Category 4 (Ineligible)',
      skipReason: `Status is ${request.status} (only PROCESSING requests are eligible for recovery)`,
      proposedAction: `[SKIP] Status is ${request.status}`,
    };
  }

  // RULE 2: Missing claims or broken relationship
  if (claimsCount === 0) {
    return {
      requestId: request.id,
      shortId,
      inputType,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasExistingResult,
      category: 'CATEGORY_4_INELIGIBLE',
      categoryLabel: 'Category 4 (Ineligible / Broken Relationship)',
      skipReason: 'Request has 0 associated claims; cannot evaluate verdict on headless request',
      proposedAction: '[SKIP] Broken claim relationship; investigate manually',
    };
  }

  // RULE 3: Zero evidence attached (Discovery never finished or was interrupted)
  if (totalEvidenceCount === 0) {
    return {
      requestId: request.id,
      shortId,
      inputType,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasExistingResult,
      category: 'CATEGORY_2_REDISCOVERY_NEEDED',
      categoryLabel: 'Category 2 (Requires Rediscovery)',
      skipReason: 'Zero evidence records attached; discovery never completed or failed',
      proposedAction: '[SKIP] Must retry source discovery when search provider is available',
    };
  }

  // RULE 4: Evidence present, but fails strict sovereign provenance validation
  if (verifiedEvidenceCount === 0) {
    const nonGroundedTypes = Array.from(
      new Set(rawEvidence.map((e: any) => e.sources?.source_type).filter(Boolean))
    );
    return {
      requestId: request.id,
      shortId,
      inputType,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasExistingResult,
      category: 'CATEGORY_3_INADEQUATE_PROVENANCE',
      categoryLabel: 'Category 3 (Inadequate Provenance)',
      skipReason: `All ${totalEvidenceCount} evidence records fail GROUNDED_SEARCH provenance check (types: ${nonGroundedTypes.join(', ') || 'unverified'})`,
      proposedAction: '[SKIP] Evidence inadequate; cannot fabricate verdict without sovereign sources',
    };
  }

  // RULE 5: Category 1 - Safe to re-evaluate using verified evidence
  return {
    requestId: request.id,
    shortId,
    inputType,
    claimsCount,
    totalEvidenceCount,
    verifiedEvidenceCount,
    hasExistingResult,
    category: 'CATEGORY_1_ELIGIBLE',
    categoryLabel: 'Category 1 (Eligible for Re-evaluation)',
    proposedAction: `[RECOVER] Would synthesize verdict from ${verifiedEvidenceCount} verified citations & mark COMPLETED`,
  };
}

/**
 * Main recovery runner. Default is read-only dry run.
 * Executes writes ONLY when options.execute === true AND options.category === 1.
 */
export async function runRecoveryDryRun(options: RecoveryOptions = {}): Promise<DryRunSummary> {
  const isExecute = Boolean(options.execute);
  const targetCategory = options.category;
  const isSilent = Boolean(options.silent);

  // Safety Requirement 7: --execute can process ONLY Category 1
  if (isExecute && targetCategory !== 1) {
    throw new Error(
      'Safety Guard: Write execution (--execute) is strictly restricted to Category 1 (--category=1). No other categories can be recovered.'
    );
  }

  const supabase = getServerSupabase();

  // Fetch all requests in PROCESSING status with related claims, evidence, sources, and results
  const { data: requests, error } = await supabase
    .from('verification_requests')
    .select('*, claims(*), evidence(*, sources(*)), verification_results(*)')
    .eq('status', 'PROCESSING')
    .order('created_at', { ascending: false });

  if (error || !requests) {
    throw new Error(`Failed to query verification requests: ${error?.message || 'Unknown database error'}`);
  }

  const allClassifications: RequestClassification[] = requests.map(classifyRequest);
  const cat1Items = allClassifications.filter((item) => item.category === 'CATEGORY_1_ELIGIBLE');

  // Pre-execution count validation: expect exactly 24 currently pending Category 1 requests
  if (isExecute) {
    if (cat1Items.length !== 24) {
      throw new Error(
        `Safety Guard: Expected exactly 24 currently pending Category 1 requests for controlled recovery, found ${cat1Items.length}. Aborting.`
      );
    }

    // Independently verify that request 63689895... has already been recovered successfully, is COMPLETED, and has its persisted SUPPORTED result
    const { data: recoveredCheck, error: recErr } = await supabase
      .from('verification_requests')
      .select('id, status, verification_results(verdict, confidence)')
      .eq('id', '63689895-3a9f-4d8f-ba56-744c9e443ad7')
      .single();

    if (recErr || !recoveredCheck) {
      throw new Error(
        `Accounting Invariant Violation: Failed to verify previously recovered request 63689895...: ${recErr?.message || 'Record not found'}. Aborting.`
      );
    }

    const recResult = Array.isArray(recoveredCheck.verification_results)
      ? recoveredCheck.verification_results[0]
      : recoveredCheck.verification_results;

    if (recoveredCheck.status !== 'COMPLETED' || recResult?.verdict !== 'SUPPORTED') {
      throw new Error(
        `Accounting Invariant Violation: Request 63689895... status is '${recoveredCheck.status}' (expected COMPLETED) with verdict '${recResult?.verdict}' (expected SUPPORTED). Aborting.`
      );
    }

    // Accounting invariant established: 24 pending candidates + 1 previously recovered candidate = 25 originally eligible requests
    if (!isSilent) {
      console.log(
        'Accounting Invariant Verified: 24 pending candidates + 1 previously recovered candidate (63689895...) = 25 originally eligible Category 1 requests.\n'
      );
    }
  }

  // Filter if specific category requested (e.g. --category=1)
  let filteredItems = allClassifications;
  if (targetCategory === 1) {
    filteredItems = cat1Items;
  } else if (targetCategory === 2) {
    filteredItems = allClassifications.filter((item) => item.category === 'CATEGORY_2_REDISCOVERY_NEEDED');
  } else if (targetCategory === 3) {
    filteredItems = allClassifications.filter((item) => item.category === 'CATEGORY_3_INADEQUATE_PROVENANCE');
  } else if (targetCategory === 4) {
    filteredItems = allClassifications.filter((item) => item.category === 'CATEGORY_4_INELIGIBLE');
  }

  const summary: DryRunSummary = {
    totalScanned: allClassifications.length,
    category1Eligible: cat1Items.length,
    category2Rediscovery: allClassifications.filter((i) => i.category === 'CATEGORY_2_REDISCOVERY_NEEDED').length,
    category3Inadequate: allClassifications.filter((i) => i.category === 'CATEGORY_3_INADEQUATE_PROVENANCE').length,
    category4Ineligible: allClassifications.filter((i) => i.category === 'CATEGORY_4_INELIGIBLE').length,
    recordsModified: 0,
    mode: isExecute ? 'EXECUTE' : 'DRY_RUN',
    executedAt: new Date().toISOString(),
    items: filteredItems,
  };

  if (!isSilent) {
    console.log('================================================================');
    console.log(
      isExecute
        ? 'GOVVERIFY AI — CONTROLLED RECOVERY EXECUTION (CATEGORY 1 ONLY)'
        : 'GOVVERIFY AI — STRANDED REQUEST RECOVERY TOOL (DRY RUN)'
    );
    console.log(`Execution Mode: ${isExecute ? 'LIVE RECOVERY EXECUTION' : 'READ-ONLY DRY RUN'}`);
    console.log(`Executed At:    ${summary.executedAt}`);
    if (targetCategory) {
      console.log(`Filter:         Category ${targetCategory} only`);
    }
    console.log('================================================================\n');

    console.log(`Audited ${summary.totalScanned} requests currently in PROCESSING status:\n`);

    // Output classification table
    const tableRows = filteredItems.map((item) => ({
      'Request ID': item.shortId,
      Type: item.inputType,
      Claims: item.claimsCount,
      'Total Ev': item.totalEvidenceCount,
      'Verified Ev': item.verifiedEvidenceCount,
      Result: item.existingVerdict || 'None',
      Category: item.category.replace('CATEGORY_', 'Cat '),
      'Action': item.proposedAction,
    }));

    console.table(tableRows);

    console.log('\n--- CATEGORY BREAKDOWN ---');
    console.log(`• Category 1 (Eligible for re-evaluation):       ${summary.category1Eligible} requests`);
    console.log(`• Category 2 (Requires source rediscovery):      ${summary.category2Rediscovery} requests`);
    console.log(`• Category 3 (Inadequate evidence provenance):   ${summary.category3Inadequate} requests`);
    console.log(`• Category 4 (Already completed / ineligible):   ${summary.category4Ineligible} requests`);
    console.log(`• Total PROCESSING requests audited:             ${summary.totalScanned} requests\n`);

    console.log('--- EXCLUDED REQUESTS SKIP AUDIT ---');
    const skippedItems = allClassifications.filter((i) => i.category !== 'CATEGORY_1_ELIGIBLE');
    if (skippedItems.length === 0) {
      console.log('No requests excluded.');
    } else {
      for (const item of skippedItems) {
        console.log(`  [${item.category}] ${item.shortId} (${item.inputType}): ${item.skipReason}`);
      }
    }
  }

  // ==========================================================================
  // LIVE RECOVERY EXECUTION (Strictly Category 1, only if --execute is passed)
  // ==========================================================================
  if (isExecute) {
    if (!isSilent) {
      console.log('\n----------------------------------------------------------------');
      console.log(`EXECUTING CONTROLLED RECOVERY OF ${cat1Items.length} CATEGORY 1 REQUESTS`);
      console.log('----------------------------------------------------------------\n');
    }

    const executionStats: RecoveryExecutionSummary = {
      attempted: 0,
      completed: 0,
      failed: 0,
      verdicts: {},
      details: [],
    };

    for (let i = 0; i < cat1Items.length; i++) {
      const item = cat1Items[i];
      const indexStr = `[${i + 1}/${cat1Items.length}]`;
      executionStats.attempted++;

      // Strict Pre-invocation Safety Guards
      if (item.hasExistingResult) {
        if (!isSilent) {
          console.warn(`  ${indexStr} ${item.shortId}: SKIPPED (Existing result detected)`);
        }
        executionStats.details.push({
          shortId: item.shortId,
          status: 'SKIPPED',
          error: 'Existing result detected',
        });
        continue;
      }

      if (item.verifiedEvidenceCount < 1) {
        if (!isSilent) {
          console.warn(`  ${indexStr} ${item.shortId}: SKIPPED (No verified evidence)`);
        }
        executionStats.details.push({
          shortId: item.shortId,
          status: 'SKIPPED',
          error: 'No verified evidence',
        });
        continue;
      }

      try {
        // Execute analysis & persistence pipeline via verdictAnalysis service
        const recoveryResult = await analyzeAndPersistVerdictForRequest(item.requestId);

        if (recoveryResult.success && recoveryResult.status === 'COMPLETED') {
          const verdict = recoveryResult.analysis.verdict;
          const confidence = recoveryResult.analysis.confidence;

          executionStats.completed++;
          executionStats.verdicts[verdict] = (executionStats.verdicts[verdict] || 0) + 1;
          summary.recordsModified++;

          if (!isSilent) {
            console.log(
              `  ${indexStr} ${item.shortId}: COMPLETED -> Verdict: ${verdict} (${confidence}% confidence)`
            );
          }

          executionStats.details.push({
            shortId: item.shortId,
            verdict,
            confidence,
            status: 'COMPLETED',
          });
        } else {
          executionStats.failed++;
          if (!isSilent) {
            console.error(`  ${indexStr} ${item.shortId}: FAILED -> Pipeline did not complete`);
          }
          executionStats.details.push({
            shortId: item.shortId,
            status: 'FAILED',
            error: 'Pipeline did not complete',
          });
        }
      } catch (reqErr: any) {
        executionStats.failed++;
        if (!isSilent) {
          console.error(`  ${indexStr} ${item.shortId}: ERROR -> ${reqErr.message}`);
        }
        executionStats.details.push({
          shortId: item.shortId,
          status: 'FAILED',
          error: reqErr.message,
        });
      }
    }

    summary.executionResults = executionStats;

    if (!isSilent) {
      console.log('\n================================================================');
      console.log('RECOVERY EXECUTION COMPLETE');
      console.log(`• Attempted:     ${executionStats.attempted}`);
      console.log(`• Completed:     ${executionStats.completed}`);
      console.log(`• Failed:        ${executionStats.failed}`);
      console.log('• Verdict Distribution:');
      for (const [v, c] of Object.entries(executionStats.verdicts)) {
        console.log(`    - ${v}: ${c}`);
      }
      console.log('================================================================\n');
    }
  } else {
    if (!isSilent) {
      console.log('\n----------------------------------------------------------------');
      console.log(`ZERO DATABASE WRITES: ${summary.recordsModified} records modified.`);
      console.log(`Eligible for safe re-evaluation: ${summary.category1Eligible} requests.`);
      console.log('----------------------------------------------------------------\n');
    }
  }

  return summary;
}

// CLI Execution Support
const isDirectRun =
  process.argv[1]?.endsWith('recover_stranded_requests.ts') ||
  process.argv[1]?.endsWith('recover_stranded_requests.js');

if (isDirectRun) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const catArg = args.find((a) => a.startsWith('--category='));
  const category = catArg ? parseInt(catArg.split('=')[1], 10) : undefined;

  runRecoveryDryRun({
    dryRun: !isExecute,
    execute: isExecute,
    category,
  }).catch((err) => {
    console.error('Recovery execution failed:', err.message);
    process.exit(1);
  });
}
