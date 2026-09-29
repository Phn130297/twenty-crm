import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import {
  listWorkRules, getWorkRule, createWorkRule, updateWorkRule,
  deleteWorkRule, listWorkflowRuns, fireTrigger
} from '../../modules/workflow-automation';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'workflow_list_rules', description: 'List workflow rules', inputSchema: { type: 'object', properties: {} } },
  { name: 'workflow_get_rule', description: 'Get workflow rule by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'workflow_create_rule', description: 'Create workflow rule', inputSchema: { type: 'object', properties: { name: { type: 'string' }, trigger: { type: 'string', enum: ['lead_created', 'payment_completed', 'deal_won', 'contact_tagged'] }, conditions: { type: 'object' }, actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['send_email', 'create_deal', 'tag_contact', 'notify_telegram', 'wait', 'enroll_sequence'] }, params: { type: 'object' } } } }, enabled: { type: 'boolean' } }, required: ['name', 'trigger', 'actions'] } },
  { name: 'workflow_update_rule', description: 'Update workflow rule', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, trigger: { type: 'string', enum: ['lead_created', 'payment_completed', 'deal_won', 'contact_tagged'] }, conditions: { type: 'object' }, actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['send_email', 'create_deal', 'tag_contact', 'notify_telegram', 'wait', 'enroll_sequence'] }, params: { type: 'object' } } } }, enabled: { type: 'boolean' } }, required: ['id'] } },
  { name: 'workflow_delete_rule', description: 'Delete workflow rule', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'workflow_list_runs', description: 'List recent workflow runs', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'workflow_fire', description: 'Fire a workflow trigger manually', inputSchema: { type: 'object', properties: { trigger: { type: 'string', enum: ['lead_created', 'payment_completed', 'deal_won', 'contact_tagged'] }, payload: { type: 'object' } }, required: ['trigger'] } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

function checkError<T>(r: T | { error: string }): r is { error: string } {
  return typeof r === 'object' && r !== null && 'error' in r;
}

export function registerWorkflowTools(
  server: Server,
  client: TwentyGraphQLClient,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('workflow_list_rules', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listWorkRules()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_get_rule', async (args) => {
    try {
      const data = getWorkRule(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_create_rule', async (args) => {
    try {
      const actions = (args.actions as Array<Record<string, unknown>>).map(a => ({
        type: a.type as 'send_email' | 'create_deal' | 'tag_contact' | 'notify_telegram' | 'wait' | 'enroll_sequence',
        params: (a.params as Record<string, string | number>) || {},
      }));
      const result = createWorkRule({
        name: String(args.name),
        trigger: args.trigger as 'lead_created' | 'payment_completed' | 'deal_won' | 'contact_tagged',
        conditions: (args.conditions as Record<string, string | number>) || {},
        actions,
        enabled: args.enabled !== false,
      });
      if (checkError(result)) return fail(result.error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_update_rule', async (args) => {
    try {
      const patch: Record<string, unknown> = {};
      if (args.name !== undefined) patch.name = String(args.name);
      if (args.trigger !== undefined) patch.trigger = args.trigger;
      if (args.conditions !== undefined) patch.conditions = args.conditions as Record<string, string | number>;
      if (args.actions !== undefined) {
        patch.actions = (args.actions as Array<Record<string, unknown>>).map(a => ({
          type: a.type as 'send_email' | 'create_deal' | 'tag_contact' | 'notify_telegram' | 'wait' | 'enroll_sequence',
          params: (a.params as Record<string, string | number>) || {},
        }));
      }
      if (args.enabled !== undefined) patch.enabled = args.enabled;
      const result = updateWorkRule(String(args.id), patch);
      if (!result) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_delete_rule', async (args) => {
    try {
      const ok = deleteWorkRule(String(args.id));
      return { content: [{ type: 'text', text: JSON.stringify({ success: ok }) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_list_runs', async (args) => {
    try {
      const limit = args.limit !== undefined ? Number(args.limit) : 50;
      return { content: [{ type: 'text', text: JSON.stringify(listWorkflowRuns(limit)) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('workflow_fire', async (args) => {
    try {
      await fireTrigger(client, args.trigger as 'lead_created' | 'payment_completed' | 'deal_won' | 'contact_tagged', (args.payload as Record<string, unknown>) || {});
      return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
