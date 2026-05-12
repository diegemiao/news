// Push generated files to GitHub via API
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOKEN = execSync('"C:\\Program Files\\GitHub CLI\\gh.exe" auth token', { encoding: 'utf-8' }).trim();
const REPO = 'diegemiao/news';

async function ghAPI(method, endpoint, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.github.com/repos/${REPO}/${endpoint}`, opts);
  return res.json();
}

async function pushFile(filePath, repoPath) {
  const content = fs.readFileSync(filePath);
  const b64 = content.toString('base64');

  // Get current SHA
  const current = await ghAPI('GET', `contents/${repoPath}?ref=master`);
  const sha = current.sha;

  // Upload
  const result = await ghAPI('PUT', `contents/${repoPath}`, {
    message: 'news update',
    content: b64,
    sha: sha,
    branch: 'master',
  });

  if (result.content) {
    console.log(`  [push] ${repoPath} OK`);
    return true;
  }
  console.error(`  [push] ${repoPath} FAILED:`, result.message);
  return false;
}

async function main() {
  if (!TOKEN) {
    console.log('  [push] No GH_TOKEN, skipping');
    return;
  }
  const root = path.join(__dirname, '..');
  const ok1 = await pushFile(path.join(root, 'docs', 'index.html'), 'docs/index.html');
  const ok2 = await pushFile(path.join(root, 'data', 'archive.json'), 'data/archive.json');
  if (ok1 && ok2) console.log('  [push] All OK');
}

main().catch(e => console.error('  [push] Error:', e.message));
