import React, { useRef, useState } from "react";
import { ArrowRight, ImageUp } from "lucide-react";
import { slugify } from "./api";
import { Modal } from "./ui";
import { MonitorLogo } from "./monitor-logo";
import {
  DEFAULT_MONITOR_LOGO,
  MONITOR_LOGO_PRESETS,
} from "../shared/monitor-logos.js";

export function MonitorForm({ initial, groups, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      type: "http",
      target: "",
      port: 443,
      interval_seconds: 60,
      timeout_seconds: 10,
      expected_status: 200,
      active: true,
      group_ids: [],
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logoMode, setLogoMode] = useState(
    initial?.has_logo ? "upload" : "preset",
  );
  const [logoPreset, setLogoPreset] = useState(
    initial?.logo_preset || DEFAULT_MONITOR_LOGO,
  );
  const [logoImage, setLogoImage] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const logoInput = useRef(null);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 512 * 1024
    ) {
      setError("Choose a PNG, JPEG, or WebP image smaller than 512 KB.");
      return;
    }
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.readAsDataURL(file);
      });
      setLogoImage(image);
      setLogoFileName(file.name);
      setLogoMode("upload");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        ...form,
        logo_mode: logoMode,
        logo_preset: logoPreset,
        logo_image: logoMode === "upload" ? logoImage : "",
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit monitor" : "Add a monitor"}
      subtitle="Pingward starts checking as soon as you save."
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-body">
        {error && <div className="form-error">{error}</div>}
        <div className="field-row">
          <label>
            Display name
            <input
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
              placeholder="Main website"
              required
            />
          </label>
          <label>
            Check type
            <select
              value={form.type}
              onChange={(e) => change("type", e.target.value)}
            >
              <option value="http">HTTP / HTTPS</option>
              <option value="tcp">TCP port</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field-grow">
            {form.type === "tcp" ? "Hostname or IP" : "Full URL"}
            <input
              value={form.target}
              onChange={(e) => change("target", e.target.value)}
              placeholder={
                form.type === "tcp"
                  ? "db.example.com"
                  : "https://example.com/health"
              }
              required
            />
          </label>
          {form.type === "tcp" && (
            <label className="field-small">
              Port
              <input
                type="number"
                min="1"
                max="65535"
                value={form.port}
                onChange={(e) => change("port", Number(e.target.value))}
                required
              />
            </label>
          )}
        </div>
        <div className="field-row field-three">
          <label>
            Interval (seconds)
            <input
              type="number"
              min="30"
              max="86400"
              value={form.interval_seconds}
              onChange={(e) =>
                change("interval_seconds", Number(e.target.value))
              }
              required
            />
          </label>
          <label>
            Timeout (seconds)
            <input
              type="number"
              min="1"
              max="60"
              value={form.timeout_seconds}
              onChange={(e) =>
                change("timeout_seconds", Number(e.target.value))
              }
              required
            />
          </label>
          {form.type === "http" && (
            <label>
              Expected HTTP status
              <input
                type="number"
                min="100"
                max="599"
                value={form.expected_status}
                onChange={(e) =>
                  change("expected_status", Number(e.target.value))
                }
                required
              />
            </label>
          )}
        </div>
        <div className="logo-field">
          <span className="field-label">Monitor logo</span>
          <div className="logo-grid" role="group" aria-label="Monitor logo">
            {MONITOR_LOGO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`logo-choice ${logoMode === "preset" && logoPreset === preset.id ? "selected" : ""}`}
                aria-pressed={logoMode === "preset" && logoPreset === preset.id}
                onClick={() => {
                  setLogoMode("preset");
                  setLogoPreset(preset.id);
                  setLogoImage("");
                  setLogoFileName("");
                }}
              >
                <MonitorLogo monitor={{ logo_preset: preset.id }} size={22} />
                <span>{preset.label}</span>
              </button>
            ))}
            <button
              type="button"
              className={`logo-choice ${logoMode === "upload" ? "selected" : ""}`}
              aria-label={
                logoMode === "upload" ? "Change uploaded logo" : "Upload a logo"
              }
              aria-pressed={logoMode === "upload"}
              onClick={() => logoInput.current?.click()}
            >
              {logoMode === "upload" ? (
                <MonitorLogo monitor={initial} preview={logoImage} size={22} />
              ) : (
                <ImageUp size={22} />
              )}
              <span>Upload</span>
            </button>
          </div>
          <input
            ref={logoInput}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={chooseLogo}
            aria-label="Upload monitor logo"
          />
          <small>
            {logoFileName ||
              (logoMode === "upload" && initial?.has_logo
                ? "Using the uploaded logo. Select Upload to replace it."
                : "PNG, JPEG, or WebP · up to 512 KB")}
          </small>
        </div>
        {groups.length > 0 && (
          <div className="group-field">
            <span className="field-label">Show in groups</span>
            <div className="checkbox-grid">
              {groups.map((group) => (
                <label className="checkbox-label" key={group.id}>
                  <input
                    type="checkbox"
                    checked={form.group_ids.includes(group.id)}
                    onChange={(e) =>
                      change(
                        "group_ids",
                        e.target.checked
                          ? [...form.group_ids, group.id]
                          : form.group_ids.filter((id) => id !== group.id),
                      )
                    }
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="checkbox-label active-check">
          <input
            type="checkbox"
            checked={Boolean(form.active)}
            onChange={(e) => change("active", e.target.checked)}
          />{" "}
          Monitoring active
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save monitor"} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      slug: "",
      description: "",
      custom_domain: "",
      display_mode: "inline",
    },
  );
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changeName = (value) =>
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugEdited ? current.slug : slugify(value),
    }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit group" : "Create a group"}
      subtitle="Group related monitors into a focused status view."
      onClose={onClose}
    >
      <form className="modal-body" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label>
          Group name
          <input
            value={form.name}
            onChange={(e) => changeName(e.target.value)}
            placeholder="Core infrastructure"
            required
          />
        </label>
        <label>
          Page slug
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              setForm({ ...form, slug: e.target.value });
            }}
            placeholder="core-infrastructure"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
          <small>Available at /status/{form.slug || "your-group"}</small>
        </label>
        <label>
          Description
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="A short description for this group"
          />
        </label>
        <div className="group-display-field">
          <span className="field-label">Placement</span>
          <div
            className="group-display-options"
            role="group"
            aria-label="Group placement"
          >
            <button
              type="button"
              className={`group-display-choice ${form.display_mode === "inline" ? "selected" : ""}`}
              aria-pressed={form.display_mode === "inline"}
              onClick={() => setForm({ ...form, display_mode: "inline" })}
            >
              <strong>On main status page</strong>
              <span>Expandable group with its monitors inside.</span>
            </button>
            <button
              type="button"
              className={`group-display-choice ${form.display_mode === "page" ? "selected" : ""}`}
              aria-pressed={form.display_mode === "page"}
              onClick={() => setForm({ ...form, display_mode: "page" })}
            >
              <strong>Separate page</strong>
              <span>
                Dedicated page, with an expandable group on the main page.
              </span>
            </button>
          </div>
        </div>
        <label>
          Custom domain <span className="optional">optional</span>
          <input
            value={form.custom_domain}
            onChange={(e) =>
              setForm({ ...form, custom_domain: e.target.value })
            }
            placeholder="status.example.com"
          />
          <small>
            Point this domain to your Pingward host and configure HTTPS on your
            reverse proxy.
          </small>
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save group"} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function EventForm({ initial, groups, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || {
      title: "",
      body: "",
      kind: "info",
      group_id: "",
      published: true,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit update" : "Post an update"}
      subtitle="Keep visitors informed about maintenance, incidents and news."
      onClose={onClose}
    >
      <form className="modal-body" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label>
          Headline
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Scheduled maintenance tonight"
            required
          />
        </label>
        <div className="field-row">
          <label>
            Type
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="info">News</option>
              <option value="maintenance">Maintenance</option>
              <option value="incident">Incident</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label>
            Show on
            <select
              value={form.group_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  group_id: e.target.value ? Number(e.target.value) : "",
                })
              }
            >
              <option value="">All status pages</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Details
          <textarea
            rows="5"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Tell visitors what is happening…"
          />
        </label>
        <label className="checkbox-label active-check">
          <input
            type="checkbox"
            checked={Boolean(form.published)}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />{" "}
          Published
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save update"} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
