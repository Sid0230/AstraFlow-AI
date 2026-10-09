/**
 * AstraFlow Automation Hub
 * Dependency-free Node.js server. Run with: node server.js
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.ASTRAFLOW_API_KEY || '';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

const workflows = [
  { id: 'lead-intake', name: 'AI Lead Intake', description: 'Captures a lead, records it, and forwards it to your connected tools.', trigger: 'Website form or webhook', status: 'active' },
  { id: 'daily-brief', name: 'Daily Operations Brief', description: 'Creates a daily summary for your team from connected sources.', trigger: 'Scheduled daily', status: 'ready' },
  { id: 'follow-up', name: 'Lead Follow-up', description: 'Prepares a follow-up workflow for qualified prospects.', trigger: 'New qualified lead', status: 'ready' }
];

const type = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');
const now = () => new Date().toISOString();

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const file of [LEADS_FILE, RUNS_FILE]) {
    try { await fs.access(file); } catch { await fs.writeFile(file, '[]', 'utf8'); }
  }
}
async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function addJson(file, item) { const entries = await readJson(file); entries.unshift(item); await fs.writeFile(file, JSON.stringify(entries.slice(0, 200), null, 2)); return item; }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function text(res, status, body) { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); }
function authorized(req) { return !API_KEY || req.headers['x-api-key'] === API_KEY; }
async function body(req) {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('Invalid JSON body'); }
}
function clean(value, limit = 1000) { return String(value || '').trim().slice(0, limit); }

async function triggerExternal(lead) {
  const results = [];
  if (N8N_WEBHOOK_URL) {
    try { const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'new_lead', lead }) }); results.push({ service: 'n8n', ok: response.ok }); }
    catch (error) { results.push({ service: 'n8n', ok: false, error: error.message }); }
  }
  if (SLACK_WEBHOOK_URL) {
    try { const response = await fetch(SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `New AstraFlow lead: ${lead.name} (${lead.email}) — ${lead.message}` }) }); results.push({ service: 'slack', ok: response.ok }); }
    catch (error) { results.push({ service: 'slack', ok: false, error: error.message }); }
  }
  return results;
}
async function createLead(input, source = 'website') {
  const lead = { id: crypto.randomUUID(), createdAt: now(), source, name: clean(input.name, 100), email: clean(input.email, 150), company: clean(input.company, 150), phone: clean(input.phone, 40), message: clean(input.message, 2000), status: 'new' };
  if (!lead.name || !lead.email || !lead.message) throw new Error('Name, email, and automation goal are required.');
  await addJson(LEADS_FILE, lead);
  const deliveries = await triggerExternal(lead);
  await addJson(RUNS_FILE, { id: crypto.randomUUID(), workflowId: 'lead-intake', createdAt: now(), status: deliveries.every(item => item.ok) ? 'completed' : (deliveries.length ? 'attention' : 'completed'), summary: `Lead captured from ${source}`, deliveries });
  return lead;
}
async function serveFile(res, pathname) {
  const safe = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(ROOT, safe);
  if (!file.startsWith(ROOT) || path.basename(file).startsWith('.')) return text(res, 403, 'Forbidden');
  try { const content = await fs.readFile(file); res.writeHead(200, { 'Content-Type': type(file) }); res.end(content); }
  catch { text(res, 404, 'Not found'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'AstraFlow Automation Hub', integrations: { n8n: Boolean(N8N_WEBHOOK_URL), slack: Boolean(SLACK_WEBHOOK_URL) } });
    if (url.pathname.startsWith('/api/') && !authorized(req)) return json(res, 401, { error: 'Invalid API key.' });
    if (req.method === 'GET' && url.pathname === '/api/workflows') return json(res, 200, { workflows });
    if (req.method === 'GET' && url.pathname === '/api/leads') return json(res, 200, { leads: await readJson(LEADS_FILE) });
    if (req.method === 'GET' && url.pathname === '/api/runs') return json(res, 200, { runs: await readJson(RUNS_FILE) });
    if (req.method === 'POST' && (url.pathname === '/api/leads' || url.pathname === '/webhooks/lead')) { const lead = await createLead(await body(req), url.pathname === '/webhooks/lead' ? 'webhook' : 'website'); return json(res, 201, { ok: true, lead }); }
    if (req.method === 'POST' && url.pathname.match(/^\/api\/workflows\/[^/]+\/run$/)) {
      const workflowId = url.pathname.split('/')[3]; const workflow = workflows.find(item => item.id === workflowId);
      if (!workflow) return json(res, 404, { error: 'Workflow not found.' });
      const run = { id: crypto.randomUUID(), workflowId, createdAt: now(), status: 'completed', summary: `${workflow.name} test run completed`, deliveries: [] };
      await addJson(RUNS_FILE, run); return json(res, 200, { ok: true, run });
    }
    return serveFile(res, url.pathname);
  } catch (error) { json(res, 400, { error: error.message || 'Request failed.' }); }
});

ensureData().then(() => server.listen(PORT, () => console.log(`AstraFlow Automation Hub running at http://localhost:${PORT}`)));
