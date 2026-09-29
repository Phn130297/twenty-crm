import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import {
  listInventoryProducts, createInventoryProduct, updateInventoryProduct,
  deleteInventoryProduct, adjustStock, getLowStock, listLots, addLot,
  getExpiring, listInventoryOrders, createInventoryOrder,
  getInventoryOrder, updateInventoryOrder, getProfitReport
} from '../../modules/inventory';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'inventory_list_products', description: 'List inventory products', inputSchema: { type: 'object', properties: {} } },
  { name: 'inventory_create_product', description: 'Create inventory product', inputSchema: { type: 'object', properties: { name: { type: 'string' }, sku: { type: 'string' }, price: { type: 'number' }, cost: { type: 'number' }, stockQty: { type: 'number' }, reorderPoint: { type: 'number' }, category: { type: 'string' }, unit: { type: 'string' } }, required: ['name'] } },
  { name: 'inventory_update_product', description: 'Update inventory product', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, sku: { type: 'string' }, price: { type: 'number' }, cost: { type: 'number' }, stockQty: { type: 'number' }, reorderPoint: { type: 'number' }, category: { type: 'string' }, unit: { type: 'string' } }, required: ['id'] } },
  { name: 'inventory_delete_product', description: 'Delete inventory product', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'inventory_adjust_stock', description: 'Adjust stock for a product', inputSchema: { type: 'object', properties: { id: { type: 'string' }, delta: { type: 'number' }, reason: { type: 'string' } }, required: ['id', 'delta'] } },
  { name: 'inventory_low_stock', description: 'List low stock products', inputSchema: { type: 'object', properties: {} } },
  { name: 'inventory_list_lots', description: 'List lots', inputSchema: { type: 'object', properties: { productId: { type: 'string' } } } },
  { name: 'inventory_add_lot', description: 'Add a new lot', inputSchema: { type: 'object', properties: { productId: { type: 'string' }, batchNo: { type: 'string' }, quantity: { type: 'number' }, expiryDate: { type: 'string' }, cost: { type: 'number' } }, required: ['productId', 'quantity'] } },
  { name: 'inventory_expiring_lots', description: 'List expiring lots', inputSchema: { type: 'object', properties: { days: { type: 'number' } } } },
  { name: 'inventory_list_orders', description: 'List inventory orders', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, status: { type: 'string' } } } },
  { name: 'inventory_create_order', description: 'Create inventory order with line items', inputSchema: { type: 'object', properties: { contactId: { type: 'string' }, customerName: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, qty: { type: 'number' }, unitPrice: { type: 'number' }, unitCost: { type: 'number' } } } }, status: { type: 'string' } }, required: ['items'] } },
  { name: 'inventory_get_order', description: 'Get inventory order by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'inventory_update_order', description: 'Update inventory order', inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['id'] } },
  { name: 'inventory_profit_report', description: 'Get profit report', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

export function registerInventoryTools(
  server: Server,
  client: TwentyGraphQLClient,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('inventory_list_products', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await listInventoryProducts(client)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_create_product', async (args) => {
    try {
      const data = await createInventoryProduct(client, {
        name: String(args.name), sku: args.sku ? String(args.sku) : undefined,
        price: args.price !== undefined ? Number(args.price) : undefined,
        cost: args.cost !== undefined ? Number(args.cost) : undefined,
        stockQty: args.stockQty !== undefined ? Number(args.stockQty) : undefined,
        reorderPoint: args.reorderPoint !== undefined ? Number(args.reorderPoint) : undefined,
        category: args.category ? String(args.category) : undefined,
        unit: args.unit ? String(args.unit) : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_update_product', async (args) => {
    try {
      const patch: Record<string, unknown> = {};
      if (args.name) patch.name = String(args.name);
      if (args.sku) patch.sku = String(args.sku);
      if (args.price !== undefined) patch.price = Number(args.price);
      if (args.cost !== undefined) patch.cost = Number(args.cost);
      if (args.stockQty !== undefined) patch.stockQty = Number(args.stockQty);
      if (args.reorderPoint !== undefined) patch.reorderPoint = Number(args.reorderPoint);
      if (args.category) patch.category = String(args.category);
      if (args.unit) patch.unit = String(args.unit);
      const data = updateInventoryProduct(String(args.id), patch);
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_delete_product', async (args) => {
    try {
      const ok = deleteInventoryProduct(String(args.id));
      return { content: [{ type: 'text', text: JSON.stringify({ success: ok }) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_adjust_stock', async (args) => {
    try {
      const data = adjustStock(String(args.id), Number(args.delta), args.reason ? String(args.reason) : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_low_stock', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(getLowStock()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_list_lots', async (args) => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listLots(args.productId ? String(args.productId) : undefined)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_add_lot', async (args) => {
    try {
      const data = addLot({
        productId: String(args.productId),
        batchNo: args.batchNo ? String(args.batchNo) : undefined,
        quantity: Number(args.quantity),
        expiryDate: args.expiryDate ? String(args.expiryDate) : undefined,
        cost: args.cost !== undefined ? Number(args.cost) : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_expiring_lots', async (args) => {
    try { return { content: [{ type: 'text', text: JSON.stringify(getExpiring(args.days ? Number(args.days) : undefined)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_list_orders', async (args) => {
    try {
      const limit = args.limit !== undefined ? Number(args.limit) : undefined;
      const status = args.status ? String(args.status) : undefined;
      return { content: [{ type: 'text', text: JSON.stringify(listInventoryOrders(limit, status)) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_create_order', async (args) => {
    try {
      const items = (args.items as Array<Record<string, unknown>>).map(i => ({
        productId: String(i.productId),
        qty: Number(i.qty),
        unitPrice: i.unitPrice !== undefined ? Number(i.unitPrice) : undefined,
        unitCost: i.unitCost !== undefined ? Number(i.unitCost) : undefined,
      }));
      const data = await createInventoryOrder(client, {
        contactId: args.contactId ? String(args.contactId) : undefined,
        customerName: args.customerName ? String(args.customerName) : undefined,
        items,
        status: args.status ? (String(args.status) as 'pending' | 'paid' | 'cancelled') : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_get_order', async (args) => {
    try {
      const data = getInventoryOrder(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_update_order', async (args) => {
    try {
      const patch: Record<string, unknown> & { status?: 'pending' | 'paid' | 'cancelled' } = {};
      if (args.status) patch.status = String(args.status) as 'pending' | 'paid' | 'cancelled';
      if (args.note) patch.note = String(args.note);
      const data = updateInventoryOrder(String(args.id), patch);
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('inventory_profit_report', async (args) => {
    try {
      const data = getProfitReport(args.from ? String(args.from) : undefined, args.to ? String(args.to) : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
