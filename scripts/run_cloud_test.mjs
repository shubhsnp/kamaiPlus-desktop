// npm run test:cloud — starts the Firestore + Auth emulators with the shop's real rules
// (KamaiPlus Android repo: firebase.json → firestore.rules), runs scripts/cloud_sync_emulator.ts,
// stops them. Project id "demo-kamaiplus": the emulators never reach the live project.
// KAMAI_ANDROID_REPO overrides where the Android repo is (default: next to this repo).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = process.env.KAMAI_ANDROID_REPO || path.join(APP_DIR, '..', 'KamaiPlus Android');
const rules = path.join(ANDROID, 'firestore.rules');
if (!fs.existsSync(rules)) {
  console.log(`firestore.rules not found at ${rules} — set KAMAI_ANDROID_REPO.`);
  process.exit(1);
}
// A throw-away firebase.json: the Android repo's rules, and both emulators.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-cloud-test-'));
fs.copyFileSync(rules, path.join(tmp, 'firestore.rules'));
const config = path.join(tmp, 'firebase.json');
fs.writeFileSync(config, JSON.stringify({ firestore: { rules: 'firestore.rules' }, emulators: { auth: { port: 9099 }, firestore: { port: 8080 }, ui: { enabled: false } } }));
// The emulators need Java 21+. On this kind of PC Java 17 is often first in PATH (Android
// builds); a newer JDK under Program Files\Java (or Microsoft) is put in front for this run.
const env = { ...process.env };
if (process.platform === 'win32') {
  for (const base of ['C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft']) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(base).filter((d) => /^jdk-(\d+)/.test(d) && Number(/^jdk-(\d+)/.exec(d)[1]) >= 21).sort().reverse();
    } catch {}
    if (dirs.length) {
      const home = path.join(base, dirs[0]);
      env.JAVA_HOME = home;
      env.PATH = `${path.join(home, 'bin')};${env.PATH || env.Path || ''}`;
      env.Path = env.PATH;
      break;
    }
  }
}
// One command line (the shell splits it): quoted, the paths have spaces.
const cmd = `firebase emulators:exec --only firestore,auth --project demo-kamaiplus --config "${config}" "npx tsx scripts/cloud_sync_emulator.ts"`;
const res = spawnSync(cmd, { cwd: APP_DIR, stdio: 'inherit', shell: true, env });
process.exit(res.status ?? 1);
