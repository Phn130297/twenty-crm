// ⚙️ Settings — public domain config shared across modules
import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dataPath, ensureDataDir } from '../shared/data-path';

const PERSIST = dataPath('settings.json');

type EmailProvider = 'resend' | 'sendgrid' | 'sendobox' | '';

interface Settings {
  publicDomain?: string;
  emailProvider?: EmailProvider;
  emailApiKey?: string;
  fromEmail?: string;
  sepayToken?: string;
  sepayWebhookSecret?: string;
  sepayApiUrl?: string;
  mcpApiKey?: string;
}

const settings: Settings = {};

const ALLOWED_PROVIDERS: EmailProvider[] = ['resend', 'sendgrid', 'sendobox'];

function load() {
  if (!existsSync(PERSIST)) return;
  try {
    const data = JSON.parse(readFileSync(PERSIST, 'utf-8'));
    if (data.publicDomain !== undefined) settings.publicDomain = data.publicDomain;
    if (ALLOWED_PROVIDERS.includes(data.emailProvider)) settings.emailProvider = data.emailProvider;
    if (typeof data.emailApiKey === 'string') settings.emailApiKey = data.emailApiKey;
    if (typeof data.fromEmail === 'string') settings.fromEmail = data.fromEmail;
    if (typeof data.sepayToken === 'string') settings.sepayToken = data.sepayToken;
    if (typeof data.sepayWebhookSecret === 'string') settings.sepayWebhookSecret = data.sepayWebhookSecret;
    if (typeof data.sepayApiUrl === 'string') settings.sepayApiUrl = data.sepayApiUrl;
    if (typeof data.mcpApiKey === 'string') settings.mcpApiKey = data.mcpApiKey;
  } catch {}
}
function save() {
  ensureDataDir();
  writeFileSync(PERSIST, JSON.stringify(settings, null, 2));
}
load();

function normalize(domain: string): string {
  const raw = domain.trim();
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

export function getEmailProvider(): EmailProvider {
  return settings.emailProvider || '';
}
export function getEmailApiKey(): string {
  return settings.emailApiKey || process.env.RESEND_API_KEY || '';
}
export function getFromEmail(): string {
  return settings.fromEmail || 'VinPeti <onboarding@resend.dev>';
}

export function getSepayToken(): string {
  return settings.sepayToken || process.env.SEPAY_API_KEY || '';
}
export function getSepayWebhookSecret(): string {
  return settings.sepayWebhookSecret || process.env.SEPAY_WEBHOOK_SECRET || '';
}
export function getSepayApiUrl(): string {
  return (settings.sepayApiUrl || process.env.SEPAY_API_URL || 'https://userapi.sepay.vn').replace(/\/+$/, '');
}

export function getMcpApiKey(): string {
  return settings.mcpApiKey || process.env.MCP_API_KEY || '';
}

export function getPublicUrl(): string {
  if (settings.publicDomain) return normalize(settings.publicDomain);
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
}

export function createSettingsRouter(): Router {
  const router = Router();

  router.get('/domain', (_req: Request, res: Response) => {
    res.json({
      publicDomain: settings.publicDomain || '',
      publicUrl: getPublicUrl(),
      fallback: process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`
    });
  });

  router.put('/domain', (req: Request, res: Response) => {
    const { publicDomain } = req.body;
    settings.publicDomain = typeof publicDomain === 'string' ? publicDomain.trim() : '';
    save();
    res.json({ success: true, publicDomain: settings.publicDomain, publicUrl: getPublicUrl() });
  });

  function mask(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  router.get('/email', (_req: Request, res: Response) => {
    res.json({
      provider: settings.emailProvider || '',
      hasApiKey: !!settings.emailApiKey,
      apiKeyMasked: mask(settings.emailApiKey || ''),
      fromEmail: getFromEmail(),
      providers: ALLOWED_PROVIDERS
    });
  });

  router.put('/email', (req: Request, res: Response) => {
    const { provider, apiKey, fromEmail } = req.body;
    if (provider && !ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `Provider must be one of: ${ALLOWED_PROVIDERS.join(', ')}` });
    }
    if (provider) settings.emailProvider = provider;
    if (typeof apiKey === 'string') settings.emailApiKey = apiKey.trim();
    if (typeof fromEmail === 'string') settings.fromEmail = fromEmail.trim();
    save();
    res.json({
      success: true,
      provider: settings.emailProvider || '',
      hasApiKey: !!settings.emailApiKey,
      apiKeyMasked: mask(settings.emailApiKey || ''),
      fromEmail: getFromEmail()
    });
  });

  router.get('/sepay', (_req: Request, res: Response) => {
    res.json({
      hasToken: !!settings.sepayToken,
      tokenMasked: mask(settings.sepayToken || ''),
      webhookSecretMasked: mask(settings.sepayWebhookSecret || ''),
      apiUrl: getSepayApiUrl()
    });
  });

  router.put('/sepay', (req: Request, res: Response) => {
    const { token, webhookSecret, apiUrl } = req.body;
    if (typeof token === 'string') settings.sepayToken = token.trim();
    if (typeof webhookSecret === 'string') settings.sepayWebhookSecret = webhookSecret.trim();
    if (typeof apiUrl === 'string') settings.sepayApiUrl = apiUrl.trim();
    save();
    res.json({
      success: true,
      hasToken: !!settings.sepayToken,
      tokenMasked: mask(settings.sepayToken || ''),
      webhookSecretMasked: mask(settings.sepayWebhookSecret || ''),
      apiUrl: getSepayApiUrl()
    });
  });

  return router;
}
