import { dataPath } from '../shared/data-path';
// 🔁 Drip Sequences — B2B nurture flow
import { Router, Request, Response } from 'express';
import { sendTemplatedEmail, listTemplates } from './email-marketing';
import fs from 'fs';
import path from 'path';

interface SequenceStep {
  stepNo: number;
  templateId: string;
  delayHours: number;
  subject: string;
}

interface Sequence {
  id: string;
  name: string;
  trigger: 'lead_created' | 'manual' | 'deal_won';
  steps: SequenceStep[];
  enabled: boolean;
  enrolledCount: number;
  createdAt: string;
}

interface Enrollment {
  id: string;
  sequenceId: string;
  contactName: string;
  email: string;
  variables: Record<string, string>;
  currentStep: number;
  enrolledAt: string;
  nextFireAt: string | null;
  status: 'active' | 'completed' | 'unsubscribed' | 'failed';
  history: Array<{ stepNo: number; sentAt: string; success: boolean }>;
}

const SEQ_PERSIST = dataPath('sequences.json');
const sequences = new Map<string, Sequence>();
const enrollments: Enrollment[] = [];

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(SEQ_PERSIST, 'utf-8'));
    Object.entries(data.sequences || {}).forEach(([k, v]) => sequences.set(k, v as Sequence));
    (data.enrollments || []).forEach((e: Enrollment) => enrollments.push(e));
  } catch {}
}
function save() {
  try {
    fs.mkdirSync(path.dirname(SEQ_PERSIST), { recursive: true });
    fs.writeFileSync(SEQ_PERSIST, JSON.stringify({
      sequences: Object.fromEntries(sequences),
      enrollments: enrollments.slice(-1000)
    }, null, 2));
  } catch {}
}
load();

const DEFAULT_B2B_SEQUENCE: Sequence = {
  id: 'seq_b2b_default',
  name: 'B2B Nurture - Phòng khám thú y',
  trigger: 'lead_created',
  enabled: true,
  enrolledCount: 0,
  createdAt: new Date().toISOString(),
  steps: [
    {
      stepNo: 1, templateId: 'tpl_welcome', delayHours: 0,
      subject: 'Cảm ơn bạn quan tâm VinPeti'
    },
    {
      stepNo: 2, templateId: 'tpl_b2b_followup', delayHours: 24,
      subject: 'Bạn đã có sẵn sàng quản lý phòng khám tốt hơn?'
    },
    {
      stepNo: 3, templateId: 'tpl_b2b_case', delayHours: 72,
      subject: 'Phòng khám X tiết kiệm 10h/tuần với VinPeti'
    },
    {
      stepNo: 4, templateId: 'tpl_b2b_demo', delayHours: 168,
      subject: '15 phút demo - thấy ngay lợi ích'
    },
    {
      stepNo: 5, templateId: 'tpl_b2b_offer', delayHours: 336,
      subject: 'Ưu đãi dùng thử 30 ngày - chỉ tuần này'
    }
  ]
};

if (!sequences.has(DEFAULT_B2B_SEQUENCE.id)) {
  sequences.set(DEFAULT_B2B_SEQUENCE.id, DEFAULT_B2B_SEQUENCE);
  save();
}

export async function enrollLead(
  sequenceId: string,
  contactName: string,
  email: string,
  variables: Record<string, string>
): Promise<string | null> {
  const seq = sequences.get(sequenceId);
  if (!seq || !seq.enabled || !email) return null;
  const dup = enrollments.find(e =>
    e.sequenceId === sequenceId && e.email === email && e.status === 'active'
  );
  if (dup) return null;
  const now = Date.now();
  const firstStep = seq.steps[0];
  const enrollment: Enrollment = {
    id: `enr_${now}_${Math.random().toString(36).slice(2, 6)}`,
    sequenceId, contactName, email,
    variables: { ...variables, ten: contactName || 'Bạn', cong_ty: 'VinPeti' },
    currentStep: 1,
    enrolledAt: new Date(now).toISOString(),
    nextFireAt: new Date(now + firstStep.delayHours * 3_600_000).toISOString(),
    status: 'active',
    history: []
  };
  enrollments.push(enrollment);
  seq.enrolledCount++;
  save();
  return enrollment.id;
}

