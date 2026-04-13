const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

async function request(path, token, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export function createSession(token, payload) {
  return request("/api/sessions", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMySessions(token) {
  return request("/api/sessions/mine", token);
}

export function getSessionByCode(token, sessionCode) {
  return request(`/api/sessions/code/${encodeURIComponent(sessionCode)}`, token);
}

export function getSessionProgress(token, sessionId) {
  return request(`/api/sessions/${sessionId}/progress`, token);
}

export function joinSession(token, payload) {
  return request("/api/sessions/join", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMySessionProfile(token, sessionId, payload) {
  return request(`/api/sessions/${sessionId}/me`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateSessionStatus(token, sessionId, payload) {
  return request(`/api/sessions/${sessionId}/status`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateSession(token, sessionId, payload) {
  return request(`/api/sessions/${sessionId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSession(token, sessionId) {
  return request(`/api/sessions/${sessionId}`, token, {
    method: "DELETE",
  });
}
