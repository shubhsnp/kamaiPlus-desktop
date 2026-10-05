// Which kamaiplus.com/help guides might a code change make wrong? (process: docs/HELP_SYNC.md)
//
//   node scripts/help_impact.mjs              → files changed in the working tree + staged, vs HEAD
//   node scripts/help_impact.mjs <ref>        → files changed since <ref> (e.g. v4.98.0's commit, HEAD~3)
//   node scripts/help_impact.mjs --files a b  → these files
//
// Prints each guide with the files that touch it, the app-tour stages that retake its screenshots,
// and the row to add to docs/HELP_SYNC.md. Changes outside docs/help-map.json's sources print nothing.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'help-map.json'), 'utf8'));

/** "src/app/billing/**" → RegExp. `**` = any depth, `*` = within one folder. */
export function globToRegExp(glob) {
  const re = glob
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${re}$`);
}

export function guidesForFiles(files, guides = map.guides) {
  const hits = [];
  for (const g of guides) {
    const res = g.sources.map(globToRegExp);
    const touched = files.filter((f) => res.some((r) => r.test(f)));
    if (touched.length) hits.push({ ...g, touched });
  }
  return hits;
}

function changedFiles(args) {
  if (args[0] === '--files') return args.slice(1).map((f) => f.replace(/\\/g, '/'));
  const git = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  if (args[0]) return git(`git diff --name-only ${args[0]}`);
  return [...new Set([...git('git diff --name-only HEAD'), ...git('git ls-files --others --exclude-standard')])];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = changedFiles(process.argv.slice(2));
  const hits = guidesForFiles(files);
  if (!hits.length) {
    console.log(`Help impact: none (${files.length} changed file(s), none described by a help guide).`);
    console.log('Still add a docs/HELP_SYNC.md row for a version bump: | <version> | … | — | none |');
  } else {
    console.log(`Help impact: ${hits.length} guide(s) may need an update:\n`);
    for (const h of hits) {
      console.log(`  • ${h.guide} — ${h.title}`);
      console.log(`      website: src/pages/help/${h.guide}.html (+ its Hindi in src/i18n/hi.json)`);
      console.log(`      changed: ${h.touched.slice(0, 6).join(', ')}${h.touched.length > 6 ? ` (+${h.touched.length - 6})` : ''}`);
      console.log(`      screenshots: app-tour stages ${h.tourStages.join(', ')} (run \`all\` before publishing)`);
    }
    console.log('\nIf the shop would see a difference (a button, a word, a number, a step), add to docs/HELP_SYNC.md:');
    console.log(`  | <version> | <what changed, in shop words> | ${hits.map((h) => h.guide).join(', ')} | pending |`);
    console.log('If nothing visible changed (a refactor, a test), write the row with "none" as the status.');
  }
}
