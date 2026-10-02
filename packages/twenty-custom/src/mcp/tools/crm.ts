import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'crm_list_contacts', description: 'List contacts from Twenty CRM', inputSchema: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'crm_create_contact', description: 'Create a contact in Twenty CRM', inputSchema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } }, required: ['name'] } },
  { name: 'crm_list_deals', description: 'List deals from Twenty CRM', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'crm_create_deal', description: 'Create a deal in Twenty CRM', inputSchema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, contactId: { type: 'string' } }, required: ['name', 'amount'] } },
  { name: 'crm_list_orders', description: 'List orders (opportunities) from Twenty CRM', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'crm_create_order', description: 'Create an order (opportunity) in Twenty CRM', inputSchema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, contactId: { type: 'string' } }, required: ['name', 'amount'] } },
  { name: 'crm_list_products', description: 'List products from Twenty CRM', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

export function registerCrmTools(
  server: Server,
  client: TwentyGraphQLClient,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('crm_list_contacts', async (args) => {
    try {
      const data = await client.getContacts(Number(args.limit || 20));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_create_contact', async (args) => {
    try {
      const data = await client.createContact(String(args.name), String(args.email || ''), String(args.phone || ''));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_list_deals', async (args) => {
    try {
      const data = await client.getDeals();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_create_deal', async (args) => {
    try {
      const data = await client.createDeal(String(args.name), Number(args.amount));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_list_orders', async (args) => {
    try {
      const data = await client.getOrders(Number(args.limit || 50));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_create_order', async (args) => {
    try {
      const data = await client.createOrder(String(args.name), Number(args.amount), String(args.contactId || ''));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('crm_list_products', async (args) => {
    try {
      const data = await client.getProducts(Number(args.limit || 50));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
