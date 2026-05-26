const getBridgeBaseUrl = () => {
  return "http://localhost:8787";
};

export async function classifyTokenOnBridge(sessionId: string, tokenId: string, text: string, description: string) {
  try {
    const response = await fetch(`${getBridgeBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(tokenId)}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, description }),
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to call classify on local bridge:", err);
    return false;
  }
}


export async function saveTokenToLocalBridge(sessionId: string, tokenId: string, payload: Record<string, any>) {
  const response = await fetch(`${getBridgeBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(tokenId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Local bridge write failed (${response.status})`);
  }
}

export async function updateLocalBridgeToken(sessionId: string, tokenId: string, patch: Record<string, any>) {
  const response = await fetch(`${getBridgeBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(tokenId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Local bridge update failed (${response.status})`);
  }
}

export function subscribeLocalBridge(
  sessionId: string,
  onTokens: (tokens: Array<{ id: string; data: Record<string, any> }>) => void
) {
  const source = new EventSource(`${getBridgeBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/events`);

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    onTokens(payload.tokens || []);
  };

  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}
