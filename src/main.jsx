import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, Code2, Copy, ExternalLink, Globe2, LayoutDashboard, LayoutGrid, List, LockKeyhole,
  LogOut, Megaphone, Menu, MoreHorizontal, Plus, Radio, RefreshCw, Settings2, ShieldCheck,
  SquareActivity, Trash2, X, Zap,
} from 'lucide-react';
import './style.css';

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
const dateLabel = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not checked yet';
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const statusLabel = status => status === 'up' ? 'Operational' : status === 'down' ? 'Outage' : 'Checking';

function Brand({ compact = false }) {
  return <a className={`brand ${compact ? 'brand-compact' : ''}`} href="/">
    <span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span>
    <span>pingward<span className="brand-dot">.</span></span>
  </a>;
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${status || 'pending'}`}><span className="status-dot" />{statusLabel(status)}</span>;
}

function History({ history = [], style = 'bars' }) {
  const byDay = new Map(history.map(item => [item.day, item]));
  const cells = Array.from({ length: 90 }, (_, index) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (89 - index));
    const key = day.toISOString().slice(0, 10);
    const item = byDay.get(key);
    const state = !item ? 'empty' : item.up === item.total ? 'up' : item.up === 0 ? 'down' : 'partial';
    return <span key={key} className={`history-cell history-${state}`} title={`${key}: ${item ? `${item.up}/${item.total} checks up` : 'No checks'}`} />;
  });
  return <div className={`history history-${style}`} aria-label="Uptime history for the past 90 days">{cells}</div>;
}

function MonitorCard({ monitor, barStyle, compact = false }) {
  return <article className={`monitor-card ${compact ? 'monitor-compact' : ''}`}>
    <div className="monitor-top">
      <span className={`monitor-icon monitor-icon-${monitor.status}`}><SquareActivity size={20} /></span>
      <div className="monitor-heading"><h3>{monitor.name}</h3><span>{monitor.type === 'tcp' ? 'TCP service' : 'Website & API'}</span></div>
      <StatusPill status={monitor.status} />
    </div>
    <div className="monitor-meta"><span>90-day uptime <strong>{monitor.uptime == null ? '—' : `${monitor.uptime}%`}</strong></span><span>{monitor.last_response_ms == null ? 'Awaiting first check' : `${monitor.last_response_ms} ms response`}</span></div>
    <History history={monitor.history} style={barStyle} />
    <div className="history-labels"><span>90 days ago</span><span>Today</span></div>
  </article>;
}

function EventCard({ event }) {
  return <article className="event-card">
    <div className={`event-icon event-${event.kind}`}>{event.kind === 'resolved' ? <Check size={17} /> : event.kind === 'maintenance' ? <Settings2 size={17} /> : event.kind === 'incident' ? <Activity size={17} /> : <Megaphone size={17} />}</div>
    <div><div className="event-line"><strong>{event.title}</strong><span>{dateLabel(event.created_at)}</span></div><p>{event.body}</p><span className="event-kind">{event.kind}</span></div>
  </article>;
}

function PublicPage({ embedId = null }) {
  const slug = location.pathname.startsWith('/status/') ? decodeURIComponent(location.pathname.split('/')[2] || '') : '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = () => api(`/public${slug ? `?group=${encodeURIComponent(slug)}` : ''}`).then(value => { if (mounted) setData(value); }).catch(e => { if (mounted) setError(e.message); });
    load();
    const timer = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, [slug]);
  if (error) return <div className="state-page"><Brand /><h1>Page unavailable</h1><p>{error}</p><a className="button" href="/">Back to status</a></div>;
  if (!data) return <div className="loading-screen"><Brand /><div className="loading-pulse" /></div>;
  const selectedGroup = embedId ? data.groups.find(group => group.id === Number(embedId)) : data.groups.find(group => group.id === data.selected_group);
  const monitors = embedId ? data.monitors.filter(monitor => monitor.group_ids.includes(Number(embedId))) : data.monitors;
  const anyDown = monitors.some(monitor => monitor.status === 'down');
  const allUp = monitors.length > 0 && monitors.every(monitor => monitor.status === 'up');
  const overall = anyDown ? 'down' : allUp ? 'up' : 'pending';
  const theme = data.settings.theme;
  return <div className={`site theme-${theme} ${embedId ? 'embed-mode' : ''}`}>
    {!embedId && <header className="public-header"><div className="container nav-inner"><Brand /><nav><a href="/#services">Services</a><a href="/#updates">Updates</a><a className="nav-admin" href="/admin">Dashboard <ArrowRight size={15} /></a></nav></div></header>}
    <main className="container public-main">
      {!embedId && <div className="eyebrow"><span className="eyebrow-line" /> LIVE SYSTEM STATUS</div>}
      <div className="hero-row"><div><h1>{selectedGroup ? selectedGroup.name : data.settings.site_name}<span className="hero-period">.</span></h1><p className="hero-copy">{selectedGroup?.description || data.settings.site_description}</p></div>{!embedId && <span className="updated"><span className="live-dot" /> Updating every 30 seconds</span>}</div>
      <section className={`overview-banner overview-${overall}`}><div className="overview-symbol">{overall === 'up' ? <Check size={26} /> : overall === 'down' ? <Activity size={26} /> : <Clock3 size={26} />}</div><div><strong>{overall === 'up' ? 'All systems operational' : overall === 'down' ? 'Some services are experiencing issues' : 'Waiting for first checks'}</strong><span>{overall === 'up' ? 'Everything is running smoothly.' : overall === 'down' ? 'Our team is aware of the disruption.' : 'Status will appear once monitoring begins.'}</span></div><span className="overview-count">{monitors.length} {monitors.length === 1 ? 'service' : 'services'}</span></section>
      {!embedId && data.groups.length > 0 && <div className="group-nav"><a className={!selectedGroup ? 'selected' : ''} href="/">All services</a>{data.groups.map(group => <a key={group.id} className={selectedGroup?.id === group.id ? 'selected' : ''} href={`/status/${group.slug}`}>{group.name}</a>)}</div>}
      <section id="services" className="section"><div className="section-heading"><div><span className="section-kicker">PERFORMANCE</span><h2>Service health</h2></div><div className="legend"><span><i className="legend-dot legend-up" /> Operational</span><span><i className="legend-dot legend-down" /> Incident</span></div></div>
        {monitors.length ? <div className={`monitor-grid ${data.settings.layout === 'list' ? 'monitor-list' : ''}`}>{monitors.map(monitor => <MonitorCard key={monitor.id} monitor={monitor} barStyle={data.settings.bar_style} compact={Boolean(embedId)} />)}</div> : <div className="empty-panel"><Radio size={26} /><h3>No services yet</h3><p>Monitors added in the dashboard will appear here.</p></div>}
      </section>
      {!embedId && <section id="updates" className="section updates-section"><div className="section-heading"><div><span className="section-kicker">LATEST NEWS</span><h2>Updates & events</h2></div></div>{data.events.length ? <div className="events-list">{data.events.map(event => <EventCard key={event.id} event={event} />)}</div> : <div className="empty-events"><CheckCircle2 size={19} /> No recent events. Things are looking good.</div>}</section>}
    </main>
    {!embedId && <footer className="public-footer"><div className="container"><Brand compact /><span>Transparent status, powered by <a href="https://github.com/ChristianRelf/Pingward" target="_blank" rel="noreferrer">Pingward <ExternalLink size={12} /></a></span></div></footer>}
  </div>;
}

function AuthPage({ setup = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api(setup ? '/setup' : '/login', { method: 'POST', body: { email, password } }); location.href = '/admin'; }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-art"><Brand /><div className="auth-art-content"><span className="section-kicker">YOUR SERVICES, IN SIGHT</span><h1>Peace of mind,<br />one check at a time<span>.</span></h1><p>Know what’s up. Share what matters. Keep your users in the loop.</p><div className="art-status"><span className="live-dot" /> Monitoring made simple <Activity size={44} /></div></div><span className="auth-art-foot">Open source · Self hosted · Your data</span></div><div className="auth-form-area"><div className="auth-mobile-brand"><Brand /></div><form className="auth-form" onSubmit={submit}><span className="form-top-icon"><LockKeyhole size={20} /></span><h2>{setup ? 'Set up your workspace' : 'Welcome back'}</h2><p>{setup ? 'Create the administrator account for this Pingward instance.' : 'Sign in to manage your monitors and status page.'}</p>{error && <div className="form-error">{error}</div>}<label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={setup ? 'At least 12 characters' : 'Your password'} required minLength={setup ? 12 : undefined} autoComplete={setup ? 'new-password' : 'current-password'} /></label><button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : setup ? 'Create admin account' : 'Sign in'} <ArrowRight size={17} /></button><a className="auth-back" href="/">← Back to status page</a></form></div></div>;
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => { const onKey = event => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}</div></div>;
}

function MonitorForm({ initial, groups, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', type: 'http', target: '', port: 443, interval_seconds: 60, timeout_seconds: 10, expected_status: 200, active: true, group_ids: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await onSave(form); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Modal title={initial ? 'Edit monitor' : 'Add a monitor'} subtitle="Pingward starts checking as soon as you save." onClose={onClose}><form onSubmit={submit} className="modal-body">{error && <div className="form-error">{error}</div>}<div className="field-row"><label>Display name<input value={form.name} onChange={e => change('name', e.target.value)} placeholder="Main website" required /></label><label>Check type<select value={form.type} onChange={e => change('type', e.target.value)}><option value="http">HTTP / HTTPS</option><option value="tcp">TCP port</option></select></label></div><div className="field-row"><label className="field-grow">{form.type === 'tcp' ? 'Hostname or IP' : 'Full URL'}<input value={form.target} onChange={e => change('target', e.target.value)} placeholder={form.type === 'tcp' ? 'db.example.com' : 'https://example.com/health'} required /></label>{form.type === 'tcp' && <label className="field-small">Port<input type="number" min="1" max="65535" value={form.port} onChange={e => change('port', Number(e.target.value))} required /></label>}</div><div className="field-row field-three"><label>Interval (seconds)<input type="number" min="30" max="86400" value={form.interval_seconds} onChange={e => change('interval_seconds', Number(e.target.value))} required /></label><label>Timeout (seconds)<input type="number" min="1" max="60" value={form.timeout_seconds} onChange={e => change('timeout_seconds', Number(e.target.value))} required /></label>{form.type === 'http' && <label>Expected HTTP status<input type="number" min="100" max="599" value={form.expected_status} onChange={e => change('expected_status', Number(e.target.value))} required /></label>}</div>{groups.length > 0 && <div className="group-field"><span className="field-label">Show in groups</span><div className="checkbox-grid">{groups.map(group => <label className="checkbox-label" key={group.id}><input type="checkbox" checked={form.group_ids.includes(group.id)} onChange={e => change('group_ids', e.target.checked ? [...form.group_ids, group.id] : form.group_ids.filter(id => id !== group.id))} />{group.name}</label>)}</div></div>}<label className="checkbox-label active-check"><input type="checkbox" checked={Boolean(form.active)} onChange={e => change('active', e.target.checked)} /> Monitoring active</label><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save monitor'} <ArrowRight size={16} /></button></div></form></Modal>;
}

function GroupForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', slug: '', description: '', custom_domain: '' });
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const changeName = value => setForm(current => ({ ...current, name: value, slug: slugEdited ? current.slug : slugify(value) }));
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await onSave(form); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Modal title={initial ? 'Edit group' : 'Create a group'} subtitle="Group related monitors into a focused status view." onClose={onClose}><form className="modal-body" onSubmit={submit}>{error && <div className="form-error">{error}</div>}<label>Group name<input value={form.name} onChange={e => changeName(e.target.value)} placeholder="Core infrastructure" required /></label><label>Page slug<input value={form.slug} onChange={e => { setSlugEdited(true); setForm({ ...form, slug: e.target.value }); }} placeholder="core-infrastructure" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /><small>Available at /status/{form.slug || 'your-group'}</small></label><label>Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="A short description for this group" /></label><label>Custom domain <span className="optional">optional</span><input value={form.custom_domain} onChange={e => setForm({ ...form, custom_domain: e.target.value })} placeholder="status.example.com" /><small>Point this domain to your Pingward host and configure HTTPS on your reverse proxy.</small></label><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save group'} <ArrowRight size={16} /></button></div></form></Modal>;
}

function EventForm({ initial, groups, onSave, onClose }) {
  const [form, setForm] = useState(initial || { title: '', body: '', kind: 'info', group_id: '', published: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await onSave(form); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Modal title={initial ? 'Edit update' : 'Post an update'} subtitle="Keep visitors informed about maintenance, incidents and news." onClose={onClose}><form className="modal-body" onSubmit={submit}>{error && <div className="form-error">{error}</div>}<label>Headline<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Scheduled maintenance tonight" required /></label><div className="field-row"><label>Type<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="info">News</option><option value="maintenance">Maintenance</option><option value="incident">Incident</option><option value="resolved">Resolved</option></select></label><label>Show on<select value={form.group_id || ''} onChange={e => setForm({ ...form, group_id: e.target.value ? Number(e.target.value) : '' })}><option value="">All status pages</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div><label>Details<textarea rows="5" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Tell visitors what is happening…" /></label><label className="checkbox-label active-check"><input type="checkbox" checked={Boolean(form.published)} onChange={e => setForm({ ...form, published: e.target.checked })} /> Published</label><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save update'} <ArrowRight size={16} /></button></div></form></Modal>;
}

function AdminPage({ admin }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('tab') || 'overview');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [settingsForm, setSettingsForm] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [mobileNav, setMobileNav] = useState(false);
  async function reload() { const value = await api('/admin/data'); setData(value); setSettingsForm(value.settings); }
  useEffect(() => { reload().catch(e => setError(e.message)); }, []);
  function showTab(next) { setTab(next); setMobileNav(false); history.replaceState(null, '', `/admin?tab=${next}`); }
  async function mutate(path, method, body, message) { await api(path, { method, body }); await reload(); setNotice(message); setError(''); setTimeout(() => setNotice(''), 4000); }
  function confirmDelete(kind, item) { if (confirm(`Delete ${kind} “${item.name || item.title}”? This cannot be undone.`)) mutate(`/admin/${kind}s/${item.id}`, 'DELETE', null, `${kind} deleted.`).catch(e => setError(e.message)); }
  async function logout() { await api('/logout', { method: 'POST' }); location.href = '/login'; }
  const nav = [
    ['overview', LayoutDashboard, 'Overview'], ['monitors', Activity, 'Monitors'], ['groups', LayoutGrid, 'Groups'],
    ['events', Megaphone, 'Updates'], ['appearance', Settings2, 'Appearance'], ['notifications', Bell, 'Notifications'], ['security', LockKeyhole, 'Security'],
  ];
  const titles = { overview: ['Overview', 'Your services at a glance.'], monitors: ['Monitors', 'Watch over every important endpoint.'], groups: ['Groups', 'Curated status views for your audience.'], events: ['Updates & events', 'Keep your visitors in the loop.'], appearance: ['Appearance', 'Make your status page feel like yours.'], notifications: ['Notifications', 'Bring your own SMTP server.'], security: ['Security', 'Manage your administrator password.'] };
  const down = data?.monitors.filter(item => item.status === 'down' && item.active).length || 0;
  const up = data?.monitors.filter(item => item.status === 'up' && item.active).length || 0;
  const pending = data?.monitors.filter(item => item.status === 'pending' && item.active).length || 0;
  return <div className="admin-shell"><aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Brand /><span className="sidebar-label">WORKSPACE</span><div className="sidebar-nav">{nav.map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => showTab(key)}><Icon size={18} /><span>{label}</span>{key === 'monitors' && data?.monitors.length > 0 && <small>{data.monitors.length}</small>}</button>)}</div></div><div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={17} /> View status page</a><button onClick={logout}><LogOut size={17} /> Sign out</button><div className="admin-user"><span>{admin.email[0].toUpperCase()}</span><div><strong>Administrator</strong><small>{admin.email}</small></div></div></div></aside><div className="admin-main"><header className="admin-header"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu"><Menu size={21} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{titles[tab]?.[0] || 'Overview'}</strong></div><div className="header-actions"><span className="header-live"><span className="live-dot" /> Live monitoring</span><a href="/" target="_blank" rel="noreferrer" className="header-view">View status <ExternalLink size={15} /></a></div></header><main className="admin-content">{error && <div className="form-error page-alert">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}{notice && <div className="success-alert"><Check size={16} /> {notice}</div>}<div className="page-heading"><div><span className="section-kicker">PINGWARD / {tab.toUpperCase()}</span><h1>{titles[tab]?.[0]}</h1><p>{titles[tab]?.[1]}</p></div>{tab === 'monitors' && <button className="button button-primary" onClick={() => setModal({ kind: 'monitor' })}><Plus size={18} /> Add monitor</button>}{tab === 'groups' && <button className="button button-primary" onClick={() => setModal({ kind: 'group' })}><Plus size={18} /> New group</button>}{tab === 'events' && <button className="button button-primary" onClick={() => setModal({ kind: 'event' })}><Plus size={18} /> Post update</button>}</div>
      {!data ? <div className="loading-inline">Loading workspace…</div> : <>
        {tab === 'overview' && <><div className="stats-grid"><div className="stat-card"><span className="stat-icon stat-green"><Activity size={20} /></span><span>Active monitors</span><strong>{data.monitors.filter(item => item.active).length}</strong><small>Checking your services</small></div><div className="stat-card"><span className="stat-icon stat-green"><CheckCircle2 size={20} /></span><span>Operational</span><strong>{up}</strong><small>Running smoothly</small></div><div className="stat-card"><span className="stat-icon stat-red"><ArrowDownRight size={20} /></span><span>Issues detected</span><strong>{down}</strong><small>Needs your attention</small></div><div className="stat-card"><span className="stat-icon stat-blue"><Globe2 size={20} /></span><span>Status groups</span><strong>{data.groups.length}</strong><small>Public collections</small></div></div><div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><h2>Service overview</h2><p>Latest check for each monitor</p></div><button className="text-button" onClick={() => showTab('monitors')}>View all <ArrowRight size={15} /></button></div>{data.monitors.length ? <div className="simple-list">{data.monitors.slice(0, 6).map(item => <div className="simple-row" key={item.id}><span className={`mini-status mini-${item.active ? item.status : 'paused'}`} /><div><strong>{item.name}</strong><small>{item.target}{item.port ? `:${item.port}` : ''}</small></div><StatusPill status={item.active ? item.status : 'pending'} /></div>)}</div> : <div className="panel-empty"><Radio size={26} /><h3>Start monitoring</h3><p>Add your first endpoint to see its health here.</p><button className="button button-primary" onClick={() => setModal({ kind: 'monitor' })}><Plus size={16} /> Add monitor</button></div>}</section><section className="panel"><div className="panel-heading"><div><h2>Recent updates</h2><p>What your visitors see</p></div><button className="text-button" onClick={() => showTab('events')}>View all <ArrowRight size={15} /></button></div>{data.events.length ? <div className="simple-list">{data.events.slice(0, 4).map(item => <div className="simple-row" key={item.id}><span className={`event-icon event-${item.kind}`}><Megaphone size={15} /></span><div><strong>{item.title}</strong><small>{dateLabel(item.created_at)}</small></div></div>)}</div> : <div className="panel-empty"><Megaphone size={26} /><h3>Nothing to report</h3><p>Publish news or incident updates for visitors.</p><button className="button button-outline" onClick={() => setModal({ kind: 'event' })}>Post an update</button></div>}</section></div><div className="quick-tip"><Zap size={19} /><div><strong>Make status easy to share</strong><span>Create a group to get a dedicated page and embeddable view for your services.</span></div><button onClick={() => showTab('groups')}>Explore groups <ArrowRight size={16} /></button></div></>}
        {tab === 'monitors' && <section className="panel table-panel">{data.monitors.length ? <><div className="table-head"><span>MONITOR</span><span>STATUS</span><span>UPTIME (90D)</span><span>LAST CHECK</span><span>ACTIONS</span></div>{data.monitors.map(item => <div className="table-row" key={item.id}><div className="table-name"><span className={`table-icon mini-${item.active ? item.status : 'paused'}`}><Activity size={19} /></span><div><strong>{item.name}</strong><small>{item.target}{item.port ? `:${item.port}` : ''}</small></div></div><StatusPill status={item.active ? item.status : 'pending'} /><div className="table-uptime"><strong>{(() => { const total = item.history.reduce((n, h) => n + h.total, 0); const upCount = item.history.reduce((n, h) => n + h.up, 0); return total ? `${(upCount / total * 100).toFixed(2)}%` : '—'; })()}</strong><History history={item.history} style="bars" /></div><span className="table-date">{dateLabel(item.last_checked_at)}</span><div className="row-actions"><button title="Check now" onClick={() => mutate(`/admin/monitors/${item.id}/check`, 'POST', null, 'Check complete.').catch(e => setError(e.message))}><RefreshCw size={16} /></button><button title="Edit" onClick={() => setModal({ kind: 'monitor', item })}><Settings2 size={16} /></button><button title="Delete" onClick={() => confirmDelete('monitor', item)}><Trash2 size={16} /></button></div></div>)}</> : <div className="panel-empty spacious"><Radio size={30} /><h3>No monitors yet</h3><p>Add a URL or TCP port and Pingward will start checking it right away.</p><button className="button button-primary" onClick={() => setModal({ kind: 'monitor' })}><Plus size={16} /> Add your first monitor</button></div>}</section>}
        {tab === 'groups' && <>{data.groups.length ? <div className="group-card-grid">{data.groups.map(group => { const count = data.monitors.filter(item => item.group_ids.includes(group.id)).length; const base = data.settings.public_url?.replace(/\/$/, '') || location.origin; const url = `${base}/status/${group.slug}`; return <article className="group-card" key={group.id}><div className="group-card-top"><span className="group-card-icon"><LayoutGrid size={22} /></span><div className="row-actions"><button title="Edit" onClick={() => setModal({ kind: 'group', item: group })}><Settings2 size={17} /></button><button title="Delete" onClick={() => confirmDelete('group', group)}><Trash2 size={17} /></button></div></div><h3>{group.name}</h3><p>{group.description || 'A focused status page for this group.'}</p><div className="group-card-meta"><span><Activity size={15} /> {count} {count === 1 ? 'monitor' : 'monitors'}</span>{group.custom_domain && <span><Globe2 size={15} /> {group.custom_domain}</span>}</div><div className="group-card-actions"><a href={`/status/${group.slug}`} target="_blank" rel="noreferrer">View page <ExternalLink size={14} /></a><button onClick={() => { navigator.clipboard.writeText(`<iframe src="${base}/embed/${group.id}" title="${group.name} status" width="100%" height="500" frameborder="0"></iframe>`).then(() => setNotice('Embed code copied.')).catch(e => setError(e.message)); }}><Code2 size={15} /> Copy embed</button></div></article>; })}</div> : <div className="panel panel-empty spacious"><LayoutGrid size={30} /><h3>Create your first group</h3><p>Give related monitors a dedicated public page and iframe embed.</p><button className="button button-primary" onClick={() => setModal({ kind: 'group' })}><Plus size={16} /> Create group</button></div>}<div className="info-note"><CircleHelp size={18} /><span>Add monitors to groups by editing each monitor. A monitor can appear in multiple groups.</span></div></>}
        {tab === 'events' && <section className="panel event-admin-list">{data.events.length ? data.events.map(item => <div className="admin-event" key={item.id}><span className={`event-icon event-${item.kind}`}><Megaphone size={17} /></span><div><div><strong>{item.title}</strong><span className="event-kind">{item.kind}</span>{!item.published && <span className="draft-badge">Draft</span>}</div><p>{item.body || 'No details added.'}</p><small>{dateLabel(item.created_at)} · {item.group_id ? data.groups.find(group => group.id === item.group_id)?.name || 'Group removed' : 'All pages'}</small></div><div className="row-actions"><button title="Edit" onClick={() => setModal({ kind: 'event', item })}><Settings2 size={17} /></button><button title="Delete" onClick={() => confirmDelete('event', item)}><Trash2 size={17} /></button></div></div>) : <div className="panel-empty spacious"><Megaphone size={30} /><h3>No updates yet</h3><p>Post incident reports, planned maintenance or other news.</p><button className="button button-primary" onClick={() => setModal({ kind: 'event' })}><Plus size={16} /> Post an update</button></div>}</section>}
        {tab === 'appearance' && settingsForm && <form className="settings-grid" onSubmit={e => { e.preventDefault(); mutate('/admin/settings', 'PUT', settingsForm, 'Appearance saved.').catch(e => setError(e.message)); }}><section className="panel settings-panel"><div className="settings-panel-head"><span className="settings-icon"><Globe2 size={20} /></span><div><h2>Status page details</h2><p>The basics visitors see when they open your page.</p></div></div><label>Site name<input value={settingsForm.site_name} onChange={e => setSettingsForm({ ...settingsForm, site_name: e.target.value })} required /></label><label>Description<textarea rows="3" value={settingsForm.site_description} onChange={e => setSettingsForm({ ...settingsForm, site_description: e.target.value })} /></label><label>Public URL<input value={settingsForm.public_url} onChange={e => setSettingsForm({ ...settingsForm, public_url: e.target.value })} placeholder="https://status.example.com" /><small>Used in email alerts and embed snippets. Leave blank to use the current domain.</small></label></section><section className="panel settings-panel"><div className="settings-panel-head"><span className="settings-icon"><LayoutGrid size={20} /></span><div><h2>Display options</h2><p>Choose a theme and how health history appears.</p></div></div><span className="field-label">Theme</span><div className="choice-row">{[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([value, label]) => <button type="button" key={value} className={`choice ${settingsForm.theme === value ? 'chosen' : ''}`} onClick={() => setSettingsForm({ ...settingsForm, theme: value })}>{label}{settingsForm.theme === value && <Check size={15} />}</button>)}</div><span className="field-label">Page layout</span><div className="choice-row">{[['grid', LayoutGrid, 'Grid'], ['list', List, 'List']].map(([value, Icon, label]) => <button type="button" key={value} className={`choice ${settingsForm.layout === value ? 'chosen' : ''}`} onClick={() => setSettingsForm({ ...settingsForm, layout: value })}><Icon size={17} />{label}</button>)}</div><span className="field-label">Uptime history</span><div className="choice-row">{[['bars', 'Uptime bars'], ['heatmap', 'Git-style graph']].map(([value, label]) => <button type="button" key={value} className={`choice ${settingsForm.bar_style === value ? 'chosen' : ''}`} onClick={() => setSettingsForm({ ...settingsForm, bar_style: value })}>{label}</button>)}</div></section><div className="settings-actions"><button className="button button-primary">Save appearance <ArrowRight size={16} /></button></div></form>}
        {tab === 'notifications' && settingsForm && <form className="panel settings-panel notification-panel" onSubmit={e => { e.preventDefault(); mutate('/admin/settings', 'PUT', settingsForm, 'SMTP settings saved.').catch(e => setError(e.message)); }}><div className="settings-panel-head"><span className="settings-icon"><Bell size={20} /></span><div><h2>Email alerts via your SMTP server</h2><p>Pingward emails you when a monitor changes state. Your credentials stay on this host.</p></div></div><div className="field-row"><label>SMTP host<input value={settingsForm.smtp_host} onChange={e => setSettingsForm({ ...settingsForm, smtp_host: e.target.value })} placeholder="smtp.example.com" /></label><label className="field-small">Port<input type="number" min="1" max="65535" value={settingsForm.smtp_port} onChange={e => setSettingsForm({ ...settingsForm, smtp_port: e.target.value })} /></label></div><div className="field-row"><label>Username<input value={settingsForm.smtp_user} onChange={e => setSettingsForm({ ...settingsForm, smtp_user: e.target.value })} autoComplete="off" placeholder="username" /></label><label>Password<input type="password" value={settingsForm.smtp_password || ''} onChange={e => setSettingsForm({ ...settingsForm, smtp_password: e.target.value })} autoComplete="new-password" placeholder="Leave blank to keep saved password" /></label></div><label className="checkbox-label active-check"><input type="checkbox" checked={settingsForm.smtp_secure === 'true'} onChange={e => setSettingsForm({ ...settingsForm, smtp_secure: String(e.target.checked) })} /> Use implicit TLS (usually port 465)</label><div className="field-row"><label>From address<input type="email" value={settingsForm.smtp_from} onChange={e => setSettingsForm({ ...settingsForm, smtp_from: e.target.value })} placeholder="status@example.com" /></label><label>Alert recipient<input value={settingsForm.smtp_to} onChange={e => setSettingsForm({ ...settingsForm, smtp_to: e.target.value })} placeholder="team@example.com" /></label></div><div className="settings-actions inline-actions"><button className="button button-primary">Save SMTP settings <ArrowRight size={16} /></button><button type="button" className="button button-outline" onClick={() => api('/admin/smtp/test', { method: 'POST' }).then(() => setNotice('Test email sent.')).catch(e => setError(e.message))}>Send test email</button></div></form>}
        {tab === 'security' && <form className="panel settings-panel notification-panel" onSubmit={e => { e.preventDefault(); api('/admin/password', { method: 'PUT', body: passwordForm }).then(() => { setNotice('Password changed. Sign in again.'); setTimeout(() => { location.href = '/login'; }, 1500); }).catch(e => setError(e.message)); }}><div className="settings-panel-head"><span className="settings-icon"><ShieldCheck size={20} /></span><div><h2>Change admin password</h2><p>Changing the password signs out all active sessions.</p></div></div><label>Current password<input type="password" value={passwordForm.current_password} onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required autoComplete="current-password" /></label><label>New password<input type="password" minLength="12" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required autoComplete="new-password" /><small>At least 12 characters.</small></label><div className="settings-actions"><button className="button button-primary">Update password <ArrowRight size={16} /></button></div></form>}
      </>}</main></div>
      {modal?.kind === 'monitor' && <MonitorForm initial={modal.item} groups={data?.groups || []} onClose={() => setModal(null)} onSave={form => mutate(`/admin/monitors${modal.item ? `/${modal.item.id}` : ''}`, modal.item ? 'PUT' : 'POST', form, modal.item ? 'Monitor updated.' : 'Monitor added.')} />}
      {modal?.kind === 'group' && <GroupForm initial={modal.item} onClose={() => setModal(null)} onSave={form => mutate(`/admin/groups${modal.item ? `/${modal.item.id}` : ''}`, modal.item ? 'PUT' : 'POST', form, modal.item ? 'Group updated.' : 'Group created.')} />}
      {modal?.kind === 'event' && <EventForm initial={modal.item} groups={data?.groups || []} onClose={() => setModal(null)} onSave={form => mutate(`/admin/events${modal.item ? `/${modal.item.id}` : ''}`, modal.item ? 'PUT' : 'POST', form, modal.item ? 'Update saved.' : 'Update posted.')} />}
    </div>;
}

function App() {
  const [bootstrap, setBootstrap] = useState(null);
  useEffect(() => { api('/bootstrap').then(setBootstrap).catch(() => setBootstrap({ needs_setup: false, admin: null })); }, []);
  const path = location.pathname;
  if (path.startsWith('/embed/')) return <PublicPage embedId={Number(path.split('/')[2])} />;
  if (!path.startsWith('/admin') && path !== '/login' && path !== '/setup') return <PublicPage />;
  if (!bootstrap) return <div className="loading-screen"><Brand /><div className="loading-pulse" /></div>;
  if (bootstrap.needs_setup) return <AuthPage setup />;
  if (!bootstrap.admin) return <AuthPage />;
  return <AdminPage admin={bootstrap.admin} />;
}

createRoot(document.getElementById('root')).render(<App />);
