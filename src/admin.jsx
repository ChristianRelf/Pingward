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
  Eye,
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
  Palette,
  Radio,
  RefreshCw,
  Share2,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api, dateLabel, urlLabel } from "./api";
import { Brand, BrandMark, StatusPill, History } from "./ui";
import { MonitorLogo } from "./monitor-logo";
import { MonitorForm, GroupForm, EventForm } from "./forms";
import { generateBrandAssets } from "./brand-assets";

const accentChoices = [
  ["#21ab75", "Emerald"],
  ["#3b82f6", "Blue"],
  ["#8b5cf6", "Violet"],
  ["#e76f51", "Coral"],
  ["#d89b24", "Amber"],
];

function AppearancePreview({ settings }) {
  const radius =
    settings.corner_style === "square"
      ? "2px"
      : settings.corner_style === "subtle"
        ? "7px"
        : "13px";
  return (
    <section className="panel appearance-preview">
      <div className="appearance-preview-head">
        <div>
          <span className="preview-live-dot" />
          <strong>Live preview</strong>
          <span>Updates as you make changes</span>
        </div>
        <a href="/" target="_blank" rel="noreferrer">
          Open status page <ExternalLink size={13} />
        </a>
      </div>
      <div
        className={`preview-canvas preview-theme-${settings.theme} preview-${settings.density} preview-${settings.page_width} preview-layout-${settings.layout}`}
        style={{
          "--preview-accent": settings.accent_color,
          "--preview-radius": radius,
        }}
      >
        <div className="preview-nav">
          <div className="preview-brand">
            {settings.brand_icon !== "none" && (
              <span>
                <BrandMark icon={settings.brand_icon} size={14} />
              </span>
            )}
            {settings.site_name || "Your status page"}
          </div>
          {settings.show_admin_link !== "false" && <i>Dashboard</i>}
        </div>
        <div className="preview-body">
          <p>{settings.site_description || "A clear view of every service."}</p>
          <div className="preview-status">
            <Check size={15} />
            <strong>All systems operational</strong>
            <span>3 services</span>
          </div>
          <div className="preview-services">
            {["API", "Website", "Database"].map((name, index) => (
              <div key={name}>
                <span className="preview-service-icon">
                  <Activity size={13} />
                </span>
                <strong>{name}</strong>
                {settings.show_response_time !== "false" && (
                  <small>{[84, 126, 32][index]} ms</small>
                )}
                <i>Operational</i>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdminPage({ admin }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(
    new URLSearchParams(location.search).get("tab") || "overview",
  );
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [settingsForm, setSettingsForm] = useState(null);
  const [assetBusy, setAssetBusy] = useState(false);
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
  async function generateShareAssets() {
    setAssetBusy(true);
    setError("");
    try {
      const assets = generateBrandAssets(settingsForm);
      await api("/admin/settings", { method: "PUT", body: settingsForm });
      await api("/admin/branding-assets", { method: "PUT", body: assets });
      await reload();
      setNotice("Social image and favicon generated.");
      setTimeout(() => setNotice(""), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setAssetBusy(false);
    }
  }
  async function resetShareAssets() {
    setAssetBusy(true);
    try {
      await mutate(
        "/admin/branding-assets",
        "DELETE",
        null,
        "Generated branding assets removed.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setAssetBusy(false);
    }
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
                              {group.website_url && (
                                <a
                                  href={group.website_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink size={15} />{" "}
                                  {urlLabel(group.website_url)}
                                </a>
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
                  <AppearancePreview settings={settingsForm} />
                  <section className="panel settings-panel share-assets-panel">
                    <div className="settings-panel-head">
                      <span className="settings-icon">
                        <Share2 size={20} />
                      </span>
                      <div>
                        <h2>Social image & favicon</h2>
                        <p>
                          Generate unique share assets from your current name,
                          description, accent colour and brand mark.
                        </p>
                      </div>
                    </div>
                    <div className="share-assets-preview">
                      <div className="og-preview">
                        {data.branding?.has_og_image ? (
                          <img
                            src={`/og-image.png?v=${data.branding.og_image_updated_at}`}
                            alt="Current generated social sharing preview"
                          />
                        ) : (
                          <div
                            className="og-preview-empty"
                            style={{
                              "--asset-accent": settingsForm.accent_color,
                            }}
                          >
                            <Share2 size={24} />
                            <strong>No social image generated yet</strong>
                            <span>1200 × 630 PNG</span>
                          </div>
                        )}
                      </div>
                      <div className="favicon-preview">
                        <span>Browser icon</span>
                        <div>
                          <img
                            src={`/favicon?v=${data.branding?.favicon_updated_at || 0}`}
                            alt="Current favicon"
                          />
                          <div>
                            <strong>{settingsForm.site_name}</strong>
                            <small>
                              {settingsForm.public_url || "Your domain"}
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="share-assets-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={assetBusy}
                        onClick={generateShareAssets}
                      >
                        <RefreshCw
                          className={assetBusy ? "spinning" : ""}
                          size={16}
                        />
                        {data.branding?.has_og_image
                          ? "Regenerate assets"
                          : "Generate assets"}
                      </button>
                      {data.branding?.has_og_image && (
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={assetBusy}
                          onClick={resetShareAssets}
                        >
                          Reset
                        </button>
                      )}
                      <small>
                        Generate again after changing your branding. This also
                        saves the current appearance settings.
                      </small>
                    </div>
                  </section>
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
                    <label>
                      Footer message
                      <input
                        value={settingsForm.footer_text}
                        maxLength="300"
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            footer_text: e.target.value,
                          })
                        }
                        placeholder="A short message for your visitors"
                      />
                      <small>Leave blank for no custom footer message.</small>
                    </label>
                  </section>
                  <section className="panel settings-panel">
                    <div className="settings-panel-head">
                      <span className="settings-icon">
                        <Palette size={20} />
                      </span>
                      <div>
                        <h2>Brand identity</h2>
                        <p>Bring your own colour and choose a simple mark.</p>
                      </div>
                    </div>
                    <span className="field-label">Accent colour</span>
                    <div className="accent-picker">
                      <div className="accent-swatches">
                        {accentChoices.map(([value, label]) => (
                          <button
                            type="button"
                            key={value}
                            title={label}
                            aria-label={`${label} accent`}
                            aria-pressed={
                              settingsForm.accent_color.toLowerCase() === value
                            }
                            className={
                              settingsForm.accent_color.toLowerCase() === value
                                ? "selected"
                                : ""
                            }
                            style={{ "--swatch": value }}
                            onClick={() =>
                              setSettingsForm({
                                ...settingsForm,
                                accent_color: value,
                              })
                            }
                          >
                            {settingsForm.accent_color.toLowerCase() ===
                              value && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                      <label className="custom-colour">
                        <input
                          type="color"
                          value={settingsForm.accent_color}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              accent_color: e.target.value,
                            })
                          }
                        />
                        <span>{settingsForm.accent_color.toUpperCase()}</span>
                      </label>
                    </div>
                    <span className="field-label">Brand mark</span>
                    <div className="brand-mark-choices">
                      {[
                        ["activity", "Pulse"],
                        ["radio", "Signal"],
                        ["shield", "Shield"],
                        ["none", "None"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.brand_icon === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              brand_icon: value,
                            })
                          }
                        >
                          <span className="brand-choice-icon">
                            {value === "none" ? (
                              <span aria-hidden="true">—</span>
                            ) : (
                              <BrandMark icon={value} size={16} />
                            )}
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
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
                  <section className="panel settings-panel">
                    <div className="settings-panel-head">
                      <span className="settings-icon">
                        <Eye size={20} />
                      </span>
                      <div>
                        <h2>Page shape & visibility</h2>
                        <p>Tune the spacing and decide what visitors see.</p>
                      </div>
                    </div>
                    <span className="field-label">Content width</span>
                    <div className="choice-row">
                      {[
                        ["standard", "Standard"],
                        ["wide", "Wide"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.page_width === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              page_width: value,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="field-label">Spacing</span>
                    <div className="choice-row">
                      {[
                        ["comfortable", "Comfortable"],
                        ["compact", "Compact"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.density === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              density: value,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="field-label">Corners</span>
                    <div className="choice-row">
                      {[
                        ["rounded", "Rounded"],
                        ["subtle", "Subtle"],
                        ["square", "Square"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${settingsForm.corner_style === value ? "chosen" : ""}`}
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              corner_style: value,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="visibility-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settingsForm.show_admin_link !== "false"}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              show_admin_link: String(e.target.checked),
                            })
                          }
                        />
                        Show dashboard link in the public header
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settingsForm.show_response_time !== "false"}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              show_response_time: String(e.target.checked),
                            })
                          }
                        />
                        Show response times to visitors
                      </label>
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
