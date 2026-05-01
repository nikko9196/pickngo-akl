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

export function saveSelections(token, sessionId, selectedItems) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/selections`, token, {
      method: "POST",
      body: JSON.stringify({ selectedItems }),
    });
}

export function buildWheelApi(token, sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/wheel/build`, token, {
      method: "POST",
    });
}

export function spinWheel(token, sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/wheel/spin`, token, {
      method: "POST",
    });
}

export function getHost(token, sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/host`, token);
}

export function submitVoteApi(token, sessionId, vote) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/vote`, token, {
        method: "POST",
        body: JSON.stringify({ vote }),
    });
}

export function resolveVoteApi(token, sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/vote/result`, token, {
        method: "POST",
    });
}

export const ifRespin = async (token, sessionId) => {
    const result = await resolveVoteApi(token, sessionId);
    const { acceptCount, respinCount } = result.voteSummary;
    return (respinCount || 0) >= (acceptCount || 0);
};

export const ifFinalSpin = async (token, sessionId) => {
  const result = await resolveVoteApi(token, sessionId);
  const { acceptCount, respinCount } = result.voteSummary;
  return (respinCount || 0) >= (acceptCount || 0);
};

export const countVote = async (token, sessionId) => {
    const result = await resolveVoteApi(token, sessionId);
    const { acceptCount, respinCount } = result.voteSummary;
    return [respinCount || 0, acceptCount || 0];
};

export function reloadWheel(token, sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/wheel`, token);
}

export function sendReady(token, sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/ready`, token, {
      method: "POST",
  });
}

export function sendRemind(token, sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/reminder`, token, {
      method: "POST",
  });
}

export function collectReadyStatus(token, sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/ready`, token);
}

export function getFinalWheelResult(token, sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/wheel/result`, token);
}