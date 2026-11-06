import React, { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function LogsPage({ token }) {
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [limit, setLimit] = useState("50");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiRequest("/v1/projects", { token })
      .then((d) => setProjects(d.projects))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLogs();
  }, [projectFilter, limit]);

  async function loadLogs() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ limit });
      if (projectFilter) params.set("project_id", projectFilter);
      const data = await apiRequest(`/v1/logs?${params.toString()}`, { token });
      setLogs(data.logs);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <div>
      <div className="page-header">
        <h1>Usage / Activity Logs</h1>
        <button className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
          Refresh
        </button>
      </div>

      {err && <div className="alert-error">{err}</div>}

      <div className="card">
        <div className="grid-3" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="log-proj-filter">Filter by Project</label>
            <select
              id="log-proj-filter"
              className="select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="log-limit">Max Rows</label>
            <select
              id="log-limit"
              className="select"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent Events ({logs.length})</h3>
        {loading ? (
          <div className="muted">Loading activity logs...</div>
        ) : logs.length === 0 ? (
          <div className="muted">No activity logs recorded yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Project</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const proj = l.project_id ? projectMap[l.project_id] : null;
                return (
                  <tr key={l.id}>
                    <td className="muted">
                      {new Date(l.created_at).toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td>
                      <code>{l.action}</code>
                    </td>
                    <td>
                      {proj ? (
                        `${proj.name} (${proj.slug})`
                      ) : l.project_id ? (
                        <code>{l.project_id}</code>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-ok">{l.actor_type}</span>
                      {l.actor_id && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                          <code>{l.actor_id}</code>
                        </div>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>{JSON.stringify(l.details)}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

