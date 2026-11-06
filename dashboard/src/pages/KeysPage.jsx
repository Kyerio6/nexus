import React, { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function KeysPage({ token }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [keys, setKeys] = useState([]);
  const [keyName, setKeyName] = useState("");
  const [newSecretKey, setNewSecretKey] = useState(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadInitialProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadKeys(selectedProjectId);
    } else {
      setKeys([]);
    }
  }, [selectedProjectId]);

  async function loadInitialProjects() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiRequest("/v1/projects", { token });
      setProjects(data.projects);
      if (data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadKeys(projectId) {
    setErr("");
    try {
      const data = await apiRequest(`/v1/projects/${projectId}/keys`, { token });
      setKeys(data.api_keys);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleGenerateKey(e) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setErr("");
    setCreating(true);
    setNewSecretKey(null);

    try {
      const data = await apiRequest(`/v1/projects/${selectedProjectId}/keys`, {
        method: "POST",
        token,
        body: { name: keyName.trim() },
      });
      setNewSecretKey(data.api_key);
      setKeyName("");
      await loadKeys(selectedProjectId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId) {
    setErr("");
    try {
      await apiRequest(`/v1/keys/${keyId}`, { method: "DELETE", token });
      await loadKeys(selectedProjectId);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleCopySecret() {
    if (!newSecretKey?.secret_key) return;
    await navigator.clipboard.writeText(newSecretKey.secret_key);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1800);
  }

  return (
    <div>
      <div className="page-header">
        <h1>API Keys</h1>
        {selectedProjectId && (
          <button
            className="btn btn-secondary"
            onClick={() => loadKeys(selectedProjectId)}
          >
            Refresh
          </button>
        )}
      </div>

      {err && <div className="alert-error">{err}</div>}

      {loading ? (
        <div className="muted">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="muted">Create a project on the Projects page before generating API keys.</div>
        </div>
      ) : (
        <>
          <form className="card" onSubmit={handleGenerateKey}>
            <h3>Generate API Key</h3>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="key-project">Project</label>
                <select
                  id="key-project"
                  className="select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setNewSecretKey(null);
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="key-name">Key Label *</label>
                <input
                  id="key-name"
                  className="input"
                  placeholder="e.g. Production Backend"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn" disabled={creating}>
              {creating ? "Generating..." : "Generate Secret Key"}
            </button>
          </form>

          {newSecretKey && (
            <div className="alert-success">
              <strong>Save your new API key now — it will never be shown again:</strong>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 8,
                  marginBottom: 8,
                }}
              >
                <code
                  style={{
                    background: "#022c22",
                    padding: "8px 12px",
                    borderRadius: 6,
                    wordBreak: "break-all",
                    flex: 1,
                  }}
                >
                  {newSecretKey.secret_key}
                </code>
                <button type="button" className="btn" onClick={handleCopySecret}>
                  {copiedSecret ? "Copied!" : "Copy Key"}
                </button>
              </div>
              <div style={{ fontSize: 13 }}>
                Security rule: Only use <code>nx_sk_...</code> secret keys on trusted backends. Never
                embed them in public HTML, React frontends, mobile apps, or Unity builds.
              </div>
            </div>
          )}

          <div className="card">
            <h3>Project Keys ({keys.length})</h3>
            {keys.length === 0 ? (
              <div className="muted">No API keys for this project yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Created (UTC)</th>
                    <th>Last Used (UTC)</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const isRevoked = Boolean(k.revoked_at);
                    return (
                      <tr key={k.id}>
                        <td>
                          <strong>{k.name}</strong>
                        </td>
                        <td>
                          <code>{k.key_prefix}…</code>
                        </td>
                        <td className="muted">
                          {new Date(k.created_at).toISOString().slice(0, 19).replace("T", " ")}
                        </td>
                        <td className="muted">
                          {k.last_used_at
                            ? new Date(k.last_used_at).toISOString().slice(0, 19).replace("T", " ")
                            : "Never"}
                        </td>
                        <td>
                          <span className={`badge ${isRevoked ? "badge-err" : "badge-ok"}`}>
                            {isRevoked ? "revoked" : "active"}
                          </span>
                        </td>
                        <td>
                          {!isRevoked ? (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleRevoke(k.id)}
                            >
                              Revoke
                            </button>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
