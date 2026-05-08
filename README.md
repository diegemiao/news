# News Digest — 无服务器多平台新闻推送

每日两次（9:00 / 18:00）自动抓取新闻，生成网页 + 发送邮件摘要。零服务器、零成本。

## 快速开始

```bash
npm install
node scripts/main.js
# 打开 docs/index.html 查看网页
# 打开 docs/email-preview.html 查看邮件预览
```

## 新闻源配置

编辑 `data/feeds.json`，支持三种类型：

| type | 说明 | 示例 |
|---|---|---|
| `rss` | 标准 RSS/Atom | 少数派、36氪 |
| `rsshub` | RSSHub 路由 | 知乎日报、HuggingFace |
| `api` | JSON API | AIHOT、60s热榜 |

```json
{
  "id": "my-feed",
  "name": "我的源",
  "url": "https://example.com/rss",
  "type": "rss",
  "category": "科技",
  "enabled": true,
  "note": "备注"
}
```

## 当前覆盖（23 活跃源）

- **AI** — AIHOT (168源精选)、HuggingFace 论文/博客
- **热搜** — 微博、知乎、百度、抖音、今日头条、B站
- **科技** — Solidot、极客公园、IT之家、V2EX、GitHub、少数派Matrix
- **商业** — 36氪
- **数码** — 少数派
- **时政** — 人民网、中新网
- **体育** — 新浪体育
- **综合** — 知乎日报

## 部署到 GitHub

1. Push 到 GitHub 仓库
2. Settings > Secrets > Actions 添加：
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_TO`
3. Actions 自动每天 9:00 / 18:00 运行
4. GitHub Pages 设为 `docs/` 目录

## Gitee 备选

Gitee 创建仓库镜像 + 开启 Pages → 国内快速访问。
