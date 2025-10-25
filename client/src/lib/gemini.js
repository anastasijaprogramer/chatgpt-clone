
const API_BASE = import.meta.env.VITE_API_URL || "";

export async function generateFromServer(payload)
{
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data; // { text, raw }
}

export default { generateFromServer };
