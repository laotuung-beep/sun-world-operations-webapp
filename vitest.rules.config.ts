import { defineConfig } from 'vitest/config';

// Run through `npm run test:rules` (wraps the Firestore emulator; needs Java).
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 20000 },
});
