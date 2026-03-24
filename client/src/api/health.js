const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export async function getBackendHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
}
