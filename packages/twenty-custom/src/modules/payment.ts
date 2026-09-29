// 💳 Payment — VietQR + SePay + Installments
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { PaymentInvoice, SepayTransaction } from '../types';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { getSepayToken, getSepayWebhookSecret, getSepayApiUrl, getPublicUrl } from './settings';
import { dataPath, ensureDataDir } from '../shared/data-path';

interface TransactionInput {
  id: string;
  amount: number;
  content: string;
  method: 'cash' | 'transfer' | 'momo' | 'card';
  status: 'pending' | 'completed' | 'failed';
  orderRef: string;
  dealId?: string;
  contactId?: string;
  customerInfo: { name: string; phone: string; email: string };
  vietqrUrl?: string;
  installmentPlanId?: string;
  installmentNo?: number;
  dueDate?: string;
  createdAt: string;
}

interface InstallmentPlan {
  id: string;
  name: string;
  totalAmount: number;
  count: number;
  intervalDays: number;
  paidAmount: number;
  paidCount: number;
  customerInfo: { name: string; phone: string; email: string };
  dealId?: string;
  contactId?: string;
  status: 'active' | 'completed' | 'defaulted';
  createdAt: string;
}

const PERSIST_FILE = dataPath('payments.json');
const PLAN_PERSIST = dataPath('installment-plans.json');

function loadTransactions(): Map<string, TransactionInput> {
  if (!existsSync(PERSIST_FILE)) return new Map();
  try {
    const data = JSON.parse(readFileSync(PERSIST_FILE, 'utf-8'));
    return new Map(Object.entries(data));
  } catch { return new Map(); }
}

function saveTransactions(txns: Map<string, TransactionInput>) {
  ensureDataDir();
  writeFileSync(PERSIST_FILE, JSON.stringify(Object.fromEntries(txns), null, 2));
}

const plans: Map<string, InstallmentPlan> = new Map();
function loadPlans() {
  if (!existsSync(PLAN_PERSIST)) return;
  try {
    const data = JSON.parse(readFileSync(PLAN_PERSIST, 'utf-8'));
    Object.entries(data).forEach(([k, v]) => plans.set(k, v as InstallmentPlan));
  } catch {}
}
function savePlans() {
  ensureDataDir();
  writeFileSync(PLAN_PERSIST, JSON.stringify(Object.fromEntries(plans), null, 2));
}

let transactions = loadTransactions();
loadPlans();
const sepayWebhooks: SepayTransaction[] = [];

const VIETQR_BANK_ID = process.env.VIETQR_BANK_ID || '970436';
const VIETQR_ACCOUNT = process.env.VIETQR_ACCOUNT || '';
const VIETQR_TEMPLATE = process.env.VIETQR_TEMPLATE || 'compact2';
const VIETQR_ACCOUNT_NAME = process.env.VIETQR_ACCOUNT_NAME || '';
const AMOUNT_TOLERANCE = Number(process.env.PAYMENT_AMOUNT_TOLERANCE) || 100;

async function wireDeal(client: TwentyGraphQLClient, name: string, amount: number, contactId?: string): Promise<string | undefined> {
  try {
    const result: any = await client.createOrder(name, amount, contactId);
    return result?.createOpportunity?.id || result?.id;
  } catch (e: any) {
    console.error('[PAYMENT] wireDeal failed:', e.message);
    return undefined;
  }
}

export async function createPayment(
  client: TwentyGraphQLClient,
  input: { amount: number; name: string; phone?: string; email?: string; orderRef?: string; dealId?: string; contactId?: string }
): Promise<{ invoice: PaymentInvoice; qrData: string; qrBase64: string; dealId: string | undefined } | { error: string }> {
  const { amount, name, phone, email, orderRef, dealId, contactId } = input;
  if (!amount || !name) return { error: 'Amount and name required' };
  if (!VIETQR_ACCOUNT) return { error: 'VIETQR_ACCOUNT not configured' };

  const id = `pay_${Date.now()}`;
  const content = `VP${id.slice(-8)}`;
  const qrData = `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT}-${VIETQR_TEMPLATE}.jpg?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(name)}`;
  const qrBase64 = await QRCode.toDataURL(qrData);
  const resolvedDealId = dealId || await wireDeal(client, name, Number(amount), contactId);

  const txn: TransactionInput = {
    id, amount: Number(amount), content, method: 'transfer', status: 'pending',
    orderRef: orderRef || '', dealId: resolvedDealId || '',
    contactId: contactId || '',
    customerInfo: { name, phone: phone || '', email: email || '' },
    vietqrUrl: qrData,
    createdAt: new Date().toISOString()
  };
  transactions.set(id, txn);
  saveTransactions(transactions);

  const invoice: PaymentInvoice = {
    id, orderId: orderRef || id, amount: Number(amount), method: 'transfer',
    status: 'pending', vietqrUrl: qrData, createdAt: txn.createdAt
  };
  return { invoice, qrData, qrBase64, dealId: resolvedDealId };
}

