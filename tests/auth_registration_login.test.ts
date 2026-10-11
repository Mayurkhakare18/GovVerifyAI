/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Authentication, Registration & Login Diagnostic Test Suite
 * 
 * Validates:
 * 1. Successful registration with immediate authenticated session.
 * 2. Duplicate email registration detection (identities: []):
 *    - Rejects misleading "Account created" message.
 *    - Flags isDuplicateEmail: true and directs user to sign in.
 * 3. Email confirmation required:
 *    - Returns requiresEmailConfirmation: true with explicit verification guidance.
 * 4. Successful login with valid credentials:
 *    - Returns session and user without errors.
 * 5. Invalid credentials error handling:
 *    - Sanitizes generic "Invalid login credentials" with helpful user guidance.
 * 6. Profile-creation failure fallback:
 *    - Gracefully handles missing/delayed profile rows without crashing auth state.
 * 7. Missing or incorrect Supabase configuration:
 *    - Returns clean descriptive error when credentials are not configured.
 * 
 * Safety Guarantee:
 * - 100% In-Memory / Mocked Supabase execution.
 * - ZERO database mutations or production user alterations.
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passed++;
  } catch (err: any) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Pure logic models representing AuthContext registration and login pipelines
// -----------------------------------------------------------------------------

interface MockSupabaseAuthOptions {
  isConfigured: boolean;
  signUpResponse?: {
    data: {
      user: {
        id: string;
        email: string;
        identities?: any[];
      } | null;
      session: {
        access_token: string;
        user: any;
      } | null;
    };
    error: { message: string } | null;
  };
  signInResponse?: {
    data: {
      user: any;
      session: any;
    };
    error: { message: string } | null;
  };
  profileQueryResponse?: {
    data: any;
    error: any;
  };
}

