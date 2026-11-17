const API_BASE = "/api";

function getSession() {
  try { return JSON.parse(sessionStorage.getItem("barberia_session") || "null"); }
  catch { return null; }
}
function saveSession(session) {
  if (session) sessionStorage.setItem("barberia_session", JSON.stringify(session));
}
function clearSession() { sessionStorage.removeItem("barberia_session"); }

async function apiRequest(endpoint, options = {}, retry = true) {
  const session = getSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && retry && session?.refresh_token && endpoint !== "/auth/refresh") {
    try {
      const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      const result = await refreshed.json();
      if (refreshed.ok && result.session) {
        saveSession(result.session);
        return apiRequest(endpoint, options, false);
      }
    } catch { /* Se informa el error original si no se pudo renovar. */ }
    clearSession();
  }
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}
function showMessage(element, message, type = "success") {
  if (!element) return;
  element.textContent = message;
  element.className = `form-message ${type}`;
}
function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR");
}
