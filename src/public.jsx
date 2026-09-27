import React, { useEffect, useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Radio,
} from "lucide-react";
import { api } from "./api";
import { Brand, MonitorCard, EventCard } from "./ui";

export function PublicPage({ embedId = null }) {
  const slug = location.pathname.startsWith("/status/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const load = () =>
      api(`/public${slug ? `?group=${encodeURIComponent(slug)}` : ""}`)
        .then((value) => {
          if (mounted) setData(value);
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
  const theme = data.settings.theme;
  return (
    <div className={`site theme-${theme} ${embedId ? "embed-mode" : ""}`}>
      {!embedId && (
        <header className="public-header">
          <div className="container nav-inner">
            <Brand />
            <nav>
              <a href="/#services">Services</a>
              <a href="/#updates">Updates</a>
              <a className="nav-admin" href="/admin">
                Dashboard <ArrowRight size={15} />
              </a>
            </nav>
          </div>
        </header>
      )}
      <main className="container public-main">
        {!embedId && (
          <div className="eyebrow">
            <span className="eyebrow-line" /> LIVE SYSTEM STATUS
          </div>
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
          </div>
          {!embedId && (
            <span className="updated">
              <span className="live-dot" /> Updating every 30 seconds
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
        {!embedId && data.groups.length > 0 && (
          <div className="group-nav">
            <a className={!selectedGroup ? "selected" : ""} href="/">
              All services
            </a>
            {data.groups.map((group) => (
              <a
                key={group.id}
                className={selectedGroup?.id === group.id ? "selected" : ""}
                href={`/status/${group.slug}`}
              >
                {group.name}
              </a>
            ))}
          </div>
        )}
        <section id="services" className="section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">PERFORMANCE</span>
              <h2>Service health</h2>
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
          {monitors.length ? (
            <div
              className={`monitor-grid ${data.settings.layout === "list" ? "monitor-list" : ""}`}
            >
              {monitors.map((monitor) => (
                <MonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  barStyle={data.settings.bar_style}
                  compact={Boolean(embedId)}
                />
              ))}
            </div>
          ) : (
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
                <span className="section-kicker">LATEST NEWS</span>
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
            <Brand compact />
            <span>
              Transparent status, powered by{" "}
              <a
                href="https://github.com/ChristianRelf/Pingward"
                target="_blank"
                rel="noreferrer"
              >
                Pingward <ExternalLink size={12} />
              </a>
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
