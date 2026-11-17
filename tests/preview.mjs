import { chromium } from 'playwright-core'
import fs from 'node:fs'
const shots = '/Volumes/NASData/dingmac/DSH产出/插件制作/确认解释插件/截图/自测截图_批次1'
fs.mkdirSync(shots, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Users/dingmac/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
await page.goto('file:///Volumes/NASData/dingmac/DSH产出/插件制作/确认解释插件/脚本/确认解释插件源码_批次1/dsh-confirm-explain/tests/preview.html', { waitUntil: 'load' })
await page.waitForTimeout(1800)
console.log('PILL', await page.evaluate(() => Boolean(document.querySelector('[data-approval-key] [data-dce-explain-btn]'))))
console.log('DRAWER', await page.evaluate(() => Boolean(document.querySelector('.dce-drawer'))))
console.log('TEXT', (await page.locator('.dce-drawer').innerText()).replace(/\s+/g, ' ').slice(0, 400))
await page.screenshot({ path: shots + '/01-解释抽屉.png' })
await page.evaluate(() => window.__previewChat())
await page.waitForTimeout(1200)
console.log('FLOAT', await page.evaluate(() => Boolean(document.querySelector('.dce-float'))))
await page.screenshot({ path: shots + '/02-追问小窗.png' })
console.log('ERRORS', errors.slice(0, 10))
await browser.close()
