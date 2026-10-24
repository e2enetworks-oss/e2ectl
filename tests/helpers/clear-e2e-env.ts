// Unit tests must not read the E2E settings of the shell that runs them.
// Every E2E_* variable starts out unset; a test that needs one stubs it.
const E2E_ENV_VARS = [
  'E2E_API_KEY',
  'E2E_AUTH_TOKEN',
  'E2E_LOCATION',
  'E2E_PROJECT_ID',
  'E2E_TIR_ACCOUNT_ID',
  'E2E_TIR_LOCATION',
  'E2E_TIR_PROJECT_ID'
];

beforeEach(() => {
  for (const name of E2E_ENV_VARS) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});
