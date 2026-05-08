const fs = require('fs');
const path = require('path');

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

  // Numbered articles by category section
  let num = 0;
  let articlesHtml = '';
  for (const [category, arts] of Object.entries(grouped)) {
    articlesHtml += `<section class="category-section" data-cat="${category}">
      <h2 class="section-title">${category}<span class="section-count">${arts.length} 篇</span></h2>`;

    for (const a of arts) {
      num++;
      const badge = a.high_discussion
        ? `<span class="card-badge">热议</span>`
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
            <h3 class="card-title"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a></h3>
            <p class="card-summary">${a.summary}</p>
          </div>
        </article>`;
    }
    articlesHtml += '</section>';
  }

  const html = template
    .replaceAll('{{DATE}}', dateStr)
    .replaceAll('{{PERIOD}}', isMorning ? '早间' : '晚间')
    .replaceAll('{{COUNT}}', articles.length)
    .replaceAll('{{TABS}}', tabsHtml)
    .replaceAll('{{ARTICLES}}', articlesHtml)
    .replaceAll('{{GENERATED_TIME}}', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), html, 'utf-8');
  return html;
}

function groupByCategory(articles) {
  const groups = {};
  for (const a of articles) {
    const cat = a.category || '综合';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  }
  return groups;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffH < 1) return '刚刚';
    if (diffH < 24) return `${diffH}小时前`;
    if (diffD < 2) return '昨天';
    if (diffD < 7) return `${diffD}天前`;

    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

module.exports = { generatePage };
