const fs = require('fs');
const path = require('path');
const { groupByCategory, formatTime } = require('./utils');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');
const DOCS_DIR = path.join(__dirname, '..', 'docs');

function generatePage(articles, dateStr, isMorning = true) {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, 'page.html'), 'utf-8');
  const grouped = groupByCategory(articles);
  const categories = Object.keys(grouped).sort();

  // Tab buttons
  let tabsHtml = categories.map(cat => {
    const count = grouped[cat].length;
    return `<button class="tab" data-cat="${cat}">${cat}<span class="tab-count">${count}</span></button>`;
  }).join('\n    ');

  // Build flat article array matching global numbering
  const newsData = [null]; // 1-indexed
  let num = 0;
  let articlesHtml = '';
  for (const [category, arts] of Object.entries(grouped)) {
    articlesHtml += `<section class="category-section" data-cat="${category}">
      <h2 class="section-title">${category}<span class="section-count">${arts.length} 篇</span></h2>`;

    // Hot search category: compact pill layout
    if (category === '热搜') {
      articlesHtml += '<div class="hot-pills">';
      for (const a of arts) {
        num++;
        newsData[num] = { t: a.title, u: a.url, s: a.source_name, ti: formatTime(a.published), f: a.full_summary || '' };
        const plat = a.source_name.replace('热搜', '').replace('热榜', '');
        articlesHtml += `
          <a onclick="openNewsModal(${num});return false" href="${a.url}" target="_blank" rel="noopener" class="hot-pill">
            <span class="hot-pill-rank">${num}</span>
            <span class="hot-pill-platform">${plat}</span>
            <span class="hot-pill-title">${a.title}</span>
            ${a.summary ? `<span class="hot-pill-heat">${a.summary.replace('热度 ', '')}</span>` : ''}
          </a>`;
      }
      articlesHtml += '</div>';
    } else {
      for (const a of arts) {
        num++;
        newsData[num] = { t: a.title, u: a.url, s: a.source_name, ti: formatTime(a.published), f: a.full_summary || a.summary || '' };
        const badge = a.high_discussion
          ? `<span class="card-badge">精选</span>`
          : (a.quality_score >= 70 ? `<span class="card-badge score">高质</span>` : '');

        articlesHtml += `
        <article class="card" data-cat="${category}">
          <span class="card-num">${num}</span>
          <div class="card-body">
            <div class="card-meta-top">
              <span class="card-source">${a.source_name}</span>
              ${badge}
              <span class="card-time">${formatTime(a.published)}</span>
            </div>
            <h3 class="card-title"><a href="${a.url}" onclick="openNewsModal(${num});return false" rel="noopener">${a.title}</a></h3>
            <p class="card-summary">${a.summary}</p>
          </div>
        </article>`;
      }
    }
    articlesHtml += '</section>';
  }

  const dataJson = JSON.stringify(newsData);

  const version = Date.now().toString(36);
  const html = template
    .replaceAll('{{DATE}}', dateStr)
    .replaceAll('{{PERIOD}}', isMorning ? '早间' : '晚间')
    .replaceAll('{{COUNT}}', articles.length)
    .replaceAll('{{TABS}}', tabsHtml)
    .replaceAll('{{ARTICLES}}', articlesHtml)
    .replaceAll('{{GENERATED_TIME}}', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{NEWS_DATA}}', dataJson);

  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), html, 'utf-8');
  return html;
}

module.exports = { generatePage };