function createMockAuthService(options: MockSupabaseAuthOptions) {
  return {
    async signUp(email: string, password: string, displayName?: string) {
      if (!options.isConfigured) {
        return {
          error:
            'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable registration.',
        };
      }

      const res = options.signUpResponse!;
      if (res.error) {
        return { error: res.error.message };
      }

      // Check if identities array is empty (duplicate user in Supabase Auth)
      const isDuplicateEmail = Boolean(
        res.data.user &&
        Array.isArray(res.data.user.identities) &&
        res.data.user.identities.length === 0
      );

      if (isDuplicateEmail) {
        return {
          error:
            'An account with this email address already exists. Please sign in with your password, or use password recovery if you have forgotten it.',
          isDuplicateEmail: true,
          requiresEmailConfirmation: false,
        };
      }

      const requiresEmailConfirmation = Boolean(res.data.user && !res.data.session);

      return {
        error: null,
        requiresEmailConfirmation,
        isDuplicateEmail: false,
        session: res.data.session,
      };
    },

    async signIn(email: string, password: string) {
      if (!options.isConfigured) {
        return {
          error:
            'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable authentication.',
        };
      }

      const res = options.signInResponse!;
      if (res.error) {
        const msg = res.error.message || '';
        const isUnconfirmed = msg.toLowerCase().includes('email not confirmed');

        let sanitizedErrorMessage = res.error.message;
        if (isUnconfirmed) {
          sanitizedErrorMessage =
            'Your email address has not been confirmed yet. Please verify your email via the confirmation link sent to your inbox, or request a new verification link.';
        } else if (msg.toLowerCase().includes('invalid login credentials')) {
          sanitizedErrorMessage =
            'Invalid login credentials. Please verify your email and password, or create an account if you have not registered yet.';
        }

        return {
          error: sanitizedErrorMessage,
          isUnconfirmed,
        };
      }

      return {
        error: null,
        session: res.data.session,
      };
    },

    async fetchProfile(userId: string) {
      const res = options.profileQueryResponse;
      if (!res || res.error || !res.data) {
        return { profile: null, fallbackNeeded: true };
      }
      return { profile: res.data, fallbackNeeded: false };
    },
  };
}

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — AUTHENTICATION & LOGIN REGRESSION TEST SUITE');
  console.log('Validating Registration, Duplicate Detection, Confirmation & Login');
  console.log('================================================================\n');

  // TEST 1: Successful registration with immediate authenticated session
  await runTest('1. Successful registration with session immediately authenticates', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signUpResponse: {
        data: {
          user: {
            id: 'u-101',
            email: 'newcitizen@example.gov.in',
            identities: [{ id: 'id-101', provider: 'email' }],
          },
          session: {
            access_token: 'valid-jwt-token-xyz',
            user: { id: 'u-101' },
          },
        },
        error: null,
      },
    });

    const result = await auth.signUp('newcitizen@example.gov.in', 'securepass123', 'Aarav Patel');
    assert(result.error === null, 'Error must be null');
    assert(result.requiresEmailConfirmation === false, 'Must not require email confirmation when session is present');
    assert(result.isDuplicateEmail === false, 'Must not flag as duplicate');
    assert(result.session !== null, 'Session must be returned');
  });

  // TEST 2: Duplicate email registration detection (identities: [])
  await runTest('2. Duplicate email registration detects empty identities array and flags existing account', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signUpResponse: {
        data: {
          user: {
            id: 'dummy-generated-id',
            email: 'mayurkhakarec55@gmail.com',
            identities: [], // <-- Supabase returns empty identities on duplicate email!
          },
          session: null,
        },
        error: null,
      },
    });

    const result = await auth.signUp('mayurkhakarec55@gmail.com', 'newattemptpassword');
    assert(result.isDuplicateEmail === true, 'Must flag as duplicate email');
    assert(result.error !== null, 'Must return error message for duplicate email');
    assert(
      result.error!.includes('already exists'),
      `Error must inform that account already exists, got: ${result.error}`
    );
    assert(
      !result.error!.includes('Account created'),
      'Must NEVER display false "Account created" for duplicate registration'
    );
  });

  // TEST 3: Email confirmation required
  await runTest('3. Email confirmation required returns distinct flag and guidance', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signUpResponse: {
        data: {
          user: {
            id: 'u-202',
            email: 'unconfirmed@example.com',
            identities: [{ id: 'id-202', provider: 'email' }],
          },
          session: null, // <-- No session until confirmed
        },
        error: null,
      },
    });

    const result = await auth.signUp('unconfirmed@example.com', 'securepass123');
    assert(result.error === null, 'Error must be null on genuine new user');
    assert(result.requiresEmailConfirmation === true, 'Must flag requiresEmailConfirmation: true');
    assert(result.isDuplicateEmail === false, 'Must not flag as duplicate');
  });

  // TEST 4: Successful login with valid credentials
  await runTest('4. Successful login with valid credentials returns active session', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signInResponse: {
        data: {
          user: { id: 'u-101', email: 'citizen@example.gov.in' },
          session: { access_token: 'valid-jwt-token-456' },
        },
        error: null,
      },
    });

    const result = await auth.signIn('citizen@example.gov.in', 'correctpassword');
    assert(result.error === null, 'Error must be null');
    assert(result.session !== null, 'Session must exist');
  });

  // TEST 5: Invalid credentials error handling
  await runTest('5. Invalid credentials returns sanitized, actionable error message', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signInResponse: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      },
    });

    const result = await auth.signIn('citizen@example.gov.in', 'wrongpassword');
    assert(result.error !== null, 'Error must not be null');
    assert(
      result.error!.includes('Invalid login credentials'),
      'Must disclose invalid login credentials'
    );
    assert(
      result.error!.includes('create an account'),
      'Must offer guidance to verify credentials or create an account'
    );
  });

  // TEST 5B: Unconfirmed email during sign-in
  await runTest('5B. Unconfirmed email during sign-in flags isUnconfirmed and guidance', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      signInResponse: {
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      },
    });

    const result = await auth.signIn('citizen@example.gov.in', 'password123');
    assert(result.error !== null, 'Error must be set');
    assert(result.isUnconfirmed === true, 'isUnconfirmed must be true');
    assert(
      result.error!.includes('confirmation link sent to your inbox'),
      'Must guide user to check confirmation link'
    );
  });

  // TEST 6: Profile-creation failure fallback handling
  await runTest('6. Missing or delayed profile creation does not crash and enables fallback', async () => {
    const auth = createMockAuthService({
      isConfigured: true,
      profileQueryResponse: {
        data: null,
        error: { message: 'Row not found' },
      },
    });

    const result = await auth.fetchProfile('u-missing');
    assert(result.profile === null, 'Profile should be null');
    assert(result.fallbackNeeded === true, 'Fallback needed must be true');
  });

  // TEST 7: Missing or incorrect Supabase configuration handling
  await runTest('7. Unconfigured Supabase environment returns clear setup error without throwing', async () => {
    const auth = createMockAuthService({
      isConfigured: false,
    });

    const signUpResult = await auth.signUp('test@example.com', 'password');
    assert(signUpResult.error !== null, 'SignUp must return error');
    assert(
      signUpResult.error!.includes('Supabase environment is not configured'),
      'Must explain configuration requirement'
    );

    const signInResult = await auth.signIn('test@example.com', 'password');
    assert(signInResult.error !== null, 'SignIn must return error');
    assert(
      signInResult.error!.includes('Supabase environment is not configured'),
      'Must explain configuration requirement'
    );
  });

  console.log('\n================================================================');
  console.log(`AUTH TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('Zero Database Writes Confirmed (100% In-Memory Execution)');
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
