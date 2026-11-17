import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(HERE, '..', '..', '..', '..', '截图', '自测截图_批次1')
fs.mkdirSync(SHOTS, { recursive: true })

const base = process.env.DCE_URL
if (!base) {
  console.log('DCE_URL is not set; skipping browser smoke')
  process.exit(0)
}
const executablePath = process.env.DCE_CHROMIUM
  || '/Users/dingmac/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'

const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const logs = []
page.on('console', (message) => {
  if (message.type() === 'error') logs.push('console: ' + message.text())
})
page.on('pageerror', (error) => logs.push('pageerror: ' + error.message))

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)
  console.log('TITLE', await page.title())
  const body = await page.locator('body').innerText()
  console.log('BODY', body.replace(/\s+/g, ' ').slice(0, 1200))
  await page.screenshot({ path: path.join(SHOTS, '01-boot.png') })

  const relevant = logs.filter((line) => /confirm-explain|dce-|slot/i.test(line))
  console.log('RELEVANT_LOGS', JSON.stringify(relevant))
  console.log('ERROR_COUNT', logs.length)
  console.log('STYLE_PRESENT', await page.evaluate(() => Boolean(document.getElementById('dce-style'))))
} finally {
  await browser.close()
}
