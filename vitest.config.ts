import { defineConfig } from 'vitest/config';

// Unit tests (pure logic). Rules tests live in tests/rules and need the Firestore emulator.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
