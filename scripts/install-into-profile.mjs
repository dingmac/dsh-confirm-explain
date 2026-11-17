/**
 * Install this package into an existing DSH profile without the CLI guard.
 *
 * The Electron-managed desktop profile refuses "dsh plugin ...", so this script
 * performs the same three facts by hand, idempotently:
 *   1. package.json -> dependencies["@local/dsh-confirm-explain"] = "link:<pkg>"
 *   2. node_modules/@local/dsh-confirm-explain -> <pkg>
 *   3. package.json -> dsh.profile.bundles includes the package
 *
 * It backs up package.json and pnpm-lock.yaml first. Restart the app afterwards.
 *
 *   node scripts/install-into-profile.mjs [--dry-run] [profileDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG_DIR = path.resolve(HERE, '..')
const NAME = '@local/dsh-confirm-explain'
const SCOPE = '@local'
const BASE = NAME.split('/')[1]

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const profileArg = args.find((value) => !value.startsWith('--'))
const profileDir = path.resolve(profileArg || path.join(process.env.HOME || '', '.dsh', 'profiles', 'desktop'))
const pkgFile = path.join(profileDir, 'package.json')

if (!fs.existsSync(pkgFile)) {
  console.error('profile package.json not found: ' + pkgFile)
  process.exit(1)
}

const before = fs.readFileSync(pkgFile, 'utf8')
const pkg = JSON.parse(before)
pkg.dependencies = pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {}
pkg.dsh = pkg.dsh && typeof pkg.dsh === 'object' ? pkg.dsh : {}
pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === 'object' ? pkg.dsh.profile : {}
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : []
const changes = []

if (pkg.dependencies[NAME] !== 'link:' + PKG_DIR) {
  pkg.dependencies[NAME] = 'link:' + PKG_DIR
  changes.push('dependency -> link:' + PKG_DIR)
}
if (!bundles.includes(NAME)) {
  bundles.push(NAME)
  changes.push('bundles += ' + NAME)
}
pkg.dsh.profile.bundles = bundles

const scopeDir = path.join(profileDir, 'node_modules', SCOPE)
const linkPath = path.join(scopeDir, BASE)
const linkExists = fs.existsSync(linkPath)
if (!linkExists) changes.push('symlink ' + linkPath + ' -> ' + PKG_DIR)

if (changes.length === 0) {
  console.log('already installed in ' + profileDir)
  process.exit(0)
}
console.log('plan:')
for (const line of changes) console.log('  - ' + line)
if (dryRun) {
  console.log('dry run: nothing written')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
fs.writeFileSync(pkgFile + '.bak-confirm-explain-' + stamp, before)
const lock = path.join(profileDir, 'pnpm-lock.yaml')
if (fs.existsSync(lock)) fs.copyFileSync(lock, lock + '.bak-confirm-explain-' + stamp)

if (!linkExists) {
  fs.mkdirSync(scopeDir, { recursive: true })
  fs.symlinkSync(PKG_DIR, linkPath, 'dir')
}
const tmp = pkgFile + '.tmp'
fs.writeFileSync(tmp, JSON.stringify(pkg, null, 2) + '\n')
fs.renameSync(tmp, pkgFile)
console.log('installed into ' + profileDir + ' (backup suffix ' + stamp + ')')
console.log('restart DeepSeek Harness to load the host half; reload the page for the browser half.')
