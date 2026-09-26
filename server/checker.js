import net from 'node:net';
import nodemailer from 'nodemailer';
import { db, settings } from './db.js';

export function validateMonitor(input) {
  const name = String(input.name || '').trim();
  const type = input.type === 'tcp' ? 'tcp' : 'http';
  const target = String(input.target || '').trim();
  const port = type === 'tcp' ? Number(input.port) : null;
  const interval = Number(input.interval_seconds || 60);
  const timeout = Number(input.timeout_seconds || 10);
  const expected = Number(input.expected_status || 200);
  if (!name || name.length > 100) throw new Error('Name must be 1–100 characters.');
  if (type === 'http') {
    let url;
    try { url = new URL(target); } catch { throw new Error('Enter a full HTTP or HTTPS URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a full HTTP or HTTPS URL without credentials.');
  } else if (!/^[a-zA-Z0-9.:-]+$/.test(target) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Enter a hostname or IP address and a port from 1–65535.');
  }
  if (!Number.isInteger(interval) || interval < 30 || interval > 86400) throw new Error('Interval must be 30–86400 seconds.');
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60 || timeout >= interval) throw new Error('Timeout must be shorter than the interval.');
  if (!Number.isInteger(expected) || expected < 100 || expected > 599) throw new Error('Expected status must be 100–599.');
  const groupIds = [...new Set((Array.isArray(input.group_ids) ? input.group_ids : []).map(Number))];
  if (groupIds.some(id => !Number.isInteger(id) || id < 1)) throw new Error('Invalid group.');
  return { name, type, target, port, interval, timeout, expected, active: input.active === false ? 0 : 1, groupIds };
}

async function checkHttp(monitor) {
  const response = await fetch(monitor.target, {
    method: 'GET',
    signal: AbortSignal.timeout(monitor.timeout_seconds * 1000),
    redirect: 'follow',
    headers: { 'User-Agent': 'Pingward/0.1 (+self-hosted uptime monitor)' },
  });
  await response.body?.cancel();
  return { up: response.status === monitor.expected_status, error: response.status === monitor.expected_status ? null : `HTTP ${response.status} (expected ${monitor.expected_status})` };
}

function checkTcp(monitor) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: monitor.target, port: monitor.port });
    socket.setTimeout(monitor.timeout_seconds * 1000);
    socket.once('connect', () => { socket.destroy(); resolve({ up: true, error: null }); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')); });
    socket.once('error', error => { socket.destroy(); reject(error); });
  });
}

export async function sendAlert(monitor, previous, current, error) {
  const config = settings(true);
  if (!config.smtp_host || !config.smtp_from || !config.smtp_to) return;
  const transport = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_port) || 587,
    secure: config.smtp_secure === 'true',
    auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_password } : undefined,
  });
  await transport.sendMail({
    from: config.smtp_from,
    to: config.smtp_to,
    subject: `[${config.site_name}] ${monitor.name} is ${current.toUpperCase()}`,
    text: `${monitor.name} changed from ${previous} to ${current}.\nTarget: ${monitor.target}${monitor.port ? `:${monitor.port}` : ''}\n${error ? `Detail: ${error}\n` : ''}${config.public_url ? `Status: ${config.public_url}\n` : ''}`,
  });
}

const running = new Set();
export async function runCheck(monitor) {
  if (running.has(monitor.id)) return;
  running.add(monitor.id);
  const started = Date.now();
  let result;
  try {
    result = monitor.type === 'tcp' ? await checkTcp(monitor) : await checkHttp(monitor);
  } catch (error) {
    result = { up: false, error: String(error.message || error).slice(0, 300) };
  }
  const status = result.up ? 'up' : 'down';
  const responseMs = Date.now() - started;
  const checkedAt = new Date().toISOString();
  db.prepare('INSERT INTO checks (monitor_id, checked_at, status, response_ms, error) VALUES (?, ?, ?, ?, ?)')
    .run(monitor.id, checkedAt, status, responseMs, result.error);
  db.prepare('UPDATE monitors SET status = ?, last_checked_at = ?, last_response_ms = ?, last_error = ? WHERE id = ?')
    .run(status, checkedAt, responseMs, result.error, monitor.id);
  if (monitor.status !== status) sendAlert(monitor, monitor.status, status, result.error).catch(error => console.error('SMTP alert failed:', error.message));
  running.delete(monitor.id);
  return { status, response_ms: responseMs, error: result.error };
}

let scheduler;
export function startScheduler() {
  if (scheduler) return;
  async function tick() {
    const monitors = db.prepare('SELECT * FROM monitors WHERE active = 1').all();
    for (const monitor of monitors) {
      const last = monitor.last_checked_at ? Date.parse(monitor.last_checked_at) : 0;
      if (Date.now() - last >= monitor.interval_seconds * 1000 && !running.has(monitor.id)) void runCheck(monitor);
    }
  }
  void tick();
  scheduler = setInterval(tick, 5000);
  scheduler.unref();
  const pruning = setInterval(() => {
    db.prepare('DELETE FROM checks WHERE checked_at < ?').run(new Date(Date.now() - 91 * 86400000).toISOString());
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }, 86400000);
  pruning.unref();
}
