// 📦 Inventory + Orders + Profit — overlay trên Twenty Product/Opportunity
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import fs from 'fs';
import { dataPath } from '../shared/data-path';
import path from 'path';

export type InventoryProduct = {
  twentyId: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stockQty: number;
  reorderPoint: number;
  category: string;
  unit: string;
  updatedAt: string;
};

export type Lot = {
  id: string;
  productId: string;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  cost: number;
  receivedAt: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
};

export type InventoryOrder = {
  id: string;
  twentyDealId: string | null;
  contactId: string | null;
  customerName: string;
  items: OrderItem[];
  total: number;
  totalCost: number;
  profit: number;
  status: 'pending' | 'paid' | 'cancelled';
  note: string;
  createdAt: string;
};

const INV_PERSIST = dataPath('inventory.json');
const products = new Map<string, InventoryProduct>();
const lots: Lot[] = [];
const orders: InventoryOrder[] = [];

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(INV_PERSIST, 'utf-8'));
    Object.entries(data.products || {}).forEach(([k, v]) => products.set(k, v as InventoryProduct));
    (data.lots || []).forEach((l: Lot) => lots.push(l));
    (data.orders || []).forEach((o: InventoryOrder) => orders.push(o));
  } catch {}
}
function save() {
  try {
    fs.mkdirSync(path.dirname(INV_PERSIST), { recursive: true });
    fs.writeFileSync(INV_PERSIST, JSON.stringify({
      products: Object.fromEntries(products),
      lots, orders: orders.slice(-500)
    }, null, 2));
  } catch {}
}
load();

export async function listInventoryProducts(client: TwentyGraphQLClient): Promise<InventoryProduct[]> {
  let twentyProducts: any[] = [];
  try {
    const data = await client.getProducts(200);
    twentyProducts = data?.products || [];
  } catch {}
  const merged = twentyProducts.map((p: any) => {
    const ov = products.get(p.id);
    return ov ? { ...p, ...ov } : {
      twentyId: p.id, name: p.name, sku: '', price: p.price || 0,
      cost: 0, stockQty: 0, reorderPoint: 0, category: '', unit: 'cái'
    };
  });
  const twentyIds = new Set(twentyProducts.map((p: any) => p.id));
  for (const [id, ov] of products) {
    if (!twentyIds.has(id)) merged.push({ ...ov });
  }
  return merged;
}

export async function createInventoryProduct(
  client: TwentyGraphQLClient,
  input: { name: string; sku?: string; price?: number; cost?: number; stockQty?: number; reorderPoint?: number; category?: string; unit?: string }
): Promise<InventoryProduct> {
  let twentyId = '';
  try {
    const created = await client.createProduct(input.name, input.price || 0, '');
    twentyId = created?.createProduct?.id || '';
  } catch {}
  const product: InventoryProduct = {
    twentyId: twentyId || `local_${Date.now()}`,
    name: input.name,
    sku: input.sku || `SKU-${Date.now().toString().slice(-6)}`,
    price: Number(input.price || 0), cost: Number(input.cost || 0),
    stockQty: Number(input.stockQty || 0), reorderPoint: Number(input.reorderPoint || 0),
    category: input.category || '', unit: input.unit || 'cái', updatedAt: new Date().toISOString()
  };
  products.set(product.twentyId, product);
  save();
  return product;
}

export function updateInventoryProduct(id: string, patch: Partial<Omit<InventoryProduct, 'twentyId' | 'updatedAt'>>): InventoryProduct | undefined {
  const p = products.get(id);
  if (!p) return undefined;
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.sku !== undefined) p.sku = patch.sku;
  if (patch.price !== undefined) p.price = Number(patch.price);
  if (patch.cost !== undefined) p.cost = Number(patch.cost);
  if (patch.stockQty !== undefined) p.stockQty = Number(patch.stockQty);
  if (patch.reorderPoint !== undefined) p.reorderPoint = Number(patch.reorderPoint);
  if (patch.category !== undefined) p.category = patch.category;
  if (patch.unit !== undefined) p.unit = patch.unit;
  p.updatedAt = new Date().toISOString();
  save();
  return p;
}

export function deleteInventoryProduct(id: string): boolean {
  const deleted = products.delete(id);
  if (deleted) save();
  return deleted;
}

