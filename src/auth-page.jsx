import React, { useState } from "react";
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
      <main className="auth-card">
        <Brand />
        <form className="auth-form" onSubmit={submit}>
          <h1>{setup ? "Create admin account" : "Sign in"}</h1>
          <p>
            {setup
              ? "Set up this Pingward instance."
              : "Manage your monitors and status page."}
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
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
                placeholder="From the installer or .env"
                required
                autoComplete="off"
              />
            </label>
          )}
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? "Please wait…" : setup ? "Create account" : "Sign in"}
          </button>
          <a className="auth-back" href="/">
            Back to status page
          </a>
        </form>
      </main>
    </div>
  );
}
