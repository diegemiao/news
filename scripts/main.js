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

  // 4. Recency filter + high-discussion override
  console.log('[4/6] 时效过滤...');
  const cutoffTime = new Date(Date.now() - recencyHours * 3600 * 1000);

  // For specific period: morning = since yesterday 18:00, evening = since today 08:00
  const periodStart = isMorning
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const effectiveCutoff = isFirstRun ? cutoffTime : periodStart;

  const displayArticles = (isFirstRun ? articles : newArticles).filter(a => {
    // High-discussion articles: always include regardless of time
    if ((a.comments || 0) >= discussionThreshold) {
      a.high_discussion = true;
      return true;
    }
    // Regular filter: within time window, or no pubDate (assume recent)
    if (!a.published) return true;
    const pubDate = new Date(a.published);
    if (isNaN(pubDate)) return true; // can't parse date, include anyway
    return pubDate >= effectiveCutoff;
  });

  const staleCount = (isFirstRun ? articles : newArticles).length - displayArticles.length;
  const hotCount = displayArticles.filter(a => a.high_discussion).length;
  if (hotCount > 0) console.log(`  高讨论文章例外: ${hotCount} 篇`);
  console.log(`  时效内文章: ${displayArticles.length} 篇 (过滤 ${staleCount} 篇过期)`);

  // 5. Generate outputs
  console.log('[5/6] 生成输出...');
  if (displayArticles.length > 0 || isFirstRun) {
    generatePage(displayArticles, dateStr, isMorning);
    console.log('  网页 → docs/index.html');
    await sendDigestEmail(displayArticles, dateStr, isMorning);
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
  console.log(`  时效内文章: ${displayArticles.length} 篇${hotCount > 0 ? ` (含${hotCount}篇高讨论)` : ''}`);
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
