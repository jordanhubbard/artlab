/**
 * IDE shell smoke tests — verifies the app loads and basic structure is present
 * before any example is selected.
 */
import { test, expect } from '@playwright/test'

test.describe('IDE shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
  })

  test('page title is Artlab', async ({ page }) => {
    await expect(page).toHaveTitle(/artlab/i)
  })

  test('canvas is present', async ({ page }) => {
    await expect(page.locator('#canvas-container canvas')).toBeVisible()
  })

  test('examples nav is populated', async ({ page }) => {
    // Wait for JS to build the nav (at least 10 rows)
    const rows = page.locator('.ex-row')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
    expect(await rows.count()).toBeGreaterThanOrEqual(10)
  })

  test('hash routing: #aurora loads aurora example', async ({ page }) => {
    await page.goto('./#aurora', { waitUntil: 'domcontentloaded' })
    // Wait for sidebar to build then for aurora row to get active class
    await expect(page.locator('.ex-row[data-name="aurora"]')).toHaveClass(/active/, { timeout: 10000 })
  })

  test('no JS errors on cold load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })
})
