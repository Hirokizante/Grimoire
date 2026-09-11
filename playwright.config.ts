import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Playwright config for Grimoire's end-to-end tests.
 *
 * The app is a fully static, offline-first SPA, so the suite runs against the
 * **production build** served by `vite preview` rather than a dev server (the
 * repo's `.hermes.md` explicitly rules out dev-server click-through testing).
 * Vite's `base` is `/Grimoire/`, so every page lives under that subpath.
 *
 * Browsers: run `npx playwright install chromium` once. On an offline machine
 * that already has a Chromium build from an earlier Playwright release, set
 * `PLAYWRIGHT_CHROMIUM_PATH` to its executable (or rely on the cache probe
 * below) instead of downloading a new one.
 */
function chromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH
  }
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) return undefined
  const candidates = [
    join(cache, 'chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
    join(
      cache,
      'chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

const executablePath = chromiumExecutable()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/Grimoire/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Grimoire/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
