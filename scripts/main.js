const { loadFeedsConfig, loadArchive, saveArchive } = require('./config');
const { fetchAllFeeds } = require('./rss_fetcher');
const { filterNewArticles } = require('./deduplicator');
const { pruneArchive } = require('./archive_manager');
const { generatePage } = require('./page_generator');
const { sendDigestEmail } = require('./email_sender');

async function main() {
  const now = new Date();
  const hour = parseInt(process.env.HOUR_OVERRIDE) || now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false });
  const isMorning = hour < 14;
  const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  console.log(`\n=== ${isMorning ? '早间' : '晚间'}新闻速递 | ${dateStr} ===\n`);

  // 1. Load config
  console.log('[1/6] 加载配置...');
  const { feeds, settings } = loadFeedsConfig();
  const archive = loadArchive();
  const isFirstRun = Object.keys(archive.seen || {}).length === 0;
  const recencyHours = settings.recency_hours || 24;
  const discussionThreshold = settings.high_discussion_threshold || 50;

  if (isFirstRun) console.log('  检测到首次运行，本次仅初始化，不发推送');
  console.log(`  已加载 ${feeds.length} 个新闻源，时效窗口: ${recencyHours}h`);

  // 2. Fetch all feeds
  console.log('[2/6] 抓取新闻...');
  const articles = await fetchAllFeeds(feeds, settings);
  console.log(`  共抓取 ${articles.length} 篇文章`);

  // 3. Deduplicate
  console.log('[3/6] 去重...');
  const { newArticles, updatedSeen } = filterNewArticles(articles, archive, isFirstRun);
  console.log(`  新文章: ${newArticles.length} 篇 (过滤掉 ${articles.length - newArticles.length} 篇重复)`);

  // 4. Recency + quality filter
  console.log('[4/6] 时效+质量过滤...');
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const cutoffTime = new Date(Date.now() - recencyHours * 3600 * 1000);

  let qualityCount = 0;
  const displayArticles = articles.filter(a => {
    // Quality signals: high discussion, high AIHOT quality score, high heat
    const isHighQuality = (a.comments || 0) >= discussionThreshold
                       || (a.quality_score || 0) >= 70
                       || (a.comments || 0) >= 10000; // hot trend items

    a.high_discussion = false;

    // No pubDate — assume recent, include
    if (!a.published) return true;
    const pubDate = new Date(a.published);
    if (isNaN(pubDate)) return true;

    // Published within last 24h (today) → always show
    if (pubDate >= oneDayAgo) return true;

    // Older but high quality → show, within recency window
    if (isHighQuality && pubDate >= cutoffTime) {
      a.high_discussion = true;
      qualityCount++;
      return true;
    }

    return false;
  });

  const filteredCount = articles.length - displayArticles.length;
  if (qualityCount > 0) console.log(`  高质量旧文保留: ${qualityCount} 篇`);
  console.log(`  展示文章: ${displayArticles.length} 篇 (过滤 ${filteredCount} 篇过期/低质)`);

  // 5. Generate outputs
  console.log('[5/6] 生成输出...');
  if (displayArticles.length > 0 || isFirstRun) {
    generatePage(displayArticles, dateStr, isMorning);
    console.log('  网页 → docs/index.html');

    // Email: only when explicitly requested (SEND_EMAIL=true or locally without feishu)
    const shouldEmail = process.env.SEND_EMAIL === 'true' || (!process.env.FEISHU_APP_ID && process.env.SMTP_HOST);
    if (shouldEmail) {
      await sendDigestEmail(displayArticles, dateStr, isMorning);
    } else {
      console.log('  [跳过邮件] 仅飞书推送');
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(__dirname, '..', 'docs', 'email-preview.html'), '', 'utf-8');
    }
    // Feishu notification
    try {
      const { sendText, isConfigured } = require('./feishu');
      if (isConfigured()) {
        const label = `${isMorning ? '早间' : '晚间'}新闻速递 | ${dateStr} · ${displayArticles.length}篇`;
        const ts = Date.now().toString(36);
        await sendText(process.env.FEISHU_CHAT_ID, `📰 ${label}\nhttps://diegemiao.github.io/news/?t=${ts}`);
        console.log('  [飞书] 链接已发送');
      }
    } catch (e) { /* feishu not configured — skip */ }
  } else {
    console.log('  无时效内文章，跳过生成');
  }

  // 6. Update archive
  console.log('[6/6] 更新存档...');
  archive.seen = updatedSeen;
  const pruned = pruneArchive(archive, settings.archive_retention_days || 30);
  saveArchive(archive);
  console.log(`  清理 ${pruned} 条过期记录`);

  // Summary
  console.log('\n=== 完成 ===');
  console.log(`  展示文章: ${displayArticles.length} 篇${qualityCount > 0 ? ` (含${qualityCount}篇高质量旧文)` : ''}`);
  console.log(`  网页: docs/index.html`);
  console.log(`  邮件预览: docs/email-preview.html`);

  return displayArticles.length;
}

main().then(count => {
  console.log(`\nNEW_COUNT=${count}`);
  process.exit(0);
}).catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
