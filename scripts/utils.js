function groupByCategory(articles) {
  const groups = {};
  for (const a of articles) {
    const cat = a.category || '综合';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  }
  return groups;
}

function shortTime(dateStr) {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '--:--';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const yesterday = new Date(today - 86400000);
    if (d >= today) return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
    if (d >= yesterday) return '昨天';
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' });
  } catch { return '--:--'; }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now - d) / 3600000);
    if (diffH < 1) return '刚刚';
    if (diffH < 24) return `${diffH}小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 2) return '昨天';
    if (diffD < 7) return `${diffD}天前`;
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function wrapParagraphs(text) {
  if (!text) return '';
  const parts = text.split(/(?<=[。！？])\s*/);
  if (parts.length <= 2) return `<p>${text}</p>`;
  return parts.filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('');
}

function sanitizeHtml(html) {
  if (!html) return '';
  let out = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const allowed = ['p', 'br', 'strong', 'b', 'em', 'i', 'h3', 'h4', 'h5', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'pre', 'code', 'hr'];
  const keepClosing = new Set(allowed);
  out = out.replace(/<[^>]+>/g, (match) => {
    const m = match.match(/^<\/?(\w+)/);
    if (!m) return '';
    const tag = m[1].toLowerCase();
    if (allowed.includes(tag) && !match.startsWith('</')) {
      const href = match.match(/href\s*=\s*"([^"]*)"/);
      const src = match.match(/src\s*=\s*"([^"]*)"/);
      const alt = match.match(/alt\s*=\s*"([^"]*)"/);
      let clean = '<' + tag;
      if (href) clean += ' href="' + href[1] + '"';
      if (src) clean += ' src="' + src[1] + '"';
      if (alt) clean += ' alt="' + alt[1] + '"';
      clean += tag === 'img' ? ' />' : '>';
      return clean;
    }
    if (keepClosing.has(tag) && match.startsWith('</')) return match;
    return '';
  });
  return out.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { groupByCategory, formatTime, shortTime, truncate, stripHtml, sanitizeHtml, wrapParagraphs, sleep };
