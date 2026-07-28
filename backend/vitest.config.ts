import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './tests/preparar-banco.ts',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./loa2027-test.db',
      JWT_SECRET: 'segredo-de-teste',
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
