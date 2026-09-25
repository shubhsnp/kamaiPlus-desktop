/**
 * Prepares release/ — what `npm run release:publish` uploads to
 * https://kamaiplus-desktop.web.app/ — for the auto-updater (updater.js).
 *
 *   node scripts/prepare_release.js            stable: everyone gets this build
 *   node scripts/prepare_release.js --beta     beta only: computers with "early updates" on
 *   node scripts/prepare_release.js --promote  make the current beta build stable (no rebuild)
 *
 * latest.yml is read by normal installs, beta.yml by beta installs. A stable
 * release also becomes the beta (beta users are never behind stable). After each
 * step, installers that neither file points at are deleted, so the site holds at
 * most two versions.
 *
 * Staged rollout:  npm run version:bump → npm run release:beta → release:publish
 *                  → try it on 2–3 shops → npm run release:promote → release:publish
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const release = path.join(root, 'release');
const mode = process.argv.includes('--promote') ? 'promote' : process.argv.includes('--beta') ? 'beta' : 'stable';

const ymlInstaller = (text) => ((text.match(/^path:\s*(.+)$/m) || [])[1] || '').trim();
const ymlVersion = (text) => ((text.match(/^version:\s*(.+)$/m) || [])[1] || '').trim();
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

fs.mkdirSync(release, { recursive: true });

if (mode === 'promote') {
  const betaFile = path.join(release, 'beta.yml');
  if (!fs.existsSync(betaFile)) fail('No release/beta.yml to promote. Run "npm run release:beta" first.');
  const beta = fs.readFileSync(betaFile, 'utf8');
  const exe = ymlInstaller(beta);
  if (!exe || !fs.existsSync(path.join(release, exe))) fail(`release/${exe || '<installer>'} is missing — cannot promote.`);
  fs.writeFileSync(path.join(release, 'latest.yml'), beta);
  console.log(`Promoted beta v${ymlVersion(beta)} to stable (latest.yml).`);
} else {
  const { version } = require(path.join(root, 'package.json'));
  const installer = `KamaiPlus-Desktop-Setup-${version}.exe`;
  for (const f of ['latest.yml', installer, `${installer}.blockmap`]) {
    if (!fs.existsSync(path.join(dist, f))) fail(`Missing dist/${f}. Build the installer first (npm run release:desktop / release:beta).`);
  }
  const yml = fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
  if (ymlVersion(yml) !== version) fail(`dist/latest.yml is for v${ymlVersion(yml)}, not v${version}. Rebuild the installer.`);
  fs.copyFileSync(path.join(dist, installer), path.join(release, installer));
  fs.copyFileSync(path.join(dist, `${installer}.blockmap`), path.join(release, `${installer}.blockmap`));
  fs.writeFileSync(path.join(release, 'beta.yml'), yml);
  if (mode === 'stable') fs.writeFileSync(path.join(release, 'latest.yml'), yml);
  console.log(mode === 'beta' ? `v${version} ready for BETA computers only (beta.yml).` : `v${version} ready for everyone (latest.yml + beta.yml).`);
}

// Keep only installers that latest.yml or beta.yml point at.
const keep = new Set();
for (const y of ['latest.yml', 'beta.yml']) {
  const p = path.join(release, y);
  if (fs.existsSync(p)) {
    const exe = ymlInstaller(fs.readFileSync(p, 'utf8'));
    if (exe) {
      keep.add(exe);
      keep.add(`${exe}.blockmap`);
    }
  }
}
for (const f of fs.readdirSync(release)) {
  if (/\.(exe|blockmap)$/.test(f) && !keep.has(f)) fs.rmSync(path.join(release, f));
}

// Download page (site/ → release/). The stable version is stamped in so the
// download button works even without JavaScript; the page also re-reads latest.yml.
const site = path.join(root, 'site');
const latestPath = path.join(release, 'latest.yml');
if (fs.existsSync(site) && fs.existsSync(latestPath)) {
  const latest = fs.readFileSync(latestPath, 'utf8');
  const exe = ymlInstaller(latest);
  const sizeBytes = Number((latest.match(/^\s+size:\s*(\d+)/m) || [])[1] || 0);
  const date = ((latest.match(/^releaseDate:\s*'?([^'\n]+)'?/m) || [])[1] || '').trim();
  const stamps = {
    '{{VERSION}}': ymlVersion(latest),
    '{{INSTALLER}}': exe,
    '{{SIZE_MB}}': sizeBytes ? (sizeBytes / 1048576).toFixed(0) : '110',
    '{{RELEASE_DATE}}': date ? `Released ${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : '',
  };
  for (const f of fs.readdirSync(site)) {
    const from = path.join(site, f);
    if (/\.html$/.test(f)) {
      let html = fs.readFileSync(from, 'utf8');
      for (const [k, v] of Object.entries(stamps)) html = html.split(k).join(v);
      fs.writeFileSync(path.join(release, f), html);
    } else {
      fs.copyFileSync(from, path.join(release, f));
    }
  }
  console.log(`Download page updated for v${stamps['{{VERSION}}']}.`);
}

console.log('release/ now contains:');
for (const f of fs.readdirSync(release).sort()) {
  const extra = /\.yml$/.test(f) ? `  → v${ymlVersion(fs.readFileSync(path.join(release, f), 'utf8'))}` : `  (${(fs.statSync(path.join(release, f)).size / 1024 / 1024).toFixed(1)} MB)`;
  console.log(`  ${f}${extra}`);
}
if (!fs.existsSync(path.join(release, 'latest.yml'))) {
  console.warn('WARNING: release/ has no latest.yml — publishing now would leave normal installs without updates.');
}
console.log('Next: npm run release:publish');
