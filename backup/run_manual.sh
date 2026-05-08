#!/bin/bash
# 手动触发脚本 - GitHub 完全不可用时的备选方案
# 用法: bash backup/run_manual.sh

echo "=== News Digest Manual Run ==="
echo "Make sure you have set environment variables:"
echo "  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_TO"
echo ""

cd "$(dirname "$0")/.."
npm ci --silent 2>/dev/null || npm install --silent
node scripts/main.js

echo ""
echo "Done. Check docs/index.html and docs/email-preview.html"
