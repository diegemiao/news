const crypto = require('crypto');

/**
 * Filter out already-seen articles
 * @param {Array} articles - fetched articles
 * @param {object} archive - { seen: { [feedId]: { [key]: timestamp } } }
 * @param {boolean} isFirstRun - if true, mark all as seen, return empty
 * @returns {{ newArticles: Array, updatedSeen: object }}
 */
function filterNewArticles(articles, archive, isFirstRun) {
  const seen = archive.seen || {};
  const newArticles = [];

  for (const article of articles) {
    const keys = buildKeys(article);
    const feedSeen = seen[article.source_id] || {};

    const isDuplicate = keys.some(k => feedSeen.hasOwnProperty(k));
    if (isDuplicate) continue;

    newArticles.push(article);

    // Mark as seen immediately to avoid intra-run duplicates
    if (!seen[article.source_id]) seen[article.source_id] = {};
    for (const k of keys) {
      seen[article.source_id][k] = Date.now() / 1000;
    }
  }

  // First run: mark all as seen, don't send anything
  if (isFirstRun) {
    return { newArticles: [], updatedSeen: seen };
  }

  return { newArticles, updatedSeen: seen };
}

function buildKeys(article) {
  const keys = [];
  if (article.guid) keys.push(`guid:${article.guid}`);
  if (article.url) keys.push(`url:${normalizeUrl(article.url)}`);
  keys.push(`hash:${crypto.createHash('md5').update(`${article.title}${article.source_name}`).digest('hex').substring(0, 8)}`);
  return keys;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('ref');
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

module.exports = { filterNewArticles };
