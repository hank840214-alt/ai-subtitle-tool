const API_BASE = "";

export async function fetchCapabilities() {
  const res = await fetch(`${API_BASE}/api/capabilities`);
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/api/settings`);
  return res.json();
}

export async function updateSettings(settings: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export function streamSummary(
  jobId: string,
  onToken: (token: string) => void,
  onDone: () => void,
) {
  const es = new EventSource(`${API_BASE}/api/summarize/${jobId}`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.done) {
      es.close();
      onDone();
    } else {
      onToken(data.token);
    }
  };
  es.onerror = () => es.close();
  return () => es.close();
}

export async function sendChatMessage(jobId: string, message: string) {
  const res = await fetch(`${API_BASE}/api/chat/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res;
}
