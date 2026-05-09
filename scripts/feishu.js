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
    let text = '';
    try { text = JSON.parse(item.body?.content || '{}').text || ''; } catch {}
    // Match commands "123" / "1234"
    if ((text.trim() === '123' || text.trim() === '1234') && item.msg_type === 'text') {
      commands.push({ msgId: item.message_id, text: text.trim() });
    }
  }
  return commands;
}

function isConfigured() {
  return !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.FEISHU_CHAT_ID);
}

async function triggerPipeline(sendEmail) {
  // Use gh CLI with Actions GITHUB_TOKEN (requires actions:write permission in workflow)
  const { execSync } = require('child_process');
  try {
    const args = sendEmail
      ? 'gh workflow run daily-news.yml --repo diegemiao/news -f send_email=true'
      : 'gh workflow run daily-news.yml --repo diegemiao/news';
    execSync(args, { stdio: 'pipe' });
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
    const bj = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const bjHour = bj.getHours();
    const bjMin = bj.getMinutes();
    const bjTime = bjHour * 100 + bjMin;
    const isScheduleTime = (bjTime >= 900 && bjTime < 910) || (bjTime >= 1800 && bjTime < 1810);

    // Check for user commands
    if ((bjHour >= 10 && bjHour < 18) || (bjHour >= 19 && bjHour < 23)) {
      console.log('[飞书] 检查消息...');
      const commands = await pollMessages(chatId);
      if (commands.length > 0) {
        const hasEmail = commands.some(c => c.text === '1234');
        const label = hasEmail ? '收到，推送+邮件…' : '收到，推送中…';
        console.log(`[飞书] 发现 ${commands.length} 条推送指令`);
        await sendText(chatId, label);
        const ok = await triggerPipeline(hasEmail);
        if (!ok) await sendText(chatId, '触发失败，请稍后重试');
        return;
      }
    }

    // Scheduled push
    if (isScheduleTime) {
      console.log('[飞书] 定时推送触发');
      await triggerPipeline(false);
      return;
    }

    console.log(`[飞书] 跳过 (北京${bjHour}点，非轮询/定时窗口)`);
    return;
  }

  console.log('Usage: node scripts/feishu.js --poll | --send-link <url> <label>');
}

if (require.main === module) {
  main().catch(err => { console.error('[飞书] FATAL:', err.message); process.exit(1); });
}

module.exports = { getToken, sendText, sendCard, pollMessages, isConfigured, triggerPipeline };
