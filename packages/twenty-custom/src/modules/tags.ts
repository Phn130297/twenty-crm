// 🏷️ Tags module
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';

// Simple in-memory DB (upgrade to MongoDB/Postgres later)
class MemCollection {
  private data: Map<string, any> = new Map();
  
  async findOne(query: any) { 
    for (const [key, val] of this.data) {
      let match = true;
      for (const [k, v] of Object.entries(query)) {
        if (val[k] !== v) match = false;
      }
      if (match) return val;
    }
    return null;
  }
  
  async updateOne(query: any, update: any, _opts?: any) {
    const q = JSON.stringify(query);
    let doc = await this.findOne(query);
    if (!doc) {
      doc = { ...query, tags: [] };
      this.data.set(q, doc);
    }
    if (update.$addToSet) {
      for (const [, val] of Object.entries(update.$addToSet)) {
        if (!doc.tags) doc.tags = [];
        if (Array.isArray(val)) {
          val.forEach((v: any) => {
            if (!doc.tags.find((d: any) => JSON.stringify(d) === JSON.stringify(v))) doc.tags.push(v);
          });
        } else {
          if (!doc.tags.find((d: any) => JSON.stringify(d) === JSON.stringify(val))) doc.tags.push(val);
        }
      }
    }
    if (update.$pull) {
      for (const [, val] of Object.entries(update.$pull)) {
        if (doc.tags) {
          doc.tags = doc.tags.filter((d: any) => {
            if (typeof val === 'object') {
              return Object.entries(val as any).some(([k, v]) => d[k] !== v);
            }
            return d.name !== val;
          });
        }
      }
    }
    this.data.set(q, doc);
    return { acknowledged: true };
  }
}

const __collections: Record<string, MemCollection> = {};
const collection = (name: string): MemCollection => { 
  if (!__collections[name]) __collections[name] = new MemCollection();
  return __collections[name]; 
};

export function createTagsRouter(_client: TwentyGraphQLClient): Router {
  const router = Router();

  // Get all tags for an entity
  router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const col = collection('tags');
      const doc = await col.findOne({ entityType, entityId });
      res.json({ tags: doc?.tags || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add tag to entity
  router.post('/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { tag, color = '#6366f1' } = req.body;
      
      if (!tag) return res.status(400).json({ error: 'Tag name required' });

      const col = collection('tags');
      await col.updateOne(
        { entityType, entityId },
        { $addToSet: { tags: { name: tag, color } } },
        { upsert: true }
      );
      
      res.json({ success: true, tag: { name: tag, color } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove tag
  router.delete('/:entityType/:entityId/:tag', async (req: Request, res: Response) => {
    try {
      const { entityType, entityId, tag } = req.params;
      const col = collection('tags');
      await col.updateOne(
        { entityType, entityId },
        { $pull: { tags: { name: tag } } }
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
