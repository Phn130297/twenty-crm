import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TwentyGraphQLClient } from '../../shared/graphql-client';
import type { CallResult } from '../tools/helpers';
import { createLandingPage, listLandingPages, getLandingPage, publishLandingPage, deleteLandingPage, renderLandingPageHtml } from '../../modules/landing-page';

type Tool = z.infer<typeof ToolSchema>;

const TOOL_DEFS: Tool[] = [
  { name: 'create_landing_page', description: 'Create a landing page', inputSchema: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, brief: { type: 'string' }, presetId: { type: 'string' }, html: { type: 'string' } }, required: ['name', 'title'] } },
  { name: 'list_landing_pages', description: 'List all landing pages', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_landing_page', description: 'Get landing page by ID with rendered content', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'publish_landing_page', description: 'Publish a landing page', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'delete_landing_page', description: 'Delete a landing page', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];

function fail(msg: string): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true };
}

export function registerLandingTools(
  server: Server,
  tools: Tool[],
  toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>
) {
  tools.push(...TOOL_DEFS);

  toolHandlers.set('create_landing_page', async (args) => {
    try {
      const data = createLandingPage({
        name: String(args.name),
        title: String(args.title),
        brief: args.brief ? String(args.brief) : undefined,
        presetId: args.presetId ? String(args.presetId) : undefined,
        html: args.html ? String(args.html) : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('list_landing_pages', async () => {
    try {
      const data = listLandingPages();
      return { content: [{ type: 'text', text: JSON.stringify(data.map(p => ({ id: p.id, name: p.name, slug: p.slug, title: p.title, published: p.published, publishedUrl: p.publishedUrl, presetId: p.presetId }))) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('get_landing_page', async (args) => {
    try {
      const data = getLandingPage(String(args.id));
      if (!data) return fail('Not found');
      return { content: [{ type: 'text', text: JSON.stringify({ ...data, content: renderLandingPageHtml(data) }) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('publish_landing_page', async (args) => {
    try {
      const data = publishLandingPage(String(args.id));
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (e: any) { return fail(e.message); }
  });

  toolHandlers.set('delete_landing_page', async (args) => {
    try {
      const ok = deleteLandingPage(String(args.id));
      return { content: [{ type: 'text', text: JSON.stringify({ success: ok }) }] };
    } catch (e: any) { return fail(e.message); }
  });
}
