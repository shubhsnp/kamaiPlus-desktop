/**
 * KamaiPlus GitHub Release Publisher
 * 
 * 🔒 SECURITY POLICY:
 * This script ONLY uploads COMPILED BINARIES (.exe installer / .apk) to the
 * public GitHub Releases storage (sayrahul/kamaiplus-releases).
 * PROPRIETARY SOURCE CODE IS STRICTLY FORBIDDEN FROM EVER BEING PUBLISHED.
 * 
 * Usage:
 *   node scripts/publish_github_release.mjs
 *   node scripts/publish_github_release.mjs --tag v4.116.0
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 🔒 STRICT EXTENSION WHITELIST: ONLY COMPILED INSTALLERS & PACKAGES ALLOWED
const ALLOWED_EXTENSIONS = new Set(['.exe', '.apk', '.msi', '.aab', '.zip']);

function getGitToken() {
  return new Promise((resolve, reject) => {
    const p = spawn('git', ['credential', 'fill']);
    p.stdin.write('protocol=https\nhost=github.com\n\n');
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', code => {
      const line = out.split('\n').find(l => l.startsWith('password='));
      if (!line) return reject(new Error('GitHub token not found in Git Credential Manager.'));
      resolve(line.slice(9).trim());
    });
  });
}

function ghRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

function uploadAsset(uploadUrlRaw, filePath, fileName, token) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reject(new Error(`🔒 SECURITY VIOLATION: Refusing to upload non-binary file '${fileName}'. Source code must NEVER be published.`));
    }

    const cleanUrl = uploadUrlRaw.replace(/\{.*\}/, '');
    const uploadUrl = new URL(cleanUrl);
    uploadUrl.searchParams.set('name', fileName);

    const stats = fs.statSync(filePath);
    console.log(`\n📦 Uploading Binary Asset: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

    const options = {
      hostname: uploadUrl.hostname,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KamaiPlus-Release-Publisher',
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`\n✅ ${fileName} successfully uploaded! (HTTP ${res.statusCode})`);
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        } else {
          console.error(`\n❌ Failed to upload ${fileName}: HTTP ${res.statusCode} ${body}`);
          reject(new Error(`Upload failed with HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);

    let uploaded = 0;
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', chunk => {
      uploaded += chunk.length;
      process.stdout.write(`\r[${fileName}] Progress: ${(uploaded / stats.size * 100).toFixed(1)}% (${(uploaded / 1024 / 1024).toFixed(1)} / ${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    });
    stream.pipe(req);
  });
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;
  const tag = `v${version}`;
  const releaseTitle = `KamaiPlus Desktop v${version}`;

  console.log(`🚀 Preparing GitHub Release: ${releaseTitle} (${tag})`);

  // Detect binary files
  const filesToUpload = [];

  // 1. Desktop installer
  const distInstaller = path.join(ROOT, 'dist', `KamaiPlus-Desktop-Setup-${version}.exe`);
  const releaseInstaller = path.join(ROOT, 'release', `KamaiPlus-Desktop-Setup-${version}.exe`);
  
  if (fs.existsSync(distInstaller)) {
    filesToUpload.push({ path: distInstaller, name: `KamaiPlus-Desktop-Setup-${version}.exe` });
  } else if (fs.existsSync(releaseInstaller)) {
    filesToUpload.push({ path: releaseInstaller, name: `KamaiPlus-Desktop-Setup-${version}.exe` });
  } else {
    console.warn(`⚠️ Warning: Desktop installer for v${version} not found in dist/ or release/.`);
  }

  // 2. Check if latest Android Universal APK exists (unless --desktop-only is specified)
  const isDesktopOnly = process.argv.includes('--desktop-only');
  if (!isDesktopOnly) {
    const androidPath = path.resolve(ROOT, '..', 'KamaiPlus Android');
    const androidUniversal = path.join(androidPath, 'builds', 'KamaiPlus-Universal-v4.30.0-Release.apk');
    const androidReleaseApk = path.join(androidPath, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
    
    if (fs.existsSync(androidUniversal)) {
      filesToUpload.push({ path: androidUniversal, name: path.basename(androidUniversal) });
    } else if (fs.existsSync(androidReleaseApk)) {
      filesToUpload.push({ path: androidReleaseApk, name: `KamaiPlus-Android-Release.apk` });
    }
  }

  if (filesToUpload.length === 0) {
    console.error('❌ No compiled binary builds (.exe or .apk) found to upload. Please build the project first.');
    process.exit(1);
  }

  const token = await getGitToken();

  // Create or retrieve Release
  const releaseBody = `# 🚀 KamaiPlus Production Release v${version}

Official compiled binary release for Indian small & medium retail businesses.
100% Offline-First POS, Barcode Scanning, Thermal Receipt Printing, GST Invoicing & Khata Management.

### 📦 Available Downloads
${filesToUpload.map(f => `- **${f.name}** (${(fs.statSync(f.path) / 1024 / 1024).toFixed(1)} MB)`).join('\n')}

---

### 🌐 Official Links
- Official Website: https://kamaiplus.com
- Windows Desktop: https://kamaiplus.com/desktop
- Help Guides: https://kamaiplus.com/help
- GST Calculator: https://kamaiplus.com/tools/gst-calculator
- Barcode Generator: https://kamaiplus.com/tools/barcode-generator

---
<sub>🔒 Security Notice: Proprietary software. Only verified compiled binaries are published to this release channel.</sub>`;

  console.log(`\nConnecting to GitHub Releases API (sayrahul/kamaiplus-releases)...`);

  const createRes = await ghRequest(
    {
      hostname: 'api.github.com',
      path: '/repos/sayrahul/kamaiplus-releases/releases',
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KamaiPlus-Release-Publisher',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    },
    {
      tag_name: tag,
      target_commitish: 'main',
      name: releaseTitle,
      body: releaseBody,
      draft: false,
      prerelease: false
    }
  );

  let uploadUrl = '';
  let existingAssets = [];

  if (createRes.status === 201) {
    console.log(`✨ GitHub Release created successfully: ${tag}`);
    uploadUrl = createRes.data.upload_url;
    existingAssets = createRes.data.assets || [];
  } else if (createRes.status === 422 && createRes.data?.errors?.[0]?.code === 'already_exists') {
    console.log(`ℹ️ Release ${tag} already exists. Fetching existing release details...`);
    const getRes = await ghRequest({
      hostname: 'api.github.com',
      path: `/repos/sayrahul/kamaiplus-releases/releases/tags/${tag}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KamaiPlus-Release-Publisher',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (getRes.status === 200) {
      uploadUrl = getRes.data.upload_url;
      existingAssets = getRes.data.assets || [];
    } else {
      console.error('❌ Could not fetch existing release:', getRes.data);
      process.exit(1);
    }
  } else {
    console.error(`❌ GitHub API Error: HTTP ${createRes.status}`, createRes.data);
    process.exit(1);
  }

  // Upload each binary asset (deleting old copy if already present)
  for (const f of filesToUpload) {
    const existing = existingAssets.find(a => a.name === f.name);
    if (existing) {
      console.log(`\n🔄 Replacing existing asset ${f.name} (id: ${existing.id})...`);
      await ghRequest({
        hostname: 'api.github.com',
        path: `/repos/sayrahul/kamaiplus-releases/releases/assets/${existing.id}`,
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'KamaiPlus-Release-Publisher',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      console.log(`🗑️ Removed previous copy of ${f.name}.`);
    }
    await uploadAsset(uploadUrl, f.path, f.name, token);
  }

  console.log(`\n🎉 All latest compiled binaries published to GitHub Releases!`);
  console.log(`🔗 https://github.com/sayrahul/kamaiplus-releases/releases`);
}

main().catch(err => {
  console.error('\n❌ Fatal error in release publisher:', err);
  process.exit(1);
});
