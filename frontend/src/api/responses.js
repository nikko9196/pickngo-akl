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

export function submitResponse(token, payload) {
  const { sessionId, ...body } = payload;

  return request(`/api/sessions/${encodeURIComponent(sessionId)}/responses`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
