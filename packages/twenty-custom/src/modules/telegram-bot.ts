// 🤖 Telegram Bot
import TelegramBot, { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { Router, Request, Response } from 'express';
import { graphqlClient } from '../shared/graphql-client';

let bot: TelegramBot | null = null;
let authorizedChatIds: Set<string> = new Set();

function formatCurrency(v: number) {
  return `${v?.toLocaleString?.() || '0'}đ`;
}

function dealsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🆕 Deal mới nhất', callback_data: 'deals:new' }],
      [{ text: '📋 DS Deal theo giai đoạn', callback_data: 'deals:byStage' }],
      [{ text: '🏠 Menu chính', callback_data: 'menu:main' }]
    ]
  } as InlineKeyboardMarkup;
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Báo cáo', callback_data: 'report:today' }, { text: '💼 Deal', callback_data: 'deals:new' }],
      [{ text: '👥 Khách hàng', callback_data: 'contacts:recent' }, { text: '🔔 Thông báo', callback_data: 'notify:setup' }],
      [{ text: '⏰ Báo cáo tự động', callback_data: 'schedule:list' }]
    ]
  } as InlineKeyboardMarkup;
}

async function handleCallback(query: any) {
  if (!bot) return;
  const action = query.data;
  await bot.answerCallbackQuery(query.id);

  if (action === 'menu:main') {
    await bot.sendMessage(query.message.chat.id, '🏠 <b>Menu chính</b>', { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    return;
  }

  if (action === 'deals:new') {
    try {
      const data = await graphqlClient.query(`{ opportunities(first: 5, orderBy: { createdAt: DESC }) { edges { node { id name amount stage { id name } pipelineStage } } } }`);
      const deals = data?.data?.opportunities?.edges || [];
      if (!deals.length) {
        await bot.sendMessage(query.message.chat.id, '📭 Chưa có deal nào.', { reply_markup: mainKeyboard() });
        return;
      }
      let msg = '📋 <b>Deal mới nhất:</b>\n\n';
      deals.forEach((d: any, i: number) => {
        msg += `${i+1}. ${d.node.name} — ${formatCurrency(d.node.amount)}\n   Giai đoạn: ${d.node.stage?.name || d.node.pipelineStage}\n\n`;
      });
      await bot.sendMessage(query.message.chat.id, msg, { parse_mode: 'HTML', reply_markup: dealsKeyboard() });
    } catch (e: any) {
      await bot.sendMessage(query.message.chat.id, `❌ Lỗi: ${e.message}`, { reply_markup: mainKeyboard() });
    }
    return;
  }

  if (action === 'deals:byStage') {
    try {
      const data = await graphqlClient.query(`{ opportunities { edges { node { stage { name } amount } } } }`);
      const deals = data?.data?.opportunities?.edges || [];
      const grouped: Record<string, number[]> = {};
      deals.forEach((d: any) => {
        const s = d.node.stage?.name || 'Không xác định';
        grouped[s] = grouped[s] || [];
        grouped[s].push(d.node.amount);
      });
      let msg = '📊 <b>Deal theo giai đoạn:</b>\n\n';
      Object.entries(grouped).forEach(([stage, amounts]) => {
        const total = amounts.reduce((a, b) => a + b, 0);
        msg += `• ${stage}: ${amounts.length} deal — ${formatCurrency(total)}\n`;
      });
      await bot.sendMessage(query.message.chat.id, msg, { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    } catch (e: any) {
      await bot.sendMessage(query.message.chat.id, `❌ Lỗi: ${e.message}`, { reply_markup: mainKeyboard() });
    }
    return;
  }

  if (action === 'report:today') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await graphqlClient.query(`{ dashboardKpis(period: ${JSON.stringify({ start: today, end: today })} ) { totalRevenue totalDeals totalContacts conversionRate averageOrderValue } }`);
      const kpi = data?.data?.dashboardKpis;
      const msg = `📊 <b>Báo cáo hôm nay</b> (${today})
━━━━━━━━━━━━━━━
💰 Doanh thu: ${formatCurrency(kpi?.totalRevenue)}
📝 Deal mới: ${kpi?.totalDeals || 0}
👥 Khách mới: ${kpi?.totalContacts || 0}
📈 Tỷ lệ chuyển đổi: ${kpi?.conversionRate || 0}%
💵 Giá trị TB đơn: ${formatCurrency(kpi?.averageOrderValue)}
━━━━━━━━━━━━━━━
<i>VinPeti CRM</i>`;
      await bot.sendMessage(query.message.chat.id, msg, { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    } catch (e: any) {
      await bot.sendMessage(query.message.chat.id, `❌ Lỗi: ${e.message}`, { reply_markup: mainKeyboard() });
    }
    return;
  }

  if (action === 'contacts:recent') {
    try {
      const data = await graphqlClient.query(`{ people(first: 5, orderBy: { createdAt: DESC }) { edges { node { id name email phone createdAt } } } }`);
      const contacts = data?.data?.people?.edges || [];
      if (!contacts.length) {
        await bot.sendMessage(query.message.chat.id, '📭 Chưa có khách hàng.', { reply_markup: mainKeyboard() });
        return;
      }
      let msg = '👥 <b>Khách hàng mới:</b>\n\n';
      contacts.forEach((c: any, i: number) => {
        msg += `${i+1}. ${c.node.name} — ${c.node.phone || '—'}\n`;
      });
      await bot.sendMessage(query.message.chat.id, msg, { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    } catch (e: any) {
      await bot.sendMessage(query.message.chat.id, `❌ Lỗi: ${e.message}`, { reply_markup: mainKeyboard() });
    }
    return;
  }

  if (action === 'notify:setup') {
    const chatId = String(query.message.chat.id);
    if (authorizedChatIds.has(chatId)) {
      authorizedChatIds.delete(chatId);
      await bot.sendMessage(query.message.chat.id, '🔕 Đã tắt thông báo.', { reply_markup: mainKeyboard() });
    } else {
      authorizedChatIds.add(chatId);
      await bot.sendMessage(query.message.chat.id, '🔔 Đã bật thông báo. Bạn sẽ nhận báo cáo tự động.', { reply_markup: mainKeyboard() });
    }
    return;
  }

  if (action === 'schedule:list') {
    await bot.sendMessage(query.message.chat.id, '⏰ <b>Báo cáo tự động:</b>\nChưa có lịch. Dùng API /api/telegram/schedule để tạo.', { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    return;
  }
}

export function createTelegramRouter(): Router {
  const router = Router();

  router.post('/init', (req: Request, res: Response) => {
    const { token, allowedChatIds } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    if (bot) bot.stopPolling();
    bot = new TelegramBot(token, { polling: true });

    if (allowedChatIds && Array.isArray(allowedChatIds)) {
      authorizedChatIds = new Set(allowedChatIds.map(String));
    }

    bot.onText(/\/start/, (msg) => {
      bot?.sendMessage(msg.chat.id, '🤖 <b>VinPeti CRM Bot</b>\n\nChào mừng! Dùng menu bên dưới.', { parse_mode: 'HTML', reply_markup: mainKeyboard() });
    });

    bot.onText(/\/help/, (msg) => {
      bot?.sendMessage(msg.chat.id, '📖 <b>Hướng dẫn:</b>\n/deals — Danh sách deal\n/report — Báo cáo hôm nay\n/contacts — Khách mới\n/menu — Menu chính', { parse_mode: 'HTML' });
    });

    bot.onText(/\/deals/, (msg) => {
      bot?.sendMessage(msg.chat.id, '⏳ Đang lấy deal...');
      handleCallback({ data: 'deals:new', message: msg, answerCallbackQuery: (_id: string) => {} });
    });

    bot.onText(/\/report/, (msg) => {
      handleCallback({ data: 'report:today', message: msg, answerCallbackQuery: (_id: string) => {} });
    });

    bot.onText(/\/contacts/, (msg) => {
      handleCallback({ data: 'contacts:recent', message: msg, answerCallbackQuery: (_id: string) => {} });
    });

    bot.onText(/\/menu/, (msg) => {
      bot?.sendMessage(msg.chat.id, '🏠 Menu', { reply_markup: mainKeyboard() });
    });

    bot.on('callback_query', handleCallback);

    res.json({ success: true, message: 'Bot initialized' });
  });

  router.post('/send', async (req: Request, res: Response) => {
    const { chatId, text, parseMode = 'HTML' } = req.body;
    if (!bot || !chatId || !text) return res.status(400).json({ error: 'Bot not initialized or missing params' });
    try {
      const result = await bot.sendMessage(chatId, text, { parse_mode: parseMode });
      res.json({ success: true, messageId: result.message_id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/notify-all', async (req: Request, res: Response) => {
    const { text } = req.body;
    if (!bot || !text) return res.status(400).json({ error: 'Bot not initialized or missing text' });
    const failed: string[] = [];
    for (const cid of authorizedChatIds) {
      try { await bot.sendMessage(cid, text); } catch { failed.push(cid); }
    }
    res.json({ success: true, sentTo: authorizedChatIds.size, failed });
  });

  router.post('/report', async (req: Request, res: Response) => {
    const { chatId, revenue, deals, contacts } = req.body;
    if (!bot || !chatId) return res.status(400).json({ error: 'Bot not initialized' });
    const report = `📊 <b>Báo cáo hôm nay</b>\n━━━━━━━━━━━━━━━\n💰 <b>Doanh thu:</b> ${formatCurrency(revenue)}\n📝 <b>Deal mới:</b> ${deals || 0}\n👥 <b>Khách mới:</b> ${contacts || 0}\n━━━━━━━━━━━━━━━\n<i>VinPeti CRM</i>`;
    try {
      await bot.sendMessage(chatId, report, { parse_mode: 'HTML' });
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.get('/status', (_req: Request, res: Response) => {
    res.json({ initialized: bot !== null, polling: bot?.isPolling() || false, authorizedChats: authorizedChatIds.size });
  });

  router.get('/chats', (_req: Request, res: Response) => {
    res.json({ chatIds: Array.from(authorizedChatIds) });
  });

  return router;
}
