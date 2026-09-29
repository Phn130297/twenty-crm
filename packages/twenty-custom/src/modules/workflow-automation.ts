// ⚙️ Workflow Automation — event-driven rules
import { Router, Request, Response } from 'express';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { enrollLead } from './sequence';
import { dataPath, ensureDataDir } from '../shared/data-path';

type Trigger = 'lead_created' | 'payment_completed' | 'deal_won' | 'contact_tagged';
type Action = 'send_email' | 'create_deal' | 'tag_contact' | 'notify_telegram' | 'wait' | 'enroll_sequence';

interface WorkflowRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Record<string, string | number>;
  actions: Array<{ type: Action; params: Record<string, string | number> }>;
  runCount: number;
  createdAt: string;
}

interface WorkflowRun {
  id: string;
  ruleId: string;
  trigger: Trigger;
  payload: Record<string, any>;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  timestamp: string;
}

const WORKFLOW_PERSIST = dataPath('workflows.json');

const rules: Map<string, WorkflowRule> = new Map();
const runs: WorkflowRun[] = [];

function load() {
  try {
    const data = JSON.parse(require('fs').readFileSync(WORKFLOW_PERSIST, 'utf-8'));
    Object.entries(data.rules || {}).forEach(([k, v]) => rules.set(k, v as WorkflowRule));
    (data.runs || []).forEach((r: WorkflowRun) => runs.push(r));
  } catch {}
}
function save() {
  try {
    ensureDataDir();
    require('fs').writeFileSync(WORKFLOW_PERSIST, JSON.stringify({
      rules: Object.fromEntries(rules),
      runs: runs.slice(-200)
    }, null, 2));
  } catch {}
}
load();

function match(rule: WorkflowRule, payload: Record<string, any>): boolean {
  for (const [field, expected] of Object.entries(rule.conditions)) {
    if (payload[field] !== expected) return false;
  }
  return true;
}

async function runAction(
  action: WorkflowRule['actions'][number],
  payload: Record<string, any>,
  client: TwentyGraphQLClient
): Promise<void> {
  switch (action.type) {
    case 'send_email': {
      // email tự động tắt — gọi thủ công khi cần
      break;
    }
    case 'create_deal': {
      const name = String(payload.name || action.params.name || 'Deal mới');
      const amount = Number(payload.amount || action.params.amount || 0);
      await client.createOrder(name, amount, payload.contactId);
      break;
    }
    case 'tag_contact': {
      const id = String(payload.contactId || payload.id || '');
      const tag = String(action.params.tag || 'auto');
      if (id) await client.query(`
        mutation AddTag($id: UUID!, $name: String!) {
          updatePerson(data: { id: $id }) { id }
        }`, { id, name: tag }).catch(() => {});
      break;
    }
    case 'notify_telegram': {
      const msg = String(action.params.message || 'Workflow triggered');
      await fetch(`${process.env.BASE_URL || 'http://localhost:4000'}/api/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `[Workflow] ${msg}`, chatId: action.params.chatId })
      }).catch(() => {});
      break;
    }
    case 'enroll_sequence': {
      const email = String(payload.email || '');
      const seqId = String(action.params.sequenceId || 'seq_b2b_default');
      if (email) await enrollLead(seqId, String(payload.name || 'Bạn'), email, payload.variables || {});
      break;
    }
    case 'wait': {
      const seconds = Number(action.params.seconds || 0);
      if (seconds > 0) await new Promise(r => setTimeout(r, seconds * 1000));
      break;
    }
  }
}

export async function fireEvent(
  trigger: Trigger,
  payload: Record<string, any>,
  client: TwentyGraphQLClient
): Promise<void> {
  if (trigger === 'lead_created' && payload.email) {
    // sequence auto-enroll tắt — gọi thủ công khi cần
  }
  const matching = Array.from(rules.values()).filter(r => r.enabled && r.trigger === trigger);
  for (const rule of matching) {
    if (rule.conditions && Object.keys(rule.conditions).length > 0 && !match(rule, payload)) {
      continue;
    }
    const run: WorkflowRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ruleId: rule.id,
      trigger,
      payload,
      status: 'success',
      timestamp: new Date().toISOString()
    };
    try {
      for (const action of rule.actions) {
        await runAction(action, payload, client);
      }
      rule.runCount++;
    } catch (error: any) {
      run.status = 'failed';
      run.error = error.message;
    }
    runs.push(run);
  }
  save();
}

export function listWorkRules(): WorkflowRule[] {
  return Array.from(rules.values());
}

export function getWorkRule(id: string): WorkflowRule | undefined {
  return rules.get(id);
}

export function createWorkRule(input: { name: string; trigger: Trigger; conditions?: Record<string, string | number>; actions: Array<{ type: Action; params: Record<string, string | number> }>; enabled?: boolean }): WorkflowRule | { error: string } {
  if (!input.name || !input.trigger || !Array.isArray(input.actions)) {
    return { error: 'name, trigger, actions required' };
  }
  const rule: WorkflowRule = {
    id: `wf_${Date.now()}`,
    name: input.name, enabled: input.enabled !== false, trigger: input.trigger,
    conditions: input.conditions || {}, actions: input.actions,
    runCount: 0, createdAt: new Date().toISOString()
  };
  rules.set(rule.id, rule);
  save();
  return rule;
}

export function updateWorkRule(id: string, patch: { name?: string; enabled?: boolean; conditions?: Record<string, string | number>; actions?: Array<{ type: Action; params: Record<string, string | number> }>; trigger?: Trigger }): WorkflowRule | undefined {
  const rule = rules.get(id);
  if (!rule) return undefined;
  if (patch.name !== undefined) rule.name = patch.name;
  if (patch.enabled !== undefined) rule.enabled = patch.enabled;
  if (patch.conditions !== undefined) rule.conditions = patch.conditions;
  if (Array.isArray(patch.actions)) rule.actions = patch.actions;
  if (patch.trigger) rule.trigger = patch.trigger;
  save();
  return rule;
}

export function deleteWorkRule(id: string): boolean {
  const deleted = rules.delete(id);
  if (deleted) save();
  return deleted;
}

export function listWorkflowRuns(limit = 50): WorkflowRun[] {
  return runs.slice(-limit).reverse();
}

export async function fireTrigger(client: TwentyGraphQLClient, trigger: Trigger, payload: Record<string, any>): Promise<void> {
  await fireEvent(trigger, payload, client);
}

export function createWorkflowRouter(client: TwentyGraphQLClient): Router {
  const router = Router();

  router.get('/rules', (_req: Request, res: Response) => {
    res.json(listWorkRules());
  });

  router.post('/rules', (req: Request, res: Response) => {
    const result = createWorkRule(req.body);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  router.patch('/rules/:id', (req: Request, res: Response) => {
    const rule = updateWorkRule(req.params.id, req.body);
    if (!rule) return res.status(404).json({ error: 'Not found' });
    res.json(rule);
  });

  router.delete('/rules/:id', (req: Request, res: Response) => {
    if (!deleteWorkRule(req.params.id)) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });

  router.get('/runs', (req: Request, res: Response) => {
    res.json(listWorkflowRuns(Number(req.query.limit) || 50));
  });

  router.post('/fire', async (req: Request, res: Response) => {
    const { trigger, payload = {} } = req.body;
    if (!trigger) return res.status(400).json({ error: 'trigger required' });
    await fireTrigger(client, trigger as Trigger, payload);
    res.json({ success: true });
  });

  return router;
}
