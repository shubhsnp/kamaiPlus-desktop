/**
 * Copies the files the auto-updater needs from dist/ into release/, which is what
 * `npm run release:publish` uploads to https://kamaiplus-desktop.web.app/.
 *
 *   latest.yml                                  <- every installed app checks this
 *   KamaiPlus-Desktop-Setup-<version>.exe        <- the update itself
 *   KamaiPlus-Desktop-Setup-<version>.exe.blockmap  (lets the updater download only the changed parts)
 *
 * release/ is emptied first, so only the newest version is ever published.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const release = path.join(root, 'release');
const { version } = require(path.join(root, 'package.json'));

const installer = `KamaiPlus-Desktop-Setup-${version}.exe`;
const files = ['latest.yml', installer, `${installer}.blockmap`];

for (const f of files) {
  if (!fs.existsSync(path.join(dist, f))) {
    console.error(`Missing dist/${f}. Run "npm run release:desktop" (it builds the installer first).`);
    process.exit(1);
  }
}

const latest = fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
if (!latest.includes(`version: ${version}`)) {
  console.error(`dist/latest.yml is not for v${version}. Rebuild the installer.`);
  process.exit(1);
}

fs.rmSync(release, { recursive: true, force: true });
fs.mkdirSync(release);
for (const f of files) fs.copyFileSync(path.join(dist, f), path.join(release, f));

console.log(`release/ ready for v${version}:`);
for (const f of files) {
  const mb = (fs.statSync(path.join(release, f)).size / 1024 / 1024).toFixed(1);
  console.log(`  ${f}  (${mb} MB)`);
}
console.log('Next: npm run release:publish');
