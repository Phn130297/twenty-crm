// Landing Page Builder — real responsive templates
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { fireEvent } from '../modules/workflow-automation';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dataPath } from '../shared/data-path';
import { getPublicUrl } from './settings';
import { sendEmail } from '../modules/email-marketing';

type LandingPageData = {
  id: string;
  name: string;
  slug: string;
  title: string;
  brief: string;
  presetId: string;
  customHtml: string | null;
  published: boolean;
  publishedUrl: string;
  createdAt: string;
  crmId?: string;
};

interface RegistrationEntry {
  name: string;
  phone: string;
  email: string;
  clinic: string;
  source: string;
  tag?: string;
  timestamp: string;
  ip: string;
  twentyContactId: string | null;
  twentyDealId: string | null;
  status: 'received' | 'syncing' | 'synced' | 'contact_only' | 'local_only' | 'queued';
  error?: string;
}

const DATA_DIR = process.env.VERCEL ? '/tmp/data' : './data';
const PERSIST_FILE = DATA_DIR + '/landing-pages.json';
const landingPages = new Map<string, LandingPageData>();
const pendingQueue: RegistrationEntry[] = [];

function loadLandingPages() {
  if (!existsSync(PERSIST_FILE)) return;
  try {
    const data = JSON.parse(readFileSync(PERSIST_FILE, 'utf-8'));
    for (const [k, v] of Object.entries(data)) landingPages.set(k, v as LandingPageData);
  } catch {}
}
function saveLandingPages() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PERSIST_FILE, JSON.stringify(Object.fromEntries(landingPages), null, 2));
}
loadLandingPages();

