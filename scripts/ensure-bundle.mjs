/**
 * Ensure one local package is listed in a profile's dsh.profile.bundles.
 * The pnpm step (dsh plugin add) usually does this; this is the idempotent guard.
 */
import fs from 'node:fs'

const [file, name] = process.argv.slice(2)
if (!file || !name) {
  console.error('usage: node ensure-bundle.mjs <profile-package.json> <package-name>')
  process.exit(2)
}
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
pkg.dsh = pkg.dsh && typeof pkg.dsh === 'object' ? pkg.dsh : {}
pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === 'object' ? pkg.dsh.profile : {}
pkg.dsh.profile.bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : []
if (!pkg.dsh.profile.bundles.includes(name)) {
  pkg.dsh.profile.bundles.push(name)
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(pkg, null, 2) + '\n')
  fs.renameSync(tmp, file)
  console.log('added ' + name + ' to dsh.profile.bundles')
} else {
  console.log(name + ' already listed in dsh.profile.bundles')
}
