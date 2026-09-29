// 🚀 VinPeti CRM Custom Server Entry
import express from 'express';
import cors from 'cors';
import { TwentyGraphQLClient } from './shared/graphql-client';
import { createTagsRouter } from './modules/tags';
import { createLandingPageRouter, getLandingPageBySlug, renderLandingPageHtml } from './modules/landing-page';
import { createEmailRouter } from './modules/email-marketing';
import { createPaymentRouter } from './modules/payment';
import { createTelegramRouter } from './modules/telegram-bot';
import { createVinpetiBridgeRouter } from './modules/vinpeti-bridge';
import { createDashboardRouter } from './modules/dashboard-kpi';
import { createInventoryRouter } from './modules/inventory';
import { createProductsRouter } from './modules/products';
import { createSequenceRouter, enrollLead } from './modules/sequence';
import { createWorkflowRouter } from './modules/workflow-automation';
import { createSettingsRouter } from './modules/settings';
import { getMcpApiKey } from './modules/settings';
import { mcpHttpHandler } from './mcp';
import path from 'path';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const TWENTY_URL = process.env.TWENTY_URL || 'http://twenty-server:3000';
const TWENTY_KEY = process.env.TWENTY_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';

// Middleware
app.use(cors());
// MCP SDK needs raw body — capture Buffer before express.json consumes it
app.use('/mcp', express.raw({ type: 'application/json' }));
// SePay webhook also needs raw bytes
app.use('/api/payment/sepay-webhook', express.raw({ type: '*/*' }));
app.use((req, res, next) => { if (req.path.startsWith('/mcp')) return next(); express.json({ limit: '10mb' })(req, res, next); });
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/healthz', (_req, res) => res.status(200).json({ 
  status: 'healthy', 
  version: '1.0.0',
  uptime: process.uptime(),
  modules: ['tags', 'landing-page', 'email', 'payment', 'telegram', 'vinpeti', 'dashboard', 'inventory', 'products', 'workflow'],
  twentyUrl: TWENTY_URL
}));

// Initialize Twenty GraphQL client
const twentyClient = new TwentyGraphQLClient(TWENTY_URL, TWENTY_KEY);

// Mount modules
app.use('/api/tags', createTagsRouter(twentyClient));
app.use('/api/landing', createLandingPageRouter(twentyClient));
app.use('/api/email', createEmailRouter());
app.use('/api/payment', createPaymentRouter(twentyClient));
app.use('/api/telegram', createTelegramRouter());
app.use('/api/vinpeti', createVinpetiBridgeRouter(twentyClient));
app.use('/api/dashboard', createDashboardRouter(twentyClient));
app.use('/api/inventory', createInventoryRouter(twentyClient));
app.use('/api/products', createProductsRouter(twentyClient));
app.use('/api/sequence', createSequenceRouter());
app.use('/api/workflow', createWorkflowRouter(twentyClient));
app.use('/api/settings', createSettingsRouter());

// Serve static files
app.use('/dashboard', express.static(path.join(__dirname, '../public')));
app.use('/lp', express.static(path.join(__dirname, '../public/lp')));
app.use('/landing', express.static(path.join(__dirname, '../public/lp')));

// Dynamic landing page route (after static mount so static files take priority)
app.get('/lp/:slug', (req, res) => {
  const page = getLandingPageBySlug(req.params.slug);
  if (!page || !page.published) return res.status(404).send('Not found');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLandingPageHtml(page));
});

// MCP endpoint (stateless, POST only)
const MCP_KEY = getMcpApiKey();
if (!MCP_KEY) {
  console.warn('⚠️  MCP_API_KEY not set — /mcp endpoint will return 503. Set MCP_API_KEY env or configure in Settings.');
}
const mcpAuth = (req, res, next) => {
  if (!MCP_KEY) return res.status(503).json({ error: 'MCP not configured' });
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${MCP_KEY}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
app.post('/mcp', mcpAuth, (req, res) => {
  mcpHttpHandler(twentyClient)(req, res);
});

// API info
app.get('/', (_req, res) => {
  res.json({
    name: 'VinPeti CRM Custom API',
    version: '1.0.0',
    endpoints: {
      tags: '/api/tags/:entityType/:entityId',
      landingPages: '/api/landing',
      emailMarketing: '/api/email',
      payment: '/api/payment',
      telegram: '/api/telegram',
      vinpeti: '/api/vinpeti',
      dashboard: '/api/dashboard',
      inventory: '/api/inventory',
      products: '/api/products',
      workflow: '/api/workflow',
    },
    twentyCrmUrl: TWENTY_URL
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     🚀 VinPeti CRM Custom API Server       ║
║──────────────────────────────────────────────║
║  Port:     ${PORT}                              ║
║  Twenty:   ${TWENTY_URL}                        ║
║  All 7 modules loaded & ready                ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