async function fireStep(enrollment: Enrollment): Promise<void> {
  const seq = sequences.get(enrollment.sequenceId);
  if (!seq) { enrollment.status = 'failed'; return; }
  const step = seq.steps.find(s => s.stepNo === enrollment.currentStep);
  if (!step) { enrollment.status = 'completed'; enrollment.nextFireAt = null; return; }

  const result = await sendTemplatedEmail(step.templateId, enrollment.email, enrollment.variables);
  enrollment.history.push({
    stepNo: step.stepNo,
    sentAt: new Date().toISOString(),
    success: result.success
  });
  if (!result.success) {
    enrollment.status = 'failed';
    enrollment.nextFireAt = null;
    return;
  }
  const next = seq.steps.find(s => s.stepNo === enrollment.currentStep + 1);
  if (!next) {
    enrollment.status = 'completed';
    enrollment.nextFireAt = null;
  } else {
    enrollment.currentStep = next.stepNo;
    enrollment.nextFireAt = new Date(Date.now() + next.delayHours * 3_600_000).toISOString();
  }
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const e of enrollments) {
    if (e.status !== 'active' || !e.nextFireAt) continue;
    if (new Date(e.nextFireAt).getTime() <= now) {
      fireStep(e).catch(err => console.error('[SEQUENCE]', err));
      changed = true;
    }
  }
  if (changed) save();
}, 60_000);

export function createSequenceRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(Array.from(sequences.values()));
  });

  router.post('/', (req: Request, res: Response) => {
    const { name, trigger = 'manual', steps, enabled = true } = req.body;
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'name and steps required' });
    }
    const seq: Sequence = {
      id: `seq_${Date.now()}`,
      name, trigger, enabled,
      enrolledCount: 0,
      createdAt: new Date().toISOString(),
      steps: steps.map((s: any, i: number) => ({
        stepNo: i + 1,
        templateId: s.templateId,
        delayHours: Number(s.delayHours) || 0,
        subject: s.subject || ''
      }))
    };
    sequences.set(seq.id, seq);
    save();
    res.status(201).json(seq);
  });

  router.patch('/:id', (req: Request, res: Response) => {
    const seq = sequences.get(req.params.id);
    if (!seq) return res.status(404).json({ error: 'Not found' });
    const { name, enabled, steps, trigger } = req.body;
    if (name !== undefined) seq.name = name;
    if (enabled !== undefined) seq.enabled = enabled;
    if (trigger) seq.trigger = trigger;
    if (Array.isArray(steps)) seq.steps = steps.map((s: any, i: number) => ({
      stepNo: i + 1, templateId: s.templateId,
      delayHours: Number(s.delayHours) || 0, subject: s.subject || ''
    }));
    save();
    res.json(seq);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    if (!sequences.delete(req.params.id)) return res.status(404).json({ error: 'Not found' });
    save();
    res.json({ success: true });
  });

  router.get('/enrollments', (req: Request, res: Response) => {
    const seqId = String(req.query.sequenceId || '');
    const list = seqId ? enrollments.filter(e => e.sequenceId === seqId) : enrollments;
    res.json(list.slice(-200).reverse());
  });

  router.post('/enroll', async (req: Request, res: Response) => {
    const { sequenceId, name, email, variables = {} } = req.body;
    if (!sequenceId || !email) return res.status(400).json({ error: 'sequenceId, email required' });
    const id = await enrollLead(sequenceId, name || 'Bạn', email, variables);
    if (!id) return res.status(409).json({ error: 'Already enrolled or sequence inactive' });
    res.status(201).json({ enrollmentId: id });
  });

  // Unsubscribe from sequence via link
  router.post('/unsubscribe', (req: Request, res: Response) => {
    const { email, sequenceId } = req.body;
    let count = 0;
    for (const e of enrollments) {
      if (e.email === email && (!sequenceId || e.sequenceId === sequenceId) && e.status === 'active') {
        e.status = 'unsubscribed'; e.nextFireAt = null; count++;
      }
    }
    save();
    res.json({ unsubscribed: count });
  });

  router.get('/stats', (_req: Request, res: Response) => {
    const stats = { active: 0, completed: 0, failed: 0, unsubscribed: 0, totalSent: 0 };
    for (const e of enrollments) {
      (stats as any)[e.status]++;
      stats.totalSent += e.history.filter(h => h.success).length;
    }
    res.json(stats);
  });

  return router;
}
