const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { groupByCategory, formatTime } = require('./utils');

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

    if (category === '热搜') {
      // Compact inline pill layout for hot search
      contentHtml += '<div style="line-height:2.2;">';
      for (const a of arts) {
        num++;
        const heat = a.summary ? a.summary.replace('热度 ', '') : '';
        const plat = a.source_name.replace('热搜', '').replace('热榜', '');
        contentHtml += `
          <a href="${a.url}" style="display:inline-block;padding:2px 10px;margin:2px 4px 2px 0;border:1px solid #e4e4e7;border-radius:100px;font-size:12px;color:#18181b;text-decoration:none;background:#fafafa;" target="_blank" rel="noopener">
            <span style="font-size:10px;font-weight:600;color:#2563eb;margin-right:4px;">${plat}</span>${num}. ${a.title}
            ${heat ? `<span style="font-size:10px;color:#dc2626;margin-left:4px;">${heat}</span>` : ''}
          </a>`;
      }
      contentHtml += '</div>';
    } else {
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

module.exports = { sendDigestEmail };