function buildHtml(preset: string, title: string, brief: string): string {
  const desc = brief || 'Đăng ký ngay để nhận ưu đãi độc quyền';
  const apiUrl = '/api/landing';

  if (preset === 'ebook-ai-bsty') {
    const staticFile = __dirname + '/../../public/lp/ebook-ai-bsty/index.html';
    if (existsSync(staticFile)) return readFileSync(staticFile, 'utf-8');
    // fallback: simple purple form
    const t = title || 'Ebook';
    const d = desc || 'Đăng ký để nhận ebook';
    return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + t + '</title><style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}'
      + 'body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}'
      + '.card{background:#fff;border-radius:16px;padding:32px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}'
      + 'h1{font-size:1.5rem;color:#333;margin-bottom:8px}p{color:#666;margin-bottom:20px;line-height:1.6}'
      + 'input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:1rem;margin-bottom:10px}'
      + 'button{width:100%;padding:14px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}'
      + '</style></head><body><div class="card"><h1>' + t + '</h1><p>' + d + '</p>'
      + '<form id="f"><input id="name" placeholder="Họ tên *" required><input id="phone" placeholder="SĐT *" type="tel" required pattern="^[0-9]{9,11}$">'
      + '<input id="email" placeholder="Email" type="email"><button type="submit">Đăng ký</button></form>'
      + '<script>var API="' + apiUrl + '";var f=document.getElementById("f");'
      + 'f.onsubmit=function(ev){ev.preventDefault();'
      + 'fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById("name").value,phone:document.getElementById("phone").value,email:document.getElementById("email").value})})'
      + '.then(function(r){return r.json()}).then(function(d){if(d.success){f.innerHTML="<h2>Đăng ký thành công!</h2>"}})'
      + '};</script></div></body></html>';
  }

  if (preset === 'sale-v5') {
    return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + title + '</title><meta name="description" content="' + desc + '">'
      + '<meta property="og:title" content="' + title + '"><meta property="og:description" content="' + desc + '">'
      + '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}'
      + '.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}'
      + '.card{background:#fff;border-radius:16px;padding:32px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}'
      + 'h1{font-size:1.75rem;color:#333;margin-bottom:8px}p.sub{color:#666;margin-bottom:24px;line-height:1.6}'
      + 'input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:1rem;margin-bottom:12px;transition:.2s}'
      + 'input:focus{outline:none;border-color:#667eea}'
      + 'button{width:100%;padding:14px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-size:1.05rem;font-weight:600;cursor:pointer;transition:.2s}'
      + 'button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(102,126,234,.4)}'
      + '.err{color:#e74c3c;font-size:.85rem;margin-top:-8px;margin-bottom:8px;display:none}'
      + '@media(max-width:480px){.card{padding:24px}h1{font-size:1.4rem}}</style></head><body>'
      + '<div class="hero"><div class="card">'
      + '<h1>' + title + '</h1><p class="sub">' + (brief || desc) + '</p>'
      + '<form id="f"><input id="name" placeholder="Họ tên *" required><input id="phone" placeholder="Số điện thoại *" type="tel" required pattern="^[0-9]{9,11}$">'
      + '<input id="email" placeholder="Email" type="email"><input id="clinic" placeholder="Phòng khám / Cơ sở">'
      + '<p class="err" id="err"></p><button type="submit">Đăng ký ngay</button></form></div></div>'
      + '<script>var API="' + apiUrl + '";var f=document.getElementById("f");var e=document.getElementById("err");'
      + 'f.onsubmit=function(ev){ev.preventDefault();e.style.display="none";'
      + 'var n=document.getElementById("name").value.trim(),p=document.getElementById("phone").value.trim();'
      + 'if(!n||!p||!/^[0-9]{9,11}$/.test(p)){e.textContent="Vui lòng nhập họ tên và SĐT hợp lệ (9-11 số)";e.style.display="block";return}'
      + 'fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,phone:p,email:document.getElementById("email").value.trim(),clinic:document.getElementById("clinic").value.trim()})})'
      + '.then(function(r){return r.json()}).then(function(d){'
      + 'if(d.success){f.innerHTML="<div style=text-align:center;padding:20px><h2>Đăng ký thành công!</h2><p>Chúng tôi sẽ liên hệ sớm.</p></div>"}'
      + 'else{e.textContent=d.error||"Có lỗi xảy ra";e.style.display="block"}'
      + '}).catch(function(){e.textContent="Lỗi kết nối";e.style.display="block"})};</script></body></html>';
  }

  if (preset === 'lead-v5') {
    return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + title + '</title><meta name="description" content="' + desc + '">'
      + '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}'
      + '.hero{min-height:100vh;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;padding:20px}'
      + '.card{max-width:500px;width:100%}h1{font-size:2rem;margin-bottom:16px}p.lead{color:#94a3b8;margin-bottom:32px;line-height:1.7}'
      + '.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}'
      + 'input{width:100%;padding:14px 16px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#fff;font-size:1rem}'
      + 'input:focus{outline:none;border-color:#667eea}button{width:100%;padding:16px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:700;cursor:pointer;margin-top:16px}'
      + 'button:hover{background:#5a67d8}.ok{color:#22c55e;text-align:center;padding:40px 0;display:none}'
      + '@media(max-width:480px){.form-row{grid-template-columns:1fr}h1{font-size:1.5rem}}</style></head><body>'
      + '<div class="hero"><div class="card">'
      + '<h1>' + title + '</h1><p class="lead">' + (brief || desc) + '</p>'
      + '<form id="f"><div class="form-row"><input id="name" placeholder="Họ tên *" required><input id="phone" placeholder="SĐT *" type="tel" required></div>'
      + '<input id="email" placeholder="Email" type="email"><input id="clinic" placeholder="Phòng khám">'
      + '<p class="ok" id="ok">Đăng ký thành công!</p><button type="submit">Nhận ưa đãi</button></form></div></div>'
      + '<script>var API="' + apiUrl + '";var f=document.getElementById("f");var o=document.getElementById("ok");'
      + 'f.onsubmit=function(ev){ev.preventDefault();'
      + 'fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById("name").value,phone:document.getElementById("phone").value,email:document.getElementById("email").value,clinic:document.getElementById("clinic").value})})'
      + '.then(function(r){return r.json()}).then(function(d){'
      + 'if(d.success){f.style.display="none";o.style.display="block"}else{alert(d.error||"Loi")}'
      + '}).catch(function(){alert("Loi")})};</script></body></html>';
  }

  // service-pro default
  return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + title + '</title><meta name="description" content="' + desc + '">'
    + '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}'
    + 'body{background:#f8fafc;color:#1e293b}.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}'
    + '.card{background:#fff;border-radius:12px;padding:40px;max-width:480px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.08)}'
    + '.badge{display:inline-block;background:#dbeafe;color:#1d4ed8;padding:6px 14px;border-radius:20px;font-size:.85rem;font-weight:600;margin-bottom:16px}'
    + 'h1{font-size:1.8rem;margin-bottom:8px}p{color:#64748b;line-height:1.7;margin-bottom:24px}'
    + 'input{width:100%;padding:14px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;margin-bottom:12px}'
    + 'input:focus{outline:none;border-color:#3b82f6}'
    + 'button{width:100%;padding:14px;background:#1e293b;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}'
    + 'button:hover{background:#334155}.msg{text-align:center;padding:20px;display:none}.ok{color:#16a34a}'
    + '@media(max-width:480px){.card{padding:24px}}</style></head><body>'
    + '<div class="wrap"><div class="card">'
    + '<span class="badge">Dịch vụ Pro</span>'
    + '<h1>' + title + '</h1><p>' + (brief || desc) + '</p>'
    + '<form id="f"><input id="name" placeholder="Họ tên *" required><input id="phone" placeholder="SĐT *" type="tel" required>'
    + '<input id="email" placeholder="Email" type="email"><input id="clinic" placeholder="Phòng khám">'
    + '<p class="msg ok" id="ok">Đăng ký thành công! Chúng tôi sẽ liên hệ bạn.</p>'
    + '<button type="submit">Đăng ký</button></form></div></div>'
    + '<script>var API="' + apiUrl + '";var f=document.getElementById("f");var o=document.getElementById("ok");'
    + 'f.onsubmit=function(ev){ev.preventDefault();'
    + 'fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById("name").value,phone:document.getElementById("phone").value,email:document.getElementById("email").value,clinic:document.getElementById("clinic").value})})'
    + '.then(function(r){return r.json()}).then(function(d){'
    + 'if(d.success){f.style.display="none";o.style.display="block"}else{alert(d.error||"Loi")}'
    + '}).catch(function(){alert("Loi")})};</script></body></html>';
}

