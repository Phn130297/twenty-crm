// 🔗 VinPeti Bridge — Sync between Twenty CRM and VinPeti backend
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { dataPath, ensureDataDir } from '../shared/data-path';

export type SyncRecord = {
  id: string;
  twentyId: string;
  vinpetiId: number;
  entityType: 'contact' | 'order' | 'product';
  lastSyncedAt: string;
  status: 'synced' | 'pending' | 'error';
  errorMessage?: string;
};

const syncRecords: Map<string, SyncRecord> = new Map();
const SYNC_PERSIST = dataPath('vinpeti-sync.json');

const config: { apiUrl: string; apiKey: string } = {
  apiUrl: process.env.VINPETI_API_URL || 'http://localhost:8000',
  apiKey: process.env.VINPETI_API_KEY || ''
};
let autoSyncTimer: NodeJS.Timeout | null = null;

function loadSync() {
  try {
    const data = JSON.parse(require('fs').readFileSync(SYNC_PERSIST, 'utf-8'));
    Object.entries(data || {}).forEach(([k, v]) => syncRecords.set(k, v as SyncRecord));
  } catch {}
}
function saveSync() {
  try {
    ensureDataDir();
    require('fs').writeFileSync(SYNC_PERSIST, JSON.stringify(Object.fromEntries(syncRecords), null, 2));
  } catch {}
}
loadSync();

export async function syncContacts(client: TwentyGraphQLClient): Promise<any[]> {
  const response = await fetch(`${config.apiUrl}/api/v1/customers`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` }
  });
  if (!response.ok) throw new Error(`VinPeti API error: ${response.status}`);
  const customers = await response.json() as any;
  const results: any[] = [];
  for (const customer of (customers.data || customers || []).slice(0, 50)) {
    try {
      const existing = Array.from(syncRecords.values())
        .find(r => r.vinpetiId === customer.id && r.entityType === 'contact');
      if (existing) {
        results.push({ id: customer.id, status: 'already_synced', twentyId: existing.twentyId });
        continue;
      }
      const created = await client.createContact(
        customer.full_name || customer.name || `KH-${customer.id}`,
        customer.email,
        customer.phone
      );
      const record: SyncRecord = {
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        twentyId: created?.createPerson?.id || '',
        vinpetiId: customer.id,
        entityType: 'contact',
        lastSyncedAt: new Date().toISOString(),
        status: 'synced'
      };
      syncRecords.set(record.id, record);
      results.push({ id: customer.id, status: 'synced', twentyId: record.twentyId });
    } catch (err: any) {
      results.push({ id: customer.id, status: 'error', error: err.message });
    }
  }
  saveSync();
  return results;
}

export async function syncProducts(client: TwentyGraphQLClient): Promise<any[]> {
  const response = await fetch(`${config.apiUrl}/api/v1/products`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` }
  });
  if (!response.ok) throw new Error(`VinPeti API error: ${response.status}`);
  const payload = await response.json() as any;
  const results: any[] = [];
  for (const product of (payload.data || payload || []).slice(0, 100)) {
    try {
      const existing = Array.from(syncRecords.values())
        .find(r => r.vinpetiId === product.id && r.entityType === 'product');
      if (existing) {
        results.push({ id: product.id, status: 'already_synced', twentyId: existing.twentyId });
        continue;
      }
      const created = await client.createProduct(
        product.name || `SP-${product.id}`,
        product.price ?? product.gia,
        product.description || product.mo_ta
      );
      const record: SyncRecord = {
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        twentyId: created?.createProduct?.id || '',
        vinpetiId: product.id,
        entityType: 'product',
        lastSyncedAt: new Date().toISOString(),
        status: 'synced'
      };
      syncRecords.set(record.id, record);
      results.push({ id: product.id, status: 'synced', twentyId: record.twentyId });
    } catch (err: any) {
      results.push({ id: product.id, status: 'error', error: err.message });
    }
  }
  saveSync();
  return results;
}

