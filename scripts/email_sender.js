const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

async function sendDigestEmail(articles, dateStr, isMorning = true) {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, 'email.html'), 'utf-8');
  const grouped = groupByCategory(articles);
  const period = isMorning ? '早间' : '晚间';

  let num = 0;
  let contentHtml = '';
  for (const [category, arts] of Object.entries(grouped)) {
    contentHtml += `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:15px;font-weight:700;color:#18181b;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #e4e4e7;">
          ${category}<span style="font-size:12px;font-weight:400;color:#a1a1aa;margin-left:8px;">${arts.length} 篇</span>
        </h2>`;

    for (const a of arts) {
      num++;
      contentHtml += `
        <div style="padding:12px 0;border-bottom:1px solid #f4f4f5;">
          <div style="font-size:11px;color:#71717a;margin-bottom:4px;">
            <span style="font-weight:600;color:#2563eb;">${a.source_name}</span>
            <span style="margin:0 6px;">&middot;</span>
            <span>${formatTime(a.published)}</span>
          </div>
          <h3 style="font-size:15px;font-weight:600;line-height:1.45;margin:0 0 4px;">
            <a href="${a.url}" style="color:#18181b;text-decoration:none;" target="_blank" rel="noopener">${num}. ${a.title}</a>
          </h3>
          <p style="font-size:13px;color:#71717a;line-height:1.55;margin:0;">${a.summary}</p>
        </div>`;
    }
    contentHtml += '</div>';
  }

  const subject = `${period}新闻速递 | ${dateStr} (${articles.length}篇)`;

  const html = template
    .replaceAll('{{SUBJECT}}', subject)
    .replaceAll('{{DATE}}', dateStr)
    .replaceAll('{{PERIOD}}', period)
    .replaceAll('{{COUNT}}', articles.length)
    .replaceAll('{{CONTENT}}', contentHtml)
    .replaceAll('{{GITHUB_URL}}', process.env.GITHUB_PAGES_URL || 'https://<user>.github.io/news/')
    .replaceAll('{{GITEE_URL}}', process.env.GITEE_PAGES_URL || 'https://<user>.gitee.io/news/');

  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'email-preview.html'), html, 'utf-8');

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.EMAIL_TO || process.env.SMTP_USER,
      subject: subject,
      html: html
    });
    console.log('  Email sent successfully');
  } else {
    console.log('  [DRY RUN] SMTP not configured, email preview saved to docs/email-preview.html');
  }

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

module.exports = { sendDigestEmail };
