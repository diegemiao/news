/**
 * Feishu (Lark) integration module.
 * No dependencies — uses built-in fetch.
 *
 * Env vars: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID, GH_PAT
 */

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET not set');

  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu auth error: ${data.msg}`);

  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire || 7200) * 1000 - 60000; // refresh 1 min early
  return cachedToken;
}

async function sendText(chatId, text) {
  const token = await getToken();
  const res = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text })
      })
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    console.error(`  [飞书] 发送失败: ${data.msg}`);
    return false;
  }
  return true;
}

async function sendCard(chatId, header, elements) {
  const token = await getToken();
  const card = {
    header: { title: { tag: 'plain_text', content: header }, template: 'blue' },
    elements
  };
  const res = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card)
      })
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    console.error(`  [飞书] 卡片发送失败: ${data.msg}`);
    return false;
  }
  return true;
}

async function pollMessages(chatId) {
  const token = await getToken();
  const url = `https://open.feishu.cn/open-apis/im/v1/messages?container_id_type=chat&container_id=${chatId}&page_size=20&sort_type=ByCreateTimeDesc`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.code !== 0) {
    console.error(`[飞书] 拉取消息失败: ${data.msg}`);
    return [];
  }

  const items = data.data?.items || [];
  const commands = [];
  for (const item of items) {
    const body = JSON.parse(item.body?.content || '{}');
    const text = body.text || '';
    // Match command "123"
    if (text.trim() === '123' && item.msg_type === 'text') {
      commands.push({ msgId: item.message_id, text: text.trim() });
    }
  }
  return commands;
}

function isConfigured() {
  return !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.FEISHU_CHAT_ID);
}

async function triggerPipeline() {
  // Use gh CLI with Actions GITHUB_TOKEN (requires actions:write permission in workflow)
  const { execSync } = require('child_process');
  try {
    execSync('gh workflow run daily-news.yml --repo diegemiao/news', { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error(`[飞书] 触发 pipeline 失败: ${e.message}`);
    return false;
  }
}

// --- Main entry point for polling ---
async function main() {
  const cmd = process.argv[2];

  if (cmd === '--send-link') {
    // Called from main.js after news generation
    if (!isConfigured()) return;
    const chatId = process.env.FEISHU_CHAT_ID;
    const url = process.argv[3] || 'https://diegemiao.github.io/news/';
    const label = process.argv[4] || '新闻速递';
    await sendText(chatId, `📰 ${label}\n${url}`);
    console.log('  [飞书] 链接已发送');
    return;
  }

  if (cmd === '--poll') {
    if (!isConfigured()) {
      console.log('[飞书] 未配置凭证，跳过轮询');
      return;
    }
    const chatId = process.env.FEISHU_CHAT_ID;
    console.log('[飞书] 检查消息...');
    const commands = await pollMessages(chatId);
    if (commands.length > 0) {
      console.log(`[飞书] 发现 ${commands.length} 条推送指令`);
      await sendText(chatId, '收到，推送中…');
      const ok = await triggerPipeline();
      if (ok) {
        console.log('[飞书] Pipeline 已触发');
      } else {
        await sendText(chatId, '触发失败，请稍后重试');
      }
    } else {
      console.log('[飞书] 无推送指令');
    }
    return;
  }

  console.log('Usage: node scripts/feishu.js --poll | --send-link <url> <label>');
}

if (require.main === module) {
  main().catch(err => { console.error('[飞书] FATAL:', err.message); process.exit(1); });
}

module.exports = { getToken, sendText, sendCard, pollMessages, isConfigured, triggerPipeline };
