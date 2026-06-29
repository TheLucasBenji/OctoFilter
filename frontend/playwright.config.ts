import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const e2eDataRoot = path.join(os.tmpdir(), `octopus-e2e-${Date.now()}-${process.pid}`);
const pythonBin = path.join(repoRoot, 'venv', 'bin', 'python');
const backendPort = 8010;
const frontendPort = 5174;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

fs.mkdirSync(e2eDataRoot, { recursive: true });

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `cd "${repoRoot}" && "${pythonBin}" -m uvicorn backend.main:app --host 127.0.0.1 --port ${backendPort}`,
      url: `${backendUrl}/docs`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        OCTOPUS_DB_PATH: path.join(e2eDataRoot, 'octopus.sqlite3'),
        OCTOPUS_HISTORY_ROOT: path.join(e2eDataRoot, 'history'),
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_BASE: backendUrl,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
