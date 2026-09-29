// 📧 Email Marketing
import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { getPublicUrl, getEmailProvider, getEmailApiKey, getFromEmail } from './settings';
import { dataPath, ensureDataDir } from '../shared/data-path';

type SendResult = { success: true; id?: string } | { success: false; error: string };

function isSendError(r: SendResult): r is { success: false; error: string } {
  return !r.success;
}

// ponytail: lazy senders so SDKs only init when their provider selected; Resend new('') throws at import so guard via placeholder
function getResend(): Resend {
  const key = getEmailApiKey();
  return new Resend(key || 're_disabled');
}

const sendgridInstance: { setApiKey(k: string): void; send(d: any, m?: boolean, cb?: any): Promise<any> } | null = null; // ponytail: keep SDK lazy via dynamic import
async function getSendGrid(): Promise<{ send(d: any, m?: boolean, cb?: any): Promise<any> }> {
  const sg = await import('@sendgrid/mail' as any);
  const mail = (sg as any).default || sg;
  mail.setApiKey(getEmailApiKey() || 'sg_disabled');
  return mail;
}

async function sendViaSendoBox(payload: { from: string; to: string; subject: string; html: string }): Promise<SendResult> {
  // SendoBox (heysendo) REST: POST {base}/api/v1/emails, Bearer token. Configurable base via SENDOBOX_API_URL.
  const base = (process.env.SENDOBOX_API_URL || 'https://app.heysendo.com').replace(/\/+$/, '');
  const key = getEmailApiKey();
  if (!key) return { success: false, error: 'SendoBox API key not set' };
  const fromName = payload.from.includes('<') ? payload.from : `VinPeti <${payload.from}>`;
  const toAddr = payload.to.includes('<') ? payload.to.replace(/.*<([^>]+)>.*/, '$1') : payload.to;
  const res = await fetch(`${base}/api/v1/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: fromName, to: toAddr, subject: payload.subject, html: payload.html })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { success: false, error: `SendoBox ${res.status}: ${body || res.statusText}` };
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  const maybeId = (data as Record<string, unknown>)?.id ?? (data as Record<string, unknown>)?.messageId;
  return { success: true, id: typeof maybeId === 'string' ? maybeId : undefined };
}

export async function sendEmail(payload: { from?: string; to: string; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<SendResult> {
  const provider = getEmailProvider();
  const from = payload.from || getFromEmail();
  try {
    if (provider === 'sendgrid') {
      const mail = await getSendGrid();
      const [resp] = await mail.send({
        from, to: payload.to, subject: payload.subject, html: payload.html
      });
      return { success: true, id: resp?.messageId || String(resp?.statusCode || '') };
    }
    if (provider === 'sendobox') {
      return await sendViaSendoBox({ from, to: payload.to, subject: payload.subject, html: payload.html });
    }
    if (provider === 'resend' || !provider) {
      const r = await getResend().emails.send({ from, to: payload.to, subject: payload.subject, html: payload.html, attachments: payload.attachments });
      if (r.error) return { success: false, error: r.error.message || 'Resend error' };
      return { success: true, id: r.data?.id };
    }
    return { success: false, error: `Unknown provider: ${provider}` };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Send failed' };
  }
}
const EMAIL_PERSIST = dataPath('email-events.json');

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  body: string;
  variables: string[];
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  templateId: string;
  recipientEmails: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  sentCount: number;
  openCount: number;
  clickCount: number;
  scheduledAt?: string;
  createdAt: string;
}

interface EmailEvent {
  id: string;
  campaignId: string;
  recipient: string;
  type: 'open' | 'click' | 'unsubscribe';
  link?: string;
  timestamp: string;
}

interface Unsubscriber {
  email: string;
  reason?: string;
  unsubscribedAt: string;
}

const templates: Map<string, EmailTemplate> = new Map();
const campaigns: Map<string, EmailCampaign> = new Map();
const emailEvents: Map<string, EmailEvent> = new Map();
const unsubscribers: Map<string, Unsubscriber> = new Map();
const scheduledJobs: Array<{ campaignId: string; fireAt: string }> = [];

const CAMPAIGN_PERSIST = dataPath('email-campaigns.json');
const TEMPLATE_PERSIST = dataPath('email-templates.json');

function loadEvents() {
  try {
    const data = JSON.parse(require('fs').readFileSync(EMAIL_PERSIST, 'utf-8'));
    Object.entries(data.events || {}).forEach(([k, v]) => emailEvents.set(k, v as EmailEvent));
    Object.entries(data.unsubscribers || {}).forEach(([k, v]) => unsubscribers.set(k, v as Unsubscriber));
  } catch {}
}
function saveEvents() {
  try {
    ensureDataDir();
    require('fs').writeFileSync(EMAIL_PERSIST, JSON.stringify({
      events: Object.fromEntries(emailEvents),
      unsubscribers: Object.fromEntries(unsubscribers)
    }, null, 2));
  } catch {}
}
function loadCampaigns() {
  try {
    const data = JSON.parse(require('fs').readFileSync(CAMPAIGN_PERSIST, 'utf-8'));
    Object.entries(data.campaigns || {}).forEach(([k, v]) => campaigns.set(k, v as EmailCampaign));
    (data.scheduledJobs || []).forEach((j: { campaignId: string; fireAt: string }) => scheduledJobs.push(j));
  } catch {}
}
function saveCampaigns() {
  try {
    ensureDataDir();
    require('fs').writeFileSync(CAMPAIGN_PERSIST, JSON.stringify({
      campaigns: Object.fromEntries(campaigns),
      scheduledJobs
    }, null, 2));
  } catch {}
}
function loadTemplates() {
  try {
    const data = JSON.parse(require('fs').readFileSync(TEMPLATE_PERSIST, 'utf-8'));
    Object.entries(data || {}).forEach(([k, v]) => templates.set(k, v as EmailTemplate));
  } catch {}
}
function saveTemplates() {
  try {
    ensureDataDir();
    const custom = Array.from(templates.values()).filter(t => !t.id.startsWith('tpl_welcome') && !t.id.startsWith('tpl_reminder') && !t.id.startsWith('tpl_promotion'));
    require('fs').writeFileSync(TEMPLATE_PERSIST, JSON.stringify(Object.fromEntries(custom.map(t => [t.id, t])), null, 2));
  } catch {}
}
loadEvents();

const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl_welcome',
    name: 'Chào mừng khách mới',
    subject: 'Chào mừng {{ten}} đến với {{cong_ty}}!',
    category: 'Chào mừng',
    body: `<h2>Chào mừng {{ten}}!</h2>
<p>Cảm ơn bạn đã đăng ký dùng thử <strong>{{cong_ty}}</strong>.</p>
<p>Trong vòng <strong>24 giờ</strong>, tôi sẽ liên hệ với bạn để tư vấn chi tiết.</p>
<p>Trong khi chờ đợi, bạn có thể chuẩn bị các thông tin sau:</p>
<ul>
  <li>Số lượng khách hàng hiện tại / tháng</li>
  <li>Quy trình quản lý hiện tại</li>
  <li>Vấn đề tốn thời gian nhất bạn muốn giải quyết</li>
</ul>
<p>— BS. Phan Hữu Nghị<br>VinPeti - Phần mềm quản lý phòng khám thú y với AI</p>`,
    variables: ['ten', 'cong_ty']
  },
  {
    id: 'tpl_ebook_ai_bsty',
    name: 'Ebook AI BSTY',
    subject: 'Ebook "AI Trong Thực Hành Lâm Sàng Thú Y" — Link tải',
    category: 'Lead Magnet',
    body: `<h2>Chào {{ten}},</h2>
<p>Cảm ơn bạn đã đăng ký nhận ebook <strong>"AI Trong Thực Hành Lâm Sàng Thú Y"</strong> của BS. Phan Hữu Nghị.</p>
<p><strong>Link tải ebook:</strong><br><a href="{{link_tai}}" style="background:#1e293b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Tải Ebook Miễn Phí</a></p>
<p>Ebook gồm 17 chương: framework ứng dụng AI vào chẩn đoán, điều trị và quản lý phòng khám thú y, kèm case study thực tế.</p>
<p>Mọi thắc mắc vui lòng trả lời email này hoặc liên hệ: <strong>phanhuunghi@gmail.com</strong></p>
<p>Trân trọng,<br>BS. Phan Hữu Nghị</p>`,
    variables: ['ten', 'link_tai']
  },
  {
    id: 'tpl_reminder',
    name: 'Nhắc lịch hẹn',
    subject: 'Nhắc lịch: {{noi_dung}}',
    category: 'Nhắc nhở',
    body: `<p>Xin chào {{ten}},</p>
<p>Nhắc bạn lịch {{noi_dung}} vào lúc {{thoi_gian}}.</p>
<p>Vui lòng xác nhận hoặc đổi lịch nếu cần.</p>`,
    variables: ['ten', 'noi_dung', 'thoi_gian']
  },
  {
    id: 'tpl_promotion',
    name: 'Khuyến mãi',
    subject: '🔥 {{ten_khuyen_mai}} - Giảm {{phan_tram}}%',
    category: 'Marketing',
    body: `<h2>{{ten_khuyen_mai}}</h2>
<p>Giảm <strong>{{phan_tram}}%</strong> cho {{san_pham}}.</p>
<p>Mã: <code>{{ma_km}}</code></p>`,
    variables: ['ten_khuyen_mai', 'phan_tram', 'san_pham', 'ma_km']
  },
  {
    id: 'tpl_b2b_followup',
    name: 'B2B ngày 2 - follow up',
    subject: 'Bạn đã sẵn sàng quản lý phòng khám tốt hơn?',
    category: 'B2B Nurture',
    body: `<h2>Chào {{ten}},</h2>
<p>Hôm qua bạn đăng ký tìm hiểu <strong>VinPeti</strong>. Cảm ơn bạn!</p>
<p>Đa số phòng khám thú y gặp 3 vấn đề:</p>
<ul>
  <li>Sổ tay ghi lộn, mất lịch tiêm chủng</li>
  <li>Khó追 công nợ khách</li>
  <li>Không biết tháng nào lời lãi bao nhiêu</li>
</ul>
<p>VinPeti giải quyết cả 3 trong một bảng điều khiển duy nhất.</p>
<p>Trả lời email này nếu bạn muốn xem demo 15 phút.</p>
<p>— BS. Phan Hữu Nghị<br>VinPeti</p>`,
    variables: ['ten']
  },
  {
    id: 'tpl_b2b_case',
    name: 'B2B ngày 3 - case study',
    subject: 'Phòng khám X tiết kiệm 10h/tuần với VinPeti',
    category: 'B2B Nurture',
    body: `<h2>Case study: Phòng khám Thú Y An Thú</h2>
<p>Chào {{ten}},</p>
<p>An Thú (Quận 7, TP.HCM) dùng VinPeti 3 tháng:</p>
<ul>
  <li>Tiết kiệm <strong>10 giờ/tuần</strong> sổ sách tay</li>
  <li>Giảm 80% quên lịch tiêm nhắc lại</li>
  <li>Biết chính xác lợi nhuận từng dịch vụ</li>
</ul>
<p>Họ bắt đầu với gói 6tr/tháng, hoàn vốn trong 2 tuần.</p>
<p>— BS. Phan Hữu Nghị<br>VinPeti</p>`,
    variables: ['ten']
  },
  {
    id: 'tpl_b2b_demo',
    name: 'B2B ngày 7 - mời demo',
    subject: '15 phút demo - thấy ngay lợi ích',
    category: 'B2B Nurture',
    body: `<h2>Demo 15 phút miễn phí</h2>
<p>Chào {{ten}},</p>
<p>15 phút đủ để bạn thấy:</p>
<ul>
  <li>Cách nhập 1 bệnh án trong 30 giây</li>
  <li>Nhắc lịch tiêm tự động qua Zalo/Telegram</li>
  <li>Báo cáo doanh thu/lợi nhuận 1 click</li>
</ul>
<p>Chọn khung giờ phù hợp, tôi gọi cho bạn:</p>
<p><a href="https://calendly.com/vinpeti">Đặt lịch demo</a></p>
<p>— BS. Phan Hữu Nghị<br>VinPeti</p>`,
    variables: ['ten']
  },
  {
    id: 'tpl_b2b_offer',
    name: 'B2B ngày 14 - ưu đãi',
    subject: 'Ưu đãi dùng thử 30 ngày - chỉ tuần này',
    category: 'B2B Nurture',
    body: `<h2>Ưu đãi dùng thử 30 ngày miễn phí</h2>
<p>Chào {{ten}},</p>
<p>Chỉ tuần này, VinPeti tặng:</p>
<ul>
  <li><strong>30 ngày dùng thử miễn phí</strong> (không cần thẻ)</li>
  <li>Migrate dữ liệu cũ sang miễn phí</li>
  <li>1:1 onboarding qua video call</li>
</ul>
<p>Sau 30 ngày, bạn quyết định tiếp hay không. Không ai đòi tiền.</p>
<p>Trả lời "OK" để bắt đầu.</p>
<p>— BS. Phan Hữu Nghị<br>VinPeti</p>`,
    variables: ['ten']
  }
];

// Seed built-in templates, then load persisted custom templates + campaigns
BUILTIN_TEMPLATES.forEach(t => templates.set(t.id, t));
loadTemplates();
loadCampaigns();

export async function sendTemplatedEmail(
  templateId: string,
  to: string,
  variables: Record<string, string> = {}
): Promise<{ success: true; to: string } | { success: false; error: string }> {
  const tpl = templates.get(templateId);
  if (!tpl) return { success: false, error: 'Template not found' };
  const subject = tpl.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? '');
  const body = tpl.body.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? '');
  const result = await sendEmail({ to, subject, html: body });
  if (isSendError(result)) return { success: false, error: result.error };
  return { success: true, to };
}

export function listTemplates() {
  return Array.from(templates.values());
}

export function getTemplate(id: string): EmailTemplate | undefined {
  return templates.get(id);
}

export function createTemplate(input: { name: string; subject?: string; body: string; category?: string }): EmailTemplate | { error: string } {
  if (!input.name) return { error: 'Name required' };
  const id = `tpl_${Date.now()}`;
  const variables = (input.body.match(/\{\{(\w+)\}\}/g) || []).map((v: string) => v.replace(/\{|\}/g, ''));
  const tpl: EmailTemplate = {
    id, name: input.name, subject: input.subject || input.name,
    category: input.category || 'Custom', body: input.body, variables
  };
  templates.set(id, tpl);
  saveTemplates();
  return tpl;
}

export function listCampaigns(): EmailCampaign[] {
  return Array.from(campaigns.values());
}

export function getCampaign(id: string): EmailCampaign | undefined {
  return campaigns.get(id);
}

export function createCampaign(input: { name: string; subject: string; templateId?: string; recipientEmails: string[]; scheduledAt?: string }): EmailCampaign | { error: string } {
  if (!input.name || !input.subject) return { error: 'Name and subject required' };
  const id = `camp_${Date.now()}`;
  const campaign: EmailCampaign = {
    id, name: input.name, subject: input.subject, templateId: input.templateId || '',
    recipientEmails: input.recipientEmails || [],
    status: input.scheduledAt ? 'scheduled' : 'draft', sentCount: 0, openCount: 0, clickCount: 0,
    createdAt: new Date().toISOString(),
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {})
  };
  campaigns.set(id, campaign);
  if (input.scheduledAt) scheduledJobs.push({ campaignId: id, fireAt: input.scheduledAt });
  saveCampaigns();
  return campaign;
}

export async function sendCampaignById(id: string): Promise<{ sent: number; skipped: number; total: number } | { error: string }> {
  const campaign = campaigns.get(id);
  if (!campaign) return { error: 'Campaign not found' };
  try {
    return await sendCampaign(campaign);
  } catch (error: any) {
    return { error: error.message || 'Failed to send campaign' };
  }
}

export function emailStats() {
  const totals = Array.from(campaigns.values()).reduce((acc, c) => ({
    totalCampaigns: acc.totalCampaigns + 1,
    totalSent: acc.totalSent + c.sentCount,
    totalOpens: acc.totalOpens + c.openCount,
    totalClicks: acc.totalClicks + c.clickCount,
  }), { totalCampaigns: 0, totalSent: 0, totalOpens: 0, totalClicks: 0 });
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
  return {
    ...totals,
    totalUnsubscribers: unsubscribers.size,
    scheduledCount: scheduledJobs.length,
    openRate: pct(totals.totalOpens, totals.totalSent),
    clickRate: pct(totals.totalClicks, totals.totalSent),
  };
}

export function listUnsubscribers(): Unsubscriber[] {
  return Array.from(unsubscribers.values());
}

export function getEmailProviderInfo(): { provider: string; hasApiKey: boolean; fromEmail: string } {
  return { provider: getEmailProvider() || 'resend', hasApiKey: !!getEmailApiKey(), fromEmail: getFromEmail() };
}

export async function testEmailProvider(to: string): Promise<{ success: true; provider: string; id?: string } | { success: false; error: string; provider?: string }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { success: false, error: 'Valid email required' };
  if (!getEmailApiKey()) return { success: false, error: 'API key not set (Settings > Email)' };
  const provider = getEmailProvider() || 'resend';
  const result = await sendEmail({
    to, subject: `[VinPeti] Test ket noi ${provider}`,
    html: `<p>Test thanh cong qua <strong>${provider}</strong>.</p><p>VinPeti CRM</p>`
  });
  if (isSendError(result)) return { success: false, error: result.error, provider };
  return { success: true, provider, id: result.id };
}

export async function sendWelcomeEmail(name: string, email: string, clinic?: string) {
  const tpl = templates.get('tpl_welcome');
  if (!tpl) return { success: false as const, error: 'Template not found' };

  const subject = tpl.subject
    .replace(/\{\{ten\}\}/g, name || 'Bạn')
    .replace(/\{\{cong_ty\}\}/g, clinic || 'VinPeti');

  const body = tpl.body
    .replace(/\{\{ten\}\}/g, name || 'Bạn')
    .replace(/\{\{cong_ty\}\}/g, clinic || 'VinPeti');

  try {
    const result = await sendEmail({ to: email, subject, html: body });
    if (isSendError(result)) {
      console.error('[EMAIL_WELCOME] Failed:', result.error);
      return { success: false as const, error: result.error };
    }
    console.log(`[EMAIL_WELCOME] To: ${email} | Subject: ${subject}`);

    const welcomeCampaign: EmailCampaign = {
      id: `camp_welcome_${Date.now()}`,
      name: `Welcome: ${name}`,
      subject,
      templateId: tpl.id,
      recipientEmails: [email],
      status: 'sent',
      sentCount: 1,
      openCount: 0,
      clickCount: 0,
      createdAt: new Date().toISOString()
    };
    campaigns.set(welcomeCampaign.id, welcomeCampaign);

    return { success: true as const, to: email, subject, body, data: result.id };
  } catch (error: any) {
    console.error('[EMAIL_WELCOME] Failed:', error);
    return { success: false as const, error: error.message || 'Failed to send email' };
  }
}

function renderForRecipient(campaign: EmailCampaign, recipient: string): string {
  const tpl = campaign.templateId ? templates.get(campaign.templateId) : null;
  let html = tpl ? tpl.body : `<p>${campaign.name}</p>`;
  const enc = encodeURIComponent(recipient);
  const pub = getPublicUrl();
  const pixel = `<img src="${pub}/api/email/tracks/open/${campaign.id}/${enc}" width="1" height="1" style="display:none" alt="" />`;
  const unsub = `<p style="font-size:12px;color:#888;margin-top:24px">Không muốn nhận email? <a href="${pub}/api/email/unsubscribe/${enc}">Hủy đăng ký</a></p>`;
  return `${html}${pixel}${unsub}`;
}

async function sendCampaign(campaign: EmailCampaign): Promise<{ sent: number; skipped: number; total: number }> {
  campaign.status = 'sending';
  const recipients = campaign.recipientEmails.filter(e => !unsubscribers.has(e));
  const skipped = campaign.recipientEmails.length - recipients.length;
  let sent = 0;
  try {
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(to => sendEmail({
        to,
        subject: campaign.subject,
        html: renderForRecipient(campaign, to)
      })));
      sent += results.filter(r => r.success).length;
      campaign.sentCount = sent;
    }
    campaign.status = 'sent';
  } catch (error) {
    campaign.status = 'failed';
    throw error;
  } finally {
    campaigns.set(campaign.id, campaign);
    saveCampaigns();
  }
  return { sent, skipped, total: campaign.recipientEmails.length };
}

// Scheduler tick: send due scheduled campaigns
setInterval(() => {
  const now = Date.now();
  const due = scheduledJobs.filter(j => new Date(j.fireAt).getTime() <= now);
  due.forEach(async (job) => {
    const idx = scheduledJobs.indexOf(job);
    if (idx >= 0) scheduledJobs.splice(idx, 1);
    const campaign = campaigns.get(job.campaignId);
    if (campaign && campaign.status === 'scheduled') {
      try { await sendCampaign(campaign); } catch (e) { console.error('[EMAIL_SCHEDULER]', e); }
    }
  });
  if (due.length) saveCampaigns();
}, 60_000);

export function createEmailRouter(): Router {
  const router = Router();
  // Templates
  router.get('/templates', (_req: Request, res: Response) => {
    res.json(listTemplates());
  });

  router.post('/templates', (req: Request, res: Response) => {
    const result = createTemplate(req.body);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  router.get('/templates/:id', (req: Request, res: Response) => {
    const tpl = getTemplate(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Not found' });
    res.json(tpl);
  });

  // Campaigns
  router.get('/campaigns', (_req: Request, res: Response) => {
    res.json(listCampaigns());
  });

  router.post('/campaigns', (req: Request, res: Response) => {
    const result = createCampaign(req.body);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  // Send campaign
  router.post('/campaigns/:id/send', async (req: Request, res: Response) => {
    const result = await sendCampaignById(req.params.id);
    if ('error' in result) return res.status(500).json({ error: result.error });
    res.json({ success: true, ...result });
  });

  // Open tracking pixel
  router.get('/tracks/open/:campaignId/:recipient', (req: Request, res: Response) => {
    const { campaignId, recipient } = req.params;
    const evt: EmailEvent = {
      id: `evt_${Date.now()}`,
      campaignId,
      recipient: decodeURIComponent(recipient),
      type: 'open',
      timestamp: new Date().toISOString()
    };
    emailEvents.set(evt.id, evt);
    saveEvents();

    const camp = campaigns.get(campaignId);
    if (camp) {
      camp.openCount++;
      campaigns.set(campaignId, camp);
      saveCampaigns();
    }

    res.set('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAEALAAAAAABAAEAAAICRAEAOw==', 'base64'));
  });

  // Click tracking
  router.get('/tracks/click/:campaignId/:recipient', (req: Request, res: Response) => {
    const { campaignId, recipient } = req.params;
    const target = req.query.url || '';
    const evt: EmailEvent = {
      id: `evt_${Date.now()}`,
      campaignId,
      recipient: decodeURIComponent(recipient),
      type: 'click',
      link: String(target),
      timestamp: new Date().toISOString()
    };
    emailEvents.set(evt.id, evt);
    saveEvents();

    const camp = campaigns.get(campaignId);
    if (camp) {
      camp.clickCount++;
      campaigns.set(campaignId, camp);
      saveCampaigns();
    }

    res.redirect(String(target));
  });

  // Unsubscribe
  router.get('/unsubscribe/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    const email = decodeURIComponent(token);
    if (!email) return res.status(400).send('Thông tin không hợp lệ.');

    unsubscribers.set(email, { email, unsubscribedAt: new Date().toISOString() });
    saveEvents();
    res.send('<h2>Bạn đã hủy đăng ký thành công.</h2><p>Không còn nhận email từ VinPeti.</p>');
  });

  router.get('/unsubscribers', (_req: Request, res: Response) => {
    res.json(listUnsubscribers());
  });

  // Email provider connection: config via /api/settings/email, test send here
  router.get('/provider', (_req: Request, res: Response) => {
    res.json(getEmailProviderInfo());
  });

  router.post('/provider/test', async (req: Request, res: Response) => {
    const result = await testEmailProvider(req.body.to);
    if (!result.success) {
      const r = result as { success: false; error: string };
      res.status(500).json({ error: r.error, provider: result.provider });
    }
    else res.json({ success: true, provider: result.provider, id: result.id });
  });

  // Send welcome email to a new lead
  router.post('/send/welcome', async (req: Request, res: Response) => {
    const { name, email, clinic } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await sendWelcomeEmail(name, email, clinic);
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ success: true, to: email, id: result.data });
  });

  // Marketing stats
  router.get('/stats', (_req: Request, res: Response) => {
    res.json(emailStats());
  });

  return router;
}
