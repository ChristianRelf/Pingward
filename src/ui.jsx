import React, { useEffect } from "react";
import {
  Activity,
  Check,
  Megaphone,
  Radio,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { dateLabel, statusLabel } from "./api";
import { MonitorLogo } from "./monitor-logo";

export function BrandMark({ icon = "activity", size = 21 }) {
  if (icon === "none") return null;
  const Icon =
    icon === "radio" ? Radio : icon === "shield" ? ShieldCheck : Activity;
  return <Icon size={size} strokeWidth={2.7} />;
}

export function Brand({
  compact = false,
  name = "pingward",
  icon = "activity",
}) {
  return (
    <a className={`brand ${compact ? "brand-compact" : ""}`} href="/">
      {icon !== "none" && (
        <span className="brand-mark">
          <BrandMark icon={icon} />
        </span>
      )}
      <span>
        {name}
        <span className="brand-dot">.</span>
      </span>
    </a>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status || "pending"}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

export function History({
  history = [],
  style = "bars",
  events = [],
  tooltips = true,
}) {
  const byDay = new Map(history.map((item) => [item.day, item]));
  const cells = Array.from({ length: 90 }, (_, index) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (89 - index));
    const key = day.toISOString().slice(0, 10);
    const item = byDay.get(key);
    const state = !item
      ? "empty"
      : item.up === item.total
        ? "up"
        : item.up === 0
          ? "down"
          : "partial";
    const event = events.find(
      (entry) => entry.created_at?.slice(0, 10) === key,
    );
    const label = event
      ? event.kind === "incident"
        ? "Incident"
        : event.kind === "maintenance"
          ? "Maintenance"
          : event.kind === "resolved"
            ? "Resolved"
            : "Update"
      : state === "up"
        ? "No incidents"
        : state === "down"
          ? "Outage"
          : state === "partial"
            ? "Degraded"
            : "No checks";
    const date = new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return (
      <span
        key={key}
        className={`history-cell history-${state} ${state === "up" && ["incident", "maintenance"].includes(event?.kind) ? `history-event-${event.kind}` : ""}`}
        tabIndex={tooltips && (item || event) ? 0 : -1}
        aria-label={`${date}: ${label}${item ? `, ${item.up} of ${item.total} checks up` : ""}`}
      >
        {tooltips && (
          <span
            className={`history-tooltip ${event ? `history-tooltip-${event.kind}` : ""}`}
            role="tooltip"
          >
            <strong>{label}</strong>
            <span>{date}</span>
            {event && <em>{event.title}</em>}
            {item && (
              <small>
                {item.up} of {item.total} checks operational
              </small>
            )}
          </span>
        )}
      </span>
    );
  });
  return (
    <div
      className={`history history-${style}`}
      aria-label="Uptime history for the past 90 days"
    >
      {cells}
    </div>
  );
}

export function MonitorCard({
  monitor,
  barStyle,
  compact = false,
  events = [],
  showResponseTime = true,
}) {
  return (
    <article className={`monitor-card ${compact ? "monitor-compact" : ""}`}>
      <div className="monitor-top">
        <span className={`monitor-icon monitor-icon-${monitor.status}`}>
          <MonitorLogo monitor={monitor} size={20} />
        </span>
        <div className="monitor-heading">
          <h3>{monitor.name}</h3>
          <span>
            {monitor.type === "tcp" ? "TCP service" : "Website & API"}
          </span>
        </div>
        <StatusPill status={monitor.status} />
      </div>
      <div className="monitor-meta">
        <span>
          90-day uptime{" "}
          <strong>{monitor.uptime == null ? "—" : `${monitor.uptime}%`}</strong>
        </span>
        {showResponseTime && (
          <span>
            {monitor.last_response_ms == null
              ? "Awaiting first check"
              : `${monitor.last_response_ms} ms response`}
          </span>
        )}
      </div>
      <History history={monitor.history} style={barStyle} events={events} />
      <div className="history-labels">
        <span>90 days ago</span>
        <span>Today</span>
      </div>
    </article>
  );
}

export function MonitorRow({
  monitor,
  barStyle,
  events = [],
  showResponseTime = true,
}) {
  return (
    <article className="service-row">
      <div className="service-row-top">
        <span className={`monitor-icon monitor-icon-${monitor.status}`}>
          <MonitorLogo monitor={monitor} size={18} />
        </span>
        <strong>{monitor.name}</strong>
        {showResponseTime && monitor.last_response_ms != null && (
          <span className="service-response">
            {monitor.last_response_ms} ms
          </span>
        )}
        <StatusPill status={monitor.status} />
      </div>
      <History history={monitor.history} style={barStyle} events={events} />
    </article>
  );
}

export function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className={`event-icon event-${event.kind}`}>
        {event.kind === "resolved" ? (
          <Check size={17} />
        ) : event.kind === "maintenance" ? (
          <Settings2 size={17} />
        ) : event.kind === "incident" ? (
          <Activity size={17} />
        ) : (
          <Megaphone size={17} />
        )}
      </div>
      <div>
        <div className="event-line">
          <strong>{event.title}</strong>
          <span>{dateLabel(event.created_at)}</span>
        </div>
        <p>{event.body}</p>
        <span className="event-kind">{event.kind}</span>
      </div>
    </article>
  );
}

export function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
