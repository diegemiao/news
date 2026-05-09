# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Serverless multi-source news aggregator. GitHub Actions + Node.js, fetches 33 RSS/RSSHub/API feeds twice daily, generates static web page and sends notifications via Feishu/SMTP. Zero server cost.

## Commands

```bash
# Run full pipeline locally
node scripts/main.js

# Open generated page in browser
# Windows: start docs/index.html

# Trigger remote pipeline via GitHub CLI
gh workflow run daily-news.yml --repo diegemiao/news

# Test just the Feishu poll
FEISHU_APP_ID=xxx FEISHU_APP_SECRET=xxx FEISHU_CHAT_ID=xxx \
  node scripts/feishu.js --poll

# Test just the RSS fetcher
node -e "require('./scripts/rss_fetcher')"
```

## Architecture

**Pipeline**: 6-step flow in `main.js`
1. Load config (`feeds.json` + `archive.json`)
2. Fetch all feeds (RSS/RSSHub/API) → `rss_fetcher.js`
3. Deduplicate (GUID → URL → title hash) → `deduplicator.js`
4. Filter: today's articles (24h) always shown; older high-quality (comments≥50, AIHOT score≥70, heat≥10K) within `recency_hours` window retained
5. Generate page + send notifications → `page_generator.js`, `email_sender.js`, `feishu.js`
6. Update archive → `archive_manager.js`

**Shared utilities**: `scripts/utils.js` — `groupByCategory`, `formatTime`, `shortTime`, `truncate`, `stripHtml`, `sanitizeHtml`, `modalHtml`, `wrapParagraphs`, `sleep`. Used by page_generator, email_sender, rss_fetcher.

**Source config**: `data/feeds.json` — user-editable, supports `type: rss|rsshub|api`, `enabled: true|false`, `max_items` per feed. `max_articles_per_feed` defaults to 50. Hot search sources have `max_items: 8`.

**Deduplication**: `data/archive.json` stores 3 keys per article (guid, url, hash) with timestamps, 30-day retention.

**Web page**: Template `templates/page.html`, rendered by `page_generator.js`. Features: category tabs, dark mode, modal popups (`docs/app.js`), timestamp cards, cache-busting (`?v=timestamp` on CSS/JS, `?t=timestamp` on Feishu links).

**Feishu**: `scripts/feishu.js` handles token management, message sending, polling. Bot responds to `123` (push only) and `1234` (push + email). Poll runs every 30 min via `.github/workflows/feishu-poll.yml`, limited to Beijing 10-17 and 19-22 in code. Scheduled push at 9:00-9:30 and 18:00-18:30 triggered by same poll.

**Email**: `scripts/email_sender.js` via nodemailer, SMTP 465. Only sent when `SEND_EMAIL=true` (1234 command or no Feishu configured).

## Key files

| File | Purpose |
|------|---------|
| `scripts/main.js` | Pipeline orchestrator |
| `scripts/rss_fetcher.js` | Feed fetching (RSS/RSSHub/API) |
| `scripts/page_generator.js` | HTML generation + newsData JSON |
| `scripts/feishu.js` | Feishu API (token, send, poll, trigger) |
| `scripts/utils.js` | Shared functions |
| `data/feeds.json` | Source configuration (33 active) |
| `data/archive.json` | Dedup records |
| `docs/index.html` | Generated page (committed for Pages) |
| `docs/app.js` | Tab filtering + modal logic |
| `docs/style.css` | All styles including dark mode |
| `.github/workflows/daily-news.yml` | Main pipeline |
| `.github/workflows/feishu-poll.yml` | Poll + schedule (every 30 min) |

## Important constraints

- User previously rejected skill installations without asking first. Always ask before `npx skills add`.
- User also wants confirmation before changing cron schedules or polling intervals.
- Generated files (`docs/index.html`, `data/archive.json`) are committed and pushed by Actions — they frequently cause merge conflicts with local. Use `git stash && git pull --rebase && git stash pop`, resolve conflicts with `git checkout --theirs` for these files.
- GitHub cron is unreliable — schedules may stop firing. The poll workflow serves as primary scheduler.
- Feishu bot credentials stored as GitHub Secrets. Local dev uses env vars directly.
- Chinese news content, all UI in Chinese.
