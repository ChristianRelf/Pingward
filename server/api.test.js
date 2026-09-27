import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const testDir = mkdtempSync(join(tmpdir(), 'pingward-test-'));
process.env.DATA_DIR = testDir;
const { app } = await import('./index.js');

test('admin can set up an instance, monitor a URL, and publish a grouped status page', async t => {
  const target = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const checkTarget = await new Promise(resolve => {
    const server = createServer((_req, res) => { res.writeHead(200); res.end('healthy'); });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  t.after(() => { target.close(); checkTarget.close(); rmSync(testDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${target.address().port}`;
  const checkUrl = `http://127.0.0.1:${checkTarget.address().port}/health`;
  let cookie = '';
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json() };
  }

  assert.equal((await request('/bootstrap')).body.needs_setup, true);
  const setup = await request('/setup', 'POST', { email: 'admin@example.com', password: 'strong-password-123' });
  assert.equal(setup.status, 201);
  assert.equal((await request('/bootstrap')).body.admin.email, 'admin@example.com');
  assert.equal((await request('/setup', 'POST', { email: 'other@example.com', password: 'strong-password-123' })).status, 409);

  const group = await request('/admin/groups', 'POST', { name: 'Core services', slug: 'core-services', description: 'Essential systems', custom_domain: 'status.example.com' });
  assert.equal(group.status, 201);
  const groupId = group.body.id;
  const monitor = await request('/admin/monitors', 'POST', {
    name: 'Website', type: 'http', target: checkUrl, interval_seconds: 60, timeout_seconds: 10,
    expected_status: 200, active: true, group_ids: [groupId],
  });
  assert.equal(monitor.status, 201);
  const monitorId = monitor.body.id;
  const check = await request(`/admin/monitors/${monitorId}/check`, 'POST');
  assert.ok(check.body.status === 'up' || check.body.busy);
  if (check.body.busy) await new Promise(resolve => setTimeout(resolve, 100));

  const event = await request('/admin/events', 'POST', { title: 'Welcome', body: 'Monitoring is live.', kind: 'info', group_id: groupId, published: true });
  assert.equal(event.status, 201);
  const page = await request('/public?group=core-services');
  assert.equal(page.body.selected_group, groupId);
  assert.equal(page.body.monitors[0].name, 'Website');
  assert.equal(page.body.monitors[0].status, 'up');
  assert.equal(page.body.monitors[0].uptime, 100);
  assert.equal(page.body.events[0].title, 'Welcome');
  assert.equal((await request('/public?group=missing')).status, 404);

  const settings = await request('/admin/settings', 'PUT', {
    site_name: 'Example Status', site_description: 'Systems', theme: 'dark', layout: 'list', bar_style: 'heatmap',
    public_url: 'https://status.example.com', smtp_host: '', smtp_port: '587', smtp_user: '',
    smtp_from: '', smtp_to: '', smtp_secure: 'false',
  });
  assert.equal(settings.status, 200);
  assert.equal((await request('/public')).body.settings.bar_style, 'heatmap');
  assert.equal((await request('/admin/data')).body.monitors[0].group_ids[0], groupId);

  assert.equal((await request(`/admin/monitors/${monitorId}`, 'DELETE')).status, 200);
  assert.equal((await request('/public')).body.monitors.length, 0);
  assert.equal((await request('/logout', 'POST')).status, 200);
  assert.equal((await request('/admin/data')).status, 401);
  assert.equal((await request('/login', 'POST', { email: 'admin@example.com', password: 'strong-password-123' })).status, 200);
});
