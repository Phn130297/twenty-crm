import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import {
  listTemplates, getTemplate, createTemplate,
  listCampaigns, getCampaign, createCampaign, sendCampaignById,
  emailStats, listUnsubscribers, getEmailProviderInfo, testEmailProvider, sendWelcomeEmail, sendTemplatedEmail
} from '../../modules/email-marketing';
import type { CallResult } from '../tools/helpers';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'email_list_templates', description: 'List email templates', inputSchema: { type: 'object', properties: {} } },
  { name: 'email_get_template', description: 'Get email template by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'email_create_template', description: 'Create email template (variables auto-extracted from {{x}})', inputSchema: { type: 'object', properties: { name: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, category: { type: 'string' } }, required: ['name', 'body'] } },
  { name: 'email_list_campaigns', description: 'List email campaigns', inputSchema: { type: 'object', properties: {} } },
  { name: 'email_create_campaign', description: 'Create email campaign', inputSchema: { type: 'object', properties: { name: { type: 'string' }, subject: { type: 'string' }, templateId: { type: 'string' }, recipientEmails: { type: 'array', items: { type: 'string' } }, scheduledAt: { type: 'string' } }, required: ['name', 'subject', 'recipientEmails'] } },
  { name: 'email_send_campaign', description: 'Send a campaign by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'email_stats', description: 'Get email marketing stats', inputSchema: { type: 'object', properties: {} } },
  { name: 'email_list_unsubscribers', description: 'List unsubscribers', inputSchema: { type: 'object', properties: {} } },
  { name: 'email_provider_info', description: 'Get email provider config info', inputSchema: { type: 'object', properties: {} } },
  { name: 'email_provider_test', description: 'Test email provider connection', inputSchema: { type: 'object', properties: { to: { type: 'string' } }, required: ['to'] } },
  { name: 'email_send_welcome', description: 'Send welcome email', inputSchema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, clinic: { type: 'string' } }, required: ['email'] } },
  { name: 'email_send_templated', description: 'Send email using a template', inputSchema: { type: 'object', properties: { templateId: { type: 'string' }, to: { type: 'string' }, variables: { type: 'object' } }, required: ['templateId', 'to'] } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

function checkError<T>(r: T | { error: string }, field: string): r is { error: string } {
  return typeof r === 'object' && r !== null && 'error' in r;
}

export function registerEmailTools(
  server: Server,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('email_list_templates', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listTemplates()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_get_template', async (args) => {
    try {
      const data = getTemplate(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_create_template', async (args) => {
    try {
      const result = createTemplate({
        name: String(args.name),
        subject: args.subject ? String(args.subject) : undefined,
        body: String(args.body),
        category: args.category ? String(args.category) : undefined,
      });
      if (checkError(result, 'error')) return fail(result.error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_list_campaigns', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listCampaigns()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_create_campaign', async (args) => {
    try {
      const result = createCampaign({
        name: String(args.name), subject: String(args.subject),
        templateId: args.templateId ? String(args.templateId) : undefined,
        recipientEmails: args.recipientEmails as string[],
        scheduledAt: args.scheduledAt ? String(args.scheduledAt) : undefined,
      });
      if (checkError(result, 'error')) return fail(result.error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_send_campaign', async (args) => {
    try {
      const result = await sendCampaignById(String(args.id));
      if (checkError(result, 'error')) return fail(result.error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_stats', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(emailStats()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_list_unsubscribers', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(listUnsubscribers()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_provider_info', async () => {
    try { return { content: [{ type: 'text', text: JSON.stringify(getEmailProviderInfo()) }] }; }
    catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_provider_test', async (args) => {
    try {
      const result = await testEmailProvider(String(args.to));
      if (!result.success) return fail((result as { success: false; error: string }).error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_send_welcome', async (args) => {
    try {
      const result = await sendWelcomeEmail(
        args.name ? String(args.name) : undefined,
        String(args.email),
        args.clinic ? String(args.clinic) : undefined
      );
      if (!result.success) return fail((result as { success: false; error: string }).error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('email_send_templated', async (args) => {
    try {
      const result = await sendTemplatedEmail(String(args.templateId), String(args.to), (args.variables as Record<string, string>) || {});
      if (!result.success) return fail((result as { success: false; error: string }).error);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
