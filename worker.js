// Cloudflare Workers production runtime for the AstraFlow Automation Hub.
// It serves the website and stores leads/workflow activity in Cloudflare D1.

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (value, length = 1000) => String(value || '').trim().slice(0, length);
const protectedApi = request => request.headers.get('x-api-key') || '';
const secure = (request, env) => !env.ASTRAFLOW_API_KEY || protectedApi(request) === env.ASTRAFLOW_API_KEY;

async function notify(env, lead) {
  const results = [];
  if (env.N8N_WEBHOOK_URL) {
    try { const response = await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'new_lead', lead }) }); results.push({ service: 'n8n', ok: response.ok }); }
    catch { results.push({ service: 'n8n', ok: false }); }
  }
  if (env.SLACK_WEBHOOK_URL) {
    try { const response = await fetch(env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `New AstraFlow lead: ${lead.name} (${lead.email}) — ${lead.message}` }) }); results.push({ service: 'slack', ok: response.ok }); }
    catch { results.push({ service: 'slack', ok: false }); }
  }
  return results;
}
async function logRun(env, workflowId, status, summary) {
  await env.DB.prepare('INSERT INTO runs (id, workflow_id, status, summary, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), workflowId, status, summary, new Date().toISOString()).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/webhooks')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'AstraFlow Automation Hub', integrations: { n8n: Boolean(env.N8N_WEBHOOK_URL), slack: Boolean(env.SLACK_WEBHOOK_URL) } });
    if (url.pathname.startsWith('/api/') && !secure(request, env)) return json({ error: 'Invalid API key.' }, 401);
    try {
      if (request.method === 'GET' && url.pathname === '/api/workflows') return json({ workflows: [
        { id: 'lead-intake', name: 'AI Lead Intake', description: 'Captures a lead and forwards it to your connected tools.', trigger: 'Website form or webhook', status: 'active' },
        { id: 'daily-brief', name: 'Daily Operations Brief', description: 'Creates a daily summary for your team.', trigger: 'Scheduled daily', status: 'ready' },
        { id: 'follow-up', name: 'Lead Follow-up', description: 'Prepares a follow-up workflow for qualified prospects.', trigger: 'New qualified lead', status: 'ready' }
      ] });
      if (request.method === 'GET' && url.pathname === '/api/leads') return json({ leads: (await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200').all()).results });
      if (request.method === 'GET' && url.pathname === '/api/runs') return json({ runs: (await env.DB.prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT 200').all()).results });
      if (request.method === 'POST' && (url.pathname === '/api/leads' || url.pathname === '/webhooks/lead')) {
        const input = await request.json(); const lead = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: url.pathname === '/webhooks/lead' ? 'webhook' : 'website', name: clean(input.name, 100), email: clean(input.email, 150), company: clean(input.company, 150), phone: clean(input.phone, 40), message: clean(input.message, 2000), status: 'new' };
        if (!lead.name || !lead.email || !lead.message) return json({ error: 'Name, email, and automation goal are required.' }, 400);
        await env.DB.prepare('INSERT INTO leads (id, created_at, source, name, email, company, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(lead.id, lead.createdAt, lead.source, lead.name, lead.email, lead.company, lead.phone, lead.message, lead.status).run();
        const deliveries = await notify(env, lead); await logRun(env, 'lead-intake', deliveries.every(item => item.ok) ? 'completed' : 'attention', `Lead captured from ${lead.source}`);
        return json({ ok: true, lead }, 201);
      }
      if (request.method === 'POST' && /^\/api\/workflows\/[^/]+\/run$/.test(url.pathname)) { const id = url.pathname.split('/')[3]; await logRun(env, id, 'completed', `${id} test run completed`); return json({ ok: true }); }
      return json({ error: 'Not found.' }, 404);
    } catch (error) { return json({ error: error.message || 'Request failed.' }, 400); }
  }
};
