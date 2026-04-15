const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithGoogle(credential) {
  return request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function continueAsGuest() {
  return request("/api/auth/guest", {
    method: "POST",
  });
}

export function getCurrentUser(token) {
  return request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
