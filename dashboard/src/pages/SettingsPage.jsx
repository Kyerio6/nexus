import React from "react";
import { API_BASE_URL } from "../api.js";
import { supabase } from "../supabase.js";

export default function SettingsPage({ adminUser }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h3>Administrator Account</h3>
        <table className="table">
          <tbody>
            <tr>
              <th style={{ width: 200 }}>Email</th>
              <td>{adminUser.email}</td>
            </tr>
            <tr>
              <th>Supabase User UID</th>
              <td>
                <code>{adminUser.id}</code>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => supabase.auth.signOut()}>
            Sign Out of Dashboard
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Platform Endpoints &amp; AI Discovery</h3>
        <table className="table">
          <tbody>
            <tr>
              <th style={{ width: 200 }}>NEXUS API Base URL</th>
              <td>
                <code>{API_BASE_URL}</code>
              </td>
            </tr>
            <tr>
              <th>Supabase Auth URL</th>
              <td>
                <code>{supabaseUrl}</code>
              </td>
            </tr>
            <tr>
              <th>OpenAPI 3.1 Spec</th>
              <td>
                <a href={`${API_BASE_URL}/openapi.json`} target="_blank" rel="noreferrer">
                  <code>{API_BASE_URL}/openapi.json</code>
                </a>
              </td>
            </tr>
            <tr>
              <th>AI Index (llms.txt)</th>
              <td>
                <a href={`${API_BASE_URL}/llms.txt`} target="_blank" rel="noreferrer">
                  <code>{API_BASE_URL}/llms.txt</code>
                </a>
              </td>
            </tr>
            <tr>
              <th>AI Full Reference (llms-full.txt)</th>
              <td>
                <a href={`${API_BASE_URL}/llms-full.txt`} target="_blank" rel="noreferrer">
                  <code>{API_BASE_URL}/llms-full.txt</code>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

