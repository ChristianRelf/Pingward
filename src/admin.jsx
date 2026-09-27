import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CircleHelp,
  Code2,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LayoutGrid,
  List,
  LockKeyhole,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api, dateLabel } from "./api";
import { Brand, StatusPill, History } from "./ui";
import { MonitorLogo } from "./monitor-logo";
import { MonitorForm, GroupForm, EventForm } from "./forms";

export function AdminPage({ admin }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(
    new URLSearchParams(location.search).get("tab") || "overview",
  );
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [settingsForm, setSettingsForm] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [mobileNav, setMobileNav] = useState(false);
  async function reload() {
    const value = await api("/admin/data");
    setData(value);
    setSettingsForm(value.settings);
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);
  function showTab(next) {
    setTab(next);
    setMobileNav(false);
    history.replaceState(null, "", `/admin?tab=${next}`);
  }
  async function mutate(path, method, body, message) {
    await api(path, { method, body });
    await reload();
    setNotice(message);
    setError("");
    setTimeout(() => setNotice(""), 4000);
  }
  function confirmDelete(kind, item) {
    if (
      confirm(
        `Delete ${kind} “${item.name || item.title}”? This cannot be undone.`,
      )
    )
      mutate(
        `/admin/${kind}s/${item.id}`,
        "DELETE",
        null,
        `${kind} deleted.`,
      ).catch((e) => setError(e.message));
  }
  async function logout() {
    await api("/logout", { method: "POST" });
    location.href = "/login";
  }
  const nav = [
    ["overview", LayoutDashboard, "Overview"],
    ["monitors", Activity, "Monitors"],
    ["groups", LayoutGrid, "Groups"],
    ["events", Megaphone, "Updates"],
    ["appearance", Settings2, "Appearance"],
    ["notifications", Bell, "Notifications"],
    ["security", LockKeyhole, "Security"],
  ];
  const titles = {
    overview: ["Overview", "Your services at a glance."],
    monitors: ["Monitors", "Watch over every important endpoint."],
    groups: ["Groups", "Curated status views for your audience."],
    events: ["Updates & events", "Keep your visitors in the loop."],
    appearance: ["Appearance", "Make your status page feel like yours."],
    notifications: ["Notifications", "Bring your own SMTP server."],
    security: ["Security", "Manage your administrator password."],
  };
  const down =
    data?.monitors.filter((item) => item.status === "down" && item.active)
      .length || 0;
  const up =
    data?.monitors.filter((item) => item.status === "up" && item.active)
      .length || 0;
  return (
    <div className="admin-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <span className="sidebar-label">WORKSPACE</span>
          <div className="sidebar-nav">
            {nav.map(([key, Icon, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => showTab(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "monitors" && data?.monitors.length > 0 && (
                  <small>{data.monitors.length}</small>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={17} /> View status page
          </a>
          <button onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
          <div className="admin-user">
            <span>{admin.email[0].toUpperCase()}</span>
            <div>
              <strong>Administrator</strong>
              <small>{admin.email}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle menu"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{titles[tab]?.[0] || "Overview"}</strong>
          </div>
          <div className="header-actions">
            <span className="header-live">
              <span className="live-dot" /> Live monitoring
            </span>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="header-view"
            >
              View status <ExternalLink size={15} />
            </a>
          </div>
        </header>
        <main className="admin-content">
          {error && (
            <div className="form-error page-alert">
              {error}
              <button onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-alert">
              <Check size={16} /> {notice}
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="section-kicker">
                PINGWARD / {tab.toUpperCase()}
              </span>
              <h1>{titles[tab]?.[0]}</h1>
              <p>{titles[tab]?.[1]}</p>
            </div>
            {tab === "monitors" && (
              <button
                className="button button-primary"
                onClick={() => setModal({ kind: "monitor" })}
              >
                <Plus size={18} /> Add monitor
              </button>
            )}
            {tab === "groups" && (
              <button
                className="button button-primary"
                onClick={() => setModal({ kind: "group" })}
              >
                <Plus size={18} /> New group
              </button>
            )}
            {tab === "events" && (
              <button
                className="button button-primary"
                onClick={() => setModal({ kind: "event" })}
              >
                <Plus size={18} /> Post update
              </button>
            )}
          </div>
          {!data ? (
            <div className="loading-inline">Loading workspace…</div>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-icon stat-green">
                        <Activity size={20} />
                      </span>
                      <span>Active monitors</span>
                      <strong>
                        {data.monitors.filter((item) => item.active).length}
                      </strong>
                      <small>Checking your services</small>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon stat-green">
                        <CheckCircle2 size={20} />
                      </span>
                      <span>Operational</span>
                      <strong>{up}</strong>
                      <small>Running smoothly</small>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon stat-red">
                        <ArrowDownRight size={20} />
                      </span>
                      <span>Issues detected</span>
                      <strong>{down}</strong>
                      <small>Needs your attention</small>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon stat-blue">
                        <Globe2 size={20} />
                      </span>
                      <span>Status groups</span>
                      <strong>{data.groups.length}</strong>
                      <small>Public collections</small>
                    </div>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Service overview</h2>
                          <p>Latest check for each monitor</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => showTab("monitors")}
                        >
                          View all <ArrowRight size={15} />
                        </button>
                      </div>
                      {data.monitors.length ? (
                        <div className="simple-list">
                          {data.monitors.slice(0, 6).map((item) => (
                            <div className="simple-row" key={item.id}>
                              <span
                                className={`mini-status mini-${item.active ? item.status : "paused"}`}
                              />
                              <div>
                                <strong>{item.name}</strong>
                                <small>
                                  {item.target}
                                  {item.port ? `:${item.port}` : ""}
                                </small>
                              </div>
                              <StatusPill
                                status={item.active ? item.status : "pending"}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="panel-empty">
                          <Radio size={26} />
                          <h3>Start monitoring</h3>
                          <p>Add your first endpoint to see its health here.</p>
                          <button
                            className="button button-primary"
                            onClick={() => setModal({ kind: "monitor" })}
                          >
                            <Plus size={16} /> Add monitor
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Recent updates</h2>
                          <p>What your visitors see</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => showTab("events")}
                        >
                          View all <ArrowRight size={15} />
                        </button>
                      </div>
                      {data.events.length ? (
                        <div className="simple-list">
                          {data.events.slice(0, 4).map((item) => (
                            <div className="simple-row" key={item.id}>
                              <span className={`event-icon event-${item.kind}`}>
                                <Megaphone size={15} />
                              </span>
                              <div>
                                <strong>{item.title}</strong>
                                <small>{dateLabel(item.created_at)}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="panel-empty">
                          <Megaphone size={26} />
                          <h3>Nothing to report</h3>
                          <p>Publish news or incident updates for visitors.</p>
                          <button
                            className="button button-outline"
                            onClick={() => setModal({ kind: "event" })}
                          >
                            Post an update
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                  <div className="quick-tip">
                    <Zap size={19} />
                    <div>
                      <strong>Make status easy to share</strong>
                      <span>
                        Create a group to get a dedicated page and embeddable
                        view for your services.
                      </span>
                    </div>
                    <button onClick={() => showTab("groups")}>
                      Explore groups <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {tab === "monitors" && (
                <section className="panel table-panel">
                  {data.monitors.length ? (
                    <>
                      <div className="table-head">
                        <span>MONITOR</span>
                        <span>STATUS</span>
                        <span>UPTIME (90D)</span>
                        <span>LAST CHECK</span>
                        <span>ACTIONS</span>
                      </div>
                      {data.monitors.map((item) => (
                        <div className="table-row" key={item.id}>
                          <div className="table-name">
                            <span
                              className={`table-icon mini-${item.active ? item.status : "paused"}`}
                            >
                              <MonitorLogo monitor={item} size={19} />
                            </span>
                            <div>
                              <strong>{item.name}</strong>
                              <small>
                                {item.target}
                                {item.port ? `:${item.port}` : ""}
                              </small>
                            </div>
                          </div>
                          <StatusPill
                            status={item.active ? item.status : "pending"}
                          />
                          <div className="table-uptime">
                            <strong>
                              {(() => {
                                const total = item.history.reduce(
                                  (n, h) => n + h.total,
                                  0,
                                );
                                const upCount = item.history.reduce(
                                  (n, h) => n + h.up,
                                  0,
                                );
                                return total
                                  ? `${((upCount / total) * 100).toFixed(2)}%`
                                  : "—";
                              })()}
                            </strong>
                            <History
                              history={item.history}
                              style="bars"
                              tooltips={false}
                            />
                          </div>
                          <span className="table-date">
                            {dateLabel(item.last_checked_at)}
                          </span>
                          <div className="row-actions">
                            <button
                              title="Check now"
                              onClick={() =>
                                mutate(
                                  `/admin/monitors/${item.id}/check`,
                                  "POST",
                                  null,
                                  "Check complete.",
                                ).catch((e) => setError(e.message))
                              }
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              title="Edit"
                              onClick={() =>
                                setModal({ kind: "monitor", item })
                              }
                            >
                              <Settings2 size={16} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => confirmDelete("monitor", item)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="panel-empty spacious">
                      <Radio size={30} />
                      <h3>No monitors yet</h3>
                      <p>
                        Add a URL or TCP port and Pingward will start checking
                        it right away.
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() => setModal({ kind: "monitor" })}
                      >
                        <Plus size={16} /> Add your first monitor
                      </button>
                    </div>
                  )}
                </section>
              )}
              {tab === "groups" && (
                <>
                  {data.groups.length ? (
                    <div className="group-card-grid">
                      {data.groups.map((group) => {
                        const count = data.monitors.filter((item) =>
                          item.group_ids.includes(group.id),
                        ).length;
                        const base =
                          data.settings.public_url?.replace(/\/$/, "") ||
                          location.origin;
                        return (
                          <article className="group-card" key={group.id}>
                            <div className="group-card-top">
                              <span className="group-card-icon">
                                <LayoutGrid size={22} />
                              </span>
                              <div className="row-actions">
                                <button
                                  title="Edit"
                                  onClick={() =>
                                    setModal({ kind: "group", item: group })
                                  }
                                >
                                  <Settings2 size={17} />
                                </button>
                                <button
                                  title="Delete"
                                  onClick={() => confirmDelete("group", group)}
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </div>
                            <h3>{group.name}</h3>
                            <p>
                              {group.description ||
                                "A focused status page for this group."}
                            </p>
                            <div className="group-card-meta">
                              <span>
                                <Activity size={15} /> {count}{" "}
                                {count === 1 ? "monitor" : "monitors"}
                              </span>
                              <span>
                                <LayoutGrid size={15} />{" "}
                                {group.display_mode === "inline"
                                  ? "Main page"
                                  : "Separate page"}
                              </span>
                              {group.custom_domain && (
                                <span>
                                  <Globe2 size={15} /> {group.custom_domain}
                                </span>
                              )}
                            </div>
                            <div className="group-card-actions">
                              <a
                                href={
                                  group.display_mode === "inline"
                                    ? `/#group-${group.slug}`
                                    : `/status/${group.slug}`
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                View group <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard
                                    .writeText(
                                      `<iframe src="${base}/embed/${group.id}" title="${group.name} status" width="100%" height="500" frameborder="0"></iframe>`,
                                    )
                                    .then(() => setNotice("Embed code copied."))
                                    .catch((e) => setError(e.message));
                                }}
                              >
                                <Code2 size={15} /> Copy embed
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="panel panel-empty spacious">
                      <LayoutGrid size={30} />
                      <h3>Create your first group</h3>
                      <p>
                        Show related monitors together on the main page or a
                        separate page.
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() => setModal({ kind: "group" })}
                      >
                        <Plus size={16} /> Create group
                      </button>
                    </div>
                  )}
                  <div className="info-note">
                    <CircleHelp size={18} />
                    <span>
                      Add monitors to groups by editing each monitor. A monitor
                      can appear in multiple groups.
                    </span>
                  </div>
                </>
              )}
              {tab === "events" && (
                <section className="panel event-admin-list">
                  {data.events.length ? (
                    data.events.map((item) => (
                      <div className="admin-event" key={item.id}>
                        <span className={`event-icon event-${item.kind}`}>
                          <Megaphone size={17} />
                        </span>
                        <div>
                          <div>
                            <strong>{item.title}</strong>
                            <span className="event-kind">{item.kind}</span>
                            {!item.published && (
                              <span className="draft-badge">Draft</span>
                            )}
                          </div>
                          <p>{item.body || "No details added."}</p>
                          <small>
                            {dateLabel(item.created_at)} ·{" "}
                            {item.group_id
                              ? data.groups.find(
                                  (group) => group.id === item.group_id,
                                )?.name || "Group removed"
                              : "All pages"}
                          </small>
                        </div>
                        <div className="row-actions">
                          <button
                            title="Edit"
                            onClick={() => setModal({ kind: "event", item })}
                          >
                            <Settings2 size={17} />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => confirmDelete("event", item)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="panel-empty spacious">
                      <Megaphone size={30} />
                      <h3>No updates yet</h3>
                      <p>
                        Post incident reports, planned maintenance or other
                        news.
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() => setModal({ kind: "event" })}
                      >
                        <Plus size={16} /> Post an update
                      </button>
                    </div>
                  )}
                </section>
              )}
              {tab === "appearance" && settingsForm && (
                <form
                  className="settings-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutate(
                      "/admin/settings",
                      "PUT",
                      settingsForm,
                      "Appearance saved.",
                    ).catch((e) => setError(e.message));
                  }}
                >
                  <section className="panel settings-panel">
                    <div className="settings-panel-head">
                      <span className="settings-icon">
                        <Globe2 size={20} />
                      </span>
                      <div>
                        <h2>Status page details</h2>
                        <p>The basics visitors see when they open your page.</p>
                      </div>
                    </div>
                    <label>
                      Site name
                      <input
                        value={settingsForm.site_name}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            site_name: e.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        rows="3"
                        value={settingsForm.site_description}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            site_description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Public URL
                      <input
                        value={settingsForm.public_url}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            public_url: e.target.value,
                          })
                        }
                        placeholder="https://status.example.com"
                      />
                      <small>
                        Used in email alerts and embed snippets. Leave blank to
                        use the current domain.
                      </small>
                    </label>
                  </section>
                  <section className="panel settings-panel">
                    <div className="settings-panel-head">
                      <span className="settings-icon">
                        <LayoutGrid size={20} />
                      </span>
                      <div>
                        <h2>Display options</h2>
                        <p>Choose a theme and how health history appears.</p>
                      </div>
                    </div>
                    <span className="field-label">Theme</span>
                    <div className="choice-row">
                      {[
                        ["light", "Light"],
                        ["dark", "Dark"],
                        ["system", "System"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.theme === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, theme: value })
                          }
                        >
                          {label}
                          {settingsForm.theme === value && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                    <span className="field-label">Page layout</span>
                    <div className="choice-row">
                      {[
                        ["grid", LayoutGrid, "Grid"],
                        ["list", List, "List"],
                      ].map(([value, Icon, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.layout === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, layout: value })
                          }
                        >
                          <Icon size={17} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="field-label">Uptime history</span>
                    <div className="choice-row">
                      {[
                        ["bars", "Uptime bars"],
                        ["heatmap", "Git-style graph"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.bar_style === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              bar_style: value,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                  <div className="settings-actions">
                    <button className="button button-primary">
                      Save appearance <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}
              {tab === "notifications" && settingsForm && (
                <form
                  className="panel settings-panel notification-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutate(
                      "/admin/settings",
                      "PUT",
                      settingsForm,
                      "SMTP settings saved.",
                    ).catch((e) => setError(e.message));
                  }}
                >
                  <div className="settings-panel-head">
                    <span className="settings-icon">
                      <Bell size={20} />
                    </span>
                    <div>
                      <h2>Email alerts via your SMTP server</h2>
                      <p>
                        Pingward emails you when a monitor changes state. Your
                        credentials stay on this host.
                      </p>
                    </div>
                  </div>
                  <div className="field-row">
                    <label>
                      SMTP host
                      <input
                        value={settingsForm.smtp_host}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_host: e.target.value,
                          })
                        }
                        placeholder="smtp.example.com"
                      />
                    </label>
                    <label className="field-small">
                      Port
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={settingsForm.smtp_port}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_port: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="field-row">
                    <label>
                      Username
                      <input
                        value={settingsForm.smtp_user}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_user: e.target.value,
                          })
                        }
                        autoComplete="off"
                        placeholder="username"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={settingsForm.smtp_password || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_password: e.target.value,
                          })
                        }
                        autoComplete="new-password"
                        placeholder="Leave blank to keep saved password"
                      />
                    </label>
                  </div>
                  <label className="checkbox-label active-check">
                    <input
                      type="checkbox"
                      checked={settingsForm.smtp_secure === "true"}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          smtp_secure: String(e.target.checked),
                        })
                      }
                    />{" "}
                    Use implicit TLS (usually port 465)
                  </label>
                  <div className="field-row">
                    <label>
                      From address
                      <input
                        type="email"
                        value={settingsForm.smtp_from}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_from: e.target.value,
                          })
                        }
                        placeholder="status@example.com"
                      />
                    </label>
                    <label>
                      Alert recipient
                      <input
                        value={settingsForm.smtp_to}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            smtp_to: e.target.value,
                          })
                        }
                        placeholder="team@example.com"
                      />
                    </label>
                  </div>
                  <div className="settings-actions inline-actions">
                    <button className="button button-primary">
                      Save SMTP settings <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() =>
                        api("/admin/smtp/test", { method: "POST" })
                          .then(() => setNotice("Test email sent."))
                          .catch((e) => setError(e.message))
                      }
                    >
                      Send test email
                    </button>
                  </div>
                </form>
              )}
              {tab === "security" && (
                <form
                  className="panel settings-panel notification-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    api("/admin/password", {
                      method: "PUT",
                      body: passwordForm,
                    })
                      .then(() => {
                        setNotice("Password changed. Sign in again.");
                        setTimeout(() => {
                          location.href = "/login";
                        }, 1500);
                      })
                      .catch((e) => setError(e.message));
                  }}
                >
                  <div className="settings-panel-head">
                    <span className="settings-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <h2>Change admin password</h2>
                      <p>
                        Changing the password signs out all active sessions.
                      </p>
                    </div>
                  </div>
                  <label>
                    Current password
                    <input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          current_password: e.target.value,
                        })
                      }
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      minLength="12"
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          new_password: e.target.value,
                        })
                      }
                      required
                      autoComplete="new-password"
                    />
                    <small>At least 12 characters.</small>
                  </label>
                  <div className="settings-actions">
                    <button className="button button-primary">
                      Update password <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </main>
      </div>
      {modal?.kind === "monitor" && (
        <MonitorForm
          initial={modal.item}
          groups={data?.groups || []}
          onClose={() => setModal(null)}
          onSave={(form) =>
            mutate(
              `/admin/monitors${modal.item ? `/${modal.item.id}` : ""}`,
              modal.item ? "PUT" : "POST",
              form,
              modal.item ? "Monitor updated." : "Monitor added.",
            )
          }
        />
      )}
      {modal?.kind === "group" && (
        <GroupForm
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={(form) =>
            mutate(
              `/admin/groups${modal.item ? `/${modal.item.id}` : ""}`,
              modal.item ? "PUT" : "POST",
              form,
              modal.item ? "Group updated." : "Group created.",
            )
          }
        />
      )}
      {modal?.kind === "event" && (
        <EventForm
          initial={modal.item}
          groups={data?.groups || []}
          onClose={() => setModal(null)}
          onSave={(form) =>
            mutate(
              `/admin/events${modal.item ? `/${modal.item.id}` : ""}`,
              modal.item ? "PUT" : "POST",
              form,
              modal.item ? "Update saved." : "Update posted.",
            )
          }
        />
      )}
    </div>
  );
}
