import { test, expect } from '@playwright/test'

test('Northern Light renders every act, including reflection and ray-marching shaders', async ({ page }) => {
  test.setTimeout(180000)
  await page.setViewportSize({ width: 960, height: 540 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    // Unlike gallery smoke tests, do not filter out renderer or shader errors.
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('./#long-winter')
  await expect(page.getByRole('button', { name: 'WATCH NORTHERN LIGHT', exact: true })).toBeVisible({ timeout: 30000 })
  // Act navigation also works before playback. Keep the transport idle so slow
  // software rendering cannot advance the audio clock past the act under test.
  for (const act of ['FIRE IN THE SNOW', 'FJORD MIRROR', 'AURORA CODE', 'BIRCH RUN', 'THE LOOSE PIXEL', 'COPPER TUNNEL', 'SILVER BLOOM', 'FIRST LIGHT']) {
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.lw-part')).toHaveText(act, { timeout: 30000 })
    // Force a completed render/readback, including shaders first compiled in this act.
    // Page capture does not wait for the IDE's animated layout to become stable.
    await page.screenshot()
    await expect(page.locator('.preview-error')).not.toBeVisible()
  }
  expect(errors).toEqual([])
})
