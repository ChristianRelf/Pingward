import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { Brand } from "./ui";
import { PublicPage } from "./public";
import { AuthPage } from "./auth-page";
import { AdminPage } from "./admin";
import "./style.css";

function App() {
  const [bootstrap, setBootstrap] = useState(null);
  useEffect(() => {
    api("/bootstrap")
      .then(setBootstrap)
      .catch(() => setBootstrap({ needs_setup: false, admin: null }));
  }, []);
  const path = location.pathname;
  if (path.startsWith("/embed/"))
    return <PublicPage embedId={Number(path.split("/")[2])} />;
  if (!path.startsWith("/admin") && path !== "/login" && path !== "/setup")
    return <PublicPage />;
  if (!bootstrap)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="loading-pulse" />
      </div>
    );
  if (bootstrap.needs_setup)
    return (
      <AuthPage setup requiresSetupToken={bootstrap.requires_setup_token} />
    );
  if (!bootstrap.admin) return <AuthPage />;
  return <AdminPage admin={bootstrap.admin} />;
}

createRoot(document.getElementById("root")).render(<App />);
