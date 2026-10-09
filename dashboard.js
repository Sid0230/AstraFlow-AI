const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const ago = value => { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value)) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)} min ago` : `${Math.floor(seconds / 3600)} hr ago`; };
const apiKey = sessionStorage.getItem('astraflow-api-key') || prompt('Enter your Automation Hub API key');
if (apiKey) sessionStorage.setItem('astraflow-api-key', apiKey);
async function get(url) { const response = await fetch(url, { headers: apiKey ? { 'x-api-key': apiKey } : {} }); if (!response.ok) throw new Error(response.status === 401 ? 'Invalid Automation Hub API key.' : 'Unable to load hub data'); return response.json(); }
async function load() {
  try {
    const [health, workflowData, leadData, runData] = await Promise.all([get('/api/health'), get('/api/workflows'), get('/api/leads'), get('/api/runs')]);
    $('#lead-count').textContent = leadData.leads.length;
    $('#workflow-count').textContent = workflowData.workflows.length;
    $('#last-activity').textContent = runData.runs[0] ? ago(runData.runs[0].createdAt) : 'No runs';
    $('#integration-status').textContent = `n8n ${health.integrations.n8n ? 'connected' : 'not connected'} · Slack ${health.integrations.slack ? 'connected' : 'not connected'}`;
    $('#workflows').innerHTML = workflowData.workflows.map(w => `<article class="workflow-row"><div><small>${escape(w.trigger).toUpperCase()}</small><h3>${escape(w.name)}</h3><p>${escape(w.description)}</p></div><button class="button outline run-button" data-workflow="${escape(w.id)}">Test run →</button></article>`).join('');
    $('#leads').innerHTML = leadData.leads.length ? leadData.leads.slice(0, 6).map(l => `<article class="lead"><strong>${escape(l.name)} <small>· ${escape(l.company || 'Independent')}</small></strong><p>${escape(l.message)}</p><small>${escape(l.email)} · ${ago(l.createdAt)}</small></article>`).join('') : '<p class="empty">No leads yet. Website enquiries will appear here.</p>';
    $('#runs').innerHTML = runData.runs.length ? runData.runs.slice(0, 8).map(r => `<article class="run-row"><i class="run-state"></i><div><strong>${escape(r.summary)}</strong><span>${escape(r.status)} · ${ago(r.createdAt)}</span></div></article>`).join('') : '<p class="empty">No workflow runs yet.</p>';
    document.querySelectorAll('[data-workflow]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; button.textContent = 'Running…'; await fetch(`/api/workflows/${button.dataset.workflow}/run`, { method: 'POST', headers: apiKey ? { 'x-api-key': apiKey } : {} }); await load(); }));
  } catch (error) { $('#integration-status').textContent = error.message; }
}
$('#refresh').addEventListener('click', load); load();
