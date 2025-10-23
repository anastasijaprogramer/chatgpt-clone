
const API_BASE = import.meta.env.VITE_API_URL || "";

export async function generateFromServer({ prompt, model, temperature, maxOutputTokens })
{
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    credentials: "include", // ako koristiš session/cookie auth
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, model, temperature, maxOutputTokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data; // { text, raw }
}

export default { generateFromServer };