export function adjustStock(id: string, delta: number, reason?: string): { twentyId: string; stockQty: number; reason: string } | undefined {
  const p = products.get(id);
  if (!p) return undefined;
  if (!Number.isFinite(delta)) return undefined;
  p.stockQty += delta;
  if (p.stockQty < 0) p.stockQty = 0;
  p.updatedAt = new Date().toISOString();
  save();
  return { twentyId: p.twentyId, stockQty: p.stockQty, reason: String(reason || '') };
}

export function getLowStock(): Array<{ twentyId: string; name: string; sku: string; stockQty: number; reorderPoint: number; deficit: number }> {
  return Array.from(products.values())
    .filter(p => p.stockQty <= p.reorderPoint)
    .map(p => ({
      twentyId: p.twentyId, name: p.name, sku: p.sku,
      stockQty: p.stockQty, reorderPoint: p.reorderPoint,
      deficit: p.reorderPoint - p.stockQty
    }));
}

export function listLots(productId?: string): Lot[] {
  return productId ? lots.filter(l => l.productId === productId) : lots;
}

export function addLot(input: { productId: string; batchNo?: string; quantity: number; expiryDate: string; cost?: number }): Lot {
  const lot: Lot = {
    id: `lot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    productId: input.productId, batchNo: input.batchNo || `L${Date.now().toString().slice(-5)}`,
    quantity: Number(input.quantity), expiryDate: input.expiryDate,
    cost: Number(input.cost || 0), receivedAt: new Date().toISOString()
  };
  const p = products.get(input.productId);
  if (p) { p.stockQty += Number(input.quantity); p.updatedAt = new Date().toISOString(); }
  lots.push(lot);
  save();
  return lot;
}

export function getExpiring(days = 30): Array<{ lotId: string; productId: string; productName: string; batchNo: string; quantity: number; expiryDate: string; daysLeft: number; expired: boolean }> {
  const cutoff = Date.now() + days * 86_400_000;
  return lots
    .filter(l => new Date(l.expiryDate).getTime() <= cutoff)
    .map(l => {
      const p = products.get(l.productId);
      const daysLeft = Math.ceil((new Date(l.expiryDate).getTime() - Date.now()) / 86_400_000);
      return {
        lotId: l.id, productId: l.productId, productName: p?.name || '',
        batchNo: l.batchNo, quantity: l.quantity, expiryDate: l.expiryDate,
        daysLeft, expired: daysLeft < 0
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function listInventoryOrders(limit = 100, status?: string): InventoryOrder[] {
  let list = orders.slice(-limit).reverse();
  if (status) list = list.filter(o => o.status === status);
  return list;
}

export async function createInventoryOrder(
  client: TwentyGraphQLClient,
  input: { contactId?: string; customerName?: string; items: Array<{ productId: string; qty: number; unitPrice?: number; unitCost?: number; name?: string }>; note?: string; status?: 'pending' | 'paid' | 'cancelled' }
): Promise<InventoryOrder | { error: string }> {
  if (!Array.isArray(input.items) || input.items.length === 0) return { error: 'items required' };

  const orderItems: OrderItem[] = input.items.map((it) => {
    const p = products.get(it.productId);
    return {
      productId: it.productId,
      name: it.name || p?.name || '',
      qty: Number(it.qty) || 1,
      unitPrice: Number(it.unitPrice ?? p?.price ?? 0),
      unitCost: Number(it.unitCost ?? p?.cost ?? 0)
    };
  });

  const total = orderItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const totalCost = orderItems.reduce((s, i) => s + i.unitCost * i.qty, 0);
  const profit = total - totalCost;

  for (const it of orderItems) {
    const p = products.get(it.productId);
    if (p) {
      p.stockQty = Math.max(0, p.stockQty - it.qty);
      p.updatedAt = new Date().toISOString();
    }
  }

  let twentyDealId: string | null = null;
  try {
    const deal = await client.createOrder(`ĐH: ${input.customerName || 'KH'}`, total, input.contactId);
    twentyDealId = deal?.createOpportunity?.id || null;
  } catch {}

  const order: InventoryOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    twentyDealId, contactId: input.contactId || null,
    customerName: input.customerName || '', items: orderItems,
    total, totalCost, profit, status: input.status || 'pending', note: input.note || '',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  save();
  return order;
}

export function getInventoryOrder(id: string): InventoryOrder | undefined {
  return orders.find(o => o.id === id);
}

export function updateInventoryOrder(id: string, patch: { status?: 'pending' | 'paid' | 'cancelled'; note?: string }): InventoryOrder | undefined {
  const order = orders.find(o => o.id === id);
  if (!order) return undefined;
  if (patch.status) order.status = patch.status;
  if (patch.note !== undefined) order.note = patch.note;
  save();
  return order;
}

export function createInventoryRouter(client: TwentyGraphQLClient): Router {
  const router = Router();

  router.get('/products', async (_req: Request, res: Response) => {
    res.json(await listInventoryProducts(client));
  });

  router.post('/products', async (req: Request, res: Response) => {
    const { name, sku, price, cost, stockQty, reorderPoint, category, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    res.status(201).json(await createInventoryProduct(client, { name, sku, price, cost, stockQty, reorderPoint, category, unit }));
  });

  router.patch('/products/:id', (req: Request, res: Response) => {
    const p = updateInventoryProduct(req.params.id, req.body);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  });

  router.delete('/products/:id', (req: Request, res: Response) => {
    if (!deleteInventoryProduct(req.params.id)) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });

  router.post('/products/:id/adjust', (req: Request, res: Response) => {
    const r = adjustStock(req.params.id, Number(req.body.delta), req.body.reason);
    if (!r) return res.status(400).json({ error: 'Product not found or invalid delta' });
    res.json(r);
  });

  router.get('/low-stock', (_req: Request, res: Response) => {
    res.json(getLowStock());
  });

  router.get('/lots', (req: Request, res: Response) => {
    res.json(listLots(String(req.query.productId || '')));
  });

  router.post('/lots', (req: Request, res: Response) => {
    const { productId, batchNo, quantity, expiryDate, cost } = req.body;
    if (!productId || !quantity || !expiryDate) return res.status(400).json({ error: 'productId, quantity, expiryDate required' });
    res.status(201).json(addLot({ productId, batchNo, quantity, expiryDate, cost }));
  });

  router.get('/expiring', (req: Request, res: Response) => {
    res.json(getExpiring(Number(req.query.days) || 30));
  });

  router.post('/orders', async (req: Request, res: Response) => {
    const { contactId, customerName, items, note, status } = req.body;
    const result = await createInventoryOrder(client, { contactId, customerName, items, note, status });
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  router.get('/orders', (req: Request, res: Response) => {
    res.json(listInventoryOrders(Number(req.query.limit) || 100, req.query.status ? String(req.query.status) : undefined));
  });

  router.get('/orders/:id', (req: Request, res: Response) => {
    const order = getInventoryOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  });

  router.patch('/orders/:id', (req: Request, res: Response) => {
    const order = updateInventoryOrder(req.params.id, req.body);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  });

  return router;
}

// Profit report factory — shared with dashboard
export function getProfitReport(from?: string, to?: string) {
  let list = orders;
  if (from) {
    const f = new Date(from).getTime();
    list = list.filter(o => new Date(o.createdAt).getTime() >= f);
  }
  if (to) {
    const t = new Date(to).getTime();
    list = list.filter(o => new Date(o.createdAt).getTime() <= t);
  }
  const active = list.filter(o => o.status !== 'cancelled');
  const revenue = active.reduce((s, o) => s + o.total, 0);
  const cost = active.reduce((s, o) => s + o.totalCost, 0);
  const profit = revenue - cost;
  const orderCount = active.length;
  const avgOrder = orderCount > 0 ? revenue / orderCount : 0;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  const byProduct: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
  for (const o of active) {
    for (const it of o.items) {
      const key = it.productId;
      byProduct[key] = byProduct[key] || { name: it.name, qty: 0, revenue: 0, profit: 0 };
      byProduct[key].qty += it.qty;
      byProduct[key].revenue += it.unitPrice * it.qty;
      byProduct[key].profit += (it.unitPrice - it.unitCost) * it.qty;
    }
  }

  const byDay: Record<string, { revenue: number; profit: number; orders: number }> = {};
  for (const o of active) {
    const day = o.createdAt.slice(0, 10);
    byDay[day] = byDay[day] || { revenue: 0, profit: 0, orders: 0 };
    byDay[day].revenue += o.total;
    byDay[day].profit += o.profit;
    byDay[day].orders++;
  }

  return {
    summary: { revenue, cost, profit, margin, orderCount, avgOrder },
    byProduct: Object.entries(byProduct)
      .map(([id, v]) => ({ productId: id, ...v }))
      .sort((a, b) => b.profit - a.profit),
    byDay: Object.entries(byDay)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}
