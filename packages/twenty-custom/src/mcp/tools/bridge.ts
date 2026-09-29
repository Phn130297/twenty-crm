import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import { syncContacts, syncProducts, syncOrders, syncAll, getSyncStatus, listSyncRecords } from '../../modules/vinpeti-bridge';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'bridge_sync_contacts', description: 'Sync contacts from VinPeti to Twenty CRM', inputSchema: { type: 'object', properties: {} } },
  { name: 'bridge_sync_products', description: 'Sync products from VinPeti to Twenty CRM', inputSchema: { type: 'object', properties: {} } },
  { name: 'bridge_sync_orders', description: 'Sync orders from Twenty CRM to VinPeti', inputSchema: { type: 'object', properties: {} } },
  { name: 'bridge_sync_all', description: 'Sync all entities (contacts, products, orders)', inputSchema: { type: 'object', properties: {} } },
  { name: 'bridge_sync_status', description: 'Get sync status and stats', inputSchema: { type: 'object', properties: {} } },
  { name: 'bridge_sync_records', description: 'List all sync records', inputSchema: { type: 'object', properties: {} } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

export function registerBridgeTools(
  server: Server,
  client: TwentyGraphQLClient,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('bridge_sync_contacts', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await syncContacts(client)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('bridge_sync_products', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await syncProducts(client)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('bridge_sync_orders', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await syncOrders(client)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('bridge_sync_all', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await syncAll(client)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('bridge_sync_status', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(getSyncStatus()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('bridge_sync_records', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listSyncRecords()) }] }; }
    catch (e: any) { return fail(e.message); }
  });
}
