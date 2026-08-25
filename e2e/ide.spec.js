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

  test('switching away from solar-system clears its planet labels', async ({ page }) => {
    // solar-system loads textures and an audio graph before any label appears.
    test.setTimeout(45_000)
    // CSS2D labels are DOM nodes in an overlay rather than scene objects, so a
    // teardown that only detaches meshes leaves them stranded on screen.
    const labelCount = () => page.evaluate(() => {
      const names = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']
      return [...document.querySelectorAll('div')]
        .filter(d => d.children.length === 0 && names.includes(d.textContent.trim()))
        .length
    })

    await page.goto('./#solar-system', { waitUntil: 'domcontentloaded' })
    await expect.poll(labelCount, { timeout: 15000 }).toBeGreaterThan(0)

    await page.evaluate(() => { location.hash = '#hello-cube' })
    await expect.poll(labelCount, { timeout: 10000 }).toBe(0)
  })

  test('no JS errors on cold load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })
})
