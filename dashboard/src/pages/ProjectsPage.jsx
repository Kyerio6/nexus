import React, { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function ProjectsPage({ token }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiRequest("/v1/projects", { token });
      setProjects(data.projects);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setCreating(true);
    try {
      const payload = { name: name.trim() };
      if (slug.trim()) payload.slug = slug.trim();
      if (description.trim()) payload.description = description.trim();

      await apiRequest("/v1/projects", {
        method: "POST",
        token,
        body: payload,
      });

      setName("");
      setSlug("");
      setDescription("");
      await loadProjects();
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(project) {
    const nextStatus = project.status === "active" ? "archived" : "active";
    setErr("");
    try {
      await apiRequest(`/v1/projects/${project.id}`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
      await loadProjects();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleCopyId(id) {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-secondary" onClick={loadProjects} disabled={loading}>
          Refresh
        </button>
      </div>

      {err && <div className="alert-error">{err}</div>}

      <form className="card" onSubmit={handleCreate}>
        <h3>Create Project</h3>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="proj-name">Project Name *</label>
            <input
              id="proj-name"
              className="input"
              placeholder="e.g. YATA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="proj-slug">Slug (optional — auto-generated if blank)</label>
            <input
              id="proj-slug"
              className="input"
              placeholder="e.g. yata"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="proj-desc">Description (optional)</label>
            <input
              id="proj-desc"
              className="input"
              placeholder="Food ordering and delivery app"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn" disabled={creating}>
          {creating ? "Creating..." : "Create Project"}
        </button>
      </form>

      <div className="card">
        <h3>All Projects ({projects.length})</h3>
        {loading ? (
          <div className="muted">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="muted">No projects yet. Create your first project above.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created (UTC)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      <code>{p.id}</code>
                    </div>
                  </td>
                  <td>
                    <code>{p.slug}</code>
                  </td>
                  <td>{p.description || <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${p.status === "active" ? "badge-ok" : "badge-warn"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="muted">{new Date(p.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleCopyId(p.id)}
                      >
                        {copiedId === p.id ? "Copied!" : "Copy ID"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleToggleStatus(p)}
                      >
                        {p.status === "active" ? "Archive" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
