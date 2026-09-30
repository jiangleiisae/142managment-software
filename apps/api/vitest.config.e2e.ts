import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// dotenv never overrides a variable already present in process.env, so loading .env.test here
// first (before Nest's own ConfigModule loads .env at app-bootstrap time) makes the isolated
// tcms_test database win over the dev DATABASE_URL for every e2e test run.
loadDotenv({ path: '.env.test' });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Tests share one physical Postgres database (tenant-isolated, but still one connection pool
    // budget); running spec files sequentially avoids exhausting Postgres max_connections.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
