import { test } from '@playwright/test';
import { env } from '../../utils/env.mjs';

test.describe('Opt-in live mutation tests', () => {
  test.skip(!env.mutationEnabled, 'Set ENABLE_MUTATION_TESTS=true before running live mutation flows.');

  test('Mutation placeholder for vendor/profile form validation', async () => {
    // Intentionally left as an opt-in extension point.
    // Add create/update assertions here only after the team approves live data mutation.
  });
});
