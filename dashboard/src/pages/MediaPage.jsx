import React, { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MediaPage({ token }) {
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiRequest("/v1/projects", { token })
      .then((d) => setProjects(d.projects))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFiles();
  }, [projectFilter, visibilityFilter]);

  async function loadFiles() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (projectFilter) params.set("project_id", projectFilter);
      if (visibilityFilter) params.set("visibility", visibilityFilter);

      const data = await apiRequest(`/v1/files?${params.toString()}`, { token });
      setFiles(data.files);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVisibility(file) {
    const nextVis = file.visibility === "public" ? "private" : "public";
    setErr("");
    try {
      await apiRequest(`/v1/files/${file.id}`, {
        method: "PATCH",
        token,
        body: { visibility: nextVis },
      });
      await loadFiles();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleDelete(fileId) {
    setErr("");
    try {
      await apiRequest(`/v1/files/${fileId}`, { method: "DELETE", token });
      await loadFiles();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleCopyUrl(file) {
    const url = file.public_url || file.content_url;
    await navigator.clipboard.writeText(url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <div>
      <div className="page-header">
        <h1>Media Library</h1>
        <button className="btn btn-secondary" onClick={loadFiles} disabled={loading}>
          Refresh
        </button>
      </div>

      {err && <div className="alert-error">{err}</div>}

      <div className="card">
        <div className="grid-3" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="media-proj-filter">Filter by Project</label>
            <select
              id="media-proj-filter"
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
            <label htmlFor="media-vis-filter">Filter by Visibility</label>
            <select
              id="media-vis-filter"
              className="select"
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
            >
              <option value="">All Visibilities</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Uploaded Assets ({files.length})</h3>
        {loading ? (
          <div className="muted">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="muted">
            No files found. Upload files via <code>POST /v1/files/upload</code> or use the Try It
            tool on the Documentation page.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Project</th>
                <th>Type / Size</th>
                <th>Visibility</th>
                <th>Uploaded (UTC)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const proj = projectMap[f.project_id];
                return (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.original_filename}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        <code>{f.id}</code>
                      </div>
                    </td>
                    <td>{proj ? `${proj.name} (${proj.slug})` : <code>{f.project_id}</code>}</td>
                    <td>
                      <code>{f.mime_type}</code>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatBytes(f.size_bytes)}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${f.visibility === "public" ? "badge-ok" : "badge-warn"}`}
                      >
                        {f.visibility}
                      </span>
                    </td>
                    <td className="muted">
                      {new Date(f.created_at).toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleCopyUrl(f)}
                        >
                          {copiedId === f.id
                            ? "Copied!"
                            : f.visibility === "public"
                            ? "Copy Public URL"
                            : "Copy Content URL"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleToggleVisibility(f)}
                        >
                          Make {f.visibility === "public" ? "Private" : "Public"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(f.id)}
                        >
                          Delete
                        </button>
                      </div>
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