export async function syncOrders(client: TwentyGraphQLClient): Promise<any[]> {
  const data = await client.getOrders(50);
  const orders = data?.opportunities || [];
  const results: any[] = [];
  for (const order of orders) {
    try {
      const existing = Array.from(syncRecords.values())
        .find(r => r.twentyId === order.id && r.entityType === 'order');
      if (existing) {
        results.push({ id: order.id, status: 'already_synced', vinpetiId: existing.vinpetiId });
        continue;
      }
      const response = await fetch(`${config.apiUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ten_don: order.name,
          gia_tri: order.amount,
          khach_hang: order.person?.name,
          twenty_id: order.id
        })
      });
      if (!response.ok) throw new Error(`VinPeti API error: ${response.status}`);
      const created = await response.json() as any;
      const record: SyncRecord = {
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        twentyId: order.id,
        vinpetiId: created?.id ?? created?.data?.id ?? 0,
        entityType: 'order',
        lastSyncedAt: new Date().toISOString(),
        status: 'synced'
      };
      syncRecords.set(record.id, record);
      results.push({ id: order.id, status: 'synced', vinpetiId: record.vinpetiId });
    } catch (err: any) {
      results.push({ id: order.id, status: 'error', error: err.message });
    }
  }
  saveSync();
  return results;
}

export async function syncAll(client: TwentyGraphQLClient): Promise<{ contacts: number; products: number; orders: number }> {
  const [contacts, products, orders] = await Promise.all([
    syncContacts(client).catch((e: Error) => [{ status: 'error', error: e.message }]),
    syncProducts(client).catch((e: Error) => [{ status: 'error', error: e.message }]),
    syncOrders(client).catch((e: Error) => [{ status: 'error', error: e.message }])
  ]);
  return { contacts: contacts.length, products: products.length, orders: orders.length };
}

export function getSyncStatus(): any {
  const stats = { total: 0, synced: 0, pending: 0, error: 0 };
  for (const r of syncRecords.values()) {
    stats.total++;
    stats[r.status]++;
  }
  return {
    ...stats,
    vinpetiUrl: config.apiUrl,
    twentyUrl: 'http://localhost:3001',
    autoSync: !!autoSyncTimer,
    lastSync: syncRecords.size > 0
      ? Math.max(...Array.from(syncRecords.values()).map(r => new Date(r.lastSyncedAt).getTime()))
      : null
  };
}

export function listSyncRecords(): SyncRecord[] {
  return Array.from(syncRecords.values());
}

export function setBridgeConfig(apiUrl?: string, apiKey?: string): void {
  if (apiUrl) config.apiUrl = apiUrl;
  if (apiKey) config.apiKey = apiKey;
}

export function getBridgeConfig(): { apiUrl: string; configured: boolean; autoSync: boolean } {
  return { apiUrl: config.apiUrl, configured: !!config.apiKey, autoSync: !!autoSyncTimer };
}

export function setAutoSync(minutes: number, client: TwentyGraphQLClient): boolean {
  if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
  if (minutes > 0) {
    autoSyncTimer = setInterval(() => {
      Promise.all([
        syncContacts(client).catch((e: Error) => console.error('[BRIDGE_AUTO] contacts', e)),
        syncProducts(client).catch((e: Error) => console.error('[BRIDGE_AUTO] products', e)),
        syncOrders(client).catch((e: Error) => console.error('[BRIDGE_AUTO] orders', e))
      ]);
    }, minutes * 60_000);
  }
  return minutes > 0;
}

export function createVinpetiBridgeRouter(client: TwentyGraphQLClient): Router {
  const router = Router();

  router.post('/config', (req: Request, res: Response) => {
    const { apiUrl, apiKey } = req.body;
    setBridgeConfig(apiUrl, apiKey);
    res.json({ success: true, apiUrl: config.apiUrl });
  });

  router.get('/config', (_req: Request, res: Response) => {
    res.json(getBridgeConfig());
  });

  router.post('/sync/contacts', async (_req: Request, res: Response) => {
    try { const results = await syncContacts(client); res.json({ synced: results.length, results }); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/sync/products', async (_req: Request, res: Response) => {
    try { const results = await syncProducts(client); res.json({ synced: results.length, results }); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/sync/orders', async (_req: Request, res: Response) => {
    try { const results = await syncOrders(client); res.json({ synced: results.length, results }); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/sync/all', async (_req: Request, res: Response) => {
    try { res.json(await syncAll(client)); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/auto-sync', (req: Request, res: Response) => {
    const minutes = Number(req.body.minutes ?? 0);
    const on = setAutoSync(minutes, client);
    res.json({ autoSync: on, intervalMinutes: minutes });
  });

  router.get('/records', (_req: Request, res: Response) => {
    res.json(listSyncRecords());
  });

  router.get('/status', (_req: Request, res: Response) => {
    res.json(getSyncStatus());
  });

  return router;
}
