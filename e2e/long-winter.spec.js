import { test, expect } from '@playwright/test'

test('Northern Light renders every act, including reflection and ray-marching shaders', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 960, height: 540 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    // Unlike gallery smoke tests, do not filter out renderer or shader errors.
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('./#long-winter')
  await page.getByRole('button', { name: 'WATCH NORTHERN LIGHT', exact: true }).click({ timeout: 30000 })
  await expect(page.locator('[data-long-winter]')).toHaveClass(/started/)
  await page.locator('#canvas-container canvas').first().click()
  await page.keyboard.press('Space')
  for (const act of ['FIRE IN THE SNOW', 'FJORD MIRROR', 'AURORA CODE', 'BIRCH RUN', 'THE LOOSE PIXEL', 'COPPER TUNNEL', 'SILVER BLOOM', 'FIRST LIGHT']) {
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.lw-part')).toHaveText(act)
    // Force a completed render/readback, including shaders first compiled in this act.
    await page.locator('#canvas-container').screenshot()
    await expect(page.locator('.preview-error')).not.toBeVisible()
  }
  expect(errors).toEqual([])
})