export function listPayments(status?: string): Array<{ id: string; amount: number; content: string; method: string; status: string; customerInfo: any; orderRef: string; dealId: string; createdAt: string }> {
  let all = Array.from(transactions.values()).map(t => ({
    id: t.id, amount: t.amount, content: t.content, method: t.method,
    status: t.status === 'completed' ? 'paid' : t.status,
    customerInfo: t.customerInfo, orderRef: t.orderRef, dealId: t.dealId,
    createdAt: t.createdAt
  }));
  if (status) all = all.filter((t: any) => t.status === status);
  return all;
}

export function getPayment(id: string): PaymentInvoice | undefined {
  const txn = transactions.get(id);
  if (!txn) return undefined;
  return {
    id: txn.id, orderId: txn.orderRef, amount: txn.amount, method: txn.method,
    status: txn.status === 'completed' ? 'paid' : txn.status,
    vietqrUrl: txn.vietqrUrl, createdAt: txn.createdAt
  };
}

export async function recordCash(
  client: TwentyGraphQLClient,
  input: { amount: number; name?: string; phone?: string; email?: string; orderRef?: string; dealId?: string; contactId?: string }
): Promise<PaymentInvoice> {
  const { amount, name, phone, email, orderRef, dealId, contactId } = input;
  const id = `cash_${Date.now()}`;
  const resolvedDealId = dealId || await wireDeal(client, name || 'Cash', Number(amount), contactId);
  const txn: TransactionInput = {
    id, amount: Number(amount), content: `Cash-${name || ''}`,
    method: 'cash', status: 'completed', orderRef: orderRef || '', dealId: resolvedDealId || '',
    contactId: contactId || '',
    customerInfo: { name: name || '', phone: phone || '', email: email || '' },
    createdAt: new Date().toISOString()
  };
  transactions.set(id, txn);
  saveTransactions(transactions);
  fetch(`${getPublicUrl()}/api/workflow/fire`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'payment_completed', payload: { amount: txn.amount, email: txn.customerInfo.email, name: txn.customerInfo.name, contactId: txn.contactId, dealId: txn.dealId, method: 'cash' } })
  }).catch(() => {});
  return {
    id, orderId: orderRef || id, amount: Number(amount), method: 'cash',
    status: 'paid', createdAt: txn.createdAt
  };
}

