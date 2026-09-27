import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Radio,
} from "lucide-react";
import { api, urlLabel } from "./api";
import { Brand, MonitorCard, MonitorRow, EventCard } from "./ui";

function eventsForMonitor(events, monitor) {
  return events.filter(
    (event) =>
      event.group_id == null || monitor.group_ids.includes(event.group_id),
  );
}

function GroupAccordion({
  group,
  monitors,
  events,
  barStyle,
  initiallyOpen,
  showResponseTime,
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const down = monitors.some((monitor) => monitor.status === "down");
  const panelId = `group-panel-${group.id}`;
  return (
    <section
      className={`status-group ${open ? "is-open" : ""}`}
      id={`group-${group.slug}`}
    >
      <div className="status-group-header">
        <button
          type="button"
          className="status-group-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={open ? "expanded" : ""} size={18} />
          <strong>{group.name}</strong>
          {down && <span className="group-issue">Issues</span>}
          <span className="group-service-count">
            {monitors.length} {monitors.length === 1 ? "service" : "services"}
          </span>
        </button>
        {group.website_url && (
          <a
            className="status-group-page-link"
            href={group.website_url}
            target="_blank"
            rel="noreferrer"
            title={`Visit ${group.name} website`}
          >
            <span>{urlLabel(group.website_url)}</span>{" "}
            <ExternalLink size={13} />
          </a>
        )}
        {group.display_mode === "page" && (
          <a className="status-group-page-link" href={`/status/${group.slug}`}>
            <span>View page</span> <ArrowRight size={14} />
          </a>
        )}
      </div>
      <div
        id={panelId}
        className="status-group-panel"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="status-group-services">
          {monitors.length ? (
            monitors.map((monitor) => (
              <MonitorRow
                key={monitor.id}
                monitor={monitor}
                barStyle={barStyle}
                showResponseTime={showResponseTime}
                events={eventsForMonitor(events, monitor)}
              />
            ))
          ) : (
            <p className="status-group-empty">
              No active services in this group.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function PublicPage({ embedId = null }) {
  const slug = location.pathname.startsWith("/status/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  useEffect(() => {
    let mounted = true;
    const load = () =>
      api(`/public${slug ? `?group=${encodeURIComponent(slug)}` : ""}`)
        .then((value) => {
          if (mounted) {
            setData(value);
            setLastUpdated(new Date());
          }
        })
        .catch((e) => {
          if (mounted) setError(e.message);
        });
    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [slug]);
  useEffect(() => {
    if (!data) return;
    const group = data.groups.find(
      (item) =>
        item.id ===
        (embedId ? Number(embedId) : Number(data.selected_group || 0)),
    );
    document.title = `${group?.name || data.settings.site_name} · Status`;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute("content", data.settings.accent_color);
  }, [data, embedId]);
  if (error)
    return (
      <div className="state-page">
        <Brand />
        <h1>Page unavailable</h1>
        <p>{error}</p>
        <a className="button" href="/">
          Back to status
        </a>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="loading-pulse" />
      </div>
    );
  const selectedGroup = embedId
    ? data.groups.find((group) => group.id === Number(embedId))
    : data.groups.find((group) => group.id === data.selected_group);
  const monitors = embedId
    ? data.monitors.filter((monitor) =>
        monitor.group_ids.includes(Number(embedId)),
      )
    : data.monitors;
  const anyDown = monitors.some((monitor) => monitor.status === "down");
  const allUp =
    monitors.length > 0 && monitors.every((monitor) => monitor.status === "up");
  const overall = anyDown ? "down" : allUp ? "up" : "pending";
  const showGroups = !embedId && !selectedGroup;
  const standaloneMonitors = showGroups
    ? monitors.filter(
        (monitor) =>
          !monitor.group_ids.some((id) =>
            data.groups.some((group) => group.id === id),
          ),
      )
    : monitors;
  const hasVisibleServices =
    standaloneMonitors.length > 0 || (showGroups && data.groups.length > 0);
  const firstInlineGroupId = data.groups.find(
    (group) => group.display_mode === "inline",
  )?.id;
  const theme = data.settings.theme;
  const showResponseTime = data.settings.show_response_time !== "false";
  const brandProps = {
    name: data.settings.site_name,
    icon: data.settings.brand_icon,
  };
  return (
    <div
      className={`site theme-${theme} page-width-${data.settings.page_width} density-${data.settings.density} corners-${data.settings.corner_style} ${embedId ? "embed-mode" : ""}`}
      style={{ "--accent": data.settings.accent_color }}
    >
      {!embedId && (
        <header className="public-header">
          <div className="container nav-inner">
            <Brand {...brandProps} />
            <nav>
              <a href="/#services">Services</a>
              <a href="/#updates">Updates</a>
              {data.settings.show_admin_link !== "false" && (
                <a className="nav-admin" href="/admin">
                  Dashboard <ArrowRight size={15} />
                </a>
              )}
            </nav>
          </div>
        </header>
      )}
      <main className="container public-main">
        {!embedId &&
          selectedGroup &&
          location.pathname.startsWith("/status/") && (
            <a className="status-back" href="/">
              ← All services
            </a>
          )}
        <div className="hero-row">
          <div>
            <h1>
              {selectedGroup ? selectedGroup.name : data.settings.site_name}
              <span className="hero-period">.</span>
            </h1>
            <p className="hero-copy">
              {selectedGroup?.description || data.settings.site_description}
            </p>
            {!embedId && selectedGroup?.website_url && (
              <a
                className="group-website-link"
                href={selectedGroup.website_url}
                target="_blank"
                rel="noreferrer"
              >
                Visit {urlLabel(selectedGroup.website_url)}{" "}
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {!embedId && (
            <span className="updated">
              <span className="live-dot" /> Live
              {lastUpdated && <span aria-hidden="true">·</span>}
              {lastUpdated && <span>Updated just now</span>}
            </span>
          )}
        </div>
        <section className={`overview-banner overview-${overall}`}>
          <div className="overview-symbol">
            {overall === "up" ? (
              <Check size={26} />
            ) : overall === "down" ? (
              <Activity size={26} />
            ) : (
              <Clock3 size={26} />
            )}
          </div>
          <div>
            <strong>
              {overall === "up"
                ? "All systems operational"
                : overall === "down"
                  ? "Some services are experiencing issues"
                  : "Waiting for first checks"}
            </strong>
            <span>
              {overall === "up"
                ? "Everything is running smoothly."
                : overall === "down"
                  ? "Our team is aware of the disruption."
                  : "Status will appear once monitoring begins."}
            </span>
          </div>
          <span className="overview-count">
            {monitors.length} {monitors.length === 1 ? "service" : "services"}
          </span>
        </section>
        <section id="services" className="section status-section">
          <div className="section-heading">
            <div>
              <h2>Services</h2>
            </div>
            <div className="legend">
              <span>
                <i className="legend-dot legend-up" /> Operational
              </span>
              <span>
                <i className="legend-dot legend-down" /> Incident
              </span>
            </div>
          </div>
          {standaloneMonitors.length > 0 &&
            (data.settings.layout === "list" ? (
              <div className="service-list">
                {standaloneMonitors.map((monitor) => (
                  <MonitorRow
                    key={monitor.id}
                    monitor={monitor}
                    barStyle={data.settings.bar_style}
                    showResponseTime={showResponseTime}
                    events={eventsForMonitor(data.events, monitor)}
                  />
                ))}
              </div>
            ) : (
              <div className="monitor-grid">
                {standaloneMonitors.map((monitor) => (
                  <MonitorCard
                    key={monitor.id}
                    monitor={monitor}
                    barStyle={data.settings.bar_style}
                    compact={Boolean(embedId)}
                    showResponseTime={showResponseTime}
                    events={eventsForMonitor(data.events, monitor)}
                  />
                ))}
              </div>
            ))}
          {showGroups && data.groups.length > 0 && (
            <div className="status-groups">
              {data.groups.map((group) => {
                const groupMonitors = monitors.filter((monitor) =>
                  monitor.group_ids.includes(group.id),
                );
                return (
                  <GroupAccordion
                    key={group.id}
                    group={group}
                    monitors={groupMonitors}
                    events={data.events}
                    barStyle={data.settings.bar_style}
                    initiallyOpen={group.id === firstInlineGroupId}
                    showResponseTime={showResponseTime}
                  />
                );
              })}
            </div>
          )}
          {!hasVisibleServices && (
            <div className="empty-panel">
              <Radio size={26} />
              <h3>No services yet</h3>
              <p>Monitors added in the dashboard will appear here.</p>
            </div>
          )}
        </section>
        {!embedId && (
          <section id="updates" className="section updates-section">
            <div className="section-heading">
              <div>
                <h2>Updates & events</h2>
              </div>
            </div>
            {data.events.length ? (
              <div className="events-list">
                {data.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="empty-events">
                <CheckCircle2 size={19} /> No recent events. Things are looking
                good.
              </div>
            )}
          </section>
        )}
      </main>
      {!embedId && (
        <footer className="public-footer">
          <div className="container">
            <Brand compact {...brandProps} />
            <div className="footer-copy">
              {data.settings.footer_text && (
                <span>{data.settings.footer_text}</span>
              )}
              <a
                href="https://github.com/ChristianRelf/Pingward"
                target="_blank"
                rel="noreferrer"
              >
                Powered by Pingward <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
