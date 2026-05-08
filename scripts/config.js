const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FEEDS_FILE = path.join(DATA_DIR, 'feeds.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.json');

function loadFeedsConfig() {
  const raw = fs.readFileSync(FEEDS_FILE, 'utf-8');
  const config = JSON.parse(raw);
  return {
    feeds: config.feeds.filter(f => f.enabled !== false),
    settings: config.settings
  };
}

function loadArchive() {
  if (!fs.existsSync(ARCHIVE_FILE)) {
    return { version: 1, last_pruned: '', seen: {} };
  }
  return JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8'));
}

function saveArchive(archive) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2), 'utf-8');
}

module.exports = { loadFeedsConfig, loadArchive, saveArchive, DATA_DIR };
