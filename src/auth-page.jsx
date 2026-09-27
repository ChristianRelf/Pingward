import React, { useState } from "react";
import { Activity, ArrowRight, LockKeyhole } from "lucide-react";
import { api } from "./api";
import { Brand } from "./ui";

export function AuthPage({ setup = false, requiresSetupToken = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(setup ? "/setup" : "/login", {
        method: "POST",
        body: { email, password, setup_token: setupToken },
      });
      location.href = "/admin";
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <Brand />
        <div className="auth-art-content">
          <span className="section-kicker">YOUR SERVICES, IN SIGHT</span>
          <h1>
            Peace of mind,
            <br />
            one check at a time<span>.</span>
          </h1>
          <p>
            Know what’s up. Share what matters. Keep your users in the loop.
          </p>
          <div className="art-status">
            <span className="live-dot" /> Monitoring made simple{" "}
            <Activity size={44} />
          </div>
        </div>
        <span className="auth-art-foot">
          Open source · Self hosted · Your data
        </span>
      </div>
      <div className="auth-form-area">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <form className="auth-form" onSubmit={submit}>
          <span className="form-top-icon">
            <LockKeyhole size={20} />
          </span>
          <h2>{setup ? "Set up your workspace" : "Welcome back"}</h2>
          <p>
            {setup
              ? "Create the administrator account for this Pingward instance."
              : "Sign in to manage your monitors and status page."}
          </p>
          {error && <div className="form-error">{error}</div>}
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={setup ? "At least 12 characters" : "Your password"}
              required
              minLength={setup ? 12 : undefined}
              autoComplete={setup ? "new-password" : "current-password"}
            />
          </label>
          {setup && requiresSetupToken && (
            <label>
              Setup token
              <input
                type="password"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="From your server environment"
                required
                autoComplete="off"
              />
            </label>
          )}
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? "Please wait…" : setup ? "Create admin account" : "Sign in"}{" "}
            <ArrowRight size={17} />
          </button>
          <a className="auth-back" href="/">
            ← Back to status page
          </a>
        </form>
      </div>
    </div>
  );
}