async function sepayGet(path: string): Promise<any> {
  const token = getSepayToken();
  if (!token) throw new Error('SePay token not set (Settings > SePay)');
  const r = await fetch(`${getSepayApiUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`SePay ${r.status}: ${body || r.statusText}`);
  return JSON.parse(body);
}

export async function listSepayTransactions(limit = 20): Promise<any> {
  const per = Math.min(limit, 100);
  const data = await sepayGet(`/v2/transactions?per_page=${per}`);
  return { transactions: data?.data || [], pagination: data?.meta?.pagination || null };
}

export async function createInstallmentPlan(
  client: TwentyGraphQLClient,
  input: { name: string; totalAmount: number; count: number; intervalDays?: number; phone?: string; email?: string; contactId?: string }
): Promise<{ plan: InstallmentPlan; schedule: TransactionInput[]; perInstallment: number; dealId: string | undefined } | { error: string }> {
  const { name, totalAmount, count, intervalDays, phone, email, contactId } = input;
  if (!name || !totalAmount || !count || count < 2) {
    return { error: 'name, totalAmount, count (>=2) required' };
  }
  const perInstallment = Math.ceil(Number(totalAmount) / Number(count));
  const id = `inst_${Date.now()}`;
  const dealId = await wireDeal(client, name, Number(totalAmount), contactId);
  const plan: InstallmentPlan = {
    id, name, totalAmount: Number(totalAmount), count: Number(count),
    intervalDays: Number(intervalDays) || 30,
    paidAmount: 0, paidCount: 0,
    customerInfo: { name, phone: phone || '', email: email || '' },
    dealId, contactId: contactId || '',
    status: 'active', createdAt: new Date().toISOString()
  };
  plans.set(id, plan);
  savePlans();

  const schedule: TransactionInput[] = [];
  for (let i = 1; i <= plan.count; i++) {
    const due = new Date(Date.now() + i * plan.intervalDays * 86400000).toISOString();
    const txnId = `${id}_p${i}`;
    const txn: TransactionInput = {
      id: txnId, amount: perInstallment,
      content: `VP${txnId.slice(-8)}`,
      method: 'transfer', status: 'pending', orderRef: id, dealId: dealId || '',
      contactId: contactId || '',
      customerInfo: { name, phone: phone || '', email: email || '' },
      installmentPlanId: id, installmentNo: i, dueDate: due,
      createdAt: new Date().toISOString()
    };
    transactions.set(txnId, txn);
    schedule.push(txn);
  }
  saveTransactions(transactions);

  return { plan, schedule, perInstallment, dealId };
}

export function listInstallmentPlans(): Array<InstallmentPlan & { remaining: number; progress: number }> {
  return Array.from(plans.values()).map(p => ({
    ...p,
    remaining: p.totalAmount - p.paidAmount,
    progress: p.count > 0 ? Math.round((p.paidCount / p.count) * 100) : 0
  }));
}

export function getInstallmentPlan(id: string): { plan: InstallmentPlan; installments: TransactionInput[] } | undefined {
  const plan = plans.get(id);
  if (!plan) return undefined;
  const installments = Array.from(transactions.values())
    .filter(t => t.installmentPlanId === plan.id)
    .sort((a, b) => (a.installmentNo || 0) - (b.installmentNo || 0));
  return { plan, installments };
}

export function createPaymentRouter(client: TwentyGraphQLClient): Router {
  const router = Router();

  router.post('/create', async (req: Request, res: Response) => {
    try {
      const result = await createPayment(client, req.body);
      if ('error' in result) return res.status(400).json({ error: result.error });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sepay-webhook', (req: Request, res: Response) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const whSecret = getSepayWebhookSecret();
    let payload: any;
    if (whSecret) {
      const sig = (req.headers['x-sepay-signature'] as string || '').replace(/^sha256=/, '');
      const ts = Number(req.headers['x-sepay-timestamp'] || 0);
      if (!sig || !ts) return res.status(401).json({ error: 'Missing signature or timestamp' });
      if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return res.status(401).json({ error: 'Request expired' });
      const expected = crypto.createHmac('sha256', whSecret).update(`${ts}.${raw.toString('utf8')}`).digest('hex');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      try { payload = JSON.parse(raw.toString('utf8')); }
      catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    } else {
      payload = Buffer.isBuffer(req.body) ? JSON.parse(raw.toString('utf8')) : req.body;
    }

    const amount = payload.transferType === 'in'
      ? Number(payload.transferAmount || 0)
      : Number(payload.amount || payload.transferAmount || 0);
    const webhook: SepayTransaction = {
      id: payload.id || `wh_${Date.now()}`,
      amount,
      content: payload.content || '',
      code: payload.code || payload.referenceCode || '',
      status: payload.transferType === 'in' ? 'RECEIVED' : (payload.status || 'RECEIVED'),
      transactionDate: payload.transactionDate || new Date().toISOString()
    };
    sepayWebhooks.push(webhook);
    if (sepayWebhooks.length > 500) sepayWebhooks.shift();

    const txn = Array.from(transactions.values()).find(
      t => t.content && webhook.content?.includes?.(t.content)
    );

    if (txn) {
      if (webhook.amount >= txn.amount - AMOUNT_TOLERANCE) {
        txn.status = 'completed';
        transactions.set(txn.id, txn);
        saveTransactions(transactions);
        fetch(`${getPublicUrl()}/api/workflow/fire`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'payment_completed', payload: { amount: txn.amount, email: txn.customerInfo.email, name: txn.customerInfo.name, contactId: txn.contactId, dealId: txn.dealId } })
        }).catch(() => {});
      }
    }

    const plan = Array.from(plans.values()).find(p => p.status === 'active' && webhook.content?.includes?.(p.id.slice(-6)));
    if (plan && webhook.amount > 0) {
      plan.paidAmount += webhook.amount;
      plan.paidCount += 1;
      if (plan.paidCount >= plan.count) plan.status = 'completed';
      plans.set(plan.id, plan);
      savePlans();
    }

    res.json({ success: true, matchedTxn: !!txn, matchedPlan: !!plan });
  });

  router.get('/', (req: Request, res: Response) => {
    res.json(listPayments(req.query.status ? String(req.query.status) : undefined));
  });

  router.post('/cash', async (req: Request, res: Response) => {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });
    try {
      res.status(201).json(await recordCash(client, req.body));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/sepay-webhooks', (_req: Request, res: Response) => {
    res.json(sepayWebhooks.slice(-50));
  });

  // ====== SePay connection (test + list txns + create webhook) ======
  router.get('/sepay/config', (_req: Request, res: Response) => {
    res.json({
      hasToken: !!getSepayToken(),
      apiUrl: getSepayApiUrl(),
      webhookUrl: `${getPublicUrl()}/api/payment/sepay-webhook`
    });
  });

  router.post('/sepay/test', async (_req: Request, res: Response) => {
    try {
      const data = await sepayGet('/v2/bank-accounts');
      const accts = (data?.data || []).map((a: any) => ({
        bank: a.bank_brand_name || a.bank_short_name || '',
        account: a.account_number || '',
        name: a.account_name || ''
      }));
      res.json({ success: true, bankAccounts: accts, total: accts.length });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'SePay test failed' });
    }
  });

  router.get('/sepay/transactions', async (req: Request, res: Response) => {
    try {
      res.json(await listSepayTransactions(Number(req.query.limit) || 20));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'SePay list failed' });
    }
  });

  router.post('/sepay/webhook', async (req: Request, res: Response) => {
    try {
      const token = getSepayToken();
      if (!token) return res.status(400).json({ error: 'SePay token not set' });
      const { bankAccountId, name = 'VinPeti CRM' } = req.body;
      const secret = getSepayWebhookSecret();
      const body: any = {
        name,
        event_type: 'In_only',
        authen_type: secret ? 'HMAC_SHA256' : 'Api_Key',
        webhook_url: `${getPublicUrl()}/api/payment/sepay-webhook`,
        is_verify_payment: 1,
        skip_if_no_code: 0,
        active: 1,
        request_content_type: 'Json'
      };
      if (bankAccountId) body.bank_account_id = bankAccountId;
      if (secret) body.secret_key = secret;
      else body.api_key = crypto.randomBytes(16).toString('hex');
      const r = await fetch(`${getSepayApiUrl().replace('userapi.sepay.vn', 'my.sepay.vn')}/api/v1/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const resp = await r.text();
      if (!r.ok) return res.status(400).json({ error: `SePay webhook create ${r.status}: ${resp}` });
      res.json({ success: true, webhook: JSON.parse(resp) });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'SePay webhook create failed' });
    }
  });

  // ====== Installments (feature 23) ======
  router.post('/installments', async (req: Request, res: Response) => {
    const { name, totalAmount, count, intervalDays, phone, email, contactId } = req.body;
    const result = await createInstallmentPlan(client, { name, totalAmount, count, intervalDays, phone, email, contactId });
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  router.get('/installments', (_req: Request, res: Response) => {
    res.json(listInstallmentPlans());
  });

  router.get('/installments/:id', (req: Request, res: Response) => {
    const result = getInstallmentPlan(req.params.id);
    if (!result) return res.status(404).json({ error: 'Plan not found' });
    res.json(result);
  });

  // Generate QR for a specific installment
  router.post('/installments/:id/:no/qr', async (req: Request, res: Response) => {
    const plan = plans.get(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const txnId = `${plan.id}_p${req.params.no}`;
    const txn = transactions.get(txnId);
    if (!txn) return res.status(404).json({ error: 'Installment not found' });

    if (!VIETQR_ACCOUNT) return res.status(500).json({ error: 'VIETQR_ACCOUNT not configured' });

    const qrData = `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT}-${VIETQR_TEMPLATE}.jpg?amount=${txn.amount}&addInfo=${encodeURIComponent(txn.content)}&accountName=${encodeURIComponent(plan.name)}`;
    const qrBase64 = await QRCode.toDataURL(qrData);
    txn.vietqrUrl = qrData;
    transactions.set(txnId, txn);
    saveTransactions(transactions);
    res.json({ qrData, qrBase64, amount: txn.amount, content: txn.content, dueDate: txn.dueDate });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const txn = transactions.get(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Not found' });
    const invoice: PaymentInvoice = {
      id: txn.id, orderId: txn.orderRef, amount: txn.amount, method: txn.method,
      status: txn.status === 'completed' ? 'paid' : txn.status,
      vietqrUrl: txn.vietqrUrl, createdAt: txn.createdAt
    };
    res.json(invoice);
  });

  return router;
}