const PRESETS: Record<string, { name: string; presetId: string }> = {
  'ebook-ai-bsty': { name: 'Ebook AI BSTY', presetId: 'ebook-ai-bsty' },
  'sale-v5': { name: 'Bán hàng V5', presetId: 'sale-v5' },
  'lead-v5': { name: 'Thu thập Lead V5', presetId: 'lead-v5' },
  'service-pro': { name: 'Dịch vụ Pro', presetId: 'service-pro' }
};

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const APP_SECRET = process.env.TWENTY_APP_SECRET || 'replace_me_with_a_random_string';
const WORKSPACE_ID = process.env.TWENTY_WORKSPACE_ID || 'df39adb9-e73a-446a-83f9-59d443216526';
const API_KEY_ID = process.env.TWENTY_API_KEY_ID || '1afeb524-0d80-4d8c-adfd-384d8f789398';

function getCrmToken(): string {
  const key = createHash('sha256').update(`${APP_SECRET}${WORKSPACE_ID}API_KEY`).digest('hex');
  return jwt.sign(
    { sub: WORKSPACE_ID, type: 'API_KEY', workspaceId: WORKSPACE_ID, jti: API_KEY_ID },
    key, { algorithm: 'HS256', expiresIn: '100y' }
  );
}

const CRM_URL = process.env.TWENTY_URL || 'http://localhost:3000';

