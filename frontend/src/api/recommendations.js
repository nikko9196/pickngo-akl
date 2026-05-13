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
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

export function generateRecommendations(token, sessionId, options = {}) {
  const refresh = options.refresh ? "?refresh=true" : "";

  return request(`/api/sessions/${sessionId}/recommendations${refresh}`, token, {
    method: "POST",
  });
}

export function getRecommendations(token, sessionId) {
  return request(`/api/sessions/${sessionId}/recommendations/latest`, token);
}

export function saveMySelections(token, sessionId, placeIds) {
  return request(`/api/sessions/${sessionId}/selections/me`, token, {
    method: "PUT",
    body: JSON.stringify({ placeIds }),
  });
}

export function getMySelections(token, sessionId) {
  return request(`/api/sessions/${sessionId}/selections/me`, token);
}
