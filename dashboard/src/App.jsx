import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { apiRequest, API_BASE_URL } from "./api.js";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import KeysPage from "./pages/KeysPage.jsx";
import MediaPage from "./pages/MediaPage.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import DocsPage from "./pages/DocsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

const PAGES = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "keys", label: "API Keys" },
  { id: "media", label: "Media Library" },
  { id: "logs", label: "Usage / Logs" },
  { id: "docs", label: "Documentation" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activePage, setActivePage] = useState("overview");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      handleSessionChange(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSessionChange(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSessionChange(nextSession) {
    setSession(nextSession);
    setAuthError("");

    if (!nextSession?.access_token) {
      setAdminUser(null);
      setCheckingAuth(false);
      return;
    }

    try {
      setCheckingAuth(true);
      const data = await apiRequest("/v1/admin/me", { token: nextSession.access_token });
      setAdminUser(data);
    } catch (err) {
      setAdminUser(null);
      setAuthError(err.message || "Could not verify admin access with NEXUS API.");
      await supabase.auth.signOut();
    } finally {
      setCheckingAuth(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h1>NEXUS Dashboard</h1>
          <div className="alert-error">
            Missing environment variables. Copy <code>dashboard/.env.example</code> to{" "}
            <code>dashboard/.env.local</code> and set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
          </div>
        </div>
      </div>
    );
  }

  if (checkingAuth) {
    return (
      <div className="login-wrapper">
        <div className="muted">Checking session...</div>
      </div>
    );
  }

  if (!session || !adminUser) {
    return <LoginScreen initialError={authError} />;
  }

  const token = session.access_token;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <h2>NEXUS</h2>
            <div className="muted">Developer Dashboard</div>
          </div>
          <ul className="nav-list">
            {PAGES.map((p) => (
              <li key={p.id}>
                <button
                  className={`nav-btn ${activePage === p.id ? "active" : ""}`}
                  onClick={() => setActivePage(p.id)}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="muted" style={{ marginBottom: 8, wordBreak: "break-all" }}>
            {adminUser.email}
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activePage === "overview" && <OverviewPage token={token} adminUser={adminUser} />}
        {activePage === "projects" && <ProjectsPage token={token} />}
        {activePage === "keys" && <KeysPage token={token} />}
        {activePage === "media" && <MediaPage token={token} />}
        {activePage === "logs" && <LogsPage token={token} />}
        {activePage === "docs" && <DocsPage token={token} />}
        {activePage === "settings" && <SettingsPage adminUser={adminUser} />}
      </main>
    </div>
  );
}

function LoginScreen({ initialError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError || "");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>NEXUS Admin</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
          Sign in with your Supabase administrator account.
        </p>

        {errorMsg && <div className="alert-error">{errorMsg}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn" style={{ width: "100%" }} disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function OverviewPage({ token, adminUser }) {
  const [health, setHealth] = useState(null);
  const [counts, setCounts] = useState({ projects: 0, files: 0, logs: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    setErr("");
    try {
      const [healthData, projectsData, filesData, logsData] = await Promise.all([
        apiRequest("/v1/health"),
        apiRequest("/v1/projects", { token }),
        apiRequest("/v1/files?limit=100", { token }),
        apiRequest("/v1/logs?limit=10", { token }),
      ]);
      setHealth(healthData);
      setCounts({
        projects: projectsData.projects.length,
        files: filesData.files.length,
        logs: logsData.logs,
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <button className="btn btn-secondary" onClick={loadOverview} disabled={loading}>
          Refresh
        </button>
      </div>

      {err && <div className="alert-error">{err}</div>}

      <div className="grid-3">
        <div className="card">
          <div className="muted">API Status</div>
          <div className="stat-value">
            {health ? (
              <span className={`badge ${health.status === "ok" ? "badge-ok" : "badge-warn"}`}>
                {health.status.toUpperCase()}
              </span>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="card">
          <div className="muted">Database</div>
          <div className="stat-value">
            {health ? (
              <span className={`badge ${health.database === "ok" ? "badge-ok" : "badge-err"}`}>
                {health.database.toUpperCase()}
              </span>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="card">
          <div className="muted">Projects / Uploaded Assets</div>
          <div className="stat-value">
            {loading ? "…" : `${counts.projects} / ${counts.files}`}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent Activity</h3>
        {loading ? (
          <div className="muted">Loading recent activity...</div>
        ) : counts.logs.length === 0 ? (
          <div className="muted">No activity recorded yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {counts.logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted">
                    {new Date(l.created_at).toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td>
                    <code>{l.action}</code>
                  </td>
                  <td>
                    <span className="badge badge-ok">{l.actor_type}</span>
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{JSON.stringify(l.details)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Platform Connection</h3>
        <p className="muted" style={{ margin: 0 }}>
          Connected to NEXUS API at <code>{API_BASE_URL}</code> as admin{" "}
          <code>{adminUser.email}</code> (<code>{adminUser.id}</code>).
        </p>
      </div>
    </div>
  );
}
