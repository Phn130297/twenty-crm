// 📊 Dashboard & KPI
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { getProfitReport } from './inventory';
import fs from 'fs';
import path from 'path';
import { dataPath } from '../shared/data-path';

interface KpiSnapshot {
  id: string;
  timestamp: string;
  totalRevenue: number;
  totalDeals: number;
  totalContacts: number;
  wonDeals: number;
  lostDeals: number;
  averageDealValue: number;
  activeDealsValue: number;
}

const snapshots: KpiSnapshot[] = [];

export function createDashboardRouter(client: TwentyGraphQLClient): Router {
  const router = Router();

  // Current KPI snapshot
  router.get('/kpi', async (_req: Request, res: Response) => {
    try {
      // Fetch real data from Twenty CRM
      const [contactsRes, dealsRes, ordersRes] = await Promise.all([
        client.getContacts().catch(() => ({ people: [] })),
        client.getDeals().catch(() => ({ opportunities: [] })),
        client.getOrders(200).catch(() => ({ opportunities: [] }))
      ]);

      const contacts = contactsRes?.people || [];
      const deals = dealsRes?.opportunities || [];
      const orders = (ordersRes?.opportunities || []) as Array<{ amount?: number; stage?: { id: string; name: string } }>;

      const won = orders.filter(o => o.stage?.name === 'Closed Won' || o.stage?.name === 'Won');
      const lost = orders.filter(o => o.stage?.name === 'Closed Lost' || o.stage?.name === 'Lost');
      const wonValue = won.reduce((sum, o) => sum + (o.amount || 0), 0);
      const totalDealValue = deals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      const avgValue = deals.length > 0 ? totalDealValue / deals.length : 0;

      // Cross-module: load payments + leads from disk
      let paymentRevenue = 0, paymentCount = 0;
      try {
        const pays = JSON.parse(fs.readFileSync(dataPath('payments.json'), 'utf-8'));
        for (const p of Object.values(pays) as any[]) {
          if (p.status === 'paid') { paymentRevenue += p.amount || 0; paymentCount++; }
        }
      } catch {}

      let leadCount = 0;
      try {
        const regs = JSON.parse(fs.readFileSync(dataPath('registrations.json'), 'utf-8')) as any[];
        leadCount = regs.length;
      } catch {}

      const emailStats = (() => {
        let sent = 0, opens = 0, clicks = 0;
        try {
          const camps = JSON.parse(fs.readFileSync(dataPath('email-campaigns.json'), 'utf-8'));
          for (const c of Object.values(camps.campaigns || {}) as any[]) {
            sent += c.sentCount || 0; opens += c.openCount || 0; clicks += c.clickCount || 0;
          }
        } catch {}
        return { sent, opens, clicks, openRate: sent > 0 ? Math.round((opens / sent) * 1000) / 10 : 0 };
      })();

      const kpi: KpiSnapshot = {
        id: `kpi_${Date.now()}`,
        timestamp: new Date().toISOString(),
        totalRevenue: wonValue + paymentRevenue,
        totalDeals: deals.length,
        totalContacts: contacts.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        averageDealValue: avgValue,
        activeDealsValue: totalDealValue,
      };

      snapshots.push(kpi);
      res.json({
        ...kpi,
        paymentRevenue, paymentCount,
        leads: leadCount,
        email: emailStats,
        pipelineValue: totalDealValue,
        conversionRate: orders.length > 0 ? Math.round((won.length / orders.length) * 1000) / 10 : 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Historical KPI data
  router.get('/kpi/history', (req: Request, res: Response) => {
    const { from, to } = req.query;
    let data = snapshots;
    
    if (from) data = data.filter(s => new Date(s.timestamp) >= new Date(from as string));
    if (to) data = data.filter(s => new Date(s.timestamp) <= new Date(to as string));
    
    res.json(data);
  });

  // Top customers
  router.get('/top-customers', async (_req: Request, res: Response) => {
    try {
      const data = await client.query(`
        query TopCustomers {
          people(limit: 10, orderBy: { createdAt: DescNullsFirst }) {
            id
            name
            createdAt
          }
        }
      `, {});
      res.json(data?.people || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Forecast
  router.get('/forecast', async (_req: Request, res: Response) => {
    try {
      const data = await client.query(`
        query Forecast {
          opportunities(limit: 50) {
            id
            name
            amount
            createdAt
          }
        }
      `, {});
      
      const deals = data?.opportunities || [];
      const totalValue = deals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      const avg = deals.length > 0 ? totalValue / deals.length : 0;
      
      res.json({
        openDeals: deals.length,
        pipelineValue: totalValue,
        averageDealSize: avg,
        projectedRevenue: totalValue * 0.35, // 35% conversion estimate
        period: '30 days'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // System health (combine multiple checks)
  router.get('/health', async (req: Request, res: Response) => {
    const twentyOk = await client.healthCheck();
    
    res.json({
      twentyCrm: twentyOk ? 'healthy' : 'unreachable',
      customApi: 'healthy',
      version: '1.0.0',
      uptime: process.uptime()
    });
  });

  // Leads from landing page registrations
  const registrationsPath = dataPath('registrations.json');

  const readRegistrations = (): any[] => {
    try {
      if (!fs.existsSync(registrationsPath)) return [];
      return JSON.parse(fs.readFileSync(registrationsPath, 'utf-8'));
    } catch {
      return [];
    }
  };

  router.get('/leads', (_req: Request, res: Response) => {
    const data = readRegistrations();
    res.json(data.reverse());
  });

  router.get('/leads/stats', (_req: Request, res: Response) => {
    const data = readRegistrations();
    const stats = data.reduce(
      (acc: any, lead: any) => {
        acc.total += 1;
        acc[lead.status || 'unknown'] = (acc[lead.status || 'unknown'] || 0) + 1;
        if (lead.email) acc.withEmail += 1;
        if (lead.twentyContactId) acc.synced += 1;
        return acc;
      },
      { total: 0, synced: 0, withEmail: 0 }
    );
    res.json(stats);
  });

  // Revenue trend from successful payments (last N days)
  router.get('/revenue-trend', (req: Request, res: Response) => {
    const days = Number(req.query.days) || 30;
    const since = Date.now() - days * 86_400_000;
    const buckets: Record<string, number> = {};
    try {
      const pays = JSON.parse(fs.readFileSync(dataPath('payments.json'), 'utf-8'));
      for (const p of Object.values(pays) as any[]) {
        if (p.status !== 'paid') continue;
        const ts = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        if (ts < since) continue;
        const day = new Date(ts).toISOString().slice(0, 10);
        buckets[day] = (buckets[day] || 0) + (p.amount || 0);
      }
    } catch {}
    const series = Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({ date, revenue: Array.isArray(revenue) ? Number(revenue) : revenue }));
    res.json(series);
  });

  // Single overview endpoint for frontend dashboard
  router.get('/overview', async (_req: Request, res: Response) => {
    try {
      const [
        contactsRes, dealsRes, ordersRes
      ] = await Promise.all([
        client.getContacts().catch(() => ({ people: [] })),
        client.getDeals().catch(() => ({ opportunities: [] })),
        client.getOrders(200).catch(() => ({ opportunities: [] }))
      ]);

      const orders = (ordersRes?.opportunities || []) as any[];
      const byStage: Record<string, { count: number; value: number }> = {};
      for (const o of orders) {
        const s = o.stage?.name || 'Unknown';
        byStage[s] = byStage[s] || { count: 0, value: 0 };
        byStage[s].count++; byStage[s].value += o.amount || 0;
      }

      res.json({
        totalContacts: contactsRes?.people?.length || 0,
        totalDeals: dealsRes?.opportunities?.length || 0,
        totalOrders: orders.length,
        pipelineByStage: byStage,
        leads: readRegistrations().length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export leads as CSV
  router.get('/export/leads', (_req: Request, res: Response) => {
    const data = readRegistrations();
    const header = 'name,phone,email,clinic,status,twentyContactId,createdAt';
    const rows = data.map((d: any) => [
      csv(d.name), csv(d.phone), csv(d.email), csv(d.clinic),
      csv(d.status), d.twentyContactId || '', d.createdAt || ''
    ].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send([header, ...rows].join('\n'));
  });

  // Export payments as CSV
  router.get('/export/payments', (_req: Request, res: Response) => {
    let pays: any[] = [];
    try { pays = Object.values(JSON.parse(fs.readFileSync(dataPath('payments.json'), 'utf-8'))); } catch {}
    const header = 'id,amount,currency,status,method,createdAt';
    const rows = pays.map(p => [
      p.id, p.amount, p.currency || 'VND', p.status, p.method || '', p.createdAt || ''
    ].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    res.send([header, ...rows].join('\n'));
  });

  // Profit report (revenue, COGS, margin, by product, by day)
  router.get('/profit', (req: Request, res: Response) => {
    const { from, to } = req.query;
    res.json(getProfitReport(from as string | undefined, to as string | undefined));
  });

  // Export profit summary as CSV
  router.get('/export/profit', (req: Request, res: Response) => {
    const { from, to } = req.query;
    const report = getProfitReport(from as string | undefined, to as string | undefined);
    const header = 'date,revenue,cost,profit,orders';
    const rows = report.byDay.map(d => [
      d.date, d.revenue, '', d.profit, d.orders
    ].join(','));
    const summary = `summary,,,,${report.summary.revenue},${report.summary.cost},${report.summary.profit}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="profit.csv"');
    res.send([header, ...rows, '', summary].join('\n'));
  });

  return router;
}

function csv(value: any): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