async function syncToCrm(page: LandingPageData): Promise<string | undefined> {
  try {
    const token = getCrmToken();
    if (page.crmId) {
      const r = await axios.post(`${CRM_URL}/graphql`, {
        query: 'mutation($id:ID!,$data:LandingPageUpdateInput!){updateLandingPage(id:$id,data:$data){id lpSlug}}',
        variables: { id: page.crmId, data: { lpTitle: page.title, lpBrief: page.brief, lpPresetId: page.presetId, lpCustomHtml: page.customHtml || '', lpSlug: page.slug, lpPublished: page.published, lpPublishedUrl: page.publishedUrl, lpSubmissions: 0, name: page.name, slug: page.slug } }
      }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      return r.data.data?.updateLandingPage?.id;
    }
    const r = await axios.post(`${CRM_URL}/graphql`, {
      query: 'mutation($data:LandingPageCreateInput!){createLandingPage(data:$data){id lpSlug}}',
      variables: { data: { lpSlug: page.slug, lpTitle: page.title, lpBrief: page.brief, lpPresetId: page.presetId, lpCustomHtml: page.customHtml || '', lpPublished: page.published, lpPublishedUrl: page.publishedUrl, lpSubmissions: 0, name: page.name, slug: page.slug } }
    }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    return r.data.data?.createLandingPage?.id;
  } catch (err) {
    console.error('CRM sync error:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function deleteFromCrm(crmId?: string): Promise<boolean> {
  if (!crmId) return true;
  try {
    const token = getCrmToken();
    const r = await axios.post(`${CRM_URL}/graphql`, {
      query: 'mutation($id:ID!){deleteLandingPage(id:$id){id}}',
      variables: { id: crmId }
    }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    return !!r.data.data?.deleteLandingPage?.id;
  } catch {
    return false;
  }
}

export async function createLandingPage(input: { name: string; title: string; brief?: string; presetId?: string; html?: string }): Promise<LandingPageData> {
  const presetId = PRESETS[input.presetId || ''] ? input.presetId! : 'sale-v5';
  const page: LandingPageData = {
    id: 'lp_' + Date.now(),
    name: input.name,
    slug: slugify(input.name),
    title: input.title,
    brief: input.brief || '',
    presetId,
    customHtml: input.html && input.html.trim() ? input.html : null,
    published: false,
    publishedUrl: '',
    createdAt: new Date().toISOString()
  };
  landingPages.set(page.id, page);
  saveLandingPages();
  const crmId = await syncToCrm(page);
  if (crmId) { page.crmId = crmId; landingPages.set(page.id, page); saveLandingPages(); }
  return page;
}

export function listLandingPages(): LandingPageData[] {
  return Array.from(landingPages.values());
}

export function getLandingPage(id: string): LandingPageData | undefined {
  return landingPages.get(id);
}

export function getLandingPageBySlug(slug: string): LandingPageData | undefined {
  return Array.from(landingPages.values()).find(p => p.slug === slug);
}

export async function publishLandingPage(id: string): Promise<{ success: boolean; url: string }> {
  const page = landingPages.get(id);
  if (!page) return { success: false, url: '' };
  page.published = true;
  page.publishedUrl = getPublicUrl() + '/lp/' + page.slug;
  landingPages.set(id, page);
  saveLandingPages();
  await syncToCrm(page);
  return { success: true, url: page.publishedUrl };
}

export async function deleteLandingPage(id: string): Promise<boolean> {
  const page = landingPages.get(id);
  if (!page) return false;
  await deleteFromCrm(page.crmId);
  landingPages.delete(id);
  saveLandingPages();
  return true;
}

export async function updateLandingPage(id: string, data: Partial<LandingPageData>): Promise<LandingPageData | undefined> {
  const page = landingPages.get(id);
  if (!page) return undefined;
  if (data.name && data.name.trim()) page.name = data.name.trim();
  if (data.title && data.title.trim()) page.title = data.title.trim();
  if (data.brief !== undefined) page.brief = data.brief;
  if (data.presetId) page.presetId = PRESETS[data.presetId] ? data.presetId : page.presetId;
  if (data.customHtml !== undefined) page.customHtml = data.customHtml;
  landingPages.set(id, page);
  saveLandingPages();
  await syncToCrm(page);
  return page;
}

export async function unpublishLandingPage(id: string): Promise<{ success: boolean }> {
  const page = landingPages.get(id);
  if (!page) return { success: false };
  page.published = false;
  page.publishedUrl = '';
  landingPages.set(id, page);
  saveLandingPages();
  await syncToCrm(page);
  return { success: true };
}

export function renderLandingPageHtml(page: LandingPageData): string {
  return page.customHtml || buildHtml(page.presetId, page.title, page.brief);
}

export function createLandingPageRouter(twentyClient?: TwentyGraphQLClient) {
  const router = Router();

  router.get('/presets', (_req: Request, res: Response) => {
    res.json(Object.entries(PRESETS).map(([id, p]) => ({ id, ...p })));
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name, title, brief, presetId, html } = req.body;
    if (!name || !title) return res.status(400).json({ error: 'Name and title required' });
    const page = await createLandingPage({ name, title, brief, presetId, html });
    res.status(201).json({ ...page, content: renderLandingPageHtml(page) });
  });

  router.get('/', (_req: Request, res: Response) => {
    res.json(listLandingPages().map(p => ({ ...p, content: renderLandingPageHtml(p) })));
  });

  router.post('/register', async (req: Request, res: Response) => {
    const { name, phone, email, clinic, source, tag } = req.body;
    const phoneClean = String(phone || '').replace(/\s/g, '');
    if (!name || !phoneClean) return res.status(400).json({ error: 'Name and phone required' });
    if (!/^[0-9]{9,11}$/.test(phoneClean)) return res.status(400).json({ error: 'Invalid phone number (9-11 digits)' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const entry: RegistrationEntry = {
      name: String(name).trim(), phone: phoneClean, email: String(email || '').trim(),
      clinic: String(clinic || '').trim(), source: source || 'landing-page', tag: tag || undefined,
      timestamp: new Date().toISOString(), ip: req.ip || req.socket.remoteAddress || '',
      twentyContactId: null, twentyDealId: null, status: 'received'
    };

    if (twentyClient) {
      try {
        entry.status = 'syncing';
        const contactResult = await twentyClient.createContact(entry.name, entry.email, entry.phone);
        entry.twentyContactId = contactResult?.createPerson?.id || null;
        if (entry.twentyContactId) {
          try {
            const dealName = entry.tag ? `[${entry.tag}] Lead: ${entry.clinic || entry.name}` : 'Lead: ' + (entry.clinic || entry.name);
            const dealResult = await twentyClient.createDeal(dealName, 0);
            entry.twentyDealId = dealResult?.createOpportunity?.id || null;
            entry.status = 'synced';
          } catch { entry.status = 'contact_only'; }
        }
      } catch (err) {
        entry.status = 'queued';
        entry.error = err instanceof Error ? err.message : 'Unknown';
        pendingQueue.push(entry);
      }
    } else {
      entry.status = 'local_only';
    }

    const logPath = dataPath('registrations.json');
    require('fs').mkdirSync(require('path').dirname(logPath), { recursive: true });
    let regs: RegistrationEntry[] = [];
    try { if (require('fs').existsSync(logPath)) regs = JSON.parse(require('fs').readFileSync(logPath, 'utf-8')); } catch {}
    regs.push(entry);
    require('fs').writeFileSync(logPath, JSON.stringify(regs, null, 2));

    const downloadLink = (getPublicUrl() || 'https://vinpeti.com') + '/lp/ebook-ai-bsty/cam-on.html';
    // email tự động tắt — gọi thủ công khi cần

    if (twentyClient) fireEvent('lead_created', {
      name: entry.name, email: entry.email, phone: entry.phone,
      clinic: entry.clinic, contactId: entry.twentyContactId
    }, twentyClient).catch(() => {});

    res.json({ success: true, message: 'Đăng ký thành công!', status: entry.status });
  });

  router.post('/payment-confirm', async (req: Request, res: Response) => {
    const { name, source } = req.body;
    if (!name) return res.status(400).json({ success: false });
    const entry: RegistrationEntry = {
      name: String(name).trim(), phone: '', email: '', clinic: '',
      source: source || 'benh-cho-landing',
      timestamp: new Date().toISOString(), ip: req.ip || '',
      twentyContactId: null, twentyDealId: null, status: 'received'
    };
    if (twentyClient) {
      try {
        entry.status = 'syncing';
        const cr = await twentyClient.createContact(entry.name, '', '');
        entry.twentyContactId = cr?.createPerson?.id || null;
        if (entry.twentyContactId) {
          const dr = await twentyClient.createDeal('[bsty] Payment confirmed: ' + entry.name, 0);
          entry.twentyDealId = dr?.createOpportunity?.id || null;
          entry.status = 'synced';
        }
      } catch { entry.status = 'local_only'; }
    }
    res.json({ success: true });
  });

  router.post('/retry-pending', async (req: Request, res: Response) => {
    if (!twentyClient) return res.status(400).json({ error: 'Twenty CRM not configured' });
    const results: Array<{ name: string; status: string }> = [];
    for (const entry of pendingQueue) {
      if (entry.status === 'synced') { results.push({ name: entry.name, status: 'synced' }); continue; }
      try {
        entry.status = 'syncing';
        const cr = await twentyClient.createContact(entry.name, entry.email, entry.phone);
        entry.twentyContactId = cr?.createPerson?.id || null;
        if (entry.twentyContactId) {
          try {
            const dealName = entry.tag ? `[${entry.tag}] Lead: ${entry.clinic || entry.name}` : 'Lead: ' + (entry.clinic || entry.name);
            const dr = await twentyClient.createDeal(dealName, 0);
            entry.twentyDealId = dr?.createOpportunity?.id || null;
            entry.status = 'synced';
          } catch { entry.status = 'contact_only'; }
        }
      } catch { entry.status = 'queued'; entry.error = entry.error || 'Retry failed'; }
      results.push({ name: entry.name, status: entry.status });
    }
    const logPath = dataPath('registrations.json');
    try {
      if (require('fs').existsSync(logPath)) {
        const existing = JSON.parse(require('fs').readFileSync(logPath, 'utf-8'));
        const merged = existing.map((e: RegistrationEntry) => pendingQueue.find(p => p.timestamp === e.timestamp) || e);
        require('fs').writeFileSync(logPath, JSON.stringify(merged, null, 2));
      }
    } catch {}
    const synced = results.filter(r => r.status === 'synced').length;
    res.json({ success: true, processed: results.length, synced, results });
  });

  router.get('/pending-count', (_req: Request, res: Response) => {
    const pending = pendingQueue.filter(e => e.status !== 'synced').length;
    res.json({ pending, total: pendingQueue.length });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const page = getLandingPage(req.params.id);
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json({ ...page, content: renderLandingPageHtml(page) });
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const page = await updateLandingPage(req.params.id, req.body);
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json({ ...page, content: renderLandingPageHtml(page) });
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    if (await deleteLandingPage(req.params.id)) return res.json({ success: true });
    return res.status(404).json({ error: 'Not found' });
  });

  router.post('/:id/publish', async (req: Request, res: Response) => {
    const result = await publishLandingPage(req.params.id);
    if (!result.success) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  });

  router.post('/:id/unpublish', async (req: Request, res: Response) => {
    const result = await unpublishLandingPage(req.params.id);
    if (!result.success) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  });

  router.get('/admin', (_req: Request, res: Response) => {
    const pages = listLandingPages();
    const regsPath = dataPath('registrations.json');
    let regs: any[] = [];
    try { if (require('fs').existsSync(regsPath)) regs = JSON.parse(require('fs').readFileSync(regsPath, 'utf-8')); } catch {}

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quản lý Landing Page</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}
body{background:#f1f5f9;color:#1e293b;min-height:100vh}
.header{background:#1e293b;color:#fff;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:1.3rem;font-weight:600}
.header a{color:#94a3b8;text-decoration:none;font-size:.9rem}
.container{max-width:1200px;margin:0 auto;padding:32px}
.toolbar{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center}
.toolbar input,.toolbar select{padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:.95rem;background:#fff}
.toolbar input{flex:1;min-width:200px}
.btn{padding:10px 20px;border:none;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;transition:.2s;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:#3b82f6;color:#fff}
.btn-primary:hover{background:#2563eb}
.btn-success{background:#22c55e;color:#fff}
.btn-success:hover{background:#16a34a}
.btn-danger{background:#ef4444;color:#fff}
.btn-danger:hover{background:#dc2626}
.btn-sm{padding:6px 12px;font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px}
.card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;transition:.2s}
.card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08)}
.card-head{padding:20px;border-bottom:1px solid #f1f5f9}
.card-head h3{font-size:1.1rem;margin-bottom:4px}
.card-head .slug{color:#64748b;font-size:.85rem}
.card-body{padding:16px 20px}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:.9rem}
.row .label{color:#64748b}
.row .value{font-weight:500}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.8rem;font-weight:600}
.badge-pub{background:#dcfce7;color:#16a34a}
.badge-draft{background:#fef3c7;color:#d97706}
.card-foot{padding:12px 20px;background:#f8fafc;display:flex;gap:8px;flex-wrap:wrap}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:28px}
.stat{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;text-align:center}
.stat .num{font-size:1.8rem;font-weight:700;color:#3b82f6}
.stat .lbl{font-size:.85rem;color:#64748b;margin-top:4px}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#fff;border-radius:16px;padding:28px;width:90%;max-width:520px;max-height:90vh;overflow-y:auto}
.modal-box h2{margin-bottom:20px;font-size:1.2rem}
.form-row{margin-bottom:14px}
.form-row label{display:block;font-size:.9rem;font-weight:500;margin-bottom:4px;color:#475569}
.form-row input,.form-row textarea,.form-row select{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:.95rem;font-family:inherit}
.form-row textarea{min-height:80px;resize:vertical}
.form-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
</style></head><body>
<div class="header"><h1>Landing Page Manager</h1><a href="/">← Về trang chủ</a></div>
<div class="container">
<div class="stats">
<div class="stat"><div class="num">${pages.length}</div><div class="lbl">Tổng trang</div></div>
<div class="stat"><div class="num">${pages.filter(p=>p.published).length}</div><div class="lbl">Đã xuất bản</div></div>
<div class="stat"><div class="num">${regs.length}</div><div class="lbl">Đăng ký</div></div>
</div>
<div class="toolbar">
<input type="text" id="search" placeholder="Tìm kiếm tên / slug...">
<select id="filterStatus"><option value="all">Tất cả</option><option value="published">Đã xuất bản</option><option value="draft">Nháp</option></select>
<button class="btn btn-primary" onclick="openModal()">+ Tạo Landing Page</button>
</div>
<div class="grid" id="grid"></div>
</div>
<div class="modal" id="modal"><div class="modal-box">
<h2 id="modalTitle">Tạo Landing Page</h2>
<form id="lpForm" onsubmit="submitForm(event)">
<input type="hidden" id="editId">
<div class="form-row"><label>Tên trang *</label><input id="fName" required></div>
<div class="form-row"><label>Tiêu đề *</label><input id="fTitle" required></div>
<div class="form-row"><label>Mô tả ngắn</label><input id="fBrief"></div>
<div class="form-row"><label>Preset</label><select id="fPreset"><option value="ebook-ai-bsty">Ebook AI BSTY</option><option value="sale-v5">Bán hàng V5</option><option value="lead-v5">Thu thập Lead V5</option><option value="service-pro">Dịch vụ Pro</option></select></div>
<div class="form-row"><label>HTML tùy chỉnh</label><textarea id="fHtml" placeholder="Để trống để dùng preset mặc định"></textarea></div>
<div class="form-actions"><button type="button" class="btn" onclick="closeModal()">Hủy</button><button type="submit" class="btn btn-primary">Lưu</button></div>
</form>
</div></div>
<script>
const DATA = ${JSON.stringify(pages)};
function render(list) {
  const grid = document.getElementById('grid');
  if (!list.length) { grid.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:40px">Chưa có landing page nào</p>'; return; }
  grid.innerHTML = list.map(p => '<div class="card"><div class="card-head"><h3>' + esc(p.name) + '</h3><div class="slug">/' + esc(p.slug) + '</div></div><div class="card-body"><div class="row"><span class="label">Tiêu đề</span><span class="value">' + esc(p.title) + '</span></div><div class="row"><span class="label">Preset</span><span class="value">' + esc(p.presetId) + '</span></div><div class="row"><span class="label">Trạng thái</span><span class="value"><span class="badge ' + (p.published ? 'badge-pub' : 'badge-draft') + '">' + (p.published ? 'Xuất bản' : 'Nháp') + '</span></span></div>' + (p.publishedUrl ? '<div class="row"><span class="label">URL</span><span class="value"><a href="' + esc(p.publishedUrl) + '" target="_blank">Xem</a></span></div>' : '') + '<div class="row"><span class="label">Tạo lúc</span><span class="value">' + new Date(p.createdAt).toLocaleDateString('vi-VN') + '</span></div></div><div class="card-foot">' + (!p.published ? '<button class="btn btn-success btn-sm" onclick="publish(' + p.id + ')">Publish</button>' : '<button class="btn btn-sm" style="background:#e2e8f0;color:#334155" onclick="unpublish(' + p.id + ')">Unpublish</button>') + '<button class="btn btn-primary btn-sm" onclick="editPage(' + p.id + ')">Sửa</button><button class="btn btn-danger btn-sm" onclick="delPage(' + p.id + ')">Xóa</button>' + (p.published ? '<a class="btn btn-sm" style="background:#1e293b;color:#fff;text-decoration:none" href="/lp/' + p.slug + '" target="_blank">Mở trang</a>' : '') + '</div></div>').join('');
}
function esc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }
function filter() {
  const q = document.getElementById('search').value.toLowerCase();
  const st = document.getElementById('filterStatus').value;
  let list = DATA;
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.slug.includes(q));
  if (st === 'published') list = list.filter(p => p.published);
  if (st === 'draft') list = list.filter(p => !p.published);
  render(list);
}
document.getElementById('search')?.addEventListener('input', filter);
document.getElementById('filterStatus')?.addEventListener('change', filter);
function openModal() { document.getElementById('modalTitle').textContent = 'Tạo Landing Page'; document.getElementById('editId').value = ''; document.getElementById('lpForm').reset(); document.getElementById('modal').classList.add('show'); }
function closeModal() { document.getElementById('modal').classList.remove('show'); }
function editPage(id) {
  const p = DATA.find(x => x.id === id); if (!p) return;
  document.getElementById('modalTitle').textContent = 'Sửa Landing Page';
  document.getElementById('editId').value = p.id;
  document.getElementById('fName').value = p.name;
  document.getElementById('fTitle').value = p.title;
  document.getElementById('fBrief').value = p.brief;
  document.getElementById('fPreset').value = p.presetId;
  document.getElementById('fHtml').value = p.customHtml || '';
  document.getElementById('modal').classList.add('show');
}
function submitForm(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const body = { name: document.getElementById('fName').value, title: document.getElementById('fTitle').value, brief: document.getElementById('fBrief').value, presetId: document.getElementById('fPreset').value, html: document.getElementById('fHtml').value };
  const url = id ? '/api/landing/' + id : '/api/landing';
  fetch(url, { method: id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    .then(r => r.ok ? r.json() : r.json().then(d => { alert(d.error || 'Lỗi'); throw new Error(); }))
    .then(() => { closeModal(); setTimeout(() => location.reload(), 300); }).catch(() =>{});
}
function publish(id) { fetch('/api/landing/' + id + '/publish', {method:'POST'}).then(r => r.ok ? location.reload() : alert('Lỗi')); }
function unpublish(id) { fetch('/api/landing/' + id + '/unpublish', {method:'POST'}).then(r => r.ok ? location.reload() : alert('Lỗi')); }
function delPage(id) { if (!confirm('Xóa landing page này?')) return; fetch('/api/landing/' + id, {method:'DELETE'}).then(r => r.ok ? location.reload() : alert('Lỗi')); }
render(DATA);
</script></body></html>`);
  });

  // Send ebook with PDF attachment
  router.post('/send/ebook', async (req: Request, res: Response) => {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const ten = name || 'Bạn';
    const base = getPublicUrl() || 'https://vinpeti.com';
    const downloadLink = base + '/lp/ebook-ai-bsty/cam-on.html';
    const pdfPath = join(__dirname, '../../public/lp/ebook-ai-bsty/ebook.pdf');
    let attachment: { filename: string; content: Buffer } | undefined;
    try { if (existsSync(pdfPath)) attachment = { filename: 'AI-trong-thuc-hanh-lam-sang-thu-y.pdf', content: readFileSync(pdfPath) }; } catch {}
    const html = `<h2>Chào ${ten},</h2>
<p>Cảm ơn bạn đã đăng ký nhận ebook <strong>"AI Trong Thực Hành Lâm Sàng Thú Y"</strong> của BS. Phan Hữu Nghị.</p>
<p>Ebook gồm 17 chương: framework ứng dụng AI vào chẩn đoán, điều trị và quản lý phòng khám thú y, kèm case study thực tế.</p>
<p><a href="${downloadLink}" style="background:#1e293b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Tải Ebook Miễn Phí</a></p>
<p>Mọi thắc mắc vui lòng trả lời email này hoặc liên hệ: <strong>phanhuunghi@gmail.com</strong></p>
<p>Trân trọng,<br>BS. Phan Hữu Nghị</p>`;
    const result = await sendEmail({ to: email, subject: `Ebook "AI Trong Thuc Hanh Lam Sang Thu Y" - ${ten}`, html, attachments: attachment ? [attachment] : undefined });
    if (!result.success) return res.status(500).json({ error: result.error || 'Send failed' });
    res.json({ success: true, to: email, id: result.id, attachment: !!attachment });
  });

  return router;
}
