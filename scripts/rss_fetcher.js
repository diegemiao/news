const RssParser = require('rss-parser');
const { truncate, stripHtml, sanitizeHtml, wrapParagraphs, sleep } = require('./utils');

const parser = new RssParser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsDigest/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

/**
 * Fetch and parse a single RSS feed
 * @param {object} feedConfig - { id, name, url, category, type }
 * @param {object} settings - { max_articles_per_feed, max_retries, fetch_timeout_ms }
 * @returns {Promise<Array>} array of article objects
 */
async function fetchFeed(feedConfig, settings) {
  const { max_articles_per_feed = 8, max_retries = 2 } = settings;
  const limit = feedConfig.max_items || max_articles_per_feed;
  let lastError = null;

  for (let attempt = 0; attempt <= max_retries; attempt++) {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      const articles = (feed.items || []).slice(0, limit).map(item => {
        const rawTitle = item.title || '';
        const fullText = stripHtml(item.contentSnippet || item.content || '');
        const richContent = sanitizeHtml(item.content || item.contentSnippet || '');
        return {
        guid: item.guid || item.link || '',
        title: buildTitle(rawTitle, fullText, feedConfig.name),
        url: item.link || '',
        summary: truncate(fullText, 100),
        full_summary: richContent.substring(0, 5000),
        comments: parseCommentCount(item),
        source_name: feedConfig.name,
        source_id: feedConfig.id,
        category: feedConfig.category,
        published: item.pubDate || item.isoDate || '',
        fetch_time: new Date().toISOString()
      };
      });

      return articles;
    } catch (e) {
      lastError = e;
      if (attempt < max_retries) {
        await sleep(2000 * (attempt + 1));
      }
    }
  }

  console.error(`  [SKIP] ${feedConfig.name}: fetch failed - ${lastError?.message}`);
  return [];
}

async function fetchFeedApi(feedConfig) {
  const res = await fetch(feedConfig.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsDigest/1.0)' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const apiMax = feedConfig.max_items || 20;

  // Detect response format
  if (data.data && Array.isArray(data.data)) {
    // 60s.viki.moe format: {data: [{title, link, hot_value, 热度, url, rank}]}
    return data.data.slice(0, apiMax).map(item => ({
      guid: item.link || item.url || `hot-${item.title}`,
      title: buildTitle(item.title || '', '', ''),
      url: item.link || item.url || '',
      summary: (item.hot_value || item.热度) ? `热度 ${formatHeat(item.hot_value || item.热度)}` : '',
      full_summary: '',
      comments: parseInt(item.hot_value || item.热度, 10) || 0,
      source_name: feedConfig.name,
      source_id: feedConfig.id,
      category: feedConfig.category,
      published: data.update_time ? data.update_time.replace(' ', 'T') + ':00' : '',
      fetch_time: new Date().toISOString(),
      quality_score: 0,
      selected_reason: ''
    }));
  }

  // AIHOT format: {items: [{title, url, summaryZh, publishedAt, ...}]}
  const items = data.items || [];
  return items.slice(0, apiMax).map(item => {
    const rawTitle = item.titleZh || item.title || '';
    const summary = item.summaryZh || item.summary || '';
    const title = buildTitle(rawTitle, summary, item.source?.name || '');

    return {
      guid: item.id || item.url,
      title,
      url: item.url || '',
      summary: truncate(summary, 100),
      full_summary: wrapParagraphs(summary).substring(0, 5000),
      comments: 0,
      source_name: feedConfig.name,
      source_id: feedConfig.id,
      category: feedConfig.category,
      published: item.publishedAt || '',
      fetch_time: new Date().toISOString(),
      quality_score: item.qualityScore || 0,
      selected_reason: item.aiSelectedReason || ''
    };
  });
}

/**
 * Build a readable title from raw API data.
 * Fixes opaque titles like "v2.1.133" by using summary context.
 */
function buildTitle(rawTitle, summary, sourceName) {
  if (!rawTitle || rawTitle === '(无标题)') {
    // Extract first sentence from summary
    const m = summary.match(/^(.{15,60}?)[，。\.]/);
    return m ? m[1] : summary.substring(0, 50) + '…';
  }

  // Too short / version-number-only → prepend source context
  if (rawTitle.length < 15 && sourceName) {
    const prefix = sourceName.replace('（RSS）', '').replace('(RSS)', '').trim();
    return `${prefix}：${rawTitle}`;
  }

  // Looks like a version tag like "v2.1.133" → add context from summary
  if (/^v?\d+\.\d+/.test(rawTitle) && summary) {
    const m = summary.match(/^(.{15,50}?)[，。\.]/);
    return m ? m[1] : `${sourceName} ${rawTitle}`;
  }

  return rawTitle;
}

async function fetchAllFeeds(feeds, settings) {
  const tasks = feeds.map(f => {
    if (f.type === 'api') return fetchFeedApi(f);
    return fetchFeed(f, settings);
  });

  const results = await Promise.allSettled(tasks);

  const articles = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const arts = r.value;
      articles.push(...arts);
      if (arts.length > 0 && feeds[i].type === 'api') {
        console.log(`   [API] ${feeds[i].name}: ${arts.length} 篇精选`);
      }
    } else {
      console.error(`  [ERROR] ${feeds[i].name}: ${r.reason?.message}`);
    }
  });

  return articles;
}

function parseCommentCount(item) {
  const comments = item.comments || item['slash:comments'] || 0;
  if (typeof comments === 'string') return parseInt(comments, 10) || 0;
  return typeof comments === 'number' ? comments : 0;
}

function formatHeat(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return '';
  if (n >= 10000) return (n / 10000).toFixed(0) + '万';
  return n.toLocaleString();
}

module.exports = { fetchAllFeeds };
