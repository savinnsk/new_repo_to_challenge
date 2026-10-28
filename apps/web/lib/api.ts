export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
  return data as T;
}
export async function streamMessage(
  id: string,
  content: string,
  onDelta: (text: string) => void,
  onDone: (data: unknown) => void,
) {
  const response = await fetch(`/api/conversations/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "Falha ao enviar.");
  }
  if (!response.body) throw new Error("Streaming indisponível.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = block
        .split("\n")
        .find((l) => l.startsWith("event: "))
        ?.slice(7);
      const raw = block
        .split("\n")
        .find((l) => l.startsWith("data: "))
        ?.slice(6);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (event === "delta") onDelta(data.text);
      if (event === "done") {
        completed = true;
        onDone(data);
      }
      if (event === "error") throw new Error(data.error);
    }
  }
  if (!completed)
    throw new Error(
      "A conexão foi interrompida. Consulte o histórico antes de tentar novamente.",
    );
}
