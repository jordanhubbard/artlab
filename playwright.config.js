import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:   './e2e',
  timeout:   15_000,   // per test
  expect:    { timeout: 8_000 },
  fullyParallel: true,
  retries:   process.env.CI ? 1 : 0,
  reporter:  process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4173/artlab/',
    // SwiftShader gives software WebGL in CI (no GPU needed)
    launchOptions: {
      args: ['--enable-webgl', '--use-gl=swiftshader', '--disable-web-security'],
    },
    // Grant camera/mic upfront so media examples don't hang on permission prompts
    permissions: ['camera', 'microphone'],
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Assumes dist/ is already built (CI builds before running; locally run npm run build:artlab first)
  webServer: {
    command:              'npx vite preview --port 4173',
    url:                  'http://localhost:4173/artlab/',
    timeout:              30_000,
    reuseExistingServer:  !process.env.CI,
    env: { BASE_URL: '/artlab/' },
  },
})
