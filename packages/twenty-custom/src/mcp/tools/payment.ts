import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import {
  createPayment, listPayments, getPayment, recordCash,
  listSepayTransactions, createInstallmentPlan, listInstallmentPlans, getInstallmentPlan
} from '../../modules/payment';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'payment_create_invoice', description: 'Create payment invoice with QR code', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, orderRef: { type: 'string' }, dealId: { type: 'string' }, contactId: { type: 'string' } }, required: ['amount', 'name'] } },
  { name: 'payment_list', description: 'List payments', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'payment_get', description: 'Get payment by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'payment_record_cash', description: 'Record cash payment', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, name: { type: 'string' }, orderRef: { type: 'string' }, dealId: { type: 'string' }, contactId: { type: 'string' } }, required: ['amount'] } },
  { name: 'payment_sepay_transactions', description: 'List SePay transactions', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'payment_create_installment_plan', description: 'Create installment plan', inputSchema: { type: 'object', properties: { name: { type: 'string' }, totalAmount: { type: 'number' }, count: { type: 'number' }, intervalDays: { type: 'number' }, phone: { type: 'string' }, email: { type: 'string' }, contactId: { type: 'string' } }, required: ['name', 'totalAmount', 'count'] } },
  { name: 'payment_list_installments', description: 'List installment plans', inputSchema: { type: 'object', properties: {} } },
  { name: 'payment_get_installment', description: 'Get installment plan by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

export function registerPaymentTools(
  server: Server,
  client: TwentyGraphQLClient,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('payment_create_invoice', async (args) => {
    try {
      const data = await createPayment(client, {
        amount: Number(args.amount), name: String(args.name),
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        orderRef: args.orderRef ? String(args.orderRef) : undefined,
        dealId: args.dealId ? String(args.dealId) : undefined,
        contactId: args.contactId ? String(args.contactId) : undefined,
      });
      if ('error' in data) return fail(data.error);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_list', async (args) => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listPayments(args.status ? String(args.status) : undefined)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_get', async (args) => {
    try {
      const data = getPayment(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_record_cash', async (args) => {
    try {
      const data = await recordCash(client, {
        amount: Number(args.amount), name: args.name ? String(args.name) : undefined,
        orderRef: args.orderRef ? String(args.orderRef) : undefined,
        dealId: args.dealId ? String(args.dealId) : undefined,
        contactId: args.contactId ? String(args.contactId) : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_sepay_transactions', async (args) => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await listSepayTransactions(args.limit !== undefined ? Number(args.limit) : undefined)) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_create_installment_plan', async (args) => {
    try {
      const data = await createInstallmentPlan(client, {
        name: String(args.name), totalAmount: Number(args.totalAmount),
        count: Number(args.count),
        intervalDays: args.intervalDays !== undefined ? Number(args.intervalDays) : undefined,
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        contactId: args.contactId ? String(args.contactId) : undefined,
      });
      if ('error' in data) return fail(data.error);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_list_installments', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listInstallmentPlans()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('payment_get_installment', async (args) => {
    try {
      const data = getInstallmentPlan(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
