// 🛍️ Products — CRUD + Twenty CRM sync
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dataPath } from '../shared/data-path';

export type Product = {
  id: string;
  twentyId: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  category: string;
  format: string;
  description: string;
  features: string[];
  highlights: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = process.env.VERCEL ? '/tmp/data' : './data';
const PERSIST_FILE = DATA_DIR + '/products.json';
const products = new Map<string, Product>();

function load() {
  if (!existsSync(PERSIST_FILE)) return;
  try {
    const data = JSON.parse(readFileSync(PERSIST_FILE, 'utf-8'));
    for (const [k, v] of Object.entries(data)) products.set(k, v as Product);
  } catch {}
}
function save() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PERSIST_FILE, JSON.stringify(Object.fromEntries(products), null, 2));
}
load();

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let seq = products.size;
function nextId() { return 'p_' + (++seq); }

export function listProducts(): Product[] {
  return Array.from(products.values());
}

export function getProduct(id: string): Product | undefined {
  return products.get(id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return Array.from(products.values()).find(p => p.slug === slug);
}

export async function createProduct(input: {
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  format: string;
  description: string;
  features?: string[];
  highlights?: string[];
}): Promise<Product> {
  const slug = slugify(input.name);
  const product: Product = {
    id: nextId(),
    twentyId: '',
    name: input.name,
    slug,
    price: input.price,
    originalPrice: input.originalPrice,
    category: input.category,
    format: input.format,
    description: input.description,
    features: input.features || [],
    highlights: input.highlights || [],
    published: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  products.set(product.id, product);
  save();
  return product;
}

export async function updateProduct(id: string, patch: Partial<Pick<Product, 'name' | 'price' | 'originalPrice' | 'category' | 'format' | 'description' | 'features' | 'highlights' | 'published'>>): Promise<Product | null> {
  const p = products.get(id);
  if (!p) return null;
  if (patch.name) { p.name = patch.name; p.slug = slugify(patch.name); }
  if (patch.price !== undefined) p.price = patch.price;
  if (patch.originalPrice !== undefined) p.originalPrice = patch.originalPrice;
  if (patch.category) p.category = patch.category;
  if (patch.format) p.format = patch.format;
  if (patch.description) p.description = patch.description;
  if (patch.features) p.features = patch.features;
  if (patch.highlights) p.highlights = patch.highlights;
  if (patch.published !== undefined) p.published = patch.published;
  p.updatedAt = new Date().toISOString();
  products.set(id, p);
  save();
  return p;
}

export function deleteProduct(id: string): boolean {
  const ok = products.delete(id);
  if (ok) save();
  return ok;
}

async function syncToTwenty(product: Product, client: TwentyGraphQLClient): Promise<string> {
  const result = await client.createProduct(product.name, product.price, product.description);
  const twentyId = result?.createProduct?.id || '';
  if (twentyId) {
    product.twentyId = twentyId;
    products.set(product.id, product);
    save();
  }
  return twentyId;
}

const CATEGORIES = ['AI Education', 'Clinical Tools', 'Diagnostics', 'Education', 'Membership'];

export function createProductsRouter(twentyClient?: TwentyGraphQLClient) {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(listProducts());
  });

  router.get('/categories', (_req: Request, res: Response) => {
    res.json(CATEGORIES);
  });

  router.get('/:id', (req: Request, res: Response) => {
    const p = getProduct(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  });

  router.get('/slug/:slug', (req: Request, res: Response) => {
    const p = getProductBySlug(req.params.slug);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name, price, originalPrice, category, format, description, features, highlights } = req.body;
    if (!name || !price || !category || !format || !description) {
      return res.status(400).json({ error: 'Missing required fields: name, price, category, format, description' });
    }
    const p = await createProduct({ name, price, originalPrice, category, format, description, features, highlights });
    if (twentyClient) {
      try { await syncToTwenty(p, twentyClient); } catch { /* sync failed, local record exists */ }
    }
    res.status(201).json(p);
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const p = await updateProduct(req.params.id, req.body);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const ok = deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });

  router.post('/:id/sync', async (req: Request, res: Response) => {
    const p = getProduct(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (!twentyClient) return res.status(400).json({ error: 'Twenty CRM not configured' });
    try {
      const twentyId = await syncToTwenty(p, twentyClient);
      res.json({ success: true, twentyId });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' });
    }
  });

  router.post('/seed', async (req: Request, res: Response) => {
    const { products: seedProducts } = req.body;
    if (!Array.isArray(seedProducts)) return res.status(400).json({ error: 'Expected array of products' });

    const results: Product[] = [];
    for (const sp of seedProducts) {
      if (!sp.name || !sp.price || !sp.category || !sp.format || !sp.description) continue;
      const p = await createProduct({
        name: sp.name,
        price: sp.price,
        originalPrice: sp.originalPrice,
        category: sp.category,
        format: sp.format,
        description: sp.description,
        features: sp.features,
        highlights: sp.highlights,
      });
      if (twentyClient) {
        try { await syncToTwenty(p, twentyClient); } catch { /* non-blocking */ }
      }
      results.push(p);
    }
    res.status(201).json({ created: results.length, products: results });
  });

  return router;
}
