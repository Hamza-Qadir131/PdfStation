// Small wrapper around fetch that attaches the login token and
// gives every page the same error handling.

const API_BASE = window.PDFSTATION_API_BASE || "http://localhost:4000";

const Auth = {
  getToken() {
    return localStorage.getItem("pdfstation_token");
  },
  getUser() {
    const raw = localStorage.getItem("pdfstation_user");
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem("pdfstation_token", token);
    localStorage.setItem("pdfstation_user", JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem("pdfstation_token");
    localStorage.removeItem("pdfstation_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
};

async function apiRequest(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new Error((data && data.error) || "Something went wrong. Try again.");
  }
  return data;
}

// Renders the top navigation depending on login state.
// Call this on every page after the DOM is ready.
function renderNav() {
  const slot = document.getElementById("nav-auth-slot");
  if (!slot) return;
  const user = Auth.getUser();
  if (user) {
    slot.innerHTML = `
      <a href="/dashboard">Dashboard</a>
      <span style="color:var(--paper-dim); font-family: var(--font-mono); font-size:13px;">${escapeHtml(user.email)}</span>
      <button class="btn btn-ghost" id="logout-btn">Log out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      Auth.clearSession();
      window.location.href = "/index";
    });
  } else {
    slot.innerHTML = `
      <a href="/login">Log in</a>
      <a class="btn btn-primary" href="/register">Sign up free</a>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Downloads a file from an authenticated endpoint (browsers can't attach
// an Authorization header to a plain <a href>, so we fetch as a blob).
async function downloadJob(downloadUrl) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${downloadUrl}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    alert("Couldn't download that file — it may have expired.");
    return;
  }
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "download";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

document.addEventListener("DOMContentLoaded", renderNav);
