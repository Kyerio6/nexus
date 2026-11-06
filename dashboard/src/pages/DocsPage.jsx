import React, { useMemo, useState } from "react";
import { API_BASE_URL } from "../api.js";
import { ENDPOINT_DOCS, CODE_LANGUAGES, buildCodeExample } from "../docsData.js";

export default function DocsPage({ token }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedEndpointId, setSelectedEndpointId] = useState(ENDPOINT_DOCS[0].id);
  const [selectedLang, setSelectedLang] = useState("fetch");
  const [copiedLabel, setCopiedLabel] = useState("");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(ENDPOINT_DOCS.map((e) => e.category)));
    return ["All", ...unique];
  }, []);

  const filteredEndpoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENDPOINT_DOCS.filter((e) => {
      if (selectedCategory !== "All" && e.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory]);

  const activeEndpoint =
    filteredEndpoints.find((e) => e.id === selectedEndpointId) ||
    filteredEndpoints[0] ||
    ENDPOINT_DOCS[0];

  const codeSnippet = useMemo(
    () => buildCodeExample(activeEndpoint, selectedLang, API_BASE_URL),
    [activeEndpoint, selectedLang]
  );

  async function copyText(text, label) {
    await navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(""), 1600);
  }

  const aiPromptText = `Read the NEXUS API documentation at ${API_BASE_URL}/llms.txt (or ${API_BASE_URL}/llms-full.txt and ${API_BASE_URL}/openapi.json). Follow the official NEXUS endpoints, response format, and security rules without inventing routes or exposing nx_sk_ secret keys in client-side code.`;

  return (
    <div>
      <div className="page-header">
        <h1>Developer &amp; AI Documentation</h1>
      </div>

      {/* AI IDE Discovery Banner (Section 14) */}
      <div className="card">
        <h3>AI Assistant &amp; IDE Integration</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Give your AI coding assistant these machine-readable endpoints so it can discover and
          integrate NEXUS services automatically:
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <a
            className="btn btn-secondary"
            href={`${API_BASE_URL}/llms.txt`}
            target="_blank"
            rel="noreferrer"
          >
            /llms.txt (Index)
          </a>
          <a
            className="btn btn-secondary"
            href={`${API_BASE_URL}/llms-full.txt`}
            target="_blank"
            rel="noreferrer"
          >
            /llms-full.txt (Complete Docs)
          </a>
          <a
            className="btn btn-secondary"
            href={`${API_BASE_URL}/openapi.json`}
            target="_blank"
            rel="noreferrer"
          >
            /openapi.json (OpenAPI 3.1)
          </a>
          <button
            type="button"
            className="btn"
            onClick={() => copyText(aiPromptText, "ai-prompt")}
          >
            {copiedLabel === "ai-prompt" ? "Copied AI Prompt!" : "Copy AI Assistant Prompt"}
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="card">
        <div className="grid-3" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="doc-search">Search Endpoints</label>
            <input
              id="doc-search"
              className="input"
              placeholder="Search by path, method, or keyword (e.g. upload, keys)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="doc-cat">Category</label>
            <select
              id="doc-cat"
              className="select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="docs-grid">
        {/* Left Sidebar: Endpoint List */}
        <div className="card docs-list">
          <h3>Endpoints ({filteredEndpoints.length})</h3>
          {filteredEndpoints.length === 0 ? (
            <div className="muted">No endpoints match your search.</div>
          ) : (
            <ul className="nav-list">
              {filteredEndpoints.map((ep) => (
                <li key={ep.id}>
                  <button
                    type="button"
                    className={`nav-btn ${activeEndpoint.id === ep.id ? "active" : ""}`}
                    onClick={() => setSelectedEndpointId(ep.id)}
                  >
                    <div style={{ fontWeight: 600 }}>{ep.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      <code>
                        {ep.method} {ep.path}
                      </code>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Panel: Selected Endpoint Reference + Code Examples + Try It */}
        <div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span className="badge badge-ok">{activeEndpoint.method}</span>
              <code style={{ fontSize: 16 }}>
                {API_BASE_URL}
                {activeEndpoint.path}
              </code>
            </div>
            <h2 style={{ margin: "4px 0 8px" }}>{activeEndpoint.title}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {activeEndpoint.description}
            </p>

            <table className="table" style={{ marginBottom: 16 }}>
              <tbody>
                <tr>
                  <th style={{ width: 190 }}>Authentication</th>
                  <td>{activeEndpoint.authDescription}</td>
                </tr>
                <tr>
                  <th>Required Headers</th>
                  <td>
                    {activeEndpoint.headers.length === 0 ? (
                      <span className="muted">None</span>
                    ) : (
                      activeEndpoint.headers.map((h) => (
                        <div key={h.name}>
                          <code>
                            {h.name}: {h.value}
                          </code>
                        </div>
                      ))
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Required Parameters</th>
                  <td>
                    {activeEndpoint.requiredParams.length === 0 ? (
                      <span className="muted">None</span>
                    ) : (
                      activeEndpoint.requiredParams.map((p) => (
                        <div key={p.name}>
                          <code>{p.name}</code> ({p.in}, {p.type}) — {p.description}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Optional Parameters</th>
                  <td>
                    {activeEndpoint.optionalParams.length === 0 ? (
                      <span className="muted">None</span>
                    ) : (
                      activeEndpoint.optionalParams.map((p) => (
                        <div key={p.name}>
                          <code>{p.name}</code> ({p.in}, {p.type}) — {p.description}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Request Body Format</th>
                  <td>
                    <code>{activeEndpoint.requestBodyFormat}</code>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Ready-to-copy Code Examples (Section 13.B & 13.C) */}
            <h3>Copy-Paste Code Examples</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  className={`btn ${selectedLang === lang.id ? "" : "btn-secondary"}`}
                  onClick={() => setSelectedLang(lang.id)}
                >
                  {lang.label}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() => copyText(codeSnippet, "code")}
              >
                {copiedLabel === "code" ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <pre className="code-block">{codeSnippet}</pre>

            {/* Successful & Error Response Examples */}
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Successful Response</h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      copyText(JSON.stringify(activeEndpoint.successResponse, null, 2), "res-ok")
                    }
                  >
                    {copiedLabel === "res-ok" ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
                <pre className="code-block">
                  {JSON.stringify(activeEndpoint.successResponse, null, 2)}
                </pre>
              </div>

              <div>
                <h3>Possible Error Responses</h3>
                <pre className="code-block">
                  {JSON.stringify(
                    activeEndpoint.errorResponses.map((er) => ({
                      http_status: er.status,
                      body: {
                        success: false,
                        data: null,
                        meta: { request_id: "uuid", version: "v1" },
                        error: { code: er.code, message: er.message },
                      },
                    })),
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>

          {/* Interactive Try It Panel (Section 13.D) */}
          <TryItPanel key={activeEndpoint.id} endpoint={activeEndpoint} adminToken={token} />
        </div>
      </div>
    </div>
  );
}

function TryItPanel({ endpoint, adminToken }) {
  const [pathInput, setPathInput] = useState(endpoint.path);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [useAdminSession, setUseAdminSession] = useState(endpoint.authType === "admin");
  const [jsonBodyInput, setJsonBodyInput] = useState(
    endpoint.sampleRequestBody ? JSON.stringify(endpoint.sampleRequestBody, null, 2) : ""
  );
  const [uploadFileObj, setUploadFileObj] = useState(null);
  const [uploadVisibility, setUploadVisibility] = useState("private");
  const [running, setRunning] = useState(false);
  const [resultStatus, setResultStatus] = useState(null);
  const [resultBody, setResultBody] = useState("");

  const isUpload = endpoint.id === "upload-file";
  const acceptsJsonBody =
    !isUpload && (endpoint.method === "POST" || endpoint.method === "PATCH");

  async function handleExecute(e) {
    e.preventDefault();
    setRunning(true);
    setResultStatus(null);
    setResultBody("");

    try {
      const headers = {};
      if (endpoint.authType === "admin" || (useAdminSession && adminToken)) {
        headers.Authorization = `Bearer ${adminToken}`;
      } else if (apiKeyInput.trim()) {
        headers.Authorization = `Bearer ${apiKeyInput.trim()}`;
      }

      let body = undefined;
      if (isUpload) {
        if (!uploadFileObj) {
          setResultStatus(400);
          setResultBody("Please choose a file to upload first.");
          setRunning(false);
          return;
        }
        const form = new FormData();
        form.append("file", uploadFileObj);
        form.append("visibility", uploadVisibility);
        body = form;
      } else if (acceptsJsonBody && jsonBodyInput.trim()) {
        headers["Content-Type"] = "application/json";
        body = jsonBodyInput;
      }

      const cleanPath = pathInput.startsWith("/") ? pathInput : `/${pathInput}`;
      const res = await fetch(`${API_BASE_URL}${cleanPath}`, {
        method: endpoint.method,
        headers,
        body,
      });

      setResultStatus(res.status);
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setResultBody(JSON.stringify(json, null, 2));
      } else {
        const blob = await res.blob();
        setResultBody(
          `Binary response received:\nContent-Type: ${contentType}\nSize: ${blob.size} bytes`
        );
      }
    } catch (err) {
      setResultStatus(0);
      setResultBody(`Network error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <form className="card" onSubmit={handleExecute}>
      <h3>Interactive Try It — {endpoint.method} {endpoint.path}</h3>
      <div className="alert-error" style={{ background: "#422006", borderColor: "#d97706", color: "#fde68a" }}>
        <strong>Security Warning:</strong> Browser-based credentials are visible to users. Never
        embed secret API keys (<code>nx_sk_...</code>) in public HTML, React applications, mobile
        apps, or Unity builds. Use this tool only for developer testing.
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="try-path">Request Path (replace {"{id}"} or add query params)</label>
          <input
            id="try-path"
            className="input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="try-auth">Authentication</label>
          {endpoint.authType === "none" ? (
            <input className="input" value="None (Public endpoint)" disabled />
          ) : endpoint.authType === "admin" ? (
            <input
              className="input"
              value="Using your active logged-in Admin session token"
              disabled
            />
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="try-auth"
                className="input"
                placeholder="Paste nx_sk_... API key"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setUseAdminSession(false);
                }}
              />
              {endpoint.id !== "app-me" && endpoint.id !== "upload-file" && (
                <label style={{ whiteSpace: "nowrap", fontSize: 12, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={useAdminSession}
                    onChange={(e) => setUseAdminSession(e.target.checked)}
                  />{" "}
                  Use Admin Token
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {isUpload && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="try-file">Select Test File *</label>
            <input
              id="try-file"
              type="file"
              className="input"
              onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)}
            />
          </div>
          <div className="field">
            <label htmlFor="try-vis">Visibility</label>
            <select
              id="try-vis"
              className="select"
              value={uploadVisibility}
              onChange={(e) => setUploadVisibility(e.target.value)}
            >
              <option value="private">private</option>
              <option value="public">public</option>
            </select>
          </div>
        </div>
      )}

      {acceptsJsonBody && (
        <div className="field">
          <label htmlFor="try-body">JSON Request Body</label>
          <textarea
            id="try-body"
            className="textarea"
            rows={4}
            value={jsonBodyInput}
            onChange={(e) => setJsonBodyInput(e.target.value)}
          />
        </div>
      )}

      <button type="submit" className="btn" disabled={running}>
        {running ? "Sending Request..." : `Send ${endpoint.method} Request`}
      </button>

      {resultStatus !== null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>HTTP Status: </strong>
            <span
              className={`badge ${
                resultStatus >= 200 && resultStatus < 300 ? "badge-ok" : "badge-err"
              }`}
            >
              {resultStatus || "ERROR"}
            </span>
          </div>
          <pre className="code-block">{resultBody}</pre>
        </div>
      )}
    </form>
  );
}

